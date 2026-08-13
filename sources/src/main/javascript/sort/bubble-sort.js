"use strict";

/**
 * 인접한 역순 원소를 반복 교환해 가장 큰 값을 매 회전의 오른쪽 끝으로 보내요.
 * 엄격히 큰 경우에만 교환하므로 같은 값의 상대 순서가 유지되고, 복사본만 정렬해 원본을 보존해요.
 * 회전 중 교환이 없으면 즉시 끝내며 입력 배열과 정수 조건을 같은 규칙으로 검증해 결과를 고정해요.
 * 원소 수 n에서 최악 시간은 O(n^2), 복사 결과를 제외한 추가 공간은 O(1)이에요.
 */
/**
 * Stable, non-mutating bubble-sort reference implementation.
 * Values is non-null; every element is a signed integer. Result is ascending,
 * duplicates are retained, equal values preserve relative order, and the input is never modified.
 * Domain public API for `bubble-sort`. JSON contract adapters live in bundles/runner.
 *
 * @param {number[]} values Signed integer values.
 * @returns {number[]} New ascending array; input is never modified.
 */
function sort(values) {
  if (!Array.isArray(values)) throw new TypeError("values must be an array");
  const output = values.slice();
  for (let end = output.length - 1; end > 0; end--) {
    let swapped = false;
    for (let index = 0; index < end; index++) {
      if (output[index] > output[index + 1]) {
        [output[index], output[index + 1]] = [output[index + 1], output[index]];
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return output;
}

module.exports = { sort };
