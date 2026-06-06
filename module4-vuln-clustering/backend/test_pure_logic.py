"""
Comprehensive test for Vulnerability Clustering Module 4.
Tests all pure-logic services without requiring a database.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.similarity_matcher import similarity_matcher
from services.vul_id_generator import vul_id_generator
from services.union_find import UnionFind


def test_similarity_matcher():
    """Test cosine similarity computation and classification."""
    print("\n=== Test: Similarity Matcher ===")

    # Identical vectors -> similarity ~1.0
    v1 = [1.0, 2.0, 3.0]
    v2 = [1.0, 2.0, 3.0]
    sim = similarity_matcher.cosine_similarity(v1, v2)
    assert abs(sim - 1.0) < 0.001, f"Expected 1.0, got {sim}"
    print(f"  Identical vectors: {sim:.4f} OK")

    # Orthogonal vectors -> 0.0
    v3 = [1.0, 0.0, 0.0]
    v4 = [0.0, 1.0, 0.0]
    sim = similarity_matcher.cosine_similarity(v3, v4)
    assert abs(sim) < 0.001, f"Expected 0.0, got {sim}"
    print(f"  Orthogonal vectors: {sim:.4f} OK")

    # Opposite vectors -> -1.0
    v5 = [1.0, 0.0]
    v6 = [-1.0, 0.0]
    sim = similarity_matcher.cosine_similarity(v5, v6)
    assert abs(sim - (-1.0)) < 0.001, f"Expected -1.0, got {sim}"
    print(f"  Opposite vectors: {sim:.4f} OK")

    # Empty / zero vectors
    assert similarity_matcher.cosine_similarity([], []) == 0.0
    assert similarity_matcher.cosine_similarity([0.0, 0.0], [1.0, 2.0]) == 0.0
    print(f"  Edge cases OK")

    # Classification
    assert similarity_matcher.classify_similarity(0.90) == "high"
    assert similarity_matcher.classify_similarity(0.85) == "high"
    assert similarity_matcher.classify_similarity(0.75) == "uncertain"
    assert similarity_matcher.classify_similarity(0.65) == "uncertain"
    assert similarity_matcher.classify_similarity(0.40) == "low"
    print(f"  Classification OK")

    # Pair computation
    reports = [
        {"report_id": "R001", "title": "Test A"},
        {"report_id": "R002", "title": "Test B"},
        {"report_id": "R003", "title": "Test C"},
    ]
    # R001-R002 similar (0.9), R001-R003 different (0.3), R002-R003 uncertain (0.7)
    embeddings = [
        [1.0, 0.0, 0.0],  # R001
        [0.9, 0.0, 0.1],  # R002 -> cos_sim with R001 ~ 0.995
        [0.0, 1.0, 0.0],  # R003 -> cos_sim with R001 = 0, with R002 ~ 0.11
    ]
    pairs = similarity_matcher.compute_pairs(reports, embeddings)
    assert len(pairs) == 3, f"Expected 3 pairs, got {len(pairs)}"
    print(f"  Pair computation: {len(pairs)} pairs OK")

    uncertain = similarity_matcher.get_uncertain_pairs(pairs)
    high = similarity_matcher.get_high_confidence_pairs(pairs)
    print(f"  High: {len(high)}, Uncertain: {len(uncertain)}")


def test_vul_id_generator():
    """Test VUL-ID generation."""
    print("\n=== Test: VUL-ID Generator ===")

    vid1 = vul_id_generator.generate(12)
    vid2 = vul_id_generator.generate(12)
    vid3 = vul_id_generator.generate(12)
    vid4 = vul_id_generator.generate(99)

    assert vid1 == "TASK-12-VUL-001", f"Expected TASK-12-VUL-001, got {vid1}"
    assert vid2 == "TASK-12-VUL-002", f"Expected TASK-12-VUL-002, got {vid2}"
    assert vid3 == "TASK-12-VUL-003", f"Expected TASK-12-VUL-003, got {vid3}"
    assert vid4 == "TASK-99-VUL-001", f"Expected TASK-99-VUL-001, got {vid4}"
    print(f"  Generation: {vid1}, {vid2}, {vid3}, {vid4} OK")

    # Reset and re-generate
    vul_id_generator.reset_task(12)
    vid5 = vul_id_generator.generate(12)
    assert vid5 == "TASK-12-VUL-001"
    print(f"  Reset OK: {vid5}")

    # Hash generation
    from datetime import datetime, timezone
    h1 = vul_id_generator.generate_cluster_root_hash(
        "TASK-12-VUL-001", ["R001", "R003", "R002"], datetime.now(timezone.utc)
    )
    h2 = vul_id_generator.generate_cluster_root_hash(
        "TASK-12-VUL-001", ["R002", "R001", "R003"], datetime.now(timezone.utc)
    )
    # Same content should produce different hashes if timestamps differ
    # But same timestamp + sorted should be identical
    ts = datetime(2025, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
    h3 = vul_id_generator.generate_cluster_root_hash(
        "TASK-12-VUL-001", ["R001", "R002"], ts
    )
    h4 = vul_id_generator.generate_cluster_root_hash(
        "TASK-12-VUL-001", ["R002", "R001"], ts
    )
    assert h3 == h4, f"Deterministic hash failed: {h3} vs {h4}"
    print(f"  Deterministic hash OK: {h3[:16]}...")


def test_union_find():
    """Test Union-Find data structure for clustering."""
    print("\n=== Test: Union-Find Clustering ===")

    uf = UnionFind()

    # Add reports
    for rid in ["R001", "R002", "R003", "R004", "R005", "R006"]:
        uf.make_set(rid)

    # R001, R002, R003 are same vulnerability (reentrancy)
    uf.union("R001", "R002")
    uf.union("R002", "R003")

    # R004, R005 are same (access control)
    uf.union("R004", "R005")

    # R006 is standalone (integer overflow)

    groups = uf.get_groups()

    # Should have 3 groups
    assert len(groups) == 3, f"Expected 3 groups, got {len(groups)}"
    print(f"  Groups: {len(groups)} OK")

    # Group sizes
    sizes = sorted([len(v) for v in groups.values()])
    assert sizes == [1, 2, 3], f"Expected sizes [1,2,3], got {sizes}"
    print(f"  Group sizes: {sizes} OK")

    # Verify each report is in exactly one group
    all_reports = []
    for members in groups.values():
        all_reports.extend(members)
    assert sorted(all_reports) == ["R001", "R002", "R003", "R004", "R005", "R006"]
    print(f"  All reports accounted for OK")

    # Individual membership
    r1_root = uf.find("R001")
    r2_root = uf.find("R002")
    r3_root = uf.find("R003")
    assert r1_root == r2_root == r3_root
    print(f"  R001-R002-R003 same group OK")

    r4_root = uf.find("R004")
    r5_root = uf.find("R005")
    assert r4_root == r5_root
    assert r4_root != r1_root
    print(f"  R004-R005 different group OK")


def test_similarity_thresholds():
    """Test the threshold logic matching the spec."""
    print("\n=== Test: Threshold Logic ===")

    from config import settings

    # Verify thresholds from .env
    assert settings.high_threshold == 0.85
    assert settings.low_threshold == 0.65
    print(f"  High threshold: {settings.high_threshold} OK")
    print(f"  Low threshold: {settings.low_threshold} OK")

    # Simulate the three-way classification
    test_cases = [
        (0.95, "high"),   # >= 0.85
        (0.85, "high"),   # exactly 0.85
        (0.80, "uncertain"),  # 0.65 <= x < 0.85
        (0.65, "uncertain"),  # exactly 0.65
        (0.50, "low"),    # < 0.65
        (0.00, "low"),
        (1.00, "high"),
    ]

    for score, expected in test_cases:
        result = similarity_matcher.classify_similarity(score)
        status = "OK" if result == expected else f"FAIL (got {result})"
        print(f"    Score {score:.2f} → {expected}: {status}")
        assert result == expected, f"Score {score} expected {expected}, got {result}"


def test_pipeline_without_llm():
    """Test clustering pipeline logic without LLM calls (pure logic verification)."""
    print("\n=== Test: Pipeline Pure Logic ===")

    # Simulate what the pipeline does after LLM returns
    reports = [
        {
            "report_id": "R001",
            "title": "Reentrancy in withdraw()",
            "vulnerability_type": "Reentrancy",
            "affected_function": "withdraw",
            "root_cause": "External call before state update",
            "impact": "Funds drained",
            "severity": "High",
            "submitter": "GPT-4 Agent",
            "commit_time": "2025-01-15T10:00:00Z",
        },
        {
            "report_id": "R002",
            "title": "External call before balance update",
            "vulnerability_type": "Reentrancy",
            "affected_function": "withdraw",
            "root_cause": "External call before state update",
            "impact": "Funds drained",
            "severity": "High",
            "submitter": "Claude Agent",
            "commit_time": "2025-01-15T10:05:00Z",
        },
        {
            "report_id": "R003",
            "title": "Fallback can recursively call withdraw",
            "vulnerability_type": "Reentrancy",
            "affected_function": "withdraw",
            "root_cause": "External call before state update",
            "impact": "Funds drained",
            "severity": "High",
            "submitter": "DeepSeek Agent",
            "commit_time": "2025-01-15T10:30:00Z",
        },
        {
            "report_id": "R004",
            "title": "Access control missing on setOwner()",
            "vulnerability_type": "Access Control",
            "affected_function": "setOwner",
            "root_cause": "Missing onlyOwner modifier",
            "impact": "Contract takeover",
            "severity": "Critical",
            "submitter": "GPT-4 Agent",
            "commit_time": "2025-01-15T11:00:00Z",
        },
    ]

    # Simulate high-similarity pairs: R001-R002 (same), R001-R003 (same), R002-R003 (same)
    # Simulate that R004 is different from all
    uf = UnionFind()
    for r in reports:
        uf.make_set(r["report_id"])

    # Same vulnerability pairs
    uf.union("R001", "R002")
    uf.union("R002", "R003")

    groups = uf.get_groups()
    assert len(groups) == 2, f"Expected 2 groups, got {len(groups)}"

    # Group 1: R001, R002, R003 (reentrancy)
    # Group 2: R004 (access control)
    group_sizes = sorted([len(v) for v in groups.values()])
    assert group_sizes == [1, 3], f"Expected sizes [1, 3], got {group_sizes}"

    print(f"  4 reports → {len(groups)} clusters OK (1 reentrancy group + 1 access control)")
    print(f"  Group sizes: {group_sizes} OK")

    # Verify reward ranking by commit_time
    report_map = {r["report_id"]: r for r in reports}
    for members in groups.values():
        if len(members) == 3:
            sorted_members = sorted(
                [report_map[rid] for rid in members],
                key=lambda x: x["commit_time"],
            )
            assert sorted_members[0]["report_id"] == "R001"  # First = 70%
            assert sorted_members[1]["report_id"] == "R002"  # Second = 20%
            assert sorted_members[2]["report_id"] == "R003"  # Third = 10%
            print(f"  Reward ranking OK: {[m['report_id'] for m in sorted_members]}")


if __name__ == "__main__":
    print("=" * 60)
    print("Vulnerability Clustering Module 4 - Logic Tests")
    print("=" * 60)

    test_similarity_matcher()
    test_vul_id_generator()
    test_union_find()
    test_similarity_thresholds()
    test_pipeline_without_llm()

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED")
    print("=" * 60)
