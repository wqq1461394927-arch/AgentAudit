"""Union-Find data structure for clustering reports."""


class UnionFind:
    """Union-Find data structure for clustering reports."""

    def __init__(self):
        self.parent: dict[str, str] = {}
        self.rank: dict[str, int] = {}

    def make_set(self, x: str):
        if x not in self.parent:
            self.parent[x] = x
            self.rank[x] = 0

    def find(self, x: str) -> str:
        if self.parent.get(x, x) != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent.get(x, x)

    def union(self, x: str, y: str):
        px, py = self.find(x), self.find(y)
        if px == py:
            return
        if self.rank.get(px, 0) < self.rank.get(py, 0):
            self.parent[px] = py
        elif self.rank.get(px, 0) > self.rank.get(py, 0):
            self.parent[py] = px
        else:
            self.parent[py] = px
            self.rank[px] = self.rank.get(px, 0) + 1

    def get_groups(self) -> dict[str, list[str]]:
        """Get all groups: root -> [members]."""
        groups: dict[str, list[str]] = {}
        for node in self.parent:
            root = self.find(node)
            groups.setdefault(root, []).append(node)
        return groups
