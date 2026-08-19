/*
  자체 호스팅 글꼴 검사.

  본문 한글은 Pretendard 가변 폰트의 동적 서브셋이 맡는다. 유니코드 범위별로
  쪼갠 woff2 조각을 @font-face 가 하나씩 가리키고, 브라우저는 화면에 쓰인 글자의
  조각만 받는다. 조각이 하나라도 빠지면 그 범위의 글자만 조용히 시스템 글꼴로
  떨어져 한 문장 안에서 서체가 갈린다 — 그래서 개수가 아니라 참조를 하나씩 본다.

  붙잡는 사고 셋.
  - 글꼴 스타일시트가 배포 루트에 실리지 않거나 index.html 이 그것을 읽지 않는 것.
  - @font-face 가 가리키는 조각이 배포 루트에 없는 것.
  - 사이트가 외부 요청을 하지 않는다는 전제를 글꼴이 깨는 것(CDN 주소).
*/
import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const deployRoot = new URL("../../", import.meta.url);
const fontDirectory = new URL("fonts/pretendard/", deployRoot);
const stylesheetName = "pretendardvariable-dynamic-subset.css";

const page = await readFile(fileURLToPath(new URL("index.html", deployRoot)), "utf8");
const styles = await readFile(fileURLToPath(new URL("styles.css", deployRoot)), "utf8");
const fontStyles = await readFile(
  fileURLToPath(new URL(stylesheetName, fontDirectory)),
  "utf8",
);

/** 글꼴 스타일시트가 가리키는 파일 전부. `url(...)` 의 따옴표 유무를 가리지 않는다. */
const fontUrls = [...fontStyles.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gu)].map(
  (matched) => matched[1],
);

test("index.html 이 글꼴 스타일시트를 본문 스타일보다 먼저 읽는다", () => {
  const fontLink = page.indexOf(`href="./fonts/pretendard/${stylesheetName}"`);
  const mainLink = page.indexOf('href="./styles.css"');
  assert.ok(fontLink > 0, "글꼴 스타일시트 링크가 없습니다.");
  assert.ok(mainLink > 0, "본문 스타일시트 링크가 없습니다.");
  assert.ok(fontLink < mainLink, "글꼴 스타일시트가 본문 스타일 뒤에 있습니다.");
});

test("본문 글꼴 스택은 Pretendard 로 시작한다", () => {
  const token = /--font-sans:\s*([^;]+);/u.exec(styles);
  assert.ok(token, "--font-sans 토큰이 없습니다.");
  const stack = token[1].replace(/\s+/gu, " ").trim();
  assert.ok(
    stack.startsWith('"Pretendard Variable", Pretendard,'),
    `글꼴 스택이 Pretendard 로 시작하지 않습니다: ${stack}`,
  );
  // 글꼴 파일이 못 오는 환경을 위한 폴백은 남아 있어야 한다.
  assert.ok(stack.endsWith("sans-serif"), "일반 폴백(sans-serif)이 없습니다.");
});

test("@font-face 의 글꼴 이름이 스택의 선두와 같다", () => {
  const families = new Set(
    [...fontStyles.matchAll(/font-family:\s*['"]?([^;'"]+)['"]?;/gu)].map(
      (matched) => matched[1].trim(),
    ),
  );
  assert.deepEqual([...families], ["Pretendard Variable"]);
});

test("글꼴 스타일시트가 가리키는 조각이 전부 배포 루트에 있다", async () => {
  assert.ok(fontUrls.length >= 50, `동적 서브셋 조각 참조가 너무 적습니다: ${fontUrls.length}`);
  for (const href of fontUrls) {
    assert.match(href, /^\.\/woff2-dynamic-subset\/[^/]+\.woff2$/u, `조각 경로 형식: ${href}`);
    await assert.doesNotReject(
      access(fileURLToPath(new URL(href, fontDirectory))),
      `조각이 없습니다: ${href}`,
    );
  }
});

test("글꼴이 외부 요청을 만들지 않는다", () => {
  for (const href of fontUrls) {
    assert.ok(!/^[a-z]+:|^\/\//iu.test(href), `외부 주소를 가리킵니다: ${href}`);
  }
  // 주석 밖에는 http 주소가 없어야 한다. 라이선스 머리말의 주소는 요청이 아니다.
  const withoutComments = fontStyles.replace(/\/\*[\s\S]*?\*\//gu, "");
  assert.ok(!/https?:\/\//u.test(withoutComments), "글꼴 스타일시트에 외부 주소가 있습니다.");
});

test("글꼴 라이선스 파일이 글꼴과 함께 실린다", async () => {
  // OFL 은 글꼴을 재배포할 때 라이선스 원문을 함께 두도록 요구한다.
  const license = await readFile(fileURLToPath(new URL("LICENSE.txt", fontDirectory)), "utf8");
  assert.match(license, /SIL Open Font License/u);
  assert.match(fontStyles, /SIL Open Font License/u);
});
