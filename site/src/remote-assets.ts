/**
 * catalog가 가리키는 정본을 내려받아 무결성을 확인하는 브라우저 경계다. 화면 코드는
 * 이 모듈이 돌려준 문자열과 벡터만 사용하므로, 응답이 변조되거나 다른 파일로 바뀐
 * 경우에는 코드 표시·복사·테스트 렌더 어느 것도 일어나지 않는다.
 *
 * 이 공개 스냅샷은 Archive API를 두지 않는다. 상세·검색 보조뿐 아니라 소스 본문과
 * 공식 벡터까지 배포 루트의 정적 파일로 함께 싣고, 헤더 계약 대신 받은 바이트 자체를
 * 본다 — 인덱스·상세가 발표한 byteLength와 sha256에 정확히 일치하는 바이트만
 * 통과시킨다. 헤더는 서버가 말하는 것이고 해시는 바이트가 말하는 것이라, 무결성
 * 판정으로는 이쪽이 더 강하다. Content-Type도 정적 서버마다 표기가 갈려 검사에 넣지
 * 않는다. 대신 UTF-8 해독과 JSON 파싱을 fatal로 걸어 형태를 확정한다.
 */

export interface LoadedVector {
  readonly rawText: string;
  readonly vector: {
    readonly schemaVersion: string;
    readonly vectorId: string;
    readonly algorithmId: string;
    readonly cases: readonly unknown[];
  };
  readonly sha256: string;
  readonly byteLength: number;
}

export interface AssetRequestOptions<Value> {
  readonly request: Promise<Value>;
  readonly generation: number;
  readonly guard: AssetViewGeneration;
  readonly isConnected: () => boolean;
  readonly onSuccess: (value: Value) => void;
  readonly onFailure: (error: unknown) => void;
}

export type AssetRequestResult = "applied" | "failed" | "stale";

const digestPattern = /^[0-9a-f]{64}$/u;

/**
 * 전역 fetch를 그대로 필드에 담아 `this.#fetcher(...)`로 부르면 브라우저에서는
 * receiver가 window가 아니게 되어 "Illegal invocation"으로 죽는다. Node의 fetch는
 * 그렇지 않아 테스트만으로는 드러나지 않으므로, 호출 형태와 무관하게 안전하도록
 * 여기서 한 겹 감싼다.
 */
function boundFetch(): typeof fetch {
  return (input, init) => fetch(input, init);
}

/**
 * 화면이 다시 그려지거나 다른 알고리즘으로 이동하면 세대를 올린다. 이미 시작한
 * fetch를 공유 캐시 때문에 취소하지 못해도, 옛 세대의 응답은 새 DOM에 반영되지
 * 않는다. 네트워크 중복 제거와 stale selection 방지를 함께 만족시키는 장치다.
 */
export class AssetViewGeneration {
  #value = 0;

  begin(): number {
    this.#value += 1;
    return this.#value;
  }

  isCurrent(value: number): boolean {
    return value === this.#value;
  }
}

/**
 * 비동기 자산 한 건의 성공·실패를 해당 카드에만 정착시킨다. 화면 세대가 바뀌거나
 * 카드가 DOM에서 떨어진 뒤 도착한 응답은 callback을 전혀 실행하지 않는다. 실패도
 * 호출자에게 다시 던지지 않아 catalog 목록·설명 렌더와 격리된다.
 */
export async function settleAssetRequest<Value>(
  options: AssetRequestOptions<Value>,
): Promise<AssetRequestResult> {
  try {
    const value = await options.request;
    if (
      !options.guard.isCurrent(options.generation) ||
      !options.isConnected()
    ) {
      return "stale";
    }
    options.onSuccess(value);
    return "applied";
  } catch (error: unknown) {
    if (
      !options.guard.isCurrent(options.generation) ||
      !options.isConnected()
    ) {
      return "stale";
    }
    options.onFailure(error);
    return "failed";
  }
}

function byteDigest(bytes: ArrayBuffer, cryptoProvider: Pick<Crypto, "subtle">): Promise<string> {
  return cryptoProvider.subtle.digest("SHA-256", bytes).then((digest) =>
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""),
  );
}

function decodeUtf8(bytes: ArrayBuffer): string {
  try {
    // fatal=true라서 대체 문자로 손상된 코드를 그럴듯하게 보여 주지 않는다.
    // ignoreBOM=true는 BOM을 특별히 버리지 않고 U+FEFF 문자로 보존한다. 원본
    // 바이트를 다시 TextEncoder에 넣었을 때 같은 선두 바이트가 나와야 하기 때문이다.
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch (error: unknown) {
    throw new Error("정본이 유효한 UTF-8이 아닙니다.", { cause: error });
  }
}

export interface StaticAssetManifest {
  /** 배포 루트 기준 상대 경로다. 인덱스·상세가 발표한 값을 그대로 쓴다. */
  readonly path: string;
  readonly sha256: string;
  readonly byteLength: number;
}

export interface LoadedStaticText {
  readonly text: string;
  readonly sha256: string;
  readonly byteLength: number;
}

export interface LoadedStaticJson {
  readonly value: unknown;
  readonly sha256: string;
  readonly byteLength: number;
}

/**
 * 벤더링한 소스·벡터가 놓이는 배포 루트 하위 디렉터리. catalog manifest의 path는
 * 콘텐츠 저장소 기준(`src/main/...`·`test-vectors/...`)이라, 배포 경로는 여기서
 * 한 겹 붙여 만든다. 붙이는 자리를 한 곳으로 모아 두면 배치가 바뀌어도 여기만 본다.
 */
export const vendoredSourceRoot = "sources/";
export const vendoredVectorRoot = "vectors/";

export function vendoredAssetManifest(
  root: string,
  manifest: StaticAssetManifest,
): StaticAssetManifest {
  return {
    path: `${root}${manifest.path}`,
    sha256: manifest.sha256,
    byteLength: manifest.byteLength,
  };
}

/**
 * manifest 경로를 배포 루트 기준으로만 해석한다. 절대 URL·다른 origin·상위 탈출은
 * 파서가 이미 거절하지만, 요청을 만드는 자리에서도 한 번 더 끊는다.
 */
export function resolveStaticAssetUrl(
  assetPath: string,
  baseUrl: string,
): URL {
  const base = new URL(".", baseUrl);
  const url = new URL(assetPath, base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
    throw new TypeError("정적 자산 경로가 배포 루트를 벗어납니다.");
  }
  url.search = "";
  url.hash = "";
  return url;
}

interface StaticLoaderOptions {
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
  readonly crypto?: Pick<Crypto, "subtle">;
}

/**
 * 경로형 정적 자산의 공통 경계. 요청 한 건이 발표된 바이트와 정확히 같은지만 보고,
 * 해독·파싱은 하위 로더가 각자 한다. 소스는 코드 본문이고 상세·벡터는 JSON이라
 * 실패 진단을 갈라 두는 편이 읽기 쉽다.
 */
abstract class VerifiedStaticLoader<Value> {
  readonly #baseUrl: string;
  readonly #fetcher: typeof fetch;
  readonly #crypto: Pick<Crypto, "subtle">;
  readonly #cache = new Map<string, Promise<Value>>();

  constructor(options: StaticLoaderOptions) {
    this.#baseUrl = options.baseUrl;
    this.#fetcher = options.fetch ?? boundFetch();
    this.#crypto = options.crypto ?? crypto;
  }

  protected abstract accept(): string;

  protected abstract finish(
    text: string,
    sha256: string,
    byteLength: number,
  ): Value;

  load(manifest: StaticAssetManifest): Promise<Value> {
    const key = `${manifest.path} ${manifest.sha256}`;
    const cached = this.#cache.get(key);
    if (cached) return cached;
    let request!: Promise<Value>;
    request = this.#load(manifest).catch((error: unknown) => {
      // 실패를 영구 캐시하지 않는다. 사용자의 재시도는 실제 GET을 다시 수행한다.
      if (this.#cache.get(key) === request) this.#cache.delete(key);
      throw error;
    });
    this.#cache.set(key, request);
    return request;
  }

  async #load(manifest: StaticAssetManifest): Promise<Value> {
    if (!digestPattern.test(manifest.sha256)) {
      throw new TypeError("정적 자산 manifest SHA-256이 올바르지 않습니다.");
    }
    if (
      !Number.isSafeInteger(manifest.byteLength) ||
      manifest.byteLength < 1
    ) {
      throw new TypeError("정적 자산 manifest byteLength가 올바르지 않습니다.");
    }
    const url = resolveStaticAssetUrl(manifest.path, this.#baseUrl);
    const response = await this.#fetcher(url, {
      method: "GET",
      headers: { Accept: this.accept() },
      credentials: "same-origin",
    });
    if (!response.ok) {
      throw new Error(`정적 자산 요청이 HTTP ${response.status}로 실패했습니다.`);
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== manifest.byteLength) {
      throw new Error("정적 자산의 byteLength가 catalog manifest와 다릅니다.");
    }
    const actualDigest = await byteDigest(bytes, this.#crypto);
    if (actualDigest !== manifest.sha256) {
      throw new Error("정적 자산의 SHA-256이 catalog manifest와 다릅니다.");
    }
    return this.finish(decodeUtf8(bytes), actualDigest, bytes.byteLength);
  }
}

/** 상세(`algorithms/<id>.json`)·검색 보조·종별 자산이 지나는 길이다. */
export class VerifiedStaticJsonLoader extends VerifiedStaticLoader<LoadedStaticJson> {
  protected override accept(): string {
    return "application/json";
  }

  protected override finish(
    text: string,
    sha256: string,
    byteLength: number,
  ): LoadedStaticJson {
    // 해독 실패와 파싱 실패는 다른 사실이라 진단도 갈라 둔다.
    let value: unknown;
    try {
      value = JSON.parse(text) as unknown;
    } catch (error: unknown) {
      throw new Error("정적 자산이 유효한 JSON이 아닙니다.", { cause: error });
    }
    return { value, sha256, byteLength };
  }
}

/**
 * 벤더링한 소스 본문이 지나는 길이다. 코드는 JSON이 아니라 텍스트라 파싱하지 않고,
 * 줄바꿈·한글·끝 개행을 포함해 검증된 UTF-8 바이트를 그대로 해독한 문자열만 낸다.
 */
export class VerifiedStaticTextLoader extends VerifiedStaticLoader<LoadedStaticText> {
  protected override accept(): string {
    return "text/plain";
  }

  protected override finish(
    text: string,
    sha256: string,
    byteLength: number,
  ): LoadedStaticText {
    return { text, sha256, byteLength };
  }
}

/**
 * 벡터 본문은 바이트 검증만으로 끝내지 않는다. catalog가 발표한 벡터 ID·알고리즘·
 * case 수와 파일 안의 선언이 어긋나면, 해시가 맞더라도 다른 알고리즘의 표를 그 종의
 * 테스트로 보여 주게 되므로 여기서 함께 막는다.
 */
export function parseVerifiedVector(
  loaded: LoadedStaticText,
  manifest: {
    readonly id: string;
    readonly algorithmId: string;
    readonly caseCount: number;
  },
): LoadedVector {
  let parsed: unknown;
  try {
    parsed = JSON.parse(loaded.text) as unknown;
  } catch (error: unknown) {
    throw new Error("vector가 유효한 JSON이 아닙니다.", { cause: error });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("vector JSON 루트는 객체여야 합니다.");
  }
  const record = parsed as Record<string, unknown>;
  if (
    typeof record.schemaVersion !== "string" ||
    record.vectorId !== manifest.id ||
    record.algorithmId !== manifest.algorithmId ||
    !Array.isArray(record.cases) ||
    record.cases.length !== manifest.caseCount
  ) {
    throw new Error("vector의 ID·알고리즘·case 수가 catalog manifest와 다릅니다.");
  }
  return {
    rawText: loaded.text,
    vector: {
      schemaVersion: record.schemaVersion,
      vectorId: record.vectorId,
      algorithmId: record.algorithmId,
      cases: record.cases,
    },
    sha256: loaded.sha256,
    byteLength: loaded.byteLength,
  };
}
