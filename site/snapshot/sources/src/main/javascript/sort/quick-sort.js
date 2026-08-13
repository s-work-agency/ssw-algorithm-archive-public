"use strict";

/**
 * Non-mutating quick-sort partitioned around the first value.
 * Domain public API for `quick-sort`. JSON adapters live in bundles/runner.
 *
 * Equal values stay grouped via a three-way split. Empty and single-element
 * inputs are identity. The input array is never modified.
 *
 * @param {number[]} values signed 32-bit integers
 * @returns {number[]} new ascending array
 */

const MINIMUM_SIGNED_32_BIT = -2147483648;
const MAXIMUM_SIGNED_32_BIT = 2147483647;

function failInvalidInteger() {
  const error = new Error("values must be an array of signed 32-bit integers");
  error.code = "INVALID_INTEGER";
  throw error;
}

/**
 * 첫 값을 피벗으로 세 그룹(작음·같음·큼)으로 나누되 작은 쪽만 재귀하고 큰 쪽은 루프로 이어가요.
 * 재귀는 항상 절반 이하 길이에만 걸리므로 스택 깊이는 log2(n) 이하로 묶여요.
 * head는 앞쪽 조각을, tail은 뒤쪽 조각을 역순으로 모아 마지막에 한 번만 이어 붙여요.
 * @param {readonly number[]} values 검증을 마친 값들
 * @returns {number[]} 오름차순 새 배열
 */
function sortValidated(values) {
  const head = [];
  const tail = [];
  let current = values;
  while (current.length >= 2) {
    const pivot = current[0];
    const less = current.filter(value => value < pivot);
    const equal = current.filter(value => value === pivot);
    const greater = current.filter(value => value > pivot);
    if (less.length <= greater.length) {
      head.push(sortValidated(less), equal);
      current = greater;
    } else {
      tail.push(sortValidated(greater), equal);
      current = less;
    }
  }
  const sorted = [];
  for (const chunk of head) for (const value of chunk) sorted.push(value);
  for (const value of current) sorted.push(value);
  for (let index = tail.length - 1; index >= 0; index--) {
    for (const value of tail[index]) sorted.push(value);
  }
  return sorted;
}

/**
 * 각 구간의 첫 값을 피벗으로 삼아 작은 값, 같은 값, 큰 값의 세 배열로 나눈 뒤 합쳐요.
 * 분할 뒤 세 그룹의 모든 값은 각각 피벗보다 작음·같음·큼 관계를 만족한다는 불변식을 가져요.
 * 피벗 위치와 왼쪽부터의 그룹 수집이 고정되어 중복 값이 있어도 동일한 오름차순 결과를 만들어요.
 * 부호 있는 32비트 정수가 아닌 입력을 분할 전에 거부하며, 길이 n에 대해 평균 O(n log n),
 * 최악 O(n²) 시간과 O(n) 결과 공간, O(log n) 스택을 사용해요.
 */
function sort(values) {
  if (!Array.isArray(values)) failInvalidInteger();
  for (const value of values) {
    if (!Number.isInteger(value) || value < MINIMUM_SIGNED_32_BIT || value > MAXIMUM_SIGNED_32_BIT) {
      failInvalidInteger();
    }
  }
  return sortValidated(values);
}

module.exports = Object.freeze({ sort });
