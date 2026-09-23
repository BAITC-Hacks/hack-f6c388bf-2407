from pathlib import Path

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve from source location, not the shell's current directory.
ROOT_ENV = Path(__file__).resolve().parents[5] / ".env"


class AISettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_ENV, env_file_encoding="utf-8-sig", extra="ignore"
    )

    ai_provider: str = "none"
    openai_api_key: SecretStr | None = None
    openai_model: str = ""
    ai_timeout_seconds: float = Field(default=15, gt=0, le=120)
    ai_max_output_tokens: int = Field(default=1600, ge=256, le=10000)
    ai_cache_ttl_seconds: float = Field(default=300, ge=0, le=3600)

    @property
    def enabled(self) -> bool:
        key = self.openai_api_key.get_secret_value().strip() if self.openai_api_key else ""
        return (
            self.ai_provider.lower() == "openai"
            and bool(self.openai_model.strip())
            and bool(key)
            and key != "your_openai_api_key"
        )
