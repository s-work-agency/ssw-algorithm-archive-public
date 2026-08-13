import { rm } from "node:fs/promises";
import { deployArtifacts, deployPath } from "./deploy-paths.mjs";

/*
  배포 루트가 저장소 루트라, 여기서 지우는 것은 빌드가 만든 이름뿐이다. 루트를
  통째로 비우면 README.md·docs/·site/ 까지 함께 사라진다.
*/
async function main() {
  for (const artifact of deployArtifacts) {
    await rm(deployPath(artifact), { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(
    `정적 산출물 정리에 실패했습니다. 원인 유형: ${error instanceof Error ? error.name : typeof error}`,
  );
  if (error instanceof Error && error.stack) console.error(`상세 스택:\n${error.stack}`);
  process.exitCode = 1;
});
