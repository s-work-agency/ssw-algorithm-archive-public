import { cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { deployRoot, siteRoot } from "./deploy-paths.mjs";

/*
  배포 루트에 놓는 것은 두 묶음이다.

  - `site/public/` — 정적 셸(index.html·styles.css). tsc 산출물은 이미 `assets/`에
    직접 떨어져 있으므로 여기서 다시 옮기지 않는다.
  - `site/snapshot/` — 공개 스냅샷 입력. catalog 인덱스·검색 보조·종별 상세·종별
    자산과, 벤더링한 소스·공식 벡터가 들어 있다. 상세가 발표한 sha256으로 브라우저가
    다시 확인하는 바이트라 한 글자도 바꾸지 않고 그대로 복사한다.

  스냅샷을 다시 뜨는 것은 `build-snapshot.mjs`의 일이고, 그쪽은 비공개 입력이 있어야
  돌아간다. 이 스크립트는 이미 떠 놓은 스냅샷만 보므로 공개 저장소만으로도 빌드된다.
*/
const publicDirectory = new URL("public/", siteRoot);
const snapshotDirectory = new URL("snapshot/", siteRoot);

async function main() {
  const destination = fileURLToPath(deployRoot);
  await cp(fileURLToPath(publicDirectory), destination, { recursive: true });
  await cp(fileURLToPath(snapshotDirectory), destination, { recursive: true });
}

main().catch((error) => {
  console.error(
    `정적 파일 또는 스냅샷 복사에 실패했습니다. 원인 유형: ${
      error instanceof Error ? error.name : typeof error
    }`,
  );
  console.error(
    `스냅샷 입력: ${fileURLToPath(snapshotDirectory)} (없으면 build-snapshot.mjs로 다시 뜹니다.)`,
  );
  if (error instanceof Error && error.stack) console.error(`상세 스택:\n${error.stack}`);
  process.exitCode = 1;
});
