import { algorithmIdFromHash } from "./catalog.js";

/**
 * 알고리즘 deep-link만 앱 선택 상태로 해석한다. 일반 섹션 anchor는 브라우저의
 * 기본 스크롤을 방해하지 않고, 빈 hash는 페이지가 처음 가졌던 선택으로 돌아간다.
 */
export function selectedIdForNavigation(
  hash: string,
  availableIds: ReadonlySet<string>,
  initialSelectedId: string,
): string | undefined {
  if (!hash) {
    return availableIds.has(initialSelectedId) ? initialSelectedId : "";
  }
  const deepLinkedId = algorithmIdFromHash(hash);
  return deepLinkedId && availableIds.has(deepLinkedId)
    ? deepLinkedId
    : undefined;
}

export function scrollBehaviorForPreference(
  prefersReducedMotion: boolean,
): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth";
}

/** 앱이 그릴 수 있는 화면. 상세는 알고리즘 deep-link 하나로만 선다. */
export type NavigationScreen = "list" | "detail";

/**
 * 해시가 지목하는 화면. catalog에 실제로 있는 알고리즘 deep-link만 상세로 인정하고,
 * 그 밖의 해시(#list·#coverage·빈 해시·카탈로그에 없는 id)는 모두 목록 화면이다.
 */
export function screenForHash(
  hash: string,
  availableIds: ReadonlySet<string>,
): NavigationScreen {
  const deepLinkedId = algorithmIdFromHash(hash);
  return deepLinkedId && availableIds.has(deepLinkedId) ? "detail" : "list";
}

/**
 * 카탈로그 네비(목록·커버리지)를 눌렀을 때 해야 할 일.
 *
 * - "route" — 상세를 보고 있었다. 상세를 걷어내고 대상 화면을 새로 그려야 한다.
 * - "tab"   — 이미 목록 화면이다. 패널만 갈아 끼우면 검색·필터 상태가 그대로 남는다.
 *
 * 이 갈래가 없던 동안이 회귀 구간이었다. 네비는 pushState로 해시만 바꾸는데
 * pushState는 hashchange를 발생시키지 않는다. 그래서 상세에서 네비를 눌러도 화면
 * 라우팅이 한 번도 돌지 않아, 주소만 #coverage로 바뀌고 상세 DOM이 그대로 남았다.
 * 선택 id로는 이 전환을 알 수 없다 — #coverage는 어떤 알고리즘도 지목하지 않아
 * selectedIdForNavigation이 undefined("선택 변화 없음")를 주기 때문이다.
 */
export function catalogTabActivation(
  currentScreen: NavigationScreen,
): "route" | "tab" {
  return currentScreen === "detail" ? "route" : "tab";
}
