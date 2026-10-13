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
    role: str               # "cbt" | "support" | "solution" | "offline"
    agent_name: str         # Human-readable agent title
    target_model: str       # Configured Ollama model name
    confidence: float
    reason: str
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
            is_offline_only=True
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
            is_offline_only=True
        )

    base_url = getattr(settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    available_models = get_available_ollama_models(base_url)

    cbt_model_cfg = getattr(settings, "OLLAMA_CBT_MODEL", "shadowmind-cbt:latest")
    support_model_cfg = getattr(settings, "OLLAMA_SUPPORT_MODEL", "shadowmind-support:latest")
    solution_model_cfg = getattr(settings, "OLLAMA_SOLUTION_MODEL", "shadowmind-solution:latest")

    # 1. Explicit Session Type Overrides
    if session_type == "cbt":
        target = _resolve_agent_model(cbt_model_cfg, available_models)
        return RouteDecision(
            role="cbt",
            agent_name="Mental Wellness and CBT Agent",
            target_model=target,
            confidence=0.98,
            reason="Explicit CBT session mode requested."
        )

    if session_type in {"mindfulness", "support"}:
        target = _resolve_agent_model(support_model_cfg, available_models)
        return RouteDecision(
            role="support",
            agent_name="Emotional Support Agent",
            target_model=target,
            confidence=0.98,
            reason="Explicit mindfulness/support session mode requested."
        )

    if session_type == "solution":
        target = _resolve_agent_model(solution_model_cfg, available_models)
        return RouteDecision(
            role="solution",
            agent_name="Solution-Focused Mental Wellness Agent",
            target_model=target,
            confidence=0.98,
            reason="Explicit solution-focused session mode requested."
        )

    # 2. Priority Routing: Solution-Focused (Action / "How do I fix/solve" questions)
    is_solution = any(p.search(cleaned) for p in SOLUTION_PATTERNS)
    if is_solution:
        target = _resolve_agent_model(solution_model_cfg, available_models)
        return RouteDecision(
            role="solution",
            agent_name="Solution-Focused Mental Wellness Agent",
            target_model=target,
            confidence=0.95,
            reason="Action-oriented request seeking concrete strategies, solutions, or steps."
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
            reason="User expressed negative thought patterns, cognitive distortions, or self-criticism."
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
            reason="User expressed emotional distress, loneliness, sadness, or requested grounding."
        )

    # 5. Question mark heuristic: If user asks an advice question, route to Solution-Focused
    if "?" in cleaned and len(cleaned.split()) >= 4:
        target = _resolve_agent_model(solution_model_cfg, available_models)
        return RouteDecision(
            role="solution",
            agent_name="Solution-Focused Mental Wellness Agent",
            target_model=target,
            confidence=0.85,
            reason="Direct question seeking guidance routed to Solution-Focused Agent."
        )

    # 6. Default Fallback -> Emotional Support Agent
    target = _resolve_agent_model(support_model_cfg, available_models)
    return RouteDecision(
        role="support",
        agent_name="Emotional Support Agent",
        target_model=target,
        confidence=0.80,
        reason="General mental wellness conversation routed to Emotional Support Agent."
    )
