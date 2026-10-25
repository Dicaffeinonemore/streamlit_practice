# Aseprite 작업 리소스

편집용 `.aseprite` 원본을 보관한다. `tests/black-knight-basic-attack.aseprite`는 기존 바렐 `combo0`에서 복사한 테스트 전용 소스다.

`exports/`는 CLI로 생성한 PNG 스프라이트 시트와 JSON 전용이다. 원본은 덮어쓰지 않는다. `exports/barel-combo0-10/`은 현재 실게임 `combo0` 테스트 적용 리소스이며 나머지 `tests/` 출력은 기존 미리보기용이다.

`barel-combo0-10/`에는 새 첨부 원본 보존본, 검수한 384×384 10프레임 편집 파일, 지면 정렬 메타데이터가 있다. 기본 모드는 `aseprite10`이며 `legacy`로 즉시 복구할 수 있다. [적용·검증·복구 보고서](../../docs/barel-combo0-10-implementation.md)를 참고한다.

생성 도구: `tools/export-sprites.ps1`, `tools/create-aseprite-test.lua`.
실행 방법, 호환 API, 검증 범위는 [연동 문서](../../docs/aseprite-cli.md)를 참고한다.
