# 바렐 기본 공격 10프레임 실게임 테스트 적용

2026-10-25. 새 첨부 원본을 분리 검수해 `combo0`에 연결했다. 기본 모드는 `aseprite10`이며 로딩·파싱·시간표·이미지 경계 검증 실패 시 기존 6프레임을 사용한다. 기존 전투 로직과 다른 모션은 그대로다.

## 리소스와 분리 결과

- 원본 보존: [original.png](../assets/aseprite/barel-combo0-10/source/original.png), 2048×682.
- 편집 파일: [barel-combo0-10.aseprite](../assets/aseprite/barel-combo0-10/barel-combo0-10.aseprite).
- 신규 PNG: [barel-combo0-10.png](../assets/aseprite/exports/barel-combo0-10/barel-combo0-10.png), **3840×384**, 384×384 셀 10개.
- Aseprite 시간표: [barel-combo0-10.json](../assets/aseprite/exports/barel-combo0-10/barel-combo0-10.json).
- 정렬 메타데이터: [barel-combo0-10.animation.json](../assets/aseprite/barel-combo0-10/barel-combo0-10.animation.json).
- 개별 프레임: `assets/aseprite/barel-combo0-10/F01.png` ~ `F10.png`.
- 분리 기록: `assets/aseprite/barel-combo0-10/separation.json`.

이전 256×256 버전은 사용하지 않았다. 새 원본은 체크무늬가 불투명 RGB로 포함돼 있어 배경 영역을 마스킹했다. 원본 픽셀 밀도를 유지하기 위해 256으로 축소하지 않고 여백이 충분한 384×384 셀에 1:1로 배치했다. **남긴 모든 픽셀의 RGBA가 원본 해당 위치와 동일한지 검사했다.** 색상·디자인을 다시 그리거나, 프레임 이미지를 늘이거나 줄이거나, 원본 파일을 덮어쓰지 않았다.

F5~F8은 4배 확대에서 검 끝과 다음 부츠가 만나는 실제 윤곽을 확인했다. 행별 분리선과 검 영역 마스크를 조합해 검은 앞 동작에, 부츠는 다음 동작에 남겼다. F1·F9의 검 근처에 들어오는 다음 망토의 색상 잔여물도 제외했다. 단순 10등분은 사용하지 않았다. 각 셀은 8방향 연결 기준 **캐릭터 성분 하나만 남기며**, 분리된 망토 미세 점도 잔여 파편으로 처리한다. 이 검사는 고립된 파편 부재를 보장하며, 연결된 오염은 확대 이미지와 실제 렌더링으로 별도 검수했다.

원본 SHA-256: `abb1d1c08a8195a329e542fcc0e31de990b17a77ab70746d14225eb8ff1c1477`.

## 정렬과 시간

시간표는 Aseprite JSON의 `[40,30,35,25,25,30,45,25,40,55]`ms, 합계 350ms다. 렌더러는 기존 `player.t × MS`만 읽으며 별도 누적 시계를 사용하지 않는다.

공통 기준점은 `[160,353]`, 공통 추가 렌더 배율은 `142/246`이다. 기존 바렐 배율 `.72`와 곱해 새 기본 자세 높이를 기존 142 소스 픽셀 높이에 맞춘다. F4는 1, F5는 2 소스 픽셀만 아래로 보정해 발바닥 기준선을 맞췄다. 이외 수직 보정은 0이며 추가 수평 보정은 없다. 프레임별 배율 변경이나 월드 좌표 보정은 없다. 원본 내 자세 변화에 따른 골반·발 위치 변화는 유지한다.

`game.js`, `motion.js`, `barel-art.js`, 기존 `assets/barel/atlas.png`, `assets/barel/frames.json`은 적용 전후 SHA-256이 일치한다. 350ms, 타격 `[128.5,230)ms`, 콤보 연결 267.5ms, 공격력 10, 전진량 8, 기존 입력 버퍼·히트스톱·취소 처리는 수정하지 않았다.

## 연결 코드와 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `barel-runtime.js` | `barelPlayerFrame()`에서 `combo0` 대체 프레임 선택. `paintBarel()`에서 프레임 전용 이미지와 공통 보정 배율 사용 |
| `src/animation/barel-combo0.js` | 메타데이터 로드·검증, 모드 선택, 기존 배우 시간 샘플링, 자동 폴백 |
| `index.html` | 기존 바렐 런타임 전에 Aseprite 어댑터와 신규 로더 연결 |
| `server.py` | 스크립트 순서 동기화, Streamlit 컴포넌트에 메타데이터·JSON·PNG 배포 |
| `tools/build-barel-combo0-10.lua` | Aseprite에서 배경·소유 경계 처리, 파편 제거, 10프레임 편집 파일 생성 |
| `tools/finalize-barel-combo0-10.py` | 원본 해시 확인 및 정렬 메타데이터 생성. 이미지 수정 없음 |
| `tools/barel-overlap-zoom.lua` | 원본 접점의 4배 확대 진단 이미지 출력 |
| `tests/barel-combo0-10-assets.py` | 원본 RGB/밀도, 연결 성분, 지면, 캔버스 여백, CLI 내보내기 픽셀 검사 |
| `tests/barel-combo0-10.cjs` | 로컬/Streamlit 공용 실제 브라우저 게임 테스트 |
| `tests/regression.cjs`, `tests/streamlit-smoke.cjs` | 신규 전용 테스트 실행 진입점 |
| `docs/barel-combo0-10-review.md`, 이 문서, `docs/aseprite-cli.md`, `assets/aseprite/README.md` | 현재 적용 상태 및 실행·복구 안내 |

`src/animation/aseprite.js`, 미리보기 어댑터, 기존 Aseprite CLI 내보내기 스크립트는 유지했다. 새 리소스 폴더의 소스·개별 PNG·분리 기록·편집 파일·검수 시트와 `exports/barel-combo0-10/`의 PNG·JSON을 추가했다. 기존 6프레임 및 이전 256×256 리소스는 보존했다.

## 실제 검증 결과

| 항목 | 결과 |
|---|---|
| 10프레임 표시 | 로컬 Chrome 및 실제 Streamlit iframe의 실시간 RAF/고정 틱 게임 루프에서 F1~F10 전부 표시 |
| 종료 시간 | 게임 시간 350ms에 종료. 실시간 첫 자유 상태 관측은 로컬 약 350.9ms, Streamlit 약 351.5ms로 렌더 프레임 오차 범위 |
| 피해·이동·판정 | 기존/신규 모드의 21틱 공격 기록 동일. 10 피해 1회, 월드 전진 8. 타격/콤보 경계 상수 확인 |
| 히트스톱 | 실제 `update()` 정지 3틱 동안 `player.t`, 위치, 표시 프레임 동일. 재개 후 같은 시계로 진행 |
| 콤보/취소 | 버퍼 입력으로 combo1 연결, Shift 대시 취소, 피격 취소, 허용 시점 기술 전환 확인. 시작 구간 기술 취소 차단도 유지 |
| 점프/다른 모션 | 점프, 공중 공격, combo1, 기술이 기존 프레임 사용 |
| 지면/크기/좌우 | 기존 기본 자세 높이 일치, 모든 셀 발바닥 보정 일치, 실제 렌더러로 양방향 10프레임 시트 출력·시각 검수 |
| 파편·크롭 | 모든 셀에 연결 성분 1개, 네 방향 여백 존재, 검 끝 포함 전체 윤곽 확대·인게임 출력 검수 |
| 폴백 | HTTP 실패, JSON 파싱 실패, 시간표 불일치, 실제 이미지 로딩 오류에서 legacy 프레임 선택 |
| Streamlit 경로 | 실제 `server.py`의 컴포넌트 URL에서 메타데이터 → JSON → PNG 상대 경로 로딩 및 재생 성공 |

검증 명령:

```powershell
.venv-streamlit-test/Scripts/python.exe tests/barel-combo0-10-assets.py
$env:BAREL_COMBO0_SUITE='1'
node tests/regression.cjs
node tests/streamlit-smoke.cjs
Remove-Item Env:BAREL_COMBO0_SUITE
node tests/aseprite.cjs
node tests/aseprite-350ms.cjs
.venv-streamlit-test/Scripts/python.exe tests/aseprite-assets.py
.venv-streamlit-test/Scripts/python.exe tests/aseprite-350ms-assets.py
.venv-streamlit-test/Scripts/python.exe -m unittest discover -s tests -p test_server_bundle.py
```

실제 브라우저 결과·스크린샷·실시간 프레임 캡처: `artifacts/barel-combo0-10-v2/local/`, `artifacts/barel-combo0-10-v2/streamlit/`. 파편·픽셀 검사: `artifacts/barel-combo0-10-v2/asset-checks.json`. `artifacts/`는 기존 Git ignore 대상이므로 배포 리소스가 아니다.

미검증 범위는 Streamlit Cloud에 실제 배포한 원격 실행, 모바일/다른 브라우저, 모든 보스전 조합과 장시간 수동 플레이에서의 주관적 자연스러움이다. 발 기준선 정렬과 전진량은 검증했지만 각 자세에서 동일한 지지발을 해부학적으로 추적하는 연속성 평가는 별도 아트 검수 범위다. 원본 자체에 포함된 밝은 가장자리와 동작 차이는 재도색하지 않았다.

## 모드 선택과 복구

로컬 게임 URL에 `?barelCombo0=legacy`를 붙여 새로고침하면 기존 6프레임을 사용한다. `?barelCombo0=aseprite10` 또는 파라미터 생략은 신규 10프레임이다.

게임 문서의 개발자 콘솔에서 즉시 전환할 수도 있다. Streamlit에서는 게임 iframe의 콘솔 컨텍스트를 선택한다.

```javascript
BarelCombo0.setMode('legacy');     // 기존 6프레임
BarelCombo0.setMode('aseprite10'); // 신규 10프레임
BarelCombo0.status();             // requested/effective/loaded/error
```

지속적인 개발 설정은 신규 로더 전에 `window.BAREL_COMBO0_CONFIG = { mode: 'legacy' }`를 지정하거나 로더의 기본값을 바꾸면 된다. 기존 파일을 복원하거나 삭제할 필요는 없다.

## Aseprite에서 재작업 후 내보내기

편집 파일을 수정한 뒤 기존 CLI를 사용한다. `--list-tags`를 유지해 `basic-attack` 태그를 JSON에 포함한다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/export-sprites.ps1 -Source assets/aseprite/barel-combo0-10/barel-combo0-10.aseprite -Force
.venv-streamlit-test/Scripts/python.exe tools/finalize-barel-combo0-10.py
```

발 경계를 변경했다면 개별 PNG도 동기화한 뒤 메타데이터와 검사를 다시 생성해야 한다. 원본에서 전체 분리를 재현하려면 `tools/build-barel-combo0-10.lua`에 `root=.`와 `input=assets/aseprite/barel-combo0-10/source/original.png`를 넘긴다. Windows에서 배치 생성 프로세스가 종료된 것을 기다린 뒤 내보내기를 실행한다.
