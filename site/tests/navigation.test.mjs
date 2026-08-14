/*
  화면 라우팅 회귀 테스트.

  붙잡는 회귀: 알고리즘 상세를 보는 중에 사이드바의 목록·커버리지를 눌러도 화면이
  바뀌지 않고 주소만 바뀌던 것. 원인은 네비가 pushState 로 해시만 갈아 끼우고
  끝냈다는 데 있었다 — pushState 는 hashchange 를 발생시키지 않으므로, 히스토리
  경로에 걸어 둔 라우팅이 한 번도 돌지 않아 상세 DOM 이 그대로 남았다.

  소개 화면이 들어오면서 그 회귀의 사정권이 넓어졌다. 이제 사용자가 목록을 처음
  누르는 자리는 대개 소개 화면이라, "목록이 아니면 다시 그린다"까지 함께 잠근다.

  DOM 없이 확인할 수 있도록 판정은 navigation.ts 의 순수 함수가 들고, main.ts 는
  그 답에 따라 라우팅을 태우거나 패널만 갈아 끼운다. 그래서 여기서 잠그는 것은
  "화면이 바뀌는 이동이면 화면을 다시 그려야 한다"는 규칙 자체다.

  빌드 산출물(assets/)을 그대로 읽는다. 소스가 아니라 실제로 배포되는 모듈이
  대상이어야 tsc 를 지난 뒤에도 규칙이 살아 있는지 확인된다.
*/
import assert from "node:assert/strict";
import test from "node:test";
import {
  aboutHash,
  catalogTabActivation,
  isAboutHash,
  isDocumentScreen,
  isThoughtsHash,
  screenForHash,
  selectedIdForNavigation,
  thoughtsHash,
} from "../../assets/navigation.js";

/** 공개 스냅샷에 실제로 있는 알고리즘 id 몇 개. */
const availableIds = new Set(["quick-sort", "kmp", "a-star"]);

test("첫 접속(빈 해시)은 소개 화면이다", () => {
  // 링크를 받은 사람이 처음 보는 화면이라, 이 판정이 곧 사이트의 첫인상이다.
  for (const hash of ["", "#", aboutHash]) {
    assert.equal(
      screenForHash(hash, availableIds),
      "about",
      `${JSON.stringify(hash)} 는 소개 화면이어야 합니다.`,
    );
  }
});

test("소개 본문 안 절 앵커는 화면을 소개에 묶어 둔다", () => {
  /*
    본문 앵커를 맨 slug(#5-...)로 두면 화면 판정이 그것을 소개도 알고리즘
    deep-link 도 아닌 해시로 보고 목록으로 튕긴다. #about/ 아래로 넣는 이유가
    이것이고, 그래서 판정이 바뀌지 않아 이동은 브라우저 기본 스크롤만 남는다.
  */
  for (const hash of [
    "#about/1-가볍게-시작했습니다",
    "#about/8-그래서-이-사이트에-이것을-담았습니다",
    // 주소창을 지나며 퍼센트 인코딩된 형태도 같은 화면이어야 한다.
    "#about/7-%EC%9A%B0%EC%84%A0%EC%9D%80",
  ]) {
    assert.equal(screenForHash(hash, availableIds), "about", hash);
    assert.equal(isAboutHash(hash), true, hash);
  }
});

test("생각은 자기 해시와 자기 절 앵커에서만 선다", () => {
  // 읽을거리가 둘이 되면서 화면 판정이 소개 하나로 끝나지 않는다.
  for (const hash of [
    thoughtsHash,
    "#thoughts/1-이론이기-전에-활용의-방법입니다",
    "#thoughts/3-ai가-구현을-맡으면서-안목이-더-중요해졌습니다",
  ]) {
    assert.equal(screenForHash(hash, availableIds), "thoughts", hash);
    assert.equal(isThoughtsHash(hash), true, hash);
    // 소개로도 함께 해석되면 두 화면이 같은 해시를 놓고 다툰다.
    assert.equal(isAboutHash(hash), false, hash);
  }
});

test("생각을 지목하지 않는 앞머리는 생각으로 새지 않는다", () => {
  for (const hash of ["#thoughtsfoo", "#thought", "#about"]) {
    assert.equal(isThoughtsHash(hash), false, hash);
  }
  assert.equal(screenForHash("#thoughtsfoo", availableIds), "list");
});

test("읽는 화면 둘만 문서 갈래로 묶인다", () => {
  // 초점·스크롤 처리를 한 갈래로 다루는 근거라, 목록·상세가 섞이면 안 된다.
  assert.equal(isDocumentScreen("about"), true);
  assert.equal(isDocumentScreen("thoughts"), true);
  assert.equal(isDocumentScreen("list"), false);
  assert.equal(isDocumentScreen("detail"), false);
});

test("소개를 지목하지 않는 앞머리는 소개로 새지 않는다", () => {
  // #aboutfoo 같은 해시가 접두 검사만으로 소개가 되면 라우팅이 헐거워진다.
  assert.equal(isAboutHash("#aboutfoo"), false);
  assert.equal(screenForHash("#aboutfoo", availableIds), "list");
});

test("알고리즘 deep-link 만 상세 화면으로 인정한다", () => {
  assert.equal(screenForHash("#algorithm/quick-sort", availableIds), "detail");
  assert.equal(screenForHash("#algorithm/kmp", availableIds), "detail");
});

test("카탈로그 화면 해시와 그 밖의 해시는 모두 목록 화면이다", () => {
  for (const hash of [
    "#list",
    "#coverage",
    "#detail",
    "#algorithm/",
    // 건너뛰기 링크가 남기던 해시. 화면 이동이 아니므로 목록으로 떨어진다.
    "#main-content",
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

test("소개 → 생각 → 목록 → 상세 → 소개 왕복이 화면 판정만으로 닫힌다", () => {
  // 사이드바 소개 · 생각 · 목록 · 카드 클릭 · 다시 사이드바 소개 순서다.
  const trip = [
    ["", "about"],
    [thoughtsHash, "thoughts"],
    // 생각을 읽다 절 앵커를 눌러도 화면은 그대로여야 한다.
    ["#thoughts/2-구현보다-자원과-상황을-먼저-봤습니다", "thoughts"],
    ["#list", "list"],
    ["#algorithm/kmp", "detail"],
    [aboutHash, "about"],
    // 소개에서 커버리지로 갔다가 브랜드(홈)로 돌아오는 길도 같은 규칙이다.
    ["#coverage", "list"],
    [aboutHash, "about"],
    // 읽을거리 둘 사이를 오가는 길도 화면 판정만으로 닫힌다.
    [thoughtsHash, "thoughts"],
    [aboutHash, "about"],
  ];
  for (const [hash, expected] of trip) {
    assert.equal(
      screenForHash(hash, availableIds),
      expected,
      `${JSON.stringify(hash)} → ${expected}`,
    );
  }
});

test("상세를 보는 중에 카탈로그 네비를 누르면 화면을 다시 그린다", () => {
  // 이 갈래가 "tab" 이면 상세 DOM 이 걷히지 않는다 — 그것이 이 파일이 잠그는 회귀다.
  assert.equal(catalogTabActivation("detail"), "route");
});

test("읽을거리를 보는 중에 카탈로그 네비를 누르면 화면을 다시 그린다", () => {
  // 첫 화면이 소개라 이 경로가 가장 흔한 목록 진입이다. "tab" 이면 읽던 본문이
  // 걷히지 않아 목록이 그 아래 숨은 채로 남는다.
  assert.equal(catalogTabActivation("about"), "route");
  assert.equal(catalogTabActivation("thoughts"), "route");
});

test("이미 목록 화면이면 패널만 갈아 끼운다", () => {
  // 목록 안 탭 전환까지 화면을 다시 그리면 검색어·분류 필터가 초기화된다.
  assert.equal(catalogTabActivation("list"), "tab");
});

test("선택 id 만으로는 화면 전환을 알 수 없다", () => {
  /*
    #coverage·#list·#about 은 어떤 알고리즘도 지목하지 않아
    selectedIdForNavigation 이 undefined("선택 변화 없음")를 준다. 회귀 당시 이
    값만 보고 "바뀐 게 없다"고 판단할 수 있었던 이유이고, 화면 판정을 따로 두어야
    하는 이유이기도 하다.
  */
  for (const hash of ["#list", "#coverage", aboutHash, thoughtsHash]) {
    assert.equal(
      selectedIdForNavigation(hash, availableIds, "quick-sort"),
      undefined,
    );
  }
  assert.equal(screenForHash("#list", availableIds), "list");
  assert.equal(screenForHash("#coverage", availableIds), "list");
  assert.equal(screenForHash(aboutHash, availableIds), "about");
  assert.equal(screenForHash(thoughtsHash, availableIds), "thoughts");
});
