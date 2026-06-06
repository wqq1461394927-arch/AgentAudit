"""
Similarity Matcher - Computes cosine similarity between report embeddings
to identify potentially related vulnerabilities.
"""
import math

try:
    from ..config import settings
except ImportError:
    from config import settings


class SimilarityMatcher:
    """Matches reports based on cosine similarity of embeddings."""

    def __init__(self):
        self.high_threshold = settings.high_threshold
        self.low_threshold = settings.low_threshold

    @staticmethod
    def cosine_similarity(a: list[float], b: list[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if not a or not b:
            return 0.0

        dot_product = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return dot_product / (norm_a * norm_b)

    def classify_similarity(self, score: float) -> str:
        """Classify similarity score.

        Returns:
            'high' - Likely same vulnerability (>= high_threshold)
            'uncertain' - Needs LLM judge (between low and high)
            'low' - Likely different vulnerabilities (< low_threshold)
        """
        if score >= self.high_threshold:
            return "high"
        elif score >= self.low_threshold:
            return "uncertain"
        else:
            return "low"

    def compute_pairs(
        self, reports: list[dict], embeddings: list[list[float]]
    ) -> list[dict]:
        """Compute similarity between all pairs of reports.

        Args:
            reports: List of report dicts (must have 'report_id').
            embeddings: List of embedding vectors in same order.

        Returns:
            List of dicts with report_a_id, report_b_id, cosine_similarity, classification.
        """
        n = len(reports)
        pairs = []

        for i in range(n):
            for j in range(i + 1, n):
                score = self.cosine_similarity(embeddings[i], embeddings[j])
                pairs.append(
                    {
                        "report_a_id": reports[i]["report_id"],
                        "report_b_id": reports[j]["report_id"],
                        "cosine_similarity": round(score, 4),
                        "classification": self.classify_similarity(score),
                        "report_a": reports[i],
                        "report_b": reports[j],
                    }
                )

        return pairs

    def get_uncertain_pairs(self, pairs: list[dict]) -> list[dict]:
        """Filter pairs that need LLM judge review."""
        return [p for p in pairs if p["classification"] == "uncertain"]

    def get_high_confidence_pairs(self, pairs: list[dict]) -> list[dict]:
        """Filter pairs with high similarity (same vulnerability)."""
        return [p for p in pairs if p["classification"] == "high"]


similarity_matcher = SimilarityMatcher()
