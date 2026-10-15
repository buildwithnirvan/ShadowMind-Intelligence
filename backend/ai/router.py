"""
Centralized Intelligent Model & Agent Router for ShadowMind AI.
Routes user queries to one of three specialized local mental wellness agents:
  1. Mental Wellness and CBT Agent (shadowmind-cbt)
  2. Emotional Support Agent (shadowmind-support)
  3. Solution-Focused Mental Wellness Agent (shadowmind-solution)
"""
import logging
import re
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Set

import httpx

from config import settings

logger = logging.getLogger("shadowmind.ai.router")

_model_cache: Dict[str, object] = {"models": set(), "checked_at": 0.0}

# ── Pattern Definitions for the Three Agents ─────────────────────────────────

# Code, Debugging & Syntax Triggers
CODER_PATTERNS = [
    re.compile(r"\b(def\s+\w+|class\s+\w+|import\s+\w+|from\s+\w+\s+import|function\s+\w+|const\s+\w+|let\s+\w+|var\s+\w+)\b"),
    re.compile(r"\b(syntaxerror|nullpointerexception|typeerror|attributeerror|indexerror|keyerror|importerror|referenceerror|segmentation\s*fault|segfault|stack\s*trace)\b", re.I),
    re.compile(r"\b(debug(?:ging)?|exception|compiler|stack trace|runtime error|npm\s+run|git\s+commit|dockerfile|pip\s+install)\b", re.I),
    re.compile(r"(?:#include|<\?php|public\s+static\s+void|console\.log|print\(|SELECT\s+.*\s+FROM)", re.I),
]

# Educational / Learning / Technical Roadmap Triggers
EDUCATIONAL_PATTERNS = [
    re.compile(r"\b(roadmap|curriculum|study plan|syllabus|learning path)\b", re.I),
    re.compile(r"\b(full[ -]?stack|frontend|backend|web dev|software engineer\w*|programming|coding|developer|code|python|javascript|typescript|react|html|css|sql|database|api|algorithms?)\b", re.I),
    re.compile(r"\b(how to learn|how does .* work|explain|tutorial|guide on|teach me|introduction to|course)\b", re.I),
]

# Agent 3: Solution-Focused Triggers
# Practical action requests, strategy questions, "how to fix/solve/do"
SOLUTION_PATTERNS = [
    re.compile(r"\b(what should i do|what do i do|what can i do|what must i do)\b", re.I),
    re.compile(r"\b(how (?:can|do|should) i (?:fix|solve|stop|overcome|handle|deal with|address|manage|prevent|change))\b", re.I),
    re.compile(r"\b(give me a solution|need a solution|find a solution|solve this|fix this)\b", re.I),
    re.compile(r"\b(action plan|step[ -]by[ -]step|concrete steps|practical steps|clear steps|manageable steps)\b", re.I),
    re.compile(r"\b(what are the steps|how to start|what to do next|give me advice on how to)\b", re.I),
    re.compile(r"\b(how do i concentrate|how can i focus|how to study|how to sleep better|how to stop overthinking)\b", re.I),
    re.compile(r"\b(give me a strategy|give me a plan|actionable advice|what is the best approach)\b", re.I),
]

# Agent 1: CBT & Thinking Patterns Triggers
# Distortions, recurring unhelpful thoughts, self-blame, triggers, all-or-nothing
CBT_PATTERNS = [
    re.compile(r"\b(i feel like a failure|i am a failure|i'm a failure|im a failure)\b", re.I),
    re.compile(r"\b(i always (?:fail|mess up|ruin everything|make mistakes)|nobody likes me|everyone (?:hates|judges) me)\b", re.I),
    re.compile(r"\b(catastrophiz\w*|all[ -]or[ -]nothing|black[ -]and[ -]white thinking|mind reading|overgeneraliz\w*)\b", re.I),
    re.compile(r"\b(cognitive distortion|negative thoughts?|intrusive thoughts?|thought pattern|recurring thought)\b", re.I),
    re.compile(r"\b(i'm not good enough|worthless|impostor syndrome|imposter syndrome|self[ -]critical|beating myself up)\b", re.I),
    re.compile(r"\b(reframe this|cbt|identify (?:my )?triggers?|why do i keep thinking|unhelpful thought)\b", re.I),
]

# Agent 2: Emotional Support Triggers
# Loneliness, grief, anxiety, sadness, heartbreak, interpersonal distress, grounding
SUPPORT_PATTERNS = [
    re.compile(r"\b(lonely|loneliness|so alone|isolated|no one understands me)\b", re.I),
    re.compile(r"\b(sad|sadness|heartbroken|crying|depressed|hopeless|empty inside|grief|mourning)\b", re.I),
    re.compile(r"\b(anxious|anxiety|panic attack|terrified|scared|dread|fearful)\b", re.I),
    re.compile(r"\b(overwhelmed|stressed out|burnt out|exhausted emotionally|heavy heart)\b", re.I),
    re.compile(r"\b(breakup|broke up|fight with my|conflict with|partner left|friendship ended)\b", re.I),
    re.compile(r"\b(grounding|breathing exercise|need comfort|just listen to me|hold space|gentle reassurance)\b", re.I),
]

# Offline greetings / courtesy fast-path
SIMPLE_OFFLINE_PATTERNS = [
    re.compile(r"^(hi|hello|hey|good morning|good afternoon|good evening|howdy)[\s.!?]*$", re.I),
    re.compile(r"^(thanks|thank you|thank you so much|thx|ty)[\s.!?]*$", re.I),
    re.compile(r"^(bye|goodbye|see you|take care|cya)[\s.!?]*$", re.I),
]


@dataclass
class RouteDecision:
    role: str               # "cbt" | "support" | "solution" | "coder" | "general" | "offline"
    agent_name: str         # Human-readable agent title
    target_model: str       # Configured Ollama model name
    confidence: float
    reason: str
    is_technical: bool = False
    is_offline_only: bool = False


def get_available_ollama_models(base_url: str = None) -> Set[str]:
    """Retrieves installed Ollama models from centralized memory cache without blocking network calls."""
    try:
        from ai.providers import get_installed_models
        names = get_installed_models(base_url)
    except Exception:
        names = []

    found = set()
    for name in names:
        if name:
            found.add(name)
            if ":" in name:
                found.add(name.split(":")[0])
    return found


def _resolve_agent_model(preferred_model: str, available_models: Set[str]) -> str:
    """Returns preferred model if installed, else falls back gracefully to general model."""
    if not available_models:
        return preferred_model
    if preferred_model in available_models or preferred_model.split(":")[0] in available_models:
        return preferred_model

    general = getattr(settings, "OLLAMA_GENERAL_MODEL", "llama3.2:latest")
    if general in available_models or general.split(":")[0] in available_models:
        return general

    # If neither preferred nor general matches, use the first available model
    return next(iter(available_models))


def route_request(
    text: str,
    ollama_reachable: bool = True,
    session_type: str = "general",
) -> RouteDecision:
    """
    Intelligently routes the user query to the most appropriate Mental Wellness Agent:
      1. Solution-Focused Agent (requests for action, solutions, strategies, steps)
      2. CBT & Thinking Patterns Agent (distortions, self-blame, triggers, recurring thoughts)
      3. Emotional Support Agent (loneliness, sadness, distress, grounding, relationship grief)
    """
    if not ollama_reachable:
        return RouteDecision(
            role="offline",
            agent_name="Offline Emotional Engine",
            target_model="offline",
            confidence=1.0,
            reason="Ollama runtime is offline; routing to Offline Emotional Engine.",
            is_offline_only=True,
            is_technical=False
        )

    cleaned = text.strip()

    # Fast-path for simple greetings/thank you
    if session_type == "general" and any(p.match(cleaned) for p in SIMPLE_OFFLINE_PATTERNS):
        return RouteDecision(
            role="offline",
            agent_name="Offline Emotional Engine",
            target_model="offline",
            confidence=0.99,
            reason="Simple conversational greeting or courtesy routed to instant offline engine.",
            is_offline_only=True,
            is_technical=False
        )

    base_url = getattr(settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    available_models = get_available_ollama_models(base_url)

    cbt_model_cfg = getattr(settings, "OLLAMA_CBT_MODEL", "shadowmind-cbt:latest")
    support_model_cfg = getattr(settings, "OLLAMA_SUPPORT_MODEL", "shadowmind-support:latest")
    solution_model_cfg = getattr(settings, "OLLAMA_SOLUTION_MODEL", "shadowmind-solution:latest")
    general_model_cfg = getattr(settings, "OLLAMA_GENERAL_MODEL", "llama3.2:latest")
    coder_model_cfg = getattr(settings, "OLLAMA_CODER_MODEL", "qwen2.5-coder:3b")

    # 1. Explicit Session Type Overrides
    if session_type == "coder":
        target = _resolve_agent_model(coder_model_cfg, available_models)
        return RouteDecision(
            role="coder",
            agent_name="Technical & Coding Specialist",
            target_model=target,
            confidence=0.98,
            reason="Explicit coder session mode requested.",
            is_technical=True
        )

    if session_type == "cbt":
        target = _resolve_agent_model(cbt_model_cfg, available_models)
        return RouteDecision(
            role="cbt",
            agent_name="Mental Wellness and CBT Agent",
            target_model=target,
            confidence=0.98,
            reason="Explicit CBT session mode requested.",
            is_technical=False
        )

    if session_type in {"mindfulness", "support"}:
        target = _resolve_agent_model(support_model_cfg, available_models)
        return RouteDecision(
            role="support",
            agent_name="Emotional Support Agent",
            target_model=target,
            confidence=0.98,
            reason="Explicit mindfulness/support session mode requested.",
            is_technical=False
        )

    if session_type == "solution":
        target = _resolve_agent_model(solution_model_cfg, available_models)
        return RouteDecision(
            role="solution",
            agent_name="Solution-Focused Mental Wellness Agent",
            target_model=target,
            confidence=0.98,
            reason="Explicit solution-focused session mode requested.",
            is_technical=False
        )

    # 2. Priority Routing: Code / Programming / Debugging Syntax
    is_coder = any(p.search(cleaned) for p in CODER_PATTERNS)
    if is_coder:
        target = _resolve_agent_model(coder_model_cfg, available_models)
        return RouteDecision(
            role="coder",
            agent_name="Technical & Coding Specialist",
            target_model=target,
            confidence=0.97,
            reason="Code syntax, technical error, or debugging request routed to Coding Specialist.",
            is_technical=True
        )

    # 3. CBT & Cognitive Distortions Triggers
    is_cbt = any(p.search(cleaned) for p in CBT_PATTERNS)
    if is_cbt:
        target = _resolve_agent_model(cbt_model_cfg, available_models)
        return RouteDecision(
            role="cbt",
            agent_name="Mental Wellness and CBT Agent",
            target_model=target,
            confidence=0.93,
            reason="User expressed negative thought patterns, cognitive distortions, or self-criticism.",
            is_technical=False
        )

    # 4. Emotional Support Triggers
    is_support = any(p.search(cleaned) for p in SUPPORT_PATTERNS)
    if is_support:
        target = _resolve_agent_model(support_model_cfg, available_models)
        return RouteDecision(
            role="support",
            agent_name="Emotional Support Agent",
            target_model=target,
            confidence=0.92,
            reason="User expressed emotional distress, loneliness, sadness, or requested grounding.",
            is_technical=False
        )

    # 5. Action-Oriented / Problem-Solving Triggers
    is_solution = any(p.search(cleaned) for p in SOLUTION_PATTERNS)
    if is_solution:
        target = _resolve_agent_model(solution_model_cfg, available_models)
        return RouteDecision(
            role="solution",
            agent_name="Solution-Focused Mental Wellness Agent",
            target_model=target,
            confidence=0.95,
            reason="Action-oriented request seeking concrete strategies, solutions, or steps.",
            is_technical=False
        )

    # 6. Priority Routing: Educational, Roadmap & Technical Guidance
    is_educational = any(p.search(cleaned) for p in EDUCATIONAL_PATTERNS)
    if is_educational:
        target = _resolve_agent_model(solution_model_cfg, available_models)
        return RouteDecision(
            role="solution",
            agent_name="Solution & Learning Guide",
            target_model=target,
            confidence=0.96,
            reason="Educational, learning, or technical guidance request routed to Solution & Learning Guide.",
            is_technical=False
        )

    # 7. General Questions and Conversations
    target = _resolve_agent_model(general_model_cfg, available_models)
    return RouteDecision(
        role="general",
        agent_name="General AI Companion",
        target_model=target,
        confidence=0.85,
        reason="General conversation or inquiry routed to General AI Companion.",
        is_technical=False
    )
