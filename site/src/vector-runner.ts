/**
 * 공개 스냅샷의 JavaScript 구현을 브라우저 안에서 그대로 돌려 보는 실행기다.
 *
 * 돌리는 바이트는 화면이 이미 무결성 검증을 통과해 받아 둔 소스 문자열 그 자체다.
 * 실행하려고 따로 받아오지 않는다 — 호출자가 검증된 로더에서 얻은 텍스트를 넘긴다.
 * 입력은 함께 벤더링한 공식 벡터의 케이스이고, 결과는 그 케이스가 선언한 기대값과
 * 대조한다.
 *
 * 격리
 * - 실행은 Blob URL Worker 안에서만 일어난다. 화면 DOM에 손댈 수 없고, 무한 루프가
 *   나도 UI 스레드가 멈추지 않는다.
 * - 시간 제한을 넘기면 워커를 terminate 한다. 협조를 구하는 신호가 아니라 강제 종료라
 *   while(true)도 실제로 끊긴다.
 * - 성공·실패·예외·시간 초과 넷을 모두 값으로 돌려준다. 콘솔로 새지 않는다.
 */

/**
 * 종마다 다른 도메인 API를 흡수하는 표. 이 소스들은 자립 도메인 구현이라 JSON 계약
 * 어댑터를 스스로 들지 않는다(그쪽은 러너 번들의 몫이다). 그래서 "어떤 이름으로
 * 내보내는지"와 "케이스 input의 어느 필드를 어떤 순서로 넘기는지"를 여기서 선언한다.
 *
 * `outputKey`는 함수가 배열 하나를 그대로 돌려줄 때만 쓴다. 계약 출력은 언제나
 * 객체라, 그 배열을 어떤 key로 감쌀지 고정한다. 기대값을 보고 정하지 않는다 —
 * 그렇게 하면 무엇을 넣어도 통과하는 비교가 된다.
 */
export interface JavaScriptAdapter {
  readonly exportName: string;
  readonly args: readonly string[];
  readonly outputKey?: string;
}

const adapters: Readonly<Record<string, JavaScriptAdapter>> = {
  "a-star": {
    exportName: "execute",
    args: ["vertices", "edges", "source", "target", "heuristic"],
  },
  "aho-corasick": { exportName: "execute", args: ["text", "patterns"] },
  "breadth-first-search": {
    exportName: "execute",
    args: ["vertices", "edges", "source"],
    outputKey: "order",
  },
  "bubble-sort": { exportName: "sort", args: ["values"], outputKey: "values" },
  "counting-sort": { exportName: "sort", args: ["values"], outputKey: "values" },
  "depth-first-search": {
    exportName: "execute",
    args: ["vertices", "edges", "source"],
  },
  kmp: { exportName: "execute", args: ["text", "pattern"], outputKey: "indices" },
  "quick-sort": { exportName: "sort", args: ["values"], outputKey: "values" },
};

export function javaScriptAdapter(
  algorithmId: string,
): JavaScriptAdapter | undefined {
  return Object.hasOwn(adapters, algorithmId) ? adapters[algorithmId] : undefined;
}

/** 벡터 케이스 한 건. 기대값은 출력 또는 오류 코드 중 하나다. */
export interface VectorCase {
  readonly caseId: string;
  readonly description?: string;
  readonly input: Record<string, unknown>;
  readonly expected:
    | { readonly output: unknown }
    | { readonly error: { readonly code: string } };
}

export function parseVectorCase(value: unknown): VectorCase | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const expected = record.expected;
  if (
    typeof record.caseId !== "string" ||
    typeof record.input !== "object" ||
    record.input === null ||
    Array.isArray(record.input) ||
    typeof expected !== "object" ||
    expected === null
  ) {
    return undefined;
  }
  const expectedRecord = expected as Record<string, unknown>;
  const errorRecord = expectedRecord.error as
    | Record<string, unknown>
    | undefined;
  const normalizedExpected =
    errorRecord && typeof errorRecord.code === "string"
      ? { error: { code: errorRecord.code } }
      : Object.hasOwn(expectedRecord, "output")
        ? { output: expectedRecord.output }
        : undefined;
  if (!normalizedExpected) return undefined;
  return {
    caseId: record.caseId,
    ...(typeof record.description === "string"
      ? { description: record.description }
      : {}),
    input: record.input as Record<string, unknown>,
    expected: normalizedExpected,
  };
}

/**
 * 워커 본문. 소스는 CommonJS(`module.exports`)로 내보내므로 함수 한 겹으로 감싸
 * module·exports를 만들어 준다. 소스 첫 줄의 "use strict"는 그 함수의 지시문이 되어
 * 원본과 같은 엄격 모드로 돈다.
 */
const workerSource = [
  'self.onmessage = function (event) {',
  '  var data = event.data;',
  '  try {',
  '    var moduleObject = { exports: {} };',
  '    var factory = new Function(',
  '      "module",',
  '      "exports",',
  '      data.source + "\\n;return module.exports;"',
  '    );',
  '    var api = factory(moduleObject, moduleObject.exports) || moduleObject.exports;',
  '    var entry = api ? api[data.exportName] : undefined;',
  '    if (typeof entry !== "function") {',
  '      self.postMessage({ status: "missing-export", name: data.exportName });',
  '      return;',
  '    }',
  '    var positional = data.args.map(function (name) { return data.input[name]; });',
  '    var raw = entry.apply(null, positional);',
  '    var output = data.outputKey ? { [data.outputKey]: raw } : raw;',
  '    self.postMessage({ status: "output", output: JSON.parse(JSON.stringify(output === undefined ? null : output)) });',
  '  } catch (error) {',
  '    self.postMessage({',
  '      status: "error",',
  '      code: error && error.code ? String(error.code) : "",',
  '      message: error && error.message ? String(error.message) : String(error)',
  '    });',
  '  }',
  '};',
].join("\n");

export type RunOutcome =
  | { readonly status: "output"; readonly output: unknown }
  | { readonly status: "error"; readonly code: string; readonly message: string }
  | { readonly status: "timeout" }
  | { readonly status: "crashed"; readonly message: string }
  | { readonly status: "missing-export"; readonly name: string };

export const defaultRunTimeoutMilliseconds = 2000;

/**
 * 소스 한 벌을 워커에서 한 번 실행한다. 어떤 경로로 끝나든 워커와 Blob URL을 반드시
 * 정리하고, 결과는 예외가 아니라 값으로 돌려준다.
 */
export function runJavaScriptCase(options: {
  readonly source: string;
  readonly adapter: JavaScriptAdapter;
  readonly input: Record<string, unknown>;
  readonly timeoutMilliseconds?: number;
}): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const blob = new Blob([workerSource], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    let worker: Worker;
    try {
      worker = new Worker(url);
    } catch (error: unknown) {
      URL.revokeObjectURL(url);
      resolve({
        status: "crashed",
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    let settled = false;
    const finish = (outcome: RunOutcome): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(outcome);
    };
    const timer = window.setTimeout(
      () => finish({ status: "timeout" }),
      options.timeoutMilliseconds ?? defaultRunTimeoutMilliseconds,
    );
    worker.onmessage = (event: MessageEvent) => {
      finish(event.data as RunOutcome);
    };
    worker.onerror = (event: ErrorEvent) => {
      // 워커가 통째로 죽은 경우다. 원문 메시지가 없으면 형태만 남긴다.
      event.preventDefault();
      finish({ status: "crashed", message: event.message || "worker error" });
    };
    worker.postMessage({
      source: options.source,
      exportName: options.adapter.exportName,
      args: [...options.adapter.args],
      ...(options.adapter.outputKey === undefined
        ? {}
        : { outputKey: options.adapter.outputKey }),
      input: options.input,
    });
  });
}

/** key 순서에 흔들리지 않는 값 비교용 정규 표기다. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export type CaseVerdict =
  | { readonly kind: "passed" }
  | { readonly kind: "failed"; readonly reason: "output" | "error-code" | "shape" }
  | { readonly kind: "timeout" }
  | { readonly kind: "crashed" };

/**
 * 실행 결과를 케이스가 선언한 기대값과 대조한다. 출력 케이스는 값이 정확히 같아야
 * 하고, 오류 케이스는 계약 코드까지 같아야 한다 — 아무 예외나 났다고 통과시키면
 * 오류 계약을 검사하지 않는 것과 같다.
 */
export function judgeCase(
  expected: VectorCase["expected"],
  outcome: RunOutcome,
): CaseVerdict {
  if (outcome.status === "timeout") return { kind: "timeout" };
  if (outcome.status === "crashed" || outcome.status === "missing-export") {
    return { kind: "crashed" };
  }
  if ("error" in expected) {
    if (outcome.status !== "error") return { kind: "failed", reason: "shape" };
    return outcome.code === expected.error.code
      ? { kind: "passed" }
      : { kind: "failed", reason: "error-code" };
  }
  if (outcome.status !== "output") return { kind: "failed", reason: "shape" };
  return canonicalJson(outcome.output) === canonicalJson(expected.output)
    ? { kind: "passed" }
    : { kind: "failed", reason: "output" };
}
