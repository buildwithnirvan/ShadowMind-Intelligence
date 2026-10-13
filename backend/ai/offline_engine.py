"""
Offline Emotional Response Engine for ShadowMind.
Implements fast in-memory matching across 5,000+ keywords and phrases,
context sensitivity, negation handling, multi-emotion detection, and a rich response library.
Operates completely offline without any AI provider or external network access.
"""
import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

logger = logging.getLogger("shadowmind.ai.offline_engine")

DATASET_PATH = os.path.join(os.path.dirname(__file__), "dataset", "emotional_lexicon.json")

# Verified Emergency Hotlines
CRISIS_FOOTER = (
    "If you are in distress or need immediate help, please reach out right now:\n"
    "• Tele-MANAS (India, Free 24/7): 14416 or 1800-891-4416\n"
    "• Emergency Services (India / EU): 112\n"
    "• Suicide & Crisis Lifeline (US / Canada): 988\n"
    "You are not alone, and there are people ready to support you right now."
)

NEGATORS = {
    "not", "no", "never", "no longer", "dont", "do not", "didnt", "did not",
    "isnt", "is not", "wasnt", "was not", "wont", "will not", "cant", "cannot",
    "stop", "stopped", "hardly", "barely", "quit", "without"
}

THIRD_PERSON_SUBJECTS = {
    "movie", "film", "show", "book", "song", "weather", "news", "game", "traffic",
    "workday", "episode", "story", "video", "event"
}

CONTRACTIONS = {
    "i'm": "i am", "im": "i am", "can't": "cannot", "cant": "cannot",
    "don't": "do not", "dont": "do not", "didn't": "did not", "didnt": "did not",
    "won't": "will not", "wont": "will not", "it's": "it is", "its": "it is",
    "that's": "that is", "thats": "that is", "you're": "you are", "youre": "you are"
}


@dataclass
class MatchResult:
    matched_phrase: str
    category: str
    intent: str
    intensity: float
    valence: float
    is_negated: bool = False
    is_third_person: bool = False


@dataclass
class OfflineAnalysis:
    primary_category: str
    secondary_category: Optional[str] = None
    all_categories: List[str] = field(default_factory=list)
    confidence: float = 0.0
    intent: str = "statement"
    is_crisis: bool = False
    matches: List[MatchResult] = field(default_factory=list)
    multi_emotion: bool = False


class OfflineEmotionalEngine:
    def __init__(self, dataset_path: str = DATASET_PATH):
        self.dataset_path = dataset_path
        self.entries: List[Dict] = []
        self.phrase_map: Dict[str, Dict] = {}
        self.word_index: Dict[str, List[str]] = {}
        self.categories: Set[str] = set()
        self._load_dataset()

    def _load_dataset(self):
        if not os.path.exists(self.dataset_path):
            logger.warning("Offline dataset not found at %s. Attempting rebuild...", self.dataset_path)
            try:
                from .dataset.build_lexicon import generate_dataset
                generate_dataset()
            except Exception as e:
                logger.error("Failed to build dataset: %s", e)
                return

        with open(self.dataset_path, "r", encoding="utf-8") as f:
            self.entries = json.load(f)

        for item in self.entries:
            phrase = item["phrase"]
            self.phrase_map[phrase] = item
            self.categories.add(item["category"])

            for w in phrase.split():
                if len(w) > 2:
                    if w not in self.word_index:
                        self.word_index[w] = []
                    self.word_index[w].append(phrase)

        logger.info(
            "OfflineEmotionalEngine initialized with %d entries across %d categories.",
            len(self.phrase_map), len(self.categories)
        )

    def normalize(self, text: str) -> str:
        t = text.lower().strip()
        for c, expanded in CONTRACTIONS.items():
            t = re.sub(rf"\b{c}\b", expanded, t)
        t = re.sub(r"['’`]", "", t)
        t = re.sub(r"[^a-z0-9\s-]", " ", t)
        return re.sub(r"\s+", " ", t).strip()

    def match(self, text: str) -> OfflineAnalysis:
        norm = self.normalize(text)
        tokens = norm.split()
        if not tokens:
            return OfflineAnalysis(primary_category="peace_calm", confidence=0.0)

        matches: List[MatchResult] = []

        # 1. Check for third-person contextual expressions (e.g. "that movie was depressing")
        has_third_person = any(subj in tokens for subj in THIRD_PERSON_SUBJECTS)

        # 2. Multi-clause split check (e.g., "I am happy, but I miss my ex")
        clauses = re.split(r"\b(?:but|yet|although|however|except|while)\b", norm)
        clause_matches: List[List[MatchResult]] = []

        for clause in clauses:
            c_matches: List[MatchResult] = []
            c_text = clause.strip()
            c_tokens = c_text.split()
            if not c_tokens:
                continue

            for phrase, entry in self.phrase_map.items():
                p_tokens = phrase.split()
                # Check exact phrase or keyword substring in clause
                matched = False
                if phrase in c_text:
                    matched = True
                elif len(p_tokens) == 1 and p_tokens[0] in c_tokens:
                    matched = True
                elif len(p_tokens) > 1 and all(pt in c_tokens for pt in p_tokens):
                    matched = True
                elif ("ex" in c_tokens or "breakup" in c_tokens) and entry["category"] in {"breakups_heartbreak", "missing_someone"} and "miss" in c_tokens:
                    matched = True

                if matched:
                    # Check negation in window before phrase
                    p_idx = -1
                    for i in range(len(c_tokens) - len(p_tokens) + 1):
                        if c_tokens[i:i + len(p_tokens)] == p_tokens:
                            p_idx = i
                            break

                    is_neg = False
                    if p_idx > 0:
                        window = c_tokens[max(0, p_idx - 3):p_idx]
                        if any(neg in NEGATORS for neg in window):
                            is_neg = True

                    is_third = has_third_person and entry["category"] in {"sadness", "depression"}
                    res = MatchResult(
                        matched_phrase=phrase,
                        category=entry["category"],
                        intent=entry["intent"],
                        intensity=entry["intensity"],
                        valence=entry["valence"],
                        is_negated=is_neg,
                        is_third_person=is_third
                    )
                    c_matches.append(res)
                    matches.append(res)
            clause_matches.append(c_matches)

        # Check for intent indicators
        intent = "statement"
        if re.search(r"\b(just listen|listen to me|someone to listen|need to vent|hear me out|dont give advice|do not give advice)\b", norm):
            intent = "request_listening"
        elif re.search(r"\b(what should i do|need advice|give me advice|give me tips|how do i fix|how should i)\b", norm):
            intent = "request_advice"
        elif any(m.category == "crisis_safety" and not m.is_negated for m in matches):
            intent = "crisis"

        # Filter out negated or third person matches from dominant emotion
        valid_matches = [m for m in matches if not m.is_negated and not m.is_third_person]
        negated_matches = [m for m in matches if m.is_negated]

        # If a negative emotion is negated (e.g. "not sad anymore"), map to recovery/relief
        if not valid_matches and negated_matches:
            first_neg = negated_matches[0]
            if first_neg.category in {"sadness", "depression", "anxiety", "fear"}:
                return OfflineAnalysis(
                    primary_category="recovery",
                    confidence=0.85,
                    intent=intent,
                    is_crisis=False,
                    matches=negated_matches,
                    multi_emotion=False
                )

        if not valid_matches:
            # Fallback to general greeting or neutral calm
            if any(w in tokens for w in ["hi", "hello", "hey", "morning", "evening"]):
                return OfflineAnalysis(primary_category="general_greetings", confidence=0.75, intent="greeting")
            return OfflineAnalysis(primary_category="peace_calm", confidence=0.3, intent=intent)

        # Sort valid matches by intensity & phrase length (more specific phrases rank higher)
        valid_matches.sort(key=lambda m: (10 if m.category == "crisis_safety" else 0, len(m.matched_phrase.split()), m.intensity), reverse=True)

        primary = valid_matches[0].category
        is_crisis = primary == "crisis_safety"

        secondary = None
        multi_emotion = False

        # If multiple clauses each have valid matches in different categories
        if len(clause_matches) >= 2:
            c1_valid = [m for m in clause_matches[0] if not m.is_negated and not m.is_third_person]
            c2_valid = [m for m in clause_matches[1] if not m.is_negated and not m.is_third_person]
            if c1_valid and c2_valid:
                cat1 = c1_valid[0].category
                cat2 = c2_valid[0].category
                if cat1 != cat2:
                    primary = cat1
                    secondary = cat2
                    multi_emotion = True

        if not secondary:
            for m in valid_matches[1:]:
                if m.category != primary:
                    secondary = m.category
                    break

        distinct_cats = list(dict.fromkeys(m.category for m in valid_matches))

        return OfflineAnalysis(
            primary_category=primary,
            secondary_category=secondary,
            all_categories=distinct_cats,
            confidence=0.9 if len(valid_matches[0].matched_phrase.split()) > 1 else 0.7,
            intent=intent,
            is_crisis=is_crisis,
            matches=valid_matches,
            multi_emotion=bool(secondary and len(clauses) > 1)
        )

    def compose_response(self, text: str, user_turn: int = 1) -> str:
        analysis = self.match(text)

        # Return empty string if no valid emotional phrase matched with confidence >= 0.5
        if not analysis.matches and analysis.confidence < 0.5:
            return ""

        # 1. Crisis handling has absolute priority
        if analysis.is_crisis:
            return (
                "Thank you for telling me. That took courage, and I am taking this seriously. "
                "You are not alone in this, and I am right here with you.\n\n"
                "Are you thinking about ending your life, and are you safe where you are at this moment? "
                "Please connect with someone who can support you right now:\n\n"
                + CRISIS_FOOTER
            )

        # 2. Multi-emotion contrast handling (e.g., "I am happy, but I miss my ex")
        if analysis.multi_emotion and analysis.secondary_category:
            cat1 = analysis.primary_category.replace("_", " ")
            cat2 = analysis.secondary_category.replace("_", " ")
            return (
                f"It makes complete sense that you are feeling both of these at the same time. "
                f"Holding space for conflicting feelings—like feeling settled or glad in one area while also hurting in another—is completely natural.\n\n"
                "You do not have to pick just one feeling to honor today. Which part feels like it needs a little more gentleness right now?"
            )

        # 3. Dedicated request for listening (no unsolicited advice)
        if analysis.intent == "request_listening":
            return (
                "I am here, and I am listening with complete care. You don't have to fix anything, explain yourself, or search for answers right now. "
                "Take all the time you need—tell me whatever is on your heart."
            )

        # 4. Standard category template response
        from .response_library import get_response_for_category
        return get_response_for_category(analysis.primary_category, user_turn, analysis.intent)


# Global singleton instance
_engine: Optional[OfflineEmotionalEngine] = None


def get_offline_engine() -> OfflineEmotionalEngine:
    global _engine
    if _engine is None:
        _engine = OfflineEmotionalEngine()
    return _engine
