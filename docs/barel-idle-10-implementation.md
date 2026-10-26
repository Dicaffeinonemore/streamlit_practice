# 바렐 Idle 10프레임 적용 완료

현재 기본 대기는 도트 원본으로 교체되었습니다. [대기 도트·보스챌린지 적용 기록](barel-idle-dot-10-implementation.md)을 참조하세요. 아래는 이전 리소스의 구현 기록입니다.

2026-10-25. 첨부 대기 시트의 실제 10프레임을 분리하고 로컬 Chrome·실제 Streamlit iframe에서 검증했다. **일반 플레이어 idle의 기본 모드는 `aseprite10`**이다. 기존 세 콤보와 전투·이동 상태 전환은 유지한다.

## 파일 경로

| 용도 | 경로 |
|---|---|
| 원본 보존 | [original.png](../assets/aseprite/barel-idle-10/source/original.png) |
| Aseprite 편집 파일 | [barel-idle-10.aseprite](../assets/aseprite/barel-idle-10/barel-idle-10.aseprite) |
| 게임 PNG | [barel-idle-10.png](../assets/aseprite/exports/barel-idle-10/barel-idle-10.png) |
| Aseprite JSON·시간표 | [barel-idle-10.json](../assets/aseprite/exports/barel-idle-10/barel-idle-10.json) |
| 정렬·루프 메타데이터 | [barel-idle-10.animation.json](../assets/aseprite/barel-idle-10/barel-idle-10.animation.json) |
| 개별 PNG | `assets/aseprite/barel-idle-10/F01.png` ~ `F10.png` |
| 분리·픽셀 복사 기록 | `assets/aseprite/barel-idle-10/separation.json` |
| 기존 idle 참조 보존 | `assets/aseprite/barel-idle-10/source/legacy-idle.frames.json` |

원본은 2172×724 RGBA이며 SHA-256은 `9e910d98d75c7248427eb9d08bd4bba84a365062180c1e5814a8ff6d6ceb61e8`이다. 검게 보이는 바깥 배경은 실제 투명 알파이며, 검은 갑옷을 색상 기준으로 지우지 않았다. 알파 32 미만의 희미한 잡음만 제외했다.

대검까지 포함한 높이가 약 389 소스 픽셀이므로 **448×448 셀 10개, 4480×448 시트**를 사용했다. 원본 샘플은 1:1이며 파일 픽셀을 확대·축소하거나 새 그림·색상을 만들지 않았다. 행별 실제 윤곽과 투명 간격을 분석해 분리했으며 단순 10등분은 사용하지 않았다.

원본에서는 앞 프레임의 앞발끝과 다음 프레임의 뒤꿈치가 겹친다. F1~F9에서 가려진 발끝만 **같은 원본의 가려지지 않은 F10 발끝 픽셀**로 보완했다. 기존 보이는 픽셀은 덮어쓰지 않았다. 남긴 복사 픽셀은 총 3,847개이며 `sourcePixelClones`에 대상/원본 좌표를 기록했다. 모든 출력 픽셀을 해당 원본 좌표의 RGBA와 대조했다. 무릎에 붙은 다음 망토와 이전 발 조각도 제외했다. 각 셀은 하나의 연결된 캐릭터이며 투구·검·망토·발끝과 캔버스 여백을 검수했다.

## 재생 주기와 시간 관리

기존 코드의 idle은 `barelFrame('idle', tick * MS / 1300, true)`였다. 따라서 **기존 한 주기 1300ms를 유지**하고, 신규 F1~F10 각각에 130ms를 배정했다. 기존 6프레임의 개별 표시 시간은 약 216.67ms였으나 새 프레임 수가 늘어난 만큼 분할했으며 호흡 주기를 늘리거나 줄이지 않았다.

- F1~F10 시작 시각: 0, 130, 260, 390, 520, 650, 780, 910, 1040, 1170ms.
- 1300ms에 F10에서 F1로 반복한다.
- 기존 **`tick × MS` 전역 시간축**만 사용한다. 새 누적 시계는 없다.
- idle 진입 때 시간을 초기화하지 않는다. 공격·점프·이동 후 기존 전역 위상으로 복귀한다.
- 일시정지 시 기존 tick과 함께 정지한다. 전투 히트스톱의 tick/공격 시간 처리도 변경하지 않았다.
- 비전투 루프이므로 메타데이터에 `animationType:'loop'`, `loop:true`, `durationMs:1300`을 사용하며 가짜 전투 구간을 넣지 않았다.

## 정렬과 크기

공통 기준점은 `[200,416]`, 추가 표시 배율은 **`142/355 = 0.4`**다. 원본의 투구 상단부터 발바닥까지 355픽셀을 기존 142 소스 픽셀 몸통 높이에 맞췄다. 기존 바렐 `.72`와 스테이지 줌은 그대로다. 파일 픽셀은 축소하지 않으며 렌더링 배율만 관리한다. combo2 F10과 idle의 정규화된 몸통 높이는 모두 142다.

발바닥 끝의 0~1 소스 픽셀 차이를 수직 오프셋으로 정리했다. 수평은 양쪽 발의 소스 영역 중심을 측정해 **F1의 양발 중점**을 기준으로 공통 평행 이동을 적용했다. 원본의 발 간격·각도와 몸통 기울기는 바꾸지 않았다.

| 프레임 | 수평 오프셋 | 수직 오프셋 |
|---|---:|---:|
| F1 | 0 | 1 |
| F2 | 4.821 | 0 |
| F3 | 6.210 | 0 |
| F4 | 6.595 | 0 |
| F5 | 7.298 | 1 |
| F6 | 6.557 | 0 |
| F7 | 5.736 | 1 |
| F8 | 5.585 | 1 |
| F9 | 5.841 | 0 |
| F10 | 1.309 | 0 |

단위는 배율·반전 전 소스 픽셀이다. 수평 보정 최대치는 기본 바렐 렌더 좌표계에서 약 2.1픽셀이다. 양발 중점은 주기 내 고정되지만, 원본에 있는 발 간격 차이 때문에 개별 발끝에는 약 2.1픽셀 범위의 변화가 남는다. 이를 없애기 위해 발을 다시 그리거나 매 프레임 다른 배율을 적용하지 않았다. **실제 월드 좌표·충돌 박스는 바꾸지 않았다.**

## 생성·수정 코드

| 파일 | 작업 |
|---|---|
| `src/animation/barel-idle.js` | idle 전용 로더·기존 전역 시계 샘플링·모드·검증·자동 폴백 |
| `barel-runtime.js` | 기존 공격/스킬/점프/승리 분기 뒤의 일반 대기 선택에만 신규 idle 추가. 기존 렌더러 재사용 |
| `index.html`, `server.py` | 로더 순서와 실제 Streamlit 컴포넌트의 metadata·JSON·PNG 경로 추가 |
| `src/animation/aseprite.js` | 비전투 루프 메타데이터 지원. 기존 공격 메타데이터 검증은 회귀 검사로 유지 |
| `tools/build-barel-idle-10.lua` | 원본 분리·발끝 원본 픽셀 보완·파편 제거·편집/개별 PNG 생성 |
| `tools/finalize-barel-idle-10.py` | 원본 해시, 투구 높이, 발 중심 측정 및 정렬·1300ms 메타데이터 생성 |
| `tools/barel-idle-zoom.lua` | 겹친 발·망토 영역 확대 진단 |
| `tests/barel-idle-10-assets.py` | 출처·연결 성분·여백·발끝·지면·정렬·CLI 출력·보호 파일 검사 |
| `tests/barel-idle-10.cjs` | 실제 브라우저/Streamlit 반복·상태 복귀·폴백 테스트 |
| `tests/aseprite-loop.cjs` | 비전투 루프 스키마·정확한 반복 경계·오류 검사 |
| `tests/regression.cjs`, `tests/streamlit-smoke.cjs` | idle 전용 테스트 진입점 |
| 세 `tests/barel-combo*-10.cjs` | 공격 단독 테스트에서 idle만 legacy로 고정하는 테스트 격리 설정 추가 |
| 이 문서, CLI 문서, 리소스 README | 적용 상태·시간표·복구 안내 |

`game.js`, `motion.js`, 기존 아틀라스·프레임, 세 콤보의 로더·생성 도구·원본/결과 등 **67개 보호 파일**이 작업 시작 시점과 해시 일치한다. 공용 Aseprite 파서는 의도한 루프 지원만 추가했고 기존 세 공격 계약을 별도로 재검증했다. 기존 idle 6프레임과 이전 백업도 보존했다. 새 의존성·전체 리팩터링은 없다.

## 실제 검증 결과

로컬 Chrome과 실제 `server.py` Streamlit iframe에서 모두 다음을 확인했다.

| 검증 | 결과 |
|---|---|
| 기본 상태 | `requested/effective=aseprite10`, `loaded=true`, `error=null` |
| 10프레임·반복 | 기존 실제 `loop()`를 native RAF 시각으로 약 2.9초 실행. F1~F10 전체 및 F10→F1 두 차례 확인 |
| 좌우 | 실제 렌더러의 양방향 프레임 시트·게임 화면 검수 |
| 이동↔대기 | 이동 중 기존 walk 사용, 키 해제 다음 업데이트에서 새 idle 복귀, 위치 추가 이동 없음 |
| 공격↔대기 | 기존 공격 모션 사용 후 idle 복귀. 진입 때 루프 위상을 초기화하지 않음 |
| 3연타 종료 | 기존 버퍼로 combo0→combo1→combo2 후 free·idle 복귀. 최종 x=332로 기존 8+8+16 전진량 유지 |
| 점프·피격·다운 | 기존 점프와 착지, 피격 17틱, 다운·착지·기상 후 새 idle 복귀 확인 |
| 다른 상태 | 이동·대시·세 공격·피격·다운·사망·캐스팅·기술·필살기·잡힘·공중 상태의 선택 프레임이 idle 모드와 무관하게 동일 |
| 크기·지면 | 몸통 높이 정규화, 같은 actor 좌표의 combo2 종료/idle 시트 시각 검수, 발바닥 오프셋·양발 중점 검사 통과 |
| 시뮬레이션 | legacy/new 160틱의 x/y/z/t/HP/상태/충돌 폭 기록 동일. 프레임 선택·렌더링이 actor 좌표를 바꾸지 않음 |
| 일시정지 | tick과 idle 위상 정지, 재개 시 이어서 진행 |
| 오류 복구 | HTTP·파싱·프레임 시간·이미지·프레임 범위·ID·오프셋·배율·주기·시계·루프 표시 오류 11가지에서 legacy 복귀. 세 콤보는 계속 정상 |
| 회귀 | 세 콤보 로컬 실제 브라우저, 네 리소스 검사, 기존 Aseprite/350ms/terminal/loop 단위 검사, 서버 번들 6개 검사 통과 |

기록은 `artifacts/barel-idle-10/local/`과 `streamlit/`의 `results.json`, `ten-frames-*.png`, `combo2-idle-*.png`, `game-*.png`에 있다. 픽셀·정렬·보호 파일은 `artifacts/barel-idle-10/asset-checks.json`에 기록했다. 진단 폴더는 기존 Git ignore 대상이며 배포 리소스는 위 `assets/` 경로다.

남은 시각적 차이는 원본의 발 간격·호흡 자세와 검을 내려 든 combo2 종료에서 검을 세운 idle로 바뀌는 자세 전환이다. 지면·몸통 높이·actor 좌표를 검수했지만 다른 자세를 서로 같은 그림으로 바꾸지는 않았다. 캐릭터 선택용 아틀라스 미리보기는 별도 기존 UI 경로라 이번 일반 플레이어 idle 적용 범위에서 유지했다. 원격 Streamlit Cloud 배포·모바일/다른 브라우저·장시간 수동 플레이는 미검증이다.

## 복구 방법

로컬 URL의 `?barelIdle=legacy`는 기존 6프레임, 파라미터 생략 또는 `?barelIdle=aseprite10`은 신규 idle이다. 게임 개발자 콘솔에서도 즉시 전환할 수 있다. Streamlit은 게임 iframe 컨텍스트를 선택한다.

```javascript
BarelIdle.setMode('legacy');
BarelIdle.setMode('aseprite10');
BarelIdle.status();
```

지속 개발 설정은 로더 앞에 `window.BAREL_IDLE_CONFIG = {mode:'legacy'}`를 지정한다. 파일 복원 없이 idle만 바뀌며 세 콤보 모드는 독립적이다.

## 재현 명령

```powershell
$taskProcess = Start-Process -FilePath 'C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe' -ArgumentList @('--batch','--script-param','root=.','--script-param','input=assets/aseprite/barel-idle-10/source/original.png','--script','tools/build-barel-idle-10.lua') -Wait -PassThru -WindowStyle Hidden
if ($taskProcess.ExitCode -ne 0) { throw 'Aseprite idle build failed' }
powershell -NoProfile -ExecutionPolicy Bypass -File tools/export-sprites.ps1 -Source assets/aseprite/barel-idle-10/barel-idle-10.aseprite -Force
.venv-streamlit-test/Scripts/python.exe tools/finalize-barel-idle-10.py
.venv-streamlit-test/Scripts/python.exe tests/barel-idle-10-assets.py
node tests/aseprite-loop.cjs
$env:BAREL_IDLE_SUITE='1'
node tests/regression.cjs
node tests/streamlit-smoke.cjs
Remove-Item Env:BAREL_IDLE_SUITE
```

수동 편집본은 별도로 보존한 뒤 생성 스크립트를 사용한다. 직접 편집해 내보냈다면 개별 PNG·정렬 데이터·픽셀 출처 검사도 동기화해야 한다.
