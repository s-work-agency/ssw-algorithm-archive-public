/*
  게시된 소개 화면 검사.

  markdown.test.mjs 가 변환기의 규칙을 잠근다면, 여기서는 그 규칙이 실제 README 에
  걸려 나온 배포물을 본다 — 읽는 것은 소스가 아니라 배포 루트의 index.html 이다.
  기대값도 README.md 에서 그때그때 뽑는다. 문서에 절이 하나 늘거나 링크가 바뀌면
  기대값도 함께 움직여야, 이 테스트가 "예전 README" 를 잠그는 물건이 되지 않는다.

  붙잡는 사고 셋.
  - 자리표시자만 남고 본문이 들어가지 않은 채 게시되는 것.
  - README 의 docs/*.md 상대 링크가 그대로 나가 사이트에서 404 가 되는 것.
  - 본문 절 앵커가 라우팅과 부딪혀 소개에서 목록으로 튕기는 것.
*/
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const deployRoot = new URL("../../", import.meta.url);
const readme = await readFile(fileURLToPath(new URL("README.md", deployRoot)), "utf8");
const page = await readFile(fileURLToPath(new URL("index.html", deployRoot)), "utf8");

const blobBase =
  "https://github.com/s-work-agency/ssw-algorithm-archive-public/blob/main/";

/** README 의 제목 줄 전부. `#` 개수와 문구를 그대로 들고 온다. */
const readmeHeadings = [...readme.matchAll(/^(#{1,6})\s+(.+?)\s*$/gmu)].map(
  (matched) => ({ level: matched[1].length, text: matched[2] }),
);

/** README 안의 링크 전부. */
const readmeLinks = [...readme.matchAll(/\[([^\]\n]*)\]\(([^)\s]+)\)/gu)].map(
  (matched) => matched[2],
);

test("자리표시자가 남지 않고 본문이 들어갔다", () => {
  assert.ok(!page.includes("<!-- ABOUT-DOC -->"), "자리표시자가 그대로 남았습니다.");
  assert.ok(page.includes('id="about-doc"'), "소개 본문 상자가 없습니다.");
  assert.ok(page.includes('id="about-panel"'), "소개 패널이 없습니다.");
});

test("소개가 사이드바 맨 위 항목이고 기본 활성 표시를 든다", () => {
  const aboutIndex = page.indexOf('id="nav-about"');
  const listIndex = page.indexOf('id="catalog-tab-list"');
  assert.ok(aboutIndex > 0, "소개 네비 항목이 없습니다.");
  assert.ok(aboutIndex < listIndex, "소개가 목록보다 뒤에 있습니다.");
  // 정적 HTML 이 서는 첫 화면도 소개여야 스크립트가 늦게 붙어도 표시가 맞다.
  assert.match(page, /id="nav-about"[\s\S]{0,120}aria-current="page"/u);
  assert.match(page, /<div id="catalog-screen" hidden>/u);
});

test("목록으로 가는 CTA 가 소개 화면 안에 있다", () => {
  const panel = page.slice(
    page.indexOf('id="about-panel"'),
    page.indexOf('id="about-doc"'),
  );
  assert.match(panel, /id="about-cta"/u);
  assert.match(panel, /href="#list"/u);
});

test("README 의 모든 제목이 소개 본문에 그대로 있다", () => {
  // 원문 레벨보다 한 칸 내려 쓴다 — 화면 제목 h1 은 탑바가 든다.
  assert.ok(readmeHeadings.length >= 9, "README 제목을 읽지 못했습니다.");
  for (const heading of readmeHeadings) {
    const tag = `h${Math.min(6, heading.level + 1)}`;
    assert.ok(
      page.includes(`>${heading.text}</${tag}>`),
      `제목이 ${tag} 로 서지 않았습니다: ${heading.text}`,
    );
  }
});

test("docs 상대 링크가 GitHub blob 주소로 바뀌었다", () => {
  const documentLinks = readmeLinks.filter((href) => href.startsWith("docs/"));
  assert.ok(documentLinks.length > 0, "README 에 docs 링크가 없습니다.");
  for (const href of documentLinks) {
    assert.ok(
      page.includes(`href="${blobBase}${href}"`),
      `blob 주소로 바뀌지 않았습니다: ${href}`,
    );
  }
  // 사이트에는 docs/ 가 실리지 않는다. 상대 경로가 하나라도 남으면 404 가 된다.
  assert.ok(!page.includes('href="docs/'), "docs 상대 링크가 남아 있습니다.");
});

test("본문 절 앵커는 #about/ 아래에 있고 갈 제목이 실제로 있다", () => {
  const anchors = readmeLinks.filter((href) => href.startsWith("#"));
  assert.ok(anchors.length > 0, "README 에 절 링크가 없습니다.");
  for (const href of anchors) {
    const target = `about/${href.slice(1)}`;
    assert.ok(
      page.includes(`href="#${target}"`),
      `절 링크가 #about/ 아래로 옮겨지지 않았습니다: ${href}`,
    );
    assert.ok(
      page.includes(`id="${target}"`),
      `절 링크가 갈 제목이 없습니다: ${href}`,
    );
  }
});

test("사이트 자기 주소는 그대로 두고 링크로 세운다", () => {
  const selfUrl = "https://s-work-agency.github.io/ssw-algorithm-archive-public/";
  assert.ok(readme.includes(selfUrl), "README 에 사이트 주소가 없습니다.");
  assert.ok(page.includes(`href="${selfUrl}"`), "사이트 주소가 링크로 서지 않았습니다.");
});

test("mermaid 블록은 그리지 않고 코드 그대로 내보낸다", () => {
  const fences = [...readme.matchAll(/^```mermaid$/gmu)].length;
  assert.ok(fences > 0, "README 에 mermaid 블록이 없습니다.");
  assert.equal(
    [...page.matchAll(/data-language="mermaid"/gu)].length,
    fences,
    "mermaid 블록 수가 README 와 다릅니다.",
  );
  // 블록 안 <b> 는 문자로 나가야 한다. 태그로 새면 이스케이프가 뚫린 것이다.
  assert.ok(page.includes("&lt;b&gt;"), "코드 블록 안 태그가 이스케이프되지 않았습니다.");
});

test("소개 본문이 문서 조판 클래스를 달고 나온다", () => {
  for (const marker of [
    'class="doc-quote"',
    'class="doc-list"',
    'class="doc-rule"',
    'class="data-table doc-table"',
    "<strong>",
  ]) {
    assert.ok(page.includes(marker), `본문에 ${marker} 가 없습니다.`);
  }
});
