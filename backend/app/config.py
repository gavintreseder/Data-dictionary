from pathlib import Path

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


settings = Settings()


def ensure_sqlite_dir() -> None:
    url = settings.database_url
    if url.startswith("sqlite"):
        # e.g. sqlite+aiosqlite:///./data/dictionary.db → ./data
        path_part = url.split("///", 1)[-1]
        db_path = Path(path_part)
        db_path.parent.mkdir(parents=True, exist_ok=True)
