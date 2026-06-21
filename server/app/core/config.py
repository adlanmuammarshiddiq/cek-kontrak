from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # App
    app_name: str = "Check Kontrak"
    app_version: str = "1.0.0"
    debug: bool = False

    # OpenAI
    openai_api_key: str
    openai_model: str = "gpt-4o"

    # LlamaParse
    llamaparse_api_key: str

    # Database paths
    kuzu_db_path: str = "./data/kuzu.db"
    chroma_db_path: str = "./data/chroma"

    # Rate limiting
    rate_limit_requests: int = 10
    rate_limit_window_minutes: int = 60

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    # Data directory
    data_dir: str = "./data"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
