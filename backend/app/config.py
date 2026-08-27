"""App configuration, loaded from environment variables / .env file."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/carpoolcampus"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days, fine for an MVP demo
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def normalized_database_url(self) -> str:
        # Hosted Postgres providers (Render, Heroku, ...) hand out
        # "postgres://" connection strings; SQLAlchemy 1.4+ only accepts
        # "postgresql://". Rewrite it rather than requiring every host's
        # env var to already use the SQLAlchemy-flavored scheme.
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql+psycopg2://" + url[len("postgres://"):]
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
