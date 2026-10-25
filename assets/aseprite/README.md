# Aseprite 작업 리소스

바렐 일반 대기는 `barel-idle-10/` 및 `exports/barel-idle-10/`의 10프레임을 기본 사용한다. 기존 1300ms 주기이며 세 콤보와 독립적으로 legacy 전환할 수 있다. [Idle 적용·검증 보고서](../../docs/barel-idle-10-implementation.md)를 참고한다.

바렐 3타 `combo2`는 `barel-combo2-10/`과 `exports/barel-combo2-10/`의 10프레임을 기본 사용한다. 현재 세 기본 공격 모두 신규 리소스가 적용됐으며 각 타는 독립적으로 legacy 전환이 가능하다. [3타 적용·검증 보고서](../../docs/barel-combo2-10-implementation.md)를 참고한다.

현재 바렐 `combo1`도 `barel-combo1-10/`과 `exports/barel-combo1-10/`의 10프레임을 기본 사용한다. [2타 적용·검증·복구 보고서](../../docs/barel-combo1-10-implementation.md)에 원본 보존, F8 원본 픽셀 복사 이력, 시간표와 legacy 전환 방법을 정리했다.

편집용 `.aseprite` 원본을 보관한다. `tests/black-knight-basic-attack.aseprite`는 기존 바렐 `combo0`에서 복사한 테스트 전용 소스다.

`exports/`는 CLI로 생성한 PNG 스프라이트 시트와 JSON 전용이다. 원본은 덮어쓰지 않는다. `exports/barel-combo0-10/`은 현재 실게임 `combo0` 테스트 적용 리소스이며 나머지 `tests/` 출력은 기존 미리보기용이다.

`barel-combo0-10/`에는 새 첨부 원본 보존본, 검수한 384×384 10프레임 편집 파일, 지면 정렬 메타데이터가 있다. 기본 모드는 `aseprite10`이며 `legacy`로 즉시 복구할 수 있다. [적용·검증·복구 보고서](../../docs/barel-combo0-10-implementation.md)를 참고한다.

생성 도구: `tools/export-sprites.ps1`, `tools/create-aseprite-test.lua`.
실행 방법, 호환 API, 검증 범위는 [연동 문서](../../docs/aseprite-cli.md)를 참고한다.
