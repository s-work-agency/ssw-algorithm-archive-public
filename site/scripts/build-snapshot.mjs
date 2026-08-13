/**
 * 공개 스냅샷 입력 생성기.
 *
 * 비공개 본체가 발행한 catalog 2.1 분할본(500종 × 10언어)에서 공개할 8종 × 3언어만
 * 떠내어 `site/snapshot/` 아래에 놓는다. 생성기 자체에는 부분 발행 옵션이 없고 입력을
 * 잘라 다시 돌리는 길도 막혀 있어(대안 참조 무결성·metadata 10언어 필수), 여기서는
 * 이미 검증을 마친 산출물을 후처리한다.
 *
 * 후처리로 하는 일은 넷이다.
 *
 * 1. 상세(`algorithms/<id>.json`)에서 공개 집합 밖을 가리키는 `alternatives`를 뺀다.
 *    남겨 두면 상세 파서가 "존재하지 않는 algorithmId"로 fail-closed 한다.
 * 2. 공개하지 않는 7개 언어를 `reserved`로 강등한다. 강등된 구현은 소스 manifest를
 *    들지 않으므로, 벤더링할 소스도 24개로 줄어든다.
 * 3. 사용 시나리오를 마크다운 원문에서 다시 만든다. `site/scenario-overrides/<id>.md`가
 *    있으면 그것이 이기고, 없으면 spec의 `docs/scenarios/<id>.md`를 쓴다. 바이트가
 *    달라지므로 자산 sha256 → 상세 sha256 → 인덱스 순으로 다시 계산한다.
 * 4. 인덱스를 8종만 남기고 다시 쓴다. 인덱스는 무결성 사슬의 뿌리이고 그 자신은
 *    대조 대상이 아니라, 인덱스를 다시 쓰면 사슬이 그대로 다시 닫힌다.
 *
 * 소스·벡터 본문은 카탈로그가 담지 않으므로 콘텐츠 레포에서 함께 떠 온다. 배포에서는
 * `sources/<manifest.path>`·`vectors/<manifest.path>`로 놓이고, 브라우저가 상세가
 * 발표한 sha256·byteLength로 바이트를 확인한 뒤에만 화면에 세운다.
 *
 * 이 스크립트는 비공개 입력이 있어야 돌아간다. 공개 저장소만으로 사이트를 다시 빌드할
 * 때는 이미 떠 놓은 `site/snapshot/`을 그대로 쓰므로 실행할 필요가 없다.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 공개할 알고리즘. 인덱스 key와 같은 ASCII 오름차순으로 둔다. */
const publishedAlgorithmIds = [
  "a-star",
  "aho-corasick",
  "breadth-first-search",
  "bubble-sort",
  "counting-sort",
  "depth-first-search",
  "kmp",
  "quick-sort",
];

/** 공개할 언어. 나머지는 reserved로 강등한다. */
const publishedLanguages = ["java", "javascript", "csharp"];

/** catalog 2.1이 선언하는 고정 언어 자리 순서. implementationStatus 문자열의 자릿수다. */
const languageOrder = [
  "java",
  "javascript",
  "csharp",
  "typescript",
  "python",
  "go",
  "rust",
  "kotlin",
  "cpp",
  "ruby",
];

/**
 * 소스 경로 앞자리 → 콘텐츠 레포 디렉터리 이름. 공개하는 세 언어만 필요하다.
 * 경로는 `src/main/<language>/...` 꼴이라 세 번째 조각이 언어다.
 */
const contentRepositoryByLanguage = {
  java: "ssw-algorithm-archive-content-java",
  javascript: "ssw-algorithm-archive-content-javascript",
  csharp: "ssw-algorithm-archive-content-csharp",
};

/** 공식 벡터와 시나리오 원문은 spec 레포가 갖는다. */
const specRepository = "ssw-algorithm-archive-content-spec";

/** 사용 시나리오 원문의 spec 안 위치. */
const specScenarioDirectory = "docs/scenarios";

/** 시나리오 네 단의 헤딩. 순서까지 계약이라 이 배열과 정확히 같아야 한다. */
const scenarioSteps = ["situation", "why", "apply", "switchPoint"];

/**
 * 공개 산문에서 걷어내는 내부 용어. "티켓"은 사내 작업 단위를 가리키는 말이라
 * 시나리오 산문에 그대로 나가면 읽는 사람에게는 뜻이 없다. 원본(spec)은 그대로 두고
 * 스냅샷 복사본에서만 고친다.
 *
 * 이 교정은 spec 원문을 쓸 때만 걸린다. 오버라이드 파일은 이미 공개용으로 다시 쓴
 * 글이라 문구를 또 건드리지 않는다 — 오버라이드가 들어온 종에서 여기 규칙이 못 찾아
 * 세우는 일도 그래서 생기지 않는다.
 */
const scenarioRewrites = {
  "a-star": [
    {
      from: "이 티켓은 h가 실제 잔여 비용을 넘지 않게 넣고",
      to: "이 구현은 h가 실제 잔여 비용을 넘지 않게 넣고",
    },
  ],
  "breadth-first-search": [
    {
      from: "모든 전환 비용을 한 번의 tap으로 보는 티켓이라",
      to: "모든 전환 비용을 한 번의 tap으로 보는 상황이라",
    },
  ],
};

const siteDirectory = new URL("../", import.meta.url);
const snapshotDirectory = new URL("snapshot/", siteDirectory);
const workspaceDirectory = new URL("../../", siteDirectory);

/**
 * 공개용으로 다시 쓴 시나리오 원문을 두는 자리. 여기 `<id>.md`가 있으면 spec 원문
 * 대신 그것을 쓴다. 형식은 spec 시나리오와 완전히 같다 — front matter(algorithmId·
 * assetVersion)와 고정 4단 헤딩, 빈 줄 문단 분리.
 *
 * 이 층이 없으면 재생성할 때마다 spec 원문이 공개용 문장을 덮어쓴다. 그래서 없는
 * 파일은 정상(spec 사용)이지만, 있는데 규약을 어기는 파일은 오류다 — 오타 하나로
 * 교체가 조용히 무시되는 것이 가장 나쁜 결과다.
 */
const scenarioOverrideDirectory = new URL("scenario-overrides/", siteDirectory);

function resolveCatalogDistDirectory() {
  const configured = process.env.ARCHIVE_CATALOG_DIST?.trim();
  if (configured) return resolve(process.cwd(), configured);
  return fileURLToPath(
    new URL(
      "ssw-algorithm-archive-backend/ssw-algorithm-archive-backend-content-api/catalog/dist/",
      workspaceDirectory,
    ),
  );
}

function resolveContentDirectory() {
  const configured = process.env.ARCHIVE_CONTENT_ROOT?.trim();
  if (configured) return resolve(process.cwd(), configured);
  return fileURLToPath(
    new URL("ssw-algorithm-archive-content/", workspaceDirectory),
  );
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** 생성기와 같은 표기로 쓴다 — 2칸 들여쓰기에 끝 개행 한 줄이다. */
function serializeJson(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function manifestOf(path, bytes) {
  return { path, sha256: sha256(bytes), byteLength: bytes.byteLength };
}

async function writeSnapshotFile(relativePath, bytes) {
  const destination = fileURLToPath(new URL(relativePath, snapshotDirectory));
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
}

/**
 * 시나리오 마크다운 → 자산 객체. spec 생성기가 만드는 것과 같은 형태를 낸다(8종
 * 전수로 바이트까지 같은 것을 확인했다). 규약을 어기면 곧바로 세운다 — 조용히
 * 넘어가면 교체가 무시된 채로 공개된다.
 */
function parseScenarioMarkdown(text, algorithmId, sourcePath) {
  const fail = (reason) => {
    throw new Error(`시나리오 원문 규약 위반 (${sourcePath}): ${reason}`);
  };
  const normalized = text.replace(/\r\n/g, "\n");
  const matched = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(normalized);
  if (!matched) fail("front matter(--- 로 감싼 머리말)를 찾지 못했습니다.");
  const frontMatter = {};
  for (const line of matched[1].split("\n")) {
    const entry = /^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/.exec(line.trim());
    if (entry) frontMatter[entry[1]] = entry[2].replace(/^"|"$/g, "");
  }
  if (frontMatter.algorithmId !== algorithmId) {
    fail(
      `front matter algorithmId가 '${algorithmId}'이어야 하는데 '${frontMatter.algorithmId ?? "(없음)"}'입니다.`,
    );
  }
  if (!frontMatter.assetVersion) fail("front matter assetVersion이 없습니다.");

  const body = matched[2];
  const beforeFirstHeading = body.split(/^## /m)[0];
  if (beforeFirstHeading.trim()) {
    fail("첫 헤딩 앞에 본문이 있습니다. 머리말 다음에는 곧바로 ## situation 이어야 합니다.");
  }
  const sections = body.split(/^## /m).slice(1);
  const scenario = {
    assetVersion: frontMatter.assetVersion,
    algorithmId,
  };
  const seen = [];
  for (const section of sections) {
    const breakIndex = section.indexOf("\n");
    if (breakIndex === -1) fail("헤딩 뒤에 본문이 없습니다.");
    const name = section.slice(0, breakIndex).trim();
    seen.push(name);
    const paragraphs = section
      .slice(breakIndex + 1)
      .trim()
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
    if (!paragraphs.length) fail(`'${name}' 단에 문단이 없습니다.`);
    scenario[name] = paragraphs;
  }
  if (
    seen.length !== scenarioSteps.length ||
    seen.some((name, index) => name !== scenarioSteps[index])
  ) {
    fail(
      `헤딩은 ${scenarioSteps.map((step) => `## ${step}`).join(" → ")} 순서여야 합니다. 지금은 ${seen.join(", ") || "(없음)"}입니다.`,
    );
  }
  return scenario;
}

/**
 * 시나리오 원문을 고른다. 오버라이드가 있으면 그것이 이기고, 없으면 spec 원문이다.
 * 어느 쪽을 썼는지는 호출자가 로그로 남긴다 — 조용히 갈리면 나중에 아무도 모른다.
 */
async function readScenarioSource(algorithmId, contentDirectory) {
  const overridePath = fileURLToPath(
    new URL(`${algorithmId}.md`, scenarioOverrideDirectory),
  );
  try {
    return {
      origin: "override",
      path: overridePath,
      text: await readFile(overridePath, "utf8"),
    };
  } catch (error) {
    // 파일이 없는 것만 정상이다. 권한·인코딩 문제는 삼키지 않는다.
    if (error?.code !== "ENOENT") throw error;
  }
  const specPath = join(
    contentDirectory,
    specRepository,
    specScenarioDirectory,
    `${algorithmId}.md`,
  );
  return {
    origin: "spec",
    path: specPath,
    text: await readFile(specPath, "utf8"),
  };
}

/** spec 원문에만 거는 공개용 문구 교정. 고칠 자리를 못 찾으면 세운다. */
function applyScenarioRewrites(scenario, algorithmId, sourcePath) {
  let replaced = 0;
  for (const rewrite of scenarioRewrites[algorithmId] ?? []) {
    let found = false;
    for (const step of scenarioSteps) {
      scenario[step] = scenario[step].map((paragraph) => {
        if (!paragraph.includes(rewrite.from)) return paragraph;
        found = true;
        replaced += 1;
        return paragraph.split(rewrite.from).join(rewrite.to);
      });
    }
    if (!found) {
      throw new Error(
        `고칠 문구를 찾지 못했습니다 (${sourcePath}): ${rewrite.from}`,
      );
    }
  }
  return replaced;
}

/** 강등된 구현이 드는 세 계획 경로. 기존 operational 값에서 그대로 파생한다. */
function reserveImplementation(implementation) {
  if (implementation.status === "reserved") return implementation;
  const plannedSourcePath = implementation.source.primaryFile;
  return {
    status: "reserved",
    plannedEntryPoint: implementation.entryPoint,
    plannedSourcePath,
    plannedBasicTestPath: plannedSourcePath.replace("src/main/", "src/test/"),
  };
}

function implementationStatusString(implementations) {
  return languageOrder
    .map((language) =>
      implementations[language].status === "operational" ? "O" : "R",
    )
    .join("");
}

/**
 * 인덱스 항목의 coverage 자리 문자열. 순서는 인덱스가 선언하는
 * `vectorCount, caseCount, verifiedLanguages, missingBasicTests, releaseReadyLanguages`다.
 * 상세 파서가 같은 값을 다시 계산해 대조하므로 여기서도 같은 규칙으로 센다.
 */
function coverageString(detail) {
  const implementations = Object.values(detail.implementations);
  const operational = implementations.filter(
    (implementation) => implementation.status === "operational",
  );
  const vectors = Object.values(detail.vectors);
  const verifiedLanguages = operational.filter(
    (implementation) => implementation.verification.vectors.status === "passing",
  ).length;
  const missingBasicTests = operational.filter(
    (implementation) => implementation.basicTest === null,
  ).length;
  const releaseReadyLanguages = operational.filter(
    (implementation) =>
      implementation.basicTest !== null &&
      implementation.verification.vectors.status === "passing" &&
      implementation.verification.vectors.failed === 0 &&
      implementation.verification.vectors.skipped === 0 &&
      implementation.verification.basicTest.status === "passing" &&
      implementation.verification.basicTest.failed === 0 &&
      implementation.verification.basicTest.skipped === 0,
  ).length;
  return [
    vectors.length,
    vectors.reduce((sum, vector) => sum + vector.caseCount, 0),
    verifiedLanguages,
    missingBasicTests,
    releaseReadyLanguages,
  ].join(",");
}

/** 인덱스 totals를 공개 집합만으로 다시 센다. 필드 이름과 뜻은 500종 인덱스와 같다. */
function recomputeTotals(details) {
  const totals = {
    algorithmCount: details.length,
    sourceCount: 0,
    vectorCount: 0,
    caseCount: 0,
    implementationCount: 0,
    operationalImplementations: 0,
    reservedImplementations: 0,
    verifiedImplementations: 0,
    missingBasicTestImplementations: 0,
    basicTestPassingImplementations: 0,
    releaseReadyImplementations: 0,
    passedChecks: 0,
    failedChecks: 0,
    skippedChecks: 0,
  };
  for (const detail of details) {
    for (const vector of Object.values(detail.vectors)) {
      totals.vectorCount += 1;
      totals.caseCount += vector.caseCount;
    }
    for (const language of languageOrder) {
      const implementation = detail.implementations[language];
      totals.implementationCount += 1;
      if (implementation.status !== "operational") {
        totals.reservedImplementations += 1;
        continue;
      }
      totals.operationalImplementations += 1;
      totals.sourceCount += Object.keys(implementation.source.files).length;
      const vectorRun = implementation.verification.vectors;
      const basicRun = implementation.verification.basicTest;
      if (vectorRun.status === "passing") totals.verifiedImplementations += 1;
      if (implementation.basicTest === null) {
        totals.missingBasicTestImplementations += 1;
      }
      if (basicRun.status === "passing") {
        totals.basicTestPassingImplementations += 1;
      }
      if (
        implementation.basicTest !== null &&
        vectorRun.status === "passing" &&
        vectorRun.failed === 0 &&
        vectorRun.skipped === 0 &&
        basicRun.status === "passing" &&
        basicRun.failed === 0 &&
        basicRun.skipped === 0
      ) {
        totals.releaseReadyImplementations += 1;
      }
      totals.passedChecks += vectorRun.passed + basicRun.passed;
      totals.failedChecks += vectorRun.failed + basicRun.failed;
      totals.skippedChecks += vectorRun.skipped + basicRun.skipped;
    }
  }
  return totals;
}

/**
 * 후처리가 500종 인덱스의 집계 규칙을 그대로 재현하는지 확인한다. 원본 상세 전수로
 * 다시 센 값이 원본 totals와 한 자리라도 다르면 공개 스냅샷의 지표도 믿을 수 없다.
 */
async function assertTotalsRuleMatchesSource(catalogDistDirectory, index) {
  const details = await Promise.all(
    Object.keys(index.algorithms).map(async (id) =>
      JSON.parse(
        await readFile(join(catalogDistDirectory, "algorithms", `${id}.json`), "utf8"),
      ),
    ),
  );
  const derived = recomputeTotals(details);
  for (const [key, value] of Object.entries(index.totals)) {
    if (derived[key] !== value) {
      throw new Error(
        `totals.${key} 재계산 규칙이 원본과 다릅니다: 원본 ${value}, 재계산 ${derived[key]}.`,
      );
    }
  }
}

async function main() {
  const catalogDistDirectory = resolveCatalogDistDirectory();
  const contentDirectory = resolveContentDirectory();
  const publishedIdSet = new Set(publishedAlgorithmIds);

  const sourceIndex = JSON.parse(
    await readFile(join(catalogDistDirectory, "catalog-index.json"), "utf8"),
  );
  if (sourceIndex.schemaVersion !== "2.1") {
    throw new Error(`catalog-index.json schemaVersion이 2.1이 아닙니다: ${sourceIndex.schemaVersion}.`);
  }
  if (
    sourceIndex.languages.length !== languageOrder.length ||
    sourceIndex.languages.some((language, index) => language !== languageOrder[index])
  ) {
    throw new Error("catalog-index.json languages 자리 순서가 이 스크립트의 가정과 다릅니다.");
  }
  await assertTotalsRuleMatchesSource(catalogDistDirectory, sourceIndex);

  const sourceSearch = JSON.parse(
    await readFile(join(catalogDistDirectory, "catalog-search.json"), "utf8"),
  );

  await rm(fileURLToPath(snapshotDirectory), { recursive: true, force: true });

  const details = [];
  const indexAlgorithms = {};
  const vendoredSources = [];
  const vendoredVectors = [];
  const scenarioOrigins = [];

  for (const id of publishedAlgorithmIds) {
    const entry = sourceIndex.algorithms[id];
    if (!entry) throw new Error(`인덱스에 없는 알고리즘입니다: ${id}.`);
    const detail = JSON.parse(
      await readFile(join(catalogDistDirectory, "algorithms", `${id}.json`), "utf8"),
    );

    // 1) 공개 집합 밖 대안 제거.
    detail.alternatives = detail.alternatives.filter((target) =>
      publishedIdSet.has(target),
    );
    // kind/relationships를 든 종은 공개 집합에 없다. 생기면 대안과 같은 처리가
    // 필요하므로 조용히 넘기지 않고 세운다.
    if (detail.kind !== undefined || detail.relationships !== undefined) {
      throw new Error(`${id}: kind·relationships를 든 종은 아직 다루지 않습니다.`);
    }

    // 2) 공개하지 않는 언어를 reserved로 강등.
    for (const language of languageOrder) {
      const implementation = detail.implementations[language];
      if (!implementation) throw new Error(`${id}: ${language} 구현 자리가 없습니다.`);
      if (publishedLanguages.includes(language)) {
        if (implementation.status !== "operational") {
          throw new Error(`${id}: ${language}가 operational이 아닙니다.`);
        }
        continue;
      }
      detail.implementations[language] = reserveImplementation(implementation);
    }

    // 3) 종별 자산 — 시나리오 원문을 고르고, 그 결과로 manifest를 다시 계산한다.
    for (const [assetName, assetManifest] of Object.entries(detail.assets)) {
      if (assetName !== "usage-scenario") {
        // 시나리오 말고 다른 자산이 붙으면 원문 규약을 모르므로 바이트를 그대로 옮긴다.
        const bytes = await readFile(join(catalogDistDirectory, assetManifest.path));
        await writeSnapshotFile(assetManifest.path, bytes);
        detail.assets[assetName] = manifestOf(assetManifest.path, bytes);
        continue;
      }
      const source = await readScenarioSource(id, contentDirectory);
      const scenario = parseScenarioMarkdown(source.text, id, source.path);
      const rewritten =
        source.origin === "spec"
          ? applyScenarioRewrites(scenario, id, source.path)
          : 0;
      const bytes = serializeJson(scenario);
      await writeSnapshotFile(assetManifest.path, bytes);
      detail.assets[assetName] = manifestOf(assetManifest.path, bytes);
      scenarioOrigins.push({ id, origin: source.origin, rewritten });
    }

    // 4) 소스·벡터 본문 벤더링. 상세가 발표한 해시로 대조해, 카탈로그가 가리키는
    //    바이트와 다른 파일을 스냅샷에 넣지 않는다.
    for (const language of publishedLanguages) {
      const implementation = detail.implementations[language];
      for (const file of Object.values(implementation.source.files)) {
        const repository = contentRepositoryByLanguage[language];
        const bytes = await readFile(join(contentDirectory, repository, file.path));
        if (sha256(bytes) !== file.sha256 || bytes.byteLength !== file.byteLength) {
          throw new Error(`소스 바이트가 카탈로그 manifest와 다릅니다: ${file.path}`);
        }
        await writeSnapshotFile(`sources/${file.path}`, bytes);
        vendoredSources.push(file.path);
      }
    }
    for (const vector of Object.values(detail.vectors)) {
      const bytes = await readFile(
        join(contentDirectory, specRepository, vector.path),
      );
      if (sha256(bytes) !== vector.sha256 || bytes.byteLength !== vector.byteLength) {
        throw new Error(`벡터 바이트가 카탈로그 manifest와 다릅니다: ${vector.path}`);
      }
      await writeSnapshotFile(`vectors/${vector.path}`, bytes);
      vendoredVectors.push(vector.path);
    }

    const detailBytes = serializeJson(detail);
    await writeSnapshotFile(`algorithms/${id}.json`, detailBytes);
    details.push(detail);
    indexAlgorithms[id] = {
      name: entry.name,
      summary: entry.summary,
      description: entry.description,
      category: entry.category,
      family: entry.family,
      implementationStatus: implementationStatusString(detail.implementations),
      coverage: coverageString(detail),
      // 피드백 집계는 인덱스의 필수 필드다. 공개 화면은 그리지 않지만 스키마를
      // 깨지 않도록 값은 원본 그대로 싣는다.
      feedback: entry.feedback,
      detail: manifestOf(`algorithms/${id}.json`, detailBytes),
    };
  }

  const searchBytes = serializeJson({
    schemaVersion: "2.1",
    algorithms: Object.fromEntries(
      publishedAlgorithmIds.map((id) => [id, sourceSearch.algorithms[id]]),
    ),
  });
  await writeSnapshotFile("catalog-search.json", searchBytes);

  const indexBytes = serializeJson({
    schemaVersion: "2.1",
    languages: sourceIndex.languages,
    coverageFields: sourceIndex.coverageFields,
    totals: recomputeTotals(details),
    search: manifestOf("catalog-search.json", searchBytes),
    algorithms: indexAlgorithms,
  });
  await writeSnapshotFile("catalog-index.json", indexBytes);

  const totals = JSON.parse(indexBytes.toString("utf8")).totals;
  console.log(`스냅샷 생성 완료: ${fileURLToPath(snapshotDirectory)}`);
  console.log(`  totals: ${JSON.stringify(totals)}`);
  console.log(`  소스 ${vendoredSources.length}개 · 벡터 ${vendoredVectors.length}개`);

  // 시나리오는 종마다 원문이 갈릴 수 있다. 어느 종이 무엇을 썼는지 반드시 남긴다.
  const overridden = scenarioOrigins.filter((item) => item.origin === "override");
  const fromSpec = scenarioOrigins.filter((item) => item.origin === "spec");
  console.log(
    `  시나리오: 오버라이드 ${overridden.length}종 · spec 원문 ${fromSpec.length}종`,
  );
  if (overridden.length) {
    console.log(`    오버라이드 사용: ${overridden.map((item) => item.id).join(", ")}`);
  } else {
    console.log(
      `    오버라이드 없음 — ${fileURLToPath(scenarioOverrideDirectory)} 아래에 <id>.md 를 두면 그 종만 갈아탑니다.`,
    );
  }
  const rewrittenSpecies = fromSpec.filter((item) => item.rewritten > 0);
  if (rewrittenSpecies.length) {
    console.log(
      `    spec 원문 문구 교정: ${rewrittenSpecies
        .map((item) => `${item.id}(${item.rewritten}곳)`)
        .join(", ")}`,
    );
  }
}

main().catch((error) => {
  console.error(
    `공개 스냅샷 생성에 실패했습니다. 원인 유형: ${
      error instanceof Error ? error.name : typeof error
    }`,
  );
  console.error(error instanceof Error ? error.message : String(error));
  console.error(
    `catalog 분할본: ${resolveCatalogDistDirectory()} (ARCHIVE_CATALOG_DIST로 지정할 수 있습니다.)`,
  );
  console.error(
    `콘텐츠 레포 루트: ${resolveContentDirectory()} (ARCHIVE_CONTENT_ROOT로 지정할 수 있습니다.)`,
  );
  if (error instanceof Error && error.stack) console.error(`상세 스택:\n${error.stack}`);
  process.exitCode = 1;
});
