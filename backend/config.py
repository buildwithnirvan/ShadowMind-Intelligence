from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    DATABASE_URL: str = "mongodb://localhost:27017/shadowmind"
    SECRET_KEY: str = "changethis-super-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_CBT_MODEL: str = "shadowmind-cbt:latest"
    OLLAMA_SUPPORT_MODEL: str = "shadowmind-support:latest"
    OLLAMA_SOLUTION_MODEL: str = "shadowmind-solution:latest"
    OLLAMA_GENERAL_MODEL: str = "llama3.2:latest"
    OLLAMA_CODER_MODEL: str = "qwen2.5-coder:3b"
    OLLAMA_MODEL: str = "shadowmind-cbt:latest"
    OLLAMA_KEEP_ALIVE: str = "60m"
    OLLAMA_TIMEOUT: int = 60
    OLLAMA_NUM_PREDICT: int = 2048
    OLLAMA_NUM_CTX: int = 4096
    MAX_RESPONSE_CHARS: int = 32000
    ANALYTICS_CACHE_TTL_SECONDS: int = 3600
    CORS_ORIGINS: str = '["http://localhost:5173","http://localhost:3000"]'
    # ── AI providers (Local-First Ollama Primary, Offline Fallback) ──
    AI_PRIMARY_PROVIDER: str = "ollama"
    AI_FALLBACK_PROVIDER: str = "offline"
    AI_PROVIDER_ORDER: str = "ollama,offline"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-haiku-4-5-20251001"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    # ── Nearby Healthcare Facilities (OpenStreetMap Overpass & Nominatim) ──
    # No API key required. Uses public OpenStreetMap data.
    OVERPASS_API_URL: str = "https://overpass-api.de/api/interpreter"
    OVERPASS_FALLBACK_URLS: str = '["https://lz4.overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter","https://overpass.private.coffee/api/interpreter"]'
    NOMINATIM_API_URL: str = "https://nominatim.openstreetmap.org/search"
    PLACES_RATE_LIMIT_PER_MINUTE: int = 30
    PLACES_TIMEOUT_SECONDS: float = 12.0
    PLACES_CACHE_TTL_SECONDS: int = 300
    GOOGLE_MAPS_API_KEY: str = ""  # Deprecated / optional, no longer required

    @property
    def overpass_fallback_urls_list(self) -> List[str]:
        try:
            return json.loads(self.OVERPASS_FALLBACK_URLS)
        except Exception:
            return [
                "https://lz4.overpass-api.de/api/interpreter",
                "https://overpass.kumi.systems/api/interpreter",
                "https://overpass.private.coffee/api/interpreter",
            ]

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            return json.loads(self.CORS_ORIGINS)
        except Exception:
            return ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
