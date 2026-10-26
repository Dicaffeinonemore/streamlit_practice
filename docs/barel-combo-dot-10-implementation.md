# 바렐 3연타 도트 모션 교체

2026-10-25. 1타=`바렐 1타 도트.png`, 2타=`바렐 2타 도트.png`, 3타=`바렐 3타 도트.png`로 교체했다. **세 공격 모두 신규 도트 리소스가 기본 `aseprite10`이다.** 이전 10프레임 리소스와 기존 6프레임 atlas는 삭제하지 않았다.

## 리소스

| 공격 | 신규 폴더 | 원본 규격 | 전체 시간 |
|---|---|---|---|
| combo0 / 1타 | `assets/aseprite/barel-combo0-dot-10/` | 1600×533 | 350ms |
| combo1 / 2타 | `assets/aseprite/barel-combo1-dot-10/` | 1600×533 | 310ms |
| combo2 / 3타 | `assets/aseprite/barel-combo2-dot-10/` | 1600×686 | 680ms |

각 폴더에 `source/original.png`, `F01.png`~`F10.png`, 동일 폴더 이름의 `.aseprite`·`.png`·`.json`·`.animation.json`, `review-strip.png`, `separation.json`을 저장했다. 실제 게임 atlas는 기존 CLI 규칙에 따라 `assets/aseprite/exports/<동일 폴더 이름>/`의 PNG/JSON을 사용한다. 원본은 지정된 Desktop 경로에서 바이트 그대로 복사했다.

SHA256:

- 1타: `ea6d36d761942e4bcbbf607983a90d814dcc14614e3b26abb012fba4424a4104`
- 2타: `45f40be72dbe53afd34bbd0b376c65de95ed4bc0514b5c1cd65ca1bd0b7263f8`
- 3타: `2e405630dfa86ec750e052248549fcfb462fd4e9c5f13377a9786fd0dd189f1c`

## 분리와 정렬

원본은 이미 alpha 투명 배경이다. 검은 갑옷을 색상으로 제거하지 않았다. alpha 32 이상 원본 픽셀을 유지하며 재드로잉·프레임 복제·픽셀 복제·리샘플링을 하지 않았다.

고정 10등분 대신 실제 연결 윤곽을 분석했다. 독립된 자세는 전체 윤곽을 보존하고, 검과 다음 자세가 맞닿은 그룹은 기존 검수 방법을 새 규격의 좌표에 맞춰 사용했다. 낮은 alpha 경계, 대검 소유 영역, 발 주변의 이웃 검 잔여 제거 후 각 프레임을 검수했다.

3타 F6의 검 끝과 F7의 뒷정강이·발이 맞닿은 부분은 원본을 3배 확대해 검수했다. X 982부터의 뒷정강이·발 픽셀을 F7 소유로 지정해 발이 사라지거나 F6 검에 섞이지 않도록 했다. 해당 원본 발 영역 보존은 별도 픽셀 회귀 검사로 확인한다.

- 1타 연결 그룹: F1 / F2 / F3 / F4 / F5~F9 / F10.
- 2타 연결 그룹: F1~F2 / F3 / F4 / F5~F10.
- 3타 연결 그룹: F1 / F2 / F3~F4 / F5 / F6~F8 / F9 / F10.
- 편집 셀 384×384, 기준점 `[200,352]`. 프레임별 바닥 보정만 메타데이터로 적용한다.
- 신체 기준 높이를 기존 142에 맞추는 공통 렌더 배율을 공격별로 적용했다. 1타 기준 프레임 F1 높이 218, 2타 F9 높이 186, 3타 F10 높이 184다. 기존 플레이어 배율 0.72를 함께 사용하며 실제 월드 좌표는 변경하지 않았다.
- 1타 F10의 대검 끝은 원본 파일의 오른쪽 경계에 닿는다. 제공되지 않은 바깥 픽셀을 생성하지 않았으며 출력 cel에는 추가 잘림 없이 여백을 확보했다.

## 게임 연결과 전투 보존

`src/animation/barel-combo0.js`, `barel-combo1.js`, `barel-combo2.js`의 기본 메타데이터 경로만 각각 새 도트 폴더로 전환했다. 기존 애니메이션 선택 구조와 `player.t * MS`는 그대로다. `game.js`·`barel-runtime.js`·공유 adapter·idle/walk/dash 모듈은 이번 작업에서 변경하지 않았다.

프레임별 시간도 기존과 같다.

- 1타: `[40,30,35,25,25,30,45,25,40,55]`ms. 판정 `[128.5,230)`, 콤보 연결 267.5ms.
- 2타: `[70,35,35,30,30,20,20,20,25,25]`ms. 판정 `[105,200)`, 콤보 연결 233ms.
- 3타: `[70,60,70,20,29,91,30,90,90,130]`ms. 판정 `[249,370)`, 파동 284ms·지면 타격 319ms.

피해량 10/11/16, 전진량 8/8/16, 입력 버퍼, 히트스톱, 넉백·다운 및 취소 규칙을 유지했다.

## 변경 파일

- 위 세 리소스 폴더와 해당 `exports` 폴더.
- `src/animation/barel-combo0.js`, `barel-combo1.js`, `barel-combo2.js`: 기본 리소스 경로.
- `server.py`: Streamlit 컴포넌트에 도트 메타데이터·PNG·JSON 복사. 이전 리소스도 보존.
- `tools/build-barel-combo-dot-10.lua`, `tools/finalize-barel-combo-dot-10.py`, `tools/inspect-barel-combo-dot.py`: 원본 분석·분리·CLI 후 메타데이터 생성.
- `tests/barel-combo-dot-10-assets.py`: 30프레임 원본 RGBA·시간·격리·기존 리소스 보존 검사.
- `tests/regression.cjs`: 신규 리소스 HTTP 허용.
- `tests/barel-combo0-10.cjs`, `barel-combo1-10.cjs`, `barel-combo2-10.cjs`: 신규 경로 대상 실제 테스트 및 개별 검증 결과 경로. 3타 테스트는 세 타 모두 올바른 도트 atlas를 기본 선택하는지 확인한다.
- `tests/barel-dash-10.cjs`: 대시 취소 후 기본 공격의 새 이미지 경로 확인.

## 실제 테스트

세 공격을 각각 **로컬 Chrome과 로컬 Streamlit iframe에서 실제 재생**해 통과했다.

- 각 10프레임 표시, 전체 시간 유지, 좌우 반전·지면 정렬 캡처.
- 기존 대비 피해량·이동·히트 판정 동일, 히트스톱 중 프레임 정지.
- 1타→2타→3타 버퍼 연결 및 최종 자유 상태 복귀.
- 대시·피격·점프·스킬 전환 및 취소 검사.
- HTTP/JSON/이미지/시간표/메타데이터 오류 폴백 검사.
- 세 타의 실제 선택 이미지가 각각 `barel-combo0-dot-10.png`, `barel-combo1-dot-10.png`, `barel-combo2-dot-10.png`인지 확인.
- 30프레임 각각의 원본 RGBA 일치, 원본 픽셀 중복 사용 없음, 단일 연결 윤곽·분리 파편 없음, cel 여백 및 PNG/JSON 내보내기 일치.
- 작업 전 58개 파일의 해시 동일성으로 이전 리소스·게임 로직·idle/walk/dash 보존 확인.

결과는 `artifacts/barel-combo0-dot-10/`, `artifacts/barel-combo1-dot-10/`, `artifacts/barel-combo2-dot-10/`의 `local/`·`streamlit/`에 저장했다. 각 폴더의 `results.json`, `ten-frames-1.png`, `ten-frames--1.png`, 게임 캡처를 확인할 수 있다. 공통 자산 검사는 `artifacts/barel-combo-dot-10/asset-checks.json`이다.

원격 Streamlit Cloud 배포는 수행하지 않았다.

## 복구와 재생성

기존 6프레임으로 전환은 콘솔에서 `BarelCombo0.setMode('legacy')`, `BarelCombo1.setMode('legacy')`, `BarelCombo2.setMode('legacy')`를 사용한다. 각 `setMode('aseprite10')`은 신규 도트 모션으로 돌아간다. query `barelCombo0/1/2=legacy`도 기존 규칙대로 지원한다.

이전 10프레임 리소스로 영구 복구하려면 해당 로더의 기본 URL을 `assets/aseprite/barel-comboN-10/barel-comboN-10.animation.json`으로 되돌린다. 기존 폴더와 CLI 도구는 그대로 보존돼 있다.

재생성 순서: Aseprite batch의 `tools/build-barel-combo-dot-10.lua`에 `root=.` 및 `attack=0/1/2` 전달 → 각 `.aseprite`를 기존 `tools/export-sprites.ps1 -Source <파일> -Force`로 내보내기 → `tools/finalize-barel-combo-dot-10.py`. 새 원본 픽셀을 기존 원본의 비율로 리샘플링하는 작업은 없다. 참조 윤곽 좌표만 새 해상도에 맞춰 변환한다.
