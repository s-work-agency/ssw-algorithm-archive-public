"use strict";

/**
 * 시작 정점에서 큐로 거리를 한 층씩 넓혀 방향 그래프의 도달 정점을 너비 우선으로 방문해요.
 * 정점은 처음 발견될 때 한 번만 큐에 넣어 각 방문 기록이 최단 간선 수 층에 속하도록 유지해요.
 * 선언된 정점 순서로 인접 정점을 처리하며 중복 정점·잘못된 끝점·시작점 오류를 순회 전에 거부해요.
 * 정점 수 V와 간선 수 E에 대해 시간은 O(V + E), 추가 공간은 O(V)예요.
 */
/**
 * @param {string} code
 * @param {string} [message]
 * @returns {never}
 */
function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

/**
 * Breadth-first traversal order from a declared source on a directed graph.
 *
 * Domain public API for `breadth-first-search`. JSON contract adapters live in the runner.
 * Vertex IDs are ordered unique strings, source and every edge endpoint are declared, and
 * outgoing neighbors follow edge input order. A vertex is emitted once when first reached;
 * unreachable vertices are omitted. Inputs are not mutated.
 *
 * @param {readonly string[]} vertices
 * @param {readonly {from: string, to: string}[]} edges
 * @param {string} source
 * @returns {string[]}
 */
function execute(vertices, edges, source) {
  if (!Array.isArray(vertices) || vertices.some(vertex => typeof vertex !== "string")) {
    fail("INVALID_INPUT", "vertices must be an array of strings");
  }
  /** @type {Map<string, string[]>} */
  const adjacency = new Map();
  for (const vertex of vertices) {
    if (adjacency.has(vertex)) fail("INVALID_INPUT", "vertex IDs must be unique");
    adjacency.set(vertex, []);
  }
  if (typeof source !== "string" || !adjacency.has(source)) {
    fail("INVALID_SOURCE", "source must be one of vertices");
  }
  if (!Array.isArray(edges)) fail("INVALID_EDGE", "edges must be an array");
  for (const edge of edges) {
    if (
      !edge
      || typeof edge.from !== "string"
      || typeof edge.to !== "string"
      || !adjacency.has(edge.from)
      || !adjacency.has(edge.to)
    ) {
      fail("INVALID_EDGE", "edge endpoint must be in vertices");
    }
    adjacency.get(edge.from).push(edge.to);
  }

  const visited = new Set([source]);
  /** @type {string[]} */
  const queue = [source];
  /** @type {string[]} */
  const order = [];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    order.push(current);
    for (const next of adjacency.get(current)) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return order;
}

module.exports = { execute };
