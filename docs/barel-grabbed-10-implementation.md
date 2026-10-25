# 바렐 붙잡힘 도트 10프레임 적용

2026-10-25. 첨부 원본의 10개 자세를 기존 `grabbed` 상태에 연결하고 **신규 `aseprite10`을 기본 적용**했다. 고라스 갈고리와 소버린 붙잡기 모두 실제 로컬 Chrome·Streamlit iframe에서 검증했다. 잡기·탈출·피해·위치 보정 코드는 변경하지 않았다.

## 리소스와 분리

- 원본: `C:/Users/훈도/Desktop/흑월의 기사 리부트/바렐 무브셋/바렐 붙잡힘 도트.png`.
- 백업: `assets/aseprite/barel-grabbed-10/source/original.png`, 1600×533 RGBA.
- SHA256: `ac160cbc2c3f4d358a1167c449ff1a8712520552760cb2a5558e5f5e808cd500`.
- 파일의 배경은 이미 alpha 투명이다. 검은 갑옷을 색상으로 제거하지 않았다.
- 실제 연결 윤곽이 10개이며 왼쪽부터 F1~F10 순서다. 고정 셀 크롭 대신 각 윤곽 전체를 추출했다. 손가락·발·망토·검을 포함하는 원본 픽셀을 유지하고 약한 주변 흔적만 제외했다.
- 원본 RGBA 대조, 중복 사용 없음, 단일 연결 윤곽 및 출력 여백 검사 통과. 재드로잉·리샘플링·프레임/픽셀 복제 없음.

생성 파일:

- `assets/aseprite/barel-grabbed-10/source/original.png`
- `assets/aseprite/barel-grabbed-10/F01.png`~`F10.png`
- `assets/aseprite/barel-grabbed-10/barel-grabbed-10.aseprite`
- `assets/aseprite/barel-grabbed-10/barel-grabbed-10.png`
- `assets/aseprite/barel-grabbed-10/barel-grabbed-10.json`
- `assets/aseprite/barel-grabbed-10/barel-grabbed-10.animation.json`
- `assets/aseprite/barel-grabbed-10/separation.json`, `review-strip.png`
- 런타임 atlas: `assets/aseprite/exports/barel-grabbed-10/barel-grabbed-10.png` 및 `.json`. 리소스 폴더 사본과 바이트 동일.

## 기존 상태 규칙

`player.st==='grabbed'`를 두 보스가 공유한다. 별도 진입/홀드 상태를 새로 만들지 않았다.

- 고라스: 기존 갈고리 성공 조건으로 진입. 틱당 X 최대 6·깊이축 최대 2로 당기고, 보스 앞 offset 54 및 기존 카메라 clamp 유지. 충분히 당겨졌거나 pull 45틱 이후 hold를 누적한다.
- 소버린: 기존 grab job 성공 조건으로 진입. 기존 주먹·도움 주먹 및 플레이어 위치 관계를 유지한다.
- 공통: 공격/방향키의 새 입력 4회로 탈출. 붙잡힘 업데이트가 일반 이동·공격·점프·대시 처리를 대신하며 입력을 소비한다. 방향키는 이동 대신 기존 탈출 입력으로 사용된다.
- hold 50틱, 기존 실패·해제 조건 유지. 고라스 실패 시 20 피해와 다운. 테스트한 소버린 1페이즈에서는 도움 주먹 10+압박 18 피해와 다운. 위 수치는 테스트한 기본 조건이며 기존 보스 페이즈/피해 배율 규칙은 그대로다.
- 일반 추가 `hurtPlayer`는 grabbed 중 기존대로 거부된다. 잡기 종료는 먼저 grabbed를 해제한 뒤 기존 피해·다운 처리를 수행한다.
- 소유자 사망/상태 종료·갈고리 제거·잡기 job 취소 시 기존 해제 로직을 따른다. 무적·그로기 보상·입력 초기화도 변경하지 않았다.

## 재생과 정렬

- Aseprite 태그 `grabbed`, forward, 각 프레임 65ms.
- 첫 F1~F10은 기존 시각 기준과 같은 650ms에 재생한다.
- 이후 F3~F10을 520ms로 반복한다. 낮아진 F10에서 최초 충격 자세 F1로 매번 튀는 것을 줄이고 저항 구간을 반복한다.
- 기존 `player.t * MS`만 사용한다. 별도 애니메이션 누적기·관찰 훅·추가 전투 상태 없음. 해제/탈출이 먼저 발생하면 즉시 다음 상태를 그리며 10프레임 완주를 강제하지 않는다.
- 448×448 셀, 기준점 `[224,416]`. 원본 X anchors `[88,232,394,558,710,874,1030,1190,1350,1510]`, 공통 원본 발 기준선 Y 404. 실제 발이 2px 높은 프레임은 메타데이터 Y offset +2로 맞춘다.
- F1 높이 244px를 기존 신체 기준 142px에 맞추는 공통 렌더 배율 사용. 기존 플레이어 배율 0.72 적용 시 약 0.419016이다. 프레임별 확대/축소·월드 좌표 보정 없음. 뒤로 젖힘·들린 발·웅크림은 원본 자세 그대로다.
- 좌우 반전은 기존 actor.face를 그대로 사용한다. 잡는 적과의 상대 위치를 렌더링에서 다시 보정하지 않는다.

## 연결 및 변경 코드

- `src/animation/barel-grabbed.js`: 모드·비동기 로딩·시간/메타데이터/이미지/경계 검증, F3~F10 반복 샘플. 상태 연결 정보가 없으면 null을 반환한다.
- `barel-runtime.js`의 첫 grabbed 분기: 신규 프레임 우선 선택, 실패 시 기존 `barelFrame('hook', t/650, true)` 사용. 이 한 줄 외 기존 렌더 코드는 그대로다.
- `index.html`, `server.py`: 로더 및 Streamlit PNG/JSON/메타데이터 등록.
- `tools/build-barel-grabbed-10.lua`, `tools/finalize-barel-grabbed-10.py`, `tools/inspect-barel-grabbed.py`: 원본 분석·분리·Aseprite 및 메타데이터 생성.
- `tests/barel-grabbed-10.cjs`, `tests/barel-grabbed-10-assets.py`: 실제 보스 상태 및 자산 검사.
- `tests/regression.cjs`, `tests/streamlit-smoke.cjs`: 신규 리소스/테스트 실행 분기.

`game.js`, `gorath-runtime.js`, `sovereign-runtime.js`는 한 바이트도 바꾸지 않았다. 기존 grabbed용 hook atlas와 모든 다른 모션도 보존했다.

## 실제 검증 결과

로컬 Chrome과 실제 로컬 Streamlit iframe에서 각각 통과:

- 실제 `catchGorathHook`·`sovCatch` 및 기존 보스 job으로 진입, F1~F10 전체 실제 RAF 표시, F10→F3 반복.
- 두 보스·좌우 방향에서 legacy/신규의 매 틱 위치·높이·방향·owner 위치·pull/hold·탈출 횟수·카메라·체력·종료 상태 동일.
- 고라스 끌어당김/실패 20 피해·다운, 소버린 도움 주먹 포함 실패 28 피해·다운 유지.
- 점프·대시·스킬 입력 차단, 공격/방향키 3회까지 저항 유지, 4회 탈출, 방향 고정·무자원 소모 확인.
- 일반 추가 피해 거부, 잡기 소유자 사망 시 해제, pause/hitstop 중 프레임과 상태 시간 정지.
- 원본 지면·골반 정렬, 손/검/망토/발 여백 및 좌우 게임 캡처 확인.
- HTTP·JSON·이미지·시간표·경계·모션 ID·offset·배율·주기·시계·loop·반복 구간 오류 12종 legacy 폴백. 잡기 연결 누락 시에도 기존 hook 프레임 사용.
- 252개 보호 파일의 해시 동일성 확인. 새 grabbed 선택 한 줄을 되돌리면 기존 runtime 전체 파일 해시와 일치.
- 기존 jump·점프 베기·3연타·idle/보스 선택 화면의 실제 로컬 Chrome 회귀 검사, 기존 전투/잡기 연타 검사, Aseprite 및 Streamlit bundle 6개 검사 통과.

결과: `artifacts/barel-grabbed-10/local/results.json`, `streamlit/results.json`.

캡처: 각 폴더의 `ten-frames-1.png`, `ten-frames--1.png`, `gorath-1.png`, `gorath--1.png`, `sovereign-1.png`, `sovereign--1.png`. 자산 결과는 `artifacts/barel-grabbed-10/asset-checks.json`이다.

## 기본값·복구·제한

기본값은 `aseprite10`이다. `BarelGrabbed.status()`로 유효 모드를 확인한다. `BarelGrabbed.setMode('legacy')` 또는 내부 게임 URL query `?barelGrabbed=legacy`로 기존 모션을 사용하고, `setMode('aseprite10')` 또는 query 제거로 신규 모션으로 돌아간다. 로딩/파싱/검증/상태 연결 실패 시 기존 프레임으로 자동 복귀한다.

빠른 연타 탈출이나 소유자 취소가 발생하면 원래 상태 전환을 우선하므로 전체 10프레임이 재생되기 전에 끝날 수 있다. 원격 Streamlit Cloud 배포는 수행하지 않았다.

재생성: Aseprite batch `tools/build-barel-grabbed-10.lua`에 `root=.` 전달 → `tools/export-sprites.ps1 -Source assets/aseprite/barel-grabbed-10/barel-grabbed-10.aseprite -Force` → `tools/finalize-barel-grabbed-10.py`. 기존 CLI 및 이전 리소스 유지.
