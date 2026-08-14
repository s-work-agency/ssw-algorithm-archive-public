/*
  빌드 시점 마크다운 변환기 테스트.

  이 사이트는 런타임 마크다운 파서를 실을 수 없어(외부 호스트 요청 금지) 변환을
  빌드가 끝낸다. 그래서 변환기가 틀리면 잘못된 HTML 이 그대로 게시되고, 화면에서는
  아무 오류도 나지 않는다 — 여기서 잡지 않으면 아무 데서도 안 잡힌다.

  잠그는 것은 README.md 가 실제로 쓰는 문법과, 그 문법이 만드는 함정 둘이다.
  - 문단 안 줄바꿈을 이어 붙인 뒤에 인라인을 해석해야 한다(README 에 줄을 넘어가는
    굵게·인라인 코드가 실제로 있다).
  - 별표 하나는 강조가 아니다(README 에 A* 가 나온다).
*/
import assert from "node:assert/strict";
import test from "node:test";
import { renderMarkdown, slugify } from "../scripts/markdown.mjs";

const render = (markdown, options) => renderMarkdown(markdown, options).html;

test("제목은 레벨을 내려 쓰고 GitHub 규칙의 앵커를 단다", () => {
  const { html, stats } = renderMarkdown("# 제목\n\n## 1. 가볍게 시작했습니다\n", {
    headingLevelOffset: 1,
    headingIdPrefix: "about/",
  });
  assert.match(html, /<h2 id="about\/제목">제목<\/h2>/u);
  assert.match(
    html,
    /<h3 id="about\/1-가볍게-시작했습니다">1\. 가볍게 시작했습니다<\/h3>/u,
  );
  assert.deepEqual(
    stats.headings.map((heading) => heading.id),
    ["about/제목", "about/1-가볍게-시작했습니다"],
  );
});

test("앵커 slug 는 문장부호를 버리고 공백을 하이픈으로 바꾼다", () => {
  // README 의 절 링크(#5-우선은-5000에서-멈춥니다)가 이 규칙으로 만들어져 있다.
  assert.equal(slugify("5. 우선은 5,000에서 멈춥니다"), "5-우선은-5000에서-멈춥니다");
  assert.equal(
    slugify("6. 그래서 이 사이트에 이것을 담았습니다"),
    "6-그래서-이-사이트에-이것을-담았습니다",
  );
});

test("문단 안 줄바꿈은 공백으로 이어 붙인다", () => {
  assert.equal(render("첫 줄이고\n둘째 줄이다.\n"), "<p>첫 줄이고 둘째 줄이다.</p>");
});

test("줄을 넘어가는 굵게·인라인 코드가 깨지지 않는다", () => {
  // 이어 붙이기 전에 인라인을 해석하면 여기서 강조와 코드가 문자로 새어 나온다.
  assert.equal(
    render("어디서\n부러지는지 **두 줄에\n걸친 강조**입니다.\n"),
    "<p>어디서 부러지는지 <strong>두 줄에 걸친 강조</strong>입니다.</p>",
  );
  assert.equal(
    render("`\"positive signed 32-bit integer (1 through\n2147483647)\"` 처럼\n"),
    '<p><code>&quot;positive signed 32-bit integer (1 through 2147483647)&quot;</code> 처럼</p>',
  );
});

test("별표 하나는 강조가 아니다", () => {
  // README 본문과 표에 A*(A 스타)가 나온다. 하나짜리를 강조로 받으면 그 별표가
  // 짝을 찾아 뒤 문장을 통째로 삼킨다.
  assert.equal(
    render("A* 는 휴리스틱을 쓰고 *별표* 는 그대로 남는다.\n"),
    "<p>A* 는 휴리스틱을 쓰고 *별표* 는 그대로 남는다.</p>",
  );
});

test("링크 주소는 rewriteHref 가 갈아 끼운다", () => {
  const html = render("[검증 파이프라인](docs/verification-pipeline.md#3-관례)\n", {
    rewriteHref: (href) => `https://example.test/${href}`,
  });
  assert.equal(
    html,
    '<p><a href="https://example.test/docs/verification-pipeline.md#3-관례" rel="noreferrer">검증 파이프라인</a></p>',
  );
});

test("링크 라벨 안의 굵게도 함께 해석한다", () => {
  assert.equal(
    render("[**굵은 라벨**](#어딘가)\n"),
    '<p><a href="#어딘가"><strong>굵은 라벨</strong></a></p>',
  );
});

test("맨 주소는 자동으로 링크가 된다", () => {
  assert.equal(
    render("주소 — https://example.test/path/ 입니다.\n"),
    '<p>주소 — <a href="https://example.test/path/" rel="noreferrer">https://example.test/path/</a> 입니다.</p>',
  );
});

test("인용은 여러 줄을 한 문단으로 담는다", () => {
  assert.equal(
    render("> **공개 사이트 주소** — 어딘가\n> 그대로 서빙됩니다.\n"),
    '<blockquote class="doc-quote">\n<p><strong>공개 사이트 주소</strong> — 어딘가 그대로 서빙됩니다.</p>\n</blockquote>',
  );
});

test("목록의 들여쓴 줄은 같은 항목의 계속이다", () => {
  assert.equal(
    render("- 첫 항목이고\n  이어지는 줄이다.\n- 둘째 항목.\n"),
    '<ul class="doc-list">\n<li>첫 항목이고 이어지는 줄이다.</li>\n<li>둘째 항목.</li>\n</ul>',
  );
});

test("표는 가로 스크롤 래퍼와 데이터 표 어법을 그대로 쓴다", () => {
  const html = render("| 알고리즘 | 분류 |\n|---|---|\n| A* | 그래프 |\n");
  assert.match(html, /<div class="table-wrap">/u);
  assert.match(html, /<table class="data-table doc-table">/u);
  assert.match(html, /<th scope="col">알고리즘<\/th>/u);
  assert.match(html, /<td>A\*<\/td>/u);
});

test("표 바로 앞 문단이 표 머리 행을 삼키지 않는다", () => {
  const html = render("앞 문단이다.\n| 가 | 나 |\n|---|---|\n| 1 | 2 |\n");
  assert.match(html, /<p>앞 문단이다\.<\/p>/u);
  assert.match(html, /<th scope="col">가<\/th>/u);
});

test("구분선은 표 구분 행과 갈린다", () => {
  assert.equal(render("---\n"), '<hr class="doc-rule" />');
});

test("코드 블록은 원문 그대로 이스케이프하고 언어만 표시로 남긴다", () => {
  const { html, stats } = renderMarkdown(
    '```json\n{"a": "<b>"}\n```\n',
  );
  assert.match(html, /<pre class="doc-code" data-language="json"><code>/u);
  assert.match(html, /&lt;b&gt;/u);
  assert.doesNotMatch(html, /<b>/u);
  assert.deepEqual(stats.codeBlocks, ["json"]);
});

test("언어 전용 렌더러가 등록되면 코드 블록 대신 그쪽이 그린다", () => {
  // 다이어그램처럼 그림으로 세워야 하는 블록이 이 길로 빠진다.
  const html = render("```mermaid\nflowchart LR\n```\n", {
    fencedRenderers: { mermaid: (code) => `<figure>${code.trim()}</figure>` },
  });
  assert.equal(html, "<figure>flowchart LR</figure>");
  assert.doesNotMatch(html, /<pre/u);
});

test("언어 전용 렌더러가 세우면 그대로 올려 보낸다", () => {
  // 삼키면 그려야 할 것이 코드 블록으로 조용히 퇴행한다. 빌드가 멈춰야 한다.
  assert.throws(
    () =>
      render("```mermaid\n못 읽는 것\n```\n", {
        fencedRenderers: {
          mermaid: () => {
            throw new Error("읽을 수 없는 mermaid 문법입니다");
          },
        },
      }),
    /읽을 수 없는 mermaid 문법입니다/u,
  );
});

test("HTML 주석은 화면에 나가지 않는다", () => {
  assert.equal(render("<!-- 메모 -->\n\n본문입니다.\n"), "<p>본문입니다.</p>");
  // 여러 줄에 걸친 주석도 한 덩어리로 버린다.
  assert.equal(render("<!-- 첫 줄\n둘째 줄 -->\n\n본문.\n"), "<p>본문.</p>");
});

test("skipRegion 마커 사이는 블록째로 빠지고 그 수가 세어진다", () => {
  const source = [
    "앞 문단.",
    "",
    "<!-- skip-start -->",
    "",
    "> 빠질 인용",
    "",
    "빠질 문단.",
    "",
    "<!-- skip-end -->",
    "",
    "뒤 문단.",
  ].join("\n");
  const { html, stats } = renderMarkdown(source, {
    skipRegion: { start: "skip-start", end: "skip-end" },
  });
  assert.equal(html, "<p>앞 문단.</p>\n<p>뒤 문단.</p>");
  // 몇 개를 뺐는지 세어 두어야 부르는 쪽이 그 수를 고정할 수 있다.
  assert.equal(stats.skippedRegions, 1);
});

test("마커를 주지 않으면 아무것도 빠지지 않는다", () => {
  const { html, stats } = renderMarkdown("<!-- skip-start -->\n\n본문.\n");
  assert.equal(html, "<p>본문.</p>");
  assert.equal(stats.skippedRegions, 0);
});

test("마커가 짝을 잃으면 조용히 넘어가지 않는다", () => {
  const skipRegion = { start: "skip-start", end: "skip-end" };
  // 닫는 마커가 없으면 뒤 본문이 통째로 사라진다. 그 전에 세운다.
  assert.throws(
    () =>
      renderMarkdown("<!-- skip-start -->\n\n본문.\n", { skipRegion }),
    /닫는 마커를 찾지 못했습니다/u,
  );
  // 여는 마커 없이 닫는 마커만 있는 것도 원문이 어긋난 상태다.
  assert.throws(
    () => renderMarkdown("본문.\n\n<!-- skip-end -->\n", { skipRegion }),
    /여는 짝 없이 닫는 마커만/u,
  );
  assert.throws(
    () => renderMarkdown("<!-- 닫히지 않은 주석\n본문.\n"),
    /닫히지 않은 HTML 주석/u,
  );
});

test("원문 HTML 은 문자로 내보낸다", () => {
  assert.equal(
    render("<script>alert(1)</script>\n"),
    "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
  );
});

test("닫히지 않은 코드 블록은 조용히 넘어가지 않는다", () => {
  assert.throws(() => render("```\n열린 채로 끝난다\n"), /닫히지 않은 코드 블록/u);
});
