/**
 * 배포 산출물이 놓이는 자리. GitHub Pages를 `main` 브랜치 `/ (root)`로 받으므로
 * 배포 루트가 곧 저장소 루트다. 그래서 정리(clean)는 디렉터리를 통째로 지우지 않고
 * 여기 적힌 이름만 지운다 — README.md·docs/·site/ 는 산출물이 아니라 원본이다.
 */

import { fileURLToPath } from "node:url";

/** 저장소 루트(= 배포 루트). scripts/ 기준 두 단계 위다. */
export const deployRoot = new URL("../../", import.meta.url);

/** 앱 소스와 스냅샷 입력이 있는 자리. */
export const siteRoot = new URL("../", import.meta.url);

/**
 * 빌드가 만드는 것 전부. 정리 대상이자 복사 대상이라 한 곳에 모아 둔다.
 * `fonts/`는 자체 호스팅 글꼴(Pretendard 동적 서브셋)이다. 사이트는 외부 요청을
 * 하지 않으므로 CDN 대신 저장소에 들고 다닌다.
 * `assets/`에는 tsc 산출물(`assets/*.js`)과 종별 자산(`assets/<id>/*.json`)이 함께
 * 들어가지만, 자산은 종 id 하위 디렉터리에만 놓여 파일 이름이 겹치지 않는다.
 */
export const deployArtifacts = [
  "index.html",
  "styles.css",
  "fonts",
  "assets",
  "algorithms",
  "catalog-index.json",
  "catalog-search.json",
  "sources",
  "vectors",
];

export function deployPath(name) {
  return fileURLToPath(new URL(name, deployRoot));
}
