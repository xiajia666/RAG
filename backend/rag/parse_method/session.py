"""ONNX Runtime 会话缓存。

对应参考实现 native/session.go / session_pool.go。Python 的 onnxruntime 原生支持
动态输入尺寸，因此 det / rec 这类可变宽度的模型无需像 Go 那样按形状分池——
单个 InferenceSession 即可处理任意尺寸输入，会话按模型路径复用。
"""
import threading

_session_cache = {}
_lock = threading.Lock()


def get_session(model_path: str, intra_threads: int = 1):
    """按模型路径复用 InferenceSession（线程安全、惰性创建）。"""
    import onnxruntime as ort

    with _lock:
        if model_path not in _session_cache:
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = max(1, intra_threads)
            opts.log_severity_level = 3  # 仅打印错误
            _session_cache[model_path] = ort.InferenceSession(
                model_path, sess_options=opts, providers=["CPUExecutionProvider"]
            )
        return _session_cache[model_path]


def run(model_path: str, input_name: str, output_name: str, blob, intra_threads: int = 1):
    """单输入单输出推理，返回输出数组。"""
    session = get_session(model_path, intra_threads)
    return session.run([output_name], {input_name: blob})[0]
