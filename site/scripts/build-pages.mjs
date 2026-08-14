/**
 * 읽을거리 화면 본문 생성기.
 *
 * 저장소에 있는 마크다운 문서를 사이트 화면으로도 읽히게 한다. 문서를 두 벌
 * 만들지 않는 것이 이 스크립트의 존재 이유다. 원본은 저장소의 그 파일 하나이고,
 * 빌드가 그것을 HTML로 옮겨 배포된 `index.html` 안에 끼워 넣는다. 원본은 한
 * 글자도 고치지 않는다.
 *
 * 지금 싣는 것은 둘이다.
 * - 소개: `README.md`. 링크를 받은 사람은 저장소가 아니라 사이트를 여니까,
 *   프로젝트의 이야기가 사이트에서 읽혀야 한다. 첫 화면이다.
 * - 생각: `docs/algorithm-thoughts.md`. 알고리즘을 어떻게 보아 왔는지에 대한
 *   짧은 글이고, 그 관점이 아카이브의 설계로 이어진다.
 *
 * 왜 빌드 시점인가
 * - 이 사이트는 외부 호스트로 요청을 보낼 수 없는 정적 사본이라 런타임 마크다운
 *   파서를 실을 수 없다.
 * - 둘 다 셸 안에 그대로 들어 있으면 받는 파일이 늘지 않고, 자바스크립트가 돌기
 *   전에도 글이 서 있다.
 *
 * 왜 해시 검증 자산이 아닌가
 * - 무결성 사슬은 catalog가 발표한 바이트(상세·소스·벡터)를 지킨다. 그 사슬의
 *   뿌리는 배포 셸이고, 셸 자신은 대조 대상이 아니다. 본문을 셸 안에 넣으면
 *   새로 받는 파일이 없으므로 지킬 바이트도 늘지 않는다. 반대로 자산으로 떼어
 *   내면 그 자산의 manifest를 다시 셸이 들게 되어, 사슬은 길어지는데 뿌리는 그대로다.
 *
 * 각 화면의 자리표시자를 정확히 한 번씩 갈아 끼운다. 자리표시자가 없거나 여럿이면
 * 세운다. 조용히 넘어가면 그 화면이 빈 채로 게시된다.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { deployRoot } from "./deploy-paths.mjs";
import { renderMarkdown } from "./markdown.mjs";
import { renderFlowchartSvg } from "./mermaid.mjs";

/**
 * 사이트에 싣지 않는 문서로 가는 링크가 갈 곳. 그 문서들은 저장소에만 있어
 * 상대 경로 그대로 두면 사이트에서 404가 된다.
 */
const documentBlobBase =
  "https://github.com/s-work-agency/ssw-algorithm-archive-public/blob/main/";

/**
 * 사이트가 화면으로 싣고 있는 문서. 이쪽으로 가는 링크는 저장소가 아니라 그
 * 화면의 해시로 보낸다. 사이트를 보는 사람을 굳이 GitHub의 마크다운 원문으로
 * 내보낼 이유가 없다. 저장소에서 읽는 사람에게는 원래의 상대 경로가 그대로
 * 살아 있으므로 양쪽 모두 갈 곳이 맞는다.
 */
const siteDocuments = {
  "README.md": "#about",
  "docs/algorithm-thoughts.md": "#thoughts",
};

/**
 * 이 사본에서만 빼는 구간을 감싸는 주석. 원문에는 그대로 남는다.
 *
 * 지금 이 마커가 감싸는 것은 둘이다.
 * - README의 공개 사이트 주소 안내. 저장소를 먼저 본 사람에게는 사이트로
 *   들어오는 문이지만, 이미 사이트를 보고 있는 사람에게는 자기 자신을 가리키는
 *   링크라 읽을 이유가 없다.
 * - 생각의 문서 제목(h1). 이 화면에서는 탑바가 같은 제목을 들고 있어, 본문에
 *   한 번 더 두면 같은 문장이 두 번 찍힌다. 저장소에서 읽는 사람에게는 문서의
 *   제목이 필요하므로 원문에서는 빼지 않는다.
 *
 * HTML 주석이라 GitHub 렌더에는 나타나지 않는다. 마커 방식을 고른 이유는
 * "자기 URL을 든 인용을 거른다" 같은 규칙이 나중에 다른 블록까지 조용히 집어갈
 * 수 있기 때문이다. 무엇을 빼는지 원문에 눈으로 보이게 적어 두는 편이 안전하다.
 */
const skipRegion = {
  start: "site-only-skip-start",
  end: "site-only-skip-end",
};

/**
 * 싣는 화면들. `skipRegions`는 그 문서에서 빼기로 한 구간 수이고, 어긋나면
 * 세운다. 마커가 지워지면(0개) 빼려던 대목이 조용히 실리고, 늘어나면 의도하지
 * 않은 대목이 사라진다. 둘 다 화면을 봐야만 눈에 띄는 종류라 빌드에서 잡는다.
 *
 * `anchorPrefix`는 본문 제목 앵커에 씌우는 앞머리다. 라우팅이 해시 하나로 화면을
 * 정하므로, 본문 앵커가 맨 slug(`#5-...`)면 화면 판정이 그 해시를 어느 화면도
 * 아닌 것으로 보고 목록으로 떨어뜨린다. `#algorithm/<id>`와 같은 결로 한 겹
 * 씌우면 그 화면 안에서의 스크롤로만 동작한다. navigation.ts가 같은 앞머리를
 * 알고 있어야 하므로, 바꿀 때는 둘을 함께 본다.
 */
const pages = [
  {
    name: "소개",
    source: "README.md",
    placeholder: "<!-- ABOUT-DOC -->",
    anchorPrefix: "about/",
    skipRegions: 1,
  },
  {
    name: "생각",
    source: "docs/algorithm-thoughts.md",
    placeholder: "<!-- THOUGHTS-DOC -->",
    anchorPrefix: "thoughts/",
    // 문서 제목 하나. 이 화면에서는 탑바가 같은 제목을 든다.
    skipRegions: 1,
  },
];

const indexPath = fileURLToPath(new URL("index.html", deployRoot));

/** 원본이 놓인 자리 기준의 상대 경로를 저장소 루트 기준으로 편다. */
function resolveRepoPath(sourcePath, href) {
  const segments = sourcePath.split("/").slice(0, -1);
  for (const part of href.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }
  return segments.join("/");
}

function createHrefRewriter(page, counts) {
  return (href) => {
    if (href.startsWith("#")) {
      counts.anchors += 1;
      return `#${page.anchorPrefix}${href.slice(1)}`;
    }
    if (/^[a-z]+:/u.test(href)) return href;
    const [path, fragment] = href.split("#");
    const repoPath = resolveRepoPath(page.source, path);
    const screenHash = siteDocuments[repoPath];
    if (screenHash) {
      counts.screens += 1;
      return fragment ? `${screenHash}/${fragment}` : screenHash;
    }
    if (repoPath.endsWith(".md")) {
      counts.documents += 1;
      return `${documentBlobBase}${repoPath}${fragment ? `#${fragment}` : ""}`;
    }
    return href;
  };
}

/**
 * 본문 앵커가 실제로 있는 제목을 가리키는지 확인한다. 절 링크는 GitHub에서 쓰던
 * slug라, 제목 문구가 바뀌면 링크만 조용히 죽는다.
 */
function assertAnchorsResolve(page, stats) {
  const ids = new Set(stats.headings.map((heading) => heading.id));
  const broken = stats.links
    .filter((link) => link.source.startsWith("#"))
    .filter((link) => !ids.has(link.target.slice(1)));
  if (!broken.length) return;
  throw new Error(
    `${page.source} 안의 절 링크가 갈 제목을 찾지 못했습니다: ${broken
      .map((link) => link.source)
      .join(", ")}`,
  );
}

/**
 * mermaid 블록 → 인라인 SVG. 라이브러리를 실을 수 없다고 다이어그램을 코드
 * 덩어리로 내보내지는 않는다. 대신 우리가 쓰는 문법만 읽어 빌드가 그림을 만든다.
 *
 * 미니 렌더러가 못 읽는 블록을 만나면 여기서 예외가 그대로 올라가 빌드가 죽는다.
 * 조용히 코드 블록으로 떨구지 않는 것이 요점이다. 나중에 다이어그램 문법이
 * 넓어졌을 때, 그림이 소리 없이 글자로 퇴행하는 대신 빌드가 먼저 멈춘다.
 *
 * 화살표 marker id가 겹치면 한 화면 안의 그림들이 서로를 덮으므로, 번호는 화면을
 * 넘어 이어진다.
 */
function createFlowchartRenderer(diagrams) {
  return (code) => {
    const { html, stats } = renderFlowchartSvg(code, { index: diagrams.length });
    diagrams.push(stats);
    return html;
  };
}

async function renderPage(page, diagrams) {
  const counts = { anchors: 0, documents: 0, screens: 0 };
  const sourcePath = fileURLToPath(new URL(page.source, deployRoot));
  const { html, stats } = renderMarkdown(await readFile(sourcePath, "utf8"), {
    rewriteHref: createHrefRewriter(page, counts),
    headingIdPrefix: page.anchorPrefix,
    // 화면 제목(h1)은 탑바가 이미 들고 있다. 본문은 h2부터 시작해야 개요가 맞는다.
    headingLevelOffset: 1,
    fencedRenderers: { mermaid: createFlowchartRenderer(diagrams) },
    skipRegion,
  });
  assertAnchorsResolve(page, stats);
  if (stats.skippedRegions !== page.skipRegions) {
    throw new Error(
      `${page.source}에서 뺄 구간이 ${page.skipRegions}개여야 하는데 ${stats.skippedRegions}개입니다. ${skipRegion.start} 마커를 확인하세요.`,
    );
  }
  return { html, stats, counts };
}

async function main() {
  const diagrams = [];
  const rendered = [];
  for (const page of pages) {
    rendered.push({ page, ...(await renderPage(page, diagrams)) });
  }

  let shell = await readFile(indexPath, "utf8");
  for (const { page, html } of rendered) {
    const occurrences = shell.split(page.placeholder).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `배포 셸에서 ${page.name} 본문 자리표시자를 정확히 한 번 찾지 못했습니다(${occurrences}번): ${page.placeholder}`,
      );
    }
    shell = shell.replace(page.placeholder, html);
  }
  await writeFile(indexPath, shell, "utf8");

  console.log(`읽을거리 본문 생성 완료: ${indexPath}`);
  for (const { page, stats, counts } of rendered) {
    const external = stats.links.filter((link) =>
      /^https?:\/\//u.test(link.source),
    ).length;
    console.log(`  [${page.name}] ${page.source}`);
    console.log(
      `    제목 ${stats.headings.length}개 · 링크 ${stats.links.length}개(문서 ${counts.documents} · 화면 ${counts.screens} · 본문 앵커 ${counts.anchors} · 바깥 주소 ${external})`,
    );
    console.log(
      `    뺀 구간 ${stats.skippedRegions}개 · 코드 블록 ${stats.codeBlocks.length}개`,
    );
  }
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
    `읽을거리 본문 생성에 실패했습니다. 원인 유형: ${
      error instanceof Error ? error.name : typeof error
    }`,
  );
  console.error(error instanceof Error ? error.message : String(error));
  console.error(`원본: ${pages.map((page) => page.source).join(", ")}`);
  console.error(`배포 셸: ${indexPath} (copy-static.mjs가 먼저 놓습니다.)`);
  if (error instanceof Error && error.stack) console.error(`상세 스택:\n${error.stack}`);
  process.exitCode = 1;
});
