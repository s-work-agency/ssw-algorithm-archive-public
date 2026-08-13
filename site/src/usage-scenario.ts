/**
 * 사용 시나리오 — "이 알고리즘을 실제로 쓰는 장면 하나"를 산문으로 적은 종별 자산의
 * 소비 경계다. 개요 탭 맨 아래 전폭 영역이 이 모듈이 돌려준 값을 읽어 그린다.
 *
 * catalog가 발행하는 documentation은 불릿 네 묶음(언제·피해야 할 때·트레이드오프
 * ·함정)이다. 항목 하나하나는 맞지만 서로 이어지지 않아서, 처음 보는 사람이
 * "그래서 내 상황에 쓰라는 건가"를 판단하기 어렵다. 시나리오는 그 판단을 장면
 * 하나로 이어 붙이는 자리다.
 *
 * 데이터 계층
 * - 출처는 catalog 2.1 종별 자산 `assets/<id>/usage-scenario.json` 한 장이다.
 *   프로토타입 시절의 프론트 로컬 표(scenario-stories.ts)는 이 모듈이 대체했다.
 * - 자산에 닿는 경로는 인덱스 → 상세 → 자산 두 단계이고, 경로는 조립하지 않고
 *   상세가 발표한 manifest의 path를 그대로 따라간다. 자산 레이아웃은 계약이 아니라
 *   manifest가 정하기 때문이다.
 * - 상세의 `assets`가 비어 있으면 그 종에는 자산이 없다. 없는 것이 정상 상태이므로
 *   실패로 다루지 않고 섹션 자체를 만들지 않는다 — "준비 중" 같은 빈 껍데기를
 *   남기지 않는다.
 * - 렌더 쪽은 id가 아니라 ScenarioStory 값을 받는다. 출처가 또 바뀌어도 그리는
 *   함수는 손대지 않는다.
 *
 * 본문 형태
 * - 네 단은 자산의 기계 키(situation·why·apply·switchPoint)를 그대로 쓴다. 한국어
 *   소제목은 UI 크롬이라 여기 담지 않고 ui-strings 표가 든다.
 * - 배열 원소 하나가 문단 하나다. 문단 안에는 원문의 줄바꿈이 그대로 남아 있을 수
 *   있으므로, 렌더는 문단마다 <p> 하나를 만들고 줄바꿈은 살려서 보인다.
 * - 마크다운 문법은 남지 않는다. 파싱은 생성 시점에 끝나 소비자에게 파서가 필요
 *   없고, 산문 안의 백틱만 원문 그대로 남는다.
 * - 본문은 한국어만 있다. 카탈로그가 발행하는 설명이 영문 모드에서도 한국어로
 *   남는 것과 같은 중간 상태이고, 소제목만 UI 크롬으로 함께 전환된다.
 */

import type { CatalogAssetManifest } from "./catalog.js";

/** 상세 `assets` map에서 이 자산을 찾는 이름. 경로가 아니라 이름이 계약이다. */
export const usageScenarioAssetName = "usage-scenario";

/** 생성기가 발행하는 자산 형식 버전. 모르는 버전은 그리지 않고 거절한다. */
const usageScenarioAssetVersion = "1.0";

/**
 * 네 단 구성은 시나리오의 골격이라 데이터가 정하지 않고 타입이 고정한다.
 * 자산의 키 이름·순서가 그대로 이 순서다.
 */
export const scenarioStepKinds = [
  "situation",
  "why",
  "apply",
  "switchPoint",
] as const;

export type ScenarioStepKind = (typeof scenarioStepKinds)[number];

/** 한 단. 본문은 문단 배열이라, 렌더가 문단 경계를 지어낼 일이 없다. */
export interface ScenarioStep {
  readonly kind: ScenarioStepKind;
  readonly body: readonly string[];
}

/** 알고리즘 하나의 시나리오. 단의 순서는 배열 순서 그대로 그려진다. */
export interface ScenarioStory {
  readonly steps: readonly ScenarioStep[];
}

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 상세가 든 자산 manifest 중 사용 시나리오 한 건을 고른다. 자산이 없는 종은
 * undefined이고 그것이 정상이다. `constructor`처럼 프로토타입에 이미 있는 이름으로
 * 없는 자산이 있는 것처럼 보이지 않도록 own key 만 본다.
 */
export function usageScenarioManifest(
  assets: Readonly<Record<string, CatalogAssetManifest>>,
): CatalogAssetManifest | undefined {
  return Object.hasOwn(assets, usageScenarioAssetName)
    ? assets[usageScenarioAssetName]
    : undefined;
}

function paragraphs(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || !value.length) {
    throw new TypeError(
      `usage-scenario.json ${field}: 비어 있지 않은 배열이어야 합니다.`,
    );
  }
  return value.map((paragraph, index) => {
    if (typeof paragraph !== "string" || !paragraph.length) {
      throw new TypeError(
        `usage-scenario.json ${field}[${index}]: 비어 있지 않은 문자열이어야 합니다.`,
      );
    }
    return paragraph;
  });
}

/**
 * 자산 한 장을 화면 모양으로 옮긴다. 바이트 무결성은 이미 정적 자산 로더가 상세
 * manifest의 sha256·byteLength로 확정했으므로, 여기서는 형태와 소유 알고리즘만 본다.
 * 형태가 어긋나면 지어내지 않고 던진다 — 호출부가 섹션을 비우는 쪽을 고른다.
 */
export function parseUsageScenario(
  value: unknown,
  algorithmId: string,
): ScenarioStory {
  if (!isRecord(value)) {
    throw new TypeError("usage-scenario.json $: 객체여야 합니다.");
  }
  const keys = Object.keys(value).sort();
  const expectedKeys = ["assetVersion", "algorithmId", ...scenarioStepKinds]
    .slice()
    .sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new TypeError(
      `usage-scenario.json $: ${expectedKeys.join(", ")} 여섯 필드만 있어야 합니다.`,
    );
  }
  if (value.assetVersion !== usageScenarioAssetVersion) {
    throw new TypeError(
      `usage-scenario.json $.assetVersion: '${usageScenarioAssetVersion}'이어야 합니다.`,
    );
  }
  // 자산은 상세를 거쳐 왔지만 소유 알고리즘을 자기 안에도 적는다. 어긋나면 다른
  // 종의 시나리오를 이 화면에 붙이는 것이므로 그리지 않는다.
  if (value.algorithmId !== algorithmId) {
    throw new TypeError(
      `usage-scenario.json $.algorithmId: 상세가 가리킨 '${algorithmId}'와 같아야 합니다.`,
    );
  }
  return {
    steps: scenarioStepKinds.map((kind) => ({
      kind,
      body: paragraphs(value[kind], `$.${kind}`),
    })),
  };
}
