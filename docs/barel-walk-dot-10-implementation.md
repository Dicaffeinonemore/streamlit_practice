# 바렐 걷기 도트 스프라이트 교체

2026-10-25. 첨부 `바렐 걷기 도트.png`를 기본 걷기 리소스로 적용했다. 기본 모드는 `aseprite10`이며 이전 걷기 리소스는 보존했다.

- 원본: `C:/Users/훈도/Desktop/흑월의 기사 리부트/바렐 무브셋/바렐 걷기 도트.png`.
- SHA256: `f9866fda2afda4135f74646f1087be6ec5630cdc599075eac7c67802776b48ed`.
- 원본 규격 1536×1024 RGBA, 이미 투명 배경이다. 검은 갑옷을 색상으로 제거하지 않았다.
- 위 행 F1~F5 → 아래 행 F6~F10 순서. 행별 실제 연결 윤곽 5개씩을 분리해 셀 경계를 넘는 검·망토도 보존했다. 재드로잉·픽셀 복제·리샘플링 없음.

## 생성·변경 파일

- `assets/aseprite/barel-walk-dot-10/`: `source/original.png`, `F01.png`~`F10.png`, `barel-walk-dot-10.aseprite`, `.png`, `.json`, `.animation.json`, `review-strip.png`, `separation.json`.
- 런타임 atlas: `assets/aseprite/exports/barel-walk-dot-10/barel-walk-dot-10.png` 및 `.json`. 위 폴더의 PNG/JSON 사본과 동일한 바이트다.
- `src/animation/barel-walk.js`: 기본 메타데이터 경로만 신규 도트 폴더로 교체.
- `server.py`: 신규 PNG/JSON/메타데이터를 Streamlit 컴포넌트로 복사.
- `tools/build-barel-walk-dot-10.lua`, `tools/finalize-barel-walk-dot-10.py`: 기존 걷기 분리·내보내기·정렬 방식 재사용.
- `tests/barel-walk-dot-10-assets.py`, `tests/barel-walk-10.cjs`, `tests/regression.cjs`: 신규 원본 및 실제 기본 재생 검사.
- jump·air·dash 테스트의 걷기 복귀 경로를 새 PNG 이름으로 갱신했다.

## 시간·정렬

기존 900ms 주기, 프레임당 90ms다. 기존 `player.walkTime`을 사용하며 정지·재출발·방향 반전 정책을 유지했다. 이동 속도와 월드 좌표는 변경하지 않았다.

448×448 셀, 기준점 `[224,416]`, 필요한 발 기준선 Y offset만 메타데이터로 처리했다. 원본 F1 높이 346px에 공통 렌더 배율 `142/346`을 사용하며 기존 플레이어 배율 0.72를 유지한다. 픽셀 파일의 크기나 디자인을 강제로 바꾸지 않았고 프레임별 확대/축소도 없다. 원본의 보행 자세 자체는 그대로 사용했다.

## 실제 검증

로컬 Chrome과 실제 로컬 Streamlit iframe에서 신규 이미지가 별도 설정 없이 기본 선택되는지 확인했다. 두 환경에서 10프레임 전체·F10→F1 반복, 좌우 반전, 급정지/재출발/방향 전환, 깊이축 이동, 점프/대시/피격/콤보와의 전환, 리소스 오류 11종 폴백을 통과했다.

legacy/신규의 이동·상태·카메라·스테이지 경계 추적 값은 동일하다. 원본 RGBA 일치·파편/이웃 픽셀 혼입·셀 잘림·발 정렬 검사 및 기존 파일 269개의 해시 보존 검사도 통과했다. `game.js`, `barel-runtime.js`, 다른 모션은 변경하지 않았다. 기존 jump·air·dash·idle/선택 화면·3콤보·grabbed의 로컬 Chrome 회귀 검사와 Streamlit bundle 6개 검사도 통과했다.

결과와 캡처는 `artifacts/barel-walk-dot-10/local/`, `streamlit/`의 `results.json`, `ten-frames-1.png`, `ten-frames--1.png`, `game.png`에 있다. 공통 픽셀 검사 결과는 `artifacts/barel-walk-dot-10/asset-checks.json`이다.

## 복구

`BarelWalk.setMode('legacy')` 또는 내부 게임 URL query `?barelWalk=legacy`로 기존 atlas 모션을 사용한다. `setMode('aseprite10')` 또는 query 제거로 신규 도트 걷기로 돌아간다. 이미지/메타데이터 오류 시 legacy 자동 복귀는 그대로다. 이전 `barel-walk-10` 원본·편집 파일·내보내기 파일도 보존했다.

원격 Streamlit Cloud 배포는 수행하지 않았다. 이번 변경은 첨부 원본 적용이며 원본 보행 동작을 재생성하지 않았다. 접지 특성 측정값은 신규 animation metadata의 `visualReview`에 기록했다.
