# 바렐 3타 combo2 10프레임 적용 완료

2026-10-25. 첨부 `바렐 3타.png`의 실제 동작 **10개**를 분리하고 로컬 Chrome 및 실제 Streamlit iframe 검증 후 **`aseprite10`을 기본 적용**했다. 기존 `combo0`·`combo1`은 유지되며, 이제 3연타 모두 신규 10프레임을 기본 사용한다.

## 신규 파일과 리소스

| 용도 | 경로 |
|---|---|
| 원본 보존본 | [original.png](../assets/aseprite/barel-combo2-10/source/original.png) |
| Aseprite 편집 파일 | [barel-combo2-10.aseprite](../assets/aseprite/barel-combo2-10/barel-combo2-10.aseprite) |
| 실게임 PNG | [barel-combo2-10.png](../assets/aseprite/exports/barel-combo2-10/barel-combo2-10.png) |
| Aseprite JSON·프레임 시간 | [barel-combo2-10.json](../assets/aseprite/exports/barel-combo2-10/barel-combo2-10.json) |
| 정렬·검증 메타데이터 | [barel-combo2-10.animation.json](../assets/aseprite/barel-combo2-10/barel-combo2-10.animation.json) |
| 개별 PNG | `assets/aseprite/barel-combo2-10/F01.png` ~ `F10.png` |
| 분리 이력 | `assets/aseprite/barel-combo2-10/separation.json` |
| 기존 8프레임 참조 보존 | `assets/aseprite/barel-combo2-10/source/legacy-combo2.frames.json` |

원본은 **1916×821 RGBA**, SHA-256 `59d5dfc5b25d690aac31c2aefb4a6581b0610734a66bb2561cbcdbe36c47f43d`이다. 데스크톱 원본은 수정하지 않았다. 실제 투명 알파를 사용하며 알파 32 미만의 희미한 잡음을 제외했다.

384×384 셀 10개, 3840×384 시트에 원본 픽셀을 **1:1로 배치**했다. 강제 축소·늘이기·재샘플링·재드로잉·다른 프레임 픽셀 복사는 없다. 갑옷·투구·망토·체형·대검 디자인과 남긴 RGBA는 원본 그대로다. 모든 출력 픽셀을 원본 해당 위치와 대조했다.

단순 10등분은 사용하지 않았다. 행별 투명 간격과 검 윤곽을 분석하고, F6~F7 검 끝과 다음 부츠가 맞닿는 곳은 5배 확대해 소유 영역을 보정했다. 각 프레임의 캐릭터는 연결 성분 하나이며 분리된 파편과 이웃 검 조각을 제거했다. 모든 셀에서 네 방향 여백과 검 끝 경계를 확인했다.

## 기존 전투 값과 시간표

| 항목 | 변경 없이 유지한 값 |
|---|---|
| `ATK.c3` | wind 200ms / act 140ms / rec 340ms |
| 전체 공격 시간 | 680ms |
| 실제 타격 창 | `[249,370)ms` |
| 자유 상태 복귀 | `player.t × MS >= 680` 조건에서 `free`, combo=0, comboT=0 |
| 다음 타 연결 | 없음. 3타는 마지막 공격 |
| 피해·범위·전진 | 16 / reach 98 / 월드 이동 16 |
| 피격 결과 | `kd:true`; 일반 적 down, 수평 속도 `dir×4`, 수직 속도 5 |
| 히트스톱·입력 버퍼 | 7틱 / 220ms |
| 검기 발생 | 284ms부터, 1회 |
| 지면 충격 발생 | 319ms부터, 1회 |
| 기타 | 기존 넉백·공격 취소·피격 취소·대시·점프·기술 전환·이펙트 유지 |

60Hz 고정 틱 엔진이므로 실제 첫 타격 검사는 15틱(250ms), 검기는 18틱(300ms), 지면 충격은 20틱(약 333.33ms), 자유 상태 복귀는 41틱(약 683.33ms)에 처리된다. 이 양자화는 기존 모드와 동일하며 새로운 지연을 추가하지 않았다. 히트스톱 동안에는 공격 시간이 정지하므로 현실 시간상 완료는 그만큼 늦어진다.

애니메이션은 **`player.t × MS`만 읽으며 별도 누적 시계가 없다.** 기존 `game.js`와 `motion.js`는 수정하지 않았다.

| 프레임 | 지속 ms | 구간 ms | 역할 |
|---|---:|---|---|
| F1 | 70 | 0~70 | 대검을 머리 위로 든 준비 |
| F2 | 60 | 70~130 | 힘 모으기 |
| F3 | 70 | 130~200 | 원본의 무릎을 든 도약 준비 자세 |
| F4 | 20 | 200~220 | 내려찍기 시작 |
| F5 | 29 | 220~249 | 가속·타격 직전 |
| F6 | 91 | 249~340 | 주 타격. 검기 284ms·지면 충격 319ms와 같은 자세 |
| F7 | 30 | 340~370 | 타격 유지·마무리 |
| F8 | 90 | 370~460 | 대검 회수 |
| F9 | 90 | 460~550 | 자세 복귀 |
| F10 | 130 | 550~680 | 종료 자세·무게감 있는 회복 |

메타데이터는 `terminalAttack:true`, `combat.comboLinkMs:null`로 마지막 공격임을 명시한다. 공용 Aseprite 어댑터에 이 경우의 검증과 `canLink:false` 처리를 최소 추가했다. 기존 1·2타의 숫자형 연결 시점 검증은 그대로 유지하며 별도 회귀 테스트를 통과했다. 메타데이터가 전투 이벤트를 구동하지는 않는다. 검기·충격은 기존 전투 코드가 발생시킨다.

## 정렬

공통 기준점 `[200,352]`, 추가 표시 배율 `142/221`을 기존 바렐 `.72` 배율과 곱한다. F10의 원본 기본 자세 높이 221픽셀을 기존 바렐의 142 소스 픽셀 높이에 맞췄다. 파일 픽셀은 축소하지 않는다.

F3의 원본 발끝은 기준선보다 1 소스 픽셀 위에 있어 수직 렌더 오프셋 `[0,1]`만 적용했다. 나머지 프레임은 `[0,0]`이다. 프레임별 배율 변경·추가 수평 보정·실제 월드 좌표 보정은 없다. 원본의 무릎 들기·몸통 기울기·낮은 타격 자세는 보존했다.

실제 렌더러로 양방향 10프레임 시트와 `combo1 → combo2 준비 → 내려찍기 → 종료` 경계 시트를 생성해 크기·지면·칼끝을 시각 검수했다.

## 변경·생성 코드 목록

| 파일 | 작업 |
|---|---|
| `src/animation/barel-combo2.js` | 신규 3타 로더·모드·엄격한 메타데이터/이미지/시간표/경계 검증·자동 폴백 |
| `barel-runtime.js:14` | 기존 두 타의 선택 뒤에 3타 렌더 프레임 선택 추가 |
| `index.html` | Aseprite 및 앞선 로더 다음에 3타 로더 연결 |
| `server.py` | 스크립트 목록과 Streamlit 컴포넌트의 신규 metadata·JSON·PNG 복사 목록 추가 |
| `src/animation/aseprite.js` | 마지막 공격의 null 연결 시점 지원. 기존 두 공격의 검증·시간 샘플링 유지 |
| `tools/build-barel-combo2-10.lua` | 원본 분리·검 영역 검수·파편 제거·편집/개별 PNG 생성 |
| `tools/finalize-barel-combo2-10.py` | 원본 해시 확인, 정렬·시간·마지막 공격 메타데이터 생성 |
| `tools/barel-combo2-zoom.lua` | 겹친 검·부츠 영역의 5배 확대 진단 이미지 |
| `tests/barel-combo2-10-assets.py` | 원본 RGBA, 연결 성분, 크롭, 지면, CLI 출력, 보호 파일 해시 검사 |
| `tests/barel-combo2-10.cjs` | 로컬/Streamlit 실재생·전투·넉백·연결·종료·오류 테스트 |
| `tests/aseprite-terminal.cjs` | 마지막 공격 연결 금지와 기존 1·2타 연결 경계 회귀 검사 |
| `tests/regression.cjs`, `tests/streamlit-smoke.cjs` | 신규 3타 테스트 진입점 추가 |
| `tests/barel-combo0-10.cjs`, `tests/barel-combo1-10.cjs` | 기존 타 단독 검증에서 3타를 legacy로 고정하는 테스트 격리 설정만 추가 |
| 이 문서, 기존 1·2타 보고서 상단, CLI 문서, 리소스 README | 현재 적용 상태·테스트·복구 안내 |

리소스 표의 파일과 신규 폴더도 생성했다. 작업 시작 시점 대비 **44개 보호 파일**(전투 코드, 기존 아틀라스·프레임, combo0/1 전용 로더·생성 도구·원본 및 결과 리소스)의 SHA-256이 일치한다. 기존 8프레임 3타와 모든 이전 백업은 보존했다. 새 의존성이나 엔진 전체 리팩터링은 없다.

## 실제 테스트 결과

| 항목 | 결과 |
|---|---|
| 기본 적용 | 로컬 Chrome·실제 Streamlit iframe 모두 `requested/effective=aseprite10`, `loaded=true`, `error=null` |
| 10프레임 | 실제 RAF 시각으로 기존 게임 `loop()`를 실행해 F1~F10 전부 표시 확인 |
| 공격 시간·피해·전진 | legacy/new 41틱 기록 동일. 16 피해 1회, 전진 16, 동일 종료 조건 |
| 넉백 | 두 모드 모두 일반 적 down, vx=4/vz=5. 프레임마다 적 상태·HP·속도 기록 동일 |
| 검기·충격 | 기존 임계 시점 이후 같은 18틱/20틱에 각 1회 발생. F6 표시 확인 |
| 히트스톱 | 실제 `update()` 7틱 정지 중 배우 시간·위치·프레임 동일, 이후 같은 시계로 재개 |
| 콤보·종료 | combo0→combo1→combo2 연결, 4타 연결 없음, 종료 후 free·combo 초기화 확인 |
| 취소·점프 | Shift 대시·실제 피격 취소, 허용된 회복 중 기술 전환, 시작 구간 기술/점프 취소 차단, 정상 점프·공중 공격 유지 |
| 좌우·파편 | 양방향 게임 화면과 프레임 시트 검수. 모든 셀 단일 연결 성분·네 방향 여백·원본 RGBA 일치 |
| 폴백 | HTTP, JSON 파싱, 시간표, 실제 이미지 오류, 프레임 범위, 공격 ID, 오프셋, 배율, 마지막 공격 표시, 이벤트 시점 불일치 **10가지**에서 legacy 선택. 앞선 두 공격은 유지 |
| Streamlit 경로 | 실제 `server.py` 컴포넌트에서 상대 경로 metadata→JSON→PNG 로드·재생·폴백 성공 |
| 회귀 | combo0/1 로컬 브라우저, 세 공격의 리소스 검사, 기존 Aseprite/350ms/terminal 단위 검사, 서버 번들 6개 테스트 통과 |

결과·양방향 `ten-frames-*.png`, `combo-links-*.png`, 실제 `game-*.png`, 실시간 기록 `results.json`은 `artifacts/barel-combo2-10/local/` 및 `streamlit/`에 있다. 원본·해시 검사는 `artifacts/barel-combo2-10/asset-checks.json`에 있다. 이 진단 폴더는 기존 Git ignore 대상이며 배포 리소스는 `assets/` 아래 파일이다.

미검증 범위는 원격 Streamlit Cloud 배포, 모바일/다른 브라우저, 모든 보스의 방어·기절 상태 조합 및 장시간 수동 플레이의 체감 리듬이다. 발 기준선과 월드 이동 동일성은 검증했지만 동일 지지발의 해부학적 연속성을 자동 판정한 것은 아니다. 기존 idle/스킬/다른 캐릭터 리소스는 이번 범위 밖이라 유지했다.

## 모드 선택·복구

로컬 URL에 `?barelCombo2=legacy`를 붙여 새로고침하면 **3타만** 기존 8프레임으로 바뀐다. 파라미터 생략 또는 `?barelCombo2=aseprite10`은 신규 10프레임이다.

게임 개발자 콘솔에서는 다음을 사용한다. Streamlit은 게임 iframe의 컨텍스트를 선택한다.

```javascript
BarelCombo2.setMode('legacy');
BarelCombo2.setMode('aseprite10');
BarelCombo2.status();
```

지속적인 개발 설정은 신규 로더 전에 `window.BAREL_COMBO2_CONFIG = {mode:'legacy'}`를 지정한다. 각 타의 모드와 폴백은 독립적이므로 파일을 되돌리거나 앞선 두 공격을 끌 필요가 없다.

## 재현 명령

원본 분리를 다시 생성할 경우 Aseprite 배치 프로세스의 종료를 기다린 후 내보낸다. 기존 내보내기 스크립트는 수정하지 않았다.

```powershell
$taskProcess = Start-Process -FilePath 'C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe' -ArgumentList @('--batch','--script-param','root=.','--script-param','input=assets/aseprite/barel-combo2-10/source/original.png','--script','tools/build-barel-combo2-10.lua') -Wait -PassThru -WindowStyle Hidden
if ($taskProcess.ExitCode -ne 0) { throw 'Aseprite combo2 build failed' }
powershell -NoProfile -ExecutionPolicy Bypass -File tools/export-sprites.ps1 -Source assets/aseprite/barel-combo2-10/barel-combo2-10.aseprite -Force
.venv-streamlit-test/Scripts/python.exe tools/finalize-barel-combo2-10.py
.venv-streamlit-test/Scripts/python.exe tests/barel-combo2-10-assets.py
node tests/aseprite-terminal.cjs
$env:BAREL_COMBO2_SUITE='1'
node tests/regression.cjs
node tests/streamlit-smoke.cjs
Remove-Item Env:BAREL_COMBO2_SUITE
```

수동 편집한 `.aseprite`는 별도로 보존한 뒤 생성 스크립트를 실행한다. 직접 편집 후 내보냈다면 개별 PNG·메타데이터·출처 검사를 함께 동기화해야 한다.
