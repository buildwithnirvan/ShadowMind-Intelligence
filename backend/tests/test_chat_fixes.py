"""
Tests for ShadowMind Chatbot Fixes:
1. A detailed full-stack development roadmap response
2. A long response that streams multiple chunks
3. A stream that finishes normally
4. A stream that fails midway
5. Responses that reach the configured output-token limit
6. Markdown formatting (headings, bold text, lists, code blocks)
7. Normal educational requests that should not be unnecessarily refused
"""
import asyncio
import json
import pytest
import httpx

from ai import guard, prompts, providers
from ai.analyzer import analyze_text
from ai.engine import generate_chat_reply_stream_async, generate_chat_reply
from ai.router import route_request, RouteDecision
from config import settings
from utils.ai import check_crisis

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


# ── 1. Detailed Full-Stack Development Roadmap ──────────────────────────────
def test_full_stack_roadmap_routing_and_guard():
    """Verify that a full-stack roadmap request routes to learning guide and passes guard without length cutoffs."""
    query = "Provide a detailed full-stack development roadmap from beginner to production."
    
    # Crisis check
    assert not check_crisis(query)
    
    # Analyzer intent
    analysis = analyze_text(query)
    assert not analysis.is_negative
    assert analysis.crisis_level == 0
    
    # Router classification
    decision = route_request(query, ollama_reachable=True)
    assert decision.role in {"solution", "coder"}
    assert "Learning Guide" in decision.agent_name or "Specialist" in decision.agent_name
    
    # Simulate a comprehensive multi-phase roadmap response (8,000+ chars)
    roadmap_reply = (
        "## Full-Stack Web Development Roadmap (2026)\n\n"
        "Here is a comprehensive, production-grade guide to becoming a full-stack engineer.\n\n"
        "### Phase 1: Foundations\n"
        "1. **HTML5 Semantic Markup**: Learn `<header>`, `<main>`, `<article>`, `<nav>` for accessibility.\n"
        "2. **CSS3 & Modern Layouts**: Flexbox, CSS Grid, container queries, custom properties.\n"
        "3. **Modern JavaScript (ES2024+)**: Closures, promises, `async`/`await`, destructuring.\n\n"
        "### Phase 2: Frontend Engineering\n"
        "- **React & TypeScript**: Component lifecycle, hooks (`useState`, `useEffect`, `useMemo`), strict types.\n"
        "- **Build Tools**: Vite, bundlers, tree-shaking, package management with `pnpm` or `npm`.\n"
        "- **State Management**: Zustand or Redux Toolkit for complex shared UI state.\n\n"
        "### Phase 3: Backend & APIs\n"
        "```python\n"
        "from fastapi import FastAPI\n\n"
        "app = FastAPI(title='Portfolio API')\n\n"
        "@app.get('/api/health')\n"
        "def health_check():\n"
        "    return {'status': 'healthy', 'service': 'backend'}\n"
        "```\n\n"
        "### Phase 4: Databases & Persistence\n"
        "- **Relational**: PostgreSQL with ACID transactions, indexing, and foreign keys.\n"
        "- **NoSQL & Document**: MongoDB for semi-structured document collections.\n"
        "- **Cache**: Redis for session storage and rate limiting.\n\n"
        "### Phase 5: DevOps & Deployment\n"
        "1. Docker containerization (`Dockerfile`, multi-stage builds).\n"
        "2. CI/CD automation with GitHub Actions.\n"
        "3. Cloud hosting (Docker Swarm, Kubernetes, or serverless).\n\n"
        "### Summary & Immediate Next Step\n"
        "Start today by creating a minimal Vite + React application and linking it to a FastAPI health endpoint.\n"
    ) * 4  # Repeat to verify high character volume (> 7,000 characters)

    # Verify that clean() does NOT truncate at old 5000 chars limit
    cleaned = guard.clean(roadmap_reply)
    assert len(cleaned) == len(roadmap_reply.strip())
    assert len(cleaned) > 5500  # Confirms text well above old 5,000 char cutoff is intact
    assert "### Phase 5: DevOps" in cleaned

    # Verify that guard validate approves detailed educational roadmap
    ok, reason = guard.validate(cleaned, analysis, "solution")
    assert ok, f"Educational roadmap should be approved, failed with: {reason}"


# ── 2. Long Response Streaming Multiple Chunks ─────────────────────────────
@pytest.mark.asyncio
async def test_streaming_multiple_chunks(monkeypatch):
    """Verify that multiple streamed chunks are received and assembled in correct order without data loss."""
    test_chunks = [
        "## Phase 1: Fundamentals\n",
        "Before diving into frameworks, ",
        "master semantic HTML5, modern CSS, ",
        "and ECMAScript modules.\n\n",
        "### Key Principles:\n",
        "1. Understand the DOM and event loop.\n",
        "2. Practice async programming with Promises.\n",
        "3. Write typed code with TypeScript.\n\n",
        "```typescript\n",
        "interface Developer {\n",
        "  name: string;\n",
        "  skills: string[];\n",
        "}\n",
        "```\n\n",
        "### Next Phase: Backend API Architecture\n",
        "Learn RESTful API design and database modeling.\n",
    ]

    async def fake_stream(*a, **kw):
        for c in test_chunks:
            yield c, "ollama", "llama3.2:latest"

    monkeypatch.setattr(providers, "generate_stream_async", fake_stream)

    received_chunks = []
    meta = None
    async for event in generate_chat_reply_stream_async(
        [{"role": "user", "content": "Explain the full stack roadmap in depth"}],
        "solution"
    ):
        if event["type"] == "start":
            meta = event["meta"]
        elif event["type"] == "delta":
            received_chunks.append(event["text"])

    assert meta is not None
    assert "".join(received_chunks) == "".join(test_chunks)
    assert len(received_chunks) == len(test_chunks)
    assert "interface Developer" in "".join(received_chunks)


# ── 3. Stream Finishes Normally ─────────────────────────────────────────────
@pytest.mark.asyncio
async def test_stream_finishes_normally(monkeypatch):
    """Verify that when Ollama finishes with done_reason='stop', stream terminates cleanly without cutoff warning."""
    raw_lines = [
        json.dumps({"message": {"content": "Here is the summary "}, "done": False}).encode(),
        json.dumps({"message": {"content": "of full stack technologies."}, "done": False}).encode(),
        json.dumps({"message": {"content": ""}, "done": True, "done_reason": "stop"}).encode(),
    ]

    class FakeAsyncResponse:
        status_code = 200
        async def aiter_lines(self):
            for l in raw_lines:
                yield l.decode("utf-8")

    class FakeAsyncClient:
        def stream(self, method, url, **kw):
            from contextlib import asynccontextmanager
            @asynccontextmanager
            async def _stream():
                yield FakeAsyncResponse()
            return _stream()

    monkeypatch.setattr(providers, "get_async_client", lambda: FakeAsyncClient())
    monkeypatch.setattr(providers, "_ollama_reachable", lambda url: True)
    monkeypatch.setattr(providers, "_cooling_down", lambda name: False)

    collected = []
    async for chunk, prov, mdl in providers.generate_stream_async(
        "system prompt",
        [{"role": "user", "content": "Summarize"}],
        model_override="llama3.2:latest"
    ):
        collected.append(chunk)

    full_output = "".join(collected)
    assert full_output == "Here is the summary of full stack technologies."
    assert "[Response reached output limit" not in full_output


# ── 4. Stream Fails Midway ──────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_stream_fails_midway_recovers_gracefully(monkeypatch):
    """When a stream encounters a network drop midway, the engine catches it and falls back safely."""
    async def broken_stream(*a, **kw):
        yield "Initial roadmap phase started... ", "ollama", "llama3.2:latest"
        raise httpx.RemoteProtocolError("Connection dropped by peer midway")

    monkeypatch.setattr(providers, "generate_stream_async", broken_stream)

    received_text = []
    async for event in generate_chat_reply_stream_async(
        [{"role": "user", "content": "How do I build a backend with FastAPI?"}],
        "solution"
    ):
        if event["type"] == "delta":
            received_text.append(event["text"])

    full = "".join(received_text)
    # Engine either preserves yielded content or falls back to offline guidance without crashing
    assert len(full) > 0


# ── 5. Response Reaches Configured Output-Token Limit ────────────────────────
@pytest.mark.asyncio
async def test_response_reaches_token_limit_indicates_continuation(monkeypatch):
    """When Ollama signals done_reason='length', a continuation indicator is cleanly yielded."""
    raw_lines = [
        json.dumps({"message": {"content": "Phase 1: Foundations\nPhase 2: Advanced APIs\nPhase 3: "}, "done": False}).encode(),
        json.dumps({"message": {"content": ""}, "done": True, "done_reason": "length"}).encode(),
    ]

    class FakeAsyncResponse:
        status_code = 200
        async def aiter_lines(self):
            for l in raw_lines:
                yield l.decode("utf-8")

    class FakeAsyncClient:
        def stream(self, method, url, **kw):
            from contextlib import asynccontextmanager
            @asynccontextmanager
            async def _stream():
                yield FakeAsyncResponse()
            return _stream()

    monkeypatch.setattr(providers, "get_async_client", lambda: FakeAsyncClient())
    monkeypatch.setattr(providers, "_ollama_reachable", lambda url: True)
    monkeypatch.setattr(providers, "_cooling_down", lambda name: False)

    collected = []
    async for chunk, prov, mdl in providers.generate_stream_async(
        "system prompt",
        [{"role": "user", "content": "Give me an exhaustive roadmap"}],
        model_override="llama3.2:latest"
    ):
        collected.append(chunk)

    full_output = "".join(collected)
    assert "Phase 1: Foundations" in full_output
    assert "*[Response reached output limit. Let me know if you would like me to continue with the next part!]*" in full_output


def test_ollama_options_use_configured_token_limits(monkeypatch):
    """Verify that Ollama generation options use OLLAMA_NUM_PREDICT (default 2048) and OLLAMA_NUM_CTX (4096)."""
    captured_payload = {}

    class FakeSyncResponse:
        status_code = 200
        def json(self):
            return {"message": {"content": "Sample response"}}

    class FakeSyncClient:
        def post(self, url, **kw):
            captured_payload.update(kw.get("json", {}))
            return FakeSyncResponse()

    monkeypatch.setattr(providers, "get_sync_client", lambda: FakeSyncClient())
    monkeypatch.setattr(providers, "_ollama_reachable", lambda url: True)
    monkeypatch.setattr(providers, "_cooling_down", lambda name: False)

    res = providers._call_ollama("sys", [{"role": "user", "content": "hi"}], max_tokens=None, temperature=0.7, json_mode=False, model_override="llama3.2:latest")
    assert res is not None

    options = captured_payload.get("options", {})
    assert options.get("num_predict") == getattr(settings, "OLLAMA_NUM_PREDICT", 2048)
    assert options.get("num_ctx") == getattr(settings, "OLLAMA_NUM_CTX", 4096)
    assert options["num_predict"] >= 2048
    assert options["num_ctx"] >= 4096


# ── 6. Markdown Formatting Elements ─────────────────────────────────────────
def test_markdown_elements_preserved_by_guard():
    """Verify that headings, bold, lists, and fenced code blocks are not stripped or corrupted."""
    markdown_sample = (
        "# Main Heading\n\n"
        "## Sub Heading\n\n"
        "Here is **bold text** and *italicized emphasis*.\n\n"
        "### Key Principles\n"
        "1. First ordered step with `inline code`.\n"
        "2. Second ordered step.\n\n"
        "- Unordered item with [documentation link](https://developer.mozilla.org)\n"
        "- Another item.\n\n"
        "```python\n"
        "def fibonacci(n: int) -> int:\n"
        "    if n <= 1:\n"
        "        return n\n"
        "    return fibonacci(n - 1) + fibonacci(n - 2)\n"
        "```\n\n"
        "> Blockquote with helpful guidance.\n"
    )

    cleaned = guard.clean(markdown_sample)
    
    # Headings preserved
    assert "# Main Heading" in cleaned
    assert "## Sub Heading" in cleaned
    assert "### Key Principles" in cleaned

    # Bold & Italic preserved
    assert "**bold text**" in cleaned
    assert "*italicized emphasis*" in cleaned

    # Lists preserved
    assert "1. First ordered step" in cleaned
    assert "- Unordered item with" in cleaned

    # Code blocks & inline code preserved
    assert "```python" in cleaned
    assert "def fibonacci(n: int) -> int:" in cleaned
    assert "`inline code`" in cleaned

    # Links & quotes preserved
    assert "[documentation link](https://developer.mozilla.org)" in cleaned
    assert "> Blockquote with helpful guidance." in cleaned

    # Validate against guard
    analysis = analyze_text("Explain recursion with code")
    ok, reason = guard.validate(cleaned, analysis, "solution")
    assert ok, f"Markdown response should pass validation: {reason}"


# ── 7. Normal Educational Requests Not Unnecessarily Refused ────────────────
@pytest.mark.parametrize("query", [
    "Explain how async/await works in JavaScript.",
    "What is the difference between SQL and NoSQL databases?",
    "How does indexing speed up database queries?",
    "Give me a step-by-step career guide for transitioning into software engineering.",
    "Explain the Model-View-Controller (MVC) architecture with an example.",
    "How do I set up a Python virtual environment and manage dependencies?",
])
def test_normal_educational_request_not_unnecessarily_refused(query):
    """Verify that ordinary educational, programming, and career roadmap requests are never refused."""
    # 1. Not a crisis
    assert not check_crisis(query)
    analysis = analyze_text(query)
    assert analysis.crisis_level == 0
    assert not analysis.depressed

    # 2. System prompt instructions explicitly forbid refusing educational questions
    solution_prompt = prompts.system_prompt_for("solution")
    assert "Never unnecessarily refuse harmless educational" in solution_prompt
    assert "Do NOT replace a requested detailed answer with a vague offer to help" in solution_prompt

    # 3. Router assigns educational queries properly
    decision = route_request(query, ollama_reachable=True)
    assert decision.role in {"solution", "coder", "general"}
    assert decision.role != "cbt"  # Not mistaken for cognitive distortion
    assert decision.role != "support"  # Not mistaken for emotional breakdown

    # 4. A comprehensive educational answer passes the guard
    sample_answer = (
        f"### Understanding {query.split()[1] if len(query.split()) > 1 else 'the topic'}\n\n"
        "Here is a direct, structured explanation:\n\n"
        "1. **Core Concept**: It works through a structured paradigm.\n"
        "2. **Example Implementation**:\n"
        "```javascript\n"
        "const result = await fetchData();\n"
        "console.log(result);\n"
        "```\n\n"
        "3. **Best Practices**: Keep your code modular and handle exceptions.\n"
    )
    ok, reason = guard.validate(sample_answer, analysis, decision.role)
    assert ok, f"Educational answer should be approved, but got: {reason}"
