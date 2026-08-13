/**
 * 알고리즘·분류·계열의 한국어 표시명 — catalog 1.2의 한국어 이름 필드로 승격할
 * 예정인 프론트 로컬 데이터.
 *
 * catalog 1.1/1.2 계약이 담는 이름은 영문 하나뿐이다. 번역된 항목은 이 표로
 * 덮어쓰고 새 미번역 항목은 catalog 영문 name/raw taxonomy로 안전하게 되돌린다.
 * 데이터 계층이 한국어 이름을 갖게 되면 이 표를 통째로 걷어내고 카탈로그 값으로
 * 갈아끼울 수 있도록, 렌더 로직은 섞지 않고 순수 데이터와 조회 헬퍼만 둔다.
 *
 * korean-names.ts와 목적이 다르다. 저쪽은 "버블 소트"로도 "거품 정렬"로도
 * 걸리게 하는 검색 별칭 여러 개고, 이 표는 화면에 실제로 찍히는 대표 표기 하나다.
 * 두 표를 합치면 "첫 별칭이 대표 표기"라는 암묵 규칙에 표시가 끌려다니므로
 * 나눠 둔다. 대신 여기 표기는 전부 검색으로도 걸려야 하고, 걸리지 않는 표기는
 * korean-names.ts에 별칭으로 더한다(테스트가 전수로 확인한다).
 *
 * 표기 원칙
 * - 직역보다 통용성이 먼저다. 정착된 한국어 용어가 있으면 그것을 쓰고
 *   ("이진 탐색", "위상 정렬"), 없으면 외래어 표기를 쓴다("랑데부 해싱").
 * - 사람 이름에서 온 알고리즘은 제목 자리에서 사람으로 읽히지 않도록 하는 일을
 *   덧붙인다("프림 최소 신장 트리", "타잔 강한 연결 요소"). 이름만으로 알고리즘을
 *   가리키는 관용이 굳은 경우에는 "… 알고리즘"을 붙인다("다익스트라 알고리즘").
 * - 업계에서 영문 약어 그대로 읽는 것은 약어를 남긴다("LRU 캐시", "AVL 트리").
 *   억지로 "엘알유 캐시"라고 적지 않는다.
 * - 사람·논문 이름은 국내 문헌에 굳은 음차가 있으면 한글로 적고("헝가리안 배정",
 *   "프뤼퍼 수열 코덱"), 굳은 음차가 없어 표기가 갈리는 것은 원어를 남긴다
 *   ("Bowyer-Watson Delaunay 삼각분할", "Suurballe 서로소 최단 경로"). 원어를
 *   남길 때도 하는 일을 한글로 붙여 제목 자리에서 사람으로 읽히지 않게 한다.
 * - 같은 개념을 가리키는 낱말은 이미 이 표에 있는 쪽으로 맞춘다. index는 "색인",
 *   subsequence는 "부분 수열"이라, 새 항목도 "인덱스"·"부분수열"로 갈라 적지 않는다.
 * - 분류·계열은 한 화면에서 여러 항목이 나란히 놓이므로, 서로 구별되는 짧은
 *   명사구로 맞춘다.
 */

/** 이름 표기 언어. 기본은 한글이고, 영문은 catalog 원문을 그대로 보여 준다. */
export type NameLanguage = "ko" | "en";

/** id·분류·계열 → 한국어 표시명 하나. 검색 별칭과 달리 값이 배열이 아니다. */
export type DisplayNameTable = Readonly<Record<string, string>>;

/**
 * 이 스냅샷이 싣는 알고리즘 전수를 덮는다. 표에 없는 ID가 들어와도 조회 헬퍼가
 * catalog 영문 name으로 되돌려 목록·상세를 계속 그린다 — 폴백은 사고 대비지
 * 상시 경로가 아니다.
 */
export const koreanAlgorithmDisplayNames: DisplayNameTable = {
  "a-star": "A* 알고리즘",
  "aho-corasick": "아호 코라식 알고리즘",
  "breadth-first-search": "너비 우선 탐색",
  "bubble-sort": "버블 정렬",
  "counting-sort": "계수 정렬",
  "depth-first-search": "깊이 우선 탐색",
  kmp: "KMP 알고리즘",
  "quick-sort": "퀵 정렬",
};

/**
 * catalog의 분류 전수를 덮는다. 분류는 필터 드롭다운의 라벨로도 쓰이지만 값은 raw
 * id 그대로라, 표기가 빠져도 필터 로직에는 영향이 없고 라벨만 raw id로 떨어진다.
 */
export const koreanCategoryDisplayNames: DisplayNameTable = {
  automata: "오토마타",
  cache: "캐시",
  concurrency: "동시성",
  "data-structure": "자료구조",
  "distributed-systems": "분산 시스템",
  "dynamic-programming": "동적 계획법",
  encoding: "인코딩",
  geometry: "기하",
  graph: "그래프",
  logic: "논리",
  math: "수학",
  probabilistic: "확률적 기법",
  "rate-limit": "처리율 제한",
  resilience: "복원력",
  scheduling: "스케줄링",
  search: "탐색",
  // 수열(數列)은 동적 계획법의 부분 수열과 겹쳐 읽히므로 외래어 표기를 쓴다.
  sequence: "시퀀스",
  sort: "정렬",
  streaming: "스트리밍",
  string: "문자열",
  tree: "트리",
};

/**
 * catalog의 계열 전수를 덮는다. 미매핑 계열은 상세 화면의 "(분류 / 계열)" 줄에서
 * raw id로 떨어지므로, 조회 헬퍼의 폴백은 남겨 두되 표는 비워 두지 않는다.
 *
 * 계열 표기는 한 검색어가 그 계열 전체를 한꺼번에 끌어오는 유일한 별칭이다. 그래서
 * 분류 이름을 그대로 넣으면 안 된다 — 이를테면 계열 표기에 "그래프"를 쓰면 분류
 * "그래프"로 좁히던 검색이 다른 분류의 항목까지 끌어온다. 분류와 겹치는 낱말은
 * 그 계열의 구성원이 모두 같은 분류일 때만 쓴다.
 */
export const koreanFamilyDisplayNames: DisplayNameTable = {
  comparison: "비교 정렬",
  // 캐시 키 분배와 분배 정렬이 같은 계열 이름을 쓴다. 양쪽 모두에 맞는 표기다.
  distribution: "분배",
  "heuristic-shortest-path": "휴리스틱 최단 경로",
  "multiple-pattern-matching": "다중 패턴 매칭",
  "substring-search": "부분 문자열 탐색",
  traversal: "순회",
};

/**
 * catalog의 id·분류·계열은 외부 입력이라 "toString" 같은 Object.prototype 키가
 * 표시명으로 둔갑하지 않도록 자기 속성만 본다.
 */
function lookupDisplayName(
  table: DisplayNameTable,
  key: string,
): string | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

/**
 * 한글 표기는 표에 있는 이름을, 영문 표기는 catalog가 발행한 name을 쓴다.
 * 표에 없는 id는 영문 이름으로 되돌아가므로, 매핑이 빠져도 화면이 비지 않는다.
 */
export function algorithmDisplayName(
  id: string,
  englishName: string,
  language: NameLanguage,
): string {
  if (language === "en") return englishName;
  return lookupDisplayName(koreanAlgorithmDisplayNames, id) ?? englishName;
}

/** 영문 표기와 미매핑 분류는 catalog의 raw id를 그대로 보여 준다. */
export function categoryDisplayName(
  category: string,
  language: NameLanguage,
): string {
  if (language === "en") return category;
  return lookupDisplayName(koreanCategoryDisplayNames, category) ?? category;
}

/** 영문 표기와 미매핑 계열은 catalog의 raw id를 그대로 보여 준다. */
export function familyDisplayName(
  family: string,
  language: NameLanguage,
): string {
  if (language === "en") return family;
  return lookupDisplayName(koreanFamilyDisplayNames, family) ?? family;
}
