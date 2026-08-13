/*
  화면 라우팅 회귀 테스트.

  붙잡는 회귀: 알고리즘 상세를 보는 중에 사이드바의 목록·커버리지를 눌러도 화면이
  바뀌지 않고 주소만 바뀌던 것. 원인은 네비가 pushState 로 해시만 갈아 끼우고
  끝냈다는 데 있었다 — pushState 는 hashchange 를 발생시키지 않으므로, 히스토리
  경로에 걸어 둔 라우팅이 한 번도 돌지 않아 상세 DOM 이 그대로 남았다.

  DOM 없이 확인할 수 있도록 판정은 navigation.ts 의 순수 함수가 들고, main.ts 는
  그 답에 따라 라우팅을 태우거나 패널만 갈아 끼운다. 그래서 여기서 잠그는 것은
  "상세에서 카탈로그 네비를 누르면 화면을 다시 그려야 한다"는 규칙 자체다.

  빌드 산출물(assets/)을 그대로 읽는다. 소스가 아니라 실제로 배포되는 모듈이
  대상이어야 tsc 를 지난 뒤에도 규칙이 살아 있는지 확인된다.
*/
import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogTabActivation,
  screenForHash,
  selectedIdForNavigation,
} from "../../assets/navigation.js";

/** 공개 스냅샷에 실제로 있는 알고리즘 id 몇 개. */
const availableIds = new Set(["quick-sort", "kmp", "a-star"]);

test("알고리즘 deep-link 만 상세 화면으로 인정한다", () => {
  assert.equal(screenForHash("#algorithm/quick-sort", availableIds), "detail");
  assert.equal(screenForHash("#algorithm/kmp", availableIds), "detail");
});

test("카탈로그 화면 해시와 그 밖의 해시는 모두 목록 화면이다", () => {
  for (const hash of [
    "#list",
    "#coverage",
    "",
    "#",
    "#detail",
    "#algorithm/",
    // 카탈로그에 없는 id 는 열 상세가 없으므로 목록으로 떨어진다.
    "#algorithm/does-not-exist",
  ]) {
    assert.equal(
      screenForHash(hash, availableIds),
      "list",
      `${JSON.stringify(hash)} 는 목록 화면이어야 합니다.`,
    );
  }
});

test("상세를 보는 중에 카탈로그 네비를 누르면 화면을 다시 그린다", () => {
  // 이 갈래가 "tab" 이면 상세 DOM 이 걷히지 않는다 — 그것이 이 파일이 잠그는 회귀다.
  assert.equal(catalogTabActivation("detail"), "route");
});

test("이미 목록 화면이면 패널만 갈아 끼운다", () => {
  // 목록 안 탭 전환까지 화면을 다시 그리면 검색어·분류 필터가 초기화된다.
  assert.equal(catalogTabActivation("list"), "tab");
});

test("선택 id 만으로는 상세 → 카탈로그 화면 전환을 알 수 없다", () => {
  /*
    #coverage·#list 는 어떤 알고리즘도 지목하지 않아 selectedIdForNavigation 이
    undefined("선택 변화 없음")를 준다. 회귀 당시 이 값만 보고 "바뀐 게 없다"고
    판단할 수 있었던 이유이고, 화면 판정을 따로 두어야 하는 이유이기도 하다.
  */
  for (const hash of ["#list", "#coverage"]) {
    assert.equal(
      selectedIdForNavigation(hash, availableIds, "quick-sort"),
      undefined,
    );
    // 선택은 그대로여도 화면은 목록으로 가야 한다.
    assert.equal(screenForHash(hash, availableIds), "list");
  }
});
