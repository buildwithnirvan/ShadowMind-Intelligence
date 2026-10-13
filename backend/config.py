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
    OLLAMA_CODER_MODEL: str = "shadowmind-solution:latest"
    OLLAMA_MODEL: str = "shadowmind-cbt:latest"
    OLLAMA_KEEP_ALIVE: str = "60m"
    OLLAMA_TIMEOUT: int = 60
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
