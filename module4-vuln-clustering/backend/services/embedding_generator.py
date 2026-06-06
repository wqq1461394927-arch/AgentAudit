"""
Embedding Generator - Converts vulnerability reports into semantic embeddings
using OpenAI's text-embedding-3-small model.
"""
from openai import AsyncOpenAI

try:
    from ..config import settings
except ImportError:
    from config import settings


class EmbeddingGenerator:
    """Generates semantic embeddings for vulnerability reports via OpenAI API."""

    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.embedding_base_url,
        )
        self.model = settings.openai_embedding_model

    def build_embedding_text(self, report: dict) -> str:
        """Build a combined text representation from report fields."""
        parts = [
            f"Title: {report.get('title', '')}",
            f"Type: {report.get('vulnerability_type', '')}",
            f"Function: {report.get('affected_function', '')}",
            f"Root Cause: {report.get('root_cause', '')}",
            f"Attack Path: {report.get('attack_path', '')}",
            f"Impact: {report.get('impact', '')}",
            f"Fix: {report.get('fix_suggestion', '')}",
        ]
        return "\n".join(parts)

    async def generate_batch(self, reports: list[dict]) -> list[list[float]]:
        """Generate semantic embeddings for a batch of reports.

        Sends all texts to the OpenAI Embeddings API in a single call,
        returning dense semantic vectors that capture meaning not just keywords.
        """
        texts = [self.build_embedding_text(r) for r in reports]

        response = await self.client.embeddings.create(
            model=self.model,
            input=texts,
        )

        # Sort by index to preserve input order
        sorted_data = sorted(response.data, key=lambda d: d.index)
        return [d.embedding for d in sorted_data]


embedding_generator = EmbeddingGenerator()
