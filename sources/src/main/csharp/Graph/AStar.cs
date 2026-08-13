namespace Ssw.Archive.Graph;

/// <summary>Computes a deterministic directed shortest path using nonnegative weights and injected heuristics.</summary>
/// <remarks>
/// Vertex IDs are ordered unique strings; source, target, edge endpoints, and heuristic entries are declared.
/// Weights and finite heuristic values are nonnegative. Equal f scores choose vertex input order. Because admissible
/// or consistent heuristics are not required, improved vertices are reopened and processing continues after target.
/// Unreachable target returns an empty path and null cost. Inputs are not mutated.
/// 각 후보를 실제 누적 비용 g와 휴리스틱 h의 합으로 선택하면서 더 짧은 경로가 발견되면 정점을 다시 열어요.
/// 거리 표는 지금까지 발견한 최솟값을 유지하고 predecessor 표는 그 거리를 만든 경로를 복원해요.
/// 같은 f 값은 정점 입력 순서로 결정하며 음수·비유한 비용이나 누락된 정점·휴리스틱은 탐색 전에 거부해요.
/// 배열 기반 후보 선택을 쓰므로 시간 복잡도는 O(V² + E), 공간 복잡도는 O(V + E)예요.
/// </remarks>
public static class AStar {
    /// <summary>Represents one directed nonnegative weighted edge.</summary>
    public sealed record Edge(string From, string To, double Weight);
    /// <summary>Represents one vertex heuristic.</summary>
    public sealed record Heuristic(string Vertex, double Value);
    /// <summary>Contains selected path and nullable total cost.</summary>
    public sealed record Result(IReadOnlyList<string> Path, double? Cost);

    /// <summary>Computes a shortest source-to-target path.</summary>
    public static Result Execute(
        IReadOnlyList<string> vertices,
        IReadOnlyList<Edge> edges,
        string source,
        string target,
        IReadOnlyList<Heuristic> heuristics) {
        ArgumentNullException.ThrowIfNull(vertices);
        ArgumentNullException.ThrowIfNull(edges);
        ArgumentNullException.ThrowIfNull(heuristics);
        var vertexSet = new HashSet<string>(StringComparer.Ordinal);
        foreach (var vertex in vertices) {
            ArgumentNullException.ThrowIfNull(vertex);
            if (!vertexSet.Add(vertex)) throw new ArgumentException("Vertex IDs must be unique.", nameof(vertices));
        }
        if (!vertexSet.Contains(source)) throw new ArgumentException("Source is not declared.", nameof(source));
        if (!vertexSet.Contains(target)) throw new ArgumentException("Target is not declared.", nameof(target));
        foreach (var edge in edges) {
            ArgumentNullException.ThrowIfNull(edge);
            if (!double.IsFinite(edge.Weight) || edge.Weight < 0 ||
                !vertexSet.Contains(edge.From) || !vertexSet.Contains(edge.To)) {
                throw new ArgumentException("Invalid weighted edge.", nameof(edges));
            }
        }
        var heuristic = heuristics.ToDictionary(item => item.Vertex, item => item.Value, StringComparer.Ordinal);
        foreach (var vertex in vertices) {
            if (!heuristic.TryGetValue(vertex, out var value) || !double.IsFinite(value) || value < 0) {
                throw new ArgumentException("A nonnegative finite heuristic is required for every vertex.", nameof(heuristics));
            }
        }
        var costs = vertices.ToDictionary(vertex => vertex, _ => (double?)null, StringComparer.Ordinal);
        costs[source] = 0;
        var predecessor = new Dictionary<string, string>(StringComparer.Ordinal);
        var open = new HashSet<string>(StringComparer.Ordinal) { source };
        while (open.Count > 0) {
            string? current = null;
            var currentScore = 0.0;
            foreach (var vertex in vertices) {
                if (!open.Contains(vertex)) continue;
                var score = costs[vertex]!.Value + heuristic[vertex];
                if (current is null || score < currentScore) {
                    current = vertex;
                    currentScore = score;
                }
            }
            open.Remove(current!);
            foreach (var edge in edges) {
                if (edge.From != current) continue;
                var candidate = costs[current!]!.Value + edge.Weight;
                var known = costs[edge.To];
                if (known is null || candidate < known) {
                    costs[edge.To] = candidate;
                    predecessor[edge.To] = current!;
                    open.Add(edge.To);
                }
            }
        }
        if (costs[target] is null) return new Result(Array.Empty<string>(), null);
        var path = new List<string>();
        for (string? cursor = target; cursor is not null;) {
            path.Add(cursor);
            cursor = predecessor.TryGetValue(cursor, out var previous) ? previous : null;
        }
        path.Reverse();
        return new Result(path, costs[target]);
    }
}
