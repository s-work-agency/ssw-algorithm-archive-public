/** 공식 케이스 판정과 수정 입력 표시가 섞이지 않는지 배포 모듈에서 검증한다. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { canonicalJson, judgeRun } from "../../assets/vector-runner.js";
import { englishUiStrings, koreanUiStrings } from "../../assets/ui-strings.js";

test("원래 입력의 출력은 기대값과 정확히 대조한다", () => {
  const expected = { output: { values: [-1, 0, 3, 3] } };
  assert.deepEqual(
    judgeRun(expected, { status: "output", output: expected.output }, false),
    { kind: "passed" },
  );
  assert.deepEqual(
    judgeRun(expected, { status: "output", output: { values: [-1, 1, 3, 3] } }, false),
    { kind: "failed", reason: "output" },
  );
});

test("공식 오류 케이스는 오류 코드까지 일치해야 통과한다", () => {
  const expected = { error: { code: "INVALID_SOURCE" } };
  assert.deepEqual(
    judgeRun(expected, { status: "error", code: "INVALID_SOURCE", message: "invalid source" }, false),
    { kind: "passed" },
  );
  assert.deepEqual(
    judgeRun(expected, { status: "error", code: "UNKNOWN_ERROR", message: "different error" }, false),
    { kind: "failed", reason: "error-code" },
  );
});

test("수정 입력의 출력은 다르거나 우연히 같아도 통과·실패로 표시하지 않는다", () => {
  const expected = { output: { values: [-1, 0, 3, 3] } };
  for (const output of [expected.output, { values: [-1, 1, 3, 3] }]) {
    assert.deepEqual(judgeRun(expected, { status: "output", output }, true), { kind: "edited" });
  }
});

test("수정 입력이 오류를 반환해도 원래 케이스의 실패로 취급하지 않는다", () => {
  const outcome = { status: "error", code: "INVALID_SOURCE", message: "source must be one of vertices" };
  for (const expected of [{ output: { order: ["a", "b"] } }, { error: { code: "INVALID_SOURCE" } }]) {
    assert.deepEqual(judgeRun(expected, outcome, true), { kind: "edited" });
  }
});

test("수정 입력에서는 원래 기대값에 접근하지 않는다", () => {
  const expected = {
    get output() {
      throw new Error("수정 입력은 기대값 비교를 시도하면 안 됩니다.");
    },
  };
  assert.deepEqual(judgeRun(expected, { status: "output", output: null }, true), { kind: "edited" });
});

test("공식 케이스의 시간 초과와 실행 오류 표시는 유지한다", () => {
  const expected = { output: null };
  assert.deepEqual(judgeRun(expected, { status: "timeout" }, false), { kind: "timeout" });
  assert.deepEqual(judgeRun(expected, { status: "crashed", message: "worker failed" }, false), { kind: "crashed" });
  assert.deepEqual(judgeRun(expected, { status: "missing-export", name: "execute" }, false), { kind: "crashed" });
});

test("입력 변경 칩은 실행 모드만 표시하고 실제 오류 내용을 바꾸지 않는다", () => {
  const expected = { output: null };
  for (const outcome of [
    { status: "timeout" },
    { status: "crashed", message: "worker failed" },
    { status: "missing-export", name: "execute" },
  ]) {
    const before = structuredClone(outcome);
    assert.deepEqual(judgeRun(expected, outcome, true), { kind: "edited" });
    assert.deepEqual(outcome, before);
  }
});

test("객체 키 순서만 바뀌면 같은 입력이고 배열 순서와 값 변경은 다르다", () => {
  const original = { vertices: ["a", "b"], source: "a" };
  assert.equal(canonicalJson(original), canonicalJson({ source: "a", vertices: ["a", "b"] }));
  assert.notEqual(canonicalJson(original), canonicalJson({ source: "b", vertices: ["a", "b"] }));
  assert.notEqual(canonicalJson(original), canonicalJson({ vertices: ["b", "a"], source: "a" }));
});

test("한국어와 영어는 같은 키를 제공하고 수정 입력을 명확히 표시한다", () => {
  assert.deepEqual(Object.keys(koreanUiStrings).sort(), Object.keys(englishUiStrings).sort());
  assert.equal(koreanUiStrings["run.verdict.edited"], "입력 값 변경");
  assert.equal(englishUiStrings["run.verdict.edited"], "Input changed");
  for (const table of [koreanUiStrings, englishUiStrings]) {
    assert.ok(table["run.caseValues"]);
    assert.ok(table["run.caseInput"]);
    assert.ok(table["run.editedNote"]);
  }
});

/** 상태 칩의 배경과 글자색이 작은 글자에서도 읽히는지 대비를 계산한다. */
function contrastRatio(left, right) {
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/../gu).map((part) => parseInt(part, 16) / 255);
    const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const values = [luminance(left), luminance(right)].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

test("입력 변경 칩은 라이트·다크 테마에서 충분한 글자 대비를 갖는다", async () => {
  const css = await readFile(new URL("../../styles.css", import.meta.url), "utf8");
  for (const selector of [/:root\s*\{([\s\S]*?)\}/u, /:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}/u]) {
    const block = css.match(selector)?.[1];
    assert.ok(block, "테마 토큰 블록을 찾지 못했습니다.");
    const background = block.match(/--status-edited-bg:\s*(#[0-9a-f]{6})/iu)?.[1];
    const foreground = block.match(/--status-edited-text:\s*(#[0-9a-f]{6})/iu)?.[1];
    assert.ok(background && foreground, "수정 입력의 주황색 토큰이 없습니다.");
    assert.ok(contrastRatio(background, foreground) >= 4.5, "칩의 글자 대비가 부족합니다.");
  }
});
