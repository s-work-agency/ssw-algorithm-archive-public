/*
  mermaid 미니 렌더러 테스트.

  이 렌더러가 하는 일은 좁다. README.md 의 흐름도 두 개가 쓰는 문법만 읽어 인라인
  SVG로 옮긴다. 그래서 여기서 잠그는 것도 둘이다.

  - 받기로 한 문법이 실제로 그려지는가 (노드·간선 수, 층 배치, 라벨 줄).
  - **받지 않기로 한 것에서 반드시 세우는가.** 이쪽이 더 중요하다. 못 읽는 블록을
    조용히 코드 블록으로 떨구면, 나중에 README 의 다이어그램이 소리 없이 글자로
    퇴행하고 아무도 모른다. 그 퇴행을 막는 장치가 fail-closed 이고, 그 장치가
    살아 있는지 확인하는 것이 아래 실패 케이스들이다.
*/
import assert from "node:assert/strict";
import test from "node:test";
import {
  layoutFlowchart,
  parseFlowchart,
  renderFlowchartSvg,
} from "../scripts/mermaid.mjs";

const chain = [
  "flowchart LR",
  '    A["<b>계약</b><br/>입출력 · 오류"]',
  '    B["벡터"]',
  '    C["구현"]',
  "",
  "    A --> B --> C",
].join("\n");

const branching = [
  "flowchart LR",
  '    S["소스"]',
  '    J{"기대값과 같은가"}',
  '    P["통과"]',
  '    F["실패"]',
  "",
  "    S --> J",
  "    J -->|같음| P",
  "    J -->|다름| F",
].join("\n");

test("노드와 간선을 읽는다", () => {
  const chart = parseFlowchart(chain);
  assert.deepEqual([...chart.nodes.keys()], ["A", "B", "C"]);
  assert.deepEqual(
    chart.edges.map((edge) => `${edge.from}->${edge.to}`),
    ["A->B", "B->C"],
  );
  // 이어 쓰기(A --> B --> C)는 간선 둘이다.
  assert.equal(chart.edges.length, 2);
});

test("라벨의 <br/> 는 줄, <b> 는 굵게로 읽는다", () => {
  const chart = parseFlowchart(chain);
  assert.deepEqual(chart.nodes.get("A").lines, [
    { text: "계약", bold: true },
    { text: "입출력 · 오류", bold: false },
  ]);
});

test("판단 노드와 간선 라벨을 읽는다", () => {
  const chart = parseFlowchart(branching);
  assert.equal(chart.nodes.get("J").shape, "decision");
  assert.equal(chart.nodes.get("P").shape, "box");
  assert.deepEqual(
    chart.edges.filter((edge) => edge.label).map((edge) => edge.label),
    ["같음", "다름"],
  );
});

test("층은 앞 노드 층의 최댓값 + 1 이고 갈래는 같은 층에 쌓인다", () => {
  const layout = layoutFlowchart(parseFlowchart(branching));
  const left = (id) => layout.boxes.get(id).x;
  const top = (id) => layout.boxes.get(id).y;
  assert.ok(left("S") < left("J"), "S 가 J 보다 왼쪽이어야 합니다.");
  assert.ok(left("J") < left("P"), "J 가 P 보다 왼쪽이어야 합니다.");
  // 갈라져 나온 둘은 같은 층(같은 x)에 서로 다른 높이로 선다.
  assert.equal(left("P"), left("F"));
  assert.notEqual(top("P"), top("F"));
});

test("SVG 로 내보내고 코드 블록은 만들지 않는다", () => {
  const { html, stats } = renderFlowchartSvg(branching, { index: 3 });
  assert.match(html, /^<figure class="doc-figure">/u);
  assert.match(html, /<svg class="doc-figure__svg"/u);
  assert.doesNotMatch(html, /<pre/u);
  // 상자 4개 중 판단 노드 하나는 육각형이라 path 로 나간다.
  assert.equal([...html.matchAll(/class="doc-figure__box"/gu)].length, 3);
  assert.equal(
    [...html.matchAll(/doc-figure__box--decision/gu)].length,
    1,
  );
  assert.equal([...html.matchAll(/class="doc-figure__edge"/gu)].length, 3);
  assert.deepEqual(stats.nodes, 4);
  assert.deepEqual(stats.edges, 3);
});

test("화살표 marker id 는 다이어그램마다 갈린다", () => {
  // 한 화면에 여러 흐름도가 서므로 id 가 겹치면 화살촉이 서로를 덮는다.
  const first = renderFlowchartSvg(chain, { index: 0 }).html;
  const second = renderFlowchartSvg(chain, { index: 1 }).html;
  assert.match(first, /id="doc-figure-arrow-0"/u);
  assert.match(second, /id="doc-figure-arrow-1"/u);
});

test("라벨은 이스케이프해서 넣는다", () => {
  const html = renderFlowchartSvg(
    ['flowchart LR', '    A["따옴표 & 꺾쇠"]', '    B["끝"]', "    A --> B"].join(
      "\n",
    ),
  ).html;
  assert.match(html, /따옴표 &amp; 꺾쇠/u);
});

test("스크린리더용 설명에 흐름이 글로 들어간다", () => {
  const html = renderFlowchartSvg(branching).html;
  assert.match(html, /<desc>흐름도: 소스 → 기대값과 같은가/u);
  assert.match(html, /기대값과 같은가 → 통과 \(같음\)/u);
});

test("상자마다 실제 크기가 박히고 층별로 폭이 갈린다", () => {
  const { html } = renderFlowchartSvg(branching);
  const rects = [...html.matchAll(/<rect class="doc-figure__box"([^>]*)\/>/gu)];
  assert.equal(rects.length, 3);
  for (const [, attributes] of rects) {
    const width = Number(/width="([^"]*)"/u.exec(attributes)[1]);
    const height = Number(/height="([^"]*)"/u.exec(attributes)[1]);
    assert.ok(Number.isFinite(width) && width > 0, `폭: ${width}`);
    assert.ok(Number.isFinite(height) && height > 0, `높이: ${height}`);
  }
  // 같은 층에 쌓인 갈래(P·F)는 좌우 끝이 맞아야 하므로 폭이 같다.
  const stacked = rects
    .map(([, a]) => Number(/width="([^"]*)"/u.exec(a)[1]))
    .slice(1);
  assert.equal(new Set(stacked).size, 1, "같은 층의 폭이 어긋났습니다.");
});

test("층마다 상자 폭이 갈린다", () => {
  // 하나로 통일하면 짧은 상자가 최장 라벨에 맞춰 넓어지고, 그 낭비가 층 수만큼
  // 곱해져 그림이 문서 띠를 넘는다.
  const widths = [
    ...renderFlowchartSvg(chain).html.matchAll(
      /<rect class="doc-figure__box"[^>]*width="([^"]*)"/gu,
    ),
  ].map((matched) => Number(matched[1]));
  assert.equal(widths.length, 3);
  assert.ok(new Set(widths).size > 1, "층별 폭이 갈리지 않았습니다.");
});

test("수가 아닌 좌표는 직렬화되지 않고 빌드를 세운다", () => {
  /*
    회귀 그대로다. 상자 폭을 읽던 자리가 빗나가 width="undefined" 가 나갔고,
    SVG 는 그 도형만 조용히 건너뛰어 상자가 사라졌다. 좌표를 쓰는 길목에서
    막는다 — mermaid 문법 fail-closed 와 같은 원칙이다.
  */
  assert.throws(
    () => renderFlowchartSvg(chain, { index: Number.NaN }),
    /수가 아닌 값이 직렬화됐습니다|도형 좌표가 수가 아닙니다/u,
  );
});

test("받지 않는 문법에서는 반드시 세운다", () => {
  const cases = [
    // 방향이 다른 머리줄
    ['flowchart TD', '    A["가"]', '    B["나"]', "    A --> B"],
    // 점선 간선
    ['flowchart LR', '    A["가"]', '    B["나"]', "    A -.-> B"],
    // 굵은 간선
    ['flowchart LR', '    A["가"]', '    B["나"]', "    A ==> B"],
    // 따옴표 없는 라벨
    ["flowchart LR", "    A[가]", '    B["나"]', "    A --> B"],
    // 둥근 노드
    ['flowchart LR', '    A("가")', '    B["나"]', "    A --> B"],
    // 정의되지 않은 노드를 가리키는 간선
    ['flowchart LR', '    A["가"]', "    A --> Z"],
    // 라벨 안의 모르는 태그
    ['flowchart LR', '    A["<i>가</i>"]', '    B["나"]', "    A --> B"],
    // 서브그래프
    ["flowchart LR", "    subgraph 묶음", '    A["가"]', "    end"],
    // 순환
    ['flowchart LR', '    A["가"]', '    B["나"]', "    A --> B", "    B --> A"],
    // 같은 노드를 두 번 정의
    ['flowchart LR', '    A["가"]', '    A["나"]', "    A --> A"],
  ];
  for (const lines of cases) {
    assert.throws(
      () => renderFlowchartSvg(lines.join("\n")),
      /읽을 수 없는 mermaid 문법입니다/u,
      `세우지 않았습니다: ${lines.join(" / ")}`,
    );
  }
});
