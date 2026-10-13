"""
middleware.py — Rate limiting and request logging middleware.
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import time
import logging

logger = logging.getLogger("shadowmind")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs each request with method, path, status code, and duration."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration = (time.perf_counter() - start) * 1000  # ms

        # Skip health check noise
        if request.url.path not in ["/health", "/"]:
            logger.info(
                f"{request.method} {request.url.path} "
                f"→ {response.status_code} ({duration:.1f}ms)"
            )
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds basic security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
