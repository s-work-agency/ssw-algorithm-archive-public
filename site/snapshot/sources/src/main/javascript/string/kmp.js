"use strict";

/**
 * pattern의 longest proper prefix-suffix 표를 만들고 불일치 시 이미 확인한 접두 길이로 바로 되돌아가요.
 * text 인덱스는 뒤로 가지 않으며 현재 matched 길이가 항상 suffix와 pattern prefix의 일치 길이를 나타내요.
 * BMP 문자열과 길이 경계를 먼저 검사하고 완전 일치 뒤 prefix 표로 이동해 겹치는 시작점도 오름차순 보고해요.
 * text 길이 n과 pattern 길이 m에서 시간은 O(n + m), prefix 표 공간은 O(m)이에요.
 */
/**
 * Knuth-Morris-Pratt exact pattern search for BMP strings.
 * Domain public API for `kmp`. JSON contract adapters live in the runner/wave adapters.
 */

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

/**
 * @param {string} text
 * @param {string} pattern
 * @returns {number[]} Zero-based start offsets, including overlapping matches.
 */
function execute(text, pattern) {
  if (typeof text !== "string" || typeof pattern !== "string") {
    fail("INVALID_INPUT", "text and pattern must be strings");
  }
  if (/[\uD800-\uDFFF]/.test(text) || /[\uD800-\uDFFF]/.test(pattern)) {
    fail("INVALID_INPUT", "text and pattern must contain only BMP characters");
  }
  if (!pattern.length) {
    fail("EMPTY_PATTERN", "pattern must not be empty");
  }

  const lps = Array(pattern.length).fill(0);
  for (let index = 1, matched = 0; index < pattern.length;) {
    if (pattern[index] === pattern[matched]) lps[index++] = ++matched;
    else if (matched) matched = lps[matched - 1];
    else lps[index++] = 0;
  }

  const indices = [];
  for (let textIndex = 0, patternIndex = 0; textIndex < text.length;) {
    if (text[textIndex] === pattern[patternIndex]) {
      textIndex++;
      patternIndex++;
      if (patternIndex === pattern.length) {
        indices.push(textIndex - patternIndex);
        patternIndex = lps[patternIndex - 1];
      }
    } else if (patternIndex) patternIndex = lps[patternIndex - 1];
    else textIndex++;
  }
  return indices;
}

module.exports = Object.freeze({ execute });
