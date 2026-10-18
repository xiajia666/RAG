"""HTTP endpoints for one business domain."""
from flask import Response, stream_with_context
from controllers.common import *
from controllers.runtime import AdminUser, CurrentUser, HTTPException, api
from core.schemas import ChatRequest
from services import chat_service

@api.post('/api/chat/stream')
def chat_stream(req: ChatRequest, user=CurrentUser()):
    query = req.message.strip()
    kb_id = req.kb_id.strip()
    if not query:
        raise HTTPException(400, "消息为空")
    get_kb_for_user(kb_id, user)
    try:
        _session_id, events = chat_service.prepare_chat(
            user["tenant_id"], user["id"], kb_id, query, req.session_id,
        )
    except chat_service.ChatServiceError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc

    def generate():
        for event in events:
            if event["type"] == "done":
                yield "data: [DONE]\n\n"
            else:
                yield sse_event(event)

    return Response(stream_with_context(generate()), mimetype="text/event-stream")
