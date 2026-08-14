/**
 * 빌드 시점 마크다운 → HTML 변환기.
 *
 * 이 사이트는 외부 호스트로 요청을 보낼 수 없는 정적 사본이라 런타임 마크다운
 * 파서를 실을 수 없다. 그래서 변환은 빌드가 끝내고 브라우저에는 정적 HTML만
 * 나간다. 새 의존성도 들이지 않는다 — README 하나를 옮기려고 범용 파서를
 * 붙이면 사이트가 감당해야 할 표면이 그만큼 넓어진다.
 *
 * 다루는 문법은 README.md가 실제로 쓰는 것만이다.
 *
 * - ATX 제목(`#`~`######`). 레벨은 headingLevelOffset 만큼 내려 쓴다.
 * - 문단. 문단 안의 줄바꿈은 GitHub과 같이 공백 하나로 이어 붙인다. 이어
 *   붙인 뒤에 인라인을 해석해야 줄을 넘어가는 `**굵게**`·`` `코드` ``가
 *   깨지지 않는다(README에 둘 다 실제로 있다).
 * - 인용(`>`). 인용 안은 다시 블록으로 해석한다.
 * - 목록(`-`·`*`·`+`·`1.`). 들여쓴 줄은 같은 항목의 계속이다. 중첩 목록은
 *   README에 없어 다루지 않는다.
 * - 표(헤더 행 + `---` 구분 행). 정렬 지정(`:---`)은 구문만 받아 주고 실제
 *   정렬은 걸지 않는다 — README가 쓰지 않는다.
 * - 코드 블록(``` 울타리). 언어 이름은 data-language로만 남긴다. mermaid도
 *   그림으로 세우지 않고 코드 그대로 내보낸다(외부 라이브러리 금지).
 * - 구분선(`---`).
 * - 인라인: `` `코드` ``, `**굵게**`, `[라벨](주소)`, 맨 URL 자동 링크.
 *
 * 일부러 다루지 않는 것
 * - 별표 하나짜리 기울임(`*기울임*`). README에는 기울임이 없고, 대신
 *   `A*`(A 스타)가 본문과 표에 나온다. 하나짜리를 강조로 받으면 그 별표가
 *   짝을 찾아 문장을 통째로 삼킨다.
 * - 원문 HTML. 마크다운 안의 `<`는 전부 이스케이프해 문자로 내보낸다.
 */

const escapes = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

export function escapeHtml(text) {
  return text.replace(/[&<>"]/gu, (character) => escapes[character]);
}

/** 제목 앞뒤의 인라인 표기를 걷어낸 맨 문장. 앵커 slug와 통계가 이걸 쓴다. */
function plainText(markdown) {
  return markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/`([^`]*)`/gu, "$1")
    .replace(/\*\*/gu, "")
    .trim();
}

/**
 * GitHub의 제목 앵커 규칙을 그대로 따른다 — 소문자로 내리고, 문장부호를
 * 버리고, 공백을 하이픈으로 바꾼다. README 안의 절 링크(`#5-우선은-...`)가
 * GitHub에서 쓰던 그 slug라, 규칙이 어긋나면 링크가 갈 곳을 잃는다.
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M} _-]/gu, "")
    .trim()
    .replace(/\s+/gu, "-");
}

function uniqueSlug(text, context) {
  const base = slugify(text);
  if (!context.usedSlugs.has(base)) {
    context.usedSlugs.add(base);
    return base;
  }
  // GitHub과 같은 뒷번호 규칙. README에 겹치는 제목은 없지만, 생겼을 때
  // 두 제목이 같은 앵커를 갖고 뒤엣것이 영영 닿지 않는 상태는 막는다.
  for (let ordinal = 1; ; ordinal += 1) {
    const candidate = `${base}-${ordinal}`;
    if (context.usedSlugs.has(candidate)) continue;
    context.usedSlugs.add(candidate);
    return candidate;
  }
}

const linkPattern = /\[([^\]\n]*)\]\(([^)\s]+)\)/uy;
const autolinkPattern = /https?:\/\/[^\s<>()[\]]+/uy;

function isAutolinkStart(text, index) {
  if (!text.startsWith("http://", index) && !text.startsWith("https://", index)) {
    return false;
  }
  // 낱말 한가운데의 http는 주소가 아니다. 앞이 글자·숫자면 건너뛴다.
  return index === 0 || !/[\p{L}\p{N}]/u.test(text[index - 1]);
}

function renderLink(label, href, context, options = {}) {
  const target = context.rewriteHref(href);
  context.stats.links.push({ source: href, target });
  // 바깥으로 나가는 링크만 referrer를 끊는다. 화면 안 앵커는 그대로 둔다.
  const attributes = /^https?:\/\//u.test(target) ? ' rel="noreferrer"' : "";
  const inner = options.autolink
    ? escapeHtml(label)
    : renderInline(label, context);
  return `<a href="${escapeHtml(target)}"${attributes}>${inner}</a>`;
}

/**
 * 인라인 해석. 한 글자씩 훑으면서 아는 표기만 받고 나머지는 문자로 이스케이프
 * 한다. 짝을 못 찾은 `` ` ``·`**`도 그래서 화면에서 사라지지 않고 그대로 남는다.
 */
export function renderInline(text, context) {
  let out = "";
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === "`") {
      const end = text.indexOf("`", index + 1);
      if (end !== -1) {
        out += `<code>${escapeHtml(text.slice(index + 1, end))}</code>`;
        index = end + 1;
        continue;
      }
    } else if (character === "[") {
      linkPattern.lastIndex = index;
      const matched = linkPattern.exec(text);
      if (matched) {
        out += renderLink(matched[1], matched[2], context);
        index = linkPattern.lastIndex;
        continue;
      }
    } else if (character === "*" && text.startsWith("**", index)) {
      const end = text.indexOf("**", index + 2);
      if (end !== -1) {
        out += `<strong>${renderInline(text.slice(index + 2, end), context)}</strong>`;
        index = end + 2;
        continue;
      }
    } else if (isAutolinkStart(text, index)) {
      autolinkPattern.lastIndex = index;
      const matched = autolinkPattern.exec(text);
      if (matched) {
        // 문장 끝의 마침표·쉼표는 주소가 아니라 문장부호다.
        const url = matched[0].replace(/[.,;:!?]+$/u, "");
        out += renderLink(url, url, context, { autolink: true });
        index += url.length;
        continue;
      }
    }
    out += escapeHtml(character);
    index += 1;
  }
  return out;
}

function splitTableRow(line) {
  let text = line.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|")) text = text.slice(0, -1);
  return text.split("|").map((cell) => cell.trim());
}

function isTableDelimiter(line) {
  if (!line || !line.includes("|")) return false;
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{2,}:?$/u.test(cell));
}

const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/u;
const rulePattern = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/u;
const listItemPattern = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/u;

/** 문단이 어디서 끊기는지. 표는 다음 줄까지 봐야 알 수 있어 색인을 함께 받는다. */
function startsNewBlock(lines, index) {
  const line = lines[index];
  if (!line.trim()) return true;
  if (line.startsWith("```")) return true;
  if (headingPattern.test(line)) return true;
  if (rulePattern.test(line)) return true;
  if (line.startsWith(">")) return true;
  if (listItemPattern.test(line)) return true;
  return line.includes("|") && isTableDelimiter(lines[index + 1] ?? "");
}

function renderCodeBlock(code, language, context) {
  context.stats.codeBlocks.push(language);
  const attribute = language ? ` data-language="${escapeHtml(language)}"` : "";
  return `<pre class="doc-code"${attribute}><code>${escapeHtml(code)}</code></pre>`;
}

function renderTable(lines, index, context) {
  const header = splitTableRow(lines[index]);
  let cursor = index + 2;
  const rows = [];
  while (cursor < lines.length && lines[cursor].includes("|")) {
    rows.push(splitTableRow(lines[cursor]));
    cursor += 1;
  }
  const head = header
    .map((cell) => `<th scope="col">${renderInline(cell, context)}</th>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${renderInline(cell, context)}</td>`).join("")}</tr>`,
    )
    .join("\n");
  const html = [
    '<div class="table-wrap">',
    '<table class="data-table doc-table">',
    `<thead><tr>${head}</tr></thead>`,
    `<tbody>\n${body}\n</tbody>`,
    "</table>",
    "</div>",
  ].join("\n");
  return { html, next: cursor };
}

function renderList(lines, index, context) {
  const ordered = /^\s*\d/u.test(lines[index]);
  const items = [];
  let cursor = index;
  while (cursor < lines.length) {
    const matched = listItemPattern.exec(lines[cursor]);
    if (matched) {
      items.push([matched[2].trim()]);
      cursor += 1;
      continue;
    }
    // 들여쓴 줄은 바로 앞 항목의 계속이다. 문단과 같은 이유로 공백으로 잇는다.
    if (items.length && lines[cursor].trim() && /^\s+/u.test(lines[cursor])) {
      items[items.length - 1].push(lines[cursor].trim());
      cursor += 1;
      continue;
    }
    break;
  }
  const tag = ordered ? "ol" : "ul";
  const body = items
    .map((item) => `<li>${renderInline(item.join(" "), context)}</li>`)
    .join("\n");
  return {
    html: `<${tag} class="doc-list">\n${body}\n</${tag}>`,
    next: cursor,
  };
}

function renderBlocks(lines, context) {
  const out = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const body = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        body.push(lines[index]);
        index += 1;
      }
      if (index >= lines.length) {
        throw new Error("닫히지 않은 코드 블록이 있습니다.");
      }
      index += 1;
      out.push(renderCodeBlock(body.join("\n"), language, context));
      continue;
    }

    const heading = headingPattern.exec(line);
    if (heading) {
      const text = plainText(heading[2]);
      const level = Math.min(6, heading[1].length + context.headingLevelOffset);
      const id = `${context.headingIdPrefix}${uniqueSlug(text, context)}`;
      context.stats.headings.push({ level, text, id });
      out.push(
        `<h${level} id="${escapeHtml(id)}">${renderInline(heading[2], context)}</h${level}>`,
      );
      index += 1;
      continue;
    }

    if (rulePattern.test(line)) {
      out.push('<hr class="doc-rule" />');
      index += 1;
      continue;
    }

    if (line.startsWith(">")) {
      const quoted = [];
      while (index < lines.length && lines[index].startsWith(">")) {
        quoted.push(lines[index].replace(/^>\s?/u, ""));
        index += 1;
      }
      out.push(
        `<blockquote class="doc-quote">\n${renderBlocks(quoted, context)}\n</blockquote>`,
      );
      continue;
    }

    if (line.includes("|") && isTableDelimiter(lines[index + 1] ?? "")) {
      const table = renderTable(lines, index, context);
      out.push(table.html);
      index = table.next;
      continue;
    }

    if (listItemPattern.test(line)) {
      const list = renderList(lines, index, context);
      out.push(list.html);
      index = list.next;
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && !startsNewBlock(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    out.push(`<p>${renderInline(paragraph.join(" "), context)}</p>`);
  }
  return out.join("\n");
}

/**
 * 마크다운 한 벌을 HTML 조각으로 옮긴다. 문서 껍데기(html·head·body)는 만들지
 * 않는다 — 부르는 쪽이 이미 있는 셸 안에 끼워 넣는다.
 *
 * options
 * - `rewriteHref(href)` — 링크 주소를 옮길 자리. README의 상대 경로처럼 사이트
 *   에서 깨지는 주소를 여기서 갈아 끼운다. 원문은 손대지 않는다.
 * - `headingIdPrefix` — 제목 앵커 id 앞에 붙는 말. 라우팅과 섞이지 않게 하려고
 *   둔다.
 * - `headingLevelOffset` — 제목 레벨을 내리는 칸수. 화면에 이미 h1이 있으면 1.
 *
 * 돌려주는 stats는 부르는 쪽이 검증에 쓴다(앵커가 실제 제목을 가리키는지 등).
 */
export function renderMarkdown(markdown, options = {}) {
  const context = {
    rewriteHref: options.rewriteHref ?? ((href) => href),
    headingIdPrefix: options.headingIdPrefix ?? "",
    headingLevelOffset: options.headingLevelOffset ?? 0,
    usedSlugs: new Set(),
    stats: { headings: [], links: [], codeBlocks: [] },
  };
  const lines = markdown
    .replace(/^﻿/u, "")
    .replace(/\r\n?/gu, "\n")
    .split("\n");
  return { html: renderBlocks(lines, context), stats: context.stats };
}
