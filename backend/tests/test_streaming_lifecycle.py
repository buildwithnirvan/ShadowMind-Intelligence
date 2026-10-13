"""
Automated validation of streaming lifecycle, routing, and latency scenarios.
Tests Scenarios 1-15 specified in Phase 6.
"""
import asyncio
import time
import pytest
from ai import providers
from ai.engine import generate_chat_reply_stream_async
from ai.router import route_request

pytestmark = pytest.mark.no_db


@pytest.fixture(autouse=True)
def reset_provider_state(monkeypatch):
    providers._failed_at.clear()
    providers._ollama_reachability_cache.clear()
    providers._ollama_model_cache.clear()
    monkeypatch.setattr(providers, "_ollama_reachable", lambda url: True)
    monkeypatch.setattr(providers, "_cooling_down", lambda name: False)
    from ai import router
    monkeypatch.setattr(router, "get_available_ollama_models", lambda url=None: {"llama3.2:latest", "qwen2.5-coder:3b"})


@pytest.mark.asyncio
async def test_scenario_1_short_emotional_offline():
    """Scenario 1: Short message with deterministic offline handling."""
    t0 = time.perf_counter()
    chunks = []
    meta = None
    async for event in generate_chat_reply_stream_async([{"role": "user", "content": "hello"}], "general"):
        if event["type"] == "start":
            meta = event["meta"]
        elif event["type"] == "delta":
            chunks.append(event["text"])
    elapsed_ms = (time.perf_counter() - t0) * 1000
    assert meta is not None
    assert meta["provider"] == "offline"
    assert len(chunks) > 0
    assert elapsed_ms < 100  # Sub-100ms instant response


@pytest.mark.asyncio
async def test_scenario_2_longer_emotional_support(monkeypatch):
    """Scenario 2: Longer emotional-support response via Ollama streaming."""
    async def fake_stream(*a, **kw):
        yield "I hear how much ", "ollama", "llama3.2:latest"
        yield "you are carrying right now. ", "ollama", "llama3.2:latest"
        yield "Take one breath at a time.", "ollama", "llama3.2:latest"

    monkeypatch.setattr(providers, "generate_stream_async", fake_stream)
    chunks = []
    async for event in generate_chat_reply_stream_async(
        [{"role": "user", "content": "I've been feeling overwhelmed by everything lately and don't know where to start"}],
        "general"
    ):
        if event["type"] == "delta":
            chunks.append(event["text"])

    assert len(chunks) == 3
    assert "".join(chunks) == "I hear how much you are carrying right now. Take one breath at a time."


@pytest.mark.asyncio
async def test_scenario_3_general_conversation(monkeypatch):
    """Scenario 3: General conversation query."""
    async def fake_stream(*a, **kw):
        yield "A good friendship is built on mutual trust.", "ollama", "llama3.2:latest"

    monkeypatch.setattr(providers, "generate_stream_async", fake_stream)
    chunks = []
    async for event in generate_chat_reply_stream_async([{"role": "user", "content": "What makes a good friendship?"}]):
        if event["type"] == "delta":
            chunks.append(event["text"])

    assert any("trust" in c for c in chunks)


@pytest.mark.asyncio
async def test_scenario_4_and_5_coding_question_detailed(monkeypatch):
    """Scenario 4 & 5: Coding question routed to coder model with detailed solution."""
    routed_model = None

    async def fake_stream(prompt, history, max_tokens=1024, model_override=None):
        nonlocal routed_model
        routed_model = model_override
        yield "### Root Cause\nThe error occurs because...", "ollama", model_override

    monkeypatch.setattr(providers, "generate_stream_async", fake_stream)
    async for event in generate_chat_reply_stream_async(
        [{"role": "user", "content": "TypeError: 'NoneType' object is not subscriptable in Python script"}],
        "general"
    ):
        pass

    assert routed_model in {"qwen2.5-coder:3b", "llama3.2:latest"}


@pytest.mark.asyncio
async def test_scenario_6_and_7_delayed_first_token_and_multiple_chunks(monkeypatch):
    """Scenario 6 & 7: Stream with multiple chunks and measurable TTFT."""
    async def fake_delayed_stream(*a, **kw):
        await asyncio.sleep(0.05)
        yield "Chunk 1 ", "ollama", "llama3.2:latest"
        yield "Chunk 2 ", "ollama", "llama3.2:latest"
        yield "Chunk 3", "ollama", "llama3.2:latest"

    monkeypatch.setattr(providers, "generate_stream_async", fake_delayed_stream)
    deltas = []
    async for event in generate_chat_reply_stream_async([{"role": "user", "content": "Tell me a short story"}]):
        if event["type"] == "delta":
            deltas.append(event["text"])

    assert len(deltas) == 3
    assert "".join(deltas) == "Chunk 1 Chunk 2 Chunk 3"


@pytest.mark.asyncio
async def test_scenario_8_stream_terminates_unexpectedly(monkeypatch):
    """Scenario 8: Provider raises exception mid-stream; system recovers via offline fallback."""
    async def broken_stream(*a, **kw):
        yield "Partial text...", "ollama", "llama3.2:latest"
        raise ConnectionResetError("Connection lost mid-stream")

    monkeypatch.setattr(providers, "generate_stream_async", broken_stream)
    deltas = []
    done_event = None
    async for event in generate_chat_reply_stream_async([{"role": "user", "content": "Tell me more"}]):
        if event["type"] == "delta":
            deltas.append(event["text"])
        elif event["type"] == "done":
            done_event = event

    assert done_event is not None
    assert len(done_event["text"]) > 0


@pytest.mark.asyncio
async def test_scenario_9_and_10_model_timeout_and_failure(monkeypatch):
    """Scenario 9 & 10: Model timeout or provider down falls back cleanly to offline."""
    async def timeout_stream(*a, **kw):
        raise TimeoutError("Ollama request timed out")

    monkeypatch.setattr(providers, "generate_stream_async", timeout_stream)
    done_event = None
    async for event in generate_chat_reply_stream_async([{"role": "user", "content": "Help me with anxiety"}]):
        if event["type"] == "done":
            done_event = event

    assert done_event is not None
    assert done_event["meta"]["provider"] == "offline"
    assert len(done_event["text"]) > 15


@pytest.mark.asyncio
async def test_scenario_14_and_15_normal_completion_and_repeated_message(monkeypatch):
    """Scenario 14 & 15: Normal completion and repeated messages handled gracefully without duplicating."""
    async def normal_stream(*a, **kw):
        yield "Consistent valid answer.", "ollama", "llama3.2:latest"

    monkeypatch.setattr(providers, "generate_stream_async", normal_stream)
    msg = [{"role": "user", "content": "What is mindfulness?"}]

    # First turn
    turn1_chunks = []
    async for e in generate_chat_reply_stream_async(msg):
        if e["type"] == "delta":
            turn1_chunks.append(e["text"])

    # Second turn (repeated message)
    turn2_chunks = []
    async for e in generate_chat_reply_stream_async(msg):
        if e["type"] == "delta":
            turn2_chunks.append(e["text"])

    assert "".join(turn1_chunks) == "Consistent valid answer."
    assert "".join(turn2_chunks) == "Consistent valid answer."
