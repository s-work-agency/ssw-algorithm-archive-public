"use strict";

/**
 * 모든 패턴을 trie에 넣고 실패 링크를 따라가며 텍스트를 한 번 훑어 다중 패턴을 동시에 찾아요.
 * 각 상태는 전이·실패 링크·출력 링크를 유지해 접미 패턴까지 빠짐없이 보고하는 불변식을 지켜요.
 * ASCII 입력과 패턴 경계를 검증하고, 일치 결과의 위치와 패턴 순서를 고정해 실행마다 같은 출력을 만들어요.
 * 텍스트 길이 T와 패턴 총길이 P에 대해 탐색은 O(T + P), 결과 정렬까지 포함하면 O(T + P + K log K)예요.
 */
/**
 * Multi-pattern Aho–Corasick matcher over ASCII text.
 * Domain public API for `aho-corasick`. JSON contract adapters live in bundles/runner.
 */

const ASCII_PATTERN = /^[\x00-\x7F]*$/;
const NONEMPTY_ASCII = /^[\x00-\x7F]+$/;

/**
 * @param {string} code
 * @param {string} message
 * @returns {never}
 */
function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isAscii(value) {
  return typeof value === "string" && ASCII_PATTERN.test(value);
}

/**
 * Builds the automaton and returns every canonical match.
 * Matches sort by exclusive end, start, then pattern input index.
 *
 * @param {string} text ASCII text (length ≤ 100_000)
 * @param {ReadonlyArray<{id: string, pattern: string}>} patterns
 *   Unique nonempty ASCII ids and nonempty ASCII pattern strings; total length ≤ 100_000
 * @returns {{matches: Array<{patternId: string, start: number, end: number}>}}
 */
function execute(text, patterns) {
  if (!isAscii(text)) fail("INVALID_TEXT", "text must contain only ASCII");
  if (text.length > 100000) fail("INPUT_TOO_LARGE", "text is too large");
  if (!Array.isArray(patterns)) fail("INVALID_PATTERN", "patterns must be an array");
  if (patterns.length > 10000) fail("INPUT_TOO_LARGE", "too many patterns");

  const ids = new Set();
  let totalPatternLength = 0;
  /** @type {Array<{id: string, pattern: string, inputIndex: number}>} */
  const indexed = [];
  for (let inputIndex = 0; inputIndex < patterns.length; inputIndex++) {
    const entry = patterns[inputIndex];
    if (
      !entry
      || typeof entry !== "object"
      || !NONEMPTY_ASCII.test(entry.id)
      || !NONEMPTY_ASCII.test(entry.pattern)
    ) {
      fail("INVALID_PATTERN", "patterns need nonempty ASCII IDs and values");
    }
    if (ids.has(entry.id)) fail("DUPLICATE_PATTERN_ID", "pattern IDs must be unique");
    ids.add(entry.id);
    totalPatternLength += entry.pattern.length;
    if (totalPatternLength > 100000) fail("INPUT_TOO_LARGE", "total pattern length is too large");
    indexed.push({ id: entry.id, pattern: entry.pattern, inputIndex });
  }

  const alphabetSize = 128;
  const transitions = new Int32Array((totalPatternLength + 1) * alphabetSize);
  const nodes = [{ failure: 0, output: -1, terminals: /** @type {number[]} */ ([]) }];
  for (let patternIndex = 0; patternIndex < indexed.length; patternIndex++) {
    let state = 0;
    for (let charIndex = 0; charIndex < indexed[patternIndex].pattern.length; charIndex++) {
      const characterCode = indexed[patternIndex].pattern.charCodeAt(charIndex);
      const transitionIndex = state * alphabetSize + characterCode;
      if (transitions[transitionIndex] === 0) {
        transitions[transitionIndex] = nodes.length;
        nodes.push({ failure: 0, output: -1, terminals: [] });
      }
      state = transitions[transitionIndex];
    }
    nodes[state].terminals.push(patternIndex);
  }

  const queue = [];
  for (let characterCode = 0; characterCode < alphabetSize; characterCode++) {
    const child = transitions[characterCode];
    if (child !== 0) queue.push(child);
  }
  for (let head = 0; head < queue.length; head++) {
    const state = queue[head];
    const stateOffset = state * alphabetSize;
    const failureOffset = nodes[state].failure * alphabetSize;
    for (let characterCode = 0; characterCode < alphabetSize; characterCode++) {
      const transitionIndex = stateOffset + characterCode;
      const child = transitions[transitionIndex];
      if (child === 0) {
        transitions[transitionIndex] = transitions[failureOffset + characterCode];
      } else {
        const failure = transitions[failureOffset + characterCode];
        nodes[child].failure = failure;
        nodes[child].output = nodes[failure].terminals.length > 0
          ? failure
          : nodes[failure].output;
        queue.push(child);
      }
    }
  }

  /** @type {Array<{patternId: string, start: number, end: number, patternIndex: number}>} */
  const matches = [];
  let state = 0;
  for (let index = 0; index < text.length; index++) {
    state = transitions[state * alphabetSize + text.charCodeAt(index)];
    let terminalState = nodes[state].terminals.length > 0 ? state : nodes[state].output;
    while (terminalState !== -1) {
      for (const patternIndex of nodes[terminalState].terminals) {
        const pattern = indexed[patternIndex];
        matches.push({
          patternId: pattern.id,
          start: index + 1 - pattern.pattern.length,
          end: index + 1,
          patternIndex,
        });
        if (matches.length > 100000) fail("MATCH_LIMIT_EXCEEDED", "too many matches");
      }
      terminalState = nodes[terminalState].output;
    }
  }

  matches.sort(
    (left, right) => left.end - right.end
      || left.start - right.start
      || left.patternIndex - right.patternIndex,
  );
  return {
    matches: matches.map(({ patternId, start, end }) => ({ patternId, start, end })),
  };
}

module.exports = { execute };
