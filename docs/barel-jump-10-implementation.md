# 바렐 점프 도트 10프레임 적용

2026-10-25. 첨부 `바렐 점프 도트.png`를 10개 자세로 분리해 **신규 jump를 기본 `aseprite10`으로 적용**했다. 로컬 Chrome 및 실제 로컬 Streamlit iframe에서 전체 재생·물리 동일성·상태 전환·폴백을 확인했다. 기존 jump atlas와 다른 모션은 보존했다.

## 리소스와 분리

- 원본: `C:/Users/훈도/Desktop/흑월의 기사 리부트/바렐 무브셋/바렐 점프 도트.png`.
- 백업: `assets/aseprite/barel-jump-10/source/original.png`, 1600×686 RGBA.
- SHA256: `f4a9ad3d085ff18d620b85e3c8e0f44ee84ee83dd8f147ea7d1d6879cc85d60e`.
- 원본 배경은 이미 alpha 0이다. 검은 갑옷을 색상으로 제거하지 않았다. alpha 32 이상 원본 RGBA를 사용하고 떨어진 주변 흔적을 제외했다.
- 연결 윤곽은 9개다. F1~F6, F9, F10은 독립되어 있고 F7의 대검이 F8의 망토와 맞닿아 있다. 고정 10등분 대신 연결 윤곽을 분리하고 F7/F8의 검·망토 소유 영역을 검수했다.
- 원본 픽셀 리샘플링·프레임 복제·픽셀 복제·재드로잉 없음. 유지한 모든 픽셀의 원본 좌표와 RGBA를 검사했다.

생성 파일:

- `assets/aseprite/barel-jump-10/source/original.png`
- `assets/aseprite/barel-jump-10/F01.png`~`F10.png`
- `assets/aseprite/barel-jump-10/barel-jump-10.aseprite`
- `assets/aseprite/barel-jump-10/barel-jump-10.png`
- `assets/aseprite/barel-jump-10/barel-jump-10.json`
- `assets/aseprite/barel-jump-10/barel-jump-10.animation.json`
- `assets/aseprite/barel-jump-10/separation.json`, `review-strip.png`
- 실제 런타임 atlas: `assets/aseprite/exports/barel-jump-10/barel-jump-10.png` 및 `.json`. 위 리소스 폴더의 PNG/JSON 사본과 바이트 동일.

## 정렬과 시간

384×384 셀에 기준점 `[200,352]`를 사용한다. 원본 시트에는 점프 궤적에 따른 세로 배치가 이미 들어 있으므로 프레임별 원본 발 기준선을 정규화했다. 게임 렌더는 기존대로 `actor.y - actor.z`를 적용한다. 원본 높이 변화와 실제 점프 높이를 중복 적용하지 않는다.

| 프레임 | 원본 X 기준점 | 원본 발 기준선 Y | 시간 | 역할 |
|---|---|---|---|---|
| F1 | 94 | 492 | 17ms | 발동 |
| F2 | 250 | 492 | 33ms | 웅크림/초기 이륙 |
| F3 | 408 | 460 | 83ms | 상승 |
| F4 | 562 | 420 | 84ms | 상승 |
| F5 | 710 | 376 | 66ms | 상승 끝 |
| F6 | 860 | 344 | 50ms | 정점 |
| F7 | 1018 | 382 | 134ms | 하강 |
| F8 | 1170 | 460 | 133ms | 하강 끝 |
| F9 | 1328 | 492 | 34ms | 실제 지면 접촉 후 착지 |
| F10 | 1484 | 492 | 50ms | 착지 후 복귀 |

공중 8프레임은 기존 `player.jumpTime * MS`를 사용한다. 기존 물리는 초기 vz 9.6, 틱당 중력 0.55이며 36틱=600ms에 착지한다. 정점은 18틱, 높이 88.65다. 이 값을 변경하지 않았다.

착지 F9/F10은 기존 자유 상태의 `player.t`에서 착지 시점 t를 뺀 차이로 84ms 동안 표시한다. 별도 시간 누적기나 착지 전용 전투 상태를 추가하지 않았다. 고정 60Hz 틱에서는 시각적 마무리가 다음 틱 경계에 종료된다. Space 입력 시 기존 물리는 즉시 시작하므로 F1/F2 때문에 지상 준비 지연을 추가하지 않았다.

착지 자세 표시 중에도 이동·공격·대시·재점프는 기존 규칙대로 즉시 처리된다. 공중 공격이나 피격·다운 등 다른 상태가 우선되면 jump 선택을 중단하고 착지 이력을 비운다. 일반 이동·대기·공격 애니메이션의 설정은 바꾸지 않았다.

F1 높이 158px를 기존 신체 기준 142px에 맞추는 공통 렌더 배율 `142/158`을 사용한다. 기존 플레이어 배율 0.72 적용 시 약 0.647089다. 원본 파일 크기나 픽셀을 확대·축소한 것이 아니며 모든 자세에 같은 렌더 배율을 사용한다. 프레임별 오프셋은 메타데이터에서 바닥 보정만 처리한다. 월드 위치·충돌 박스는 변경하지 않는다.

## 게임 연결·변경 파일

- `src/animation/barel-jump.js`: 독립 로더, 메타데이터·시간·경계 검증, `legacy/aseprite10`, 기존 jumpTime/자유 상태 t에 따른 프레임 선택.
- `barel-runtime.js`: 다른 상태 처리 뒤, 기존 jump 선택 앞에 신규 프레임 선택 두 줄 추가. 공중 공격·피격·다운·대시·스킬의 기존 우선순위 유지.
- `game.js`: `startStage`에서 시각 이력 reset, `update`에서 기존 `updPlayer` 완료 후 관찰 훅. 두 줄을 제거한 파일은 작업 전 원본 해시와 일치한다. `updPlayer`의 점프·이동·충돌·전투 로직은 그대로다.
- `index.html`, `server.py`: 로더 및 Streamlit 정적 리소스 등록.
- `tools/build-barel-jump-10.lua`, `tools/finalize-barel-jump-10.py`, `tools/inspect-barel-jump.py`: 윤곽 분석·Aseprite 제작·시간/정렬 메타데이터 생성.
- `tests/barel-jump-10.cjs`, `tests/barel-jump-10-assets.py`: 실제 브라우저 및 자산 회귀 검사.
- `tests/regression.cjs`, `tests/streamlit-smoke.cjs`: 신규 자산/테스트 실행 등록.
- `tests/barel-combo0-10.cjs`, `barel-combo1-10.cjs`, `barel-combo2-10.cjs`: 기존 ‘점프에는 외부 이미지가 없다’는 테스트 가정을 없애고 공격 선택이 중단되는지 확인.
- `tests/barel-walk-10.cjs`: 점프 입력 직후 z=0인 첫 틱을 착지로 오인하지 않고 vz와 새 착지 표시 종료까지 검사. 기존 관찰 훅도 테스트 시뮬레이션에 반영.

## 실제 검증

로컬 Chrome 및 실제 로컬 Streamlit iframe에서 각각 확인했다.

- 별도 모드 설정 없이 신규 atlas 로드 및 F1~F10 전체 실제 RAF 표시.
- 상승·정점·하강·지면 접촉 시 F9, 복귀 F10 확인. 물리 z를 반영한 궤적·발 기준선 및 좌우 반전 캡처.
- legacy/신규에서 모든 틱의 x/y/z/vz·jumpTime·상태·방향·걷기 시계·충돌 크기·체력·카메라 값 동일.
- 대기→점프→대기, 걷기/깊이축 이동→점프→이동, 공중 방향 반전.
- 공중 공격 진입·착지 종료, 공중 피격 시 기존 다운 전환·회복, 공중 대시 제한 유지.
- 착지 직후 공격·대시·재점프 즉시 가능. 다른 상태 후 오래된 착지 자세가 남지 않음.
- 공중 및 착지 중 히트스톱, 일시정지 동안 프레임·물리 시계 정지.
- HTTP·JSON 파싱·이미지·시간표·경계·모션 ID·offset·배율·주기·시계·loop·물리 참조 불일치 12종 오류에서 기존 jump 폴백.
- 원본 RGBA/좌표 일치, 픽셀 중복 사용 없음, 단일 연결 윤곽, cel 여백, 바닥 정렬, CLI 출력 동일성.
- 기존 모듈과 리소스 191개 파일의 해시 동일성 및 두 시각 훅 외 게임 로직/다른 애니메이션 선택 동일성 확인.

기존 idle·walk·dash·combo0/1/2의 실제 로컬 Chrome 회귀 검사를 모두 통과했다. 착지 연계를 갱신한 walk 검사는 로컬 Streamlit iframe에서도 통과했다. 공유 Aseprite oneshot/loop/terminal/350ms 검사 및 Streamlit bundle 6개 검사도 통과했다.

검증 결과·캡처: `artifacts/barel-jump-10/local/`, `artifacts/barel-jump-10/streamlit/`의 `results.json`, `ten-frames-1.png`, `ten-frames--1.png`, `trajectory-1.png`, `trajectory--1.png`, `apex-1.png`, `apex--1.png`. 공통 자산 검사: `artifacts/barel-jump-10/asset-checks.json`.

## 기본값·복구·제한

기본값은 `aseprite10`이다. 콘솔 `BarelJump.status()`로 유효 모드를 확인한다. `BarelJump.setMode('legacy')` 또는 내부 게임 URL query `?barelJump=legacy`로 기존 모션을 선택하고, `setMode('aseprite10')` 또는 query 제거로 신규 모션으로 복귀한다. 리소스 로딩/파싱/검증 실패 시 기존 jump로 자동 폴백한다.

원격 Streamlit Cloud 배포는 수행하지 않았다. 일반 점프의 착지 시각 마무리는 기존 물리와 독립적이며 입력을 지연시키지 않는다. 공격이나 피격으로 점프가 중단된 경우에는 기존 상태의 모션을 우선하므로 10프레임을 강제로 끝까지 재생하지 않는다.

재생성: Aseprite batch의 `tools/build-barel-jump-10.lua`에 `root=.` 전달 → `tools/export-sprites.ps1 -Source assets/aseprite/barel-jump-10/barel-jump-10.aseprite -Force` → `tools/finalize-barel-jump-10.py`. 기존 CLI 기능과 이전 리소스는 보존했다.
