import {
  algorithmHash,
  algorithmIdFromHash,
  applyCatalogSearch,
  contractPresentation,
  filterAlgorithms,
  isEmbeddedCatalogSource,
  isBundledSource,
  isRemoteCatalogSource,
  parseCatalogDetail,
  parseCatalogIndex,
  resolveAlternativeAlgorithms,
  sortedLanguages,
  sourceGroupForLanguage,
  summarizeIndexReadiness,
  vectorsForAlgorithm,
  type CatalogAlgorithm,
  type CatalogAssetManifest,
  type CatalogDocument,
  type CatalogFileGroup,
  type CatalogIndexDocument,
  type CatalogIndexEntry,
  type CatalogLanguage,
  type CatalogLanguageStatus,
  type CatalogContractPresentation,
  type CatalogListEntry,
  type CatalogSource,
  type CatalogVerificationSummary,
  type CatalogVectorManifest,
  type ImplementationStatus,
} from "./catalog.js";
import {
  algorithmDisplayName,
  categoryDisplayName,
  familyDisplayName,
} from "./korean-display-names.js";
import {
  aboutHash,
  isAboutHash,
  isDocumentScreen,
  isThoughtsHash,
  catalogTabActivation,
  screenForHash,
  scrollBehaviorForPreference,
  selectedIdForNavigation,
  thoughtsHash,
} from "./navigation.js";
import {
  parseUsageScenario,
  usageScenarioManifest,
  type ScenarioStepKind,
  type ScenarioStory,
} from "./usage-scenario.js";
import {
  optionalUiString,
  statusMetricRows,
  uiString,
  type StatusMetricRow,
  type UiLanguage,
} from "./ui-strings.js";
import {
  defaultRunTimeoutMilliseconds,
  javaScriptAdapter,
  judgeCase,
  parseVectorCase,
  runJavaScriptCase,
  type RunOutcome,
  type VectorCase,
} from "./vector-runner.js";
import {
  AssetViewGeneration,
  VerifiedStaticJsonLoader,
  VerifiedStaticTextLoader,
  parseVerifiedVector,
  settleAssetRequest,
  vendoredAssetManifest,
  vendoredSourceRoot,
  vendoredVectorRoot,
} from "./remote-assets.js";

/**
 * 화면 넷. 빈 해시·`#about`은 소개, `#thoughts`는 생각, 알고리즘 deep-link는
 * 상세, 그 밖의 anchor는 목록이다. 판정 자체는 navigation.ts가 든다.
 */
type ScreenName = "about" | "thoughts" | "list" | "detail";

type SpecTabId = "overview" | "spec" | "implementation";

type CatalogTabId = "list" | "coverage";

/**
 * 검색 보조(catalog-search.json)의 지연 로드 상태. 첫 화면에 실리지 않으므로
 * 목록·상세는 이 값과 무관하게 그려지고, 검색 범위만 좁았다 넓어진다.
 */
type SearchAidStatus = "idle" | "loading" | "ready" | "failed";

type ListViewMode = "card" | "rows";

type ThemeName = "light" | "dark";

interface SpecTabDefinition {
  readonly id: SpecTabId;
  readonly labelKey: string;
}

interface CatalogTabDefinition {
  readonly id: CatalogTabId;
  readonly hash: string;
  readonly tabElementId: string;
  readonly panelElementId: string;
  /** 탑바에 표시할 현재 화면 이름의 로케일 키 */
  readonly titleKey: string;
}

/**
 * 스펙 탭은 상세 화면의 유일한 골격이다. 25차까지는 category === "sort" 만 쓰는
 * 트라이얼이었고 나머지 분류는 긴 스크롤 한 장 + 별도 코드 비교 패널을 썼는데,
 * 26차에 전 분류를 이 탭형으로 통일했다. 분류로 갈리는 상세 경로는 이제 없다.
 */
const specTabDefinitions: readonly SpecTabDefinition[] = [
  { id: "overview", labelKey: "specTab.overview" },
  { id: "spec", labelKey: "specTab.spec" },
  { id: "implementation", labelKey: "specTab.implementation" },
];

/**
 * 사용 시나리오 네 단의 소제목. 문구는 UI 크롬이라 로케일 표가 들고, 자산은 단의
 * 기계 키만 가리킨다. 그래서 자산에는 한국어가 한 자도 들어 있지 않다.
 */
const scenarioStepLabelKeys: Readonly<Record<ScenarioStepKind, string>> = {
  situation: "scenario.situation",
  why: "scenario.why",
  apply: "scenario.apply",
  switchPoint: "scenario.switchPoint",
};

/** 목록 화면 탭은 기존 섹션 anchor를 그대로 deep-link로 승계한다. */
const catalogTabDefinitions: readonly CatalogTabDefinition[] = [
  {
    id: "list",
    hash: "#list",
    tabElementId: "catalog-tab-list",
    panelElementId: "list-panel",
    titleKey: "screen.list",
  },
  {
    id: "coverage",
    hash: "#coverage",
    tabElementId: "catalog-tab-coverage",
    panelElementId: "coverage-panel",
    titleKey: "screen.coverage",
  },
];

const copyResetMilliseconds = 2000;

/** 실행 시간 제한을 화면 문구에 쓰는 단위(초)로 옮긴 값이다. */
const runTimeoutSeconds = defaultRunTimeoutMilliseconds / 1000;

/**
 * 커버리지의 언어 상태 기호. 색만으로 뜻을 전달하지 않도록 칩마다 함께 붙이고,
 * 기호 자체의 뜻은 스크린리더용 보조 텍스트가 받는다.
 *
 * 화면에 서는 것은 지금 O 하나뿐이다(아래 operationalLanguages). 나머지 셋을 남겨
 * 두는 이유는 표가 상태 값을 그대로 받기 때문이다 — 카탈로그가 다른 상태를 실어
 * 보내도 기호 없는 칩이 되지 않는다.
 */
const implementationStatusMarks: Readonly<
  Record<ImplementationStatus, string>
> = {
  O: "✓",
  I: "◐",
  R: "○",
  E: "×",
};

/**
 * 화면에 싣는 구현 상태. 공개 스냅샷은 실제로 돌아가는 구현(operational)만 보여 준다.
 *
 * 스냅샷을 뜨면서 공개하지 않는 언어는 카탈로그에서 계획(reserved)으로 강등되는데,
 * 데이터에는 남아 있어야 스키마 검증과 해시 사슬이 성립한다. 그래서 걷어내는 자리는
 * 데이터가 아니라 화면이고, 조건도 언어 이름이 아니라 상태다 — 나중에 언어가 늘어
 * operational이 되면 표도 카드도 저절로 따라온다.
 */
const shownImplementationStatus: ImplementationStatus = "O";

function operationalLanguages<
  Language extends { readonly implementationStatus: ImplementationStatus },
>(languages: readonly Language[]): readonly Language[] {
  return languages.filter(
    (language) => language.implementationStatus === shownImplementationStatus,
  );
}

/**
 * 번들(러너 통짜) 소스를 참조하는 구현에 붙는 기호. 상태 기호와 같은 기하 도형
 * 계열에서 골라 ✓와 눈으로 갈리게 한다. 색은 구현 상태와 무관하게 중립으로
 * 덮으므로 범례에도 한 줄만 둔다. 기호는 표기 언어를 타지 않는다.
 *
 * 번들 소스에 붙는 문구(라벨·주석·카드 안내)는 ui-strings.ts의 bundled.* 키다.
 * 번들 소스는 검증을 통과했다는 사실은 그대로 두고, 재사용할 자립 소스가 아직
 * 없다는 것만 덧붙인다. 수십 KB짜리 러너 파일을 열어 보여 주지는 않는다.
 */
const bundledSourceMark = "◫";

/**
 * 소스 카드가 놓이는 순서. 표(위쪽 언어별 표)는 카탈로그의 고정 자리 순서를 그대로
 * 쓰지만, 카드 격자는 읽는 순서를 따로 정한다 — C#·Java를 한 줄에 나란히 두고
 * JavaScript를 그 아래 전체 너비로 내린다. JavaScript 카드만 폭이 필요한 이유는
 * 그 안에 벡터 실행기가 들어가기 때문이다.
 *
 * 이 목록에 없는 언어는 뒤에 원래 순서대로 붙는다. 공개 스냅샷에는 셋뿐이지만
 * 목록을 늘렸을 때 카드가 조용히 사라지지 않게 한다.
 */
const sourceCardLanguageOrder: readonly string[] = [
  "csharp",
  "java",
  "javascript",
];

/** 전체 너비로 내리는 언어. 실행기가 붙는 카드와 같은 판단이라 한 자리에서 정한다. */
const fullWidthSourceCardLanguage = "javascript";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** 표 셀에 들어갈 값은 중첩 구조라도 한 줄로 압축한다. */
function compactValue(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}
const listViewModes: readonly ListViewMode[] = ["card", "rows"];
const listViewStorageKey = "ssw-algorithm-archive:list-view";
const themeStorageKey = "ssw-algorithm-archive:theme";

/**
 * 표시 언어 키. 20차에는 알고리즘 이름 표기만 지배해서 키 이름도 name-language
 * 였지만, 22차에서 UI 크롬 전체를 함께 지배하게 되어 이름을 좁히지 않은 쪽으로
 * 옮겼다. 함수·변수 이름은 20차의 name 계열을 그대로 쓴다. 가리키는 축이 넓어진
 * 것이지 축이 둘로 늘어난 것은 아니다.
 */
const languageStorageKey = "ssw-algorithm-archive:language";

/** 20차의 옛 키. 새 키가 비었을 때 사용자가 골라 둔 설정을 승계하려고만 읽는다. */
const nameLanguageStorageKey = "ssw-algorithm-archive:name-language";

function isListViewMode(value: string | null): value is ListViewMode {
  return value !== null && listViewModes.includes(value as ListViewMode);
}

/** localStorage는 차단될 수 있는 외부 경계이므로 실패와 이상값 모두 카드형으로 되돌린다. */
function readStoredListView(): ListViewMode {
  try {
    const stored = window.localStorage.getItem(listViewStorageKey);
    return isListViewMode(stored) ? stored : "card";
  } catch (error: unknown) {
    console.error(
      `목록 보기 설정을 읽지 못했습니다. 원인 유형: ${errorType(error)}`,
      error,
    );
    return "card";
  }
}

function storeListView(mode: ListViewMode): void {
  try {
    window.localStorage.setItem(listViewStorageKey, mode);
  } catch (error: unknown) {
    console.error(
      `목록 보기 설정을 저장하지 못했습니다. 원인 유형: ${errorType(error)}`,
      error,
    );
  }
}

/**
 * 테마는 라이트가 기본이고 사용자가 켠 다크만 저장한다. OS 설정은 따르지 않는다.
 * index.html 의 인라인 스크립트가 같은 키를 먼저 읽어 첫 페인트 전에 적용한다.
 */
function readStoredTheme(): ThemeName {
  try {
    return window.localStorage.getItem(themeStorageKey) === "dark"
      ? "dark"
      : "light";
  } catch (error: unknown) {
    console.error(
      `테마 설정을 읽지 못했습니다. 원인 유형: ${errorType(error)}`,
      error,
    );
    return "light";
  }
}

function storeTheme(theme: ThemeName): void {
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch (error: unknown) {
    console.error(
      `테마 설정을 저장하지 못했습니다. 원인 유형: ${errorType(error)}`,
      error,
    );
  }
}

/**
 * 표시 언어는 한국어가 기본이고 사용자가 고른 영문만 실질적으로 저장된다. 테마와
 * 같은 규칙이라 저장값이 정확히 "en"일 때만 영문이 되고, 이상값·localStorage
 * 차단은 한국어로 돌아온다.
 *
 * 새 키를 먼저 보고, 새 키에 쓸 만한 값이 없을 때만 20차의 옛 키를 읽는다. 옛
 * 키에는 "ko"도 저장돼 있었지만 기본이 한국어라 실제로 승계할 값은 "en" 하나뿐
 * 이므로, 옛 키 해석은 20차 규칙을 그대로 쓴다. 승계는 저장 시점에 새 키로
 * 옮겨지고, 옛 키는 지우지 않는다 — 되돌리기 어려운 정리는 하지 않는다.
 */
function readStoredNameLanguage(): UiLanguage {
  try {
    const stored = window.localStorage.getItem(languageStorageKey);
    if (stored === "en" || stored === "ko") return stored;
    return window.localStorage.getItem(nameLanguageStorageKey) === "en"
      ? "en"
      : "ko";
  } catch (error: unknown) {
    console.error(
      `이름 표기 설정을 읽지 못했습니다. 원인 유형: ${errorType(error)}`,
      error,
    );
    return "ko";
  }
}

function storeNameLanguage(language: UiLanguage): void {
  try {
    window.localStorage.setItem(languageStorageKey, language);
  } catch (error: unknown) {
    console.error(
      `이름 표기 설정을 저장하지 못했습니다. 원인 유형: ${errorType(error)}`,
      error,
    );
  }
}

/**
 * 탭을 지목하지 않는 해시(skip-link, 26차 이전의 #detail·#compare 등)는 undefined로
 * 두어 현재 탭을 지킨다. 기본값이 목록 탭이라 그런 해시로 들어와도 목록에서 시작한다.
 */
function catalogTabFromHash(hash: string): CatalogTabId | undefined {
  if (!hash || hash === "#") return "list";
  return catalogTabDefinitions.find((definition) => definition.hash === hash)
    ?.id;
}

function catalogTabHash(tab: CatalogTabId): string {
  return (
    catalogTabDefinitions.find((definition) => definition.id === tab)?.hash ??
    "#list"
  );
}

function errorType(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function reportStartupFailure(error: unknown): void {
  console.error(`웹 초기화에 실패했습니다. 원인 유형: ${errorType(error)}`, error);
  const status = document.querySelector<HTMLElement>("#catalog-status");
  if (status) {
    // main() 밖이라 화면 상태를 들고 있지 않다. 저장된 언어를 직접 읽어 옮긴다.
    status.textContent = uiString(
      "status.startupFailed",
      readStoredNameLanguage(),
      { errorType: errorType(error) },
    );
    status.dataset.state = "error";
  }
}

function main(): void {
  function required<ElementType extends Element>(
    selector: string,
  ): ElementType {
    const item = document.querySelector<ElementType>(selector);
    if (!item) throw new Error(`필수 DOM 요소가 없습니다: ${selector}`);
    return item;
  }

  const search = required<HTMLInputElement>("#algorithm-search");
  const category = required<HTMLSelectElement>("#category-filter");
  const list = required<HTMLElement>("#algorithm-list");
  const listHeading = required<HTMLElement>("#catalog-title");
  const status = required<HTMLElement>("#catalog-status");
  const resultCount = required<HTMLElement>("#result-count");
  const detail = required<HTMLElement>("#detail-content");
  const detailPanel = required<HTMLElement>("#detail");
  const matrix = required<HTMLElement>("#coverage-matrix");
  const catalogScreen = required<HTMLElement>("#catalog-screen");
  /*
    읽을거리 화면 둘. 본문(#about-doc·#thoughts-doc 안)은 빌드가 저장소의
    마크다운을 옮겨 넣은 정적 HTML이라 화면 코드가 만들지도 다시 그리지도 않는다.
    여기서 잡는 것은 셸이 들고 있는 바깥 껍데기뿐이다 — 본문 제목이 바뀌어도 이
    선택자는 흔들리지 않는다.
  */
  const aboutPanel = required<HTMLElement>("#about-panel");
  const aboutDoc = required<HTMLElement>("#about-doc");
  const aboutNavLink = required<HTMLAnchorElement>("#nav-about");
  const aboutCta = required<HTMLAnchorElement>("#about-cta");
  const thoughtsPanel = required<HTMLElement>("#thoughts-panel");
  const thoughtsDoc = required<HTMLElement>("#thoughts-doc");
  const thoughtsNavLink = required<HTMLAnchorElement>("#nav-thoughts");
  const skipLink = required<HTMLAnchorElement>(".skip-link");
  const mainContent = required<HTMLElement>("#main-content");
  const topbar = required<HTMLElement>(".topbar");
  const brandHome = required<HTMLAnchorElement>("#brand-home");
  const sidebar = required<HTMLElement>("#sidebar");
  const sidebarScrim = required<HTMLElement>("#sidebar-scrim");
  const sidebarToggle = required<HTMLButtonElement>("#sidebar-toggle");
  const screenTitle = required<HTMLElement>("#screen-title");
  const themeToggle = required<HTMLButtonElement>("#theme-toggle");
  const themeToggleIcon = required<HTMLElement>(
    "#theme-toggle .theme-toggle__icon",
  );
  // 표시 언어는 두 선택지를 나란히 두는 편이 눌린 쪽을 읽기 쉬워 보기 전환과 같은
  // 버튼 쌍으로 만든다. 값이 두 개뿐이라 aria-pressed 만으로 상태가 다 드러난다.
  // 버튼 라벨은 각 언어의 자기 이름이라 로케일 표를 타지 않고 마크업에 그대로 있다.
  const nameLanguageButtons: ReadonlyMap<UiLanguage, HTMLButtonElement> =
    new Map([
      ["ko", required<HTMLButtonElement>("#name-language-ko")],
      ["en", required<HTMLButtonElement>("#name-language-en")],
    ]);
  const viewCardButton = required<HTMLButtonElement>("#view-card");
  const viewRowsButton = required<HTMLButtonElement>("#view-rows");
  const copyStatus = required<HTMLElement>("#copy-status");
  const catalogTabControls = new Map<
    CatalogTabId,
    { readonly tab: HTMLAnchorElement; readonly panel: HTMLElement }
  >(
    catalogTabDefinitions.map((definition) => [
      definition.id,
      {
        tab: required<HTMLAnchorElement>(`#${definition.tabElementId}`),
        panel: required<HTMLElement>(`#${definition.panelElementId}`),
      },
    ]),
  );
  const defaultTitle = document.title;
  /**
   * 첫 요청으로 받는 2.1 목록 인덱스. 목록·커버리지와 사이드바 지표가 전부 여기서
   * 나오고, 상세는 이 문서가 가리키는 파일을 진입 시점에 따로 받는다.
   */
  let catalogIndex: CatalogIndexDocument | null = null;
  /**
   * 지금 열려 있는 상세 한 종을 담은 1종짜리 2.0 문서. 소스·벡터 조회가 기존 2.0
   * 경로를 그대로 타도록 상세 파서가 만들어 준다.
   */
  let detailCatalog: CatalogDocument | null = null;
  let detailAlgorithm: CatalogAlgorithm | null = null;
  /**
   * 상세가 발표한 종별 자산 manifest와, 그중 사용 시나리오를 실제로 받아 둔 값이다.
   * 셋은 같은 종을 가리켜야 하므로 언제나 함께 비운다. 시나리오를 한 번 받아 두면
   * 탭 전환·언어 전환으로 개요를 다시 그려도 요청이 다시 나가지 않는다.
   */
  let detailAssets: Readonly<Record<string, CatalogAssetManifest>> | null = null;
  let detailScenario: ScenarioStory | null = null;
  let searchAidStatus: SearchAidStatus = "idle";
  let selectedId = "";
  let initialSelectedId = "";
  // 첫 화면은 소개다. 정적 HTML도 소개를 펴 둔 상태로 게시되므로, 스크립트가
  // 늦게 붙어도 처음 보이는 화면과 이 값이 어긋나지 않는다.
  let screen: ScreenName = "about";
  let listScrollY = 0;
  let listScrollTab: CatalogTabId = "list";
  let activeSpecTab: SpecTabId = "overview";
  let activeCatalogTab: CatalogTabId =
    catalogTabFromHash(window.location.hash) ?? "list";
  let listViewMode: ListViewMode = readStoredListView();
  let activeTheme: ThemeName = readStoredTheme();
  let activeNameLanguage: UiLanguage = readStoredNameLanguage();

  /** 비보안 컨텍스트에는 clipboard API가 없으므로 복사 UI 자체를 만들지 않는다. */
  const clipboard: Clipboard | undefined = navigator.clipboard;
  const writeToClipboard: ((value: string) => Promise<void>) | undefined =
    clipboard && typeof clipboard.writeText === "function"
      ? (value: string) => clipboard.writeText(value)
      : undefined;

  const assetViewGeneration = new AssetViewGeneration();
  let currentAssetViewGeneration = assetViewGeneration.begin();
  /**
   * 이 스냅샷의 자산은 상세·검색 보조·종별 자산뿐 아니라 소스 본문과 공식 벡터까지
   * 전부 배포 루트의 정적 파일이다. 어느 쪽도 API를 타지 않고, 인덱스·상세가 발표한
   * sha256·byteLength에 정확히 맞는 바이트만 통과시킨다.
   */
  const staticJsonLoader = new VerifiedStaticJsonLoader({
    baseUrl: window.location.href,
  });
  const staticTextLoader = new VerifiedStaticTextLoader({
    baseUrl: window.location.href,
  });

  const element = <T extends keyof HTMLElementTagNameMap>(
    name: T,
    className?: string,
  ): HTMLElementTagNameMap[T] => {
    const item = document.createElement(name);
    if (className) item.className = className;
    return item;
  };

  /**
   * UI 크롬 문자열은 모두 이 헬퍼를 거친다. 언어를 읽는 자리가 여기뿐이라, 토글이
   * 바뀌면 정적 DOM 갱신과 다시 렌더만으로 화면 전체가 맞는다. 카탈로그가 발행한
   * 설명·테스트 케이스 본문은 여기를 타지 않는다(스키마 1.2 i18n 필드의 몫이다).
   */
  const t = (
    key: string,
    values?: Readonly<Record<string, string | number>>,
  ): string => uiString(key, activeNameLanguage, values);

  /**
   * 상태줄은 렌더 주기 밖에서 한 번 찍히고 그대로 남는 유일한 문구다. 언어를
   * 바꿔도 다시 그릴 수 있도록, 찍은 결과 대신 문구를 만드는 함수를 들고 있는다.
   *
   * 싣는 것은 두 가지다. 준비·로딩·실패는 문장 하나이고, 게시 지표는 라벨·값
   * 줄의 목록이다. 지표를 가운데 점으로 이어 붙이면 PC 폭에서 한 줄이 길게
   * 늘어서고 좁은 화면에서는 어중간하게 접혀, 어디까지가 한 항목인지 끊기지
   * 않는다. 그래서 목록 쪽은 상세 화면 .metrics 와 같은 dl 로 그린다.
   */
  let statusMessage:
    | (() => string | readonly StatusMetricRow[])
    | undefined;

  const paintStatus = (value: string | readonly StatusMetricRow[]): void => {
    if (typeof value === "string") {
      status.textContent = value;
      return;
    }
    const metrics = element("dl", "status-metrics");
    for (const metric of value) {
      const term = element("dt");
      const description = element("dd");
      term.textContent = metric.label;
      description.textContent = metric.value;
      metrics.append(term, description);
    }
    status.replaceChildren(metrics);
  };

  const setStatus = (
    message: () => string | readonly StatusMetricRow[],
    state: "loading" | "ready" | "error",
  ): void => {
    statusMessage = message;
    paintStatus(message());
    status.dataset.state = state;
  };

  /** 아직 아무 상태도 찍히지 않았으면 정적 HTML의 초기 문구를 그대로 둔다. */
  const refreshStatus = (): void => {
    if (statusMessage) paintStatus(statusMessage());
  };

  const show = (message: string): HTMLParagraphElement => {
    const item = element("p", "empty-state");
    item.textContent = message;
    return item;
  };

  /**
   * 화면에 찍히는 이름·분류·계열은 모두 이 세 헬퍼를 거친다. 표기 언어를 읽는
   * 자리가 여기뿐이라, 토글이 바뀌면 다시 렌더하는 것만으로 화면 전체가 맞는다.
   * 분류 필터의 option 값과 계약 필드·언어명·오류 코드는 식별자라 옮기지 않는다.
   */
  const displayName = (algorithm: {
    readonly id: string;
    readonly name: string;
  }): string =>
    algorithmDisplayName(algorithm.id, algorithm.name, activeNameLanguage);

  const displayCategory = (value: string): string =>
    categoryDisplayName(value, activeNameLanguage);

  const displayFamily = (value: string): string =>
    familyDisplayName(value, activeNameLanguage);

  /**
   * 구현 상태(R·I·O·E)는 catalog가 코드로 발행하고 화면에는 말로 찍힌다.
   * catalog.ts의 statusLabel은 한국어 한 벌뿐이라 여기서는 로케일 표를 거친다.
   */
  const implementationStatusText = (status: ImplementationStatus): string =>
    t(`implementationStatus.${status}`);

  const preferredScrollBehavior = (): ScrollBehavior =>
    scrollBehaviorForPreference(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );

  function focusSelectedDetail(scroll: boolean): void {
    if (!selectedId) return;
    const heading = detail.querySelector<HTMLElement>("[data-detail-heading]");
    heading?.focus({ preventScroll: true });
    if (scroll) {
      document.querySelector("#detail")?.scrollIntoView({
        behavior: preferredScrollBehavior(),
        block: "start",
      });
    }
  }

  /**
   * 탑바는 sticky 라 앵커로 이동한 대상의 윗부분을 덮는다. 폭에 따라 줄바꿈돼
   * 높이가 달라지므로 고정값을 쓰지 않고 실제 높이를 --topbar-height 로 흘려
   * 보낸다. styles.css 의 --anchor-offset(= 높이 + 1rem)이 이 값을 받아 모든
   * scroll-margin 목적지에 한 번에 적용된다.
   */
  function trackTopbarHeight(): void {
    const apply = (): void => {
      document.documentElement.style.setProperty(
        "--topbar-height",
        `${topbar.offsetHeight}px`,
      );
    };
    apply();
    // ResizeObserver가 없는 환경은 창 크기 변화만으로도 대부분의 줄바꿈을 잡는다.
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(apply).observe(topbar);
    } else {
      window.addEventListener("resize", apply);
    }
  }

  /** 다크일 때만 data-theme을 남긴다. 라이트는 속성 없음이 기본 상태다. */
  function applyTheme(theme: ThemeName): void {
    const dark = theme === "dark";
    if (dark) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    themeToggle.setAttribute("aria-pressed", String(dark));
    themeToggleIcon.textContent = dark ? "☀" : "◐";
  }

  /** 고른 언어 쪽만 aria-pressed=true 로 남긴다. 보기 전환 버튼 쌍과 같은 규칙이다. */
  function applyNameLanguage(): void {
    for (const [language, button] of nameLanguageButtons) {
      button.setAttribute(
        "aria-pressed",
        String(language === activeNameLanguage),
      );
    }
  }

  const setResultCount = (count: number): void => {
    resultCount.textContent = t("list.resultCount", { count });
  };

  /**
   * 정적 HTML에 박혀 있는 문자열을 고른 언어로 덮는다. 어느 요소의 어느 속성을
   * 옮길지는 마크업의 data-i18n* 이 들고 있어, 문자열을 더할 때 이 함수를 고칠
   * 일이 없다. <html lang>도 같은 자리에서 맞춘다 — 화면 낭독과 자동 번역이
   * 문서 언어를 이 속성으로 읽는다.
   */
  function applyStaticUiStrings(): void {
    document.documentElement.lang = activeNameLanguage;
    for (const node of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
      const key = node.dataset.i18n;
      if (key) node.textContent = t(key);
    }
    for (const node of document.querySelectorAll<HTMLElement>(
      "[data-i18n-aria-label]",
    )) {
      const key = node.dataset.i18nAriaLabel;
      if (key) node.setAttribute("aria-label", t(key));
    }
    for (const node of document.querySelectorAll<HTMLInputElement>(
      "[data-i18n-placeholder]",
    )) {
      const key = node.dataset.i18nPlaceholder;
      if (key) node.placeholder = t(key);
    }
    for (const node of document.querySelectorAll<HTMLMetaElement>(
      "[data-i18n-content]",
    )) {
      const key = node.dataset.i18nContent;
      if (key) node.content = t(key);
    }
    // 상태줄은 위에서 정적 초기 문구로 되돌아갔으므로 마지막 상태를 다시 찍는다.
    refreshStatus();
    /*
      탑바 제목도 같은 사정이다. 셸의 data-i18n 은 첫 화면(소개)의 이름이라, 위
      루프가 보고 있던 화면과 무관하게 그 문구로 되돌린다. 소개가 아닌 화면으로
      들어온 첫 로드에서 제목이 잠깐 "소개" 로 서던 자리다. 상세만은 알고리즘
      이름을 들고 있으므로 건드리지 않는다.
    */
    if (screen !== "detail") screenTitle.textContent = activeScreenTitle();
  }

  /**
   * 언어 전환은 검색어·필터·탭·선택을 건드리지 않고 화면만 다시 그린다. 분류
   * 필터는 라벨이 바뀌어 다시 채우지만 고르고 있던 값은 populateCategories가 지킨다.
   * 정렬 순서와 검색 동작은 언어와 무관하게 현행 그대로다.
   */
  function selectNameLanguage(language: UiLanguage): void {
    if (activeNameLanguage === language) return;
    activeNameLanguage = language;
    storeNameLanguage(language);
    applyNameLanguage();
    applyStaticUiStrings();
    populateCategories();
    render();
  }

  function activeScreenTitle(): string {
    if (screen === "about") return t("screen.about");
    // 생각만 탑바가 글의 제목을 든다. 본문에서는 그 제목을 뺐다(build-pages.mjs).
    if (screen === "thoughts") return t("screen.thoughts");
    const definition = catalogTabDefinitions.find(
      (item) => item.id === activeCatalogTab,
    );
    return definition ? t(definition.titleKey) : t("screen.fallback");
  }

  /**
   * 사이드바는 ≤820px에서만 드로어로 접힌다. 넓은 화면에서는 항상 보이므로
   * 상태를 열림으로 남겨 둬도 레이아웃에 영향이 없다.
   */
  function setSidebarOpen(open: boolean): void {
    sidebar.dataset.open = String(open);
    sidebarToggle.setAttribute("aria-expanded", String(open));
    sidebarScrim.hidden = !open;
  }

  function closeSidebar(options: { readonly focusToggle?: boolean } = {}): void {
    if (sidebar.dataset.open !== "true") return;
    setSidebarOpen(false);
    if (options.focusToggle) sidebarToggle.focus({ preventScroll: true });
  }

  /**
   * 사이드바 네비는 링크이므로 선택 표시는 aria-current로 알린다.
   *
   * 패널의 열고 닫힘은 지금 고른 카탈로그 탭만 본다. 카탈로그 화면 자체를
   * 걷어내는 일은 상위(applyScreen)가 #catalog-screen 하나로 하므로, 소개·상세를
   * 보는 동안에도 안쪽 패널 상태는 그대로 남아 목록으로 돌아왔을 때 보던 탭이 선다.
   *
   * 활성 표시는 화면까지 본다. 상세는 목록의 하위 컨텍스트라 목록에 표시를 남기지만,
   * 읽을거리(소개·생각)는 카탈로그 밖 화면이라 카탈로그 항목이 눌린 것처럼 보이면
   * 안 된다.
   */
  function applyCatalogTabs(): void {
    const onDocument = isDocumentScreen(screen);
    for (const definition of catalogTabDefinitions) {
      const control = catalogTabControls.get(definition.id);
      if (!control) continue;
      const active = definition.id === activeCatalogTab;
      if (active && !onDocument) {
        control.tab.setAttribute("aria-current", "page");
      } else control.tab.removeAttribute("aria-current");
      control.panel.hidden = !active;
    }
    for (const [link, target] of [
      [aboutNavLink, "about"],
      [thoughtsNavLink, "thoughts"],
    ] as const) {
      if (screen === target) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    if (screen !== "detail") screenTitle.textContent = activeScreenTitle();
  }

  function focusCatalogTab(): void {
    catalogTabControls
      .get(activeCatalogTab)
      ?.tab.focus({ preventScroll: true });
  }

  /** pushState는 스크롤을 옮기지 않으므로 콘텐츠 상단이 잘려 있으면 끌어올린다. */
  function ensureContentVisible(): void {
    if (catalogScreen.getBoundingClientRect().top >= 0) return;
    catalogScreen.scrollIntoView({
      behavior: preferredScrollBehavior(),
      block: "start",
    });
  }

  /**
   * 네비 활성화는 해시를 바꾼다. 클릭은 히스토리를 남긴다.
   *
   * 해시만 바꾸는 pushState·replaceState는 hashchange를 발생시키지 않으므로,
   * 히스토리 경로에 걸어 둔 라우팅이 여기서는 저절로 돌지 않는다. 상세를 보고 있었다면
   * 화면 자체가 바뀌는 이동이라 그 라우팅을 직접 한 번 태워야 한다 — 이걸 하지 않던
   * 동안 상세에서 네비를 누르면 주소만 바뀌고 상세 DOM이 그대로 남았다.
   */
  function selectCatalogTab(
    tab: CatalogTabId,
    options: { readonly replace?: boolean } = {},
  ): void {
    const nextHash = catalogTabHash(tab);
    if (window.location.hash !== nextHash) {
      if (options.replace) window.history.replaceState(null, "", nextHash);
      else window.history.pushState(null, "", nextHash);
    }
    if (catalogTabActivation(screen) === "route") {
      // 바뀐 해시가 곧 목적지다. applyNavigation이 화면·탭·선택을 다시 읽어
      // 상세를 걷어내고, 초점도 대상 화면으로 옮긴다.
      applyNavigation(true);
      return;
    }
    activeCatalogTab = tab;
    applyCatalogTabs();
    ensureContentVisible();
  }

  /**
   * 읽을거리 복귀 초점은 본문 상자로 보낸다. 안쪽 제목은 빌드가 만든 생성물이라
   * 화면 코드가 그 구조에 기대지 않는다.
   *
   * 읽는 화면이라 스크롤은 늘 처음부터다. 본문 앵커로 들어온 이동은 이 경로를
   * 타지 않는다 — 화면이 바뀌지 않아 라우팅이 일찍 끝나고, 스크롤은 브라우저의
   * 기본 동작이 그대로 맡는다.
   */
  function focusDocument(scroll: boolean): void {
    if (scroll) window.scrollTo({ top: 0, behavior: "auto" });
    (screen === "thoughts" ? thoughtsDoc : aboutDoc).focus({
      preventScroll: true,
    });
  }

  /** 목록 복귀 초점은 직전에 보던 카드, 없으면 목록 제목으로 보낸다. */
  function focusListEntry(scroll: boolean): void {
    if (scroll) {
      // 다른 탭으로 복귀하면 저장된 스크롤은 의미가 없으므로 상단에서 시작한다.
      window.scrollTo({
        top: activeCatalogTab === listScrollTab ? listScrollY : 0,
        behavior: "auto",
      });
    }
    if (activeCatalogTab !== "list") {
      focusCatalogTab();
      return;
    }
    // 카드형·리스트형 어느 쪽이든 직전에 보던 항목을 잡는다.
    const selectedEntry = list.querySelector<HTMLElement>(
      '[data-selected="true"]',
    );
    (selectedEntry ?? listHeading).focus({ preventScroll: true });
  }

  function copyButton(
    write: (value: string) => Promise<void>,
    text: string,
  ): HTMLButtonElement {
    const button = element("button", "copy-button");
    button.type = "button";
    button.textContent = t("copy.action");
    let resetHandle = 0;
    const flash = (label: string, announcement: string): void => {
      button.textContent = label;
      copyStatus.textContent = announcement;
      window.clearTimeout(resetHandle);
      resetHandle = window.setTimeout(() => {
        button.textContent = t("copy.action");
      }, copyResetMilliseconds);
    };
    button.addEventListener("click", () => {
      void (async (): Promise<void> => {
        try {
          await write(text);
          flash(t("copy.done"), t("copy.announceDone"));
        } catch (error: unknown) {
          console.error(
            `코드를 복사하지 못했습니다. 원인 유형: ${errorType(error)}`,
            error,
          );
          flash(t("copy.failed"), t("copy.announceFailed"));
        }
      })();
    });
    return button;
  }

  /** clipboard가 없으면 원본 pre를 그대로 두어 기존 표시를 바꾸지 않는다. */
  function codeBlock(pre: HTMLPreElement, text: string): HTMLElement {
    const write = writeToClipboard;
    if (!write) return pre;
    const wrapper = element("div", "code-block");
    const bar = element("div", "code-block__bar");
    bar.append(copyButton(write, text));
    wrapper.append(bar, pre);
    return wrapper;
  }

  /** 검증을 끝낸 문자열만 이 함수에 들어오므로 복사 버튼도 이 시점에만 생긴다. */
  function sourceCodeBlock(text: string): HTMLElement {
    const pre = element("pre", "source-code");
    const code = element("code");
    code.textContent = text;
    pre.tabIndex = 0;
    pre.append(code);
    return codeBlock(pre, text);
  }

  function retryButton(action: () => void, labelKey: string): HTMLButtonElement {
    const button = element("button", "source-retry-button");
    button.type = "button";
    button.textContent = t(labelKey);
    button.addEventListener("click", action);
    return button;
  }

  /**
   * source는 구현 탭을 실제로 만든 뒤에만 이 경로로 들어온다. 로딩 중에는 코드와
   * 복사 버튼이 없고, 상세가 발표한 해시·길이를 통과한 문자열만 textContent로
   * 넣는다. 실패는 이 카드에만 머물러 목록·계약·다른 언어를 계속 볼 수 있다.
   */
  function appendRemoteSource(
    card: HTMLElement,
    source: CatalogSource & { readonly sha256: string; readonly byteLength: number },
    generation: number,
    labels: Readonly<{
      loading: string;
      failed: string;
      retry: string;
      diagnostic: string;
    }> = {
      loading: "compare.sourceLoading",
      failed: "compare.sourceLoadFailed",
      retry: "compare.retrySource",
      diagnostic: "remote source",
    },
  ): void {
    const host = element("div", "remote-asset-state");
    host.setAttribute("aria-live", "polite");
    card.append(host);

    const attempt = (): void => {
      host.setAttribute("aria-busy", "true");
      host.replaceChildren(show(t(labels.loading)));
      const request = staticTextLoader.load(
        vendoredAssetManifest(vendoredSourceRoot, {
          path: source.path,
          sha256: source.sha256,
          byteLength: source.byteLength,
        }),
      );
      void settleAssetRequest({
        request,
        generation,
        guard: assetViewGeneration,
        isConnected: () => card.isConnected,
        onSuccess: (loaded) => {
          host.removeAttribute("aria-busy");
          host.replaceChildren(
            loaded.text ? sourceCodeBlock(loaded.text) : show(t("compare.emptySourceContent")),
          );
        },
        onFailure: (error) => {
          console.error(`${labels.diagnostic}를 읽지 못했습니다: ${source.id}`, error);
          host.removeAttribute("aria-busy");
          const message = show(t(labels.failed));
          host.replaceChildren(message, retryButton(attempt, labels.retry));
        },
      });
    };
    attempt();
  }

  const jsonBlock = (value: unknown): HTMLElement => {
    const pre = element("pre", "json-block");
    const code = element("code");
    const text = JSON.stringify(value, null, 2) ?? String(value);
    code.textContent = text;
    pre.tabIndex = 0;
    pre.append(code);
    return codeBlock(pre, text);
  };

  /**
   * 실패 사유는 로케일 키로 받는다. 콘솔 진단은 개발자용이라 화면 언어를 따르지
   * 않고 한국어로 남기고, 상태줄에 찍히는 문구만 고른 언어로 옮긴다.
   */
  function reportBrowserFailure(error: unknown, messageKey: string): void {
    console.error(
      `${uiString(messageKey, "ko")} 원인 유형: ${errorType(error)}`,
      error,
    );
    catalogIndex = null;
    detailCatalog = null;
    detailAlgorithm = null;
    detailAssets = null;
    detailScenario = null;
    try {
      render();
    } catch (renderError: unknown) {
      console.error(
        `오류 화면 렌더링에 실패했습니다. 원인 유형: ${errorType(renderError)}`,
        renderError,
      );
    }
    setStatus(
      () =>
        t("status.dataFailed", {
          message: t(messageKey),
          errorType: errorType(error),
        }),
      "error",
    );
  }

  function selectAlgorithm(
    id: string,
    options: { readonly updateHash?: boolean; readonly scroll?: boolean } = {},
  ): void {
    if (!catalogIndex?.algorithms.some((algorithm) => algorithm.id === id)) {
      throw new Error(`catalog에 없는 algorithmId입니다: ${id}`);
    }
    if (selectedId !== id) activeSpecTab = "overview";
    selectedId = id;
    if (options.updateHash !== false) {
      const nextHash = algorithmHash(id);
      if (window.location.hash !== nextHash) {
        window.history.pushState(null, "", nextHash);
      }
    }
    render();
    focusSelectedDetail(options.scroll !== false);
  }

  function returnToList(): void {
    const listHash = "#list";
    if (window.location.hash !== listHash) {
      window.history.pushState(null, "", listHash);
    }
    render();
    focusListEntry(true);
  }

  /**
   * 읽을거리(소개·생각)로 이동한다. 본문 자체는 셸에 이미 들어 있어 다시 그릴
   * 것이 없고, 화면 전환과 초점만 옮기면 된다.
   *
   * 목록 복귀(returnToList)와 같은 모양으로 둔다 — 해시를 먼저 바꾸고 라우팅을
   * 직접 한 번 태운다. pushState는 hashchange를 발생시키지 않으므로, 여기서
   * 태우지 않으면 주소만 바뀌고 보던 화면이 그대로 남는다.
   */
  function goToDocument(hash: string): void {
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
    render();
    focusDocument(true);
  }

  function algorithmLink(
    algorithm: { readonly id: string; readonly name: string },
    label = displayName(algorithm),
  ): HTMLAnchorElement {
    const link = element("a", "link-button");
    link.href = algorithmHash(algorithm.id);
    link.textContent = label;
    if (algorithm.id === selectedId) link.setAttribute("aria-current", "true");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      try {
        selectAlgorithm(algorithm.id);
      } catch (error: unknown) {
        reportBrowserFailure(error, "error.openDetail");
      }
    });
    return link;
  }

  /** 카드형과 리스트형은 클래스만 다르고 선택·클릭 규칙은 같은 항목을 쓴다. */
  function algorithmEntry(algorithm: CatalogIndexEntry): HTMLElement {
    const rows = listViewMode === "rows";
    const prefix = rows ? "algorithm-row" : "algorithm-card";
    const entry = element("article", prefix);
    entry.tabIndex = -1;
    if (algorithm.id === selectedId) entry.dataset.selected = "true";
    entry.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a, button")) {
        return;
      }
      if (window.getSelection()?.toString()) return;
      try {
        selectAlgorithm(algorithm.id);
      } catch (error: unknown) {
        reportBrowserFailure(error, "error.openDetail");
      }
    });
    // 제목 앵커가 실제 href와 Tab 진입 경로를 겸하므로 하단 링크는 두지 않는다.
    const heading = element("h3");
    const text = element("p", `${prefix}__summary`);
    const meta = element("p", `${prefix}__meta`);
    heading.append(algorithmLink(algorithm));
    text.textContent = algorithm.documentation?.summary ?? algorithm.summary;
    // 구현 언어는 커버리지 화면의 "언어 상태" 열이 상태까지 함께 보여 준다.
    meta.textContent = displayCategory(algorithm.category);
    entry.append(heading, text, meta);
    return entry;
  }

  function applyListView(): void {
    viewCardButton.setAttribute(
      "aria-pressed",
      String(listViewMode === "card"),
    );
    viewRowsButton.setAttribute(
      "aria-pressed",
      String(listViewMode === "rows"),
    );
    list.className =
      listViewMode === "rows" ? "algorithm-rows" : "algorithm-list";
  }

  /**
   * 검색 보조를 못 받았다는 사실은 결과가 좁아진 뒤에야 드러난다. 상태줄로 올리면
   * 목록·상세가 멀쩡한데도 카탈로그가 깨진 것처럼 읽히므로, 검색 중인 목록 안에서만
   * 알리고 다시 받을 길을 함께 준다.
   */
  function searchAidNotice(): HTMLElement | undefined {
    if (searchAidStatus !== "failed" || !search.value.trim()) return undefined;
    const notice = element("div", "search-aid-notice");
    notice.append(
      show(t("list.searchAidFailed")),
      retryButton(() => {
        searchAidStatus = "idle";
        loadSearchAid();
        renderList();
      }, "list.retrySearchAid"),
    );
    return notice;
  }

  function renderList(): void {
    const algorithms = catalogIndex
      ? filterAlgorithms(catalogIndex.algorithms, search.value, category.value)
      : [];
    applyListView();
    list.replaceChildren();
    setResultCount(algorithms.length);
    const notice = searchAidNotice();
    if (notice) list.append(notice);
    if (!algorithms.length) {
      list.append(
        show(catalogIndex ? t("list.emptyFiltered") : t("list.emptyCatalog")),
      );
      return;
    }
    for (const algorithm of algorithms) {
      list.append(algorithmEntry(algorithm));
    }
  }

  /** 보기 전환은 목록만 다시 그리므로 검색어·필터·탭과 토글 초점이 유지된다. */
  function selectListView(mode: ListViewMode): void {
    if (listViewMode === mode) return;
    listViewMode = mode;
    storeListView(mode);
    renderList();
  }

  function appendBulletSection(
    parent: HTMLElement,
    title: string,
    values: readonly string[],
  ): void {
    const section = element("section", "guidance-card");
    const heading = element("h4");
    heading.textContent = title;
    if (!values.length) {
      const empty = element("p", "muted");
      empty.textContent = t("guidance.emptySection");
      section.append(heading, empty);
      parent.append(section);
      return;
    }
    const items = element("ul");
    for (const value of values) {
      const item = element("li");
      item.textContent = value;
      items.append(item);
    }
    section.append(heading, items);
    parent.append(section);
  }

  function missingDocumentationNote(): HTMLParagraphElement {
    return show(
      t("guidance.missingDocumentation", {
        schema: catalogIndex?.schemaVersion ?? "",
      }),
    );
  }

  function buildGuidanceGrid(selected: CatalogAlgorithm): HTMLElement | undefined {
    const documentation = selected.documentation;
    if (!documentation) return undefined;
    const grid = element("div", "guidance-grid");
    appendBulletSection(grid, t("guidance.whenToUse"), documentation.whenToUse);
    appendBulletSection(grid, t("guidance.avoidWhen"), documentation.avoidWhen);
    appendBulletSection(grid, t("guidance.tradeoffs"), documentation.tradeoffs);
    appendBulletSection(grid, t("guidance.pitfalls"), documentation.pitfalls);
    return grid;
  }

  function contractCard(title: string): HTMLElement {
    const card = element("article", "contract-card");
    const heading = element("h5");
    heading.textContent = title;
    card.append(heading);
    return card;
  }

  function emptyNote(message: string): HTMLParagraphElement {
    const note = element("p", "muted");
    note.textContent = message;
    return note;
  }

  /** 필드 묶음을 한 표 안의 행 그룹으로 편다. 구분 셀은 그룹의 첫 행이 rowspan으로 갖는다. */
  function fieldGroupRows(
    body: HTMLElement,
    label: string,
    fields: Readonly<Record<string, unknown>> | undefined,
    format: (value: unknown) => string,
  ): void {
    const entries = fields ? Object.entries(fields) : [];
    if (!entries.length) {
      const row = element("tr");
      row.dataset.groupStart = "true";
      const groupHead = element("th");
      groupHead.scope = "row";
      groupHead.textContent = label;
      const cell = element("td", "muted");
      cell.colSpan = 2;
      cell.textContent = t("contract.emptyFields");
      row.append(groupHead, cell);
      body.append(row);
      return;
    }
    entries.forEach(([name, value], index) => {
      const row = element("tr");
      if (index === 0) {
        // 그룹의 첫 행만 표시해 두면 CSS가 그룹 사이 경계를 강조할 수 있다.
        row.dataset.groupStart = "true";
        const groupHead = element("th");
        groupHead.scope = "rowgroup";
        groupHead.rowSpan = entries.length;
        groupHead.textContent = label;
        row.append(groupHead);
      }
      const nameCell = element("td");
      const nameCode = element("code");
      nameCode.textContent = name;
      nameCell.append(nameCode);
      const valueCell = element("td");
      valueCell.textContent = format(value);
      row.append(nameCell, valueCell);
      body.append(row);
    });
  }

  function contractTableHead(
    labels: readonly string[],
  ): HTMLTableSectionElement {
    const head = element("thead");
    const row = element("tr");
    for (const label of labels) {
      const cell = element("th");
      cell.scope = "col";
      cell.textContent = label;
      row.append(cell);
    }
    head.append(row);
    return head;
  }

  /** 설명 문장은 원문 그대로 노출한다. 타입을 추정해 열을 만들지 않는다. */
  function contractInterfaceTable(
    presentation: CatalogContractPresentation,
  ): HTMLElement {
    const wrap = element("div", "table-wrap contract-table-wrap");
    const table = element("table", "data-table contract-table");
    const body = element("tbody");
    const describe = (value: unknown): string =>
      typeof value === "string" ? value : compactValue(value);
    fieldGroupRows(body, t("contract.input"), presentation.input, describe);
    fieldGroupRows(
      body,
      t("contract.output"),
      presentation.output,
      describe,
    );
    table.append(
      contractTableHead([
        t("contract.columnGroup"),
        t("contract.columnField"),
        t("contract.columnDescription"),
      ]),
      body,
    );
    wrap.append(table);
    return wrap;
  }

  function contractErrorsCard(errors: readonly unknown[]): HTMLElement {
    const card = contractCard(t("contract.errorsTitle"));
    if (!errors.length) {
      card.append(emptyNote(t("contract.emptyErrors")));
      return card;
    }
    const list = element("ul", "error-code-list");
    for (const error of errors) {
      const item = element("li");
      const record = asRecord(error);
      const code = typeof record?.code === "string" ? record.code : undefined;
      const chip = element("code", "error-code");
      chip.textContent = code ?? compactValue(error);
      item.append(chip);
      // code 외 필드를 발행하는 catalog가 나와도 값을 잃지 않는다.
      const extras = record
        ? Object.entries(record).filter(([key]) => key !== "code")
        : [];
      if (code && extras.length) {
        const detail = element("span", "error-code-detail");
        detail.textContent = extras
          .map(
            ([key, value]) =>
              `${key}: ${typeof value === "string" ? value : compactValue(value)}`,
          )
          .join(" · ");
        item.append(detail);
      }
      list.append(item);
    }
    card.append(list);
    return card;
  }

  /**
   * 표에 있는 mutation 값만 옮긴다. 매핑에 없는 값은 임의로 번역하지 않고 원문
   * code 칩만 남긴다 — 계약 값 자체는 어느 언어에서도 식별자 그대로다.
   */
  function contractMutationCard(mutation: string | undefined): HTMLElement {
    const card = contractCard(t("contract.mutationTitle"));
    if (mutation === undefined) {
      card.append(emptyNote(t("contract.emptyMutation")));
      return card;
    }
    const label = optionalUiString(
      `mutation.${mutation}`,
      activeNameLanguage,
    );
    if (label) {
      const text = element("p", "mutation-label");
      text.textContent = label;
      card.append(text);
    }
    const raw = element("p", "mutation-raw");
    const code = element("code");
    code.textContent = mutation;
    raw.append(code);
    card.append(raw);
    return card;
  }

  function contractPreconditionsCard(
    selected: CatalogAlgorithm,
  ): HTMLElement {
    const card = contractCard(t("contract.preconditionsTitle"));
    if (!selected.preconditions.length) {
      card.append(emptyNote(t("contract.emptyPreconditions")));
      return card;
    }
    const list = element("ul", "precondition-list");
    for (const value of selected.preconditions) {
      const item = element("li");
      item.textContent = value;
      list.append(item);
    }
    card.append(list);
    return card;
  }

  /**
   * 첫 벡터의 첫 케이스만 대표 예시로 승격한다. 나머지 케이스는 아래 접힌
   * 목록에 원본 JSON 그대로 남는다.
   */
  function contractExample(
    selected: CatalogAlgorithm,
  ): HTMLElement | undefined {
    const record = asRecord(selected.testVectors[0]?.cases[0]);
    if (!record) return undefined;
    const input = asRecord(record.input);
    const expected = asRecord(record.expected);
    // expected는 output으로 한 겹 감싸여 있다. 그 밖의 형태(error 등)는 통째로 편다.
    const output = expected ? asRecord(expected.output) : undefined;
    const outcome = output ?? expected;
    const outcomeLabel = output
      ? t("contract.expectedOutput")
      : t("contract.expectedResult");
    if (!input && !outcome) return undefined;

    const block = element("section", "example-block");
    const heading = element("h5");
    const caseId =
      typeof record.caseId === "string" ? record.caseId : undefined;
    heading.textContent = caseId
      ? t("contract.exampleTitleWithCase", { caseId })
      : t("contract.exampleTitle");
    const wrap = element("div", "table-wrap contract-table-wrap");
    const table = element("table", "data-table contract-table");
    if (typeof record.description === "string") {
      const caption = element("caption");
      caption.textContent = record.description;
      table.append(caption);
    }
    const body = element("tbody");
    if (input) fieldGroupRows(body, t("contract.input"), input, compactValue);
    if (outcome) fieldGroupRows(body, outcomeLabel, outcome, compactValue);
    table.append(
      contractTableHead([
        t("contract.columnGroup"),
        t("contract.columnField"),
        t("contract.columnValue"),
      ]),
      body,
    );
    wrap.append(table);
    block.append(heading, wrap);
    return block;
  }

  function renderContract(selected: CatalogAlgorithm): HTMLElement {
    const section = element("section", "detail-section");
    const heading = element("h4");
    heading.textContent = t("contract.title");
    const presentation = contractPresentation(selected.contract);
    const grid = element("div", "contract-grid");
    grid.append(
      contractErrorsCard(presentation.errors),
      contractMutationCard(presentation.mutation),
      contractPreconditionsCard(selected),
    );
    section.append(heading);
    if (presentation.empty) {
      section.append(show(t("contract.emptyMetadata")));
    }
    if (presentation.input || presentation.output) {
      section.append(contractInterfaceTable(presentation));
    }
    section.append(grid);
    if (Object.keys(presentation.opaque).length) {
      const opaque = element("section", "contract-opaque");
      const opaqueHeading = element("h5");
      opaqueHeading.textContent = t("contract.opaqueTitle");
      // 확장 metadata도 HTML로 해석하지 않고 공용 jsonBlock의 textContent 경계만
      // 거쳐 그대로 보여 준다.
      opaque.append(opaqueHeading, jsonBlock(presentation.opaque));
      section.append(opaque);
    }
    const example = contractExample(selected);
    if (example) section.append(example);
    return section;
  }

  function appendTestCases(parent: HTMLElement, cases: readonly unknown[]): void {
    cases.forEach((testCase, index) => {
      const card = element("article", "test-case");
      const caseHeading = element("h5");
      const caseRecord =
        typeof testCase === "object" &&
        testCase !== null &&
        !Array.isArray(testCase)
          ? (testCase as Record<string, unknown>)
          : undefined;
      caseHeading.textContent =
        typeof caseRecord?.caseId === "string"
          ? caseRecord.caseId
          : t("tests.caseFallback", { number: index + 1 });
      card.append(caseHeading);
      if (typeof caseRecord?.description === "string") {
        const description = element("p", "muted");
        description.textContent = caseRecord.description;
        card.append(description);
      }
      // JSON 문자열을 HTML로 해석하지 않고 textContent를 쓰는 jsonBlock만 거친다.
      card.append(jsonBlock(testCase));
      parent.append(card);
    });
  }

  function remoteVectorDisclosure(
    manifest: CatalogVectorManifest,
    generation: number,
  ): HTMLDetailsElement {
    const disclosure = element("details", "test-vector");
    const summary = element("summary");
    const host = element("div", "remote-asset-state");
    summary.textContent = t("tests.vectorSummary", {
      id: manifest.id,
      count: manifest.caseCount,
    });
    host.setAttribute("aria-live", "polite");
    disclosure.append(summary, host);
    let requested = false;

    const attempt = (): void => {
      requested = true;
      host.setAttribute("aria-busy", "true");
      host.replaceChildren(show(t("tests.vectorLoading")));
      const request = staticTextLoader
        .load(vendoredAssetManifest(vendoredVectorRoot, manifest))
        .then((loaded) => parseVerifiedVector(loaded, manifest));
      void settleAssetRequest({
        request,
        generation,
        guard: assetViewGeneration,
        isConnected: () => disclosure.isConnected,
        onSuccess: (loaded) => {
          host.removeAttribute("aria-busy");
          host.replaceChildren();
          appendTestCases(host, loaded.vector.cases);
          if (!loaded.vector.cases.length) host.append(show(t("tests.emptyCases")));
        },
        onFailure: (error) => {
          console.error(`테스트 벡터를 읽지 못했습니다: ${manifest.id}`, error);
          host.removeAttribute("aria-busy");
          host.replaceChildren(
            show(t("tests.vectorLoadFailed")),
            retryButton(attempt, "tests.retryVector"),
          );
        },
      });
    };

    disclosure.addEventListener("toggle", () => {
      // 접힌 manifest 요약만 보는 동안에는 네트워크 요청을 만들지 않는다.
      if (disclosure.open && !requested) attempt();
    });
    return disclosure;
  }

  function renderTestVectors(selected: CatalogAlgorithm): HTMLElement {
    const section = element("section", "detail-section");
    const heading = element("h4");
    heading.textContent = t("tests.title");
    section.append(heading);

    if (selected.vectorIds) {
      const manifests = detailCatalog
        ? vectorsForAlgorithm(detailCatalog, selected)
        : [];
      if (!manifests.length) section.append(show(t("tests.emptyVectors")));
      for (const manifest of manifests) {
        section.append(
          remoteVectorDisclosure(manifest, currentAssetViewGeneration),
        );
      }
      return section;
    }

    if (!selected.testVectors.length) {
      section.append(show(t("tests.emptyVectors")));
      return section;
    }
    for (const vector of selected.testVectors) {
      const disclosure = element("details", "test-vector");
      const summary = element("summary");
      summary.textContent = t("tests.vectorSummary", {
        id: vector.id,
        count: vector.cases.length,
      });
      disclosure.append(summary);
      appendTestCases(disclosure, vector.cases);
      section.append(disclosure);
    }
    return section;
  }

  function buildMetrics(selected: CatalogAlgorithm): HTMLElement {
    const metrics = element("dl", "metrics");
    const metricRows: readonly (readonly [string, string])[] = [
      [t("metrics.time"), selected.complexity.time],
      [t("metrics.space"), selected.complexity.space],
      [t("metrics.vectors"), String(selected.coverage.vectorCount)],
      [t("metrics.cases"), String(selected.coverage.caseCount)],
    ];
    for (const [label, value] of metricRows) {
      const dt = element("dt");
      const dd = element("dd");
      dt.textContent = label;
      dd.textContent = value;
      metrics.append(dt, dd);
    }
    return metrics;
  }

  function buildAlternatives(
    selected: CatalogAlgorithm,
  ): HTMLElement | undefined {
    // 대안은 다른 종을 가리키므로 상세 한 장이 아니라 인덱스에서 이름을 찾는다.
    const alternatives = resolveAlternativeAlgorithms(
      selected,
      catalogIndex?.algorithms ?? [],
    );
    if (!alternatives.length) return undefined;
    const section = element("section", "alternatives");
    const heading = element("h4");
    const alternativeList = element("ul", "alternative-list");
    heading.textContent = t("alternatives.title");
    for (const alternative of alternatives) {
      const item = element("li");
      item.append(algorithmLink(alternative));
      alternativeList.append(item);
    }
    section.append(heading, alternativeList);
    return section;
  }

  /**
   * 사용 시나리오. 인자가 id가 아니라 값인 것은 의도다 — 출처가 프론트 로컬 표에서
   * 카탈로그 종별 자산으로 옮겨온 뒤에도 이 함수는 그대로다. 출처를 아는 자리는
   * 아래 mount 하나뿐이다. 시나리오가 없는 알고리즘에서는 섹션을 아예 만들지 않는다.
   */
  function buildScenario(story: ScenarioStory | undefined): HTMLElement | undefined {
    if (!story?.steps.length) return undefined;
    const section = element("section", "detail-section scenario");
    const heading = element("h4");
    heading.textContent = t("scenario.title");
    const steps = element("div", "scenario-steps");
    for (const step of story.steps) {
      const stepBlock = element("section", "scenario-step");
      const stepHeading = element("h5");
      stepHeading.textContent = t(scenarioStepLabelKeys[step.kind]);
      stepBlock.append(stepHeading);
      for (const paragraph of step.body) {
        const copy = element("p");
        copy.textContent = paragraph;
        stepBlock.append(copy);
      }
      steps.append(stepBlock);
    }
    section.append(heading, steps);
    return section;
  }

  /**
   * 사용 시나리오 자산의 자리. 자산은 상세보다 한 요청 뒤에 오므로 개요를 그리는
   * 시점에는 빈 자리만 만들고, 도착하면 그 자리에서 채운다. 상세 렌더 전체를 자산에
   * 묶으면 종을 여는 체감이 왕복 두 번으로 늘어나므로 그렇게 하지 않는다.
   *
   * 그리지 않는 경우가 둘이다. 상세의 assets가 비어 있으면 그 종에는 자산이 없는
   * 것이라 자리조차 만들지 않고, 받다가 실패하면 자리를 비워 둔다. 어느 쪽도 개요의
   * 나머지를 막지 않고, 오류 문구도 세우지 않는다 — 시나리오는 부가 산문이라 없다고
   * 해서 화면이 못 쓰게 되지 않는다. 진단만 콘솔에 남긴다(오류 등급은 쓰지 않는다).
   */
  function buildScenarioMount(
    selected: CatalogAlgorithm,
    generation: number,
  ): HTMLElement | undefined {
    const manifest = detailAssets ? usageScenarioManifest(detailAssets) : undefined;
    if (!manifest) return undefined;
    const mount = element("div", "scenario-mount");
    const paint = (story: ScenarioStory): void => {
      const section = buildScenario(story);
      if (section) mount.replaceChildren(section);
    };
    if (detailScenario) {
      paint(detailScenario);
      return mount;
    }
    void settleAssetRequest({
      request: staticJsonLoader
        .load(manifest)
        .then((json) => parseUsageScenario(json.value, selected.id)),
      generation,
      guard: assetViewGeneration,
      isConnected: () => mount.isConnected,
      onSuccess: (story) => {
        detailScenario = story;
        paint(story);
      },
      onFailure: (error) => {
        console.debug(
          `사용 시나리오 자산을 읽지 못해 그 영역을 비웁니다: ${manifest.path}`,
          error,
        );
        mount.replaceChildren();
      },
    });
    return mount;
  }

  /**
   * 공식 벡터와 언어-local 기본 테스트는 서로 다른 검증 축이다. 한 문자열로 합쳐
   * "passing"만 보이면 무엇을 통과했는지 알 수 없으므로 상태와 세 집계를 한 칸에
   * 명시하고 두 열로 나눈다.
   */
  function verificationSummaryText(
    summary: CatalogVerificationSummary,
  ): string {
    return t("compare.verificationSummary", {
      status: t(`verificationStatus.${summary.status}`),
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
    });
  }

  function legacyVectorVerification(
    language: CatalogLanguage,
  ): CatalogVerificationSummary {
    return (
      language.vectorVerification ?? {
        status: language.verification,
        passed: language.testSummary.passed,
        failed: language.testSummary.failed,
        skipped: language.testSummary.skipped,
      }
    );
  }

  function appendCatalogSource(
    parent: HTMLElement,
    source: CatalogSource,
    generation: number,
  ): void {
    if (isEmbeddedCatalogSource(source) && source.content) {
      parent.append(sourceCodeBlock(source.content));
    } else if (isRemoteCatalogSource(source)) {
      appendRemoteSource(parent, source, generation);
    } else if (isEmbeddedCatalogSource(source)) {
      parent.append(show(t("compare.emptySourceContent")));
    } else {
      parent.append(show(t("compare.noPublishedSource")));
    }
  }

  /** primary와 companion을 독립 카드로 만들어 한 파일 실패가 옆 파일을 가리지 않는다. */
  function sourceFileGroup(
    group: CatalogFileGroup,
    generation: number,
  ): HTMLElement {
    const list = element("div", "source-file-list");
    for (const source of group.files) {
      const file = element("section", "source-file");
      const heading = element("h5");
      const meta = element("p", "source-path");
      heading.textContent =
        source.path === group.primaryFile
          ? t("compare.primaryFile")
          : t("compare.companionFile");
      meta.textContent = source.path;
      file.append(heading, meta);
      appendCatalogSource(file, source, generation);
      list.append(file);
    }
    return list;
  }

  /**
   * 카드 격자에 놓을 순서. 표시 순서만 정하고, 위 언어별 표가 쓰는 카탈로그 자리
   * 순서는 건드리지 않는다.
   */
  function sourceCardOrder(
    languages: readonly CatalogLanguage[],
  ): readonly CatalogLanguage[] {
    const rank = (language: CatalogLanguage): number => {
      const index = sourceCardLanguageOrder.indexOf(language.language);
      return index === -1 ? sourceCardLanguageOrder.length : index;
    };
    const fallback = sortedLanguages(languages);
    return [...fallback].sort((left, right) => rank(left) - rank(right));
  }

  function implementationSourceCard(
    selected: CatalogAlgorithm,
    language: CatalogLanguage,
    generation: number,
  ): HTMLElement {
    // 상세를 받아 만든 1종짜리 2.0 문서다. 소스 조회 경로는 2.0 때와 같다.
    const catalog = detailCatalog;
    if (!catalog) return show(t("compare.missingCatalog"));
    const group = sourceGroupForLanguage(catalog, language);
    const bundled = isBundledSource(catalog, language);
    const card = element("article", "source-card");
    if (language.language === fullWidthSourceCardLanguage) {
      card.classList.add("source-card--full");
    }
    const cardHeading = element("h4");
    const meta = element("p", "source-path");
    cardHeading.textContent = language.language;
    meta.textContent = bundled
      ? `${language.entryPoint} · ${t("bundled.label")}`
      : language.entryPoint;
    card.append(cardHeading, meta);

    if (bundled) {
      card.append(show(t("bundled.cardNote")));
    } else if (group) {
      const sourceHeading = element("h5", "file-group-heading");
      sourceHeading.textContent = t("compare.sourceGroupTitle");
      card.append(sourceHeading, sourceFileGroup(group, generation));
    } else {
      card.append(show(t("compare.noPublishedSource")));
    }

    // 언어별 기본 테스트 영역은 두지 않는다. 공개 스냅샷에는 게시된 기본 테스트가
    // 한 건도 없어 자리마다 "작성 예정"만 찍혔고, 그것은 카드가 나를 정보가 아니다.
    // 계약을 실제로 지키는지는 공식 벡터가 확인하고, 그 결과는 위 표의 검증 열과
    // JavaScript 카드의 실행기가 보여 준다.

    // 실행기는 JavaScript 카드에만 붙는다. 브라우저가 그대로 돌릴 수 있는 언어가
    // 그것뿐이라, 다른 카드에 자리만 만들어 두면 못 쓰는 버튼이 남는다.
    if (
      language.language === fullWidthSourceCardLanguage &&
      !bundled &&
      group
    ) {
      const runner = buildVectorRunner(selected, group, generation);
      if (runner) card.append(runner);
    }
    return card;
  }

  /**
   * 벡터 실행기. 검증을 통과해 받아 둔 소스 바이트와 공식 벡터 케이스를 워커로 넘겨
   * 실제로 돌리고, 케이스가 선언한 기대값과 대조한 판정을 그 자리에 남긴다.
   *
   * 소스와 벡터 모두 화면이 이미 쓰는 검증 로더를 그대로 부른다. 로더가 경로+해시로
   * 캐시하므로 요청이 늘지 않고, 검증을 건너뛰는 우회 경로도 생기지 않는다.
   */
  function buildVectorRunner(
    selected: CatalogAlgorithm,
    group: CatalogFileGroup,
    generation: number,
  ): HTMLElement | undefined {
    const adapter = javaScriptAdapter(selected.id);
    const catalog = detailCatalog;
    if (!adapter || !catalog) return undefined;
    const primary = group.files.find((file) => file.path === group.primaryFile);
    const vectorManifest = vectorsForAlgorithm(catalog, selected)[0];
    if (!primary?.sha256 || primary.byteLength === undefined || !vectorManifest) {
      return undefined;
    }
    const sourceManifest = {
      path: primary.path,
      sha256: primary.sha256,
      byteLength: primary.byteLength,
    };

    const section = element("section", "source-run");
    const heading = element("h5", "file-group-heading");
    const intro = element("p", "muted");
    heading.textContent = t("run.title");
    intro.textContent = t("run.intro", { timeout: runTimeoutSeconds });
    section.append(heading, intro);

    const controls = element("div", "source-run__controls");
    const caseLabel = element("label", "source-run__field");
    const caseLabelText = element("span");
    const caseSelect = element("select");
    caseLabelText.textContent = t("run.caseLabel");
    caseLabel.append(caseLabelText, caseSelect);
    const inputLabel = element("label", "source-run__field");
    const inputLabelText = element("span");
    const inputArea = element("textarea");
    inputLabelText.textContent = t("run.inputLabel");
    // 기본 높이만 여기서 정한다. 케이스마다 JSON 길이가 달라 딱 맞는 값이 없으므로
    // 나머지는 사용자가 세로로 끌어 조절한다(styles.css의 resize·min-height).
    inputArea.rows = 8;
    inputArea.spellcheck = false;
    inputLabel.append(inputLabelText, inputArea);
    controls.append(caseLabel, inputLabel);

    const actions = element("div", "source-run__actions");
    const runButton = element("button", "source-retry-button");
    const resetButton = element("button", "source-retry-button");
    runButton.type = "button";
    resetButton.type = "button";
    runButton.textContent = t("run.run");
    resetButton.textContent = t("run.reset");
    actions.append(runButton, resetButton);

    const result = element("div", "source-run__result");
    result.setAttribute("aria-live", "polite");
    section.append(controls, actions, result);

    // 자산이 도착하기 전에는 조작을 막는다. 빈 값으로 눌러 실패를 보여 주는 것보다
    // 누를 수 없는 편이 상태를 정직하게 드러낸다.
    caseSelect.disabled = true;
    runButton.disabled = true;
    resetButton.disabled = true;
    result.replaceChildren(show(t("run.loading")));

    let sourceText = "";
    let cases: readonly VectorCase[] = [];

    const selectedCase = (): VectorCase | undefined =>
      cases[Number(caseSelect.value)];

    const fillInput = (): void => {
      const current = selectedCase();
      inputArea.value = current
        ? JSON.stringify(current.input, null, 2)
        : "";
    };

    const paintVerdict = (
      current: VectorCase,
      outcome: RunOutcome,
      edited: boolean,
    ): void => {
      const verdict = judgeCase(current.expected, outcome);
      const badge = element("span", "status-badge");
      const summary = element("p", "source-run__verdict");
      // 배지 색은 기존 상태 배지 어휘를 그대로 빌린다. 새 색을 만들지 않는다.
      const badgeStatus =
        verdict.kind === "passed"
          ? "approved"
          : verdict.kind === "failed"
            ? "rejected"
            : "pending";
      badge.dataset.status = badgeStatus;
      badge.textContent = t(`run.verdict.${verdict.kind}`);
      summary.append(badge);
      // 입력을 고쳐 돌렸으면 기대값 대조는 참고일 뿐이다. 그 사실을 함께 밝힌다.
      if (edited) {
        const note = element("span", "source-run__note");
        note.textContent = t("run.editedNote");
        summary.append(note);
      }
      // 기대값과 실행 결과는 대조하라고 있는 두 값이라 좌우로 나란히 세운다.
      // 한 칸은 제목 + 본문 두 줄짜리 격자이고, 두 칸이 같은 격자 행에 서기 때문에
      // 본문 높이가 서로 달라도 칸 자체는 같은 높이로 맞춰진다. 좁은 화면에서는
      // 칸이 접혀 위아래로 쌓인다(styles.css의 .source-run__panes).
      const pane = (label: string, ...content: readonly HTMLElement[]) => {
        const host = element("div", "source-run__pane");
        const heading = element("p", "source-run__block-label");
        heading.textContent = label;
        host.append(heading, ...content);
        return host;
      };

      const expectedPane = pane(
        t("run.expected"),
        jsonBlock(
          "error" in current.expected
            ? { error: current.expected.error }
            : { output: current.expected.output },
        ),
      );

      let actualBody: HTMLElement;
      if (outcome.status === "output") {
        actualBody = jsonBlock({ output: outcome.output });
      } else if (outcome.status === "error") {
        actualBody = jsonBlock({
          error: { code: outcome.code || null, message: outcome.message },
        });
      } else if (outcome.status === "timeout") {
        actualBody = show(t("run.timeoutDetail", { timeout: runTimeoutSeconds }));
      } else if (outcome.status === "missing-export") {
        actualBody = show(t("run.missingExport", { name: outcome.name }));
      } else {
        actualBody = show(t("run.crashedDetail", { message: outcome.message }));
      }

      const panes = element("div", "source-run__panes");
      panes.append(expectedPane, pane(t("run.actual"), actualBody));
      result.replaceChildren(summary, panes);
    };

    const attemptRun = (): void => {
      const current = selectedCase();
      if (!current) return;
      let input: Record<string, unknown>;
      let edited = false;
      try {
        const raw: unknown = JSON.parse(inputArea.value);
        if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
          throw new TypeError("입력 JSON 루트는 객체여야 합니다.");
        }
        input = raw as Record<string, unknown>;
        edited =
          JSON.stringify(input) !== JSON.stringify(current.input);
      } catch {
        // 사용자가 고친 JSON이 깨진 것은 실행 실패가 아니다. 워커를 띄우지 않고
        // 그 자리에서만 알린다.
        result.replaceChildren(show(t("run.invalidInput")));
        return;
      }
      runButton.disabled = true;
      result.replaceChildren(show(t("run.running")));
      void runJavaScriptCase({ source: sourceText, adapter, input })
        .then((outcome) => {
          if (!section.isConnected || !assetViewGeneration.isCurrent(generation)) {
            return;
          }
          paintVerdict(current, outcome, edited);
        })
        .finally(() => {
          runButton.disabled = false;
        });
    };

    caseSelect.addEventListener("change", () => {
      fillInput();
      result.replaceChildren(show(t("run.ready")));
    });
    runButton.addEventListener("click", attemptRun);
    resetButton.addEventListener("click", () => {
      fillInput();
      result.replaceChildren(show(t("run.ready")));
    });

    const ready = Promise.all([
      staticTextLoader.load(
        vendoredAssetManifest(vendoredSourceRoot, sourceManifest),
      ),
      staticTextLoader
        .load(vendoredAssetManifest(vendoredVectorRoot, vectorManifest))
        .then((loaded) => parseVerifiedVector(loaded, vectorManifest)),
    ]).then(([loadedSource, loadedVector]) => {
      sourceText = loadedSource.text;
      cases = loadedVector.vector.cases
        .map((item) => parseVectorCase(item))
        .filter((item): item is VectorCase => item !== undefined);
      if (!cases.length) throw new Error("실행할 수 있는 벡터 케이스가 없습니다.");
    });

    void settleAssetRequest({
      request: ready,
      generation,
      guard: assetViewGeneration,
      isConnected: () => section.isConnected,
      onSuccess: () => {
        caseSelect.replaceChildren(
          ...cases.map((item, index) => {
            const option = new Option(
              item.description
                ? `${item.caseId} — ${item.description}`
                : item.caseId,
              String(index),
            );
            return option;
          }),
        );
        caseSelect.disabled = false;
        runButton.disabled = false;
        resetButton.disabled = false;
        fillInput();
        result.replaceChildren(show(t("run.ready")));
      },
      onFailure: (error) => {
        console.error(`벡터 실행기를 준비하지 못했습니다: ${selected.id}`, error);
        result.replaceChildren(show(t("run.setupFailed")));
      },
    });

    return section;
  }

  /**
   * 언어별 표와 정본 파일 묶음. 2.0의 source/basicTest는 algorithm 객체 안에
   * 중첩되지만, 레거시 sourceId도 한 파일짜리 group으로 올려 기존 UX를 유지한다.
   */
  function buildComparison(
    selected: CatalogAlgorithm,
    headingLevel: "h3" | "h4" = "h3",
  ): readonly HTMLElement[] {
    const catalog = detailCatalog;
    if (!catalog) return [];
    const tableWrap = element("div", "table-wrap");
    const table = element("table", "data-table");
    const head = element("thead");
    const row = element("tr");
    [
      t("compare.columnLanguage"),
      t("compare.columnStatus"),
      t("compare.columnVectorVerification"),
      t("compare.columnEntryPoint"),
      t("compare.columnSource"),
    ].forEach((label) => {
      const th = element("th");
      th.textContent = label;
      row.append(th);
    });
    head.append(row);
    const body = element("tbody");
    // 계획(R)은 표에도 서지 않는다. 아래 카드 격자와 같은 조건이라 표에 있는 언어와
    // 카드가 있는 언어가 어긋나지 않는다.
    for (const language of operationalLanguages(
      sortedLanguages(selected.languages),
    )) {
      const group = sourceGroupForLanguage(catalog, language);
      const bundled = isBundledSource(catalog, language);
      const vectorSummary = legacyVectorVerification(language);
      const tr = element("tr");
      [
        language.language,
        implementationStatusText(language.implementationStatus),
        verificationSummaryText(vectorSummary),
        language.entryPoint,
        // 번들 통짜의 경로는 열람 안내가 되지 못하므로 아예 싣지 않는다.
        bundled
          ? t("bundled.note")
          : (group?.primaryFile ?? t("compare.sourceUnpublished")),
      ].forEach((value) => {
        const td = element("td");
        td.textContent = value;
        tr.append(td);
      });
      body.append(tr);
    }
    table.append(head, body);
    tableWrap.append(table);

    const heading = element(headingLevel, "subheading");
    heading.textContent = t("compare.sourcesTitle");
    const sourceGrid = element("div", "source-grid");
    // 계획(R)은 아직 만들지 않은 구현이라 보여 줄 소스가 없다. 카드를 만들면
    // "소스가 게시되지 않은 구현" 안내가 붙어 구현된 것처럼 읽힌다.
    for (const language of operationalLanguages(
      sourceCardOrder(selected.languages),
    )) {
      sourceGrid.append(
        implementationSourceCard(selected, language, currentAssetViewGeneration),
      );
    }
    return [tableWrap, heading, sourceGrid];
  }

  function overviewContent(
    selected: CatalogAlgorithm,
  ): readonly HTMLElement[] {
    const nodes: HTMLElement[] = [];
    const lead = element("p", "lead-copy");
    const meta = element("p", "muted");
    lead.textContent = selected.documentation?.summary ?? selected.summary;
    const classification = `${displayCategory(selected.category)} / ${displayFamily(selected.family)}`;
    meta.textContent = selected.documentation
      ? `${selected.summary} (${classification})`
      : classification;
    nodes.push(lead, meta);
    const grid = buildGuidanceGrid(selected);
    nodes.push(grid ?? missingDocumentationNote());
    const alternatives = buildAlternatives(selected);
    if (alternatives) nodes.push(alternatives);
    // 시나리오는 개요의 맨 아래에 선다. 격자의 불릿을 다 읽은 뒤 "그래서 내
    // 상황에서는" 으로 넘어가는 순서라, 위로 올리면 요약과 겹쳐 읽힌다.
    const scenario = buildScenarioMount(selected, currentAssetViewGeneration);
    if (scenario) nodes.push(scenario);
    return nodes;
  }

  function specContent(selected: CatalogAlgorithm): readonly HTMLElement[] {
    return [
      buildMetrics(selected),
      renderContract(selected),
      renderTestVectors(selected),
    ];
  }

  function implementationContent(
    selected: CatalogAlgorithm,
  ): readonly HTMLElement[] {
    if (!detailCatalog) return [show(t("compare.missingCatalog"))];
    return buildComparison(selected, "h4");
  }

  function specTabContent(
    selected: CatalogAlgorithm,
    tab: SpecTabId,
  ): readonly HTMLElement[] {
    if (tab === "overview") return overviewContent(selected);
    if (tab === "spec") return specContent(selected);
    return implementationContent(selected);
  }

  /**
   * 탭 상태는 해시에 남기지 않는다. 상세에 들어올 때와 선택이 바뀔 때 개요로
   * 되돌아가고, 언어·테마 전환처럼 화면이 그대로인 다시 그리기에서는 유지된다.
   */
  function renderSpecTabs(selected: CatalogAlgorithm): HTMLElement {
    const wrapper = element("div", "spec-tabs");
    const tablist = element("div", "spec-tablist");
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute(
      "aria-label",
      t("specTab.listLabel", { name: displayName(selected) }),
    );
    const buttons: HTMLButtonElement[] = [];
    const panels: HTMLElement[] = [];
    const renderedTabs = new Set<SpecTabId>();

    const ensurePanelContent = (
      definition: SpecTabDefinition,
      panel: HTMLElement,
    ): void => {
      if (renderedTabs.has(definition.id)) return;
      panel.append(...specTabContent(selected, definition.id));
      renderedTabs.add(definition.id);
    };

    const applyActiveTab = (): void => {
      specTabDefinitions.forEach((definition, index) => {
        const button = buttons[index];
        const panel = panels[index];
        if (!button || !panel) return;
        const active = definition.id === activeSpecTab;
        if (active) ensurePanelContent(definition, panel);
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
        panel.hidden = !active;
      });
    };

    specTabDefinitions.forEach((definition) => {
      const tabId = `spec-tab-${definition.id}`;
      const panelId = `spec-panel-${definition.id}`;
      const button = element("button", "spec-tab");
      button.type = "button";
      button.id = tabId;
      button.textContent = t(definition.labelKey);
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", panelId);
      button.addEventListener("click", () => {
        activeSpecTab = definition.id;
        applyActiveTab();
      });
      const panel = element("section", "spec-panel");
      panel.id = panelId;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tabId);
      panel.tabIndex = 0;
      buttons.push(button);
      panels.push(panel);
      tablist.append(button);
    });

    tablist.addEventListener("keydown", (event) => {
      const current = specTabDefinitions.findIndex(
        (definition) => definition.id === activeSpecTab,
      );
      const last = specTabDefinitions.length - 1;
      let next = -1;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = current >= last ? 0 : current + 1;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = current <= 0 ? last : current - 1;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = last;
      }
      if (next < 0) return;
      const definition = specTabDefinitions[next];
      const button = buttons[next];
      if (!definition || !button) return;
      event.preventDefault();
      activeSpecTab = definition.id;
      applyActiveTab();
      button.focus();
    });

    applyActiveTab();
    wrapper.append(tablist, ...panels);
    return wrapper;
  }

  /**
   * 상세 본문. 인덱스만으로는 그릴 수 없으므로 진입 시점에 algorithms/<id>.json을
   * 받아 인덱스 항목과 합친다. 요청은 소스·벡터와 같은 세대 가드를 타므로, 느린 옛
   * 선택의 응답이 뒤늦게 도착해도 이미 다른 종을 보고 있는 화면을 덮지 않는다.
   *
   * 선택이 없어서 그릴 것이 없는 상태("데이터 없음")와 받아 오지 못한 상태("로드
   * 실패")는 서로 다른 문구로 가른다. 실패는 카드 안에 머물고 목록·커버리지·피드백
   * 화면은 그대로 뜬다.
   */
  function renderDetailBody(
    entry: CatalogIndexEntry,
    body: HTMLElement,
    generation: number,
  ): void {
    if (detailAlgorithm && detailAlgorithm.id !== entry.id) {
      detailAlgorithm = null;
      detailCatalog = null;
      detailAssets = null;
      detailScenario = null;
    }
    const loaded = detailAlgorithm;
    if (loaded) {
      // 분류를 가리지 않고 개요·추상 스펙·구현 세 탭이 상세의 전부다.
      body.removeAttribute("aria-busy");
      body.replaceChildren(renderSpecTabs(loaded));
      return;
    }
    const index = catalogIndex;
    body.setAttribute("aria-busy", "true");
    body.replaceChildren(show(t("detail.loading")));
    const request = index
      ? staticJsonLoader
          .load(entry.detail)
          .then((json) => parseCatalogDetail(json.value, entry, index))
      : Promise.reject(new Error("catalog index unavailable"));
    void settleAssetRequest({
      request,
      generation,
      guard: assetViewGeneration,
      isConnected: () => body.isConnected,
      onSuccess: (parsed) => {
        detailAlgorithm = parsed.algorithm;
        detailCatalog = parsed.document;
        detailAssets = parsed.assets;
        body.removeAttribute("aria-busy");
        body.replaceChildren(renderSpecTabs(parsed.algorithm));
      },
      onFailure: (error) => {
        console.error(
          `알고리즘 상세를 읽지 못했습니다: ${entry.detail.path}`,
          error,
        );
        body.removeAttribute("aria-busy");
        body.replaceChildren(
          show(t("detail.loadFailed")),
          retryButton(
            () => renderDetailBody(entry, body, generation),
            "detail.retry",
          ),
        );
      },
    });
  }

  function renderDetail(selected: CatalogIndexEntry | undefined): void {
    currentAssetViewGeneration = assetViewGeneration.begin();
    detail.replaceChildren();
    if (!selected) {
      detail.append(show(t("detail.empty")));
      return;
    }
    // 공유 링크는 주소창 해시와 목록의 제목 앵커가 이미 제공한다.
    const title = element("h3");
    title.textContent = displayName(selected);
    title.tabIndex = -1;
    title.setAttribute("data-detail-heading", "true");
    const body = element("div", "detail-body");
    body.setAttribute("aria-live", "polite");
    detail.append(title, body);
    // 목록 화면에서는 상세 패널이 숨어 있다. 보이지도 않는 패널 때문에 첫 로드가
    // 상세 파일까지 받으면 인덱스만 받는다는 분할의 뜻이 없어진다. 상세는 실제로
    // 그 화면에 들어갈 때만 요청한다.
    if (screen !== "detail") {
      body.replaceChildren(show(t("detail.empty")));
      return;
    }
    renderDetailBody(selected, body, currentAssetViewGeneration);
  }

  /**
   * 언어 상태 칩. 보이는 글자는 언어명이고 상태는 색과 기호가 나른다.
   * 화면 낭독에는 "언어명 상태" 로 이어지도록 보조 텍스트를 뒤에 붙인다.
   */
  function implementationStatusChip(
    status: ImplementationStatus,
    label: string,
    spokenStatus?: string,
    options: { readonly bundled?: boolean } = {},
  ): HTMLElement {
    const chip = element("span", "coverage-status");
    chip.dataset.status = status;
    // 번들 여부는 구현 상태와 다른 축이라 상태를 덮지 않고 따로 표시한다.
    if (options.bundled) chip.dataset.source = "bundled";
    const mark = element("span", "coverage-status__mark");
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = options.bundled
      ? bundledSourceMark
      : implementationStatusMarks[status];
    const text = element("span");
    text.textContent = label;
    chip.append(mark, text);
    if (spokenStatus) {
      const spoken = element("span", "visually-hidden");
      spoken.textContent = ` ${spokenStatus}`;
      chip.append(spoken);
    }
    return chip;
  }

  /**
   * 번들(러너 통짜) 판정은 sourceId 공유 여부 하나만 본다. 2.1 인덱스 항목의 언어에는
   * sourceId 자체가 없어 목록 층에서는 언제나 false이고, 상세를 받은 뒤 구현 탭에서만
   * 실제 판정이 걸린다. 판정과 ◫ 표시를 남겨 두는 이유는 공유 소스가 다시 생겼을 때
   * "구현됨"으로 뭉뚱그리지 않고 다시 구분해 주기 위해서다.
   */
  function bundledLanguage(
    language: CatalogLanguageStatus & { readonly sourceId?: string },
  ): boolean {
    const catalog = detailCatalog;
    return catalog !== null && isBundledSource(catalog, language);
  }

  /**
   * "언어 상태" 열. 실제로 돌아가는 구현만 싣는다 — 상태가 한 종류뿐이라 기호를
   * 풀어 주던 범례는 설명할 것이 없어져 함께 걷었고, 상태 낭독은 칩 안의 보조
   * 텍스트가 그대로 나른다.
   */
  function coverageStatusCell(algorithm: CatalogListEntry): HTMLElement {
    const cell = element("td");
    const shown = operationalLanguages(
      sortedLanguages<CatalogLanguageStatus>(algorithm.languages),
    );
    if (!shown.length) {
      cell.textContent = t("coverage.noLanguages");
      return cell;
    }
    const statuses = element("ul", "coverage-status-list");
    for (const language of shown) {
      const item = element("li");
      const bundled = bundledLanguage(language);
      const spoken = implementationStatusText(language.implementationStatus);
      item.append(
        implementationStatusChip(
          language.implementationStatus,
          language.language,
          bundled ? `${spoken} · ${t("bundled.label")}` : spoken,
          { bundled },
        ),
      );
      statuses.append(item);
    }
    cell.append(statuses);
    return cell;
  }

  /**
   * 커버리지 표는 상세를 한 장도 받지 않고 그린다. 다섯 수치는 인덱스 항목이 자리
   * 문자열로 들고 오고, 파서가 그것을 풀어 준다.
   */
  function renderMatrix(): void {
    matrix.replaceChildren();
    if (!catalogIndex || !catalogIndex.algorithms.length) {
      matrix.append(show(t("coverage.empty")));
      return;
    }
    const table = element("table", "data-table");
    const head = element("thead");
    const row = element("tr");
    const coverageColumns = [
      t("coverage.columnAlgorithm"),
      t("coverage.columnVectors"),
      t("coverage.columnCases"),
      t("coverage.columnVerifiedLanguages"),
      t("coverage.columnMissingBasicTests"),
      t("coverage.columnReleaseReadyLanguages"),
      t("coverage.columnLanguageStatus"),
    ];
    coverageColumns.forEach((label) => {
      const th = element("th");
      th.textContent = label;
      row.append(th);
    });
    head.append(row);
    const body = element("tbody");
    for (const algorithm of catalogIndex.algorithms) {
      const tr = element("tr");
      const algorithmCell = element("td");
      algorithmCell.append(algorithmLink(algorithm));
      tr.append(algorithmCell);
      const coverageValues = [
        String(algorithm.coverage.vectorCount),
        String(algorithm.coverage.caseCount),
        String(algorithm.coverage.verifiedLanguages),
        String(algorithm.coverage.missingBasicTests),
        String(algorithm.coverage.releaseReadyLanguages),
      ];
      coverageValues.forEach((value) => {
        const td = element("td");
        td.textContent = value;
        tr.append(td);
      });
      tr.append(coverageStatusCell(algorithm));
      body.append(tr);
    }
    table.append(head, body);
    const tableWrap = element("div", "table-wrap");
    tableWrap.append(table);
    matrix.append(tableWrap);
  }


  /** catalog에 실제로 있는 deep-link만 상세로 인정하도록, 판정에 쓸 id 집합. */
  function availableAlgorithmIds(): ReadonlySet<string> {
    return new Set(catalogIndex?.algorithms.map((algorithm) => algorithm.id));
  }

  /**
   * 화면은 해시 하나로 결정된다 — 빈 해시·#about 계열이면 소개, 알고리즘
   * deep-link면 상세, 나머지는 목록이다. 26차에 상세가 탭형으로
   * 통일되면서 상세 안 섹션 anchor(#detail·#compare)가 사라졌고, 예외 처리도
   * 함께 걷었다. 그 해시로 들어오는 옛 링크는 알고리즘을 지목하지 않으므로 열
   * 상세가 없고, 여기서 목록으로 떨어진다 — 새 창에서 그 해시를 열었을 때
   * 예전에도 나오던 화면 그대로다(앵커 예외는 이미 상세에 있을 때만 걸렸다).
   *
   * 판정 자체는 navigation.ts의 순수 함수가 들고, 여기서는 지금 해시와 카탈로그만
   * 건네준다. 네비 클릭 경로와 히스토리 경로가 같은 규칙을 보게 하기 위해서다.
   */
  function nextScreenForHash(): ScreenName {
    return screenForHash(window.location.hash, availableAlgorithmIds());
  }

  function applyScreen(selected: CatalogIndexEntry | undefined): void {
    const nextScreen = nextScreenForHash();
    const onDetail = nextScreen === "detail";
    // 해시가 탭을 지목하는 것은 목록 화면일 때뿐이다. 상세·소개 해시에는 탭
    // 정보가 없으므로 마지막 목록 탭을 그대로 유지한다.
    if (nextScreen === "list") {
      activeCatalogTab =
        catalogTabFromHash(window.location.hash) ?? activeCatalogTab;
    }
    if (screen !== nextScreen) {
      // 목록을 떠나는 모든 경로에서 보던 자리를 적어 둔다. 상세뿐 아니라 소개로
      // 나갔다 돌아오는 길에서도 같은 자리로 복귀해야 한다.
      if (screen === "list") {
        listScrollY = window.scrollY;
        listScrollTab = activeCatalogTab;
      }
      // 상세는 언제 들어와도 개요부터 읽는다. 같은 알고리즘을 다시 열어
      // selectAlgorithm의 선택 변경 초기화가 걸리지 않는 경로도 여기서 받는다.
      if (onDetail) activeSpecTab = "overview";
      screen = nextScreen;
    }
    aboutPanel.hidden = nextScreen !== "about";
    thoughtsPanel.hidden = nextScreen !== "thoughts";
    catalogScreen.hidden = nextScreen !== "list";
    detailPanel.hidden = !onDetail;
    // 문서 제목도 화면에 보이는 이름이라 함께 표기를 따른다. 공유 링크의 hash는
    // 표기와 무관한 id 그대로다.
    document.title =
      onDetail && selected
        ? `${displayName(selected)} · ${defaultTitle}`
        : defaultTitle;
    // 상세는 목록의 하위 컨텍스트다. 사이드바 표시는 목록에 남기고 탑바 제목만 바꾼다.
    screenTitle.textContent =
      onDetail && selected ? displayName(selected) : activeScreenTitle();
    applyCatalogTabs();
  }

  function render(): void {
    const selected =
      catalogIndex?.algorithms.find((algorithm) => algorithm.id === selectedId) ??
      catalogIndex?.algorithms[0];
    if (selected && selectedId !== selected.id) selectedId = selected.id;
    applyScreen(selected);
    renderList();
    renderDetail(selected);
    renderMatrix();
  }

  /**
   * option 값은 표기와 무관하게 catalog의 raw 분류 id다. 라벨만 표기를 따르므로
   * 필터 로직도, 정렬 순서(raw id 오름차순)도 표기 전환에 흔들리지 않는다.
   */
  function populateCategories(): void {
    const categories = [
      ...new Set(
        catalogIndex?.algorithms.map((algorithm) => algorithm.category) ?? [],
      ),
    ].sort();
    const selectedCategory = category.value;
    category.replaceChildren(
      new Option(t("list.allCategories"), ""),
      ...categories.map((value) => new Option(displayCategory(value), value)),
    );
    // 표기를 바꾸느라 다시 채워도 고르고 있던 분류는 그대로 둔다.
    if (selectedCategory && categories.includes(selectedCategory)) {
      category.value = selectedCategory;
    }
  }

  function applyNavigation(scroll: boolean): void {
    if (!catalogIndex) return;
    const nextSelectedId = selectedIdForNavigation(
      window.location.hash,
      availableAlgorithmIds(),
      initialSelectedId,
    );
    const nextScreen = nextScreenForHash();
    const nextCatalogTab =
      nextScreen === "list"
        ? (catalogTabFromHash(window.location.hash) ?? activeCatalogTab)
        : activeCatalogTab;
    const selectionChanged =
      nextSelectedId !== undefined && nextSelectedId !== selectedId;
    const screenChanged = nextScreen !== screen;
    const catalogTabChanged = nextCatalogTab !== activeCatalogTab;
    if (!selectionChanged && !screenChanged && !catalogTabChanged) return;
    if (selectionChanged) {
      selectedId = nextSelectedId;
      activeSpecTab = "overview";
    }
    if (selectionChanged || screenChanged) {
      render();
      if (screen === "detail") focusSelectedDetail(scroll);
      else if (isDocumentScreen(screen)) focusDocument(scroll);
      else focusListEntry(scroll);
      return;
    }
    // 같은 목록 화면 안의 탭 전환은 목록을 다시 그리지 않아 검색·필터 상태가 유지된다.
    activeCatalogTab = nextCatalogTab;
    applyCatalogTabs();
    focusCatalogTab();
  }

  /**
   * 검색 보조는 첫 화면에 실리지 않는다. 사용자가 처음 검색하거나 브라우저가 한가해진
   * 시점 중 먼저 오는 쪽에서 한 번만 받고, 받으면 인덱스에 합쳐 검색 범위를 넓힌다.
   * 실패는 상태줄로 올라가지 않는다 — 목록·상세는 그대로 뜨고 검색만 좁아진다.
   */
  function loadSearchAid(): void {
    const index = catalogIndex;
    if (!index || searchAidStatus !== "idle") return;
    searchAidStatus = "loading";
    void staticJsonLoader.load(index.search).then(
      (loaded) => {
        // 그 사이 인덱스를 다시 받았으면 옛 응답을 새 모델에 얹지 않는다.
        if (catalogIndex !== index) return;
        catalogIndex = applyCatalogSearch(index, loaded.value);
        searchAidStatus = "ready";
        renderList();
      },
      (error: unknown) => {
        console.error(
          `검색 보조를 읽지 못했습니다: ${index.search.path}`,
          error,
        );
        if (catalogIndex !== index) return;
        searchAidStatus = "failed";
        renderList();
      },
    );
  }

  /** 브라우저가 한가해질 때까지 미룬다. requestIdleCallback이 없으면 짧은 타이머로 받는다. */
  function scheduleSearchAid(): void {
    const idle = (
      window as typeof window & {
        readonly requestIdleCallback?: (callback: () => void) => number;
      }
    ).requestIdleCallback;
    if (typeof idle === "function") idle(() => loadSearchAid());
    else window.setTimeout(() => loadSearchAid(), 1000);
  }

  /** fetch와 JSON 파싱은 외부 경계이므로 실패 시 샘플을 만들지 않고 명시적인 오류 상태만 표시한다. */
  async function load(): Promise<void> {
    setStatus(() => t("status.loading"), "loading");
    try {
      // 인덱스는 무결성 사슬의 뿌리라 대조할 상위 manifest가 없다. 상세·검색 보조만
      // 이 문서가 발표한 해시로 검증한다.
      const response = await fetch(
        new URL("./catalog-index.json", window.location.href),
      );
      if (!response.ok) throw new Error(`HTTP 상태 코드 ${response.status}`);
      catalogIndex = parseCatalogIndex(await response.json());
      populateCategories();
      const deepLinkedId = algorithmIdFromHash(window.location.hash);
      initialSelectedId =
        deepLinkedId &&
        catalogIndex.algorithms.some(
          (algorithm) => algorithm.id === deepLinkedId,
        )
          ? deepLinkedId
          : "";
      selectedId = initialSelectedId;
      // 언어 전환 때 다시 찍히므로 값은 지금 인덱스에서 뽑아 지역 상수로 굳힌다.
      const readiness = summarizeIndexReadiness(catalogIndex);
      const totals = {
        schema: catalogIndex.schemaVersion,
        algorithms: readiness.algorithmCount,
        sources: readiness.sourceCount,
        cases: readiness.caseCount,
        implementations: readiness.implementationCount,
        failed: readiness.failedChecks,
        skipped: readiness.skippedChecks,
      };
      // 어느 줄이 언제 서는지는 문구와 함께 ui-strings가 정한다. 검증 실패·건너뜀은
      // 0이 정상이라 그때는 줄 자체가 서지 않는다.
      setStatus(() => statusMetricRows(totals, activeNameLanguage), "ready");
      render();
      if (deepLinkedId === selectedId) {
        document
          .querySelector("#detail")
          ?.scrollIntoView({ behavior: "auto", block: "start" });
      }
      scheduleSearchAid();
    } catch (error: unknown) {
      reportBrowserFailure(error, "error.catalogRead");
    }
  }

  search.addEventListener("input", () => {
    try {
      // 첫 검색은 유휴 시점보다 먼저 올 수 있다. 그때 검색 본문을 당겨 받는다.
      loadSearchAid();
      renderList();
    } catch (error: unknown) {
      reportBrowserFailure(error, "error.refreshSearch");
    }
  });
  category.addEventListener("change", () => {
    try {
      renderList();
    } catch (error: unknown) {
      reportBrowserFailure(error, "error.refreshCategory");
    }
  });
  for (const [button, mode] of [
    [viewCardButton, "card"],
    [viewRowsButton, "rows"],
  ] as const) {
    button.addEventListener("click", () => {
      try {
        selectListView(mode);
      } catch (error: unknown) {
        reportBrowserFailure(error, "error.switchListView");
      }
    });
  }
  // 네비는 링크라 Tab/Enter 로 이미 조작된다. 화살표 roving 은 두지 않는다.
  for (const definition of catalogTabDefinitions) {
    const control = catalogTabControls.get(definition.id);
    if (!control) continue;
    control.tab.addEventListener("click", (event) => {
      event.preventDefault();
      try {
        selectCatalogTab(definition.id);
        closeSidebar();
      } catch (error: unknown) {
        reportBrowserFailure(error, "error.switchCatalogScreen");
      }
    });
  }
  /*
    브랜드는 사이트 홈 링크다. 홈은 첫 접속에서 서는 화면과 같아야 하므로 소개로
    간다. 드로어에서 눌렸을 때 닫는 것은 사이드바 네비와 같은 경로다.
  */
  for (const homeLink of [brandHome, aboutNavLink]) {
    homeLink.addEventListener("click", (event) => {
      event.preventDefault();
      try {
        goToDocument(aboutHash);
        closeSidebar();
      } catch (error: unknown) {
        reportBrowserFailure(error, "error.openAbout");
      }
    });
  }
  // 생각은 소개와 같은 읽을거리라 이동 경로도 같다. 해시만 다르다.
  thoughtsNavLink.addEventListener("click", (event) => {
    event.preventDefault();
    try {
      goToDocument(thoughtsHash);
      closeSidebar();
    } catch (error: unknown) {
      reportBrowserFailure(error, "error.openThoughts");
    }
  });
  /*
    소개 화면의 진입 동선. 이 사이트에서 목록이 값을 하는 자리가 브라우저 실행이라,
    이야기를 읽는 중에도 데모까지 한 번의 클릭으로 닿게 둔다. 이동 자체는 사이드바
    목록 항목과 같은 경로를 태워 화면·초점 처리가 갈리지 않게 한다.
  */
  aboutCta.addEventListener("click", (event) => {
    event.preventDefault();
    try {
      selectCatalogTab("list");
    } catch (error: unknown) {
      reportBrowserFailure(error, "error.switchCatalogScreen");
    }
  });
  /*
    건너뛰기 링크는 화면 이동이 아니라 초점 이동이다. 기본 동작에 맡기면 해시가
    #main-content 로 바뀌고, 화면 판정이 그 해시를 소개도 알고리즘 deep-link 도
    아닌 것으로 보아 목록으로 튕긴다. 해시를 건드리지 않고 초점만 옮긴다.
  */
  skipLink.addEventListener("click", (event) => {
    event.preventDefault();
    mainContent.focus({ preventScroll: true });
    mainContent.scrollIntoView({
      behavior: preferredScrollBehavior(),
      block: "start",
    });
  });
  /*
    카탈로그가 오기 전에 서는 화면. 정적 HTML은 소개를 펴 둔 채로 게시되므로,
    다른 화면의 링크(#thoughts · #algorithm/… · #coverage)로 들어온 첫 페인트에서
    소개 본문이 잠깐 스치지 않도록 여기서 먼저 접는다. 생각은 본문이 셸에 이미
    들어 있어 인덱스 없이도 바로 세울 수 있고, 어느 카탈로그 화면인지는 인덱스가
    있어야 정해지므로 나머지는 첫 render가 맡는다.
  */
  if (isThoughtsHash(window.location.hash)) {
    screen = "thoughts";
    aboutPanel.hidden = true;
    thoughtsPanel.hidden = false;
    applyCatalogTabs();
  } else if (!isAboutHash(window.location.hash)) {
    screen = "list";
    aboutPanel.hidden = true;
    catalogScreen.hidden = false;
    applyCatalogTabs();
  }
  trackTopbarHeight();
  applyTheme(activeTheme);
  applyNameLanguage();
  // 정적 HTML은 한국어로 게시되므로, 저장된 언어가 영문이면 첫 렌더 전에 덮는다.
  applyStaticUiStrings();
  // 항목 수는 catalog가 오기 전에도 화면에 있다. 목록을 그리기 전 초기값만 맞춘다.
  setResultCount(0);
  for (const [language, button] of nameLanguageButtons) {
    button.addEventListener("click", () => {
      try {
        selectNameLanguage(language);
      } catch (error: unknown) {
        reportBrowserFailure(error, "error.switchLanguage");
      }
    });
  }
  themeToggle.addEventListener("click", () => {
    try {
      activeTheme = activeTheme === "dark" ? "light" : "dark";
      storeTheme(activeTheme);
      applyTheme(activeTheme);
    } catch (error: unknown) {
      reportBrowserFailure(error, "error.switchTheme");
    }
  });
  sidebarToggle.addEventListener("click", () => {
    try {
      const open = sidebar.dataset.open !== "true";
      setSidebarOpen(open);
      if (open) focusCatalogTab();
      else sidebarToggle.focus({ preventScroll: true });
    } catch (error: unknown) {
      reportBrowserFailure(error, "error.openMenu");
    }
  });
  sidebarScrim.addEventListener("click", () => {
    closeSidebar({ focusToggle: true });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeSidebar({ focusToggle: true });
  });
  for (const backLink of document.querySelectorAll<HTMLAnchorElement>(
    "[data-back-to-list]",
  )) {
    backLink.addEventListener("click", (event) => {
      event.preventDefault();
      try {
        returnToList();
      } catch (error: unknown) {
        reportBrowserFailure(error, "error.returnToList");
      }
    });
  }
  const handleHistoryNavigation = (): void => {
    try {
      applyNavigation(true);
    } catch (error: unknown) {
      reportBrowserFailure(error, "error.openSharedLink");
    }
  };
  window.addEventListener("hashchange", handleHistoryNavigation);
  window.addEventListener("popstate", handleHistoryNavigation);
  void load().catch((error: unknown) =>
    reportBrowserFailure(error, "error.catalogRead"),
  );
}

try {
  main();
} catch (error: unknown) {
  reportStartupFailure(error);
}
