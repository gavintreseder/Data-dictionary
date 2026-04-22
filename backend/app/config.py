from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Data Dictionary"
    environment: str = "development"
    database_url: str = "sqlite+aiosqlite:///./data/dictionary.db"
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080",
    ]
    static_dir: str = "app/static"
    seed_on_startup: bool = True

    # LLM config — gracefully disabled if none are set
    ollama_url: Optional[str] = None
    ollama_model: str = "llama3.2:3b"
    hf_api_token: Optional[str] = None
    hf_model: str = "mistralai/Mistral-7B-Instruct-v0.3"
    hf_provider: str = "hf-inference"  # hf-inference | together | fireworks-ai | ...
    groq_api_key: Optional[str] = None
    groq_model: str = "llama-3.1-8b-instant"
    llm_timeout: float = 30.0

    # Lookup / cache
    lookup_cache_ttl: int = 60 * 60 * 12  # 12h
    lookup_source_timeout: float = 6.0

    # PDF import
    pdf_max_bytes: int = 10 * 1024 * 1024  # 10 MiB


settings = Settings()


def ensure_sqlite_dir() -> None:
    url = settings.database_url
    if url.startswith("sqlite"):
        path_part = url.split("///", 1)[-1]
        db_path = Path(path_part)
        db_path.parent.mkdir(parents=True, exist_ok=True)


def llm_enabled() -> bool:
    return bool(
        settings.ollama_url or settings.hf_api_token or settings.groq_api_key
    )
