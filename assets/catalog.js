import { englishSearchAliases } from "./english-abbreviations.js";
import { categoryDisplayName, familyDisplayName, } from "./korean-display-names.js";
import { koreanSearchAliases } from "./korean-names.js";
const statuses = ["R", "I", "O", "E"];
const verificationStatuses = ["not-run", "passing", "failing"];
const catalogSchemaVersions = ["1.0", "1.1", "1.2", "2.0"];
const languages = [
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
const sourceExtensions = {
    java: [".java"],
    javascript: [".js"],
    csharp: [".cs"],
    typescript: [".ts"],
    python: [".py"],
    go: [".go"],
    rust: [".rs"],
    kotlin: [".kt"],
    cpp: [".cpp", ".hpp"],
    ruby: [".rb"],
};
const maxSourceBytes = 512 * 1024;
const maxSourceLineCharacters = 25_000;
const maxVectorBytes = 16 * 1024 * 1024;
const catalogCategories20 = [
    "sort",
    "search",
    "graph",
    "tree",
    "dynamic-programming",
    "data-structure",
    "string",
    "math",
    "geometry",
    "probabilistic",
    "cache",
    "resilience",
    "rate-limit",
    "concurrency",
    "sequence",
    "encoding",
    "distributed-systems",
    "streaming",
    "automata",
    "logic",
    "scheduling",
];
const feedbackStatuses = [
    "none",
    "pending",
    "approved",
    "rejected",
    "unavailable",
];
const algorithmKinds = [
    "algorithm",
    "data-structure",
    "codec",
    "protocol",
    "policy",
    "utility",
    "deterministic-simulator",
];
const relationshipFields = [
    "derivedFrom",
    "specializationOf",
    "sameProblemDifferentMethod",
    "composes",
];
const acyclicRelationshipFields = [
    "derivedFrom",
    "specializationOf",
    "composes",
];
const feedbackCountFields = [
    "candidateCount",
    "approvedCount",
    "rejectedCount",
    "pendingCount",
];
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
 * opaque contract를 화면이 아는 네 필드로만 좁힌다. 타입이 다른 알려진 필드도
 * 버리지 않고 opaque에 남겨 JSON fallback으로 표시하므로 새 metadata가 추가돼도
 * 상세 화면이 예외를 내거나 조용히 값을 잃지 않는다.
 */
export function contractPresentation(contract) {
    const input = isRecord(contract.input) ? contract.input : undefined;
    const output = isRecord(contract.output) ? contract.output : undefined;
    const errors = Array.isArray(contract.errors) ? contract.errors : [];
    const mutation = typeof contract.mutation === "string" ? contract.mutation : undefined;
    const opaque = Object.fromEntries(Object.entries(contract).filter(([key, value]) => {
        if (key === "input")
            return !isRecord(value);
        if (key === "output")
            return !isRecord(value);
        if (key === "errors")
            return !Array.isArray(value);
        if (key === "mutation")
            return typeof value !== "string";
        return true;
    }));
    return {
        ...(input === undefined ? {} : { input }),
        ...(output === undefined ? {} : { output }),
        errors,
        ...(mutation === undefined ? {} : { mutation }),
        opaque,
        empty: Object.keys(contract).length === 0,
    };
}
function string(value, field) {
    if (typeof value !== "string" || !value.trim()) {
        throw new TypeError(`catalog.json ${field}: 비어 있지 않은 문자열이어야 합니다.`);
    }
    return value.trim();
}
function sourceContent(value, field) {
    if (typeof value !== "string") {
        throw new TypeError(`catalog.json ${field}: 문자열이어야 합니다.`);
    }
    if (new TextEncoder().encode(value).byteLength > maxSourceBytes) {
        throw new TypeError(`catalog.json ${field}: UTF-8 기준 ${maxSourceBytes}바이트 이하여야 합니다.`);
    }
    if (value
        .split(/\r\n|\r|\n/u)
        .some((line) => line.length > maxSourceLineCharacters)) {
        throw new TypeError(`catalog.json ${field}: 각 줄은 ${maxSourceLineCharacters}자 이하여야 합니다.`);
    }
    return value;
}
/**
 * 1.2 소스 manifest는 코드 대신 무결성 정보만 싣는 작은 보안 경계다. 알려지지
 * 않은 키를 조용히 버리면 content나 환경별 URL이 다시 카탈로그에 섞여도 눈치채지
 * 못하므로, 이 객체만큼은 정확한 다섯 키 외에는 받지 않는다.
 */
function exactKeys(value, allowedKeys, field) {
    const allowed = new Set(allowedKeys);
    const unknown = Object.keys(value).filter((key) => !allowed.has(key));
    if (unknown.length) {
        throw new TypeError(`catalog.json ${field}: 알 수 없는 키가 있습니다: ${unknown.join(", ")}.`);
    }
    const missing = allowedKeys.filter((key) => !Object.hasOwn(value, key));
    if (missing.length) {
        throw new TypeError(`catalog.json ${field}: 필수 키가 없습니다: ${missing.join(", ")}.`);
    }
}
function knownKeys(value, allowedKeys, field) {
    const allowed = new Set(allowedKeys);
    const unknown = Object.keys(value).filter((key) => !allowed.has(key));
    if (unknown.length) {
        throw new TypeError(`catalog.json ${field}: 알 수 없는 키가 있습니다: ${unknown.join(", ")}.`);
    }
}
/**
 * schema 2.0 객체는 required/optional 키 집합까지 공개 계약이다. optional을
 * exactKeys에 섞어 필수로 오인하지 않으면서도, 환경 URL·본문 같은 미지 키가
 * 조용히 들어오는 것은 막는다.
 */
function exactShape(value, requiredKeys, optionalKeys, field) {
    knownKeys(value, [...requiredKeys, ...optionalKeys], field);
    const missing = requiredKeys.filter((key) => !Object.hasOwn(value, key));
    if (missing.length) {
        throw new TypeError(`catalog.json ${field}: 필수 키가 없습니다: ${missing.join(", ")}.`);
    }
}
function sha256(value, field) {
    if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
        throw new TypeError(`catalog.json ${field}: 소문자 16진수 SHA-256 64자리여야 합니다.`);
    }
    return value;
}
function languageName(value, field) {
    const parsed = string(value, field);
    if (!languages.includes(parsed)) {
        throw new TypeError(`catalog.json ${field}: 지원하는 구현 언어여야 합니다.`);
    }
    return parsed;
}
function count(value, field) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw new TypeError(`catalog.json ${field}: 0 이상의 정수여야 합니다.`);
    }
    return value;
}
/**
 * 2.0 정본 문자열은 parser가 trim해서 다른 값으로 바꾸지 않는다. 생성기와 같은
 * 경계에서 앞뒤 공백까지 거절해야 manifest hash와 화면 의미가 한 값만 가리킨다.
 */
function exactText(value, field) {
    if (typeof value !== "string" ||
        value.trim().length === 0 ||
        value !== value.trim()) {
        throw new TypeError(`catalog.json ${field}: 앞뒤 공백 없는 비어 있지 않은 문자열이어야 합니다.`);
    }
    return value;
}
function positiveCount(value, field, maximum) {
    const parsed = count(value, field);
    if (parsed === 0) {
        throw new TypeError(`catalog.json ${field}: 1 이상이어야 합니다.`);
    }
    if (maximum !== undefined && parsed > maximum) {
        throw new TypeError(`catalog.json ${field}: ${maximum} 이하여야 합니다.`);
    }
    return parsed;
}
/** locale 설정과 무관한 JS 문자열 코드 단위 비교로 producer의 ASCII 순서를 맞춘다. */
function asciiSortedKeys(value, field) {
    const keys = Object.keys(value);
    for (let index = 1; index < keys.length; index += 1) {
        const previous = keys[index - 1];
        const current = keys[index];
        if (previous === undefined || current === undefined || previous >= current) {
            throw new TypeError(`catalog.json ${field}: 키는 ASCII 오름차순이며 중복될 수 없습니다.`);
        }
    }
    return keys;
}
function algorithmIdentifier20(value, field) {
    if (typeof value !== "string" ||
        !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(value)) {
        throw new TypeError(`catalog.json ${field}: 영문 소문자로 시작하는 kebab-case 식별자여야 합니다.`);
    }
    return value;
}
function kebabIdentifier(value, field) {
    if (typeof value !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)) {
        throw new TypeError(`catalog.json ${field}: 소문자 kebab-case 식별자여야 합니다.`);
    }
    return value;
}
function object(value, field) {
    if (!isRecord(value)) {
        throw new TypeError(`catalog.json ${field}: 객체여야 합니다.`);
    }
    return value;
}
function stringArray(value, field) {
    if (!Array.isArray(value)) {
        throw new TypeError(`catalog.json ${field}: 배열이어야 합니다.`);
    }
    return value.map((item, index) => string(item, `${field}[${index}]`));
}
function exactTextArray(value, field) {
    if (!Array.isArray(value)) {
        throw new TypeError(`catalog.json ${field}: 배열이어야 합니다.`);
    }
    return value.map((item, index) => exactText(item, `${field}[${index}]`));
}
function uniqueStrings(values, field) {
    if (new Set(values).size !== values.length) {
        throw new TypeError(`catalog.json ${field}: 중복 값이 있습니다.`);
    }
    return values;
}
/** alternatives가 없는 기존 1.0 catalog에는 반환 객체의 키도 추가하지 않는다. */
function parseAlternatives(value, field) {
    if (value === undefined)
        return undefined;
    return uniqueStrings(stringArray(value, field), field);
}
function parseDocumentation(value, field, schemaVersion) {
    if (value === undefined)
        return undefined;
    if (schemaVersion === "1.0") {
        throw new TypeError(`catalog.json ${field}: documentation은 1.1 이상 계약에서만 사용할 수 있습니다.`);
    }
    const documentation = object(value, field);
    return {
        summary: string(documentation.summary, `${field}.summary`),
        whenToUse: stringArray(documentation.whenToUse, `${field}.whenToUse`),
        avoidWhen: stringArray(documentation.avoidWhen, `${field}.avoidWhen`),
        tradeoffs: stringArray(documentation.tradeoffs, `${field}.tradeoffs`),
        pitfalls: stringArray(documentation.pitfalls, `${field}.pitfalls`),
    };
}
function parseAlgorithmKind(value, field, schemaVersion) {
    if (value === undefined)
        return undefined;
    if (schemaVersion !== "1.2" && schemaVersion !== "2.0") {
        throw new TypeError(`catalog.json ${field}: kind는 1.2/2.0 계약에서만 사용할 수 있습니다.`);
    }
    const parsed = string(value, field);
    if (!algorithmKinds.includes(parsed)) {
        throw new TypeError(`catalog.json ${field}: 허용되지 않는 algorithm kind입니다.`);
    }
    return parsed;
}
function parseRelationships(value, field, schemaVersion) {
    if (value === undefined)
        return undefined;
    if (schemaVersion !== "1.2" && schemaVersion !== "2.0") {
        throw new TypeError(`catalog.json ${field}: relationships는 1.2/2.0 계약에서만 사용할 수 있습니다.`);
    }
    const relationships = object(value, field);
    knownKeys(relationships, relationshipFields, field);
    if (!Object.keys(relationships).length) {
        throw new TypeError(`catalog.json ${field}: 관계 키를 하나 이상 선언해야 합니다.`);
    }
    const parsed = {};
    for (const relationship of relationshipFields) {
        const raw = relationships[relationship];
        if (raw === undefined)
            continue;
        if (!Array.isArray(raw)) {
            throw new TypeError(`catalog.json ${field}.${relationship}: 배열이어야 합니다.`);
        }
        const ids = uniqueStrings(raw.map((target, index) => kebabIdentifier(target, `${field}.${relationship}[${index}]`)), `${field}.${relationship}`);
        if (!ids.length) {
            throw new TypeError(`catalog.json ${field}.${relationship}: 하나 이상의 algorithmId가 필요합니다.`);
        }
        parsed[relationship] = ids;
    }
    return parsed;
}
function parseSource(value, index, schemaVersion) {
    const field = `sources[${index}]`;
    const source = object(value, field);
    if (schemaVersion === "1.2") {
        exactKeys(source, ["id", "language", "path", "sha256", "byteLength"], field);
    }
    const path = string(source.path, `${field}.path`);
    const language = languageName(source.language, `${field}.language`);
    if (path.includes("\\") ||
        path.startsWith("/") ||
        /^[A-Za-z]:/.test(path) ||
        path.split("/").some((part) => part.startsWith(".") || !part) ||
        !path.startsWith(`src/main/${language}/`) ||
        !sourceExtensions[language].some((extension) => path.endsWith(extension)) ||
        !/^[A-Za-z0-9_./-]+$/.test(path)) {
        throw new TypeError(`catalog.json ${field}.path: 선언 언어의 정규화된 공개 소스 경로여야 합니다.`);
    }
    const id = string(source.id, `${field}.id`);
    if (id !== `source:${path}`) {
        throw new TypeError(`catalog.json ${field}.id: source:<path> 형식과 path가 일치해야 합니다.`);
    }
    const common = {
        id,
        language,
        path,
    };
    if (schemaVersion === "1.2") {
        const parsedByteLength = count(source.byteLength, `${field}.byteLength`);
        if (parsedByteLength > maxSourceBytes) {
            throw new TypeError(`catalog.json ${field}.byteLength: ${maxSourceBytes}바이트 이하여야 합니다.`);
        }
        return {
            ...common,
            sha256: sha256(source.sha256, `${field}.sha256`),
            byteLength: parsedByteLength,
        };
    }
    return {
        ...common,
        content: sourceContent(source.content, `${field}.content`),
    };
}
function parseVectorManifest(value, index) {
    const field = `vectors[${index}]`;
    const vector = object(value, field);
    exactKeys(vector, ["id", "algorithmId", "path", "sha256", "byteLength", "caseCount"], field);
    const path = string(vector.path, `${field}.path`);
    // 공개 정본만 열 수 있게 valid 바로 아래 JSON 파일로 닫는다. retired·invalid,
    // 중첩 디렉터리와 점 경로는 manifest 단계에서 모두 거절한다.
    const id = kebabIdentifier(vector.id, `${field}.id`);
    const algorithmId = kebabIdentifier(vector.algorithmId, `${field}.algorithmId`);
    if (path !== `test-vectors/valid/${id}.json`) {
        throw new TypeError(`catalog.json ${field}.path: 'test-vectors/valid/${id}.json'과 같아야 합니다.`);
    }
    const byteLength = count(vector.byteLength, `${field}.byteLength`);
    const caseCount = count(vector.caseCount, `${field}.caseCount`);
    if (caseCount === 0) {
        throw new TypeError(`catalog.json ${field}.caseCount: 1 이상이어야 합니다.`);
    }
    return {
        id,
        algorithmId,
        path,
        sha256: sha256(vector.sha256, `${field}.sha256`),
        byteLength,
        caseCount,
    };
}
function parseLanguage(value, field, schemaVersion) {
    const language = object(value, field);
    const implementationStatus = string(language.implementationStatus, `${field}.implementationStatus`);
    const verification = string(language.verification, `${field}.verification`);
    if (!statuses.includes(implementationStatus)) {
        throw new TypeError(`catalog.json ${field}.implementationStatus: 허용되지 않는 상태입니다.`);
    }
    if (!verificationStatuses.includes(verification)) {
        throw new TypeError(`catalog.json ${field}.verification: 허용되지 않는 검증 상태입니다.`);
    }
    const summary = object(language.testSummary, `${field}.testSummary`);
    const sourceId = language.sourceId === undefined
        ? undefined
        : string(language.sourceId, `${field}.sourceId`);
    if (schemaVersion === "1.0" && sourceId !== undefined) {
        throw new TypeError(`catalog.json ${field}.sourceId: sourceId는 1.1/1.2 계약에서만 사용할 수 있습니다.`);
    }
    return {
        language: languageName(language.language, `${field}.language`),
        implementationStatus: implementationStatus,
        entryPoint: string(language.entryPoint, `${field}.entryPoint`),
        ...(sourceId === undefined ? {} : { sourceId }),
        verification: verification,
        testSummary: {
            passed: count(summary.passed, `${field}.testSummary.passed`),
            failed: count(summary.failed, `${field}.testSummary.failed`),
            skipped: count(summary.skipped, `${field}.testSummary.skipped`),
        },
    };
}
function parseContract(value, field) {
    const contract = object(value, field);
    if (!Array.isArray(contract.errors)) {
        throw new TypeError(`catalog.json ${field}.errors: 배열이어야 합니다.`);
    }
    return {
        input: object(contract.input, `${field}.input`),
        output: object(contract.output, `${field}.output`),
        errors: contract.errors,
        mutation: string(contract.mutation, `${field}.mutation`),
    };
}
function parseFeedback(value, field, schemaVersion) {
    const feedback = object(value, field);
    const status = string(feedback.status, `${field}.status`);
    if (!feedbackStatuses.includes(status)) {
        throw new TypeError(`catalog.json ${field}.status: 허용되지 않는 피드백 상태입니다.`);
    }
    const evidenceCount = count(feedback.evidenceCount, `${field}.evidenceCount`);
    const suppliedExtendedCount = feedbackCountFields.some((countField) => feedback[countField] !== undefined);
    // unavailable + evidenceCount=0은 1.0 정본이며, 1.1 소비 경계도 이
    // 하위 호환 형태를 명시적으로 수용한다.
    if (status === "unavailable") {
        if (suppliedExtendedCount || evidenceCount !== 0) {
            throw new TypeError(`catalog.json ${field}: unavailable 피드백은 evidenceCount=0인 레거시 형태여야 합니다.`);
        }
        return {
            status: "unavailable",
            evidenceCount: 0,
            candidateCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            pendingCount: 0,
        };
    }
    if (schemaVersion === "1.0") {
        if (suppliedExtendedCount || status !== "unavailable") {
            throw new TypeError(`catalog.json ${field}: 1.0 계약은 unavailable 피드백만 허용합니다.`);
        }
    }
    if (!suppliedExtendedCount) {
        throw new TypeError(`catalog.json ${field}: 1.1 피드백 집계 필드를 모두 선언해야 합니다.`);
    }
    const parsed = {
        status: status,
        evidenceCount,
        candidateCount: count(feedback.candidateCount, `${field}.candidateCount`),
        approvedCount: count(feedback.approvedCount, `${field}.approvedCount`),
        rejectedCount: count(feedback.rejectedCount, `${field}.rejectedCount`),
        pendingCount: count(feedback.pendingCount, `${field}.pendingCount`),
    };
    if (parsed.approvedCount + parsed.rejectedCount > parsed.candidateCount) {
        throw new TypeError(`catalog.json ${field}: 승인·거절 수는 후보 수를 넘을 수 없습니다.`);
    }
    const allCountsAreZero = parsed.evidenceCount === 0 &&
        parsed.candidateCount === 0 &&
        parsed.approvedCount === 0 &&
        parsed.rejectedCount === 0 &&
        parsed.pendingCount === 0;
    if (parsed.status === "none" && !allCountsAreZero) {
        throw new TypeError(`catalog.json ${field}: none 상태의 집계는 모두 0이어야 합니다.`);
    }
    if (parsed.status === "pending" && parsed.pendingCount === 0) {
        throw new TypeError(`catalog.json ${field}.pendingCount: pending 상태에서는 1 이상이어야 합니다.`);
    }
    if (parsed.status === "approved" &&
        (parsed.pendingCount !== 0 || parsed.approvedCount === 0)) {
        throw new TypeError(`catalog.json ${field}: approved 상태에는 승인 1건 이상과 pending 0건이 필요합니다.`);
    }
    if (parsed.status === "rejected" &&
        (parsed.pendingCount !== 0 ||
            parsed.approvedCount !== 0 ||
            parsed.rejectedCount === 0)) {
        throw new TypeError(`catalog.json ${field}: rejected 상태에는 거절 1건 이상만 있어야 합니다.`);
    }
    return parsed;
}
function parseAlgorithm(value, index, schemaVersion) {
    const field = `algorithms[${index}]`;
    const item = object(value, field);
    if (schemaVersion === "1.2") {
        knownKeys(item, [
            "id",
            "kind",
            "relationships",
            "alternatives",
            "name",
            "summary",
            "documentation",
            "category",
            "family",
            "contract",
            "complexity",
            "preconditions",
            "languages",
            "vectorIds",
            "coverage",
            "feedback",
        ], field);
    }
    const algorithmId = schemaVersion === "1.2"
        ? kebabIdentifier(item.id, `${field}.id`)
        : string(item.id, `${field}.id`);
    const complexity = object(item.complexity, `${field}.complexity`);
    const coverage = object(item.coverage, `${field}.coverage`);
    if (!Array.isArray(item.languages)) {
        throw new TypeError(`catalog.json ${field}: 목록 필드가 올바르지 않습니다.`);
    }
    if (schemaVersion === "1.2") {
        if (!Array.isArray(item.vectorIds) || item.testVectors !== undefined) {
            throw new TypeError(`catalog.json ${field}: 1.2는 testVectors 대신 vectorIds 배열을 사용해야 합니다.`);
        }
    }
    else if (!Array.isArray(item.testVectors) || item.vectorIds !== undefined) {
        throw new TypeError(`catalog.json ${field}: 1.0/1.1은 embedded testVectors 배열을 사용해야 합니다.`);
    }
    const alternatives = parseAlternatives(item.alternatives, `${field}.alternatives`);
    const kind = parseAlgorithmKind(item.kind, `${field}.kind`, schemaVersion);
    const relationships = parseRelationships(item.relationships, `${field}.relationships`, schemaVersion);
    if (relationships !== undefined && kind === undefined) {
        throw new TypeError(`catalog.json ${field}.relationships: kind가 있는 metadata 1.1 알고리즘에만 사용할 수 있습니다.`);
    }
    const documentation = parseDocumentation(item.documentation, `${field}.documentation`, schemaVersion);
    const languages = item.languages.map((language, languageIndex) => parseLanguage(language, `${field}.languages[${languageIndex}]`, schemaVersion));
    uniqueStrings(languages.map((language) => language.language), `${field}.languages[].language`);
    const embeddedVectors = Array.isArray(item.testVectors) ? item.testVectors : [];
    const testVectors = embeddedVectors.map((vector, vectorIndex) => {
        const vectorField = `${field}.testVectors[${vectorIndex}]`;
        const entry = object(vector, vectorField);
        if (!Array.isArray(entry.cases)) {
            throw new TypeError(`catalog.json ${vectorField}.cases: 배열이어야 합니다.`);
        }
        return {
            id: string(entry.id, `${vectorField}.id`),
            cases: entry.cases,
        };
    });
    uniqueStrings(testVectors.map((vector) => vector.id), `${field}.testVectors[].id`);
    const vectorIds = schemaVersion === "1.2"
        ? item.vectorIds.map((vectorId, vectorIndex) => kebabIdentifier(vectorId, `${field}.vectorIds[${vectorIndex}]`))
        : undefined;
    if (vectorIds) {
        for (let index = 1; index < vectorIds.length; index += 1) {
            const previous = vectorIds[index - 1];
            const current = vectorIds[index];
            if (previous === undefined ||
                current === undefined ||
                previous.localeCompare(current, "en") >= 0) {
                throw new TypeError(`catalog.json ${field}.vectorIds: 중복 없이 오름차순이어야 합니다.`);
            }
        }
    }
    return {
        id: algorithmId,
        ...(kind === undefined ? {} : { kind }),
        ...(relationships === undefined ? {} : { relationships }),
        name: string(item.name, `${field}.name`),
        summary: string(item.summary, `${field}.summary`),
        ...(documentation === undefined ? {} : { documentation }),
        ...(alternatives === undefined ? {} : { alternatives }),
        category: string(item.category, `${field}.category`),
        family: string(item.family, `${field}.family`),
        contract: parseContract(item.contract, `${field}.contract`),
        complexity: {
            time: string(complexity.time, `${field}.complexity.time`),
            space: string(complexity.space, `${field}.complexity.space`),
        },
        preconditions: stringArray(item.preconditions, `${field}.preconditions`),
        languages,
        testVectors,
        ...(vectorIds === undefined ? {} : { vectorIds }),
        coverage: {
            vectorCount: count(coverage.vectorCount, `${field}.coverage.vectorCount`),
            caseCount: count(coverage.caseCount, `${field}.coverage.caseCount`),
            verifiedLanguages: count(coverage.verifiedLanguages, `${field}.coverage.verifiedLanguages`),
        },
        feedback: parseFeedback(item.feedback, `${field}.feedback`, schemaVersion),
    };
}
function manifestPath20(value, language, root, field) {
    const parsed = exactText(value, field);
    const prefix = `src/${root}/${language}/`;
    const segments = parsed.split("/");
    if (parsed.includes("\\") ||
        parsed.startsWith("/") ||
        /^[A-Za-z]:/u.test(parsed) ||
        !/^[A-Za-z0-9_./-]+$/u.test(parsed) ||
        segments.some((segment) => !segment || segment === "." || segment === "..") ||
        !parsed.startsWith(prefix) ||
        !sourceExtensions[language].some((extension) => parsed.endsWith(extension))) {
        throw new TypeError(`catalog.json ${field}: '${prefix}' 아래의 정규화된 POSIX 소스 경로여야 합니다.`);
    }
    return parsed;
}
function parseVerificationSummary20(value, field) {
    const summary = object(value, field);
    exactKeys(summary, ["status", "passed", "failed", "skipped"], field);
    const status = exactText(summary.status, `${field}.status`);
    if (!verificationStatuses.includes(status)) {
        throw new TypeError(`catalog.json ${field}.status: 허용되지 않는 검증 상태입니다.`);
    }
    const passed = count(summary.passed, `${field}.passed`);
    const failed = count(summary.failed, `${field}.failed`);
    const skipped = count(summary.skipped, `${field}.skipped`);
    // catalog-core와 같은 교차필드 진리표다. 특히 skipped만 있는 not-run을 허용하면
    // "실행하지 않음"과 "실행했지만 건너뜀"이 같은 상태가 되므로 네 값 모두 함께
    // 검증한다.
    const validStatus = status === "failing"
        ? failed > 0
        : status === "passing"
            ? passed > 0 && failed === 0
            : passed === 0 && failed === 0 && skipped === 0;
    if (!validStatus) {
        throw new TypeError(`catalog.json ${field}.status: not-run은 전부 0, passing은 passed>0/failed=0, failing은 failed>0이어야 합니다.`);
    }
    return {
        status: status,
        passed,
        failed,
        skipped,
    };
}
/**
 * v2 file group은 화면 편의를 위한 임의 링크 모음이 아니라 MCP allowlist다.
 * primary와 companion 모두 같은 검증을 거치고, catalog 전체에서 ID/path 소유자가
 * 하나뿐인지 여기서 확정한 뒤에만 원격 로더에 넘긴다.
 */
function parseFileGroup20(value, language, root, field, state) {
    const group = object(value, field);
    exactKeys(group, ["primaryFile", "files"], field);
    const primaryFile = exactText(group.primaryFile, `${field}.primaryFile`);
    const fileMap = object(group.files, `${field}.files`);
    const paths = asciiSortedKeys(fileMap, `${field}.files`);
    if (!paths.length) {
        throw new TypeError(`catalog.json ${field}.files: 하나 이상의 파일이 필요합니다.`);
    }
    if (!Object.hasOwn(fileMap, primaryFile)) {
        throw new TypeError(`catalog.json ${field}.primaryFile: files map key에 존재해야 합니다.`);
    }
    const files = paths.map((pathKey) => {
        const fileField = `${field}.files.${pathKey}`;
        const path = manifestPath20(pathKey, language, root, fileField);
        const manifest = object(fileMap[pathKey], fileField);
        exactKeys(manifest, ["id", "path", "sha256", "byteLength"], fileField);
        const declaredPath = exactText(manifest.path, `${fileField}.path`);
        if (declaredPath !== path) {
            throw new TypeError(`catalog.json ${fileField}.path: files map key와 같아야 합니다.`);
        }
        const id = exactText(manifest.id, `${fileField}.id`);
        if (id !== `source:${path}`) {
            throw new TypeError(`catalog.json ${fileField}.id: source:<path>와 같아야 합니다.`);
        }
        if (state.artifactIds.has(id) || state.artifactPaths.has(path)) {
            throw new TypeError(`catalog.json ${fileField}: artifact ID와 path는 catalog 전체에서 한 구현만 소유해야 합니다.`);
        }
        const parsed = {
            id,
            language,
            path,
            sha256: sha256(manifest.sha256, `${fileField}.sha256`),
            byteLength: positiveCount(manifest.byteLength, `${fileField}.byteLength`, maxSourceBytes),
        };
        state.artifactIds.add(id);
        state.artifactPaths.add(path);
        state.sources.push(parsed);
        return parsed;
    });
    return { primaryFile, files };
}
function parseImplementation20(value, language, field, state) {
    const implementation = object(value, field);
    const status = exactText(implementation.status, `${field}.status`);
    if (status === "reserved") {
        exactKeys(implementation, [
            "status",
            "plannedEntryPoint",
            "plannedSourcePath",
            "plannedBasicTestPath",
        ], field);
        const plannedEntryPoint = exactText(implementation.plannedEntryPoint, `${field}.plannedEntryPoint`);
        return {
            language,
            implementationStatus: "R",
            entryPoint: plannedEntryPoint,
            plannedSourcePath: manifestPath20(implementation.plannedSourcePath, language, "main", `${field}.plannedSourcePath`),
            plannedBasicTestPath: manifestPath20(implementation.plannedBasicTestPath, language, "test", `${field}.plannedBasicTestPath`),
            verification: "not-run",
            testSummary: { passed: 0, failed: 0, skipped: 0 },
        };
    }
    if (status !== "operational") {
        throw new TypeError(`catalog.json ${field}.status: operational 또는 reserved여야 합니다.`);
    }
    exactKeys(implementation, ["status", "entryPoint", "source", "basicTest", "verification"], field);
    const sourceGroup = parseFileGroup20(implementation.source, language, "main", `${field}.source`, state);
    const basicTest = implementation.basicTest === null
        ? null
        : parseFileGroup20(implementation.basicTest, language, "test", `${field}.basicTest`, state);
    const verification = object(implementation.verification, `${field}.verification`);
    exactKeys(verification, ["vectors", "basicTest"], `${field}.verification`);
    const vectorVerification = parseVerificationSummary20(verification.vectors, `${field}.verification.vectors`);
    const basicTestVerification = parseVerificationSummary20(verification.basicTest, `${field}.verification.basicTest`);
    if (basicTest === null &&
        (basicTestVerification.status !== "not-run" ||
            basicTestVerification.passed !== 0 ||
            basicTestVerification.failed !== 0 ||
            basicTestVerification.skipped !== 0)) {
        throw new TypeError(`catalog.json ${field}.verification.basicTest: basicTest가 null이면 not-run/0이어야 합니다.`);
    }
    const primarySource = sourceGroup.files.find((source) => source.path === sourceGroup.primaryFile);
    if (!primarySource) {
        // 위 primaryFile membership 검사가 있어 정상 경로에서는 도달하지 않는다. 타입
        // 좁히기를 위해서도 fail-closed를 유지한다.
        throw new TypeError(`catalog.json ${field}.source.primaryFile: primary manifest를 찾을 수 없습니다.`);
    }
    return {
        language,
        implementationStatus: "O",
        entryPoint: exactText(implementation.entryPoint, `${field}.entryPoint`),
        sourceId: primarySource.id,
        sourceGroup,
        basicTest,
        vectorVerification,
        basicTestVerification,
        // 기존 화면/검색 모델은 공식 vector 결과를 verification으로 사용한다. v2의
        // basicTest 결과는 별도 필드로 보존해 두 상태가 섞이지 않게 한다.
        verification: vectorVerification.status,
        testSummary: {
            passed: vectorVerification.passed,
            failed: vectorVerification.failed,
            skipped: vectorVerification.skipped,
        },
    };
}
function parseDocumentation20(value, field) {
    const documentation = object(value, field);
    exactKeys(documentation, ["summary", "whenToUse", "avoidWhen", "tradeoffs", "pitfalls"], field);
    const list = (key) => uniqueStrings(exactTextArray(documentation[key], `${field}.${key}`), `${field}.${key}`);
    return {
        summary: exactText(documentation.summary, `${field}.summary`),
        whenToUse: list("whenToUse"),
        avoidWhen: list("avoidWhen"),
        tradeoffs: list("tradeoffs"),
        pitfalls: list("pitfalls"),
    };
}
function parseRelationships20(value, field) {
    if (value === undefined)
        return undefined;
    const relationshipObject = object(value, field);
    knownKeys(relationshipObject, relationshipFields, field);
    if (!Object.keys(relationshipObject).length) {
        throw new TypeError(`catalog.json ${field}: 관계 키를 하나 이상 선언해야 합니다.`);
    }
    const parsed = {};
    for (const relationship of relationshipFields) {
        if (!Object.hasOwn(relationshipObject, relationship))
            continue;
        const rawTargets = relationshipObject[relationship];
        if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
            throw new TypeError(`catalog.json ${field}.${relationship}: 하나 이상의 algorithmId 배열이어야 합니다.`);
        }
        parsed[relationship] = uniqueStrings(rawTargets.map((target, index) => algorithmIdentifier20(target, `${field}.${relationship}[${index}]`)), `${field}.${relationship}`);
    }
    return parsed;
}
function parseFeedback20(value, field) {
    const feedback = object(value, field);
    const status = exactText(feedback.status, `${field}.status`);
    if (status === "unavailable") {
        exactKeys(feedback, ["status", "evidenceCount"], field);
    }
    else {
        exactKeys(feedback, [
            "status",
            "evidenceCount",
            "candidateCount",
            "approvedCount",
            "rejectedCount",
            "pendingCount",
        ], field);
    }
    return parseFeedback(feedback, field, "2.0");
}
function parseVectors20(value, algorithmId, field, state) {
    const vectorMap = object(value, field);
    return asciiSortedKeys(vectorMap, field).map((rawVectorId) => {
        const vectorId = algorithmIdentifier20(rawVectorId, `${field}.${rawVectorId}`);
        const vectorField = `${field}.${vectorId}`;
        const vector = object(vectorMap[rawVectorId], vectorField);
        exactKeys(vector, ["path", "sha256", "byteLength", "caseCount"], vectorField);
        const path = exactText(vector.path, `${vectorField}.path`);
        if (path !== `test-vectors/valid/${vectorId}.json`) {
            throw new TypeError(`catalog.json ${vectorField}.path: vector key와 일치해야 합니다.`);
        }
        if (state.vectorIds.has(vectorId) || state.vectorPaths.has(path)) {
            throw new TypeError(`catalog.json ${vectorField}: vector ID와 path는 catalog 전체에서 중복될 수 없습니다.`);
        }
        const parsed = {
            id: vectorId,
            algorithmId,
            path,
            sha256: sha256(vector.sha256, `${vectorField}.sha256`),
            byteLength: positiveCount(vector.byteLength, `${vectorField}.byteLength`, maxVectorBytes),
            caseCount: positiveCount(vector.caseCount, `${vectorField}.caseCount`),
        };
        state.vectorIds.add(vectorId);
        state.vectorPaths.add(path);
        state.vectors.push(parsed);
        return vectorId;
    });
}
function parseAlgorithm20(value, algorithmId, field, state) {
    const item = object(value, field);
    exactShape(item, [
        "alternatives",
        "documentation",
        "name",
        "summary",
        "category",
        "family",
        "contract",
        "complexity",
        "preconditions",
        "implementations",
        "vectors",
        "feedback",
    ], ["kind", "relationships"], field);
    if (item.kind !== undefined)
        exactText(item.kind, `${field}.kind`);
    const kind = parseAlgorithmKind(item.kind, `${field}.kind`, "2.0");
    const relationships = parseRelationships20(item.relationships, `${field}.relationships`);
    if (relationships !== undefined && kind === undefined) {
        throw new TypeError(`catalog.json ${field}.relationships: kind가 있는 알고리즘에만 사용할 수 있습니다.`);
    }
    // 2.0에서는 두 metadata 필드가 "선택 키"가 아니라 빈 값도 명시해서 발행하는
    // 필수 키다. exactShape의 소유 키 검사에만 기대지 않고 값 타입도 바로 읽어,
    // JS 호출자가 `undefined`를 넣는 경우까지 JSON Schema와 동일하게 거절한다.
    const alternatives = uniqueStrings(exactTextArray(item.alternatives, `${field}.alternatives`).map((target, index) => algorithmIdentifier20(target, `${field}.alternatives[${index}]`)), `${field}.alternatives`);
    if (alternatives.includes(algorithmId)) {
        throw new TypeError(`catalog.json ${field}.alternatives: 자기 자신을 참조할 수 없습니다.`);
    }
    const category = exactText(item.category, `${field}.category`);
    if (!catalogCategories20.includes(category)) {
        throw new TypeError(`catalog.json ${field}.category: 정본 category enum이어야 합니다.`);
    }
    const contract = object(item.contract, `${field}.contract`);
    // schema 2.0 contract는 공개 metadata 확장 객체다. consumer가 현재 아는 키로
    // exact-shape를 재정의하지 않고 producer가 검증한 객체를 그대로 모델에 보존한다.
    const parsedContract = contract;
    const complexity = object(item.complexity, `${field}.complexity`);
    exactKeys(complexity, ["time", "space"], `${field}.complexity`);
    if (!Array.isArray(item.preconditions)) {
        throw new TypeError(`catalog.json ${field}.preconditions: 배열이어야 합니다.`);
    }
    const implementations = object(item.implementations, `${field}.implementations`);
    exactKeys(implementations, languages, `${field}.implementations`);
    const parsedLanguages = languages.map((language) => parseImplementation20(implementations[language], language, `${field}.implementations.${language}`, state));
    const vectorIds = parseVectors20(item.vectors, algorithmId, `${field}.vectors`, state);
    const manifestVectors = state.vectors.filter((vector) => vector.algorithmId === algorithmId);
    const verifiedLanguages = parsedLanguages.filter((language) => language.implementationStatus === "O" &&
        language.vectorVerification?.status === "passing").length;
    const missingBasicTests = parsedLanguages.filter((language) => language.implementationStatus === "O" && language.basicTest === null).length;
    const releaseReadyLanguages = parsedLanguages.filter((language) => language.implementationStatus === "O" &&
        language.basicTest !== null &&
        language.vectorVerification?.status === "passing" &&
        language.vectorVerification.failed === 0 &&
        language.vectorVerification.skipped === 0 &&
        language.basicTestVerification?.status === "passing" &&
        language.basicTestVerification.failed === 0 &&
        language.basicTestVerification.skipped === 0).length;
    return {
        id: algorithmId,
        ...(kind === undefined ? {} : { kind }),
        ...(relationships === undefined ? {} : { relationships }),
        alternatives,
        name: exactText(item.name, `${field}.name`),
        summary: exactText(item.summary, `${field}.summary`),
        documentation: parseDocumentation20(item.documentation, `${field}.documentation`),
        category,
        family: exactText(item.family, `${field}.family`),
        contract: parsedContract,
        complexity: {
            time: exactText(complexity.time, `${field}.complexity.time`),
            space: exactText(complexity.space, `${field}.complexity.space`),
        },
        preconditions: item.preconditions.map((condition, index) => exactText(condition, `${field}.preconditions[${index}]`)),
        languages: parsedLanguages,
        testVectors: [],
        vectorIds,
        coverage: {
            vectorCount: vectorIds.length,
            caseCount: manifestVectors.reduce((total, vector) => total + vector.caseCount, 0),
            verifiedLanguages,
            missingBasicTests,
            releaseReadyLanguages,
        },
        feedback: parseFeedback20(item.feedback, `${field}.feedback`),
    };
}
function parseCatalog20(root) {
    exactKeys(root, ["schemaVersion", "algorithms"], "$");
    if (root.schemaVersion !== "2.0") {
        throw new TypeError('catalog.json $.schemaVersion: "2.0"이어야 합니다.');
    }
    const algorithmMap = object(root.algorithms, "$.algorithms");
    const algorithmIds = asciiSortedKeys(algorithmMap, "$.algorithms").map((id) => algorithmIdentifier20(id, `$.algorithms.${id}`));
    if (!algorithmIds.length) {
        throw new TypeError("catalog.json $.algorithms: 하나 이상의 알고리즘이 필요합니다.");
    }
    const state = {
        artifactIds: new Set(),
        artifactPaths: new Set(),
        vectorIds: new Set(),
        vectorPaths: new Set(),
        sources: [],
        vectors: [],
    };
    const algorithms = algorithmIds.map((algorithmId) => parseAlgorithm20(algorithmMap[algorithmId], algorithmId, `$.algorithms.${algorithmId}`, state));
    const algorithmIdSet = new Set(algorithmIds);
    for (const algorithm of algorithms) {
        for (const targetId of algorithm.alternatives ?? []) {
            if (!algorithmIdSet.has(targetId)) {
                throw new TypeError(`catalog.json ${algorithm.id}.alternatives: 존재하지 않는 algorithmId '${targetId}'을 참조합니다.`);
            }
        }
        for (const relationship of relationshipFields) {
            for (const targetId of algorithm.relationships?.[relationship] ?? []) {
                if (targetId === algorithm.id) {
                    throw new TypeError(`catalog.json ${algorithm.id}.relationships.${relationship}: 자기 자신을 참조할 수 없습니다.`);
                }
                if (!algorithmIdSet.has(targetId)) {
                    throw new TypeError(`catalog.json ${algorithm.id}.relationships.${relationship}: 존재하지 않는 algorithmId '${targetId}'을 참조합니다.`);
                }
            }
        }
    }
    validateRelationships(algorithms);
    const languageImplementations = {
        R: 0,
        I: 0,
        O: 0,
        E: 0,
    };
    let verifiedLanguages = 0;
    let missingBasicTests = 0;
    let releaseReadyLanguages = 0;
    for (const algorithm of algorithms) {
        verifiedLanguages += algorithm.coverage.verifiedLanguages;
        missingBasicTests += algorithm.coverage.missingBasicTests ?? 0;
        releaseReadyLanguages += algorithm.coverage.releaseReadyLanguages ?? 0;
        for (const language of algorithm.languages) {
            languageImplementations[language.implementationStatus] += 1;
        }
    }
    const vectorCount = state.vectors.length;
    const caseCount = state.vectors.reduce((total, vector) => total + vector.caseCount, 0);
    return {
        schemaVersion: "2.0",
        sources: state.sources,
        vectors: state.vectors,
        algorithms,
        coverage: {
            algorithmCount: algorithms.length,
            vectorCount,
            caseCount,
            languageImplementations,
            verifiedLanguages,
            implementationStates: {
                reserved: languageImplementations.R,
                operational: languageImplementations.O,
            },
            missingBasicTests,
            releaseReadyLanguages,
        },
    };
}
function assertEqualCount(actual, expected, field) {
    if (actual !== expected) {
        throw new TypeError(`catalog.json ${field}: 선언값 ${actual}과 계산값 ${expected}이 일치하지 않습니다.`);
    }
}
/**
 * metadata 관계는 단순 문자열 목록이 아니라 catalog 전체 그래프 계약이다.
 * 같은 문제의 다른 방법은 양쪽 선언이 맞아야 하고, 계보·특수화·합성 관계는
 * 순환하면 의미가 뒤집히므로 catalog-core와 같은 결정적 DFS로 차단한다.
 */
function validateRelationships(algorithms) {
    const algorithmsById = new Map(algorithms.map((algorithm) => [algorithm.id, algorithm]));
    for (const algorithm of algorithms) {
        for (const targetId of algorithm.relationships?.sameProblemDifferentMethod ?? []) {
            const target = algorithmsById.get(targetId);
            if (!target?.relationships?.sameProblemDifferentMethod?.includes(algorithm.id)) {
                throw new TypeError(`catalog.json ${algorithm.id}.relationships.sameProblemDifferentMethod: '${targetId}'와의 관계는 양방향이어야 합니다.`);
            }
        }
    }
    for (const relationship of acyclicRelationshipFields) {
        const state = new Map();
        const stack = [];
        const visit = (id) => {
            const currentState = state.get(id) ?? 0;
            if (currentState === 2)
                return;
            if (currentState === 1) {
                const cycleStart = stack.indexOf(id);
                const cycle = [...stack.slice(cycleStart), id];
                throw new TypeError(`catalog.json algorithms: ${relationship} 관계는 순환할 수 없습니다: ${cycle.join(" -> ")}.`);
            }
            state.set(id, 1);
            stack.push(id);
            for (const targetId of algorithmsById.get(id)?.relationships?.[relationship] ?? []) {
                visit(targetId);
            }
            stack.pop();
            state.set(id, 2);
        };
        for (const id of [...algorithmsById.keys()].sort((left, right) => left.localeCompare(right, "en"))) {
            visit(id);
        }
    }
}
function validateCoverage(algorithms, coverage, vectors = []) {
    const vectorsById = new Map(vectors.map((vector) => [vector.id, vector]));
    const languageImplementations = {
        R: 0,
        I: 0,
        O: 0,
        E: 0,
    };
    let vectorCount = 0;
    let caseCount = 0;
    let verifiedLanguages = 0;
    for (const algorithm of algorithms) {
        const manifestVectors = (algorithm.vectorIds ?? []).map((id) => {
            const vector = vectorsById.get(id);
            if (!vector) {
                throw new TypeError(`catalog.json ${algorithm.id}.vectorIds: 존재하지 않는 vector '${id}'를 참조합니다.`);
            }
            return vector;
        });
        const algorithmVectorCount = algorithm.vectorIds
            ? manifestVectors.length
            : algorithm.testVectors.length;
        const algorithmCaseCount = algorithm.vectorIds
            ? manifestVectors.reduce((total, vector) => total + vector.caseCount, 0)
            : algorithm.testVectors.reduce((total, vector) => total + vector.cases.length, 0);
        const algorithmVerifiedLanguages = algorithm.languages.filter((language) => language.verification === "passing").length;
        assertEqualCount(algorithm.coverage.vectorCount, algorithmVectorCount, `${algorithm.id}.coverage.vectorCount`);
        assertEqualCount(algorithm.coverage.caseCount, algorithmCaseCount, `${algorithm.id}.coverage.caseCount`);
        assertEqualCount(algorithm.coverage.verifiedLanguages, algorithmVerifiedLanguages, `${algorithm.id}.coverage.verifiedLanguages`);
        vectorCount += algorithmVectorCount;
        caseCount += algorithmCaseCount;
        verifiedLanguages += algorithmVerifiedLanguages;
        for (const language of algorithm.languages) {
            languageImplementations[language.implementationStatus] += 1;
        }
    }
    assertEqualCount(coverage.algorithmCount, algorithms.length, "coverage.algorithmCount");
    assertEqualCount(coverage.vectorCount, vectorCount, "coverage.vectorCount");
    assertEqualCount(coverage.caseCount, caseCount, "coverage.caseCount");
    assertEqualCount(coverage.verifiedLanguages, verifiedLanguages, "coverage.verifiedLanguages");
    for (const status of statuses) {
        assertEqualCount(coverage.languageImplementations[status], languageImplementations[status], `coverage.languageImplementations.${status}`);
    }
}
/** 외부 JSON을 이 경계에서만 좁혀 UI가 불완전한 계약을 부분 렌더링하지 않게 한다. */
export function parseCatalog(value) {
    const root = object(value, "$");
    const schemaVersion = root.schemaVersion;
    // 2.0은 algorithms map 자체가 source/vector/coverage의 정본이다. 배열 기반
    // 레거시 분기로 들어가 root.coverage를 먼저 읽으면 정상 v2도 실패하므로 가장
    // 앞에서 독립된 strict parser로 보낸다.
    if (schemaVersion === "2.0")
        return parseCatalog20(root);
    const coverageValue = object(root.coverage, "coverage");
    if (!catalogSchemaVersions.includes(schemaVersion) ||
        !Array.isArray(root.algorithms)) {
        throw new TypeError("catalog.json은 공개된 1.0, 1.1, 1.2 또는 2.0 계약을 만족해야 합니다.");
    }
    const parsedSchemaVersion = schemaVersion;
    if (parsedSchemaVersion === "1.2") {
        // API base 같은 배포 설정이나 본문 필드가 root에 스며드는 것도 차단한다.
        exactKeys(root, ["schemaVersion", "sources", "vectors", "algorithms", "coverage"], "$");
    }
    if (parsedSchemaVersion === "1.0" && root.sources !== undefined) {
        throw new TypeError("catalog.json sources: sources는 1.1/1.2 계약에서만 사용할 수 있습니다.");
    }
    if (parsedSchemaVersion === "1.2" && root.sources === undefined) {
        throw new TypeError("catalog.json sources: 1.2 계약에서는 source manifest 배열이 필요합니다.");
    }
    if (parsedSchemaVersion === "1.2" && !Array.isArray(root.vectors)) {
        throw new TypeError("catalog.json vectors: 1.2 계약에서는 vector manifest 배열이 필요합니다.");
    }
    if (parsedSchemaVersion !== "1.2" && root.vectors !== undefined) {
        throw new TypeError("catalog.json vectors: vectors는 1.2 계약에서만 사용할 수 있습니다.");
    }
    if (root.sources !== undefined && !Array.isArray(root.sources)) {
        throw new TypeError("catalog.json sources: 배열이어야 합니다.");
    }
    const sources = root.sources === undefined
        ? undefined
        : root.sources.map((source, index) => parseSource(source, index, parsedSchemaVersion));
    const vectors = Array.isArray(root.vectors)
        ? root.vectors.map(parseVectorManifest)
        : undefined;
    if (sources) {
        uniqueStrings(sources.map((source) => source.id), "sources[].id");
        uniqueStrings(sources.map((source) => source.path), "sources[].path");
    }
    if (vectors) {
        uniqueStrings(vectors.map((vector) => vector.id), "vectors[].id");
        uniqueStrings(vectors.map((vector) => vector.path), "vectors[].path");
        for (let index = 1; index < vectors.length; index += 1) {
            const previous = vectors[index - 1];
            const current = vectors[index];
            if (previous === undefined ||
                current === undefined ||
                previous.path.localeCompare(current.path, "en") >= 0) {
                throw new TypeError("catalog.json vectors: path 기준 중복 없는 오름차순이어야 합니다.");
            }
        }
    }
    const languageImplementationsValue = object(coverageValue.languageImplementations, "coverage.languageImplementations");
    const languageImplementations = Object.fromEntries(statuses.map((status) => [
        status,
        count(languageImplementationsValue[status], `coverage.languageImplementations.${status}`),
    ]));
    const algorithms = root.algorithms.map((algorithm, index) => parseAlgorithm(algorithm, index, parsedSchemaVersion));
    uniqueStrings(algorithms.map((algorithm) => algorithm.id), "algorithms[].id");
    const algorithmIds = new Set(algorithms.map((algorithm) => algorithm.id));
    const sourcesById = new Map((sources ?? []).map((source) => [source.id, source]));
    const vectorsById = new Map((vectors ?? []).map((vector) => [vector.id, vector]));
    const referencedSourceIds = new Set();
    const referencedVectorIds = new Set();
    for (const algorithm of algorithms) {
        for (const alternativeId of algorithm.alternatives ?? []) {
            if (alternativeId === algorithm.id) {
                throw new TypeError(`catalog.json ${algorithm.id}.alternatives: 자기 자신을 대안으로 참조할 수 없습니다.`);
            }
            if (!algorithmIds.has(alternativeId)) {
                throw new TypeError(`catalog.json ${algorithm.id}.alternatives: 존재하지 않는 대안 algorithmId '${alternativeId}'을 참조합니다.`);
            }
        }
        for (const relationship of relationshipFields) {
            for (const relatedId of algorithm.relationships?.[relationship] ?? []) {
                if (relatedId === algorithm.id) {
                    throw new TypeError(`catalog.json ${algorithm.id}.relationships.${relationship}: 자기 자신을 참조할 수 없습니다.`);
                }
                if (!algorithmIds.has(relatedId)) {
                    throw new TypeError(`catalog.json ${algorithm.id}.relationships.${relationship}: 존재하지 않는 algorithmId '${relatedId}'을 참조합니다.`);
                }
            }
        }
        for (const language of algorithm.languages) {
            if (!language.sourceId)
                continue;
            const source = sourcesById.get(language.sourceId);
            if (!source) {
                throw new TypeError(`catalog.json ${algorithm.id}/${language.language}.sourceId: 존재하지 않는 source를 참조합니다.`);
            }
            if (source.language !== language.language) {
                throw new TypeError(`catalog.json ${algorithm.id}/${language.language}.sourceId: source 언어와 구현 언어가 일치하지 않습니다.`);
            }
            referencedSourceIds.add(language.sourceId);
        }
        for (const vectorId of algorithm.vectorIds ?? []) {
            const vector = vectorsById.get(vectorId);
            if (!vector) {
                throw new TypeError(`catalog.json ${algorithm.id}.vectorIds: 존재하지 않는 vector '${vectorId}'를 참조합니다.`);
            }
            if (vector.algorithmId !== algorithm.id) {
                throw new TypeError(`catalog.json ${algorithm.id}.vectorIds: vector algorithmId가 참조 알고리즘과 일치하지 않습니다.`);
            }
            referencedVectorIds.add(vectorId);
        }
    }
    if (parsedSchemaVersion === "1.2" && sources) {
        const unreferenced = sources
            .filter((source) => !referencedSourceIds.has(source.id))
            .map((source) => source.id);
        if (unreferenced.length) {
            throw new TypeError(`catalog.json sources: 어떤 언어에서도 참조하지 않는 source가 있습니다: ${unreferenced.join(", ")}.`);
        }
    }
    if (vectors && referencedVectorIds.size !== vectors.length) {
        const unreferenced = vectors
            .filter((vector) => !referencedVectorIds.has(vector.id))
            .map((vector) => vector.id);
        throw new TypeError(`catalog.json vectors: 알고리즘이 참조하지 않는 vector가 있습니다: ${unreferenced.join(", ")}.`);
    }
    const coverage = {
        algorithmCount: count(coverageValue.algorithmCount, "coverage.algorithmCount"),
        vectorCount: count(coverageValue.vectorCount, "coverage.vectorCount"),
        caseCount: count(coverageValue.caseCount, "coverage.caseCount"),
        languageImplementations,
        verifiedLanguages: count(coverageValue.verifiedLanguages, "coverage.verifiedLanguages"),
    };
    validateRelationships(algorithms);
    validateCoverage(algorithms, coverage, vectors);
    return {
        schemaVersion: parsedSchemaVersion,
        ...(sources === undefined ? {} : { sources }),
        ...(vectors === undefined ? {} : { vectors }),
        algorithms,
        coverage,
    };
}
const catalogIndexTotalsFields = [
    "algorithmCount",
    "sourceCount",
    "vectorCount",
    "caseCount",
    "implementationCount",
    "operationalImplementations",
    "reservedImplementations",
    "verifiedImplementations",
    "missingBasicTestImplementations",
    "basicTestPassingImplementations",
    "releaseReadyImplementations",
    "failedChecks",
    "skippedChecks",
];
/**
 * 뒤늦게 합류한 집계라 옛 인덱스에는 없다. 필수로 올리면 그런 배포 하나가 첫
 * 요청부터 화면 전체를 세우므로, 미지 키는 계속 막으면서 이 키만 없어도 통과시킨다.
 */
const catalogIndexOptionalTotalsFields = ["passedChecks"];
const catalogCoverageFields = [
    "vectorCount",
    "caseCount",
    "verifiedLanguages",
    "missingBasicTests",
    "releaseReadyLanguages",
];
const emptyDocumentationLists = {
    whenToUse: [],
    avoidWhen: [],
    tradeoffs: [],
    pitfalls: [],
};
const coverageStringPattern = /^(?:0|[1-9][0-9]*)(?:,(?:0|[1-9][0-9]*)){4}$/u;
function assetManifest(value, field, expectedPath) {
    const manifest = object(value, field);
    exactKeys(manifest, ["path", "sha256", "byteLength"], field);
    const manifestPath = exactText(manifest.path, `${field}.path`);
    // 경로는 배포 루트 기준 상대 POSIX 경로다. 절대 URL·상위 탈출·역슬래시는 정적
    // 파일 요청을 다른 origin이나 배포 밖으로 끌고 갈 수 있어 여기서 끊는다.
    if (manifestPath.includes("\\") ||
        manifestPath.startsWith("/") ||
        /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(manifestPath) ||
        !/^[A-Za-z0-9_./-]+$/u.test(manifestPath) ||
        manifestPath
            .split("/")
            .some((segment) => !segment || segment === "." || segment === "..")) {
        throw new TypeError(`catalog.json ${field}.path: 정규화된 상대 경로여야 합니다.`);
    }
    if (expectedPath !== undefined && manifestPath !== expectedPath) {
        throw new TypeError(`catalog.json ${field}.path: '${expectedPath}'이어야 합니다.`);
    }
    return {
        path: manifestPath,
        sha256: sha256(manifest.sha256, `${field}.sha256`),
        byteLength: positiveCount(manifest.byteLength, `${field}.byteLength`),
    };
}
function parseIndexTotals(value, field) {
    const totals = object(value, field);
    exactShape(totals, catalogIndexTotalsFields, catalogIndexOptionalTotalsFields, field);
    return Object.fromEntries([
        ...catalogIndexTotalsFields.map((key) => [
            key,
            count(totals[key], `${field}.${key}`),
        ]),
        // 값이 실려 있으면 형태는 필수 집계와 똑같이 따진다. 옵셔널인 것은 존재뿐이다.
        ...catalogIndexOptionalTotalsFields
            .filter((key) => Object.hasOwn(totals, key))
            .map((key) => [key, count(totals[key], `${field}.${key}`)]),
    ]);
}
/**
 * 자리 문자열을 coverageFields 순서의 수치로 되돌린다. 생성기가 항목마다 다섯 수치를
 * 객체로 펼치는 대신 위치 문자열로 접은 것을 여기서 푼다.
 */
function parseEntryCoverage(value, field) {
    if (typeof value !== "string" || !coverageStringPattern.test(value)) {
        throw new TypeError(`catalog.json ${field}: coverageFields 순서에 대응하는 ${catalogCoverageFields.length}개 십진 정수 목록이어야 합니다.`);
    }
    const parts = value.split(",").map((part) => Number(part));
    return Object.fromEntries(catalogCoverageFields.map((key, index) => [key, parts[index]]));
}
function parseIndexEntry(value, algorithmId, field) {
    const entry = object(value, field);
    exactKeys(entry, [
        "name",
        "summary",
        "description",
        "category",
        "family",
        "implementationStatus",
        "coverage",
        "feedback",
        "detail",
    ], field);
    const category = exactText(entry.category, `${field}.category`);
    if (!catalogCategories20.includes(category)) {
        throw new TypeError(`catalog.json ${field}.category: 정본 category enum이어야 합니다.`);
    }
    const status = entry.implementationStatus;
    if (typeof status !== "string" ||
        status.length !== languages.length ||
        !/^[OR]+$/u.test(status)) {
        throw new TypeError(`catalog.json ${field}.implementationStatus: languages 순서에 대응하는 ${languages.length}자리 O/R 문자열이어야 합니다.`);
    }
    return {
        id: algorithmId,
        name: exactText(entry.name, `${field}.name`),
        summary: exactText(entry.summary, `${field}.summary`),
        // 2.0 documentation.summary가 목록 표시용으로 인덱스에 올라온 필드다.
        documentation: {
            summary: exactText(entry.description, `${field}.description`),
            ...emptyDocumentationLists,
        },
        category,
        family: exactText(entry.family, `${field}.family`),
        languages: languages.map((language, index) => ({
            language,
            implementationStatus: status[index] === "O" ? "O" : "R",
        })),
        coverage: parseEntryCoverage(entry.coverage, `${field}.coverage`),
        feedback: parseFeedback20(entry.feedback, `${field}.feedback`),
        searchTextLoaded: false,
        detail: assetManifest(entry.detail, `${field}.detail`, `algorithms/${algorithmId}.json`),
    };
}
/** 목록 인덱스를 읽는다. 상세를 한 장도 받지 않은 상태에서 목록 화면 전체가 나온다. */
export function parseCatalogIndex(value) {
    const root = object(value, "$");
    exactKeys(root, ["schemaVersion", "languages", "coverageFields", "totals", "search", "algorithms"], "$");
    if (root.schemaVersion !== "2.1") {
        throw new TypeError('catalog.json $.schemaVersion: "2.1"이어야 합니다.');
    }
    // 언어·커버리지 자리 순서는 문서가 스스로 선언한다. 소비자가 기대하는 순서와
    // 다르면 상태 문자열을 잘못 풀게 되므로 fail-closed로 막는다.
    const declaredLanguages = stringArray(root.languages, "$.languages");
    if (declaredLanguages.length !== languages.length ||
        declaredLanguages.some((language, index) => language !== languages[index])) {
        throw new TypeError(`catalog.json $.languages: 고정 공개 언어 순서 ${languages.join(", ")}와 정확히 같아야 합니다.`);
    }
    const declaredCoverageFields = stringArray(root.coverageFields, "$.coverageFields");
    if (declaredCoverageFields.length !== catalogCoverageFields.length ||
        declaredCoverageFields.some((name, index) => name !== catalogCoverageFields[index])) {
        throw new TypeError(`catalog.json $.coverageFields: 고정 커버리지 자리 순서 ${catalogCoverageFields.join(", ")}와 정확히 같아야 합니다.`);
    }
    const algorithmMap = object(root.algorithms, "$.algorithms");
    const algorithmIds = asciiSortedKeys(algorithmMap, "$.algorithms").map((id) => algorithmIdentifier20(id, `$.algorithms.${id}`));
    if (!algorithmIds.length) {
        throw new TypeError("catalog.json $.algorithms: 하나 이상의 알고리즘이 필요합니다.");
    }
    const algorithms = algorithmIds.map((algorithmId) => parseIndexEntry(algorithmMap[algorithmId], algorithmId, `$.algorithms.${algorithmId}`));
    const totals = parseIndexTotals(root.totals, "$.totals");
    if (totals.algorithmCount !== algorithms.length) {
        throw new TypeError(`catalog.json $.totals.algorithmCount: 인덱스 항목 수 ${algorithms.length}와 일치해야 합니다.`);
    }
    return {
        schemaVersion: "2.1",
        languages: [...languages],
        coverageFields: [...catalogCoverageFields],
        totals,
        search: assetManifest(root.search, "$.search", "catalog-search.json"),
        algorithms,
    };
}
/**
 * 검색 보조를 인덱스에 합쳐 documentation 네 목록을 채운다. 검색 대상이 늘어나는
 * 것뿐이라 화면 모델은 그대로이고, 검색 함수도 인덱스와 2.0을 구분하지 않는다.
 */
export function applyCatalogSearch(index, value) {
    const root = object(value, "$");
    exactKeys(root, ["schemaVersion", "algorithms"], "$");
    if (root.schemaVersion !== "2.1") {
        throw new TypeError('catalog.json $.schemaVersion: "2.1"이어야 합니다.');
    }
    const algorithmMap = object(root.algorithms, "$.algorithms");
    const entryIds = new Set(index.algorithms.map((entry) => entry.id));
    const searchIds = asciiSortedKeys(algorithmMap, "$.algorithms");
    const orphans = searchIds.filter((id) => !entryIds.has(id));
    if (orphans.length) {
        throw new TypeError(`catalog.json $.algorithms: 인덱스에 없는 검색 본문이 있습니다: ${orphans.join(", ")}.`);
    }
    const algorithms = index.algorithms.map((entry) => {
        const field = `$.algorithms.${entry.id}`;
        const documentation = object(algorithmMap[entry.id], field);
        exactKeys(documentation, ["whenToUse", "avoidWhen", "tradeoffs", "pitfalls"], field);
        const list = (key) => uniqueStrings(exactTextArray(documentation[key], `${field}.${key}`), `${field}.${key}`);
        return {
            ...entry,
            documentation: {
                summary: entry.documentation.summary,
                whenToUse: list("whenToUse"),
                avoidWhen: list("avoidWhen"),
                tradeoffs: list("tradeoffs"),
                pitfalls: list("pitfalls"),
            },
            searchTextLoaded: true,
        };
    });
    return { ...index, algorithms };
}
/**
 * 상세 한 장을 읽어 인덱스 항목과 합친다. 합친 결과는 그 알고리즘의 2.0 항목과
 * 정확히 같으므로 기존 2.0 파서를 그대로 통과시키고, 인덱스가 이미 발표한 상태·
 * 커버리지와 어긋나면 거절한다 — 두 층이 서로 다른 사실을 말하면 안 된다.
 */
export function parseCatalogDetail(value, entry, index) {
    const detail = object(value, "$");
    exactShape(detail, [
        "schemaVersion",
        "id",
        "alternatives",
        "documentation",
        "contract",
        "complexity",
        "preconditions",
        "implementations",
        "vectors",
        "assets",
    ], ["kind", "relationships"], "$");
    if (detail.schemaVersion !== "2.1") {
        throw new TypeError('catalog.json $.schemaVersion: "2.1"이어야 합니다.');
    }
    if (algorithmIdentifier20(detail.id, "$.id") !== entry.id) {
        throw new TypeError(`catalog.json $.id: 인덱스가 가리킨 '${entry.id}'와 같아야 합니다.`);
    }
    const documentation = object(detail.documentation, "$.documentation");
    exactKeys(documentation, ["whenToUse", "avoidWhen", "tradeoffs", "pitfalls"], "$.documentation");
    // 자산은 본문 대신 manifest만 든다. 경로는 계약이 아니라 manifest가 정하므로
    // 여기서 조립하지 않고 발표된 값을 그대로 넘긴다(빈 map은 자산 없음이다).
    const assetsValue = object(detail.assets, "$.assets");
    const assets = {};
    for (const name of asciiSortedKeys(assetsValue, "$.assets")) {
        const assetName = kebabIdentifier(name, `$.assets.${name}`);
        assets[assetName] = assetManifest(assetsValue[name], `$.assets.${assetName}`);
    }
    const state = {
        artifactIds: new Set(),
        artifactPaths: new Set(),
        vectorIds: new Set(),
        vectorPaths: new Set(),
        sources: [],
        vectors: [],
    };
    const merged = {
        ...(detail.kind === undefined ? {} : { kind: detail.kind }),
        ...(detail.relationships === undefined
            ? {}
            : { relationships: detail.relationships }),
        alternatives: detail.alternatives,
        documentation: { summary: entry.documentation.summary, ...documentation },
        name: entry.name,
        summary: entry.summary,
        category: entry.category,
        family: entry.family,
        contract: detail.contract,
        complexity: detail.complexity,
        preconditions: detail.preconditions,
        implementations: detail.implementations,
        vectors: detail.vectors,
        feedback: feedbackRecord(entry.feedback),
    };
    const algorithm = parseAlgorithm20(merged, entry.id, `$.algorithms.${entry.id}`, state);
    // 대안·관계 대상은 상세 한 장 안에서는 확인할 수 없다. 인덱스가 아는 전체 id
    // 집합으로 대조해, 없는 종을 가리키는 링크가 화면에 서지 않게 한다.
    const knownIds = new Set(index.algorithms.map((item) => item.id));
    for (const targetId of algorithm.alternatives ?? []) {
        if (!knownIds.has(targetId)) {
            throw new TypeError(`catalog.json ${entry.id}.alternatives: 존재하지 않는 algorithmId '${targetId}'을 참조합니다.`);
        }
    }
    for (const relationship of relationshipFields) {
        for (const targetId of algorithm.relationships?.[relationship] ?? []) {
            if (!knownIds.has(targetId)) {
                throw new TypeError(`catalog.json ${entry.id}.relationships.${relationship}: 존재하지 않는 algorithmId '${targetId}'을 참조합니다.`);
            }
        }
    }
    for (const key of catalogCoverageFields) {
        const declared = entry.coverage[key];
        const derived = algorithm.coverage[key] ?? 0;
        if (declared !== derived) {
            throw new TypeError(`catalog.json $.algorithms.${entry.id}.coverage.${key}: 인덱스 선언값 ${declared}과 상세 계산값 ${derived}이 일치하지 않습니다.`);
        }
    }
    algorithm.languages.forEach((language, position) => {
        const declared = entry.languages[position]?.implementationStatus;
        if (declared !== language.implementationStatus) {
            throw new TypeError(`catalog.json $.algorithms.${entry.id}.implementationStatus: '${language.language}' 상태가 상세와 일치하지 않습니다.`);
        }
    });
    return {
        algorithm,
        assets,
        // 화면이 읽는 것은 이 한 종뿐이라 coverage 합계도 그 한 종의 값이다. 아카이브
        // 전체 지표는 인덱스 totals가 따로 든다.
        document: {
            schemaVersion: "2.0",
            sources: state.sources,
            vectors: state.vectors,
            algorithms: [algorithm],
            coverage: {
                algorithmCount: 1,
                vectorCount: algorithm.coverage.vectorCount,
                caseCount: algorithm.coverage.caseCount,
                languageImplementations: algorithm.languages.reduce((tally, language) => ({
                    ...tally,
                    [language.implementationStatus]: tally[language.implementationStatus] + 1,
                }), { R: 0, I: 0, O: 0, E: 0 }),
                verifiedLanguages: algorithm.coverage.verifiedLanguages,
                missingBasicTests: algorithm.coverage.missingBasicTests ?? 0,
                releaseReadyLanguages: algorithm.coverage.releaseReadyLanguages ?? 0,
            },
        },
    };
}
/** 인덱스 totals를 상단 릴리스 지표 형태로 옮긴다. 계산은 생성기가 이미 끝냈다. */
export function summarizeIndexReadiness(index) {
    return {
        algorithmCount: index.totals.algorithmCount,
        sourceCount: index.totals.sourceCount,
        caseCount: index.totals.caseCount,
        implementationCount: index.totals.implementationCount,
        basicTestPassingImplementations: index.totals.basicTestPassingImplementations,
        releaseReadyImplementations: index.totals.releaseReadyImplementations,
        // 옛 인덱스에는 없는 집계다. 키 자체를 만들지 않아 화면이 "모른다"와 "0건"을 구분한다.
        ...(index.totals.passedChecks === undefined
            ? {}
            : { passedChecks: index.totals.passedChecks }),
        failedChecks: index.totals.failedChecks,
        skippedChecks: index.totals.skippedChecks,
    };
}
/** 인덱스가 든 피드백 집계를 2.0 파서가 읽는 raw 객체로 되돌린다. */
function feedbackRecord(feedback) {
    if (feedback.status === "unavailable") {
        return { status: "unavailable", evidenceCount: feedback.evidenceCount };
    }
    return {
        status: feedback.status,
        evidenceCount: feedback.evidenceCount,
        candidateCount: feedback.candidateCount,
        approvedCount: feedback.approvedCount,
        rejectedCount: feedback.rejectedCount,
        pendingCount: feedback.pendingCount,
    };
}
/** 검증된 ID를 상세 화면 모델로 바꾸며, catalog 밖 대상을 렌더링하지 못하게 한다. */
export function resolveAlternativeAlgorithms(algorithm, algorithms) {
    if (!algorithm.alternatives?.length)
        return [];
    const byId = new Map(algorithms.map((item) => [item.id, item]));
    return algorithm.alternatives.map((alternativeId) => {
        const alternative = byId.get(alternativeId);
        if (!alternative) {
            throw new TypeError(`catalog.json ${algorithm.id}.alternatives: 대안 algorithmId '${alternativeId}'을 찾을 수 없습니다.`);
        }
        return alternative;
    });
}
export function sourceForLanguage(catalog, language) {
    if (language.sourceGroup) {
        return language.sourceGroup.files.find((source) => source.path === language.sourceGroup?.primaryFile);
    }
    if (!language.sourceId)
        return undefined;
    return catalog.sources?.find((source) => source.id === language.sourceId);
}
/**
 * 2.0의 primary+companion file group과 1.1/1.2의 단일 source를 같은 UI 경계로
 * 올린다. 레거시는 한 파일짜리 group으로만 감싸며 본문/manifest 값은 복제하거나
 * 바꾸지 않는다.
 */
export function sourceGroupForLanguage(catalog, language) {
    if (language.sourceGroup)
        return language.sourceGroup;
    const source = sourceForLanguage(catalog, language);
    return source ? { primaryFile: source.path, files: [source] } : undefined;
}
/** 1.2 알고리즘이 참조한 순서를 보존해 해당 원격 vector manifest를 돌려준다. */
export function vectorsForAlgorithm(catalog, algorithm) {
    if (!algorithm.vectorIds)
        return [];
    const byId = new Map((catalog.vectors ?? []).map((vector) => [vector.id, vector]));
    return algorithm.vectorIds.map((id) => {
        const vector = byId.get(id);
        if (!vector) {
            throw new TypeError(`catalog.json ${algorithm.id}.vectorIds: vector '${id}'를 찾을 수 없습니다.`);
        }
        return vector;
    });
}
/** 1.1 embedded 원문과 1.2 원격 manifest를 속성 존재로 안전하게 구분한다. */
export function isEmbeddedCatalogSource(source) {
    return typeof source.content === "string";
}
/** parser를 통과한 1.2 source만 원격 정본 로더로 보낸다. */
export function isRemoteCatalogSource(source) {
    return (typeof source.sha256 === "string" &&
        typeof source.byteLength === "number" &&
        source.content === undefined);
}
/**
 * 한 소스를 여러 알고리즘이 함께 참조하면 그 파일은 알고리즘 하나의 자립 소스가
 * 아니라 러너·번들 통짜다. 검증은 통과했어도 열람해서 가져갈 단위가 없으므로,
 * 렌더 지점이 이 판정으로 소스 노출을 가른다. 판정 근거는 sourceId 공유 여부
 * 하나뿐이라, 자립 파일 분리가 끝나 1:1이 되면 표시도 저절로 되돌아온다.
 *
 * 카탈로그 문서마다 한 번만 세고 재사용한다. 커버리지 표는 언어 쌍마다 이
 * 판정을 부르는데, 매번 다시 세면 전수 순회가 그 횟수만큼 반복된다.
 */
const bundledSourceIdCache = new WeakMap();
export function bundledSourceIds(catalog) {
    const cached = bundledSourceIdCache.get(catalog);
    if (cached)
        return cached;
    const referrers = new Map();
    for (const algorithm of catalog.algorithms) {
        for (const language of algorithm.languages) {
            if (!language.sourceId)
                continue;
            const owners = referrers.get(language.sourceId);
            if (owners)
                owners.add(algorithm.id);
            else
                referrers.set(language.sourceId, new Set([algorithm.id]));
        }
    }
    const bundled = new Set();
    for (const [sourceId, owners] of referrers) {
        // 같은 알고리즘이 두 언어 엔트리에서 같은 소스를 가리키는 경우는 공유가
        // 아니므로, 참조 횟수가 아니라 서로 다른 알고리즘 수로 센다.
        if (owners.size > 1)
            bundled.add(sourceId);
    }
    bundledSourceIdCache.set(catalog, bundled);
    return bundled;
}
/**
 * 소스가 아예 게시되지 않은 구현은 번들도 자립도 아니다. 2.1 인덱스 항목의 언어에는
 * sourceId 자체가 없어(상세에만 있다) 목록 층에서는 언제나 false다.
 */
export function isBundledSource(catalog, language) {
    return (language.sourceId !== undefined &&
        bundledSourceIds(catalog).has(language.sourceId));
}
/**
 * schema 2.0 `implementations`의 공개 고정 순서다. 화면은 operational/reserved나
 * object 삽입 순서로 묶지 않고 이 배열 하나만 따라야 같은 알고리즘의 표·카드가
 * 언제나 같은 위치를 유지한다. 1.x도 같은 소비자 UX를 위해 이 순서를 공유한다.
 */
const languageDisplayOrder = [
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
function languageDisplayRank(language) {
    const rank = languageDisplayOrder.indexOf(language);
    return rank === -1 ? languageDisplayOrder.length : rank;
}
/**
 * 언어 목록을 화면 순서로 정렬한 복사본. catalog가 게시한 배열은 계약 그대로
 * 두어야 하므로 제자리에서 뒤집지 않는다.
 */
export function sortedLanguages(languages) {
    return [...languages].sort((left, right) => {
        const rankDifference = languageDisplayRank(left.language) - languageDisplayRank(right.language);
        // 타입 확장 중 아직 고정 목록에 들지 않은 값도 locale에 흔들리지 않는 코드
        // 단위 순서로만 뒤에 붙인다.
        return (rankDifference ||
            (left.language < right.language
                ? -1
                : left.language > right.language
                    ? 1
                    : 0));
    });
}
/**
 * catalog에는 한국어 이름도 통용 약어도 없어, 풀네임 영문 표기만으로는 "버블"도
 * "bfs"도 걸리지 않는다. 두 별칭 표 모두 검색 대상에만 더해 두고, 카탈로그 모델
 * 자체는 계약대로 둔다.
 *
 * 분류·계열도 화면에는 한글 표시명으로 찍히므로("graph"가 아니라 "그래프"),
 * 표시명을 검색 대상에 함께 넣는다. 표기 토글과 무관하게 "ko"로 조회하는 것은
 * 영문 원문이 이미 category·family 필드로 들어와 있어, 둘을 합쳐야 어느 표기로
 * 보고 있든 눈에 보이는 말로 검색되기 때문이다. 미매핑 값은 조회 헬퍼가 raw id로
 * 되돌리므로 같은 문자열이 한 번 더 들어갈 뿐 결과는 달라지지 않는다.
 */
export function filterAlgorithms(algorithms, query, category = "") {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return algorithms.filter((algorithm) => {
        const documentation = algorithm.documentation;
        const searchable = [
            algorithm.id,
            algorithm.name,
            algorithm.summary,
            algorithm.category,
            algorithm.family,
            categoryDisplayName(algorithm.category, "ko"),
            familyDisplayName(algorithm.family, "ko"),
            documentation?.summary ?? "",
            ...(documentation?.whenToUse ?? []),
            ...(documentation?.avoidWhen ?? []),
            ...(documentation?.tradeoffs ?? []),
            ...(documentation?.pitfalls ?? []),
            ...algorithm.languages.map((language) => language.language),
            ...koreanSearchAliases(algorithm.id),
            ...englishSearchAliases(algorithm.id),
        ]
            .join(" ")
            .toLocaleLowerCase();
        return ((!normalizedQuery || searchable.includes(normalizedQuery)) &&
            (!category || algorithm.category === category));
    });
}
export function summarizeFeedback(algorithms) {
    const statusCounts = {
        none: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        unavailable: 0,
    };
    let evidenceCount = 0;
    let candidateCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    for (const algorithm of algorithms) {
        statusCounts[algorithm.feedback.status] += 1;
        evidenceCount += algorithm.feedback.evidenceCount;
        candidateCount += algorithm.feedback.candidateCount;
        approvedCount += algorithm.feedback.approvedCount;
        rejectedCount += algorithm.feedback.rejectedCount;
        pendingCount += algorithm.feedback.pendingCount;
    }
    return {
        statusCounts,
        evidenceCount,
        candidateCount,
        approvedCount,
        rejectedCount,
        pendingCount,
    };
}
/**
 * 공식 벡터와 언어-local 기본 테스트를 모두 읽어 상단 릴리스 지표를 만든다.
 * passing이라도 skipped가 있으면 완전 통과 구현으로 세지 않으며, 실패/건너뜀은
 * 두 검증 축의 실제 집계를 더한다. 레거시 catalog는 testSummary를 공식 벡터
 * 요약으로 사용하고 기본 테스트는 게시되지 않은 것으로 취급한다.
 */
export function summarizeCatalogReadiness(catalog) {
    let implementationCount = 0;
    let basicTestPassingImplementations = 0;
    let releaseReadyImplementations = 0;
    let passedChecks = 0;
    let failedChecks = 0;
    let skippedChecks = 0;
    for (const algorithm of catalog.algorithms) {
        for (const language of algorithm.languages) {
            implementationCount += 1;
            const vectorVerification = language.vectorVerification ?? {
                status: language.verification,
                ...language.testSummary,
            };
            const basicVerification = language.basicTestVerification;
            passedChecks +=
                vectorVerification.passed + (basicVerification?.passed ?? 0);
            failedChecks +=
                vectorVerification.failed + (basicVerification?.failed ?? 0);
            skippedChecks +=
                vectorVerification.skipped + (basicVerification?.skipped ?? 0);
            const basicTestPassing = language.basicTest != null &&
                basicVerification?.status === "passing" &&
                basicVerification.failed === 0 &&
                basicVerification.skipped === 0;
            if (basicTestPassing)
                basicTestPassingImplementations += 1;
            const vectorPassing = vectorVerification.status === "passing" &&
                vectorVerification.failed === 0 &&
                vectorVerification.skipped === 0;
            if (language.implementationStatus === "O" &&
                vectorPassing &&
                basicTestPassing) {
                releaseReadyImplementations += 1;
            }
        }
    }
    return {
        algorithmCount: catalog.coverage.algorithmCount,
        sourceCount: catalog.sources?.length ?? 0,
        caseCount: catalog.coverage.caseCount,
        implementationCount,
        basicTestPassingImplementations,
        releaseReadyImplementations,
        passedChecks,
        failedChecks,
        skippedChecks,
    };
}
export function algorithmHash(id) {
    return `#algorithm/${encodeURIComponent(id)}`;
}
export function algorithmIdFromHash(hash) {
    const prefix = "#algorithm/";
    if (!hash.startsWith(prefix))
        return undefined;
    try {
        const id = decodeURIComponent(hash.slice(prefix.length)).trim();
        return id || undefined;
    }
    catch {
        return undefined;
    }
}
export function statusLabel(status) {
    return ({ R: "계획", I: "구현 중", O: "사용 가능", E: "제외" })[status];
}
export function feedbackStatusLabel(status) {
    return {
        none: "없음",
        pending: "검토 대기",
        approved: "승인",
        rejected: "반려",
        unavailable: "집계 불가",
    }[status];
}
