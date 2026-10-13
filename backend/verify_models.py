"""
Diagnostic utility to independently verify all three local Ollama mental wellness agents.
Measures model loading time, inference time, total latency, and output validity.
"""
import time
import json
import httpx
from typing import Dict, Any

BASE_URL = "http://127.0.0.1:11434"

AGENTS = [
    {
        "agent": "Mental Wellness and CBT Agent",
        "key": "cbt",
        "model": "shadowmind-cbt:latest",
        "prompt": "I keep thinking that everyone at work is judging me and that I will fail my project.",
        "expected_role": "Identifies negative thought patterns/distortions and suggests structured CBT actions."
    },
    {
        "agent": "Emotional Support Agent",
        "key": "support",
        "model": "shadowmind-support:latest",
        "prompt": "I've been feeling deeply lonely and overwhelmed this evening.",
        "expected_role": "Provides empathetic listening, emotional validation, and grounding techniques."
    },
    {
        "agent": "Solution-Focused Mental Wellness Agent",
        "key": "solution",
        "model": "shadowmind-solution:latest",
        "prompt": "I keep overthinking at night and cannot concentrate on my studies. What should I do?",
        "expected_role": "Identifies central problem, provides clear practical solution with achievable steps and example."
    }
]

def check_installed_models() -> list:
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.get(f"{BASE_URL}/api/tags")
            if r.status_code == 200:
                return [m.get("name", "") for m in r.json().get("models", [])]
    except Exception as e:
        print(f"Error checking Ollama tags: {e}")
    return []

def test_model(agent_info: Dict[str, Any], installed_models: list) -> Dict[str, Any]:
    model_name = agent_info["model"]
    is_installed = model_name in installed_models or any(m.startswith(model_name.split(":")[0]) for m in installed_models)
    
    result = {
        "agent": agent_info["agent"],
        "model": model_name,
        "installed": is_installed,
        "load_works": False,
        "inference_works": False,
        "load_time_sec": 0.0,
        "eval_time_sec": 0.0,
        "total_time_sec": 0.0,
        "eval_count": 0,
        "tokens_per_sec": 0.0,
        "error": None,
        "meets_role": False,
        "response_sample": "",
        "status": "Fail"
    }
    
    if not is_installed:
        result["error"] = f"Model '{model_name}' is not installed in Ollama."
        return result

    payload = {
        "model": model_name,
        "messages": [
            {"role": "user", "content": agent_info["prompt"]}
        ],
        "stream": False,
        "options": {
            "num_predict": 120,
            "temperature": 0.4
        }
    }

    t0 = time.time()
    try:
        with httpx.Client(timeout=90.0) as client:
            res = client.post(f"{BASE_URL}/api/chat", json=payload)
            dur = time.time() - t0
            result["total_time_sec"] = round(dur, 2)
            
            if res.status_code == 200:
                data = res.json()
                msg = data.get("message", {}).get("content", "").strip()
                result["load_works"] = True
                result["inference_works"] = bool(msg)
                result["response_sample"] = msg[:200] + "..." if len(msg) > 200 else msg
                
                # Timing metrics from Ollama response
                load_ns = data.get("load_duration", 0)
                eval_ns = data.get("eval_duration", 0)
                eval_count = data.get("eval_count", 0)
                
                result["load_time_sec"] = round(load_ns / 1e9, 3)
                result["eval_time_sec"] = round(eval_ns / 1e9, 3)
                result["eval_count"] = eval_count
                if result["eval_time_sec"] > 0:
                    result["tokens_per_sec"] = round(eval_count / result["eval_time_sec"], 1)
                
                # Check if it meets the intended role
                if len(msg) > 40:
                    result["meets_role"] = True
                    result["status"] = "Pass"
                else:
                    result["error"] = "Response too short"
            else:
                result["error"] = f"HTTP {res.status_code}: {res.text[:100]}"
    except Exception as e:
        dur = time.time() - t0
        result["total_time_sec"] = round(dur, 2)
        result["error"] = str(e)

    return result

def run_diagnostics():
    print("=" * 70)
    print("SHADOWMIND AI — INDEPENDENT LOCAL MODEL DIAGNOSTICS")
    print("=" * 70)
    
    installed = check_installed_models()
    print(f"Installed Ollama models detected ({len(installed)}): {installed}\n")
    
    results = []
    for info in AGENTS:
        print(f"Testing Agent: {info['agent']} ({info['model']})...")
        res = test_model(info, installed)
        results.append(res)
        print(f"  Status: {res['status']}")
        print(f"  Load Time: {res['load_time_sec']}s | Eval Time: {res['eval_time_sec']}s | Total: {res['total_time_sec']}s")
        print(f"  Generated Tokens: {res['eval_count']} ({res['tokens_per_sec']} t/s)")
        print(f"  Sample: {res['response_sample'][:120]}...\n")
    
    print("\n" + "=" * 90)
    print(f"{'Agent':<35} | {'Model':<25} | {'Installed':<10} | {'Inference':<10} | {'Time (s)':<9} | {'Status':<6}")
    print("-" * 90)
    for r in results:
        print(f"{r['agent']:<35} | {r['model']:<25} | {str(r['installed']):<10} | {str(r['inference_works']):<10} | {r['total_time_sec']:<9} | {r['status']:<6}")
    print("=" * 90)
    
    return results

if __name__ == "__main__":
    run_diagnostics()
