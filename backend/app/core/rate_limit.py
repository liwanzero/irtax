import redis
from fastapi import Depends, HTTPException, Request, status

from app.core.config import settings

_redis_client = redis.from_url(settings.redis_url)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(key_prefix: str, max_requests: int, window_seconds: int):
    """Fixed-window rate limiter keyed by client IP, backed by Redis (shared across
    workers/restarts, unlike an in-process counter)."""

    def dependency(request: Request) -> None:
        key = f"ratelimit:{key_prefix}:{_client_ip(request)}"
        count = _redis_client.incr(key)
        if count == 1:
            _redis_client.expire(key, window_seconds)
        if count > max_requests:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
            )

    return Depends(dependency)
