/**
 * 알고리즘 영문 약어 검색 별칭 — catalog의 id·name이 풀네임이라 통용 약어로는
 * 걸리지 않는 검색을 메우는 프론트 로컬 데이터.
 *
 * "breadth-first-search"를 "bfs"로, "longest-common-subsequence"를 "lcs"로 찾는
 * 편이 자연스럽지만 catalog 1.1 계약에는 약칭을 담을 자리가 없다. 한국어 별칭과
 * 목적은 같아도 성격이 달라 korean-names.ts와 섞지 않는다. 한국어 표는 catalog가
 * 한국어 이름 필드를 갖게 되면 통째로 걷히는 id 전수 표이고, 이 표는 통용 약어가
 * 있는 일부 id에만 존재하는 부분 표다.
 *
 * 선별 원칙
 * - 교과서·현업에서 그대로 쓰이는 두문자어만 넣는다. "segtree"·"toposort"처럼
 *   임의로 줄인 표기는 만들지 않고, 그런 검색어는 풀네임 부분 일치로 이미 걸린다.
 * - id가 이미 약어를 품고 있으면 넣지 않는다. mst는 kruskal-mst·prim-mst의 id로,
 *   scc·lru·lfu·ttl·avl·gcd·lcm·dag·kmp도 각자의 id로 이미 걸린다.
 * - 약어가 다른 카탈로그 항목의 주제어와 정면으로 겹치면 제외한다. fenwick-tree의
 *   "bit"(binary indexed tree)는 bit-utilities가 다루는 낱말 그 자체라 넣지 않았다.
 *
 * 부분 일치 검색이라 짧은 약어는 다른 항목 본문에 우연히 걸릴 수 있다. 이 표는
 * 그 우연을 없애지 못하고, 없애려 하지도 않는다. 별칭을 더해도 원래 걸리던 결과는
 * 그대로이고 대상 알고리즘 하나만 늘어난다는 점만 보장한다. 이미 "lis"는
 * "probabilistic"에, "bst"는 "substring"에 부분 일치하는데 이는 별칭과 무관한
 * 기존 동작이다.
 */

/** id → 영문 약어. 한국어 표와 달리 약어가 통용되는 id에만 존재하는 부분 표다. */
export type EnglishAbbreviationTable = Readonly<
  Record<string, readonly string[]>
>;

export const englishAlgorithmAbbreviations: EnglishAbbreviationTable = {
  "breadth-first-search": ["bfs"],
  "depth-first-search": ["dfs"],
};

/**
 * 선언된 약어를 그대로 돌려준다. 한국어 별칭과 달리 약어는 공백 없는 한 낱말이라
 * 만들어 줄 표기 변형이 없고, 표에 없는 id는 빈 배열이라 부분 표여도 검색이 예외로
 * 끊기지 않는다. catalog의 id는 외부 입력이라 "toString" 같은 Object.prototype 키가
 * 약어로 둔갑하지 않도록 자기 속성만 본다.
 */
export function englishSearchAliases(id: string): readonly string[] {
  const abbreviations = Object.hasOwn(englishAlgorithmAbbreviations, id)
    ? englishAlgorithmAbbreviations[id]
    : undefined;
  return abbreviations ?? [];
}
