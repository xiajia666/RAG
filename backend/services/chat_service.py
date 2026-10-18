"""Chat orchestration independent of Flask request and response objects."""
import uuid
from collections.abc import Iterator

from rag import llm
from rag import vector_store
from rag.generation import build_messages
from repositories import chat_repository


class ChatServiceError(Exception):
    """Expected chat validation failure with an HTTP-compatible status."""
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code


def prepare_chat(tenant_id: str, user_id: str, kb_id: str, query: str,
                 requested_session_id: str | None) -> tuple[str, Iterator[dict]]:
    """Validate/create a session and return structured streaming events."""
    session_id = (requested_session_id or "").strip()
    if session_id:
        session = chat_repository.get_owned_session(session_id, tenant_id, user_id)
        if not session:
            raise ChatServiceError("会话不存在", 404)
        if session["kb_id"] != kb_id:
            raise ChatServiceError("会话不属于该知识库", 400)
    else:
        session_id = uuid.uuid4().hex
        chat_repository.create_session(session_id, tenant_id, user_id, kb_id, query[:20])

    def generate() -> Iterator[dict]:
        results = vector_store.search(tenant_id, kb_id, query)
        sources = [{"filename": row["filename"], "score": round(row["score"], 4)} for row in results]
        yield {"type": "meta", "session_id": session_id, "sources": sources}

        history = chat_repository.get_history(session_id, tenant_id)
        messages = build_messages(history, query, results)
        answer_parts = []
        try:
            for token in llm.chat_stream(messages):
                answer_parts.append(token)
                yield {"type": "content", "text": token}
        except Exception as exc:
            yield {"type": "error", "message": str(exc)}
        chat_repository.save_exchange(session_id, tenant_id, query, "".join(answer_parts), sources)
        yield {"type": "done"}

    return session_id, generate()
