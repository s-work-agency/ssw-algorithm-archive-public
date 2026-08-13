namespace Ssw.Archive.Graph;

/// <summary>Traverses the source-reachable directed graph in depth-first preorder.</summary>
/// <remarks>
/// Vertex IDs are ordered unique strings, source and every edge endpoint are declared, and outgoing neighbors follow
/// edge input order. The iterative frame stack exactly models recursive preorder while supporting deep graphs;
/// unreachable vertices are omitted. Inputs are not mutated.
/// source에서 시작해 현재 정점의 첫 미방문 이웃을 끝까지 따라간 뒤 stack을 되감아 다른 branch를 탐색해요.
/// 정점은 stack에 넣을 때 방문 처리되어 preorder 결과에 정확히 한 번만 등장하는 불변식을 유지해요.
/// 인접 간선 입력 순서가 branch 선택을 결정하며 중복 ID·누락 endpoint·source 오류는 탐색 전에 거부해요.
/// 시간 복잡도는 O(V + E), 방문 집합과 frame stack 공간 복잡도는 O(V)예요.
/// </remarks>
public static class DepthFirstSearch {
    /// <summary>Represents one directed edge.</summary>
    public sealed record Edge(string From, string To);

    /// <summary>Returns source-reachable vertices in deterministic depth-first preorder.</summary>
    public static IReadOnlyList<string> Execute(
        IReadOnlyList<string> vertices,
        IReadOnlyList<Edge> edges,
        string source) {
        ArgumentNullException.ThrowIfNull(vertices);
        ArgumentNullException.ThrowIfNull(edges);
        var adjacency = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (var vertex in vertices) {
            ArgumentNullException.ThrowIfNull(vertex);
            if (!adjacency.TryAdd(vertex, [])) throw new ArgumentException("Vertex IDs must be unique.", nameof(vertices));
        }
        foreach (var edge in edges) {
            ArgumentNullException.ThrowIfNull(edge);
            if (!adjacency.ContainsKey(edge.From) || !adjacency.ContainsKey(edge.To)) {
                throw new ArgumentException("Edge endpoint is not declared.", nameof(edges));
            }
            adjacency[edge.From].Add(edge.To);
        }
        ArgumentNullException.ThrowIfNull(source);
        if (!adjacency.ContainsKey(source)) throw new ArgumentException("Source is not declared.", nameof(source));
        var visited = new HashSet<string>(StringComparer.Ordinal) { source };
        var order = new List<string> { source };
        var stack = new List<Frame> { new(source) };
        while (stack.Count > 0) {
            var frame = stack[^1];
            var neighbors = adjacency[frame.Vertex];
            if (frame.Next >= neighbors.Count) {
                stack.RemoveAt(stack.Count - 1);
                continue;
            }
            var next = neighbors[frame.Next++];
            if (!visited.Add(next)) continue;
            order.Add(next);
            stack.Add(new Frame(next));
        }
        return order;
    }

    private sealed class Frame(string vertex) {
        internal string Vertex { get; } = vertex;
        internal int Next { get; set; }
    }
}
