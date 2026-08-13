package com.ssw.archive.graph;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Deterministic directed shortest path with injected heuristics (reopen allowed). */
/**
 * 시작점에서 목표점까지의 실제 누적 비용과 휴리스틱 추정치를 합쳐 유망한 정점을 먼저 확정하는 A* 탐색이다.
 * 각 정점의 최선 거리와 이전 정점을 유지하며, 완화가 성공할 때만 경로 증거를 갱신한다.
 * 같은 f 점수에서는 정점 입력 순서를 우선해 동일 입력의 경로 선택이 실행 환경에 따라 달라지지 않게 한다.
 * 선언되지 않은 정점·간선과 음수 가중치·휴리스틱은 탐색 전에 오류로 처리하고 입력 컬렉션은 변경하지 않는다.
 * 배열 기반 최소 선택을 사용하는 이 구현의 시간 복잡도는 O(V^2 + E), 공간 복잡도는 O(V + E)이다.
 */
public final class AStar {
    private AStar() { }

    public record Edge(String from, String to, double weight) { }

    public record Result(List<String> path, Double cost) { }

    public static Result execute(
            List<String> vertices,
            List<Edge> edges,
            String source,
            String target,
            Map<String, Double> heuristics) {
        Objects.requireNonNull(vertices, "vertices");
        Objects.requireNonNull(edges, "edges");
        Objects.requireNonNull(source, "source");
        Objects.requireNonNull(target, "target");
        Objects.requireNonNull(heuristics, "heuristics");
        Set<String> vertexSet = new LinkedHashSet<>();
        for (String vertex : vertices) {
            Objects.requireNonNull(vertex, "vertex");
            if (!vertexSet.add(vertex)) {
                throw new IllegalArgumentException("Vertex IDs must be unique.");
            }
        }
        if (!vertexSet.contains(source)) {
            throw new IllegalArgumentException("Source is not declared.");
        }
        if (!vertexSet.contains(target)) {
            throw new IllegalArgumentException("Target is not declared.");
        }
        for (Edge edge : edges) {
            Objects.requireNonNull(edge, "edge");
            if (!Double.isFinite(edge.weight) || edge.weight < 0
                    || !vertexSet.contains(edge.from) || !vertexSet.contains(edge.to)) {
                throw new IllegalArgumentException("Invalid weighted edge.");
            }
        }
        for (String vertex : vertices) {
            Double value = heuristics.get(vertex);
            if (value == null || !Double.isFinite(value) || value < 0) {
                throw new IllegalArgumentException("Invalid heuristic.");
            }
        }
        Map<String, Double> costs = new LinkedHashMap<>();
        Map<String, String> predecessor = new LinkedHashMap<>();
        for (String vertex : vertices) {
            costs.put(vertex, null);
        }
        costs.put(source, 0.0);
        Set<String> open = new LinkedHashSet<>();
        open.add(source);
        while (!open.isEmpty()) {
            String current = null;
            double currentScore = 0;
            for (String vertex : vertices) {
                if (!open.contains(vertex)) {
                    continue;
                }
                double score = costs.get(vertex) + heuristics.get(vertex);
                if (current == null || score < currentScore) {
                    current = vertex;
                    currentScore = score;
                }
            }
            open.remove(current);
            for (Edge edge : edges) {
                if (!current.equals(edge.from)) {
                    continue;
                }
                double candidate = costs.get(current) + edge.weight;
                Double known = costs.get(edge.to);
                if (known == null || candidate < known) {
                    costs.put(edge.to, candidate);
                    predecessor.put(edge.to, current);
                    open.add(edge.to);
                }
            }
        }
        if (costs.get(target) == null) {
            return new Result(List.of(), null);
        }
        List<String> reversePath = new ArrayList<>();
        for (String vertex = target; vertex != null; vertex = predecessor.get(vertex)) {
            reversePath.add(vertex);
        }
        List<String> path = new ArrayList<>(reversePath.size());
        for (int index = reversePath.size() - 1; index >= 0; index--) {
            path.add(reversePath.get(index));
        }
        return new Result(path, costs.get(target));
    }
}
