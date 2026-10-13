"""
Orchestration: analyze → route (to one of 3 specialized mental wellness agents) → (model | offline) → validate → safety.

The LLM is verified for safety and distress consistency. If it answers a distressed user with cheerful
language, the reply is rejected, the model is retried once with the reason, and only then do we fall back to
the offline composer.
"""
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from . import guard, providers
from .analyzer import TextAnalysis, analyze_text
from .composer import compose_chat_reply
from .offline_engine import get_offline_engine
from .prompts import context_block, system_prompt_for
from .resources import actions_for
from .router import route_request

logger = logging.getLogger("shadowmind.ai.engine")


@dataclass
class ChatReply:
    text: str
    provider: str                       # ollama | offline | claude | groq
    analysis: TextAnalysis
    crisis_level: int = 0
    suggestions: List[Dict[str, str]] = field(default_factory=list)
    model: Optional[str] = None
    agent: Optional[str] = None

    def meta(self) -> Dict:
        return {
            "provider": self.provider,
            "model": self.model,
            "agent": self.agent,
            "crisis_level": self.crisis_level,
            "emotion": self.analysis.to_public(),
            "suggestions": self.suggestions,
        }


def _effective_mode(session_type: str, analysis: TextAnalysis) -> str:
    """Acute risk always switches to crisis handling, whatever mode the user chose."""
    if analysis.crisis_level >= 2:
        return "crisis"
    return session_type if session_type in {"general", "cbt", "mindfulness", "support", "solution", "crisis"} else "general"


def _offline_compose(history, mode, analysis, recent_assistant, context, last_user, user_turns) -> str:
    if mode in {"cbt", "mindfulness", "support", "solution", "crisis"} or analysis.crisis_level >= 1 or analysis.depressed or (context and context.depressed):
        return compose_chat_reply(history, mode, analysis, recent_assistant, context)

    from .composer import KNOWLEDGE
    if any(p.search(last_user) for p, *_ in KNOWLEDGE):
        return compose_chat_reply(history, mode, analysis, recent_assistant, context)

    offline_engine = get_offline_engine()
    text = offline_engine.compose_response(last_user, user_turns)
    if not text or len(text.strip()) < 15:
        text = compose_chat_reply(history, mode, analysis, recent_assistant, context)
    return text


def generate_chat_reply(
    messages: List[Dict[str, str]],
    session_type: str = "general",
    max_tokens: int = 1024,
    wellness_context: Optional[Dict] = None,
) -> ChatReply:
    t0_start = time.time()
    # Bound history to recent 6 turns for optimal token processing efficiency and lower latency
    history = [
        m for m in messages[-6:]
        if m.get("content") and "rate limit" not in m["content"].lower() and "high demand" not in m["content"].lower()
    ] or messages[-1:]
    last_user = next((m["content"] for m in reversed(history) if m.get("role") == "user"), "")
    analysis = analyze_text(last_user)
    recent_user = [m["content"] for m in history if m.get("role") == "user"][-3:]
    context = analyze_text(" . ".join(recent_user)) if len(recent_user) > 1 else analysis
    mode = _effective_mode(session_type, analysis)
    user_turns = sum(1 for m in history if m.get("role") == "user")
    recent_assistant = [m["content"] for m in history if m.get("role") == "assistant"][-3:]

    suggestions = actions_for(analysis.primary, analysis.crisis_level, analysis.depressed)

    # ── Intelligent Single-Agent Routing (Among the Three Mental Wellness Agents) ──
    base_ollama_url = getattr(providers.settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    ollama_ok = providers._ollama_reachable(base_ollama_url) and not providers._cooling_down("ollama")
    route_decision = route_request(last_user, ollama_reachable=ollama_ok, session_type=mode)

    # Determine prompt mode: crisis mode takes top priority; otherwise use routed agent role
    effective_prompt_mode = "crisis" if mode == "crisis" else route_decision.role

    # Base prompt with per-turn context steering
    prompt_additions = [context_block(analysis, mode, user_turns, wellness_context)]
    base_prompt = system_prompt_for(effective_prompt_mode) + "\n\n" + "\n\n".join(prompt_additions)
    context_prep_ms = int((time.time() - t0_start) * 1000)

    text: Optional[str] = None
    provider_name, model_name = "offline", None
    provider_req_ms = 0
    fallback_ms = 0

    # If routed directly to offline or local LLM runtime unavailable
    if route_decision.role == "offline":
        t_fallback_start = time.time()
        text = _offline_compose(history, mode, analysis, recent_assistant, context, last_user, user_turns)
        fallback_ms = int((time.time() - t_fallback_start) * 1000)
        provider_name, model_name = "offline", None
    else:
        t_prov_start = time.time()
        result = providers.generate(base_prompt, history, max_tokens=max_tokens, model_override=route_decision.target_model)
        provider_req_ms = int((time.time() - t_prov_start) * 1000)

        if result:
            candidate = guard.clean(result.text)
            ok, reason = guard.validate(candidate, analysis, mode)
            if ok:
                text, provider_name, model_name = candidate, result.provider, result.model
            else:
                logger.info("Model reply failed validation (%s); attempting corrective retry", reason)
                corrective_prompt = (
                    base_prompt
                    + f"\n\nIMPORTANT CORRECTION: Your previous draft was rejected because: {reason}. "
                    + "Rewrite your reply completely following all guidelines."
                )
                t_retry_start = time.time()
                retry_result = providers.generate(corrective_prompt, history, max_tokens=max_tokens, model_override=route_decision.target_model)
                provider_req_ms += int((time.time() - t_retry_start) * 1000)
                if retry_result:
                    retry_candidate = guard.clean(retry_result.text)
                    retry_ok, _ = guard.validate(retry_candidate, analysis, mode)
                    if retry_ok:
                        text, provider_name, model_name = retry_candidate, retry_result.provider, retry_result.model

        if not text:
            t_fallback_start = time.time()
            text = _offline_compose(history, mode, analysis, recent_assistant, context, last_user, user_turns)
            fallback_ms = int((time.time() - t_fallback_start) * 1000)
            provider_name, model_name = "offline", None

    text = guard.ensure_safety_footer(text, analysis)
    total_latency_ms = int((time.time() - t0_start) * 1000)

    logger.info(
        "[DIAGNOSTIC] context_prep_ms=%d provider_req_ms=%d fallback_ms=%d total_latency_ms=%d provider=%s model=%s agent=%s crisis_level=%d",
        context_prep_ms, provider_req_ms, fallback_ms, total_latency_ms, provider_name, model_name, route_decision.agent_name, analysis.crisis_level
    )

    return ChatReply(
        text=text, provider=provider_name, analysis=analysis,
        crisis_level=analysis.crisis_level, suggestions=suggestions, model=model_name,
        agent=route_decision.agent_name,
    )


async def generate_chat_reply_stream_async(
    messages: List[Dict[str, str]],
    session_type: str = "general",
    max_tokens: int = 1024,
    wellness_context: Optional[Dict] = None,
):
    """
    Yields events progressively:
      {"type": "start", "meta": {...}}
      {"type": "delta", "text": "..."}
      {"type": "done", "text": "...", "meta": {...}}
    """
    t0_start = time.time()
    # Bound history to recent 6 turns for optimal token processing efficiency and lower latency
    history = [
        m for m in messages[-6:]
        if m.get("content") and "rate limit" not in m["content"].lower() and "high demand" not in m["content"].lower()
    ] or messages[-1:]
    last_user = next((m["content"] for m in reversed(history) if m.get("role") == "user"), "")
    analysis = analyze_text(last_user)
    recent_user = [m["content"] for m in history if m.get("role") == "user"][-3:]
    context = analyze_text(" . ".join(recent_user)) if len(recent_user) > 1 else analysis
    mode = _effective_mode(session_type, analysis)
    user_turns = sum(1 for m in history if m.get("role") == "user")
    recent_assistant = [m["content"] for m in history if m.get("role") == "assistant"][-3:]

    suggestions = actions_for(analysis.primary, analysis.crisis_level, analysis.depressed)

    # Route request deterministically to exactly ONE of the three specialized agents
    base_ollama_url = getattr(providers.settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    ollama_ok = providers._ollama_reachable(base_ollama_url) and not providers._cooling_down("ollama")
    route_decision = route_request(last_user, ollama_reachable=ollama_ok, session_type=mode)

    effective_prompt_mode = "crisis" if mode == "crisis" else route_decision.role

    prompt_additions = [context_block(analysis, mode, user_turns, wellness_context)]
    base_prompt = system_prompt_for(effective_prompt_mode) + "\n\n" + "\n\n".join(prompt_additions)
    context_prep_ms = int((time.time() - t0_start) * 1000)

    meta = {
        "provider": "offline" if route_decision.role == "offline" else "ollama",
        "model": None if route_decision.role == "offline" else route_decision.target_model,
        "agent": route_decision.agent_name,
        "crisis_level": analysis.crisis_level,
        "emotion": analysis.to_public(),
        "suggestions": suggestions,
    }

    yield {"type": "start", "meta": meta}

    full_text = ""
    provider_used = "offline"
    model_used = None
    fallback_ms = 0

    if route_decision.role == "offline":
        # Stream offline response immediately
        full_text = _offline_compose(history, mode, analysis, recent_assistant, context, last_user, user_turns)
        provider_used = "offline"
        model_used = None
        yield {"type": "delta", "text": full_text}
    else:
        try:
            async for chunk, prov, mdl in providers.generate_stream_async(
                base_prompt, history, max_tokens=max_tokens, model_override=route_decision.target_model
            ):
                full_text += chunk
                provider_used = prov
                model_used = mdl
                yield {"type": "delta", "text": chunk}
        except Exception as e:
            logger.warning("Streaming failed: %s", e)

        if not full_text.strip():
            t_fallback_start = time.time()
            full_text = _offline_compose(history, mode, analysis, recent_assistant, context, last_user, user_turns)
            fallback_ms = int((time.time() - t_fallback_start) * 1000)
            provider_used = "offline"
            model_used = None
            yield {"type": "delta", "text": full_text}
        else:
            full_text = guard.clean(full_text)
            ok, reason = guard.validate(full_text, analysis, mode)
            if not ok:
                logger.info("Streamed reply failed validation (%s), falling back to offline engine", reason)
                t_fallback_start = time.time()
                full_text = _offline_compose(history, mode, analysis, recent_assistant, context, last_user, user_turns)
                fallback_ms = int((time.time() - t_fallback_start) * 1000)
                provider_used = "offline"
                model_used = None

    full_text = guard.ensure_safety_footer(full_text, analysis)
    meta["provider"] = provider_used
    meta["model"] = model_used

    total_latency_ms = int((time.time() - t0_start) * 1000)
    logger.info(
        "[DIAGNOSTIC] stream context_prep_ms=%d fallback_ms=%d total_latency_ms=%d provider=%s model=%s agent=%s crisis_level=%d",
        context_prep_ms, fallback_ms, total_latency_ms, provider_used, model_used, route_decision.agent_name, analysis.crisis_level
    )

    yield {"type": "done", "text": full_text, "meta": meta}
