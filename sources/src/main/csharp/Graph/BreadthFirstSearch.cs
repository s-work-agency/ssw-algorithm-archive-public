namespace Ssw.Archive.Graph;

/// <summary>Traverses the source-reachable directed graph in breadth-first order.</summary>
/// <remarks>
/// Vertex IDs are ordered unique strings, source and every edge endpoint are declared, and outgoing neighbors follow
/// edge input order. A vertex is emitted once when first reached; unreachable vertices are omitted. Inputs are not
/// mutated.
/// source를 queue에 넣고 현재 정점의 미방문 이웃을 차례로 enqueue해 간선 수 기준의 층을 넓혀 가요.
/// 정점은 enqueue 순간 방문 표시되어 정확히 한 번만 결과와 queue에 들어가는 불변식을 유지해요.
/// 이웃은 간선 입력 순서를 따르므로 출력이 결정적이며 선언되지 않은 정점·중복 ID는 탐색 전에 거부해요.
/// 시간 복잡도는 O(V + E), 인접 목록과 방문·queue 공간은 O(V + E)예요.
/// </remarks>
public static class BreadthFirstSearch {
    /// <summary>Represents one directed edge.</summary>
    public sealed record Edge(string From, string To);

    /// <summary>Returns source-reachable vertices in deterministic breadth-first order.</summary>
    public static IReadOnlyList<string> Execute(
        IReadOnlyList<string> vertices,
        IReadOnlyList<Edge> edges,
        string source) {
        var adjacency = BuildAdjacency(vertices, edges);
        ArgumentNullException.ThrowIfNull(source);
        if (!adjacency.ContainsKey(source)) throw new ArgumentException("Source is not declared.", nameof(source));
        var visited = new HashSet<string>(StringComparer.Ordinal) { source };
        var queue = new List<string> { source };
        for (var cursor = 0; cursor < queue.Count; cursor++) {
            foreach (var next in adjacency[queue[cursor]]) if (visited.Add(next)) queue.Add(next);
        }
        return queue;
    }

    private static Dictionary<string, List<string>> BuildAdjacency(
        IReadOnlyList<string> vertices,
        IReadOnlyList<Edge> edges) {
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
        return adjacency;
    }
}
