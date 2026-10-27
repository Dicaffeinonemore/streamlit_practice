# 바렐 대시 10프레임 및 붉은 잔상

## 2026-10-27 대시 공격 입력 수정

J(또는 기존 Z)를 누른 상태로 공격 → Shift/방향키 두 번 대시로 전환하면, 최초 공격에서 누름 이벤트가 소비되어 대시 공격이 연결되지 않던 문제를 수정했다. 바렐은 대시 110ms 이후 새 공격 입력 또는 계속 누르고 있는 공격키를 확인해 평타 1타로 연결한다. 공격키를 놓았다면 자동 공격하지 않으며, 일반 공격의 콤보 규칙과 비에사 입력은 유지한다. 기존·신규 대시 모드에서 Shift/방향키 두 번 및 J/Z 조합으로 재현·회귀 검증한다.

2026-10-25. 첨부 원본을 분리해 기본 대시를 `aseprite10`으로 연결했다. 로컬 Chrome 및 로컬 Streamlit의 실제 게임 iframe에서 재생·이동·취소·잔상·리소스 오류 검증을 통과했다. 원격 배포는 수행하지 않았다.

## 원본과 리소스

- 원본 경로: `C:/Users/훈도/Desktop/흑월의 기사 리부트/바렐 무브셋/바렐 대시.png`.
- 보존 원본: `assets/aseprite/barel-dash-10/source/original.png`, 2172×724 RGBA.
- SHA256: `93ac58e9556e8bf7cdd1050372b1b3c6a4636354660720b7042758d755d648d9`.
- 배경은 파일에서 이미 alpha 0이다. 검은 갑옷을 색상으로 제거하지 않았다. alpha 32 이상인 원본 RGBA만 사용하고 약한 주변 흔적 및 떨어진 파편을 제외했다.
- 출력 폴더: `assets/aseprite/barel-dash-10/`. 원본, `F01.png`~`F10.png`, `barel-dash-10.aseprite`, `barel-dash-10.png`, `barel-dash-10.json`, `barel-dash-10.animation.json`, `review-strip.png`, `separation.json`.
- 런타임 atlas: `assets/aseprite/exports/barel-dash-10/barel-dash-10.png` 및 `.json`. 리소스 폴더의 PNG/JSON은 동일한 바이트의 사본이다.

단순 10등분은 사용하지 않았다. 실제 연결 윤곽은 7개이며 왼쪽부터 F1, F2, F3, F4~F6, F7~F8, F9, F10이다. 독립된 다섯 캐릭터는 전체 윤곽을 보존하고, 이어진 두 그룹만 alpha가 낮은 경로로 나눴다. 중간 프레임의 속도선·먼지는 원본부터 겹쳐 있으므로 공유된 효과를 기록된 경계로 배분했다. 가려진 원본 픽셀을 재생성하거나 다른 프레임에서 복제하지 않았다. 캐릭터·검을 포함한 분리 결과를 개별 프레임 및 인게임 크기로 검수했다.

## 시간·위치

- 태그 `dash`, forward, 반복 없음. 10개 프레임 각 19ms, 합계 **190ms**.
- 기존 `player.t * MS`에서 직접 프레임 선택. 별도 애니메이션 시계 없음.
- 기존 `DASH.dist=80`, `DASH.dur=190`, `inv=15`, `cd=31` 유지.
- 기존 이동 보간은 150ms에 80px에 도달한다. 공격 취소는 110ms부터 허용한다. 기존 60Hz 고정 틱에서는 종료 검사가 200ms 틱에 일어나며 이 동작도 그대로다.
- 실제 12회 고정 틱과 실제 RAF 반복 테스트에서 F1~F10 모두 표시됐다.
- 편집 셀 384×384, anchor `[200,352]`. 원본의 골반 X와 프레임별 발 기준선으로 위치를 정렬한다. 원본 X anchors는 `[117,333,548,806,1045,1253,1464,1684,1878,2081]`, Y는 `[540,539,538,536,536,536,542,541,546,545]`다.
- 원본 픽셀 리샘플링 없음. 렌더 배율은 F10 신체 높이 261px를 기존 142px에 맞춘 `142/261`, 기존 플레이어 배율 0.72 적용 시 약 0.391724다. 모든 프레임에 동일하게 적용해 웅크림/회복은 원본 동작대로 표시한다.
- 월드 위치·충돌 박스·대시 거리·속도·방향 규칙은 변경하지 않았다.

## 붉은 잔상

`BarelDashFx`는 기존 일반 ghost 배열과 분리한 경량 시각 배열이다. 바렐 대시에서만 기존 푸른 잔상을 대체하고 다른 캐릭터와 스킬의 잔상은 유지한다.

- 약 33.33ms마다 위치·높이·방향·현재 프레임 참조를 저장한다.
- 최대 4개, 수명 150ms, 최대 alpha 0.18. 생성 후 월드 위치 고정, 카메라 X는 그릴 때만 차감한다.
- `#9E1A1F` 및 어두운 적색 계열 atlas를 로딩 시 한 번 캐시한다. 색 혼합 후에도 갑옷·검의 명암과 색상 차이를 남긴다. 시간 경과에 따라 어두운 atlas와 낮은 alpha로 사라진다.
- 매 프레임 이미지 복사·Canvas 생성 없음. 렌더는 기존 Aseprite draw의 save/restore를 사용한다.
- 종료·공격 취소 후 남은 잔상 수명을 최대 50ms로 줄인다. 스테이지 초기화 시 비운다.
- 게임 시뮬레이션 갱신에서만 age를 진행한다. 히트스톱과 일시정지는 기존 루프의 정지 규칙을 따른다. 공격/충돌 판정은 없다.
- 원본에 속도선과 먼지가 이미 있으므로 별도의 수평 선을 추가하지 않았다. 신규 리소스 사용 중에는 기존의 연속 dust overlay를 생략하고 기존 발동 지점의 작은 먼지 burst는 유지한다. 로딩 실패나 legacy 선택 시 기존 dust overlay가 복원된다.
- lowFx에서는 잔상 alpha를 추가로 낮춘다. 화면 흔들림을 추가하지 않았다.

## 변경 코드

- `src/animation/barel-dash.js`: 190ms 단발 로더·검증·자동 폴백, `BarelDashFx`.
- `src/animation/aseprite.js`: 비전투 `oneshot` 메타데이터 지원. 기존 공격/loop 계약 유지.
- `barel-runtime.js`: 대시 프레임 선택, 본체 뒤 잔상 렌더, 중복 먼지 방지.
- `game.js`: 대시 시작·프레임 저장·효과 갱신·스테이지 초기화의 네 시각 훅. 이 네 훅을 역으로 제거했을 때 작업 전 파일 해시와 일치함을 검사했다.
- `index.html`, `server.py`: 모듈 및 Streamlit 정적 리소스 등록.
- `tools/build-barel-dash-10.lua`, `tools/finalize-barel-dash-10.py`, `tools/inspect-barel-dash.py`: 원본 분석·Aseprite 제작·메타데이터 생성.
- `tests/barel-dash-10.cjs`, `tests/barel-dash-10-assets.py`, `tests/aseprite-oneshot.cjs`: 신규 검증.
- `tests/regression.cjs`, `tests/streamlit-smoke.cjs`: 실제 브라우저 실행 분기 및 자산 등록.
- `tests/barel-combo0-10.cjs`, `tests/barel-combo1-10.cjs`, `tests/barel-combo2-10.cjs`: 대시 취소 검증에서 ‘외부 이미지가 없다’는 기존 가정을 제거하고 해당 콤보 프레임을 더 이상 선택하지 않는지 검사하도록 수정. 공격 코드는 변경하지 않았다.

## 검증 결과

실제 Chrome 및 실제 로컬 Streamlit iframe에서 각각 통과:

- 기본 신규 atlas 로드, 10개 실제 표시 프레임, 좌우 번갈아 대시 5회.
- legacy/신규의 이동·상태·무적·쿨다운·체력·카메라 추적 값 동일, 기존 거리 80px 및 스테이지 경계 clamp 유지.
- Shift와 방향키 더블 탭 조작, 대시 중 기존 방향 유지, 종료 시 입력에 따라 신규 idle/walk 복귀.
- 110ms 이후 공격 취소 및 공격→대시 취소, 공격 프레임 우선순위 유지.
- 잔상 33ms 생성, 최대 4개, 위치·프레임·방향 고정, 카메라 이동 시 좌표 불변, 반복 누적 방지, 감소·제거 및 스테이지 초기화.
- 붉은 tint·어두운 명암, 100개 이상의 색상 차이 유지로 단색 실루엣이 아님을 검사. 갑옷의 밝기 감소 확인. Canvas alpha/filter 복원.
- 히트스톱 동안 대시 시간과 잔상 age 정지.
- 비에사의 기존 잔상 유지.
- HTTP·JSON parse·이미지·시간표·경계·모션 ID·offset·배율·주기·시계·loop 오류 11종 모두 legacy 폴백.

자산 검사는 원본 RGBA 좌표 대조, 픽셀 복제 없음, 각 cel 단일 연결 윤곽·여백, CLI 출력 일치, 기존 다른 리소스 보존, 시각 훅 외 게임 코드 불변을 통과했다. 공유 Aseprite oneshot/loop/terminal/350ms 검사와 Streamlit bundle 6개 검사도 통과했다.

기존 idle·walk·combo0·combo1·combo2의 실제 로컬 Chrome 회귀 테스트도 모두 통과했다. 해당 모션들의 기존 신규 리소스와 기본 모드는 유지된다.

결과 및 캡처는 `artifacts/barel-dash-10/local/`과 `artifacts/barel-dash-10/streamlit/`에 있다. 각 `results.json`, `ten-frames-1.png`, `ten-frames--1.png`, `afterimages-1.png`, `afterimages--1.png`를 확인할 수 있다.

## 선택·복구·남은 제한

기본값은 `aseprite10`이다. `BarelDash.status()`로 유효 모드를 확인한다. 콘솔 `BarelDash.setMode('legacy')` 또는 내부 게임 URL query `?barelDash=legacy`로 기존 모션을 선택할 수 있다. 신규 모션 복귀는 `setMode('aseprite10')` 또는 query 제거다. 오류 시 자동으로 기존 atlas 프레임을 사용한다.

F4~F6은 원본 자체에 강한 블러가 있어 갑옷 디테일이 흐려진다. 공유 먼지의 원래 가려진 형태는 복원하지 않았다. 이것은 새로 추가한 Canvas 잔상이 아니며 원본 연출을 보존한 결과다. 원격 Streamlit Cloud 배포 및 다양한 저사양 장치에서 장시간 플레이는 미검증이다.

재생성: Aseprite batch의 `tools/build-barel-dash-10.lua`에 root와 보존 원본 input 전달 → `tools/export-sprites.ps1 -Source assets/aseprite/barel-dash-10/barel-dash-10.aseprite -Force` → `tools/finalize-barel-dash-10.py`. GUI Aseprite의 프로세스 종료를 기다린 뒤 export한다.
