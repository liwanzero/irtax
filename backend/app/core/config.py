from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"

    database_url: str

    redis_url: str = "redis://redis:6379/0"

    jwt_secret: str
    jwt_cookie_name: str = "irtax_session"
    jwt_expire_minutes: int = 10080
    anon_cookie_name: str = "irtax_anon"

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"

    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""

    storage_dir: str = "/data/storage"
    file_retention_hours: int = 24

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    @property
    def stripe_enabled(self) -> bool:
        return bool(self.stripe_secret_key)


settings = Settings()
