"""Validate model replies so a wrong-tone or unsafe answer never reaches the user."""
import re
from typing import Optional, Tuple

from .analyzer import TextAnalysis
from .resources import CRISIS_FOOTER

# Cheerful/celebratory phrases that are wrong when someone is hurting.
_UPBEAT = re.compile(
    r"\b(glad|happy|pleased|delighted|great|good|wonderful|awesome|fantastic|amazing) (to hear|that|news)\b"
    r"|\bthat'?s (great|wonderful|awesome|fantastic|amazing|excellent)\b"
    r"|\bcongrat\w*|\byay\b|\bgood for you\b|\bsounds (great|amazing|wonderful|fun|awesome)\b"
    r"|\bkeep (it up|smiling)\b|\bstay positive\b|\bcheer up\b|\blook on the bright side\b|\bit could be worse\b",
    re.I,
)
_LEAKS = re.compile(r"(PRIVATE CONTEXT|system prompt|as an ai language model|\[INST\]|<\|)", re.I)
_DISMISSIVE = re.compile(r"\b(just relax|just calm down|get over it|snap out of it|everything happens for a reason)\b", re.I)
_HELPLINE = re.compile(r"\b(14416|112|988|741741|9999 ?666 ?555|helpline|crisis line|lifeline)\b", re.I)
_MARKDOWN = re.compile(r"(^|\n)\s*(#{1,6}\s|[-*•]\s|\d+\.\s)")


def clean(text: str, max_chars: int = 4000) -> str:
    t = (text or "").strip()
    t = re.sub(r"^\s*(shadow|assistant)\s*:\s*", "", t, flags=re.I)   # model echoing the role label
    t = t.strip('"').strip()
    if len(t) > max_chars:
        cut = t[:max_chars]
        end = max(cut.rfind(". "), cut.rfind("? "), cut.rfind("! "))
        t = cut[: end + 1] if end > 200 else cut.rsplit(" ", 1)[0] + "…"
    return t


def validate(reply: str, analysis: TextAnalysis, mode: str) -> Tuple[bool, Optional[str]]:
    """Return (ok, reason). `reason` is fed back to the model on retry."""
    if not reply or len(reply.strip()) < 15:
        return False, "Your reply was empty or too short."
    if _LEAKS.search(reply):
        return False, "Your reply leaked internal instructions."
    if analysis.is_negative and analysis.intent != "question" and _UPBEAT.search(reply):
        return False, ("Your reply used cheerful language ('glad to hear', 'great', etc.) but the user is in distress. "
                       "Start with real empathy and acknowledge the pain.")
    if analysis.is_negative and analysis.intent != "question" and _DISMISSIVE.search(reply):
        return False, "Your reply was dismissive. Validate their feelings first."
    if analysis.crisis_level >= 2 and "?" not in reply:
        return False, "In a crisis you must gently ask whether they are safe / thinking of ending their life."
    if len(reply) > 5000:
        return False, "Your reply was far too long. Keep it focused and concise."
    return True, None



def ensure_safety_footer(reply: str, analysis: TextAnalysis) -> str:
    """Guarantee helplines are present whenever acute risk is detected."""
    if analysis.crisis_level >= 2 and not _HELPLINE.search(reply):
        return f"{reply.rstrip()}\n\n{CRISIS_FOOTER}"
    return reply


def looks_formatted(reply: str) -> bool:
    return bool(_MARKDOWN.search(reply))
