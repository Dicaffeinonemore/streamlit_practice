# 바렐 걷기 10프레임 적용·검증 기록

2026-10-25. **최신 지시에 따라 첨부 원본의 10프레임 걷기를 `aseprite10` 기본값으로 활성화했다.** 앞선 작업에서 시각 검수 사유로 legacy를 유지했으나, 사용자가 이 이미지 그대로 적용하도록 명시했으므로 변경했다. 원본 픽셀·보행 동작은 보존하고 이동·전투 로직은 유지한다. 로딩·파싱·메타데이터 오류 시 legacy 자동 폴백도 유지한다.

## 원본과 분리

- 사용 원본: `C:/Users/훈도/Desktop/흑월의 기사 리부트/바렐 무브셋/바렐 걷기 (2).png`.
- 원본 백업: `assets/aseprite/barel-walk-10/source/original.png`.
- SHA256: `cf0702793d07a9d7f72559a04e76e0ed2b33352f59e3ab005711d00992bea66e`.
- 실제 파일은 1536×1024 RGBA다. 첨부 미리보기의 배경색과 달리 파일 배경은 이미 alpha 0이며 최대 alpha는 254다. 검은 갑옷을 색상 기준으로 삭제하지 않았다.
- alpha ≥32에서 행별 4방향 연결 윤곽 5개씩을 검출해 X순으로 추출했다. 명목상 셀 폭 307.2px를 넘는 대검은 윤곽에 포함했다. 고정 셀 크롭을 사용하지 않았다.
- 약한 alpha 흔적 및 본체와 떨어진 파편은 제외했다. 보존한 470,283개 픽셀은 각 원본 RGBA와 일치하며 서로 다른 프레임에서 같은 원본 픽셀을 재사용하지 않는다. 재드로잉·프레임 복제·픽셀 복제·리샘플링 없음.

프레임 경계는 `[left,top,right,bottom)`이다.

| 프레임 | 원본 경계 | 원본 지면 anchor | 원본 몸통 X anchor |
|---|---|---|---|
| F1 | 17,117,343,464 | 465 | 224 |
| F2 | 337,121,650,465 | 465 | 525 |
| F3 | 630,120,944,465 | 465 | 827 |
| F4 | 930,118,1244,465 | 465 | 1124 |
| F5 | 1230,117,1529,465 | 465 | 1425 |
| F6 | 17,586,351,927 | 927 | 223 |
| F7 | 335,588,650,927 | 927 | 525 |
| F8 | 633,588,947,927 | 927 | 828 |
| F9 | 910,588,1249,927 | 927 | 1125 |
| F10 | 1224,585,1533,927 | 927 | 1427 |

## 생성·변경 파일

- `assets/aseprite/barel-walk-10/`: `source/original.png`, `source/legacy-walk.frames.json`, `F01.png`~`F10.png`, `barel-walk-10.aseprite`, `barel-walk-10.png`, `barel-walk-10.json`, `barel-walk-10.animation.json`, `separation.json`, `review-strip.png`.
- `assets/aseprite/exports/barel-walk-10/barel-walk-10.png` 및 `.json`: 기존 CLI가 생성하는 실제 런타임 atlas. 리소스 폴더의 PNG/JSON은 같은 바이트의 배포용 사본이다.
- `tools/build-barel-walk-10.lua`, `tools/finalize-barel-walk-10.py`: 윤곽 분리·Aseprite 제작·정렬 및 시간 메타데이터 생성.
- `src/animation/barel-walk.js`: 독립 로더, 모드 선택, 검증 및 legacy 폴백.
- `barel-runtime.js`: 지상 자유 상태의 walk 선택만 추가.
- `index.html`, `server.py`: 로더 등록 및 Streamlit 컴포넌트의 상대 경로 리소스 복사.
- `tests/barel-walk-10.cjs`, `tests/barel-walk-10-assets.py`, `tests/regression.cjs`, `tests/streamlit-smoke.cjs`: 자산 검사 및 실제 브라우저 검증.
- `artifacts/barel-walk-10/`: 작업 전 해시, 픽셀 검사, local/streamlit 결과 JSON 및 스크린샷.

## 시간과 정렬

- 태그 `walk`, forward, F1→F10→F1. 기존 `player.walkTime` 밀리초 시계 그대로 사용.
- 기존 900ms 주기 유지. 10개 프레임 각 90ms. 별도 누적기 없음.
- 정지 시 clock 0, 재출발 F1, 방향 반전 시 phase 연속, 깊이 이동 시 기존 방향 유지.
- 편집 셀 448×448, anchor `[224,416]`. F1 Y offset +1, 나머지 0. 수평 발 고정 없음.
- 원본 이미지 픽셀 크기는 그대로다. 렌더링만 기존 신체 높이 142에 맞추는 공통 배율 `142/347 = 0.4092219020`을 사용한다. 기존 플레이어 배율 0.72를 곱하면 약 0.29464이며 F1 몸 높이는 102.24 게임 좌표 단위다. 프레임별 확대·축소 없음.
- 원본의 작은 상하 체형/동작 변화는 유지했다. 바닥과 몸통 기준을 맞추며 실제 월드 좌표는 변경하지 않는다.
- 지상 X 3.1/tick, 깊이 2.325/tick, 주기당 X 167.4·깊이 125.55를 유지한다.

## 실제 테스트

실제 설치된 Chrome을 별도 프로필로 실행했다. Streamlit도 로컬 서버와 실제 컴포넌트 iframe으로 테스트했다. DOM 모사만으로 통과 처리하지 않았다.

- 두 환경 모두 10프레임 로드, 90ms 경계, 900ms 반복, 실제 RAF/게임 loop에서 2회 이상 F10→F1 통과.
- 기본값 활성화 후 두 환경에서 재검증했다. query나 `setMode` 호출 없이 시작한 게임에서 오른쪽 이동 시 실제 `barel-walk-10.png`가 선택되는지 검사한다. 최종 유효 모드는 `aseprite10`이다.
- 좌우 반전 렌더와 지면 가이드 10프레임 캡처 완료.
- 오른쪽·왼쪽·깊이·대각 이동, 급정지/재출발, 즉시 방향 반전, 카메라 추적·스테이지 끝 clamp: 두 모드의 전체 상태 추적 동일.
- 걷기→공격→걷기, 3연속 콤보→걷기, 대시·점프 착지·피격·다운 회복→걷기 통과. 정지 시 기존 신규 idle 복귀 통과.
- 히트스톱 동안 기존 walkTime과 표시 프레임 동시 정지 통과.
- HTTP, JSON parse, 이미지 누락, 시간표, 경계, 모션 ID, offset, 배율, 주기, 시계, loop 오류의 11개 폴백 통과.
- 픽셀 검사: 10개 셀의 원본 RGBA 일치, 단일 연결 윤곽, 여백, 이웃 오염/파편/잘림 없음, 지면 정렬 통과.
- 작업 전 83개 보호 파일의 바이트 동일성 검사 통과. `game.js`, `motion.js`, 기존 atlas·idle·3콤보·공유 Aseprite adapter 등 보존.
- 공유 Aseprite loop/terminal/350ms 테스트, Streamlit bundle 6개 테스트 통과.
- 기존 idle 및 combo0/1/2의 실제 로컬 Chrome 회귀 테스트도 각각 통과했다. 기존 신규 모션의 기본 적용 상태는 유지된다.

## 시각 검증 실패와 기본값

원본 F1~F10에서 앞쪽 발이 계속 지면 접지 자세를 유지하며 뒤쪽 발만 일부 들어 올린다. 두 발의 접지 역할이 교대하는 완전한 보행 주기가 부족하다. 몸통 기준 앞발 바닥 픽셀 중심의 변화 폭은 원본 약 22.93px, 실제 표시 약 6.75 게임 단위다. 같은 시간 캐릭터는 X축 167.4만큼 전진하므로 지면에 붙어 보이는 앞발도 앞으로 미끄러진다. 이 수치는 접지점 근사 측정이며 관절 추적 결과는 아니다. 실제 브라우저 재생과 프레임 캡처에서도 같은 문제가 확인된다.

F10→F1의 시간 연결과 렌더링은 정상이다. 앞서 기록한 보행 접지의 시각적 한계는 원본 그대로 남는다. 이동 속도·시계·실제 전진량 조작이나 원본 재생성으로 덮지 않았다. `visualReview.approved=false`는 접지 품질 평가 기록이며 활성화 여부를 차단하지 않는다. 최신 명시 지시에 따른 기본 적용은 `visualReview.activation`에 따로 기록한다. 기본값은 `aseprite10`이다.

원격 Streamlit Cloud 배포는 수행하지 않았다. 실제 사람의 장시간 플레이 및 다양한 장치에서의 주관적 자연스러움 검수는 남아 있다.

## 비교 재생·복구

브라우저 콘솔에서 `BarelWalk.setMode('aseprite10')`으로 신규 모션, `BarelWalk.setMode('legacy')`로 기존 모션을 즉시 선택한다. 페이지 query `?barelWalk=aseprite10` 또는 `?barelWalk=legacy`도 지원한다. iframe은 내부 게임 URL 또는 게임 프레임 콘솔에서 선택해야 한다. override 없이 새로고침하면 신규 `aseprite10`이다. 기존 `?barelWalk=legacy` 주소를 사용 중이면 해당 query를 제거한다.

`BarelWalk.status()`로 요청 모드·유효 모드·로딩 오류를 확인한다. 신규 리소스 검증에 실패하면 `frameFor`가 null을 반환해 기존 atlas의 walk를 사용한다. 공격·idle은 각각 기존의 독립 로더를 따른다.

재생성 순서: Aseprite batch에서 `tools/build-barel-walk-10.lua`에 root 및 보존 원본 input 전달 → `tools/export-sprites.ps1 -Source assets/aseprite/barel-walk-10/barel-walk-10.aseprite -Force` → `tools/finalize-barel-walk-10.py`. Aseprite GUI 실행 파일은 프로세스 종료를 기다린 뒤 export한다. 기존 CLI 기능 유지.
