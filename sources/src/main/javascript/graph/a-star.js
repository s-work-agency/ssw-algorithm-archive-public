"use strict";

/**
 * 실제 거리와 주입된 휴리스틱의 합이 가장 작은 정점을 반복 선택해 최단 경로 후보를 완화해요.
 * 거리·부모 배열과 재개방 가능한 방문 상태를 유지해 휴리스틱이 비일관적이어도 더 나은 경로를 반영해요.
 * 동률은 정점 입력 순서로 결정하며, 정점·간선·가중치·휴리스틱 경계를 검증한 뒤 입력을 바꾸지 않아요.
 * 정점 수를 V, 간선 수를 E라 할 때 시간은 O(V^2 + E), 공간은 O(V + E)예요.
 */
/**
 * A* shortest path with nonnegative weights and injected finite heuristics.
 * Domain public API for `a-star`. JSON contract adapters live in bundles/runner.
 *
 * Heuristics need not be admissible or consistent: improved vertices are reopened
 * and processing continues after the target. Equal f-scores follow vertex input order.
 *
 * @param {ReadonlyArray<string>} vertices Unique ordered vertex IDs
 * @param {ReadonlyArray<{from: string, to: string, weight: number}>} edges
 * @param {string} source
 * @param {string} target
 * @param {Readonly<Record<string, number>>} heuristic Nonnegative finite value per vertex
 * @returns {{path: string[], cost: number|null}}
 */
function execute(vertices, edges, source, target, heuristic) {
  if (!Array.isArray(vertices)) {
    const error = new Error("vertices must be an array");
    error.code = "INVALID_INPUT";
    throw error;
  }
  const vertexSet = new Set();
  for (const vertex of vertices) {
    if (typeof vertex !== "string" || vertexSet.has(vertex)) {
      const error = new Error("vertex IDs must be unique strings");
      error.code = "INVALID_INPUT";
      throw error;
    }
    vertexSet.add(vertex);
  }
  if (typeof source !== "string" || !vertexSet.has(source)) {
    const error = new Error("source must be one of vertices");
    error.code = "INVALID_SOURCE";
    throw error;
  }
  if (typeof target !== "string" || !vertexSet.has(target)) {
    const error = new Error("target must be one of vertices");
    error.code = "INVALID_TARGET";
    throw error;
  }
  if (!Array.isArray(edges)) {
    const error = new Error("edges must be an array");
    error.code = "INVALID_EDGE";
    throw error;
  }
  for (const edge of edges) {
    if (
      !edge
      || typeof edge.from !== "string"
      || typeof edge.to !== "string"
      || !vertexSet.has(edge.from)
      || !vertexSet.has(edge.to)
      || typeof edge.weight !== "number"
      || !Number.isFinite(edge.weight)
    ) {
      const error = new Error("edge weight must be a finite number");
      error.code = "INVALID_EDGE";
      throw error;
    }
    if (edge.weight < 0) {
      const error = new Error("A* does not accept negative edge weights");
      error.code = "NEGATIVE_WEIGHT";
      throw error;
    }
  }
  if (!heuristic || typeof heuristic !== "object" || Array.isArray(heuristic)) {
    const error = new Error("heuristic must map every vertex to a finite non-negative number");
    error.code = "INVALID_HEURISTIC";
    throw error;
  }
  for (const vertex of vertices) {
    const value = heuristic[vertex];
    if (
      !Object.prototype.hasOwnProperty.call(heuristic, vertex)
      || typeof value !== "number"
      || !Number.isFinite(value)
      || value < 0
    ) {
      const error = new Error("heuristic must map every vertex to a finite non-negative number");
      error.code = "INVALID_HEURISTIC";
      throw error;
    }
  }

  /** @type {Record<string, number|null>} */
  const costs = Object.fromEntries(vertices.map(vertex => [vertex, null]));
  /** @type {Record<string, string>} */
  const predecessors = Object.create(null);
  const open = new Set([source]);
  costs[source] = 0;

  while (open.size > 0) {
    let current = null;
    for (const vertex of vertices) {
      if (!open.has(vertex)) continue;
      if (
        current === null
        || costs[vertex] + heuristic[vertex] < costs[current] + heuristic[current]
      ) {
        current = vertex;
      }
    }
    open.delete(current);
    for (const edge of edges) {
      if (edge.from !== current) continue;
      const candidate = costs[current] + edge.weight;
      if (costs[edge.to] === null || candidate < costs[edge.to]) {
        costs[edge.to] = candidate;
        predecessors[edge.to] = current;
        open.add(edge.to);
      }
    }
  }

  if (costs[target] === null) return { path: [], cost: null };
  const path = [];
  for (let vertex = target; vertex !== undefined; vertex = predecessors[vertex]) {
    path.push(vertex);
  }
  path.reverse();
  return { path, cost: costs[target] };
}

module.exports = { execute };
