/**
 * 소개 화면 본문 생성기.
 *
 * 링크를 받은 사람은 저장소가 아니라 사이트를 연다. 그래서 저장소 README를
 * 사이트의 첫 화면으로도 읽히게 한다. 문서를 두 벌 만들지 않는 것이 이 스크립트의
 * 존재 이유다 — 원본은 `README.md` 하나이고, 빌드가 그것을 HTML로 옮겨 배포된
 * `index.html` 안에 끼워 넣는다. README는 한 글자도 고치지 않는다.
 *
 * 왜 빌드 시점인가
 * - 이 사이트는 외부 호스트로 요청을 보낼 수 없는 정적 사본이라 런타임 마크다운
 *   파서를 실을 수 없다.
 * - 소개는 첫 화면이다. 셸 안에 그대로 들어 있으면 받는 파일이 늘지 않고, 자바
 *   스크립트가 돌기 전에도 글이 서 있다.
 *
 * 왜 해시 검증 자산이 아닌가
 * - 무결성 사슬은 catalog가 발표한 바이트(상세·소스·벡터)를 지킨다. 그 사슬의
 *   뿌리는 배포 셸이고, 셸 자신은 대조 대상이 아니다. 소개 본문을 셸 안에 넣으면
 *   새로 받는 파일이 없으므로 지킬 바이트도 늘지 않는다. 반대로 자산으로 떼어
 *   내면 그 자산의 manifest를 다시 셸이 들게 되어, 사슬은 길어지는데 뿌리는 그대로다.
 *
 * `site/public/index.html`의 자리표시자를 정확히 한 번 갈아 끼운다. 자리표시자가
 * 없거나 여럿이면 세운다 — 조용히 넘어가면 소개가 빈 화면으로 게시된다.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { deployRoot } from "./deploy-paths.mjs";
import { renderMarkdown } from "./markdown.mjs";
import { renderFlowchartSvg } from "./mermaid.mjs";

/** 배포된 셸에서 이 문자열 자리에 소개 본문이 들어간다. */
const placeholder = "<!-- ABOUT-DOC -->";

/**
 * README의 `docs/*.md` 상대 링크가 가야 할 곳. 이 문서들은 저장소에만 있고
 * 사이트에는 실리지 않아, 그대로 두면 사이트에서 404가 된다.
 */
const documentBlobBase =
  "https://github.com/s-work-agency/ssw-algorithm-archive-public/blob/main/";

/**
 * 제목 앵커 id 앞에 붙는 말. 라우팅이 해시 하나로 화면을 정하므로, 본문 앵커가
 * 맨 slug(`#5-...`)면 화면 판정이 그 해시를 알고리즘 deep-link도 소개도 아닌
 * 것으로 보고 목록으로 떨어뜨린다. `#algorithm/<id>`와 같은 결로 한 겹 씌워
 * `#about/<slug>`로 두면, 소개 화면 안에서의 스크롤로만 동작한다.
 */
const anchorPrefix = "about/";

const readmePath = fileURLToPath(new URL("README.md", deployRoot));
const indexPath = fileURLToPath(new URL("index.html", deployRoot));

function createHrefRewriter(counts) {
  return (href) => {
    if (href.startsWith("#")) {
      counts.anchors += 1;
      return `#${anchorPrefix}${href.slice(1)}`;
    }
    if (href.startsWith("docs/")) {
      counts.documents += 1;
      return `${documentBlobBase}${href}`;
    }
    return href;
  };
}

/**
 * 본문 앵커가 실제로 있는 제목을 가리키는지 확인한다. README의 절 링크는
 * GitHub에서 쓰던 slug라, 제목 문구가 바뀌면 링크만 조용히 죽는다.
 */
function assertAnchorsResolve(stats) {
  const ids = new Set(stats.headings.map((heading) => heading.id));
  const broken = stats.links
    .filter((link) => link.source.startsWith("#"))
    .filter((link) => !ids.has(link.target.slice(1)));
  if (!broken.length) return;
  throw new Error(
    `README 안의 절 링크가 갈 제목을 찾지 못했습니다: ${broken
      .map((link) => link.source)
      .join(", ")}`,
  );
}

/**
 * mermaid 블록 → 인라인 SVG. 라이브러리를 실을 수 없다고 다이어그램을 코드
 * 덩어리로 내보내지는 않는다. 대신 우리가 쓰는 문법만 읽어 빌드가 그림을 만든다.
 *
 * 미니 렌더러가 못 읽는 블록을 만나면 여기서 예외가 그대로 올라가 빌드가 죽는다.
 * 조용히 코드 블록으로 떨구지 않는 것이 요점이다 — 나중에 README 의 다이어그램
 * 문법이 넓어졌을 때, 그림이 소리 없이 글자로 퇴행하는 대신 빌드가 먼저 멈춘다.
 */
function createFlowchartRenderer(diagrams) {
  return (code) => {
    const { html, stats } = renderFlowchartSvg(code, { index: diagrams.length });
    diagrams.push(stats);
    return html;
  };
}

async function main() {
  const counts = { anchors: 0, documents: 0 };
  const diagrams = [];
  const { html, stats } = renderMarkdown(await readFile(readmePath, "utf8"), {
    rewriteHref: createHrefRewriter(counts),
    headingIdPrefix: anchorPrefix,
    // 화면 제목(h1)은 탑바가 이미 들고 있다. 본문은 h2부터 시작해야 개요가 맞는다.
    headingLevelOffset: 1,
    fencedRenderers: { mermaid: createFlowchartRenderer(diagrams) },
  });
  assertAnchorsResolve(stats);

  const shell = await readFile(indexPath, "utf8");
  const occurrences = shell.split(placeholder).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `배포 셸에서 소개 본문 자리표시자를 정확히 한 번 찾지 못했습니다(${occurrences}번): ${placeholder}`,
    );
  }
  await writeFile(indexPath, shell.replace(placeholder, html), "utf8");

  const external = stats.links.filter((link) =>
    /^https?:\/\//u.test(link.source),
  ).length;
  console.log(`소개 본문 생성 완료: ${indexPath}`);
  console.log(
    `  제목 ${stats.headings.length}개 · 링크 ${stats.links.length}개(문서 ${counts.documents} · 본문 앵커 ${counts.anchors} · 바깥 주소 ${external})`,
  );
  console.log(
    `  코드 블록 ${stats.codeBlocks.length}개${
      stats.codeBlocks.length
        ? ` (${stats.codeBlocks.map((language) => language || "(언어 없음)").join(", ")})`
        : ""
    }`,
  );
  console.log(
    `  다이어그램 ${diagrams.length}개${
      diagrams.length
        ? ` (${diagrams
            .map(
              (diagram) =>
                `노드 ${diagram.nodes}·간선 ${diagram.edges}·${diagram.width}x${diagram.height}`,
            )
            .join(" / ")})`
        : ""
    }`,
  );
}

main().catch((error) => {
  console.error(
    `소개 본문 생성에 실패했습니다. 원인 유형: ${
      error instanceof Error ? error.name : typeof error
    }`,
  );
  console.error(error instanceof Error ? error.message : String(error));
  console.error(`README 원본: ${readmePath}`);
  console.error(`배포 셸: ${indexPath} (copy-static.mjs가 먼저 놓습니다.)`);
  if (error instanceof Error && error.stack) console.error(`상세 스택:\n${error.stack}`);
  process.exitCode = 1;
});
