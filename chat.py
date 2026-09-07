from llm import chat_stream

def main():
    print("deepseek 控制台对话，输入exit 退出")
    messages = [
        {"role":"system","content":"你是助手，请用简洁中文回答"
}
    ]

    while True:
        use_input = input("\n 请输入：").strip()
        if not use_input:
            continue
        if use_input.lower() in ("exit","quit"):
            print("再见")
            break
        messages.append({"role":"user","content":use_input})

        print("助手: ", end="", flush=True)
        full_answer = ""
        for token in chat_stream(messages):
            print(token, end="", flush=True)
            full_answer += token

    print()
    messages.append({"role":"assistant","content":full_answer})

if __name__ == "__main__":
    main()