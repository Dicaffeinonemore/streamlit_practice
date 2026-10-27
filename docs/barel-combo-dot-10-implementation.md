# 바렐 3연타 도트 모션 교체

## 2026-10-27 평타 연출 수정

흑월참 연속 베기: `흑월참 콤보 사운드.mp3`를 첫 연속 타격(700ms)에 한 번 재생한다. 각 베기마다 파일이 겹치지 않게 기존 개별 검 타격음은 이 구간에서 생략하고 적 피격음은 유지한다. 재생 길이는 최대 880ms로 제한하고 끝을 짧게 페이드해 마지막 일격(1580ms)의 전용 소리와 구분한다. 원본은 `assets/sfx/barel/special-combo.mp3`, 임베드 키는 `barelCombo`이며 SHA256은 `48350642cae177ff55d5169f6dc333a4ac73892c326f34b35f97d79cde78b224`이다.

적 피격음 적용: 바렐·비에사가 일반 적 또는 모든 보스에게 실제 피해를 주면 `피격 사운드.mp3`(`hurt`)를 추가 재생한다. 소버린 주먹·바르굴 구슬의 피해와 모르그라 까마귀 격파에도 적용한다. 무적·방어로 피해가 차단된 경우에는 추가하지 않는다. 기존 공격별 효과음과 플레이어 피격음은 유지한다. 브라우저에서 두 캐릭터 × 전체 적 종류의 피해·피격음 호출 및 무적 시 무음을 확인했다.

P키 강하(`leap`)와 H키 내려찍기(`slam`)의 타격·지면 충돌음은 사용자 제공 `p키 h키 사운드.mp3`로 적용한다. 원본은 `assets/sfx/barel/p-h-impact.mp3`에 보존하고 `barelSlam`으로 임베드한다(SHA256 `cc3d7da66353478e3e581a80b94d20be705191036161e3be0592c14eb6d89da7`). 같은 기술의 적·통·구슬·주먹 적중에도 동일한 샘플을 사용한다. 브라우저에서 두 기술의 실제 피해와 사운드 연결, MP3 디코딩·재생을 검증했다.

공통 피격음: 바렐·비에사가 피해를 받는 일반 피격(`hurt`)과 강한 피격·다운(`hurtH`) 모두 사용자 제공 `피격 사운드.mp3`를 재생한다. 두 이벤트는 하나의 디코딩 버퍼를 공유한다. 원본은 `assets/sfx/barel/hurt.mp3`에 보존한다(SHA256 `6c8ba21c363ccea13c49c5665391429479ca4aef78a9e5b0a1d074e356ca7cec`). 기존 공격 적중음과 사망음은 유지한다.

흑월참 마지막 일격은 별도 사용자 파일 `흑월참 마지막 일격.mp3`를 사용한다. 원본은 `assets/sfx/barel/special-final-hit.mp3`에 보존하고 `barelFinalHit`으로 임베드한다(SHA256 `73e84b70e5888b55c34827f20ff5f291fa175bb33a3d987b70774dc447a65181`). 마지막 일격의 연출·적·통·구슬·주먹 적중에 같은 소리를 전달하며, 앞선 연속 베기는 검 타격 MP3를 유지한다.

3타 이펙트만 자체 기준점을 중심으로 좌우 반전한다. 캐릭터 앞 위치와 공격 방향에 따른 반전은 그대로 유지하며, 1·2타 이펙트 및 캐릭터 모션은 변경하지 않는다.

최신 사운드 적용: 바렐의 평타·공중 공격·기술·필살기·마법 적중음은 사용자 제공 `바렐 검 타격.mp3`로 통일했다. L 장거리 기술은 발사와 적중 모두 `바렐 장풍 공격.mp3`를 사용한다. 발사체에 적중 사운드를 명시적으로 전달해 플레이어가 자유 상태로 돌아오거나 다른 행동을 해도 일반 적·바르굴 구슬·소버린 주먹에 장풍 소리가 유지된다. 비에사의 기존 소리는 유지한다.

원본 바이트는 `assets/sfx/barel/sword-hit.mp3`(SHA256 `ffa99f004437e0bb8ff27eb49d37bb98e832cf4679ad7ca9df216d48ab3414ed`)와 `wave.mp3`(`6d86a334b13f162c592af68ff75e5597b45e4fc552890a3ec3e79052e6b8c2f6`)에 보존했다. `tools/build-barel-sfx.py`가 `barel-sfx.js`에 임베드해 로컬·Streamlit·단일 HTML에서 사용한다. WebAudio로 미리 디코딩하고 원본 파일을 편집하지 않은 채 앞 무음만 건너뛴다. 동시 적중의 과도한 중첩을 줄이고 음소거·일시정지·효과음 음량을 따른다. 브라우저에서 두 MP3의 디코딩·실제 버퍼 재생, 전체 타격 분기와 L 발사체의 행동 종료 후 적중을 확인했다. 아래 합성 타격음 설명은 MP3 적용 이전 기록이다.

최종 적용: 사용자가 제공한 `바렐 3단 베기 이펙트.png`(1600×900)의 위·가운데·아래 행을 각각 지상 1·2·3타에 연결했다. 각 행은 왼쪽부터 6프레임이다. 원본은 `assets/effects/barel-combo/source.png`에 바이트 그대로 보관하며 SHA256은 `d801c4edd3307fa266577b8e9c91d7fe021b003ab251905259ff66b7322e7a51`이다. `tools/build-barel-combo-fx.py`가 PNG를 변형 없이 `barel-combo-fx-art.js`에 임베드하므로 로컬·Streamlit·단일 HTML에서 동일하게 사용한다.

`src/animation/barel-combo-fx.js`는 준비 동작 뒤부터 6프레임을 재생하고 세 번째 밝은 프레임을 타격 시작(`wind + act × 0.35`)에 맞춘다. `wind + act + 70ms`에 종료한다. 공격 시간으로 샘플링해 히트스톱에 함께 멈추고, 공격 취소 시 즉시 사라진다. 검정 매트는 `lighter` 합성으로 처리하고 원본 색과 픽셀을 보존한다. 캐릭터 앞 48px, 배율 0.42로 붙이며 방향 반전·공중 높이·이펙트 감소 옵션을 따른다. 첨부 시트는 지상 3연타에만 사용하며 발사 검기·지면 폭발·추가 피해는 없다. 아래 이펙트 제거 기록은 이 시트 적용 전 변경이다.

검증: `BAREL_COMBO2_SUITE=1 node tests/regression.cjs` 및 `tests/test_server_bundle.py` 6개 테스트 통과. 각 타의 6프레임·타격 시작 동기화·공격 취소·공중 공격 및 비에사 제외를 확인했다. 좌우 18프레임 게임 합성 캡처는 `artifacts/barel-combo2-dot-10/local/supplied-effects-1.png`, `supplied-effects--1.png`이다.

타격음도 검으로 베는 느낌으로 변경했다. `audio.js`의 바렐 전용 `swordSwing`은 짧은 바람 가르는 소리, `swordHit`는 날카로운 절삭음·짧은 접촉음·금속성 여운을 합성한다. 1~3타는 길이와 음높이를 조금씩 달리하며 공중 평타에도 적용한다. 칼의 적중음은 적·통·바르굴 구슬·소버린 주먹에 공통으로 연결하고, 비에사와 마법·원거리 파동의 기존 소리는 유지한다. 헛스윙에서는 휘두르는 소리만 재생한다.

지상 3연타와 공중 평타에 덧씌우던 참격 이펙트를 제거했다. 3타의 자동 검기 발사와 지면 폭발도 제거해, 평타는 칼이 직접 닿는 근접 공격으로만 적중한다. 기존 검기에서 발생하던 원거리 추가 피해도 더 이상 발생하지 않는다. 모션 원본과 프레임 시간, 칼의 피해·범위·전진 거리, 콤보 입력, 타격음·히트스톱·넉백·다운 및 적중 피드백은 유지한다. 기술·마법·필살기의 이펙트는 그대로 사용한다. 아래 검기·지면 타격 시점에 관한 내용은 이전 구현 기록이다.

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
