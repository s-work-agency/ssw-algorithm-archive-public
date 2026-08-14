/*
  게시된 생각 화면 검사.

  about-page.test.mjs 와 같은 자리에서 본다 — 소스가 아니라 배포 루트의
  index.html 이고, 기대값은 원본 `docs/algorithm-thoughts.md` 에서 그때그때 뽑는다.
  글이 고쳐지면 기대값도 함께 움직여야, 이 테스트가 "예전 원고" 를 잠그는 물건이
  되지 않는다.

  붙잡는 사고 넷.
  - 자리표시자만 남고 본문이 들어가지 않은 채 게시되는 것.
  - 읽을거리 둘의 자리가 뒤바뀌거나, 생각이 첫 화면으로 펴진 채 게시되는 것.
  - 글의 제목이 탑바와 본문에 두 번 찍히는 것.
  - 본문 앵커가 라우팅과 부딪혀 생각에서 목록으로 튕기는 것.
*/
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { koreanUiStrings } from "../../assets/ui-strings.js";

const deployRoot = new URL("../../", import.meta.url);
const source = await readFile(
  fileURLToPath(new URL("docs/algorithm-thoughts.md", deployRoot)),
  "utf8",
);
const page = await readFile(fileURLToPath(new URL("index.html", deployRoot)), "utf8");

/** 원고의 제목 줄 전부. `#` 개수와 문구를 그대로 들고 온다. */
const headings = [...source.matchAll(/^(#{1,6})\s+(.+?)\s*$/gmu)].map(
  (matched) => ({ level: matched[1].length, text: matched[2] }),
);

/** 원고 안의 링크 전부. */
const links = [...source.matchAll(/\[([^\]\n]*)\]\(([^)\s]+)\)/gu)].map(
  (matched) => matched[2],
);

/** 게시된 생각 본문만. 뒤에 오는 카탈로그 화면까지 세지 않도록 잘라 둔다. */
const body = page.slice(
  page.indexOf('id="thoughts-doc"'),
  page.indexOf('<div id="catalog-screen"'),
);

test("자리표시자가 남지 않고 본문이 들어갔다", () => {
  assert.ok(
    !page.includes("<!-- THOUGHTS-DOC -->"),
    "자리표시자가 그대로 남았습니다.",
  );
  assert.ok(page.includes('id="thoughts-panel"'), "생각 패널이 없습니다.");
  assert.ok(body.length > 500, "생각 본문이 비어 있습니다.");
});

test("생각은 소개 바로 아래 읽을거리이고, 카탈로그 그룹보다 위에 있다", () => {
  const aboutIndex = page.indexOf('id="nav-about"');
  const thoughtsIndex = page.indexOf('id="nav-thoughts"');
  const groupLabelIndex = page.indexOf('id="nav-label-catalog"');
  const listIndex = page.indexOf('id="catalog-tab-list"');
  assert.ok(thoughtsIndex > 0, "생각 네비 항목이 없습니다.");
  assert.ok(aboutIndex < thoughtsIndex, "생각이 소개보다 위에 있습니다.");
  assert.ok(
    thoughtsIndex < groupLabelIndex && groupLabelIndex < listIndex,
    "생각이 카탈로그 그룹 안으로 들어갔습니다.",
  );
});

test("기본 화면은 여전히 소개다", () => {
  /*
    정적 HTML 이 서는 첫 화면이 곧 스크립트가 늦게 붙었을 때 보이는 화면이다.
    생각이 펴진 채로 게시되면 첫 접속에서 두 글이 함께 보인다.
  */
  assert.match(page, /id="thoughts-panel"[\s\S]{0,200}hidden/u);
  assert.match(page, /id="nav-about"[\s\S]{0,120}aria-current="page"/u);
  assert.ok(
    !/id="nav-thoughts"[\s\S]{0,120}aria-current="page"/u.test(page),
    "생각이 처음부터 활성 표시를 들고 있습니다.",
  );
});

test("글의 제목은 탑바가 들고 본문에서는 빠진다", () => {
  const [title] = headings;
  assert.equal(title.level, 1, "원고의 첫 제목이 h1 이 아닙니다.");
  // 저장소에서 읽는 사람에게는 제목이 필요하므로 원문에는 남아 있어야 한다.
  assert.ok(
    source.includes("<!-- site-only-skip-start -->"),
    "원고에 빼기 마커가 없습니다.",
  );
  assert.equal(
    koreanUiStrings["screen.thoughts"],
    title.text,
    "탑바 제목과 원고 제목이 다릅니다.",
  );
  // 본문에 한 번 더 찍히면 같은 문장이 두 줄 간격으로 두 번 나온다.
  assert.ok(
    !body.includes(`>${title.text}</h2>`),
    "제목이 본문에도 찍혔습니다.",
  );
  assert.ok(!page.includes("site-only-skip"), "빼기 마커가 화면에 새어 나갔습니다.");
});

test("제목 층이 h1 다음에서 건너뛰지 않는다", () => {
  /*
    글의 제목을 탑바(h1)로 올리면서 본문은 h3 부터 시작한다. 그 사이를 눈썹
    문구가 h2 로 메우지 않으면 제목으로 훑는 독자에게 층이 하나 비어 보인다.
    소개 화면은 본문이 문서 제목을 h2 로 들고 있어 이 자리가 p 다.
  */
  const heading = page.slice(
    page.indexOf('id="thoughts-panel"'),
    page.indexOf('id="thoughts-doc"'),
  );
  assert.match(
    heading,
    /<h2 class="doc-panel__eyebrow"/u,
    "생각 화면의 눈썹 문구가 h2 가 아닙니다.",
  );
  // 눈썹 문구는 크기·무게를 클래스가 정한다. 태그가 바뀌어도 모양은 그대로다.
  assert.ok(
    heading.includes('data-i18n="sidebar.thoughts"'),
    "눈썹 문구가 네비 라벨과 같은 문자열을 쓰지 않습니다.",
  );
});

test("원고의 모든 절 제목이 본문에 그대로 있다", () => {
  const sections = headings.filter((heading) => heading.level > 1);
  assert.ok(sections.length >= 4, "원고 절 제목을 읽지 못했습니다.");
  for (const heading of sections) {
    // 원문 레벨보다 한 칸 내려 쓴다 — 화면 제목 h1 은 탑바가 든다.
    const tag = `h${Math.min(6, heading.level + 1)}`;
    assert.ok(
      body.includes(`>${heading.text}</${tag}>`),
      `절 제목이 ${tag} 로 서지 않았습니다: ${heading.text}`,
    );
  }
});

test("본문 절 앵커는 #thoughts/ 아래에 있다", () => {
  const sections = headings.filter((heading) => heading.level > 1);
  for (const heading of sections) {
    assert.match(
      body,
      new RegExp(`id="thoughts/[^"]*"[^>]*>${heading.text}<`, "u"),
      `절 제목이 #thoughts/ 아래 앵커를 갖지 않았습니다: ${heading.text}`,
    );
  }
});

test("본문이 문서 조판 클래스를 달고 나온다", () => {
  // 소개와 같은 규칙을 타야 두 글이 같은 조판으로 읽힌다.
  assert.match(page, /id="thoughts-panel"[\s\S]{0,200}class="panel doc-panel"/u);
  assert.ok(
    page.includes('<div class="doc-body" id="thoughts-doc"'),
    "본문 상자가 문서 조판 클래스를 달지 않았습니다.",
  );
  for (const marker of ["<p>", "<strong>", 'class="doc-body"']) {
    assert.ok(body.includes(marker) || page.includes(marker), `본문에 ${marker} 가 없습니다.`);
  }
});

test("본문에 값이 새어 나간 흔적이 없다", () => {
  for (const token of ["undefined", "NaN", "—"]) {
    assert.ok(!body.includes(token), `본문에 ${token} 이 있습니다.`);
  }
});
