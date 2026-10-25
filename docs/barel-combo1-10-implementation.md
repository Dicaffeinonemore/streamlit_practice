# 바렐 2타 combo1 10프레임 적용 완료

현재 기본 모션은 도트 시트로 교체되었습니다. 최신 경로와 검증 결과는 [3콤보 도트 교체 기록](barel-combo-dot-10-implementation.md)을 참조하세요. 아래는 이전 리소스의 구현 기록입니다.

후속 적용 상태: 현재 `combo2`도 신규 10프레임이 기본이다. [3타 적용 보고서](barel-combo2-10-implementation.md)를 참고한다. 아래 2타 단독 검증의 legacy 3타 연결은 테스트 격리 상태의 기록이다.

2026-10-25. 첨부한 `바렐 2타.png`에서 실제 **10개 동작**을 확인하고, 분리·정렬·게임 연결·로컬 Chrome 및 실제 Streamlit iframe 검증 후 **`aseprite10`을 기본 적용**했다. 기본 1타 `combo0`와 기존 3타 `combo2`의 리소스 및 전투 로직은 보존했다.

## 리소스 경로

| 용도 | 경로 |
|---|---|
| 원본 보존본 | [original.png](../assets/aseprite/barel-combo1-10/source/original.png) |
| Aseprite 편집 파일 | [barel-combo1-10.aseprite](../assets/aseprite/barel-combo1-10/barel-combo1-10.aseprite) |
| 게임 PNG | [barel-combo1-10.png](../assets/aseprite/exports/barel-combo1-10/barel-combo1-10.png) |
| Aseprite JSON·프레임 시간 | [barel-combo1-10.json](../assets/aseprite/exports/barel-combo1-10/barel-combo1-10.json) |
| 정렬·검증 메타데이터 | [barel-combo1-10.animation.json](../assets/aseprite/barel-combo1-10/barel-combo1-10.animation.json) |
| 개별 프레임 | `assets/aseprite/barel-combo1-10/F01.png` ~ `F10.png` |
| 분리·픽셀 복사 이력 | `assets/aseprite/barel-combo1-10/separation.json` |
| 기존 2타 프레임 참조 보존 | `assets/aseprite/barel-combo1-10/source/legacy-combo1.frames.json` |

원본은 2172×724 RGBA이며 SHA-256은 `64992ab767aa8cf941172ed5499912252c55c5937a5626fdec15f2010b16cb26`이다. 데스크톱 원본은 수정하지 않았다. 실제 이미지에는 투명 알파가 있으므로 배경을 재생성하지 않고 알파 32 미만의 희미한 잡음만 제외했다.

384×384 셀 10개, 3840×384 시트에 원본 픽셀을 **1:1로 배치**했다. 강제 축소, 재샘플링, 팔레트 변환, 이미지 생성 및 새 디자인 드로잉은 하지 않았다. 프레임 경계는 행별 투명 간격과 확대 검수한 검 영역으로 정했으며 단순 10등분은 사용하지 않았다. 검을 다음 프레임 망토/부츠와 분리하고 고립된 잔여 성분을 제거했다.

F8 뒤쪽 정강이는 앞 프레임의 검이 가리고 있어 단순 마스킹하면 발이 분리됐다. **같은 첨부 시트 F5의 동일 갑옷 정강이 픽셀 376개를 복사해 빈 연결부만 보완**했다. 보이는 F8 픽셀은 덮어쓰지 않았고 새 색상이나 선을 그리지 않았다. `separation.json`의 `sourcePixelClones`에 대상/원본 좌표가 있으며, 모든 출력 픽셀이 원본 또는 명시한 원본 복사 좌표의 RGBA와 일치하는지 검사했다. 재검수하려면 [F08.png](../assets/aseprite/barel-combo1-10/F08.png)를 확인한다.

## 유지한 전투 계약

| 항목 | 기존 값·유지 결과 |
|---|---|
| 공격 데이터 | `ATK.c2`: wind 70ms, act 100ms, rec 140ms |
| 총 지속 시간 | 310ms |
| 실제 타격 창 | `[105,200)ms` |
| combo2 연결 가능 시점 | 233ms |
| 피해·범위·전진 | 11 / reach 82 / 월드 이동 8 |
| 히트스톱 | 3틱 |
| 입력 버퍼 | 220ms |
| 기타 | 기존 피격·대시·기술 취소, 점프·공중 공격, 넉백과 이펙트 유지 |

`player.t × MS`만 읽어 프레임을 선택한다. 애니메이션용 누적 시계는 추가하지 않았다. 기존 엔진은 60Hz 고정 틱이므로 310ms 종료 조건은 **19번째 틱, 약 316.67ms**에 처리된다. 기존 2타도 동일하며 신규 모드에서 지연을 추가하지 않았다. 실제 브라우저 RAF 관측에는 다음 표시 프레임까지의 지연이 더해질 수 있다.

`game.js`, `motion.js`, `barel-art.js`, 기존 `assets/barel/atlas.png`·`frames.json`과 `combo0` 로더·생성 도구·원본/결과 리소스 등 **25개 보호 파일**의 작업 시작/종료 해시가 일치한다. 기존 6프레임 2타는 원래 아틀라스와 코드에 그대로 남아 폴백에 사용된다.

## Aseprite 시간표와 자세 배치

기존 2타는 역일섬(상승 참격)이다. F1을 wind에, F2를 상승 시작에, F3~F4를 주 타격에 맞췄다. F5는 기존 act 종료 후 남는 30ms 타격 유지 구간의 마무리이며 F6~F10은 회수다. 상승 참격 이펙트 자체는 변경하지 않았다.

| 프레임 | 지속 시간 | 구간 ms | 자세 역할 |
|---|---:|---|---|
| F1 | 70 | 0~70 | 낮은 준비 자세 |
| F2 | 35 | 70~105 | 상승 시작 |
| F3 | 35 | 105~140 | 주 타격·검 상승 |
| F4 | 30 | 140~170 | 주 타격·머리 위 마무리 |
| F5 | 30 | 170~200 | 타격 유지·회수 시작 |
| F6 | 20 | 200~220 | 회수 |
| F7 | 20 | 220~240 | 회수·233ms부터 다음 타 연결 가능 |
| F8 | 20 | 240~260 | 자세 복귀 |
| F9 | 25 | 260~285 | 기본 자세 복귀 |
| F10 | 25 | 285~310 | 종료 자세 |

다음 타가 버퍼에 있으면 기존 규칙대로 233ms부터 `combo2`로 전환하므로 뒤쪽 회수 프레임이 생략될 수 있다. 이것은 기존 콤보 취소 동작이다.

## 정렬과 렌더링

공통 기준점 `[200,352]`, 공통 추가 배율 `142/254`를 사용한다. 원본의 서 있는 F9 높이 254픽셀을 기존 바렐의 142 소스 픽셀 높이에 맞추고, 기존 렌더 배율 `.72`를 그대로 곱한다. **파일 픽셀은 축소하지 않고 게임 표시 배율만 맞췄다.**

현재 10개 셀은 모두 같은 발바닥 기준선에 있어 추가 프레임 오프셋은 `[0,0]`이다. 프레임별 강제 확대/축소나 월드 좌표 변경은 없다. 원본의 몸통 기울기와 웅크림, 지지발 교체는 보존했다. 실제 렌더러로 좌우 10프레임 시트와 `combo0 → combo1 → combo2` 경계 시트를 생성해 지면과 크기를 검수했다.

## 연결 위치 및 파일 목록

| 파일 | 작업 |
|---|---|
| `src/animation/barel-combo1.js` | 신규 2타 전용 로더, 메타데이터/시간표/이미지/프레임 경계/배율 검증, 모드 및 폴백 |
| `barel-runtime.js:14` | 기존 combo0 선택 뒤에 combo1 프레임 선택 추가. 기존 렌더러의 이미지·배율 필드 재사용 |
| `index.html:465` | 2타 로더 연결 |
| `server.py` | 스크립트 순서와 실제 Streamlit 컴포넌트의 PNG·JSON·metadata 복사 목록 추가 |
| `tools/build-barel-combo1-10.lua` | 새 원본 분리·경계 검수·원본 픽셀 복사·Aseprite/개별 PNG 생성 |
| `tools/finalize-barel-combo1-10.py` | 원본 해시 및 정렬·전투 검증 메타데이터 생성 |
| `tools/barel-combo1-zoom.lua` | 겹친 원본 영역의 4배 확대 진단 |
| `tests/barel-combo1-10-assets.py` | 픽셀 출처, 부츠 연결, 파편, 캔버스 여백, 지면, CLI 출력 및 보호 파일 검사 |
| `tests/barel-combo1-10.cjs` | 실제 로컬/Streamlit 브라우저 재생·전투·연결·실패 테스트 |
| `tests/regression.cjs`, `tests/streamlit-smoke.cjs` | 2타 테스트 진입점 추가 |
| `tests/barel-combo0-10.cjs` | 기존 1타 단독 테스트에서 새 2타를 legacy로 고정해 기존 격리 조건 유지 |
| 이 문서, `docs/aseprite-cli.md`, `assets/aseprite/README.md` | 리소스·기본 상태·테스트·복구 안내 |

위 리소스 표의 신규 폴더와 편집/PNG/JSON/분리 이력도 생성했다. `src/animation/aseprite.js`, 기존 CLI 스크립트와 combo0 로더·생성 도구는 수정하지 않았다. 전투 엔진 전체 리팩터링이나 새 의존성 추가는 없다.

## 실제 검증 결과

| 항목 | 결과 |
|---|---|
| 기본 적용 상태 | 로컬·Streamlit 모두 `{requested:'aseprite10', effective:'aseprite10', loaded:true, error:null}` |
| 10프레임 표시 | 실제 RAF 시간으로 기존 `loop()`를 실행해 두 환경 모두 F1~F10 표시 확인 |
| 시간·피해·이동 | 기존/신규 19틱 기록 동일, 피해 11 한 번, 전진량 8, 310ms 종료 조건 유지 |
| 타격 자세 | 105ms에 F3, 140ms에 F4, 170ms에 F5, 200ms에 비활성 회수 진입. 실제 상승 이펙트와 함께 출력 검수 |
| 히트스톱 | 실제 `update()` 3틱 정지 중 배우 시간·위치·프레임 고정, 재개 후 동일 시간축으로 진행 |
| 앞뒤 콤보 | 기존 267.5ms 경계의 combo0→combo1, 233ms 경계의 combo1→combo2 확인. 233ms 직전에는 연결되지 않음 |
| 취소·점프 | Shift 입력 대시 취소, 실제 피격 취소, 허용 시점 기술 전환과 시작 구간 취소 차단, 점프·공중 공격 유지 |
| 다른 캐릭터 | 비에사 배우 객체에 신규 프레임이 선택되지 않음 |
| 정렬·파편 | 10개 프레임 모두 연결 성분 1개, F8 뒤쪽 부츠 유지, 캔버스 네 방향 여백 및 원본 RGBA 출처 검사 통과 |
| 좌우 | 실제 렌더러로 양방향 프레임/콤보 경계 시트와 게임 화면 검수 |
| 실패 폴백 | HTTP, JSON 파싱, 시간표, 실제 이미지 오류, 프레임 범위, 공격 ID 불일치, 비정상 오프셋·배율 **8가지**에서 legacy 선택. combo0는 정상 유지 |
| Streamlit | 실제 `server.py` 컴포넌트 경로에서 metadata→JSON→PNG 로드, 재생·취소·폴백 통과 |
| 회귀 검사 | 기존 combo0 브라우저 테스트, combo0/1 리소스 검사, 서버 번들 6개 테스트 통과 |

결과와 화면: `artifacts/barel-combo1-10/local/`, `artifacts/barel-combo1-10/streamlit/`. 양방향 `ten-frames-*.png`, `combo-links-*.png`, `game-*.png`와 실시간 표시 기록 `results.json`을 남겼다. 원본 픽셀·보호 파일 검사는 `artifacts/barel-combo1-10/asset-checks.json`이다. 이 진단 폴더는 기존 Git ignore 대상이며 게임 배포 파일은 리소스 표의 `assets/` 아래에 있다.

미검증 범위: 원격 Streamlit Cloud 배포, 모바일/다른 브라우저, 모든 보스전 조합과 장시간 수동 플레이의 주관적 리듬. 지면과 월드 이동 동일성은 확인했지만 동일 지지발의 해부학적 연속성을 자동 판정한 것은 아니다. F8 가림 부위 보완은 위에 공개한 원본 픽셀 복사 방식이다. 기존 combo2의 구형 디자인/포즈는 이번 교체 범위 밖이라 그대로다.

## legacy 복구 및 상태 확인

로컬 게임 URL에 `?barelCombo1=legacy`를 붙여 새로고침하면 **2타만** 기존 모션으로 바뀐다. `?barelCombo1=aseprite10` 또는 파라미터 생략은 새 모션이다. 1타 모드와 독립적이다.

게임 문서의 개발자 콘솔에서는 다음을 사용한다. Streamlit은 게임 iframe의 콘솔 컨텍스트를 선택한다.

```javascript
BarelCombo1.setMode('legacy');
BarelCombo1.setMode('aseprite10');
BarelCombo1.status();
```

지속 개발 설정은 신규 로더 앞에 `window.BAREL_COMBO1_CONFIG = {mode:'legacy'}`를 지정한다. 기존 6프레임을 삭제하지 않았으므로 파일 복원 없이 모드를 바꿀 수 있다.

## 재현 명령

원본 분리를 재현하려면 아래 배치 생성이 **종료된 뒤** CLI 내보내기를 실행한다.

```powershell
$taskProcess = Start-Process -FilePath 'C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe' -ArgumentList @('--batch','--script-param','root=.','--script-param','input=assets/aseprite/barel-combo1-10/source/original.png','--script','tools/build-barel-combo1-10.lua') -Wait -PassThru -WindowStyle Hidden
if ($taskProcess.ExitCode -ne 0) { throw 'Aseprite combo1 build failed' }
powershell -NoProfile -ExecutionPolicy Bypass -File tools/export-sprites.ps1 -Source assets/aseprite/barel-combo1-10/barel-combo1-10.aseprite -Force
.venv-streamlit-test/Scripts/python.exe tools/finalize-barel-combo1-10.py
.venv-streamlit-test/Scripts/python.exe tests/barel-combo1-10-assets.py
$env:BAREL_COMBO1_SUITE='1'
node tests/regression.cjs
node tests/streamlit-smoke.cjs
Remove-Item Env:BAREL_COMBO1_SUITE
$env:BAREL_COMBO0_SUITE='1'
node tests/regression.cjs
Remove-Item Env:BAREL_COMBO0_SUITE
.venv-streamlit-test/Scripts/python.exe tests/barel-combo0-10-assets.py
.venv-streamlit-test/Scripts/python.exe -m unittest discover -s tests -p test_server_bundle.py
```

편집한 `.aseprite`를 직접 내보내면 개별 PNG와 메타데이터도 동기화해야 한다. 생성 스크립트는 보존한 원본 시트에서 다시 만들기 때문에 수동 편집 결과는 별도로 보존한 뒤 실행한다.
