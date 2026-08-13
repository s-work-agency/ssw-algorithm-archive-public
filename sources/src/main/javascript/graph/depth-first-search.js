"use strict";

/**
 * 방향 그래프에서 출발 정점 기준 DFS 전위 순회.
 * Domain public API for `depth-first-search`. JSON 계약 어댑터는 bundles/runner 에 둔다.
 *
 * 이웃 순서는 간선 입력 순서. 도달 불가능한 정점은 결과에 포함하지 않는다.
 * 재귀 깊이 한계를 피하기 위해 명시적 스택으로 재귀 전위 순회를 모사한다.
 *
 * @param {string[]} vertices
 * @param {{from: string, to: string}[]} edges
 * @param {string} source
 * @returns {{order: string[]}}
 */
function execute(vertices, edges, source) {
  if (!Array.isArray(vertices) || vertices.some(vertex => typeof vertex !== "string")) {
    const error = new Error("vertices must be an array of strings");
    error.code = "INVALID_INPUT";
    throw error;
  }
  const adjacency = new Map();
  for (const vertex of vertices) {
    if (adjacency.has(vertex)) {
      const error = new Error("vertex IDs must be unique");
      error.code = "INVALID_INPUT";
      throw error;
    }
    adjacency.set(vertex, []);
  }
  if (typeof source !== "string" || !adjacency.has(source)) {
    const error = new Error("source must be one of vertices");
    error.code = "INVALID_SOURCE";
    throw error;
  }
  if (!Array.isArray(edges)) {
    const error = new Error("edges must be an array");
    error.code = "INVALID_EDGE";
    throw error;
  }
  for (const edge of edges) {
    if (
      edge === null
      || typeof edge !== "object"
      || typeof edge.from !== "string"
      || typeof edge.to !== "string"
      || !adjacency.has(edge.from)
      || !adjacency.has(edge.to)
    ) {
      const error = new Error("edge endpoint must be in vertices");
      error.code = "INVALID_EDGE";
      throw error;
    }
    adjacency.get(edge.from).push(edge.to);
  }

  const visited = new Set([source]);
  const order = [source];
  // frame.next: 아직 시도하지 않은 이웃 인덱스
  const stack = [{ vertex: source, next: 0 }];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const neighbors = adjacency.get(frame.vertex);
    if (frame.next >= neighbors.length) {
      stack.pop();
      continue;
    }
    const next = neighbors[frame.next++];
    if (visited.has(next)) continue;
    visited.add(next);
    order.push(next);
    stack.push({ vertex: next, next: 0 });
  }
  return { order };
}

module.exports = { execute };
