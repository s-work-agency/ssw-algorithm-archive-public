package com.ssw.archive.graph;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Traverses the source-reachable directed graph in breadth-first order. */
/**
 * 시작 정점에서 간선 수가 적은 층부터 FIFO 큐로 확장하는 너비 우선 탐색이다.
 * 정점은 처음 발견한 순간 방문 처리해 큐에 한 번만 들어가며, 기록된 거리는 시작점에서의 최단 간선 수이다.
 * 인접 정점을 간선 입력 순서대로 확인하므로 같은 깊이의 방문 순서와 부모 선택이 결정적으로 고정된다.
 * 시작점과 모든 간선 끝점이 선언되었는지 먼저 검사하고 입력 그래프는 탐색 중 변경하지 않는다.
 * 시간 복잡도는 O(V + E), 큐·방문·거리 저장 공간은 O(V)이다.
 */
public final class BreadthFirstSearch {
    private BreadthFirstSearch() { }

    public record Edge(String from, String to) { }

    /** Returns source-reachable vertices in deterministic breadth-first order. */
    public static List<String> execute(List<String> vertices, List<Edge> edges, String source) {
        Map<String, List<String>> adjacency = buildAdjacency(vertices, edges);
        Objects.requireNonNull(source, "source");
        if (!adjacency.containsKey(source)) {
            throw new IllegalArgumentException("Source is not declared.");
        }
        Set<String> visited = new LinkedHashSet<>();
        visited.add(source);
        List<String> queue = new ArrayList<>();
        queue.add(source);
        for (int cursor = 0; cursor < queue.size(); cursor++) {
            for (String next : adjacency.get(queue.get(cursor))) {
                if (visited.add(next)) {
                    queue.add(next);
                }
            }
        }
        return queue;
    }

    private static Map<String, List<String>> buildAdjacency(List<String> vertices, List<Edge> edges) {
        Objects.requireNonNull(vertices, "vertices");
        Objects.requireNonNull(edges, "edges");
        Map<String, List<String>> adjacency = new LinkedHashMap<>();
        for (String vertex : vertices) {
            Objects.requireNonNull(vertex, "vertex");
            if (adjacency.put(vertex, new ArrayList<>()) != null) {
                throw new IllegalArgumentException("Vertex IDs must be unique.");
            }
        }
        for (Edge edge : edges) {
            Objects.requireNonNull(edge, "edge");
            if (!adjacency.containsKey(edge.from) || !adjacency.containsKey(edge.to)) {
                throw new IllegalArgumentException("Edge endpoint is not declared.");
            }
            adjacency.get(edge.from).add(edge.to);
        }
        return adjacency;
    }
}
