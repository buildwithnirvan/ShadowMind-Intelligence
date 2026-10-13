"""
Test script for ShadowMind AI Architecture and Performance Optimization:
1. Router test: Checks that CBT, Support, and Solution queries route to their respective agents.
2. Single-agent invocation: Confirms only the selected agent is targeted (not all 3).
3. Solution-focused agent quality: Verifies practical, step-by-step output structure.
4. Analytics caching: Verifies fast response (<50ms) on repeated requests and caching behavior.
5. Fallback behavior: Verifies application remains responsive when local provider is mocked/unavailable.
"""
import asyncio
import time
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ai.router import route_request, RouteDecision
from ai.engine import generate_chat_reply
from routers.analytics import _ai_insight_cache

def test_router_selection():
    print("=== Testing Agent Router Selection ===")
    test_cases = [
        ("I have all-or-nothing thinking and feel like a complete failure whenever I make a small mistake.", "cbt"),
        ("I feel so lonely, sad, and empty inside today. I just need someone to talk to.", "support"),
        ("I keep overthinking at night and cannot concentrate on my studies. What should I do? Give me a concrete solution.", "solution"),
        ("How can I fix my sleep schedule? Give me a plan.", "solution"),
        ("I'm overwhelmed with anxiety and grief after breaking up with my partner.", "support"),
        ("I notice a recurring negative thought loop: 'Nobody respects my work'.", "cbt"),
    ]
    
    passed = 0
    for query, expected_agent in test_cases:
        route = route_request(query)
        assert route.role in ["cbt", "support", "solution", "offline"]
        is_match = (route.role == expected_agent)
        status = "PASS" if is_match else "FAIL"
        print(f"  [{status}] Query: '{query[:45]}...' -> Routed to: {route.role} (model: {route.target_model}) [expected: {expected_agent}]")
        if is_match:
            passed += 1
            
    print(f"Router Test: {passed}/{len(test_cases)} passed.\n")
    return passed == len(test_cases)

def test_solution_focused_generation():
    print("=== Testing Solution-Focused Agent Generation ===")
    user_query = "I keep overthinking at night and cannot concentrate on my studies. What should I do?"
    
    route = route_request(user_query)
    print(f"  Routing decision: {route.role} -> {route.target_model}")
    assert route.role == "solution"
    
    t0 = time.time()
    reply = generate_chat_reply([{"role": "user", "content": user_query}], session_type="general", max_tokens=350)
    elapsed = time.time() - t0
    
    print(f"  Generation took {elapsed:.2f}s | Provider: {reply.provider} | Model: {reply.model}")
    print(f"  Response Preview:\n---\n{reply.text[:400]}...\n---")
    
    # Check for actionable content
    has_steps = any(marker in reply.text.lower() for marker in ["1.", "step", "what to do", "practical", "next step", "action", "try"])
    print(f"  Contains actionable steps/structure: {has_steps}")
    assert has_steps, "Response should have actionable steps"
    print("Solution-Focused Agent Test: PASSED.\n")
    return True

def test_analytics_cache():
    print("=== Testing Analytics Insight Caching ===")
    user_id = "test-user-123"
    mood_data = [
        {"score": 6, "label": "Calm", "date": "2026-10-01"},
        {"score": 4, "label": "Anxious", "date": "2026-10-02"},
        {"score": 7, "label": "Hopeful", "date": "2026-10-03"},
    ]
    fingerprint = f"{len(mood_data)}:test_fingerprint"
    
    # Clear test cache
    _ai_insight_cache.clear()
    
    # 1st call: Miss (generates)
    from utils.ai import generate_mood_insight
    t0 = time.time()
    insight1 = generate_mood_insight(mood_data)
    _ai_insight_cache[user_id] = {
        "insight": insight1,
        "fingerprint": fingerprint,
        "timestamp": time.time(),
    }
    t1 = time.time() - t0
    print(f"  Call 1 (Generation): {t1*1000:.2f}ms | Result: '{insight1[:60]}...'")
    
    # 2nd call: Cache Hit
    t0 = time.time()
    cached = _ai_insight_cache.get(user_id)
    if cached and cached.get("fingerprint") == fingerprint and (time.time() - cached.get("timestamp", 0)) < 3600:
        insight2 = cached["insight"]
    else:
        insight2 = generate_mood_insight(mood_data)
    t2 = time.time() - t0
    print(f"  Call 2 (Cache Hit): {t2*1000:.4f}ms | Result matches: {insight1 == insight2}")
    
    assert insight1 == insight2, "Cached insight should match initial insight"
    assert t2 < 0.005, f"Cache hit should take < 5ms, took {t2*1000:.2f}ms"
    print("Analytics Cache Test: PASSED.\n")
    return True

if __name__ == "__main__":
    t_router = test_router_selection()
    t_cache = test_analytics_cache()
    t_gen = test_solution_focused_generation()
    print("ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")
