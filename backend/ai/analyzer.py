"""
Deterministic text analysis: emotions, valence, wellbeing, themes, intent and
crisis level. It runs in microseconds, needs no network, and is used to
(1) steer the LLM, (2) validate its reply, and (3) drive the offline composer.
"""
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .lexicon import (
    EMOTION_PATTERNS, POSITIVE, INTENSIFIERS, DAMPENERS, NEGATORS, NEGATION_BREAKERS,
    CRISIS_ACUTE, CRISIS_ELEVATED, CRISIS_NEGATION, THEME_PATTERNS,
)

_TOKEN = re.compile(r"[A-Za-z0-9']+")
_GREETING = re.compile(r"^\s*(hi+|hello+|hey+|hiya|yo|namaste|good (morning|afternoon|evening|night)|sup|hola)\b[\s!.,]*(there|shadow)?[\s!.?]*$", re.I)
_THANKS = re.compile(r"^\s*(thanks|thank you|thx|ty|thank u|appreciate it)\b", re.I)
_FAREWELL = re.compile(r"^\s*(bye|goodbye|good night|see you|gtg|talk later)\b", re.I)
_HOW_ARE_YOU = re.compile(r"\bhow are you\b", re.I)
_QUESTION_STARTS = re.compile(r"^\s*(how|what|why|can|could|should|is|are|do|does|will|would|where|when|which|who|explain|describe|tell|show|define|compare)\b", re.I)
_HELP_REQUEST = re.compile(r"\b(help me|can you help|need help|i need (some )?(advice|support)|what should i do|what do i do)\b", re.I)
_HELP_SEEKING = re.compile(r"\b(talk to (someone|a (therapist|counsel\w*|doctor|professional|psychologist))|see a (therapist|doctor|counsel\w*|psychiatrist)|get (some )?(help|therapy)|seek (help|therapy)|go to (therapy|a doctor)|book an appointment)\b", re.I)
_EXERCISE_REQUEST = re.compile(r"\b(breath\w*|meditat\w*|ground\w*|relax\w*|calm me|exercise|technique\w*)\b", re.I)
_TECHNICAL = re.compile(r"\b(sql|join|joins|python|import\w*|error|exception|code|function|class|bug|syntax|traceback|app|application|script|query|database|api|http|route|router|array|list|dict|json)\b", re.I)


@dataclass
class TextAnalysis:
    text: str
    emotions: List[Dict] = field(default_factory=list)   # [{"name","intensity"}] sorted high→low
    primary: str = "Neutral"
    primary_intensity: float = 0.0
    valence: float = 0.0            # -1 (very negative) … +1 (very positive)
    wellbeing: int = 6              # 1 (crisis) … 10 (flourishing)
    crisis_level: int = 0           # 0 none · 1 elevated (hopelessness) · 2 acute (suicidal / self-harm)
    themes: List[str] = field(default_factory=list)
    intent: str = "statement"       # greeting | thanks | farewell | question | help_request | exercise_request | venting | statement
    depressed: bool = False         # low-mood language strong enough to screen gently for depression
    word_count: int = 0

    @property
    def is_negative(self) -> bool:
        return self.valence <= -0.15 or self.crisis_level > 0

    @property
    def is_positive(self) -> bool:
        return self.valence >= 0.25 and self.crisis_level == 0

    def to_public(self) -> Dict:
        return {
            "primary": self.primary,
            "intensity": self.primary_intensity,
            "valence": round(self.valence, 2),
            "wellbeing": self.wellbeing,
            "crisis_level": self.crisis_level,
            "themes": self.themes,
            "emotions": self.emotions[:4],
        }


def _tokens(text: str) -> List[Tuple[str, int, int]]:
    norm = text.replace("’", "'").replace("`", "'")
    return [(m.group(0).lower(), m.start(), m.end()) for m in _TOKEN.finditer(norm)]


_CLAUSE_BREAK = {"and", "but", "or", "because", "although", "though", "while", "however", "then", "also"}
_PUNCT = re.compile(r"[,.;:!?()\n]")


def _modifiers(tokens: List[Tuple[str, int, int]], start_char: int, text: str = "") -> Tuple[float, bool]:
    """Return (intensity multiplier, negated) for a match beginning at start_char.
    Negation never crosses a clause boundary (comma, full stop, 'and', 'but'…)."""
    idx = next((i for i, t in enumerate(tokens) if t[1] >= start_char), len(tokens))
    mult, negated, seen = 1.0, False, 0
    j = idx - 1
    between: List[str] = []
    right_edge = start_char
    while j >= 0 and seen < 3:
        tok = tokens[j][0]
        gap = text[tokens[j][2]:right_edge] if text else ""
        if tok in _CLAUSE_BREAK or _PUNCT.search(gap):
            break
        right_edge = tokens[j][1]
        if tok in INTENSIFIERS:
            mult *= 1.4
        elif tok in DAMPENERS:
            mult *= 0.65
        elif tok in NEGATORS:
            # "never been so sad" is an intensifier, not a negation
            nxt = between[-1] if between else ""
            if tok == "never" and nxt in {"been", "felt", "had", "this", "so"}:
                mult *= 1.3
            elif not any(b in NEGATION_BREAKERS for b in between):
                negated = True
            break
        else:
            between.append(tok)
            seen += 1
        j -= 1
    return mult, negated


def _detect_crisis(text: str) -> int:
    norm = text.replace("’", "'")
    level = 0
    for pat in CRISIS_ACUTE:
        for m in pat.finditer(norm):
            prefix = norm[max(0, m.start() - 30): m.start()]
            if CRISIS_NEGATION.search(prefix):
                level = max(level, 1)  # "I'm not suicidal, but…" – still worth a soft check-in
                continue
            return 2
    for pat in CRISIS_ELEVATED:
        if pat.search(norm):
            level = max(level, 1)
    return level


def _detect_themes(text: str) -> List[str]:
    found = []
    for theme, pats in THEME_PATTERNS.items():
        if any(p.search(text) for p in pats):
            found.append(theme)
    return found[:3]


def _detect_intent(text: str, n_words: int, has_emotion: bool, negative: bool) -> str:
    t = text.strip()
    if _GREETING.match(t) or (_HOW_ARE_YOU.search(t) and n_words <= 6 and not has_emotion):
        return "greeting"
    if _THANKS.match(t) and n_words <= 8:
        return "thanks"
    if _FAREWELL.match(t) and n_words <= 6:
        return "farewell"
    if _EXERCISE_REQUEST.search(t) and (_HELP_REQUEST.search(t) or "?" in t or n_words <= 6 or t.lower().startswith(("guide", "give", "teach", "show", "start"))):
        return "exercise_request"
    if _TECHNICAL.search(t):
        return "question"
    if _HELP_SEEKING.search(t):
        return "help_seeking"
    if _HELP_REQUEST.search(t):
        return "help_request"
    if _QUESTION_STARTS.match(t) and ("?" in t or n_words >= 2):
        return "question"
    if "?" in t and not has_emotion:
        return "question"
    return "venting" if (has_emotion and negative) else "statement"


def analyze_text(text: str) -> TextAnalysis:
    text = (text or "").strip()
    tokens = _tokens(text)
    n_words = len(tokens)
    result = TextAnalysis(text=text, word_count=n_words)
    if not text:
        return result

    norm_text = text.replace("’", "'")
    scores: Dict[str, float] = {}
    for emotion, patterns in EMOTION_PATTERNS.items():
        for pat, weight in patterns:
            for m in pat.finditer(norm_text):
                mult, negated = _modifiers(tokens, m.start(), norm_text)
                value = weight * mult
                if negated:
                    if emotion in POSITIVE:
                        # "not happy" → low mood signal, not joy
                        scores["Sadness"] = scores.get("Sadness", 0.0) + value * 0.8
                    # negated negative emotion ("not sad") contributes nothing
                    continue
                scores[emotion] = scores.get(emotion, 0.0) + value

    # diminishing returns: repeated hits on one emotion shouldn't explode
    emotions = []
    for name, raw in scores.items():
        if raw <= 0:
            continue
        intensity = min(10.0, round(2.6 + 2.1 * min(raw, 3.6), 1))
        emotions.append({"name": name, "intensity": intensity, "_raw": raw})
    emotions.sort(key=lambda e: e["_raw"], reverse=True)

    pos_raw = sum(e["_raw"] for e in emotions if e["name"] in POSITIVE)
    neg_raw = sum(e["_raw"] for e in emotions if e["name"] not in POSITIVE)
    total = pos_raw + neg_raw
    valence = 0.0 if total == 0 else max(-1.0, min(1.0, (pos_raw - neg_raw) / (total + 0.8)))

    result.crisis_level = _detect_crisis(text)
    if result.crisis_level and not any(e["name"] == "Sadness" for e in emotions):
        emotions.append({"name": "Sadness", "intensity": 7.0 if result.crisis_level == 2 else 5.5, "_raw": 1.5})
        emotions.sort(key=lambda e: e["_raw"], reverse=True)
        neg_raw += 1.5
        valence = max(-1.0, min(1.0, (pos_raw - neg_raw) / (pos_raw + neg_raw + 0.8)))

    wellbeing = 6.0 + pos_raw * 1.5 - neg_raw * 1.5
    wellbeing = max(2.0, min(10.0, wellbeing))
    if result.crisis_level == 2:
        wellbeing = 1.0
    elif result.crisis_level == 1:
        wellbeing = min(wellbeing, 3.5)

    result.emotions = [{"name": e["name"], "intensity": e["intensity"]} for e in emotions]
    if emotions:
        result.primary = emotions[0]["name"]
        result.primary_intensity = emotions[0]["intensity"]
    result.valence = round(valence, 3)
    result.wellbeing = int(round(wellbeing))
    result.themes = _detect_themes(text)

    lowered = text.lower()
    sad = next((e["_raw"] for e in emotions if e["name"] == "Sadness"), 0.0)
    apathy = next((e["_raw"] for e in emotions if e["name"] == "Apathy"), 0.0)
    result.depressed = bool(re.search(r"\bdepress\w*", lowered) and not _is_negated_word(tokens, "depress")) or (sad + apathy >= 3.0 and valence < -0.4)

    result.intent = _detect_intent(text, n_words, bool(emotions), result.is_negative)
    return result


def _is_negated_word(tokens: List[Tuple[str, int, int]], stem: str) -> bool:
    for i, (tok, _, _) in enumerate(tokens):
        if tok.startswith(stem):
            window = [t[0] for t in tokens[max(0, i - 3): i]]
            if any(w in NEGATORS for w in window):
                return True
    return False


def analyze_conversation(messages: List[Dict]) -> TextAnalysis:
    """Analyze only what the *user* wrote across a conversation."""
    user_text = "\n".join(m.get("content", "") for m in messages if m.get("role") == "user" and m.get("content"))
    return analyze_text(user_text)
