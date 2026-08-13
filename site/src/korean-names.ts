/**
 * 알고리즘 한국어 검색 별칭 — catalog 1.2의 한국어 이름 필드로 승격할 예정인
 * 프론트 로컬 데이터.
 *
 * catalog 1.1 계약에는 한국어 이름을 담을 자리가 없어, 영문 id·name과 한국어
 * documentation 본문만 검색에 걸린다. "버블"로는 bubble-sort를 찾을 수 없다는
 * 뜻이다. 데이터 계층이 한국어 필드를 갖게 되면 이 표를 통째로 걷어내고 카탈로그
 * 값으로 갈아끼울 수 있도록, 검색 로직은 섞지 않고 순수 데이터로만 유지한다.
 *
 * 표기 원칙
 * - 외래어 표기를 기본으로 두고, 통용되는 한국어 용어가 따로 있으면 함께 적는다.
 * - "…소트"로 끝나는 정렬 알고리즘은 "…정렬" 변형도 함께 둔다.
 * - 검색이 부분 일치라 "버블 소트"만 적어도 "버블"로 걸린다. 띄어쓰기만 다른
 *   표기는 직접 적지 않고 koreanSearchAliases()가 공백 없는 형태를 만들어 준다.
 * - 정착된 한국어 용어가 없는 항목은 억지로 짓지 않고 외래어 표기만 둔다.
 * - 화면 표시명(korean-display-names.ts)이 여기 별칭으로 걸리지 않으면 그 표기를
 *   그대로 별칭 끝에 더한다. 눈에 보이는 이름으로 검색이 안 되는 상태를 두지
 *   않으려는 것이고, 앞쪽 별칭의 순서·표기는 건드리지 않는다.
 */

/**
 * id → 한국어 별칭. catalog보다 느리게 확장될 수 있는 선택적 보강 표라서 미매핑
 * ID는 빈 목록으로 처리하고, 과거 1.0/1.1 ID도 하위 호환 검색용으로 보존한다.
 */
export type KoreanAliasTable = Readonly<Record<string, readonly string[]>>;

export const koreanAlgorithmAliases: KoreanAliasTable = {
  // 계열 표기("휴리스틱 최단 경로")가 이 항목을 "최단 경로" 검색에 끌어오는데,
  // documentation 본문에는 그 말이 없어 자기 별칭으로는 걸리지 않는다. 하는 일이
  // 맞으므로 별칭으로 declare한다.
  "a-star": ["에이 스타", "최단 경로", "A* 알고리즘"],
  "aho-corasick": ["아호 코라식", "다중 패턴 매칭", "아호 코라식 알고리즘"],
  "breadth-first-search": ["비에프에스", "너비 우선 탐색", "넓이 우선 탐색"],
  "bubble-sort": ["버블 소트", "버블 정렬", "거품 정렬"],
  "counting-sort": ["카운팅 소트", "카운팅 정렬", "계수 정렬"],
  "depth-first-search": ["디에프에스", "깊이 우선 탐색"],
  kmp: ["케이엠피", "크누스 모리스 프랫", "부분 문자열 탐색", "KMP 알고리즘"],
  "quick-sort": ["퀵 소트", "퀵 정렬"],
};

/**
 * 선언된 별칭에 공백을 지운 표기를 더해 돌려준다. "버블 정렬"만 적어 두어도
 * "버블정렬"로 검색되게 하려는 것이고, 표에 없는 id는 빈 배열이라 매핑이 빠져도
 * 검색이 예외로 끊기지 않는다. catalog의 id는 외부 입력이라 "toString" 같은
 * Object.prototype 키가 별칭으로 둔갑하지 않도록 자기 속성만 본다.
 */
export function koreanSearchAliases(id: string): readonly string[] {
  const aliases = Object.hasOwn(koreanAlgorithmAliases, id)
    ? koreanAlgorithmAliases[id]
    : undefined;
  if (!aliases) return [];
  const tokens = new Set<string>();
  for (const alias of aliases) {
    tokens.add(alias);
    tokens.add(alias.replace(/\s+/gu, ""));
  }
  return [...tokens];
}
