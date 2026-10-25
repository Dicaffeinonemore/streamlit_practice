# 바렐 도트 대기 및 보스챌린지 선택 화면 적용

2026-10-25. 첨부 `바렐 대기 도트.png`를 게임의 기본 idle로 교체했다. 보스챌린지 보스 목록에 동일 모션의 미리보기를 추가하고, 이어지는 캐릭터 선택 카드도 같은 리소스로 재생한다. 일반 캐릭터 선택 화면도 이 공통 미리보기를 사용한다.

## 리소스

- 원본: `C:/Users/훈도/Desktop/흑월의 기사 리부트/바렐 무브셋/바렐 대기 도트.png`.
- 보존 원본: `assets/aseprite/barel-idle-dot-10/source/original.png`, 1600×533 RGBA.
- SHA256: `a761ff668069f25777d976d558706ec41f32ecf7541df44ceead725c571f7fac`.
- 생성 폴더: `assets/aseprite/barel-idle-dot-10/`. 개별 `F01.png`~`F10.png`, `barel-idle-dot-10.aseprite`, `.png`, `.json`, `.animation.json`, `separation.json`, `review-strip.png`.
- 실제 게임 atlas는 `assets/aseprite/exports/barel-idle-dot-10/barel-idle-dot-10.png` 및 `.json`을 사용한다. 리소스 폴더의 PNG/JSON은 같은 바이트의 사본이다.
- 기존 `barel-idle-10` 원본·Aseprite·내보내기 파일 및 legacy atlas는 그대로 보존했다.

원본은 이미 alpha 투명 배경이다. 검은 갑옷을 색상으로 삭제하지 않았다. 실제 연결 윤곽은 9개이며 F1/F2의 검 경계만 맞닿아 있다. 대검 소유 영역을 분석해 분리하고 이웃 검 조각이 망토 아래 남지 않도록 검수했다. 다른 8개 자세는 독립된 윤곽을 보존했다. 원본 RGBA·픽셀 밀도를 유지했고 재드로잉·프레임/픽셀 복제·리샘플링은 하지 않았다.

## 재생·정렬

- 태그 `idle`, forward, 10×130ms, 전체 1300ms 반복. F10 다음 F1.
- 기존 `tick * MS` 시계 사용. 상태 진입 시 위상 초기화나 별도 누적기 없음.
- 448×448 셀, 기준점 `[224,416]`, 발 기준선 유지.
- F1 원본 신체 높이 282px를 기존 142px 기준에 맞추는 공통 렌더 배율 사용. 기존 플레이어 배율 0.72 적용 시 약 0.362553이다. 프레임별 크기 조정 없음.
- 선택 화면은 10프레임의 공통 실제 경계 `[-112,-284,100,0]`에 맞춰 한 번 정한 크기로 표시한다. 투명 셀 전체를 크기 기준으로 삼지 않아 캐릭터가 지나치게 작아지지 않으며, 호흡·망토 변화 때 확대/축소하지 않는다.
- 게임, 보스 목록, 캐릭터 카드는 같은 `BarelIdle` 리소스와 주기를 사용한다. 보스 목록은 기존 해금 조건과 버튼 동작을 유지한다.

## 변경 파일

- 위 신규 리소스 폴더와 `exports` 폴더.
- `src/animation/barel-idle.js`: 기본 URL 교체, 선택 화면용 순수 프레임 샘플 `preview`, 선택 화면 경계 검증.
- `barel-runtime.js`: 공통 `drawBarelIdlePreview` 추가. 신규 리소스 실패나 legacy 모드에서는 기존 atlas 미리보기를 사용한다.
- `game.js`: 캐릭터 카드의 이전 idle 직접 렌더를 공통 미리보기로 교체. 보스 목록 진입/루프에서 미리보기 갱신.
- `index.html`: 보스 목록 옆 `barelChallengePreview` Canvas와 두 열 레이아웃 추가.
- `server.py`: 신규 PNG/JSON/메타데이터를 Streamlit 컴포넌트로 복사.
- `tools/build-barel-idle-dot-10.lua`, `finalize-barel-idle-dot-10.py`, `inspect-barel-idle-dot.py`: 분석·분리·메타데이터 생성.
- `tests/barel-idle-dot-10-assets.py`, `barel-idle-dot-preview.cjs`: 원본 픽셀 및 실제 선택 화면 검증.
- `tests/barel-idle-10.cjs`, `tests/regression.cjs`: 신규 리소스 대상으로 게임 대기·폴백 검증.
- `tests/barel-jump-10.cjs`, `barel-air-attack-10.cjs`, `barel-dash-10.cjs`: idle 복귀 시 새 파일 경로를 검사하도록 갱신.

## 검증

실제 로컬 Chrome 및 실제 로컬 Streamlit iframe에서 모두 통과했다.

- 게임에서 10프레임·1300ms 반복 및 F10→F1 두 번 이상 실제 RAF 재생.
- 보스 목록과 보스용 캐릭터 선택 화면에서 각각 10프레임 전체 및 반복 경계 실제 재생.
- 두 미리보기가 실제 신규 PNG를 사용하는지 렌더 호출로 확인하고 화면 캡처.
- 미리보기 검·망토·발이 Canvas 경계에 잘리지 않는지 픽셀 검사. legacy 모드에서 기존 atlas로 전환 확인.
- 보스 목록의 해금/잠금 조건 유지, 보스 버튼 클릭 시 해당 스테이지를 가진 캐릭터 선택으로 이동 확인.
- 게임의 좌우 반전·지면·크기·걷기/공격/전체 콤보/점프/피격/다운 이후 idle 복귀, 상태·충돌 정보 보존.
- HTTP·JSON·시간표·이미지·경계·모션 ID·offset·배율·주기·시계·loop·선택 화면 경계 오류 12종 폴백.
- 원본 좌표와 RGBA 일치, 중복 픽셀 사용 없음, 각 cel 단일 윤곽·여백·바닥 정렬, CLI 출력 일치.
- 기존 모듈/리소스 228개 파일의 해시 동일성 확인. 게임의 선택 화면 코드 변경을 되돌렸을 때 작업 전 전체 파일 해시와 일치하므로 전투·이동·보스 해금 로직은 변경하지 않았다.
- jump·air·dash·walk·3콤보 연결의 실제 로컬 Chrome 회귀 검사 및 Streamlit bundle 6개 검사 통과.

결과: `artifacts/barel-idle-dot-10/local/results.json`, `streamlit/results.json`.

선택 화면 캡처는 각 폴더의 `boss-challenge.png`, `boss-characterSelect.png`다. 게임/프레임 캡처 및 자산 검사 `artifacts/barel-idle-dot-10/asset-checks.json`도 보존했다.

## 기본값·복구

기본 모드는 `aseprite10`이다. 게임을 새로고침하면 신규 대기를 사용한다. `BarelIdle.setMode('legacy')` 또는 내부 게임 URL query `?barelIdle=legacy`로 기존 대기와 기존 미리보기로 전환한다. `setMode('aseprite10')` 또는 query 제거로 신규 모션으로 돌아간다. 신규 로딩·파싱·검증 실패 시 기존 리소스로 자동 복귀한다.

원격 Streamlit Cloud 배포는 수행하지 않았다. 타이틀 배경의 별도 장식 캐릭터는 이번 요청 범위에서 변경하지 않았다.

재생성: Aseprite batch `tools/build-barel-idle-dot-10.lua`에 `root=.` 전달 → `tools/export-sprites.ps1 -Source assets/aseprite/barel-idle-dot-10/barel-idle-dot-10.aseprite -Force` → `tools/finalize-barel-idle-dot-10.py`.
