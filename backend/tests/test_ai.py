"""AI engine tests: pure logic, no database and no network needed."""
import pytest

from ai import guard, providers
from ai.analyzer import analyze_text
from ai.engine import generate_chat_reply
from utils.ai import check_crisis, analyze_journal_entry, _normalize_analysis

pytestmark = pytest.mark.no_db


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    """By default no provider is reachable → offline composer."""
    monkeypatch.setattr(providers, "generate", lambda *a, **k: None)


# ── analyzer ────────────────────────────────────────────────────────────────
def test_depressed_is_negative_not_positive():
    a = analyze_text("depressed")
    assert a.primary == "Sadness"
    assert a.valence < -0.4 and a.is_negative and a.depressed
    assert a.wellbeing <= 3


@pytest.mark.parametrize("text", ["not happy", "I don't feel good", "I can't stop crying", "never been so sad"])
def test_negation_and_intensifiers(text):
    assert analyze_text(text).is_negative


def test_negated_negative_emotion_is_not_flagged():
    a = analyze_text("I'm not depressed anymore")
    assert not a.depressed and not a.is_negative


def test_clause_boundary_stops_negation():
    a = analyze_text("for about a month now, can't sleep and no energy")
    assert a.primary == "Apathy" and a.is_negative


@pytest.mark.parametrize("text", ["I'm on a diet", "I studied all night", "my soldier friend", "I die of laughter at this meme?"])
def test_no_false_crisis_on_substrings(text):
    assert analyze_text(text).crisis_level == 0
    assert not check_crisis(text)


@pytest.mark.parametrize("text", ["I want to die", "I want to kill myself", "thinking about suicide", "I don't want to be alive", "I've been cutting myself"])
def test_acute_crisis_detected(text):
    assert analyze_text(text).crisis_level == 2 and check_crisis(text)


def test_hopelessness_is_elevated_not_acute():
    a = analyze_text("what's the point, it's all hopeless")
    assert a.crisis_level == 1 and not check_crisis("what's the point, it's all hopeless")


def test_negated_suicide_not_acute():
    assert analyze_text("I'm not suicidal, just tired").crisis_level < 2


def test_positive_message():
    a = analyze_text("I got the internship and I'm so happy!")
    assert a.is_positive and a.primary == "Joy"


def test_intents():
    assert analyze_text("hello").intent == "greeting"
    assert analyze_text("how do I deal with anxiety?").intent == "question"
    assert analyze_text("maybe I should talk to a therapist").intent == "help_seeking"


# ── guard ───────────────────────────────────────────────────────────────────
def test_guard_rejects_upbeat_reply_to_distress():
    a = analyze_text("depressed")
    ok, reason = guard.validate("I'm happy to hear that! Keep it up, you've got this.", a, "general")
    assert not ok and "cheerful" in reason


def test_guard_allows_upbeat_reply_to_good_news():
    a = analyze_text("I got the internship!! so happy")
    ok, _ = guard.validate("That's wonderful news, congratulations! What are you most excited about?", a, "general")
    assert ok


def test_guard_requires_question_in_crisis():
    a = analyze_text("I want to die")
    assert not guard.validate("I am so sorry you feel this way. Take care of yourself.", a, "crisis")[0]


def test_helplines_always_appended_on_acute_risk():
    a = analyze_text("I want to end my life")
    assert "14416" in guard.ensure_safety_footer("I'm here with you. Are you safe right now?", a)


# ── engine ──────────────────────────────────────────────────────────────────
def test_offline_reply_to_depressed_is_empathetic():
    r = generate_chat_reply([{"role": "user", "content": "depressed"}])
    low = r.text.lower()
    assert r.provider == "offline"
    assert "sorry" in low and "happy to hear" not in low and "glad to hear" not in low
    assert "?" in r.text
    assert any(s["key"] == "assessment" for s in r.suggestions)


def test_bad_model_reply_is_rejected_then_replaced(monkeypatch):
    """The original bug: a small model answered 'depressed' with 'happy to hear that'."""
    calls = []

    def fake_generate(system, messages, **kw):
        calls.append(system)
        return providers.ProviderResult("I'm so happy to hear that! Stay positive and keep smiling.", "ollama", "llama3.2")

    monkeypatch.setattr(providers, "generate", fake_generate)
    r = generate_chat_reply([{"role": "user", "content": "depressed"}])
    assert len(calls) == 2                      # first try + one corrective retry
    assert "IMPORTANT CORRECTION" in calls[1]
    assert r.provider == "offline"              # still bad → offline composer, never the bad text
    assert "happy to hear" not in r.text.lower()


def test_good_model_reply_is_used(monkeypatch):
    good = "I'm really sorry it feels this heavy, and thank you for telling me. What has it been like lately, and how long has it felt this way?"
    monkeypatch.setattr(providers, "generate", lambda *a, **k: providers.ProviderResult(good, "claude", "m"))
    r = generate_chat_reply([{"role": "user", "content": "depressed"}])
    assert r.provider == "claude" and r.text == good


def test_crisis_overrides_mode_and_adds_helplines():
    r = generate_chat_reply([{"role": "user", "content": "I want to die"}], session_type="cbt")
    assert r.crisis_level == 2
    assert "14416" in r.text and "112" in r.text and "?" in r.text
    assert [s["key"] for s in r.suggestions][0] == "help"


def test_conversation_context_is_kept():
    msgs = [{"role": "user", "content": "depressed"}]
    msgs.append({"role": "assistant", "content": generate_chat_reply(msgs).text})
    msgs.append({"role": "user", "content": "for about a month now, can't sleep and no energy"})
    r = generate_chat_reply(msgs)
    assert "doctor" in r.text.lower() and "phq-9" in r.text.lower()


def test_replies_do_not_repeat_verbatim():
    msgs, seen = [], set()
    for text in ["I feel anxious", "still anxious", "yeah still worried about it", "I'm nervous"]:
        msgs.append({"role": "user", "content": text})
        reply = generate_chat_reply(msgs).text
        assert reply not in seen
        seen.add(reply)
        msgs.append({"role": "assistant", "content": reply})


def test_cbt_mode_progresses_in_steps():
    msgs = [{"role": "user", "content": "I'm going to fail my viva"}]
    first = generate_chat_reply(msgs, "cbt").text
    msgs += [{"role": "assistant", "content": first}, {"role": "user", "content": "they'll think I'm stupid"}]
    second = generate_chat_reply(msgs, "cbt").text
    assert "0 to 100" in second and first != second


# ── analysis normalisation ──────────────────────────────────────────────────
def test_model_cannot_score_distressed_text_as_happy():
    text = "I feel worthless and hopeless and alone"
    fallback = analyze_journal_entry(text)
    out = _normalize_analysis({"summary": "x", "emotions": [{"name": "Joy", "intensity": 9}], "wellbeing_score": 9}, fallback, text)
    assert out["wellbeing_score"] <= 5


def test_normalize_handles_garbage():
    fb = analyze_journal_entry("I feel calm today")
    out = _normalize_analysis({"emotions": "nope", "wellbeing_score": "??", "future_mistakes": "one"}, fb, "I feel calm today")
    assert isinstance(out["emotions"], list) and isinstance(out["future_mistakes"], list)
    assert 1 <= out["wellbeing_score"] <= 10


# ── provider fallback & error handling ──────────────────────────────────────
def test_no_gemini_dependency_in_active_providers():
    """Verify Gemini is completely removed from provider status."""
    st = providers.status()
    assert "gemini" not in st
    assert "ollama" in st


def test_ollama_call_and_fallback(monkeypatch):
    """When Ollama is available, Ollama response is returned with proper model."""
    monkeypatch.setattr(providers, "_cooling_down", lambda name: False)
    monkeypatch.setattr(providers, "_ollama_reachable", lambda url: True)
    
    class FakeResponse:
        status_code = 200
        def json(self):
            return {"message": {"content": "Hello from Ollama!"}}

    class FakeClient:
        def post(self, *a, **k):
            return FakeResponse()

    monkeypatch.setattr(providers, "get_sync_client", lambda: FakeClient())

    res = providers._call_ollama("sys", [{"role": "user", "content": "hello"}], 100, 0.7, False, "llama3.2:latest")
    assert res is not None
    assert res.provider == "ollama"
    assert res.text == "Hello from Ollama!"


def test_both_providers_fail_returns_offline_fallback(monkeypatch):
    """When Ollama fails, system safely returns offline composer reply."""
    monkeypatch.setattr(providers, "_call_ollama", lambda *a, **k: None)

    reply = generate_chat_reply([{"role": "user", "content": "I feel anxious"}])
    assert reply.provider == "offline"
    assert "anxious" in reply.text.lower() or "tension" in reply.text.lower() or "worry" in reply.text.lower() or "?" in reply.text


def test_provider_timeout_handling(monkeypatch):
    """httpx timeout exception on Ollama is caught and marked as cooling down."""
    import httpx

    class TimeoutClient:
        def post(self, *a, **k):
            raise httpx.TimeoutException("Connection timed out")

    monkeypatch.setattr(providers, "get_sync_client", lambda: TimeoutClient())
    monkeypatch.setattr(providers, "_ollama_reachable", lambda url: True)
    res = providers._call_ollama("sys", [{"role": "user", "content": "test"}], 100, 0.7, False, "llama3.2:latest")
    assert res is None
    assert providers._cooling_down("ollama")


def test_malformed_model_response(monkeypatch):
    """Empty or malformed JSON from Ollama returns None without crash."""
    class FakeResponse:
        status_code = 200
        def json(self):
            return {"error": "unknown"}

    class FakeClient:
        def post(self, *a, **k):
            return FakeResponse()

    monkeypatch.setattr(providers, "get_sync_client", lambda: FakeClient())
    monkeypatch.setattr(providers, "_ollama_reachable", lambda url: True)
    res = providers._call_ollama("sys", [{"role": "user", "content": "test"}], 100, 0.7, False, "llama3.2:latest")
    assert res is None


# ── two-model routing tests ────────────────────────────────────────────────
def test_router_general_question_selects_model_a(monkeypatch):
    from ai.router import route_request
    monkeypatch.setattr("ai.router.get_available_ollama_models", lambda url=None: {"llama3.2:latest", "qwen2.5-coder:3b"})
    d = route_request("What is the capital of France?", ollama_reachable=True)
    assert d.role == "general"
    assert d.target_model == "llama3.2:latest"
    assert not d.is_technical


def test_router_coding_question_selects_model_b(monkeypatch):
    from ai.router import route_request
    monkeypatch.setattr("ai.router.get_available_ollama_models", lambda url=None: {"llama3.2:latest", "qwen2.5-coder:3b"})
    d = route_request("def solve_problem(): pass  # SyntaxError in python", ollama_reachable=True)
    assert d.role == "coder"
    assert d.target_model == "qwen2.5-coder:3b"
    assert d.is_technical


def test_router_missing_coder_model_falls_back_to_general(monkeypatch):
    from ai.router import route_request
    monkeypatch.setattr("ai.router.get_available_ollama_models", lambda url=None: {"llama3.2:latest"})
    d = route_request("How do I debug a NullPointerException in Java?", ollama_reachable=True)
    assert d.is_technical
    assert d.target_model == "llama3.2:latest"


def test_router_offline_when_ollama_unreachable():
    from ai.router import route_request
    d = route_request("Hello friend", ollama_reachable=False)
    assert d.role == "offline"
    assert d.target_model == "offline"


# ── diagnostics & severity tests ───────────────────────────────────────────
def test_diagnostics_critical_severity():
    from ai.diagnostics import analyze_technical_problem, SeverityLevel
    diag = analyze_technical_problem("CRITICAL: Database corruption detected and customer data loss occurred.")
    assert diag.severity == SeverityLevel.CRITICAL
    assert "data loss" in diag.likely_cause.lower() or "corruption" in diag.likely_cause.lower()
    assert len(diag.verification_steps) > 0


def test_diagnostics_high_severity():
    from ai.diagnostics import analyze_technical_problem, SeverityLevel
    diag = analyze_technical_problem("Production service crashed, HTTP 500 internal server error across all endpoints.")
    assert diag.severity == SeverityLevel.HIGH


def test_diagnostics_medium_severity():
    from ai.diagnostics import analyze_technical_problem, SeverityLevel
    diag = analyze_technical_problem("IndexError: list index out of range in helper function")
    assert diag.severity == SeverityLevel.MEDIUM
    assert "IndexError" in diag.error_message


def test_diagnostics_informational_severity():
    from ai.diagnostics import analyze_technical_problem, SeverityLevel
    diag = analyze_technical_problem("Can you explain how a binary search tree works?")
    assert diag.severity == SeverityLevel.INFORMATIONAL


# ── 5,000+ offline composer tests ──────────────────────────────────────────
def test_offline_lexicon_dataset_count_and_categories():
    from ai.offline_engine import get_offline_engine
    engine = get_offline_engine()
    assert len(engine.phrase_map) >= 5000
    assert len(engine.categories) == 50


def test_offline_engine_negation_handling():
    from ai.offline_engine import get_offline_engine
    engine = get_offline_engine()
    res = engine.match("I am not sad anymore")
    assert res.primary_category == "recovery"
    assert not res.is_crisis


def test_offline_engine_third_person_context_filter():
    from ai.offline_engine import get_offline_engine
    engine = get_offline_engine()
    res = engine.match("that movie was depressing")
    assert res.primary_category != "depression"


def test_offline_engine_multi_emotion_contrast():
    from ai.offline_engine import get_offline_engine
    engine = get_offline_engine()
    res = engine.match("I am happy, but I miss my ex")
    assert res.multi_emotion is True
    assert res.secondary_category is not None
    reply = engine.compose_response("I am happy, but I miss my ex")
    assert "both of these" in reply.lower() or "conflicting" in reply.lower()


def test_offline_engine_request_listening_intent():
    from ai.offline_engine import get_offline_engine
    engine = get_offline_engine()
    reply = engine.compose_response("I just want someone to listen to me")
    assert "listening" in reply.lower()
    assert "solution" not in reply.lower()


def test_offline_engine_crisis_safety_override():
    from ai.offline_engine import get_offline_engine
    engine = get_offline_engine()
    reply = engine.compose_response("I want to kill myself")
    assert "14416" in reply
    assert "112" in reply or "988" in reply
    assert "?" in reply


def test_ollama_reachability_caching(monkeypatch):
    """_ollama_reachable caches both positive and negative results."""
    calls = 0
    def fake_create_connection(*a, **k):
        nonlocal calls
        calls += 1
        raise ConnectionRefusedError("Offline")

    monkeypatch.setattr("socket.create_connection", fake_create_connection)
    providers._ollama_reachability_cache.clear()

    res1 = providers._ollama_reachable("http://localhost:11434")
    res2 = providers._ollama_reachable("http://localhost:11434")

    assert res1 is False
    assert res2 is False
    assert calls == 1  # Second call hit cache, didn't attempt socket connection


# ── Part 8 Required Scenarios ────────────────────────────────────────────────
def test_scenario_1_anxious_grounding():
    """Scenario 1: 'I've been feeling anxious and could use some grounding.'"""
    reply = generate_chat_reply([{"role": "user", "content": "I've been feeling anxious and could use some grounding."}])
    assert reply.text
    assert reply.analysis.primary in {"Anxiety", "Fear", "Overwhelm"} or reply.analysis.is_negative
    # Empathy & practical grounding advice present
    assert any(term in reply.text.lower() for term in ["breath", "ground", "5-4-3-2-1", "senses", "exhale", "body", "look around", "touch"])


def test_scenario_2_depressed():
    """Scenario 2: 'I'm feeling depressed.'"""
    reply = generate_chat_reply([{"role": "user", "content": "I'm feeling depressed."}])
    assert reply.text
    assert reply.analysis.depressed
    assert "happy to hear" not in reply.text.lower()
    assert "?" in reply.text


def test_scenario_3_friends_dont_care():
    """Scenario 3: 'I think my friends don't care about me anymore.'"""
    reply = generate_chat_reply([{"role": "user", "content": "I think my friends don't care about me anymore."}])
    assert reply.text
    assert reply.analysis.primary in {"Loneliness", "Sadness", "Shame"} or reply.analysis.is_negative
    assert len(reply.text) > 30


def test_scenario_4_worried_job_graduation():
    """Scenario 4: 'I'm worried I won't get a job after graduation.'"""
    reply = generate_chat_reply([{"role": "user", "content": "I'm worried I won't get a job after graduation."}])
    assert reply.text
    assert reply.analysis.is_negative
    assert len(reply.text) > 30


def test_scenario_5_explain_sql_joins():
    """Scenario 5: 'Explain SQL joins.'"""
    reply = generate_chat_reply([{"role": "user", "content": "Explain SQL joins."}])
    assert reply.text
    assert reply.analysis.intent == "question"
    assert "join" in reply.text.lower() or "inner" in reply.text.lower() or "table" in reply.text.lower()


def test_scenario_6_python_import_error():
    """Scenario 6: 'My Python application throws an ImportError.'"""
    reply = generate_chat_reply([{"role": "user", "content": "My Python application throws an ImportError."}])
    assert reply.text
    assert reply.analysis.intent == "question"
    assert "import" in reply.text.lower() or "pip" in reply.text.lower() or "module" in reply.text.lower() or "python" in reply.text.lower()


def test_scenario_7_follow_up_with_context():
    """Scenario 7: Follow-up question that requires relevant conversation context."""
    history = [
        {"role": "user", "content": "Explain SQL joins."},
        {"role": "assistant", "content": "In SQL, JOIN combines rows from two tables. The main types are INNER JOIN, LEFT JOIN, RIGHT JOIN, and FULL JOIN."},
        {"role": "user", "content": "Can you give me an example of the second type?"}
    ]
    reply = generate_chat_reply(history)
    assert reply.text
    assert reply.analysis.intent == "question"
    assert len(reply.text) > 30


