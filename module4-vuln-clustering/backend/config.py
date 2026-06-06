"""Configuration for Vulnerability Clustering Module."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    llm_base_url: str = "https://api.deepseek.com"
    embedding_base_url: str = "https://api.openai.com/v1"
    openai_embedding_model: str = "text-embedding-3-small"
    llm_judge_model: str = "deepseek-chat"

    supabase_url: str = ""
    supabase_service_key: str = ""

    database_url: str = ""

    host: str = "0.0.0.0"
    port: int = 8000

    dispute_window_hours: int = 24
    similarity_high_threshold: float = 0.85
    similarity_low_threshold: float = 0.65

    @property
    def high_threshold(self) -> float:
        return self.similarity_high_threshold

    @property
    def low_threshold(self) -> float:
        return self.similarity_low_threshold

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
