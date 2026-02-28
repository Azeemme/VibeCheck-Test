from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# .env at API Project root (parent of vibecheck/) or in CWD
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[str(_env_path), ".env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "sqlite+aiosqlite:///./vibecheck.db"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    SUPERMEMORY_API_KEY: str = ""
    SUPERMEMORY_BASE_URL: str = "https://api.supermemory.ai"
    SUPERMEMORY_TIMEOUT_SECONDS: float = 10.0
    CLONE_DIR: str = "/tmp/vibecheck-repos"
    DEBUG: bool = False


settings = Settings()
