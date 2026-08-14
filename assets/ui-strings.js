/**
 * UI 크롬 문자열의 로케일 표 — 탭 라벨·버튼·폼 라벨·안내 문구처럼 화면 골격에
 * 찍히는 문자열 전부를 한 자리에 모은다.
 *
 * 20차의 한글/영문 토글은 알고리즘·분류·계열 이름만 바꿨다. 이름만 영문이 되고
 * 그 주변의 탭·버튼·빈 상태 문구가 한국어로 남으면 화면 하나에서 표기가 갈리므로,
 * 같은 토글이 UI 크롬까지 함께 지배하도록 이 표를 둔다.
 *
 * 여기 담지 않는 것
 * - 카탈로그가 발행하는 콘텐츠(요약·선택 가이드·테스트 케이스 설명). 그쪽은
 *   catalog 스키마 1.2의 i18n 필드로 옮기기로 했고, 그때까지는 영문 모드에서도
 *   한국어로 남는 것이 의도된 중간 상태다.
 * - 콘솔 진단과 throw 메시지. 화면에 나가지 않는 개발자용 문자열이라 코드 주석과
 *   같은 취급으로 한국어를 유지한다.
 * - 언어 토글 버튼의 라벨. 언어 선택기는 현재 UI 언어와 무관하게 각 언어의 자기
 *   이름("한국어"·"English")으로 적는 것이 관례라 표를 타지 않는다.
 * - catalog가 발행하는 식별자(언어명·엔트리포인트·계약 필드명·오류 코드).
 *   korean-display-names.ts가 이름·분류·계열만 옮기는 것과 같은 경계다.
 *
 * 표기 원칙
 * - 키는 화면 좌표가 아니라 의미로 짓는다. 뜻이 같은 문구는 키 하나를 나눠 쓰고,
 *   자리마다 뜻이 갈리면 문구가 같아도 키를 나눈다.
 * - 값에 끼우는 자리표시자는 {name} 꼴이다. ko·en 양쪽이 같은 자리표시자 집합을
 *   가져야 하고(테스트가 전수로 확인한다), 어순은 언어마다 자유롭게 둔다.
 * - 영문은 기계적 직역이 아니라 같은 뜻을 담는 기술 영어로 적는다. 한국어 쪽이
 *   괄호로 계약 필드명을 덧붙인 자리는, 영문에서 단어가 그대로 겹치면 괄호를 뺀다.
 */
/** 키 집합은 englishUiStrings와 전수로 일치해야 한다(테스트가 확인한다). */
export const koreanUiStrings = {
    // 문서·앱 셸
    "document.description": "설명·계약·테스트·언어별 원본 코드와 커버리지 현황을 제공하는 SSW Algorithm Archive",
    "skipLink.toContent": "본문으로 건너뛰기",
    "brand.tagline": "알고리즘 카탈로그",
    // 소개가 카탈로그 밖 항목으로 들어오면서 이 nav 는 카탈로그 영역만 담지 않는다.
    "sidebar.navLabel": "사이트 영역",
    "sidebar.about": "소개",
    "sidebar.groupLabel": "카탈로그",
    "sidebar.list": "목록",
    "sidebar.coverage": "커버리지",
    "topbar.openMenu": "메뉴 열기",
    "topbar.languageGroup": "표시 언어",
    "topbar.darkMode": "다크 모드",
    // 화면 이름 (탑바 제목)
    "screen.about": "소개",
    "screen.list": "알고리즘 목록",
    "screen.coverage": "커버리지 매트릭스",
    "screen.fallback": "알고리즘 카탈로그",
    /*
      소개 화면. 본문은 저장소 README를 빌드가 옮긴 것이라 이 표를 타지 않고
      한국어 원문 그대로다(카탈로그 발행 콘텐츠와 같은 취급이다). 여기 담는 것은
      화면 골격 문구뿐이다.
  
      CTA는 "목록으로 간다"가 아니라 "돌려본다"로 적는다. 이 사이트에서 목록이
      값을 하는 지점이 브라우저 실행이고, 그걸 한 번의 클릭 거리에 두는 것이
      이 버튼의 목적이다.
    */
    "about.cta": "바로 돌려보기 →",
    // 상태줄
    "status.preparing": "준비 중입니다…",
    "status.loading": "catalog-index.json을 불러오는 중입니다…",
    /*
      지표는 한 문장으로 잇지 않고 라벨·값 두 열로 나눠 한 줄씩 쌓는다. 그래서
      "스키마 {schema} · …" 처럼 전부를 담던 status.ready 계열 키는 없어졌다.
      통과 검증 실행 수를 싣지 않는 옛 인덱스를 위한 변형(status.readyWithout-
      PassedChecks)도 함께 사라졌다 — 새 구성에는 통과 수 자리가 아예 없어 두 문구가
      같아지므로, 같은 것을 두 키로 들 이유가 없다.
    */
    "status.metricSchema": "스키마",
    "status.metricAlgorithms": "알고리즘",
    "status.metricSources": "원본 소스",
    "status.metricCases": "공식 테스트",
    // 실패·건너뜀이 0을 넘을 때만 붙는 줄. 0이면 아예 싣지 않는다.
    "status.metricCheckProblems": "검증 문제",
    "status.valueAlgorithms": "{algorithms}개",
    "status.valueSources": "{sources}개",
    "status.valueCases": "{cases}케이스",
    "status.valueCheckProblems": "실패 {failed} · 건너뜀 {skipped}",
    "status.startupFailed": "화면을 초기화하지 못했습니다. 원인 유형: {errorType}. 배포 HTML을 확인하세요.",
    "status.dataFailed": "{message} 원인 유형: {errorType}. 배포 루트의 데이터 계약을 확인하세요.",
    // 상태줄 앞머리에 붙는 실패 사유
    "error.catalogRead": "catalog-index.json을 읽지 못했습니다.",
    "error.openDetail": "알고리즘 상세 화면을 열지 못했습니다.",
    "error.refreshSearch": "검색 결과를 갱신하지 못했습니다.",
    "error.refreshCategory": "분류 결과를 갱신하지 못했습니다.",
    "error.switchListView": "목록 보기를 전환하지 못했습니다.",
    "error.switchCatalogScreen": "카탈로그 화면을 전환하지 못했습니다.",
    "error.openAbout": "소개 화면을 열지 못했습니다.",
    "error.returnToList": "목록 화면으로 돌아가지 못했습니다.",
    "error.switchLanguage": "표시 언어를 전환하지 못했습니다.",
    "error.switchTheme": "테마를 전환하지 못했습니다.",
    "error.openMenu": "메뉴를 열지 못했습니다.",
    "error.openSharedLink": "공유 링크를 열지 못했습니다.",
    // 목록 화면
    "list.viewGroup": "목록 보기 방식",
    "list.viewCard": "카드형",
    "list.viewRows": "리스트형",
    "list.resultCount": "{count}개 항목",
    "list.searchLabel": "카탈로그 검색",
    "list.searchPlaceholder": "이름, 선택 조건, 분류 또는 언어",
    "list.categoryLabel": "분류 필터",
    "list.allCategories": "전체 분류",
    "list.emptyFiltered": "검색 조건과 일치하는 알고리즘이 없습니다.",
    "list.emptyCatalog": "표시할 카탈로그가 없습니다.",
    // 검색 보조는 첫 화면에 실리지 않고 검색 시점에 따로 받는다. 못 받으면 검색이
    // 좁아질 뿐 목록은 그대로 뜨므로, 상태줄이 아니라 목록 안에서만 알린다.
    "list.searchAidFailed": "선택 가이드 본문을 불러오지 못해 검색이 이름·요약·분류까지만 걸립니다.",
    "list.retrySearchAid": "검색 본문 다시 불러오기",
    // 상세 화면
    "detail.title": "설명·계약·테스트",
    "detail.backToList": "← 목록으로",
    "detail.empty": "목록에서 알고리즘을 선택하면 설명·계약·테스트·구현 정보를 봅니다.",
    "detail.loading": "알고리즘 상세를 불러오는 중입니다…",
    "detail.loadFailed": "알고리즘 상세를 불러오지 못했습니다. 파일이 없거나 인덱스가 발표한 해시·길이와 다릅니다.",
    "detail.retry": "상세 다시 불러오기",
    // 코드 비교 (26차부터 구현 탭 안에서만 쓰인다)
    "compare.columnLanguage": "언어",
    "compare.columnStatus": "상태",
    "compare.columnVectorVerification": "공식 벡터 검증 (통과/실패/건너뜀)",
    "compare.columnBasicTestVerification": "기본 테스트 검증 (통과/실패/건너뜀)",
    "compare.columnEntryPoint": "엔트리포인트",
    "compare.columnSource": "소스",
    "compare.verificationSummary": "{status} · {passed}/{failed}/{skipped}",
    "verificationStatus.not-run": "미실행",
    "verificationStatus.passing": "통과",
    "verificationStatus.failing": "실패",
    "compare.planned": "작성 예정",
    "compare.notApplicable": "해당 없음",
    "compare.sourceUnpublished": "미게시",
    "compare.sourcesTitle": "언어별 실제 소스",
    "compare.sourceGroupTitle": "구현 소스 파일",
    "compare.primaryFile": "주 파일",
    "compare.companionFile": "동반 파일",
    "compare.emptySourceContent": "게시된 원본 소스 파일이 비어 있습니다.",
    "compare.sourceLoading": "검증된 원본 소스를 불러오는 중입니다…",
    "compare.sourceLoadFailed": "원본 소스를 불러오거나 무결성을 확인하지 못했습니다. 목록과 설명은 계속 볼 수 있습니다.",
    "compare.retrySource": "소스 다시 불러오기",
    "compare.noPublishedSource": "소스가 게시되지 않은 구현입니다. 엔트리포인트와 검증 요약만 표시합니다.",
    "compare.missingCatalog": "구현 정보를 표시할 catalog가 없습니다.",
    // 스펙 탭 (26차부터 전 분류 상세의 골격)
    "specTab.overview": "개요",
    "specTab.spec": "추상 스펙",
    "specTab.implementation": "구현",
    "specTab.listLabel": "{name} 상세 보기",
    // 사용 가이드 (개요 탭이 제목 없이 네 칸 격자만 싣는다)
    "guidance.whenToUse": "언제 사용하나요",
    "guidance.avoidWhen": "피해야 할 때",
    "guidance.tradeoffs": "트레이드오프",
    "guidance.pitfalls": "함정",
    "guidance.emptySection": "등록된 항목이 없습니다.",
    "guidance.missingDocumentation": "이 catalog {schema}에는 확장 설명이 없습니다. 요약과 계약 정보는 그대로 표시합니다.",
    // 사용 시나리오 (개요 탭 맨 아래 전폭 산문. 본문은 카탈로그 종별 자산이 든다)
    "scenario.title": "사용 시나리오",
    "scenario.situation": "상황",
    "scenario.why": "왜 이 알고리즘인가",
    "scenario.apply": "적용",
    "scenario.switchPoint": "전환점",
    // 입출력·오류·변경 계약
    "contract.title": "입출력·오류·변경 계약",
    "contract.input": "입력",
    "contract.output": "출력",
    "contract.columnGroup": "구분",
    "contract.columnField": "필드",
    "contract.columnDescription": "설명",
    "contract.columnValue": "값",
    "contract.emptyFields": "선언된 필드가 없습니다.",
    "contract.errorsTitle": "오류 (errors)",
    "contract.emptyErrors": "선언된 오류가 없습니다.",
    "contract.mutationTitle": "변이 규칙 (mutation)",
    "contract.emptyMutation": "선언된 변이 규칙이 없습니다.",
    "contract.emptyMetadata": "공개된 계약 메타데이터가 비어 있습니다.",
    "contract.opaqueTitle": "추가 계약 메타데이터",
    "contract.preconditionsTitle": "전제조건 (preconditions)",
    "contract.emptyPreconditions": "선언된 전제조건이 없습니다.",
    "contract.exampleTitle": "대표 입출력 예시",
    "contract.exampleTitleWithCase": "대표 입출력 예시 · {caseId}",
    "contract.expectedOutput": "기대 출력",
    "contract.expectedResult": "기대 결과",
    // catalog가 발행하는 mutation 값 중 실제로 등장하는 것만 옮긴다.
    "mutation.input-must-not-mutate": "입력 불변 — 입력을 변경하지 않음",
    // 실제 테스트 케이스
    "tests.title": "실제 테스트 케이스",
    "tests.emptyVectors": "게시된 테스트 벡터가 없습니다.",
    "tests.vectorSummary": "{id} · {count}개 케이스",
    "tests.caseFallback": "케이스 {number}",
    "tests.vectorLoading": "검증된 테스트 벡터를 불러오는 중입니다…",
    "tests.vectorLoadFailed": "테스트 벡터를 불러오거나 무결성을 확인하지 못했습니다.",
    "tests.retryVector": "벡터 다시 불러오기",
    "tests.emptyCases": "이 테스트 벡터에는 케이스가 없습니다.",
    // 지표
    "metrics.time": "시간",
    "metrics.space": "공간",
    "metrics.vectors": "벡터",
    "metrics.cases": "케이스",
    // 대안 알고리즘
    "alternatives.title": "대안 알고리즘",
    // 번들(러너 통짜) 소스
    "bundled.label": "번들 소스",
    "bundled.note": "번들 소스 · 자립 소스 재구성 전",
    "bundled.cardNote": "여러 알고리즘이 함께 쓰는 번들 소스라 이 알고리즘만의 자립 소스가 아직 없습니다. 검증은 통과했고, 자립 파일로 분리되면 이 자리에 코드가 나옵니다.",
    // 코드 복사
    "copy.action": "복사",
    "copy.done": "복사됨",
    "copy.failed": "복사 실패",
    "copy.announceDone": "코드를 클립보드에 복사했습니다.",
    "copy.announceFailed": "코드를 복사하지 못했습니다.",
    // 커버리지 매트릭스
    "coverage.noLanguages": "구현 언어 없음",
    "coverage.empty": "커버리지 데이터가 없습니다.",
    "coverage.columnAlgorithm": "알고리즘",
    "coverage.columnVectors": "벡터",
    "coverage.columnCases": "케이스",
    "coverage.columnVerifiedLanguages": "검증 언어",
    "coverage.columnMissingBasicTests": "기본 테스트 작성 예정",
    "coverage.columnReleaseReadyLanguages": "릴리스 준비 언어",
    "coverage.columnLanguageStatus": "언어 상태",
    // 구현 상태 (catalog의 R·I·O·E)
    "implementationStatus.R": "계획",
    "implementationStatus.I": "구현 중",
    "implementationStatus.O": "사용 가능",
    "implementationStatus.E": "제외",
    // 벡터 실행기 (JavaScript 카드)
    "run.title": "브라우저에서 실행",
    "run.intro": "위 소스를 그대로 Web Worker에서 실행합니다. 입력은 공식 벡터의 케이스이고, 결과는 그 케이스가 선언한 기대값과 대조합니다. {timeout}초를 넘기면 워커를 종료합니다.",
    "run.caseLabel": "벡터 케이스",
    "run.inputLabel": "입력 JSON (고쳐서 돌려볼 수 있습니다)",
    "run.run": "실행",
    "run.reset": "케이스 입력으로 되돌리기",
    "run.loading": "소스와 벡터를 불러오는 중입니다…",
    "run.ready": "케이스를 고르고 실행을 누르세요.",
    "run.running": "실행 중입니다…",
    "run.setupFailed": "소스 또는 벡터를 읽지 못해 실행기를 준비하지 못했습니다. 코드 표시와 같은 무결성 검사를 통과해야 실행할 수 있습니다.",
    "run.invalidInput": "입력이 올바른 JSON 객체가 아닙니다. 고친 내용을 확인하세요.",
    "run.expected": "기대값",
    "run.actual": "실행 결과",
    "run.editedNote": "입력을 고쳐 돌렸습니다 — 기대값은 원래 케이스의 것입니다.",
    "run.verdict.passed": "통과",
    "run.verdict.failed": "실패",
    "run.verdict.timeout": "시간 초과",
    "run.verdict.crashed": "실행 오류",
    "run.timeoutDetail": "{timeout}초 안에 끝나지 않아 워커를 종료했습니다.",
    "run.missingExport": "소스에서 {name} 내보내기를 찾지 못했습니다.",
    "run.crashedDetail": "실행이 중단됐습니다: {message}",
};
/** 키 집합은 koreanUiStrings와 전수로 일치해야 한다(테스트가 확인한다). */
export const englishUiStrings = {
    // Document and app shell
    "document.description": "SSW Algorithm Archive — guidance, contracts, tests, per-language sources and coverage status",
    "skipLink.toContent": "Skip to main content",
    "brand.tagline": "Algorithm catalog",
    "sidebar.navLabel": "Site sections",
    "sidebar.about": "About",
    "sidebar.groupLabel": "Catalog",
    "sidebar.list": "List",
    "sidebar.coverage": "Coverage",
    "topbar.openMenu": "Open menu",
    "topbar.languageGroup": "Display language",
    "topbar.darkMode": "Dark mode",
    // Screen names (top bar title)
    "screen.about": "About",
    "screen.list": "Algorithm list",
    "screen.coverage": "Coverage matrix",
    "screen.fallback": "Algorithm catalog",
    // About screen. The body is the repository README, so it stays in Korean.
    "about.cta": "Run one now →",
    // Status line
    "status.preparing": "Getting ready…",
    "status.loading": "Loading catalog-index.json…",
    "status.metricSchema": "Schema",
    "status.metricAlgorithms": "Algorithms",
    "status.metricSources": "Sources",
    "status.metricCases": "Official test cases",
    "status.metricCheckProblems": "Check problems",
    "status.valueAlgorithms": "{algorithms}",
    "status.valueSources": "{sources}",
    "status.valueCases": "{cases}",
    "status.valueCheckProblems": "failed {failed} · skipped {skipped}",
    "status.startupFailed": "Could not initialize the page. Error type: {errorType}. Check the deployed HTML.",
    "status.dataFailed": "{message} Error type: {errorType}. Check the data contract at the deployment root.",
    // Failure reasons prefixed onto the status line
    "error.catalogRead": "Could not read catalog-index.json.",
    "error.openDetail": "Could not open the algorithm detail view.",
    "error.refreshSearch": "Could not refresh the search results.",
    "error.refreshCategory": "Could not refresh the category results.",
    "error.switchListView": "Could not switch the list layout.",
    "error.switchCatalogScreen": "Could not switch the catalog view.",
    "error.openAbout": "Could not open the about view.",
    "error.returnToList": "Could not return to the list view.",
    "error.switchLanguage": "Could not switch the display language.",
    "error.switchTheme": "Could not switch the theme.",
    "error.openMenu": "Could not open the menu.",
    "error.openSharedLink": "Could not open the shared link.",
    // List screen
    "list.viewGroup": "List layout",
    "list.viewCard": "Cards",
    "list.viewRows": "Rows",
    "list.resultCount": "{count} items",
    "list.searchLabel": "Search the catalog",
    "list.searchPlaceholder": "Name, selection guidance, category or language",
    "list.categoryLabel": "Category filter",
    "list.allCategories": "All categories",
    "list.emptyFiltered": "No algorithm matches the current search.",
    "list.emptyCatalog": "There is no catalog to show.",
    "list.searchAidFailed": "The selection guidance text could not be loaded, so search only covers names, summaries and categories.",
    "list.retrySearchAid": "Reload the search text",
    // Detail screen
    "detail.title": "Guidance, contract and tests",
    "detail.backToList": "← Back to the list",
    "detail.empty": "Pick an algorithm from the list to see its guidance, contract, tests and implementations.",
    "detail.loading": "Loading the algorithm detail…",
    "detail.loadFailed": "Could not load the algorithm detail. The file is missing or does not match the hash and length the index published.",
    "detail.retry": "Reload the detail",
    // Code comparison (lives inside the implementation tab from wave 26 on)
    "compare.columnLanguage": "Language",
    "compare.columnStatus": "Status",
    "compare.columnVectorVerification": "Official vectors (passed/failed/skipped)",
    "compare.columnBasicTestVerification": "Basic tests (passed/failed/skipped)",
    "compare.columnEntryPoint": "Entry point",
    "compare.columnSource": "Source",
    "compare.verificationSummary": "{status} · {passed}/{failed}/{skipped}",
    "verificationStatus.not-run": "Not run",
    "verificationStatus.passing": "Passing",
    "verificationStatus.failing": "Failing",
    "compare.planned": "Planned",
    "compare.notApplicable": "Not applicable",
    "compare.sourceUnpublished": "Not published",
    "compare.sourcesTitle": "Real sources by language",
    "compare.sourceGroupTitle": "Implementation source files",
    "compare.primaryFile": "Primary file",
    "compare.companionFile": "Companion file",
    "compare.emptySourceContent": "The published source file is empty.",
    "compare.sourceLoading": "Loading and verifying the canonical source…",
    "compare.sourceLoadFailed": "The source could not be loaded or verified. The list and documentation remain available.",
    "compare.retrySource": "Retry source",
    "compare.noPublishedSource": "This implementation publishes no source. Only the entry point and verification summary are shown.",
    "compare.missingCatalog": "There is no catalog to draw implementation details from.",
    // Spec tabs (the whole detail screen from wave 26 on)
    "specTab.overview": "Overview",
    "specTab.spec": "Abstract spec",
    "specTab.implementation": "Implementation",
    "specTab.listLabel": "{name} detail views",
    // Usage guide (the overview tab ships the four cards without a heading)
    "guidance.whenToUse": "When to use it",
    "guidance.avoidWhen": "When to avoid it",
    "guidance.tradeoffs": "Trade-offs",
    "guidance.pitfalls": "Pitfalls",
    "guidance.emptySection": "Nothing is registered here.",
    "guidance.missingDocumentation": "This catalog {schema} publishes no extended documentation. The summary and contract are shown as they are.",
    // Usage scenario (full-width prose at the foot of the overview tab)
    "scenario.title": "Usage scenario",
    "scenario.situation": "The situation",
    "scenario.why": "Why this algorithm",
    "scenario.apply": "Applying it",
    "scenario.switchPoint": "When to switch away",
    // I/O, error and mutation contract
    "contract.title": "I/O, error and mutation contract",
    "contract.input": "Input",
    "contract.output": "Output",
    "contract.columnGroup": "Group",
    "contract.columnField": "Field",
    "contract.columnDescription": "Description",
    "contract.columnValue": "Value",
    "contract.emptyFields": "No fields are declared.",
    "contract.errorsTitle": "Errors",
    "contract.emptyErrors": "No errors are declared.",
    "contract.mutationTitle": "Mutation rule",
    "contract.emptyMutation": "No mutation rule is declared.",
    "contract.emptyMetadata": "The published contract metadata is empty.",
    "contract.opaqueTitle": "Additional contract metadata",
    "contract.preconditionsTitle": "Preconditions",
    "contract.emptyPreconditions": "No preconditions are declared.",
    "contract.exampleTitle": "Representative example",
    "contract.exampleTitleWithCase": "Representative example · {caseId}",
    "contract.expectedOutput": "Expected output",
    "contract.expectedResult": "Expected result",
    // Only the mutation values the catalog actually publishes are translated.
    "mutation.input-must-not-mutate": "Immutable input — the input is never modified",
    // Real test cases
    "tests.title": "Real test cases",
    "tests.emptyVectors": "No test vectors are published.",
    "tests.vectorSummary": "{id} · {count} cases",
    "tests.caseFallback": "Case {number}",
    "tests.vectorLoading": "Loading and verifying the test vector…",
    "tests.vectorLoadFailed": "The test vector could not be loaded or verified.",
    "tests.retryVector": "Retry vector",
    "tests.emptyCases": "This test vector has no cases.",
    // Metrics
    "metrics.time": "Time",
    "metrics.space": "Space",
    "metrics.vectors": "Vectors",
    "metrics.cases": "Cases",
    // Alternative algorithms
    "alternatives.title": "Alternative algorithms",
    // Bundled (single-file runner) sources
    "bundled.label": "Bundled source",
    "bundled.note": "bundled source · not split out yet",
    "bundled.cardNote": "This source is a bundle shared by several algorithms, so a standalone source for this algorithm alone does not exist yet. Verification passes, and the code will appear here once the file is split out.",
    // Copying code
    "copy.action": "Copy",
    "copy.done": "Copied",
    "copy.failed": "Copy failed",
    "copy.announceDone": "The code was copied to the clipboard.",
    "copy.announceFailed": "The code could not be copied.",
    // Coverage matrix
    "coverage.noLanguages": "No implementation languages",
    "coverage.empty": "There is no coverage data.",
    "coverage.columnAlgorithm": "Algorithm",
    "coverage.columnVectors": "Vectors",
    "coverage.columnCases": "Cases",
    "coverage.columnVerifiedLanguages": "Verified languages",
    "coverage.columnMissingBasicTests": "Basic tests planned",
    "coverage.columnReleaseReadyLanguages": "Release-ready languages",
    "coverage.columnLanguageStatus": "Language status",
    // Implementation status (the catalog's R, I, O and E)
    "implementationStatus.R": "Planned",
    "implementationStatus.I": "In progress",
    "implementationStatus.O": "Available",
    "implementationStatus.E": "Excluded",
    // Vector runner (JavaScript card)
    "run.title": "Run in the browser",
    "run.intro": "Runs the source above as-is in a Web Worker. The input comes from an official vector case, and the result is checked against what that case declares. The worker is terminated after {timeout}s.",
    "run.caseLabel": "Vector case",
    "run.inputLabel": "Input JSON (editable)",
    "run.run": "Run",
    "run.reset": "Restore the case input",
    "run.loading": "Loading the source and vector…",
    "run.ready": "Pick a case and press Run.",
    "run.running": "Running…",
    "run.setupFailed": "Could not read the source or the vector, so the runner is unavailable. Running requires the same integrity check the code display passes.",
    "run.invalidInput": "The input is not a valid JSON object. Check your edits.",
    "run.expected": "Expected",
    "run.actual": "Actual",
    "run.editedNote": "Ran with edited input — the expectation is the original case.",
    "run.verdict.passed": "Passed",
    "run.verdict.failed": "Failed",
    "run.verdict.timeout": "Timed out",
    "run.verdict.crashed": "Run error",
    "run.timeoutDetail": "It did not finish within {timeout}s, so the worker was terminated.",
    "run.missingExport": "The source does not export {name}.",
    "run.crashedDetail": "The run stopped: {message}",
};
function tableForLanguage(language) {
    return language === "en" ? englishUiStrings : koreanUiStrings;
}
/**
 * 키는 catalog 값(mutation·구현 상태 등)으로 조립되기도 하는 외부 입력이라
 * "toString" 같은 Object.prototype 키가 문자열로 둔갑하지 않도록 자기 속성만 본다.
 */
function lookupUiString(table, key) {
    return Object.hasOwn(table, key) ? table[key] : undefined;
}
/**
 * {name} 자리표시자를 값으로 채운다. 넘기지 않은 이름은 원문 그대로 남겨,
 * 표를 고치다 자리표시자가 어긋나도 화면이 빈칸이 되지 않게 한다.
 */
function formatUiString(template, values) {
    return template.replace(/\{(\w+)\}/gu, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
}
/**
 * 표에 없는 키는 undefined로 돌려준다. catalog가 발행한 값을 그대로 노출할지
 * (mutation 원문처럼) 호출한 쪽이 정하게 하려는 것이다.
 */
export function optionalUiString(key, language, values) {
    // 영문 표에 아직 없는 키는 한국어 표기로 되돌린다. 화면이 비는 것보다 낫고,
    // 키 집합이 어긋난 상태 자체는 테스트가 전수로 막는다.
    const template = lookupUiString(tableForLanguage(language), key) ??
        lookupUiString(koreanUiStrings, key);
    if (template === undefined)
        return undefined;
    return values ? formatUiString(template, values) : template;
}
/**
 * UI 크롬은 문구가 비면 조작 자체를 알아볼 수 없으므로, 표에 없는 키는 키
 * 문자열을 그대로 보여 준다. 화면에서 바로 눈에 띄어야 빠뜨린 키를 찾는다.
 */
export function uiString(key, language, values) {
    return optionalUiString(key, language, values) ?? key;
}
/**
 * 상태줄 지표를 줄 단위로 만든다. 한 문장으로 잇지 않는 것은 화면 결정이지만,
 * 어느 줄이 언제 서는지는 문구와 함께 여기 한 자리에 둔다 — DOM 없이 그대로
 * 확인할 수 있어야 조건부 노출이 테스트로 붙잡힌다.
 *
 * 검증 실패·건너뜀은 0이 정상이라 늘 싣지 않는다. 다만 하나라도 0을 넘으면 그
 * 사실이 상태줄에서 사라지면 안 되므로 그때만 줄 하나를 덧붙인다.
 */
export function statusMetricRows(totals, language) {
    // 키는 조회 자리에 문자열 그대로 둔다. 변수로 접으면 어느 키를 부르는지 코드에서
    // 사라져, 표에만 남은 죽은 키를 잡는 검사가 헐거워진다.
    const values = {
        algorithms: totals.algorithms,
        sources: totals.sources,
        cases: totals.cases,
        implementations: totals.implementations,
        failed: totals.failed,
        skipped: totals.skipped,
    };
    const rows = [
        {
            label: uiString("status.metricSchema", language),
            value: totals.schema,
        },
        {
            label: uiString("status.metricAlgorithms", language),
            value: uiString("status.valueAlgorithms", language, values),
        },
        {
            label: uiString("status.metricSources", language),
            value: uiString("status.valueSources", language, values),
        },
        {
            label: uiString("status.metricCases", language),
            value: uiString("status.valueCases", language, values),
        },
    ];
    if (totals.failed > 0 || totals.skipped > 0) {
        rows.push({
            label: uiString("status.metricCheckProblems", language),
            value: uiString("status.valueCheckProblems", language, values),
        });
    }
    return rows;
}
