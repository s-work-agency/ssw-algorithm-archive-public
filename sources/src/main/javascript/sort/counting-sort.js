"use strict";

/**
 * 비교 없이 값의 출현 횟수로 정렬하는 counting sort.
 * Domain public API for `counting-sort`. JSON 계약 어댑터는 bundles/runner 에 둔다.
 *
 * 입력 배열은 변경하지 않고 오름차순 새 배열을 반환한다.
 * 빈 입력은 []. 값 스팬(max-min+1)이 1,000,000을 넘으면 INPUT_TOO_LARGE로 거부한다.
 *
 * @param {number[]} values 부호 있는 32비트 정수
 * @returns {number[]}
 */

const MINIMUM_SIGNED_32_BIT = -2147483648;
const MAXIMUM_SIGNED_32_BIT = 2147483647;
const MAXIMUM_VALUE_SPAN = 1000000;

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function sort(values) {
  if (!Array.isArray(values)) {
    fail("INVALID_INTEGER", "values must be an array of signed 32-bit integers");
  }
  for (const value of values) {
    if (!Number.isInteger(value) || value < MINIMUM_SIGNED_32_BIT || value > MAXIMUM_SIGNED_32_BIT) {
      fail("INVALID_INTEGER", "values must be an array of signed 32-bit integers");
    }
  }
  if (!values.length) return [];
  let minimum = values[0];
  let maximum = values[0];
  for (const value of values) {
    if (value < minimum) minimum = value;
    if (value > maximum) maximum = value;
  }
  if (maximum - minimum + 1 > MAXIMUM_VALUE_SPAN) {
    fail("INPUT_TOO_LARGE", `value span must be at most ${MAXIMUM_VALUE_SPAN}`);
  }
  const counts = Array(maximum - minimum + 1).fill(0);
  for (const value of values) counts[value - minimum]++;
  const sorted = [];
  for (let index = 0; index < counts.length; index++) {
    for (let remaining = counts[index]; remaining > 0; remaining--) {
      sorted.push(index + minimum);
    }
  }
  return sorted;
}

module.exports = { sort };
