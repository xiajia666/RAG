from openai import OpenAI

import config

_client = None


def get_client():
    """获取 DeepSeek（OpenAI 兼容协议）客户端，全局复用。"""
    global _client
    if _client is None:
        if not config.DEEPSEEK_API_KEY:
            raise RuntimeError("DEEPSEEK_API_KEY 未配置，请在 .env 中填写")
        _client = OpenAI(
            api_key=config.DEEPSEEK_API_KEY,
            base_url=config.DEEPSEEK_BASE_URL,
        )
    return _client


def chat_stream(messages):
    """流式对话，逐个 yield 返回文本片段。"""
    stream = get_client().chat.completions.create(
        model=config.DEEPSEEK_MODEL,
        messages=messages,
        stream=True,
        temperature=0.7,
        max_tokens=2048,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content
