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
const styles = await readFile(fileURLToPath(new URL("styles.css", deployRoot)), "utf8");

const blobBase =
  "https://github.com/s-work-agency/ssw-algorithm-archive-public/blob/main/";

/**
 * 사이트가 화면으로 싣고 있는 문서. 이쪽으로 가는 링크는 blob 주소가 아니라 그
 * 화면의 해시가 된다(scripts/build-pages.mjs의 siteDocuments와 같은 표다).
 */
const siteDocuments = { "docs/algorithm-thoughts.md": "#thoughts" };

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

test("사이트에 싣지 않는 docs 상대 링크가 GitHub blob 주소로 바뀌었다", () => {
  const documentLinks = readmeLinks
    .filter((href) => href.startsWith("docs/"))
    .filter((href) => !(href in siteDocuments));
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

test("사이트가 싣고 있는 문서로 가는 링크는 그 화면의 해시가 된다", () => {
  /*
    같은 글이 사이트 안에 화면으로 있는데도 GitHub 의 마크다운 원문으로 내보내면,
    읽던 사람이 사이트 밖으로 나간다. blob 주소로 새지 않는지까지 함께 본다.
  */
  // 네비에도 같은 해시가 있으므로, 보는 자리는 소개 본문 안으로 좁힌다.
  const aboutBody = page.slice(
    page.indexOf('id="about-doc"'),
    page.indexOf('id="thoughts-panel"'),
  );
  assert.ok(aboutBody.length > 0, "소개 본문을 읽지 못했습니다.");
  for (const [source, screenHash] of Object.entries(siteDocuments)) {
    assert.ok(
      readmeLinks.includes(source),
      `README 에서 ${source} 로 가는 링크가 사라졌습니다.`,
    );
    assert.ok(
      aboutBody.includes(`href="${screenHash}"`),
      `화면 해시로 바뀌지 않았습니다: ${source}`,
    );
    assert.ok(
      !page.includes(`${blobBase}${source}`),
      `blob 주소로 나갔습니다: ${source}`,
    );
  }
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

test("자기 자신을 가리키는 안내는 README 에만 남고 사이트에서는 빠진다", () => {
  const selfUrl = "https://s-work-agency.github.io/ssw-algorithm-archive-public/";
  // 저장소를 먼저 본 사람에게는 사이트로 들어오는 문이라 원문에는 남긴다.
  assert.ok(readme.includes(selfUrl), "README 에서 사이트 주소가 사라졌습니다.");
  assert.ok(
    readme.includes("<!-- site-only-skip-start -->"),
    "README 에 빼기 마커가 없습니다.",
  );
  // 사이트를 보고 있는 사람에게는 자기 자신을 가리키는 링크라 읽을 이유가 없다.
  assert.ok(!page.includes(selfUrl), "사이트에 자기 참조 주소가 남아 있습니다.");
  // 마커 자체도 화면에 새어 나가면 안 된다.
  assert.ok(!page.includes("site-only-skip"), "빼기 마커가 화면에 새어 나갔습니다.");
});

test("빠지는 것은 그 구간 하나뿐이다", () => {
  // 규칙이 조용히 다른 블록까지 집어가면 여기서 잡힌다. README 의 인용 중
  // 사이트 주소 안내 하나만 빠지고 나머지는 그대로 서 있어야 한다.
  const readmeQuotes = [...readme.matchAll(/(?:^>.*\n)+/gmu)].length;
  const pageQuotes = [...page.matchAll(/class="doc-quote"/gu)].length;
  assert.equal(readmeQuotes, 3, "README 의 인용 블록 수가 달라졌습니다.");
  assert.equal(pageQuotes, readmeQuotes - 1, "빠진 블록 수가 1개가 아닙니다.");
  for (const kept of [
    "본체 구현과 콘텐츠",
    "덧붙이면 이 기능은 원래 계획에",
  ]) {
    assert.ok(page.includes(kept), `남아야 할 인용까지 빠졌습니다: ${kept}`);
  }
});

test("7절 기원 일화는 일반 문단이 아니라 인용 카드로 선다", () => {
  const anecdote = "덧붙이면 이 기능은 원래 계획에";
  // README 에서 인용으로 적혀야 빌드가 .doc-quote 카드로 렌더한다.
  assert.match(readme, new RegExp(`^> ${anecdote}`, "mu"));
  const card = new RegExp(
    `<blockquote class="doc-quote">[\\s\\S]*?${anecdote}`,
    "u",
  );
  assert.match(page, card, "일화가 인용 카드로 서지 않았습니다.");
});

/** README 의 mermaid 블록. 노드 정의 줄과 화살표 수가 곧 기대값이다. */
const readmeDiagrams = [
  ...readme.matchAll(/^```mermaid$\n([\s\S]*?)^```$/gmu),
].map((matched) => {
  const body = matched[1];
  return {
    nodes: [...body.matchAll(/^\s*[A-Za-z][A-Za-z0-9_]*\s*[[{]"/gmu)].length,
    edges: [...body.matchAll(/-->/gu)].length,
  };
});

/** 게시된 본문 안의 흐름도 SVG. 원본 블록과 하나씩 짝지어 센다. */
const pageDiagrams = [
  ...page.matchAll(/<svg class="doc-figure__svg"[\s\S]*?<\/svg>/gu),
].map((matched) => {
  const svg = matched[0];
  return {
    nodes: [...svg.matchAll(/class="doc-figure__box[" ]/gu)].length,
    edges: [...svg.matchAll(/class="doc-figure__edge"/gu)].length,
  };
});

test("mermaid 블록은 코드가 아니라 다이어그램으로 나간다", () => {
  assert.ok(readmeDiagrams.length > 0, "README 에 mermaid 블록이 없습니다.");
  assert.equal(
    pageDiagrams.length,
    readmeDiagrams.length,
    "그려진 흐름도 수가 README 의 mermaid 블록 수와 다릅니다.",
  );
  // 코드 블록으로 퇴행하면 여기서 잡힌다. 빌드가 먼저 죽어야 정상이지만,
  // 게시된 결과에서도 한 번 더 본다.
  assert.ok(
    !page.includes('data-language="mermaid"'),
    "mermaid 가 코드 블록으로 나갔습니다.",
  );
});

test("흐름도 SVG 에 수가 아닌 좌표가 없다", () => {
  /*
    붙잡는 회귀: 상자 폭을 층별로 바꾸면서 폭을 읽던 자리가 빗나가
    width="undefined" 로 직렬화되던 것. SVG 는 속성값이 틀려도 문서를 거절하지
    않고 그 도형만 조용히 건너뛴다. 그래서 노드 수·간선 수를 세는 검사는 그대로
    통과했고(요소는 다 있었다) 화면에서는 상자와 선이 사라졌다.

    개수가 아니라 좌표를 본다.
  */
  const svgs = [...page.matchAll(/<svg class="doc-figure__svg"[\s\S]*?<\/svg>/gu)]
    .map((matched) => matched[0]);
  assert.ok(svgs.length > 0, "그림이 없습니다.");
  for (const [index, svg] of svgs.entries()) {
    const broken = /\b(?:undefined|NaN)\b/u.exec(svg);
    assert.equal(
      broken,
      null,
      `${index + 1}번째 그림에 ${broken?.[0]} 이 직렬화됐습니다.`,
    );
  }
});

test("흐름도의 상자마다 실제 크기가 박혀 있다", () => {
  const rects = [...page.matchAll(/<rect class="doc-figure__box"([^>]*)\/>/gu)];
  assert.ok(rects.length >= 11, "상자를 읽지 못했습니다.");
  for (const [, attributes] of rects) {
    for (const name of ["x", "y", "width", "height"]) {
      const value = new RegExp(`${name}="([^"]*)"`, "u").exec(attributes)?.[1];
      const number = Number(value);
      assert.ok(
        Number.isFinite(number),
        `상자 ${name} 이 수가 아닙니다: ${value}`,
      );
      if (name === "width" || name === "height") {
        assert.ok(number > 0, `상자 ${name} 이 0 이하입니다: ${value}`);
      }
    }
  }
  // 판단 노드는 육각형이라 path 로 나간다. 좌표가 전부 수여야 한다.
  for (const [, path] of page.matchAll(
    /class="doc-figure__box doc-figure__box--decision" d="([^"]*)"/gu,
  )) {
    for (const token of path.match(/-?\d+(?:\.\d+)?|[A-Za-z]+/gu) ?? []) {
      if (/^[A-Za-z]+$/u.test(token)) continue;
      assert.ok(Number.isFinite(Number(token)), `판단 노드 좌표: ${token}`);
    }
  }
});

test("흐름도가 쓰는 클래스에 면과 선이 실제로 걸려 있다", () => {
  /*
    좌표가 멀쩡해도 색 규칙이 없으면 상자는 보이지 않는다. 클래스 이름만 붙어
    있는지가 아니라, 그 클래스에 fill·stroke 가 선언돼 있고 참조하는 토큰이
    실존하는지까지 본다.
  */
  const required = {
    "doc-figure__box": ["fill", "stroke"],
    "doc-figure__box--decision": ["fill", "stroke"],
    "doc-figure__edge": ["stroke"],
    "doc-figure__arrowhead": ["fill"],
    "doc-figure__text": ["fill"],
  };
  for (const [className, properties] of Object.entries(required)) {
    assert.ok(
      page.includes(`class="doc-figure__box doc-figure__box--decision"`) ||
        className !== "doc-figure__box--decision",
      "판단 노드 클래스가 화면에 없습니다.",
    );
    const rule = new RegExp(
      `\\.${className.replace(/--/gu, "--")}\\s*\\{([^}]*)\\}`,
      "u",
    ).exec(styles);
    assert.ok(rule, `styles.css 에 .${className} 규칙이 없습니다.`);
    for (const property of properties) {
      const declaration = new RegExp(`(^|;|\\s)${property}:\\s*([^;]+)`, "u").exec(
        rule[1],
      );
      assert.ok(
        declaration,
        `.${className} 에 ${property} 선언이 없습니다.`,
      );
      // var(--토큰)을 쓰면 그 토큰이 실제로 정의돼 있어야 한다.
      const token = /var\((--[a-z0-9-]+)\)/u.exec(declaration[2]);
      if (!token) continue;
      assert.ok(
        new RegExp(`${token[1]}:\\s*[^;]+;`, "u").test(styles),
        `${token[1]} 토큰이 정의돼 있지 않습니다 (.${className} ${property}).`,
      );
    }
  }
});

test("흐름도의 노드 수·간선 수가 README 원본과 일치한다", () => {
  for (const [index, expected] of readmeDiagrams.entries()) {
    assert.deepEqual(
      pageDiagrams[index],
      expected,
      `${index + 1}번째 흐름도의 노드·간선 수가 원본과 다릅니다.`,
    );
  }
});

test("흐름도는 자기 상자 안에서만 가로로 스크롤한다", () => {
  // 페이지 전체가 옆으로 밀리면 안 된다. 스크롤 상자는 figure 가 든다.
  assert.match(page, /<figure class="doc-figure">/u);
  assert.match(styles, /\.doc-figure \{[^}]*overflow-x: auto/u);
});

test("흐름도 노드 라벨이 README 원문 그대로 그려진다", () => {
  // 라벨은 README 의 mermaid 블록이 정본이다. 산출물만 고치면 GitHub 렌더와
  // 어긋나므로, 원문에 있는 문구가 그림에도 있는지 짝지어 본다.
  const labels = [...readme.matchAll(/^\s*[A-Za-z][A-Za-z0-9_]*\s*[[{]"([^"]*)"/gmu)]
    .map((matched) => matched[1])
    .flatMap((label) => label.split(/<br\s*\/?>/iu))
    .map((line) => line.replace(/<\/?b>/giu, "").trim())
    .filter(Boolean);
  assert.ok(labels.length >= 13, "README 에서 노드 라벨을 읽지 못했습니다.");
  for (const label of labels) {
    // 긴 줄은 그림 안에서 접히므로 낱말 단위로 확인한다.
    for (const word of label.split(" ")) {
      assert.ok(
        page.includes(word),
        `노드 라벨이 그림에 없습니다: ${label} (${word})`,
      );
    }
  }
});

test("표는 본문 컬럼 폭에 맞춰 서고 남는 폭은 마지막 열이 받는다", () => {
  // README 의 표가 하나도 빠지지 않고 같은 조판을 받아야 한다.
  const readmeTables = readme
    .split("\n")
    .filter((line) => /^\|[\s:|-]+$/u.test(line) && line.includes("---")).length;
  const pageTables = [...page.matchAll(/class="data-table doc-table"/gu)].length;
  assert.ok(readmeTables > 0, "README 에 표가 없습니다.");
  assert.equal(pageTables, readmeTables, "표 수가 README 와 다릅니다.");
  // 표만 더 넓으면 짧은 표가 그 폭을 못 채워 설명 열 뒤로 빈 자리가 남는다.
  assert.match(
    styles,
    /\.doc-body > \.table-wrap \{[^}]*max-width: var\(--doc-measure\)/u,
  );
  assert.match(styles, /\.doc-table \{[^}]*min-width: 0/u);
  assert.match(
    styles,
    /\.doc-table th:not\(:last-child\),\s*\.doc-table td:not\(:last-child\) \{[^}]*width: 1%/u,
  );
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

test("문서의 모든 블록이 하나의 가운데 축을 쓴다", () => {
  /*
    폭은 요소마다 달라도 되지만 가운데 축은 하나여야 한다. 축이 갈라졌던 원인은
    margin 단축 속성이었다. margin: 0 0 1.4rem 은 좌우를 0으로 함께 덮어
    margin-inline: auto 를 지우고, 그 요소만 왼쪽으로 치우친 축에 세운다.
    인용 카드·구분선·코드·흐름도가 실제로 그렇게 어긋나 있었다.

    그래서 여기서 잠그는 것은 개별 요소가 아니라 그 원인이다. 문서 조판 규칙
    어디에도 margin 단축 속성이 없어야 한다. 새 블록이 추가돼도, 읽을거리 화면이
    늘어도 같은 함정을 다시 밟지 않는다.
  */
  assert.match(styles, /\.doc-body > \* \{[^}]*margin-inline: auto/u);
  assert.match(styles, /\.doc-body > \* \{[^}]*max-width: var\(--doc-measure\)/u);
  const documentRules = [...styles.matchAll(/(\.doc-[a-z-]+[^{]*)\{([^}]*)\}/gu)];
  assert.ok(documentRules.length > 10, "문서 조판 규칙을 읽지 못했습니다.");
  const offenders = documentRules
    .filter(([, , body]) => /(^|;|\s)margin:\s/u.test(body))
    .map(([, selector]) => selector.trim());
  assert.deepEqual(
    offenders,
    [],
    `margin 단축 속성이 좌우 정렬을 덮습니다. margin-block 을 쓰세요: ${offenders.join(", ")}`,
  );
});

test("본문 컬럼과 CTA 가 카드 안에서 가운데로 놓인다", () => {
  // 왼쪽에 붙여 두면 넓은 화면에서 오른쪽에만 큰 여백이 남는다.
  assert.match(styles, /\.doc-body > \* \{[^}]*margin-inline: auto/u);
  assert.match(styles, /\.doc-panel__heading \{[^}]*margin-inline: auto/u);
  // CTA 줄은 본문 컬럼과 같은 폭을 써야 버튼이 카드 구석으로 떠나지 않는다.
  assert.match(
    styles,
    /\.doc-panel__heading \{[^}]*width: min\(100%, var\(--doc-measure\)\)/u,
  );
});
