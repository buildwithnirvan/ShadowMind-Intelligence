import time
import httpx
import json

base_url = "http://127.0.0.1:11434"
print(f"Testing Ollama at {base_url}...")

client = httpx.Client(timeout=60.0)

# Check tags
t0 = time.time()
res = client.get(f"{base_url}/api/tags")
print(f"Tags query took {round(time.time() - t0, 3)}s, status={res.status_code}")
models = [m["name"] for m in res.json().get("models", [])]
print(f"Installed models: {models}")

# Test chat with llama3.2:latest
if "llama3.2:latest" in models or any("llama3.2" in m for m in models):
    model_name = "llama3.2:latest" if "llama3.2:latest" in models else models[0]
    print(f"\nTesting inference with {model_name}...")
    t0 = time.time()
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": "Hello! In two sentences, introduce yourself as a mental wellness assistant."}],
        "stream": False,
        "options": {"num_predict": 100}
    }
    chat_res = client.post(f"{base_url}/api/chat", json=payload, timeout=60.0)
    dur = round(time.time() - t0, 3)
    print(f"Chat response took {dur}s, status={chat_res.status_code}")
    if chat_res.status_code == 200:
        content = chat_res.json().get("message", {}).get("content", "")
        print(f"Response: {content}")
        load_dur = chat_res.json().get("load_duration", 0) / 1e9
        eval_dur = chat_res.json().get("eval_duration", 0) / 1e9
        eval_count = chat_res.json().get("eval_count", 0)
        print(f"Load duration: {round(load_dur, 3)}s, Eval duration: {round(eval_dur, 3)}s ({eval_count} tokens)")
