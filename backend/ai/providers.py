"""
Local LLM providers for ShadowMind.
Implements fast, local-first inference using Ollama with a two-model architecture
(Model A: General Assistant, Model B: Coding & Technical Assistant).
Gemini dependencies have been completely removed.
"""
import asyncio
import logging
import socket
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx

from config import settings

logger = logging.getLogger("shadowmind.ai.providers")

_COOLDOWN_SECONDS = 30.0
_failed_at: Dict[str, float] = {}
_ollama_model_cache: Dict[str, object] = {"name": None, "at": 0.0}
_ollama_reachability_cache: Dict[str, object] = {"reachable": False, "at": 0.0}
_ollama_semaphore: Optional[asyncio.Semaphore] = None


def get_ollama_semaphore() -> asyncio.Semaphore:
    global _ollama_semaphore
    if _ollama_semaphore is None:
        _ollama_semaphore = asyncio.Semaphore(1)
    return _ollama_semaphore


@dataclass
class ProviderResult:
    text: str
    provider: str
    model: str


# ── helpers ──────────────────────────────────────────────────────────────────
def _normalize(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """Alternate user/assistant, merge consecutive same-role turns, start with user."""
    out: List[Dict[str, str]] = []
    for m in messages:
        role = "assistant" if m.get("role") == "assistant" else "user"
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if out and out[-1]["role"] == role:
            out[-1]["content"] += "\n" + content
        else:
            out.append({"role": role, "content": content})
    while out and out[0]["role"] != "user":
        out.pop(0)
    return out or [{"role": "user", "content": "Hello"}]


def _cooling_down(name: str) -> bool:
    cooldown = float(_failed_at.get(f"{name}_cooldown", _COOLDOWN_SECONDS))
    return (time.time() - _failed_at.get(name, 0.0)) < cooldown


def _mark_failed(name: str, err: object, is_connection_error: bool = False) -> None:
    if is_connection_error or isinstance(err, (httpx.ConnectError, httpx.ConnectTimeout)):
        _failed_at[name] = time.time()
        _failed_at[f"{name}_cooldown"] = _COOLDOWN_SECONDS
        logger.warning("AI provider '%s' unreachable or connection error: %s (cooldown active)", name, err)
    else:
        logger.warning("AI provider '%s' request error: %s (no cooldown applied)", name, err)


def configured_order() -> List[str]:
    primary = (getattr(settings, "AI_PRIMARY_PROVIDER", "ollama") or "ollama").strip().lower()
    fallback = (getattr(settings, "AI_FALLBACK_PROVIDER", "offline") or "offline").strip().lower()
    order = [primary]
    if fallback not in order:
        order.append(fallback)
    raw = getattr(settings, "AI_PROVIDER_ORDER", "ollama,offline") or ""
    for p in raw.split(","):
        p_clean = p.strip().lower()
        if p_clean and p_clean not in order:
            order.append(p_clean)
    return order


_sync_client: Optional[httpx.Client] = None


def get_sync_client() -> httpx.Client:
    global _sync_client
    if _sync_client is None or _sync_client.is_closed:
        _sync_client = httpx.Client(
            timeout=httpx.Timeout(45.0, connect=2.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50)
        )
    return _sync_client


_async_client: Optional[httpx.AsyncClient] = None


def get_async_client() -> httpx.AsyncClient:
    global _async_client
    if _async_client is None or _async_client.is_closed:
        _async_client = httpx.AsyncClient(
            timeout=httpx.Timeout(60.0, connect=2.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50)
        )
    return _async_client


def _ollama_reachable(base_url: str) -> bool:
    """Fast check whether local Ollama server port is reachable."""
    global _ollama_reachability_cache
    if "_ollama_reachability_cache" not in globals() or not isinstance(_ollama_reachability_cache, dict):
        _ollama_reachability_cache = {"reachable": False, "at": 0.0}

    now = time.time()
    cached_at = float(_ollama_reachability_cache.get("at", 0.0) or 0.0)
    if (now - cached_at) < 15.0:
        return bool(_ollama_reachability_cache.get("reachable", False))

    if not base_url:
        return False

    is_ok = False
    try:
        u = urlparse(base_url)
        host = u.hostname or "127.0.0.1"
        port = u.port or 11434
        with socket.create_connection((host, port), timeout=0.4):
            is_ok = True
    except Exception:
        is_ok = False

    _ollama_reachability_cache["reachable"] = is_ok
    _ollama_reachability_cache["at"] = now
    return is_ok


_installed_models_cache: Dict[str, Any] = {"models": [], "at": 0.0}


def get_installed_models(base_url: Optional[str] = None) -> List[str]:
    """Returns cached installed Ollama models, querying once at startup or with 1-hour cache."""
    global _installed_models_cache
    now = time.time()
    cached = _installed_models_cache.get("models")
    if cached and (now - float(_installed_models_cache.get("at", 0.0))) < 3600.0:
        return cached

    base = (base_url or getattr(settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434") or "").rstrip("/")
    if not base or not _ollama_reachable(base):
        return cached or []

    try:
        client = get_sync_client()
        tags = client.get(f"{base}/api/tags", timeout=2.0)
        if tags.status_code == 200:
            names = [m.get("name", "") for m in tags.json().get("models", []) if m.get("name")]
            _installed_models_cache["models"] = names
            _installed_models_cache["at"] = now
            return names
    except Exception as e:
        logger.debug("Ollama tag lookup failed: %s", e)
    return cached or []


def _resolve_ollama_model(base_url: str, preferred: Optional[str] = None) -> str:
    """Selects the requested model if available, or falls back to installed model using memory cache without network calls."""
    target_preferred = preferred or getattr(settings, "OLLAMA_SUPPORT_MODEL", "shadowmind-support:latest")
    names = get_installed_models(base_url)
    if names:
        exact = [n for n in names if n == target_preferred or n.startswith(target_preferred.split(":")[0])]
        return exact[0] if exact else names[0]
    return target_preferred


# ── Ollama Calls ─────────────────────────────────────────────────────────────
def _call_ollama(
    system: str,
    messages: List[Dict[str, str]],
    max_tokens: int,
    temperature: float,
    json_mode: bool,
    model_override: Optional[str] = None,
    timeout_override: Optional[float] = None,
) -> Optional[ProviderResult]:
    base = (getattr(settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434") or "").rstrip("/")
    if not base or not _ollama_reachable(base):
        _failed_at["ollama"] = time.time()
        return None

    model = _resolve_ollama_model(base, model_override)
    keep_alive = getattr(settings, "OLLAMA_KEEP_ALIVE", "30m")

    payload = {
        "model": model,
        "stream": False,
        "keep_alive": keep_alive,
        "messages": [{"role": "system", "content": system}, *_normalize(messages)],
        "options": {
            "num_predict": min(max_tokens or 220, 250),
            "num_ctx": 1024,
            "temperature": min(temperature, 0.7),
            "top_p": 0.9,
            "repeat_penalty": 1.1
        },
    }
    if json_mode:
        payload["format"] = "json"

    t0 = time.time()
    try:
        client = get_sync_client()
        timeout = float(timeout_override or getattr(settings, "OLLAMA_TIMEOUT", 60.0))
        r = client.post(f"{base}/api/chat", json=payload, timeout=httpx.Timeout(timeout, connect=2.5))
        if r.status_code != 200:
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
        text = (r.json().get("message", {}).get("content") or "").strip()
        elapsed = int((time.time() - t0) * 1000)
        logger.info("[PERF] Ollama completed in %d ms (model=%s)", elapsed, model)
        return ProviderResult(text, "ollama", model) if text else None
    except Exception as e:
        is_conn = isinstance(e, (httpx.ConnectError, httpx.ConnectTimeout))
        _mark_failed("ollama", e, is_connection_error=is_conn)
        return None


# ── Optional Secondary Fallbacks (Anthropic / Groq if configured) ───────────
def _call_anthropic(system: str, messages, max_tokens: int, temperature: float) -> Optional[ProviderResult]:
    key = (getattr(settings, "ANTHROPIC_API_KEY", "") or "").strip()
    if not key:
        return None
    model = getattr(settings, "ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
    try:
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": model, "max_tokens": max_tokens, "temperature": temperature,
                  "system": system, "messages": _normalize(messages)},
            timeout=httpx.Timeout(30.0, connect=3.0),
        )
        if r.status_code != 200:
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
        parts = r.json().get("content", [])
        text = "".join(p.get("text", "") for p in parts if p.get("type") == "text").strip()
        return ProviderResult(text, "claude", model) if text else None
    except Exception as e:
        _mark_failed("anthropic", e)
        return None


def _call_groq(system: str, messages, max_tokens: int, temperature: float, json_mode: bool) -> Optional[ProviderResult]:
    key = (getattr(settings, "GROQ_API_KEY", "") or "").strip()
    if not key:
        return None
    model = getattr(settings, "GROQ_MODEL", "llama-3.3-70b-versatile")
    body = {
        "model": model, "max_tokens": max_tokens, "temperature": temperature,
        "messages": [{"role": "system", "content": system}, *_normalize(messages)],
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    try:
        r = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=body, timeout=httpx.Timeout(20.0, connect=3.0),
        )
        if r.status_code != 200:
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
        text = (r.json()["choices"][0]["message"]["content"] or "").strip()
        return ProviderResult(text, "groq", model) if text else None
    except Exception as e:
        _mark_failed("groq", e)
        return None


# ── Streaming ────────────────────────────────────────────────────────────────
async def generate_stream_async(
    system: str,
    messages: List[Dict[str, str]],
    max_tokens: int = 1024,
    temperature: float = 0.7,
    model_override: Optional[str] = None
):
    """
    Yields (chunk_text, provider_name, model_name) progressively from Ollama.
    Falls through gracefully if local runtime is unavailable.
    """
    client = get_async_client()
    base = (getattr(settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434") or "").rstrip("/")

    for name in configured_order():
        if _cooling_down(name):
            continue

        if name == "ollama":
            if not base or not _ollama_reachable(base):
                _failed_at["ollama"] = time.time()
                continue

            model = _resolve_ollama_model(base, model_override)
            keep_alive = getattr(settings, "OLLAMA_KEEP_ALIVE", "30m")
            payload = {
                "model": model,
                "stream": True,
                "keep_alive": keep_alive,
                "messages": [{"role": "system", "content": system}, *_normalize(messages)],
                "options": {
                    "num_predict": min(max_tokens or 220, 250),
                    "num_ctx": 1024,
                    "temperature": min(temperature, 0.7)
                },
            }
            t0 = time.time()
            ttft = None
            try:
                logger.info("[PERF] Ollama stream started (model=%s)", model)
                timeout = float(getattr(settings, "OLLAMA_TIMEOUT", 60.0))
                async with get_ollama_semaphore():
                    async with client.stream(
                        "POST",
                        f"{base}/api/chat",
                        json=payload,
                        timeout=httpx.Timeout(timeout, connect=3.0)
                    ) as response:
                        if response.status_code != 200:
                            _mark_failed("ollama", f"HTTP {response.status_code}")
                            continue
                        async for line in response.aiter_lines():
                            if line:
                                try:
                                    import json
                                    event = json.loads(line)
                                    delta = event.get("message", {}).get("content", "")
                                    if delta:
                                        if ttft is None:
                                            ttft = int((time.time() - t0) * 1000)
                                            logger.info("[PERF] Ollama first response: %d ms", ttft)
                                        yield delta, "ollama", model
                                except Exception:
                                    pass
                        elapsed = int((time.time() - t0) * 1000)
                        logger.info("[PERF] Ollama completed stream: %d ms", elapsed)
                        return
            except Exception as e:
                elapsed = int((time.time() - t0) * 1000)
                logger.warning("[PERF] Ollama streaming failed: %d ms (%s)", elapsed, e)
                is_conn = isinstance(e, (httpx.ConnectError, httpx.ConnectTimeout))
                _mark_failed("ollama", e, is_connection_error=is_conn)

        elif name == "anthropic":
            key = (getattr(settings, "ANTHROPIC_API_KEY", "") or "").strip()
            if not key:
                continue
            model = getattr(settings, "ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
            try:
                async with client.stream(
                    "POST",
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                    json={"model": model, "max_tokens": max_tokens, "temperature": temperature,
                          "system": system, "messages": _normalize(messages), "stream": True},
                ) as response:
                    if response.status_code != 200:
                        _mark_failed("anthropic", f"HTTP {response.status_code}")
                        continue
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            import json
                            raw_data = line[6:].strip()
                            if raw_data == "[DONE]":
                                break
                            try:
                                event = json.loads(raw_data)
                                if event.get("type") == "content_block_delta":
                                    delta = event.get("delta", {}).get("text", "")
                                    if delta:
                                        yield delta, "claude", model
                            except Exception:
                                pass
                    return
            except Exception as e:
                _mark_failed("anthropic", e)

        elif name == "groq":
            key = (getattr(settings, "GROQ_API_KEY", "") or "").strip()
            if not key:
                continue
            model = getattr(settings, "GROQ_MODEL", "llama-3.3-70b-versatile")
            body = {
                "model": model, "max_tokens": max_tokens, "temperature": temperature,
                "messages": [{"role": "system", "content": system}, *_normalize(messages)],
                "stream": True,
            }
            try:
                async with client.stream(
                    "POST",
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json=body,
                ) as response:
                    if response.status_code != 200:
                        _mark_failed("groq", f"HTTP {response.status_code}")
                        continue
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            raw_data = line[6:].strip()
                            if raw_data == "[DONE]":
                                break
                            try:
                                import json
                                event = json.loads(raw_data)
                                delta = event["choices"][0]["delta"].get("content", "")
                                if delta:
                                    yield delta, "groq", model
                            except Exception:
                                pass
                    return
            except Exception as e:
                _mark_failed("groq", e)


# ── Public Generate ──────────────────────────────────────────────────────────
def generate(
    system: str,
    messages: List[Dict[str, str]],
    max_tokens: int = 1024,
    temperature: float = 0.7,
    json_mode: bool = False,
    skip: Optional[List[str]] = None,
    model_override: Optional[str] = None,
    timeout: Optional[float] = None,
) -> Optional[ProviderResult]:
    """Try configured local providers; return first non-empty result."""
    for name in configured_order():
        if skip and name in skip:
            continue
        if _cooling_down(name):
            continue
        if name == "ollama":
            res = _call_ollama(system, messages, max_tokens, temperature, json_mode, model_override, timeout_override=timeout)
        elif name == "anthropic":
            res = _call_anthropic(system, messages, max_tokens, temperature)
        elif name == "groq":
            res = _call_groq(system, messages, max_tokens, temperature, json_mode)
        else:
            continue
        if res:
            return res
    return None


def status() -> Dict[str, object]:
    """Status for health and UI checks without Gemini dependencies."""
    base = (getattr(settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434") or "").rstrip("/")
    anthropic_key = (getattr(settings, "ANTHROPIC_API_KEY", "") or "").strip()
    groq_key = (getattr(settings, "GROQ_API_KEY", "") or "").strip()
    ollama_ok = _ollama_reachable(base) if (base and not _cooling_down("ollama")) else False

    installed_models = get_installed_models(base) if ollama_ok else []

    return {
        "primary": getattr(settings, "AI_PRIMARY_PROVIDER", "ollama"),
        "fallback": getattr(settings, "AI_FALLBACK_PROVIDER", "offline"),
        "order": configured_order(),
        "ollama": ollama_ok,
        "ollama_models": installed_models,
        "general_model": getattr(settings, "OLLAMA_GENERAL_MODEL", "llama3.2:latest"),
        "cbt_model": getattr(settings, "OLLAMA_CBT_MODEL", "shadowmind-cbt:latest"),
        "support_model": getattr(settings, "OLLAMA_SUPPORT_MODEL", "shadowmind-support:latest"),
        "solution_model": getattr(settings, "OLLAMA_SOLUTION_MODEL", "shadowmind-solution:latest"),
        "anthropic": bool(anthropic_key) and not _cooling_down("anthropic"),
        "groq": bool(groq_key) and not _cooling_down("groq"),
    }


async def warm_up_local_models_async():
    """
    Initializes and warms up the primary Ollama chat model before requests arrive.
    Eliminates the 20-30s model loading delay and caches installed models.
    """
    global _installed_models_cache
    base = (getattr(settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434") or "").rstrip("/")
    if not base or not _ollama_reachable(base):
        logger.info("[WARMUP] Ollama not reachable; skipping startup model preload.")
        return

    client = get_async_client()

    # 1. Populate installed models cache asynchronously at startup
    try:
        tags = await client.get(f"{base}/api/tags", timeout=3.0)
        if tags.status_code == 200:
            names = [m.get("name", "") for m in tags.json().get("models", []) if m.get("name")]
            _installed_models_cache["models"] = names
            _installed_models_cache["at"] = time.time()
            logger.info("ℹ️ [WARMUP] Discovered installed Ollama models: %s", names)
    except Exception as e:
        logger.debug("[WARMUP] Tag discovery failed: %s", e)

    # 2. Warm up the primary chat model (shadowmind-support:latest)
    # The default chat role is Emotional Support, which users hit first upon starting conversation.
    chat_model = getattr(settings, "OLLAMA_SUPPORT_MODEL", "shadowmind-support:latest")
    keep_alive = getattr(settings, "OLLAMA_KEEP_ALIVE", "60m")

    logger.info("[WARMUP] Preloading chat model '%s' into memory (keep_alive=%s)...", chat_model, keep_alive)
    try:
        r = await client.post(
            f"{base}/api/generate",
            json={"model": chat_model, "keep_alive": keep_alive},
            timeout=httpx.Timeout(60.0, connect=5.0)
        )
        if r.status_code == 200:
            logger.info("✅ [WARMUP] Model '%s' successfully loaded into memory and ready for instant response!", chat_model)
        else:
            logger.warning("[WARMUP] Preload returned HTTP %d: %s", r.status_code, r.text[:200])
    except Exception as e:
        logger.warning("[WARMUP] Preload failed (non-critical): %s", e)


async def close_ai_providers_async():
    """Clean up HTTP clients on application shutdown without touching the Ollama daemon."""
    global _async_client, _sync_client
    if _async_client and not _async_client.is_closed:
        await _async_client.aclose()
        _async_client = None
    if _sync_client and not _sync_client.is_closed:
        _sync_client.close()
        _sync_client = None
    logger.info("AI provider clients cleanly closed.")
