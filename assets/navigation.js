import { algorithmIdFromHash } from "./catalog.js";
/**
 * 알고리즘 deep-link만 앱 선택 상태로 해석한다. 일반 섹션 anchor는 브라우저의
 * 기본 스크롤을 방해하지 않고, 빈 hash는 페이지가 처음 가졌던 선택으로 돌아간다.
 */
export function selectedIdForNavigation(hash, availableIds, initialSelectedId) {
    if (!hash) {
        return availableIds.has(initialSelectedId) ? initialSelectedId : "";
    }
    const deepLinkedId = algorithmIdFromHash(hash);
    return deepLinkedId && availableIds.has(deepLinkedId)
        ? deepLinkedId
        : undefined;
}
export function scrollBehaviorForPreference(prefersReducedMotion) {
    return prefersReducedMotion ? "auto" : "smooth";
}
/**
 * 소개 화면의 해시. 첫 접속의 기본 화면이라 빈 해시도 여기로 온다.
 */
export const aboutHash = "#about";
/**
 * 소개 본문 안 제목 앵커의 해시 앞머리. 본문 앵커를 맨 slug(`#5-...`)로 두면
 * 화면 판정이 그것을 소개도 알고리즘 deep-link도 아닌 해시로 보고 목록으로
 * 떨어뜨린다. `#algorithm/<id>`와 같은 결로 `#about/<slug>`를 쓰면, 화면은
 * 소개 그대로이고 이동은 브라우저의 기본 스크롤이 맡는다.
 *
 * 이 값은 빌드가 본문 앵커를 만들 때 쓰는 앞머리(scripts/build-about.mjs의
 * anchorPrefix)와 같은 것을 가리킨다. 한쪽만 바뀌면 절 링크가 화면을 목록으로
 * 튕기므로, 바꿀 때는 둘을 함께 본다.
 */
const aboutSectionHashPrefix = `${aboutHash}/`;
/**
 * 소개 화면을 지목하는 해시인지. 빈 해시와 `#`는 목적지를 말하지 않은 것이라
 * 사이트 첫 화면인 소개로 본다.
 */
export function isAboutHash(hash) {
    return (!hash ||
        hash === "#" ||
        hash === aboutHash ||
        hash.startsWith(aboutSectionHashPrefix));
}
/**
 * 해시가 지목하는 화면.
 *
 * - 빈 해시·`#`·`#about`·`#about/<slug>` — 소개. 첫 접속의 기본 화면이다.
 * - catalog에 실제로 있는 알고리즘 deep-link — 상세.
 * - 그 밖의 해시(#list·#coverage·카탈로그에 없는 id) — 목록.
 *
 * 본문 앵커가 `#about/` 아래 있는 덕에, 절 링크를 눌러도 화면 판정은 소개
 * 그대로다. 판정이 바뀌지 않으면 앱은 다시 그리지 않고 브라우저의 기본
 * 스크롤만 남는다.
 */
export function screenForHash(hash, availableIds) {
    if (isAboutHash(hash))
        return "about";
    const deepLinkedId = algorithmIdFromHash(hash);
    return deepLinkedId && availableIds.has(deepLinkedId) ? "detail" : "list";
}
/**
 * 카탈로그 네비(목록·커버리지)를 눌렀을 때 해야 할 일.
 *
 * - "route" — 목록 화면이 아니었다. 보고 있던 화면(상세·소개)을 걷어내고 대상
 *   화면을 새로 그려야 한다.
 * - "tab"   — 이미 목록 화면이다. 패널만 갈아 끼우면 검색·필터 상태가 그대로 남는다.
 *
 * 이 갈래가 없던 동안이 회귀 구간이었다. 네비는 pushState로 해시만 바꾸는데
 * pushState는 hashchange를 발생시키지 않는다. 그래서 상세에서 네비를 눌러도 화면
 * 라우팅이 한 번도 돌지 않아, 주소만 #coverage로 바뀌고 상세 DOM이 그대로 남았다.
 * 선택 id로는 이 전환을 알 수 없다 — #coverage는 어떤 알고리즘도 지목하지 않아
 * selectedIdForNavigation이 undefined("선택 변화 없음")를 주기 때문이다.
 *
 * 소개가 첫 화면으로 들어오면서 이 회귀의 사정권도 넓어졌다. 이제 사용자가
 * 목록을 처음 누르는 자리는 대개 소개 화면이라, 판정을 "상세인가"가 아니라
 * "목록인가"로 뒤집어 둔다 — 목록 아닌 화면은 전부 다시 그려야 한다.
 */
export function catalogTabActivation(currentScreen) {
    return currentScreen === "list" ? "tab" : "route";
}
