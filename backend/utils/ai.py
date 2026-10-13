"""
Backwards-compatible AI facade.

Routers import from here; the implementation lives in the `ai` package:
ai.analyzer → ai.engine → ai.providers / ai.composer (+ ai.guard).
"""
import json
import logging
import re
from typing import Dict, List

from ai import providers
from ai.analyzer import analyze_text, analyze_conversation
from ai.composer import heuristic_analysis, mood_insight_fallback, meditation_fallback
from ai.engine import generate_chat_reply, generate_chat_reply_stream_async, ChatReply
from ai.prompts import system_prompt_for

logger = logging.getLogger("shadowmind.ai")

ALLOWED_EMOTIONS = {
    "Anxiety", "Sadness", "Anger", "Joy", "Guilt", "Shame", "Fear", "Loneliness",
    "Gratitude", "Hope", "Overwhelm", "Apathy", "Calm",
}


# ── crisis ───────────────────────────────────────────────────────────────────
def crisis_level(content: str) -> int:
    """0 none · 1 hopelessness · 2 acute (suicidal ideation / self-harm)."""
    return analyze_text(content).crisis_level


def check_crisis(content: str) -> bool:
    """True only for acute risk. Word-boundary matching: 'diet' or 'studied' never trigger it."""
    return crisis_level(content) >= 2


# ── chat ─────────────────────────────────────────────────────────────────────
def get_chat_reply(messages: List[Dict[str, str]], session_type: str = "general", max_tokens: int = 1024) -> ChatReply:
    return generate_chat_reply(messages, session_type, max_tokens)



def get_ai_response(messages: List[Dict[str, str]], session_type: str = "general", max_tokens: int = 1024) -> str:
    """Plain-text helper used by simple callers (e.g. meditation generation)."""
    if session_type == "meditation_guide":
        result = providers.generate(system_prompt_for("meditation_guide"), messages, max_tokens=max_tokens, temperature=0.8)
        if result and result.text.strip():
            return result.text.strip()
        prompt = messages[-1]["content"] if messages else ""
        m = re.search(r"(\d+)-minute", prompt)
        focus = re.search(r"focusing on (.+?)\.", prompt)
        fb = meditation_fallback(int(m.group(1)) if m else 5, focus.group(1) if focus else "calm")
        return f"{fb['title']}\n{fb['script']}"
    return generate_chat_reply(messages, session_type, max_tokens).text


# ── journal / session analysis ───────────────────────────────────────────────
def _extract_json(text: str) -> Dict:
    t = (text or "").strip()
    t = re.sub(r"^```(?:json)?", "", t).strip()
    t = re.sub(r"```$", "", t).strip()
    start, end = t.find("{"), t.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object found")
    return json.loads(t[start:end + 1])


def _as_str_list(value, limit: int = 4) -> List[str]:
    if isinstance(value, str):
        value = [value]
    return [str(v).strip() for v in (value or []) if str(v).strip()][:limit]


def _normalize_analysis(raw: Dict, fallback: Dict, source_text: str) -> Dict:
    """Coerce model output into the exact shape the UI expects, and sanity-check it."""
    emotions = []
    for e in raw.get("emotions") or []:
        if not isinstance(e, dict):
            continue
        name = str(e.get("name", "")).strip().title()
        try:
            intensity = max(1.0, min(10.0, float(e.get("intensity", 5))))
        except (TypeError, ValueError):
            continue
        if name in ALLOWED_EMOTIONS:
            emotions.append({"name": name, "intensity": round(intensity, 1)})
    emotions.sort(key=lambda x: x["intensity"], reverse=True)

    try:
        wellbeing = int(round(float(raw.get("wellbeing_score", fallback["wellbeing_score"]))))
    except (TypeError, ValueError):
        wellbeing = fallback["wellbeing_score"]
    wellbeing = max(1, min(10, wellbeing))

    # Never let the model be more upbeat than the deterministic read on clearly distressed text.
    det = analyze_text(source_text)
    if det.is_negative:
        wellbeing = min(wellbeing, max(det.wellbeing + 2, 1))
    if det.crisis_level >= 2:
        wellbeing = min(wellbeing, 2)

    out = {
        "summary": str(raw.get("summary") or fallback["summary"]).strip(),
        "emotions": emotions or fallback["emotions"],
        "wellbeing_score": wellbeing,
        "future_mistakes": _as_str_list(raw.get("future_mistakes")) or fallback["future_mistakes"],
        "corrective_actions": _as_str_list(raw.get("corrective_actions")) or fallback["corrective_actions"],
        "insights": _as_str_list(raw.get("insights")) or fallback["insights"],
        "reflection_question": str(raw.get("reflection_question") or fallback["reflection_question"]).strip(),
        "crisis_level": det.crisis_level,
    }
    return out


def heuristic_fallback_analysis(content: str) -> Dict:
    return heuristic_analysis(content)


def analyze_journal_entry(content: str) -> Dict:
    """LLM analysis (if any provider is reachable) normalised + sanity-checked, else heuristic."""
    fallback = heuristic_analysis(content)
    if not (content or "").strip():
        return fallback
    result = providers.generate(
        system_prompt_for("journal_analysis"),
        [{"role": "user", "content": f"Analyze this text:\n\n---\n{content[:6000]}\n---"}],
        max_tokens=900, temperature=0.3, json_mode=True,
    )
    if result:
        try:
            return _normalize_analysis(_extract_json(result.text), fallback, content)
        except Exception as e:  # noqa: BLE001
            logger.warning("Could not parse model analysis (%s); using heuristic", e)
    return fallback


def analyze_chat_session(messages: List[Dict]) -> Dict:
    """Analyze what the USER wrote in a chat (assistant turns are excluded)."""
    user_text = "\n".join(m.get("content", "") for m in messages if m.get("role") == "user" and m.get("content"))
    return analyze_journal_entry(user_text)


# ── mood insight ─────────────────────────────────────────────────────────────
def generate_mood_insight(moods: List[Dict]) -> str:
    if not moods:
        return "No mood data yet. Log a few check-ins and I'll start spotting patterns for you."
    lines = "\n".join(f"- {m.get('date')}: {m['score']}/10 ({m.get('label')})" for m in moods[-14:])
    result = providers.generate(
        system_prompt_for("mood_insight"),
        [{"role": "user", "content": f"Recent mood check-ins (oldest → newest):\n{lines}"}],
        max_tokens=90, temperature=0.5, timeout=12.0,
    )
    if result and len(result.text.strip()) > 30:
        return result.text.strip()
    return mood_insight_fallback(moods)
