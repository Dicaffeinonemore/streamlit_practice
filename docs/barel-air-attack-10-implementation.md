# 바렐 점프 베기 도트 10프레임 적용

2026-10-25. 첨부 점프 베기 원본을 분리해 기존 공중 공격 `air`에 연결했다. **기본값은 신규 `aseprite10`이다.** 로컬 Chrome 및 실제 로컬 Streamlit iframe 테스트를 통과했다. 기존 공격 판정·점프 물리·상태 전환은 유지했다.

## 원본·리소스

- 원본: `C:/Users/훈도/Desktop/흑월의 기사 리부트/바렐 무브셋/바렐 점프 베기 도트.png`.
- 백업: `assets/aseprite/barel-air-attack-10/source/original.png`, 1600×686 RGBA.
- SHA256: `0ade8aa05bc3aa6e30c1afc0f086cad5571051004760dd15306d943fdaec37c9`.
- 파일 배경은 이미 alpha 0이다. 검은 갑옷을 색상으로 제거하지 않았다. alpha 32 이상 원본 RGBA를 유지하며 약한 주변 흔적과 분리 파편을 제외했다.
- 실제 자세는 10개다. 연결 윤곽은 F1 / F2 / F3 / F4 / F5~F10의 5개 그룹이다. 고정 10등분 대신 원본 윤곽과 대검 소유 영역을 분석했다.
- F5 검의 일부가 F6에, F8·F9 검이 다음 자세에 섞이지 않도록 원본을 확대 검수하고 경계를 조정했다. F8 대검 끝 옆의 다음 자세 발은 F9에 유지했다.
- 재드로잉·프레임 복제·픽셀 복제·리샘플링 없음. 모든 보존 픽셀을 원본 좌표/RGBA와 대조했다.

생성 경로:

- `assets/aseprite/barel-air-attack-10/source/original.png`
- `assets/aseprite/barel-air-attack-10/F01.png`~`F10.png`
- `assets/aseprite/barel-air-attack-10/barel-air-attack-10.aseprite`
- `assets/aseprite/barel-air-attack-10/barel-air-attack-10.png`
- `assets/aseprite/barel-air-attack-10/barel-air-attack-10.json`
- `assets/aseprite/barel-air-attack-10/barel-air-attack-10.animation.json`
- `assets/aseprite/barel-air-attack-10/separation.json`, `review-strip.png`
- 실제 게임 atlas: `assets/aseprite/exports/barel-air-attack-10/barel-air-attack-10.png` 및 `.json`. 위 폴더 PNG/JSON 사본과 바이트 동일.

## 기존 공중 공격의 실제 규칙

현재 상태명은 `player.st==='atk' && player.atk==='air'`이다.

- 점프 중 공격 키를 누르면 공중 공격으로 진입한다.
- **고정 400ms 후 종료하는 공격이 아니다.** 기존 렌더가 사용하던 400ms는 시각적 진행 기준이며, 실제 상태는 착지 시 종료한다.
- 공중 공격의 매 시뮬레이션 틱에 `playerStrike(ATK.air)`를 호출한다. 지상 콤보처럼 별도 wind/active/recovery 판정 창이 없다. 마지막 착지 틱의 기존 판정도 유지한다.
- 기본 피해 14, reach 64, knockdown true, fx 2, 전진량 틱당 방향×2.6.
- 공격 설정의 stop은 5틱이다. 실제 다운 명중 시 공유 `damageEnemy`의 6틱이 우선되므로 일반 적 명중에서는 최종 히트스톱이 6틱이다. 이 동작을 변경하지 않았다.
- `hitSet`으로 같은 적의 추가 타격을 막는다. 공중 이동·중력·입력 버퍼·피격 시 다운·스킬/대시 제한·착지 복귀는 기존 규칙 그대로다.

## 시간표와 명중 자세

Aseprite 태그는 `air`, forward, 반복 없음이다. JSON에는 기존 시각 기준인 400ms를 40ms×10프레임으로 기록했다. 실제 게임은 이 시간표를 **남은 체공 시간에 맞춰 선택**하며 공격 상태의 수명을 늘리지 않는다.

별도 시계나 시작 시각을 저장하지 않는다. 기존 `player.t * MS`와 현재 z/vz로 동일한 이산 중력 식의 남은 착지 틱을 계산한다. 마지막 공중 틱에 F10이 선택되도록 전체 진행을 맞추고, 착지나 피격 등 상태 전환 즉시 기존 선택으로 돌아간다. 게임의 z/vz·t·좌표·hitSet은 수정하지 않는다.

기존 공격은 첫 틱부터 명중할 수 있다. 준비 자세에서 피해만 발생하는 어긋남을 줄이기 위해, 기존 hitSet에 명중이 기록되면 시각적 진행을 최소 F6까지 전진시킨다. 기존 공격 판정을 늦추거나 타격 횟수를 늘리지 않는다. 히트스톱 동안 t/z/vz/hitSet이 정지하므로 표시 프레임도 정지한다.

원래 상태 전환을 보존한 결과:

- 여유 있는 일반 점프 후 공격은 F1~F10을 모두 표시한다.
- 착지 직전 입력해 남은 틱이 10개 미만이면 모든 프레임을 표시할 수 없다. 순서를 유지하며 일부 프레임을 건너뛰고 기존 착지 시점에 끝낸다.
- 즉시 명중한 경우 F6으로 전진하므로 준비 프레임 일부를 생략한다.
- 피격이나 다른 상태 전환 시에도 10프레임을 강제로 끝까지 재생하지 않는다.

## 정렬

448×448 셀, 기준점 `[224,384]`다. 긴 검과 내려오는 발을 수용하기 위한 투명 여백이며 캐릭터 픽셀 확대가 아니다.

원본 골반 위치를 프레임마다 동일한 셀 위치 `[224,308]`로 정렬했다. F10 발 기준선에서 골반까지의 76px를 기준으로 사용해 공중에서 골반이 불필요하게 흔들리거나 시트에 그려진 높이가 실제 actor.z와 중복되지 않도록 했다. 실제 렌더는 기존 `actor.y - actor.z`를 한 번 적용한다.

- 원본 X 기준점: `[130,306,426,576,712,892,1052,1206,1360,1496]`.
- 원본 Y 기준점: `[482,416,456,472,498,528,536,538,558,530]`.
- 프레임별 추가 offset은 모두 `[0,0]`. 공중의 발 모양·굴곡은 원본대로 유지한다.
- F10 신체 높이 190px를 기존 142 기준에 맞추는 공통 렌더 배율 `142/190` 사용. 기존 플레이어 배율 0.72 적용 시 약 0.538105다. 프레임별 크기 조정은 하지 않았다.

## 생성·변경 코드

- `src/animation/barel-air-attack.js`: 독립 로더·검증·모드·프레임 선택. actor를 읽기만 한다.
- `barel-runtime.js:14`: 기존 공격 분기 앞에 신규 공중 공격 선택 두 줄 추가. 실패 시 기존 `barelFrame('air', t/400)`로 돌아간다.
- `index.html`, `server.py`: 로더 및 Streamlit 정적 파일 등록.
- `tools/build-barel-air-attack-10.lua`, `tools/finalize-barel-air-attack-10.py`, `tools/inspect-barel-air-attack.py`: 분리·Aseprite 생성·메타데이터 생성.
- `tests/barel-air-attack-10.cjs`, `tests/barel-air-attack-10-assets.py`: 실제 브라우저·자산 검사.
- `tests/regression.cjs`, `tests/streamlit-smoke.cjs`: 신규 경로·실행 분기.
- `tests/barel-combo0-10.cjs`, `barel-combo1-10.cjs`, `barel-combo2-10.cjs`: ‘air에는 외부 이미지가 없다’는 이전 가정 대신 해당 지상 콤보 선택이 중단되는지 검사.

`game.js`는 한 바이트도 변경하지 않았다. 점프·걷기·대기·대시·3콤보 모듈과 이전 리소스도 보존했다. 기존 runtime에서 새 두 줄을 제거하면 작업 전 파일 해시와 일치한다.

## 실제 테스트 결과

로컬 Chrome과 실제 로컬 Streamlit iframe에서 각각 통과:

- 기본 신규 atlas 로드, 실제 RAF에서 10프레임 전체 표시 및 착지 후 idle.
- 좌우 반전, 10프레임 정렬 캡처 및 실제 게임 캡처.
- 점프 1/6/18/32/35틱 시점의 공격 진입을 좌우 각각 검사. legacy/신규의 전체 시간·위치·z/vz·상태·카메라 추적 값 동일.
- 기본 피해 14·1회 타격·넉다운·실제 6틱 히트스톱, 틱당 2.6 전진량 동일.
- 즉시 명중 시 F6 선택, 히트스톱/일시정지 중 프레임과 물리 정지.
- 공중 대시·스킬 제한, 피격 시 다운 취소·회복, 착지 후 walk/idle 전환.
- HTTP·JSON·이미지·시간표·경계·모션 ID·offset·배율·주기·시계·loop·전투 참조 불일치 12종 폴백.
- 원본 RGBA/좌표 일치, 원본 픽셀 중복 사용 없음, 각 cel 단일 연결 윤곽·파편 제거·여백·골반 정렬·PNG/JSON 일치.
- `game.js`를 포함한 212개 파일의 해시 동일성 확인.
- 기존 jump·walk·idle·dash·combo0/1/2의 실제 로컬 Chrome 회귀 검사 모두 통과. 공유 Aseprite 검사와 Streamlit bundle 6개 검사도 통과.

기록과 캡처는 `artifacts/barel-air-attack-10/local/` 및 `streamlit/`의 `results.json`, `ten-frames-1.png`, `ten-frames--1.png`, `game-1.png`, `game--1.png`에 있다. 공통 자산 결과는 `artifacts/barel-air-attack-10/asset-checks.json`이다.

## 기본값·복구·남은 제한

기본 모드는 `aseprite10`이다. `BarelAirAttack.status()`로 요청/유효 모드와 오류를 확인한다. 콘솔 `BarelAirAttack.setMode('legacy')` 또는 내부 게임 URL query `?barelAirAttack=legacy`로 기존 모션으로 돌아간다. `setMode('aseprite10')` 또는 query 제거로 신규 모션을 사용한다. 로딩·파싱·검증 실패 시 자동 legacy 폴백한다.

원격 Streamlit Cloud 배포는 수행하지 않았다. 늦은 입력·즉시 명중·피격 시 프레임 생략은 위에서 설명한 기존 전투/물리 보존에 따른 동작이다. 원본에서 맞닿아 가려진 픽셀은 재생성하지 않았다.

재생성: Aseprite batch의 `tools/build-barel-air-attack-10.lua`에 `root=.` 전달 → `tools/export-sprites.ps1 -Source assets/aseprite/barel-air-attack-10/barel-air-attack-10.aseprite -Force` → `tools/finalize-barel-air-attack-10.py`. 기존 CLI와 이전 리소스는 유지한다.
