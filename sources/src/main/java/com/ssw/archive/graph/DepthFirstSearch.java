package com.ssw.archive.graph;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Traverses the source-reachable directed graph in depth-first order. */
/**
 * 시작 정점에서 한 경로를 끝까지 따라간 뒤 되돌아오며 도달 가능한 정점을 방문하는 깊이 우선 탐색이다.
 * 정점은 처음 발견한 순간 방문 집합에 넣어 각 정점과 간선을 유한 번만 처리하고 사이클의 재진입을 막는다.
 * 각 정점의 outgoing 간선을 입력 순서대로 따라가므로 같은 그래프의 방문 순서와 탐색 트리가 결정적으로 고정된다.
 * 시작점과 모든 간선 끝점이 선언되었는지 먼저 확인하며 입력 정점·간선 컬렉션은 변경하지 않는다.
 * 시간 복잡도는 O(V+E), 방문 집합과 재귀 또는 스택을 위한 공간 복잡도는 O(V)이다.
 */
public final class DepthFirstSearch {
    private DepthFirstSearch() { }

    public record Edge(String from, String to) { }

    /** Returns source-reachable vertices in deterministic depth-first order. */
    public static List<String> execute(List<String> vertices, List<Edge> edges, String source) {
        Map<String, List<String>> adjacency = buildAdjacency(vertices, edges);
        Objects.requireNonNull(source, "source");
        if (!adjacency.containsKey(source)) {
            throw new IllegalArgumentException("Source is not declared.");
        }
        Set<String> visited = new LinkedHashSet<>();
        List<String> order = new ArrayList<>();
        visit(source, adjacency, visited, order);
        return order;
    }

    private static void visit(
            String vertex,
            Map<String, List<String>> adjacency,
            Set<String> visited,
            List<String> order) {
        if (!visited.add(vertex)) {
            return;
        }
        order.add(vertex);
        for (String next : adjacency.get(vertex)) {
            visit(next, adjacency, visited, order);
        }
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
