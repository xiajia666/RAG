"""Prompt and context assembly for retrieval-augmented generation."""

SYSTEM_PROMPT_TEMPLATE = """你是一个面向小微企业场景的知识库问答助手，请严格根据下面提供的「知识库内容」回答用户的问题。

要求：
1. 只使用「知识库内容」里的信息回答，不要编造或补充。
2. 如果知识库内容不足以回答，请直接说明"知识库中没有找到相关信息"。
3. 用简洁、清晰的中文回答。

知识库内容：
{context}
"""


def build_messages(history: list[dict], query: str, results: list[dict]) -> list[dict[str, str]]:
    """Combine retrieved passages, recent history and the current question."""
    if results:
        context = "\n\n---\n\n".join(
            f"[{index + 1}] 来源：{row['filename']}\n{row['content']}"
            for index, row in enumerate(results)
        )
    else:
        context = "（没有检索到相关知识库内容）"

    messages = [{"role": "system", "content": SYSTEM_PROMPT_TEMPLATE.format(context=context)}]
    for message in history[-12:]:
        role = message.get("role")
        content = message.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": query})
    return messages
