/**
 * mermaid flowchart 미니 렌더러 — 빌드 시점에 인라인 SVG로 옮긴다.
 *
 * 이 사이트는 외부 호스트로 요청을 보낼 수 없어 mermaid 라이브러리를 실을 수
 * 없다. 그렇다고 다이어그램을 코드 덩어리로 내보내면 README 에서 그림이던 것이
 * 사이트에서만 글자가 된다. 그래서 우리가 쓰는 만큼만 직접 읽어 SVG를 만든다.
 * 브라우저가 받는 것은 이미 완성된 그림이고, 실행되는 코드는 한 줄도 없다.
 *
 * 받는 문법은 README.md의 두 블록이 실제로 쓰는 것뿐이다.
 *
 * - 머리줄 `flowchart LR` (왼→오 한 방향만).
 * - 노드 `ID["라벨"]` (상자) · `ID{"라벨"}` (판단). ID는 영문자로 시작하는
 *   영숫자·밑줄이다.
 * - 라벨 안의 `<br/>`은 줄바꿈, `<b>…</b>`는 그 줄을 굵게. 그 밖의 태그는 없다.
 * - 간선 `A --> B`, 이어 쓰기 `A --> B --> C`, 라벨 붙은 간선 `A -->|같음| B`.
 * - 빈 줄과 들여쓰기는 무시한다.
 *
 * 이 밖의 것은 전부 세운다. 일반화하지 않는 것이 이 파일의 설계다 — 읽는 척하고
 * 틀리게 그리느니, 못 읽는다고 빌드를 멈추는 편이 낫다. README 에 새 문법이
 * 들어오면 그때 사람이 보고 여기를 넓힌다.
 *
 * 배치는 층 나누기(longest-path layering) 하나로 끝난다. 들어오는 간선이 없는
 * 노드가 0층이고, 나머지는 앞 노드 층의 최댓값 + 1이다. 같은 층은 정의 순서대로
 * 세로로 쌓고 가운데를 맞춘다. 두 블록 모두 간선이 한 층씩만 건너뛰어서, 이
 * 단순한 규칙으로 mermaid가 그리던 모양이 그대로 나온다.
 *
 * 글자 폭은 빌드 시점에 잴 수 없으므로 문자 종류별 가중치로 어림한다. 상자 폭은
 * 다이어그램 안에서 하나로 통일하므로, 어림이 조금 빗나가도 상자가 다 같이
 * 넓어지거나 좁아질 뿐 배치가 어긋나지 않는다.
 */

import { escapeHtml } from "./markdown.mjs";

/** 그림 치수. viewBox 단위가 곧 CSS 픽셀이다. */
const metrics = {
  titleFontSize: 13,
  lineFontSize: 12,
  lineHeight: 17,
  paddingX: 14,
  paddingY: 12,
  /** 한 줄이 이 폭을 넘으면 공백에서 접는다. */
  maxLineWidth: 120,
  gapX: 34,
  /** 간선 라벨이 있는 다이어그램은 층 사이를 넓힌다. 라벨이 설 자리가 필요하다. */
  gapXWithEdgeLabel: 58,
  gapY: 22,
  /** 판단 노드(육각형)가 좌우로 깎이는 만큼. 글자 자리는 그만큼 줄어든다. */
  decisionCut: 16,
  margin: 10,
};

/**
 * 문자 한 글자의 가로 폭(em). 한글은 전각이고 라틴 소문자는 절반 남짓이라는
 * 정도의 어림이다. 폰트가 Inter → system-ui 순으로 갈리므로 정확할 수 없고,
 * 정확할 필요도 없다 — 상자 폭이 다이어그램 안에서 하나로 통일된다.
 */
function characterWidth(character) {
  const code = character.codePointAt(0);
  if (code === 0x20) return 0.28;
  if (
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0x3130 && code <= 0x318f) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3000 && code <= 0x303f) ||
    (code >= 0xff00 && code <= 0xff60)
  ) {
    return 1;
  }
  if (code === 0x00b7 || code === 0x2022) return 0.5;
  if (/[iljt.,;:'!|()[\]]/u.test(character)) return 0.32;
  if (/[A-Z]/u.test(character)) return 0.66;
  if (/[0-9]/u.test(character)) return 0.56;
  if (/[a-z]/u.test(character)) return 0.53;
  return 0.5;
}

function textWidth(text, fontSize, bold) {
  let sum = 0;
  for (const character of text) sum += characterWidth(character);
  return sum * fontSize * (bold ? 1.06 : 1);
}

/** 주어진 폭으로 욕심껏 접는다. 낱말 하나가 폭을 넘으면 그 줄에 혼자 둔다. */
function greedyWrap(words, fontSize, bold, width) {
  const lines = [];
  let current = [];
  for (const word of words) {
    const candidate = current.length ? [...current, word] : [word];
    if (
      current.length &&
      textWidth(candidate.join(" "), fontSize, bold) > width
    ) {
      lines.push(current.join(" "));
      current = [word];
      continue;
    }
    current = candidate;
  }
  if (current.length) lines.push(current.join(" "));
  return lines;
}

/**
 * 긴 줄을 공백에서 접는다. 한글 음절 사이는 끊지 않는다 — 낱말 하나가 한도를
 * 넘으면 그대로 둔다.
 *
 * 욕심껏 접으면 마지막 줄에 한 낱말만 남아 상자가 어정쩡해진다. 라벨이 대개
 * 가운뎃점으로 항목을 잇는 짧은 구라 이 자국이 특히 눈에 띈다. 그래서 줄 수를
 * 먼저 정하고, 그 줄 수를 유지하는 가장 좁은 폭을 이분 탐색해 줄 길이를 고르게
 * 만든다. 덤으로 상자 폭도 그만큼 줄어든다.
 */
function wrapLine(text, fontSize, bold, limit) {
  const words = text.split(" ").filter(Boolean);
  const target = greedyWrap(words, fontSize, bold, limit).length;
  if (target <= 1) return words.length ? [words.join(" ")] : [text];
  let low = 0;
  let high = limit;
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    if (greedyWrap(words, fontSize, bold, middle).length <= target) high = middle;
    else low = middle;
  }
  const lines = greedyWrap(words, fontSize, bold, high);
  // 가운뎃점으로 시작하는 줄은 앞 줄 끝으로 붙인다. 항목을 잇는 기호라 쉼표처럼
  // 앞 줄을 닫는 자리가 맞고, 줄 머리에 오면 목록 글머리표로 잘못 읽힌다.
  for (let index = 1; index < lines.length; index += 1) {
    if (!lines[index].startsWith("· ")) continue;
    lines[index] = lines[index].slice(2);
    lines[index - 1] = `${lines[index - 1]} ·`;
  }
  return lines;
}

const nodePattern = /^([A-Za-z][A-Za-z0-9_]*)\s*(\[|\{)"([\s\S]*)"(\]|\})$/u;
const identifierPattern = /[A-Za-z][A-Za-z0-9_]*/y;
const arrowPattern = /\s*-->\s*(?:\|([^|]*)\|\s*)?/y;

function fail(reason, line) {
  const where = line === undefined ? "" : ` (줄: ${line.trim()})`;
  throw new Error(`읽을 수 없는 mermaid 문법입니다: ${reason}${where}`);
}

/** 라벨 원문 → 줄 목록. `<br/>` 로 나누고 `<b>` 로 감싼 줄만 굵게 표시한다. */
function parseLabel(raw, line) {
  const segments = raw.split(/<br\s*\/?>/iu);
  const parsed = segments.map((segment) => {
    const trimmed = segment.trim();
    const bold = /^<b>([\s\S]*)<\/b>$/iu.exec(trimmed);
    const text = (bold ? bold[1] : trimmed).trim();
    if (!text) fail("빈 라벨 줄", line);
    if (/[<>]/u.test(text)) fail(`라벨 안에서 모르는 태그를 만났습니다`, line);
    return { text, bold: Boolean(bold) };
  });
  if (!parsed.length) fail("빈 라벨", line);
  return parsed;
}

/** 간선 줄 → 간선 목록. 이어 쓰기(A --> B --> C)를 한 줄에서 다 받는다. */
function parseEdgeLine(line) {
  const text = line.trim();
  identifierPattern.lastIndex = 0;
  const first = identifierPattern.exec(text);
  if (!first || first.index !== 0) fail("간선의 시작 노드를 읽지 못했습니다", line);
  let cursor = identifierPattern.lastIndex;
  let from = first[0];
  const edges = [];
  while (cursor < text.length) {
    arrowPattern.lastIndex = cursor;
    const arrow = arrowPattern.exec(text);
    if (!arrow || arrow.index !== cursor) fail("간선 표기를 읽지 못했습니다", line);
    cursor = arrowPattern.lastIndex;
    identifierPattern.lastIndex = cursor;
    const target = identifierPattern.exec(text);
    if (!target || target.index !== cursor) {
      fail("간선의 도착 노드를 읽지 못했습니다", line);
    }
    cursor = identifierPattern.lastIndex;
    const label = arrow[1]?.trim();
    edges.push({ from, to: target[0], label: label || undefined });
    from = target[0];
  }
  if (!edges.length) fail("간선이 없습니다", line);
  return edges;
}

export function parseFlowchart(source) {
  const lines = source.replace(/\r\n?/gu, "\n").split("\n");
  const body = lines.filter((line) => line.trim());
  if (!body.length) fail("빈 다이어그램");
  const header = body[0].trim();
  if (header !== "flowchart LR") {
    fail(`머리줄은 flowchart LR 만 다룹니다. 지금은 '${header}' 입니다`);
  }
  const nodes = new Map();
  const edges = [];
  for (const line of body.slice(1)) {
    const text = line.trim();
    const node = nodePattern.exec(text);
    if (node) {
      const [, id, open, raw, close] = node;
      if ((open === "[") !== (close === "]")) fail("괄호 짝이 맞지 않습니다", line);
      if (nodes.has(id)) fail(`노드 ${id} 가 두 번 정의됐습니다`, line);
      nodes.set(id, {
        id,
        shape: open === "[" ? "box" : "decision",
        lines: parseLabel(raw, line),
      });
      continue;
    }
    if (text.includes("-->")) {
      edges.push(...parseEdgeLine(line));
      continue;
    }
    fail("노드 정의도 간선도 아닙니다", line);
  }
  if (!nodes.size) fail("노드가 하나도 없습니다");
  for (const edge of edges) {
    // mermaid 는 정의 없는 id 를 만나면 빈 노드를 만들어 준다. 여기서는 세운다 —
    // 오타가 조용히 빈 상자로 그려지는 것이 가장 나쁜 결과다.
    if (!nodes.has(edge.from)) fail(`정의되지 않은 노드입니다: ${edge.from}`);
    if (!nodes.has(edge.to)) fail(`정의되지 않은 노드입니다: ${edge.to}`);
  }
  return { nodes, edges };
}

/** 층 나누기. 들어오는 간선이 없으면 0층, 아니면 앞 노드 층의 최댓값 + 1이다. */
function assignLayers(nodes, edges) {
  const remaining = new Map([...nodes.keys()].map((id) => [id, 0]));
  const following = new Map([...nodes.keys()].map((id) => [id, []]));
  for (const edge of edges) {
    remaining.set(edge.to, remaining.get(edge.to) + 1);
    following.get(edge.from).push(edge.to);
  }
  const layer = new Map([...nodes.keys()].map((id) => [id, 0]));
  const queue = [...nodes.keys()].filter((id) => remaining.get(id) === 0);
  let settled = 0;
  while (queue.length) {
    const id = queue.shift();
    settled += 1;
    for (const next of following.get(id)) {
      layer.set(next, Math.max(layer.get(next), layer.get(id) + 1));
      remaining.set(next, remaining.get(next) - 1);
      if (remaining.get(next) === 0) queue.push(next);
    }
  }
  if (settled !== nodes.size) fail("순환이 있는 흐름도는 다루지 않습니다");
  return layer;
}

export function layoutFlowchart(chart) {
  const layer = assignLayers(chart.nodes, chart.edges);
  const columns = [];
  for (const node of chart.nodes.values()) {
    const index = layer.get(node.id);
    (columns[index] ??= []).push(node);
  }

  const boxes = new Map();
  let nodeWidth = 0;
  let nodeHeight = 0;
  for (const node of chart.nodes.values()) {
    const cut = node.shape === "decision" ? metrics.decisionCut : 0;
    const limit = metrics.maxLineWidth - cut;
    const wrapped = [];
    for (const [index, line] of node.lines.entries()) {
      const fontSize = index === 0 ? metrics.titleFontSize : metrics.lineFontSize;
      for (const text of wrapLine(line.text, fontSize, line.bold, limit)) {
        wrapped.push({ text, bold: line.bold, fontSize, title: index === 0 });
      }
    }
    const widest = Math.max(
      ...wrapped.map((line) => textWidth(line.text, line.fontSize, line.bold)),
    );
    nodeWidth = Math.max(nodeWidth, widest + 2 * (metrics.paddingX + cut));
    nodeHeight = Math.max(
      nodeHeight,
      2 * metrics.paddingY + wrapped.length * metrics.lineHeight,
    );
    boxes.set(node.id, { node, wrapped });
  }
  nodeWidth = Math.round(nodeWidth);
  nodeHeight = Math.round(nodeHeight);

  const gapX = chart.edges.some((edge) => edge.label)
    ? metrics.gapXWithEdgeLabel
    : metrics.gapX;
  const rows = Math.max(...columns.map((column) => column.length));
  const contentHeight = rows * nodeHeight + (rows - 1) * metrics.gapY;
  const width =
    2 * metrics.margin +
    columns.length * nodeWidth +
    (columns.length - 1) * gapX;
  const height = 2 * metrics.margin + contentHeight;

  for (const [index, column] of columns.entries()) {
    const stack =
      column.length * nodeHeight + (column.length - 1) * metrics.gapY;
    const top = metrics.margin + (contentHeight - stack) / 2;
    for (const [row, node] of column.entries()) {
      const box = boxes.get(node.id);
      box.x = metrics.margin + index * (nodeWidth + gapX);
      box.y = top + row * (nodeHeight + metrics.gapY);
    }
  }

  return { boxes, edges: chart.edges, width, height, nodeWidth, nodeHeight };
}

function nodeOutline(box, width, height) {
  const { x, y } = box;
  if (box.node.shape !== "decision") {
    return `<rect class="doc-figure__box" x="${x}" y="${y}" width="${width}" height="${height}" rx="10" />`;
  }
  const cut = metrics.decisionCut;
  const middle = y + height / 2;
  const points = [
    [x, middle],
    [x + cut, y],
    [x + width - cut, y],
    [x + width, middle],
    [x + width - cut, y + height],
    [x + cut, y + height],
  ];
  const path = points
    .map(([px, py], index) => `${index ? "L" : "M"}${round(px)} ${round(py)}`)
    .join(" ");
  return `<path class="doc-figure__box doc-figure__box--decision" d="${path} Z" />`;
}

const round = (value) => Math.round(value * 100) / 100;

/** 노드 이름. 보조 설명이 노드를 부를 때 쓰는 말이라 첫 줄을 그대로 쓴다. */
const nodeName = (node) => node.lines[0].text;

export function renderFlowchartSvg(source, options = {}) {
  const chart = parseFlowchart(source);
  const layout = layoutFlowchart(chart);
  const markerId = `doc-figure-arrow-${options.index ?? 0}`;

  const edgePaths = layout.edges.map((edge) => {
    const from = layout.boxes.get(edge.from);
    const to = layout.boxes.get(edge.to);
    const x1 = from.x + layout.nodeWidth;
    const y1 = from.y + layout.nodeHeight / 2;
    const x2 = to.x;
    const y2 = to.y + layout.nodeHeight / 2;
    // 0.5 를 넘기면 두 제어점이 서로를 지나쳐 짧은 간선에서 곡선이 접힌다.
    const bend = (x2 - x1) * 0.45;
    const path = `M${round(x1)} ${round(y1)} C${round(x1 + bend)} ${round(y1)}, ${round(x2 - bend)} ${round(y2)}, ${round(x2 - 1)} ${round(y2)}`;
    const line = `<path class="doc-figure__edge" d="${path}" marker-end="url(#${markerId})" />`;
    if (!edge.label) return line;
    // 라벨은 간선 가운데에 세우고, 선이 글자를 뚫지 않도록 면을 한 겹 깐다.
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const labelWidth = textWidth(edge.label, 11, false) + 12;
    const chip = `<rect class="doc-figure__edge-chip" x="${round(centerX - labelWidth / 2)}" y="${round(centerY - 9)}" width="${round(labelWidth)}" height="18" rx="9" />`;
    const text = `<text class="doc-figure__edge-label" x="${round(centerX)}" y="${round(centerY + 4)}" text-anchor="middle">${escapeHtml(edge.label)}</text>`;
    return `${line}\n${chip}\n${text}`;
  });

  const nodeGroups = [...layout.boxes.values()].map((box) => {
    const totalText = box.wrapped.length * metrics.lineHeight;
    const top = box.y + (layout.nodeHeight - totalText) / 2;
    const centerX = box.x + layout.nodeWidth / 2;
    const texts = box.wrapped.map((line, index) => {
      const baseline = top + index * metrics.lineHeight + metrics.lineHeight - 5;
      const classes = ["doc-figure__text"];
      if (line.title) classes.push("doc-figure__text--title");
      if (line.bold) classes.push("doc-figure__text--bold");
      return `<text class="${classes.join(" ")}" x="${round(centerX)}" y="${round(baseline)}" text-anchor="middle" style="font-size: ${line.fontSize}px">${escapeHtml(line.text)}</text>`;
    });
    return [
      "<g>",
      nodeOutline(box, layout.nodeWidth, layout.nodeHeight),
      ...texts,
      "</g>",
    ].join("\n");
  });

  const description = `흐름도: ${layout.edges
    .map((edge) => {
      const from = nodeName(layout.boxes.get(edge.from).node);
      const to = nodeName(layout.boxes.get(edge.to).node);
      return edge.label ? `${from} → ${to} (${edge.label})` : `${from} → ${to}`;
    })
    .join(", ")}`;

  const svg = [
    `<svg class="doc-figure__svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeHtml(description)}" viewBox="0 0 ${layout.width} ${layout.height}" width="${layout.width}" height="${layout.height}">`,
    `<desc>${escapeHtml(description)}</desc>`,
    "<defs>",
    `<marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">`,
    '<path class="doc-figure__arrowhead" d="M0 0 L10 5 L0 10 Z" />',
    "</marker>",
    "</defs>",
    ...edgePaths,
    ...nodeGroups,
    "</svg>",
  ].join("\n");

  return {
    html: `<figure class="doc-figure">\n${svg}\n</figure>`,
    stats: {
      nodes: layout.boxes.size,
      edges: layout.edges.length,
      width: layout.width,
      height: layout.height,
    },
  };
}
