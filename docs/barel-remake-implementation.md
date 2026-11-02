# 바렐 리메이크 모션 (게임 형식 변환)

2026-11-02. 리메이크한 바렐(256px 캔버스, 20프레임 × 12모션)을 게임의 10프레임 Aseprite 형식으로 변환해 기본 아트로 연결했다. 판정·물리·시간표는 바꾸지 않았다.

## 연결 방식

- `src/animation/barel-remake-config.js`가 각 로더의 `BAREL_*_CONFIG.metadataUrl`을 `barel-remake-*` 자산으로 돌린다. 로더의 검증·legacy 폴백은 그대로다.
- 게임 URL에 `?barelRemake=0`을 붙이면 이전 아트를 쓴다. 개별 로더의 `?barelIdle=legacy` 같은 기존 선택도 유지된다.
- `src/animation/barel-remake-data.js`(생성 파일)는 스킬 시트 경로를 담는다. `barel-named-motion.js`는 이 시트로 같은 이름의 클립을 덮어쓴다.
- 코드 변경은 이 두 파일과 다음뿐이다.
  - `barel-dash-attack.js`, `barel-hurt.js`, `barel-down.js`: 다른 로더처럼 `BAREL_*_CONFIG.metadataUrl`을 받는다.
  - `barel-named-motion.js`: 리메이크에만 있는 시트를 고른다. 내려찍기(slam, 820ms), 붉은 파동(redwave, 720ms), 돌진 베기(thrust, 700ms), 뇌격 시전(cast, 640ms), 사망(dead, 1000ms, 마지막 장 유지), 필살기 시작(special 0–620ms)이다. 승리 루프용 `victoryFrame(ms)`도 추가했다. 시트가 없으면 null을 돌려주므로 기존 아틀라스 클립이 재생된다.
  - `barel-runtime.js`: 시전·사망·승리 프레임을 고를 때 이름 있는 모션을 먼저 확인한다. 초상화는 `BAREL_REMAKE_PORTRAIT`가 있으면 그것을 쓴다.
  - `index.html`: 스크립트 2개를 `aseprite.js` 앞에 등록했다.
  - `server.py`: Streamlit 묶음에 `barel-remake-*` 자산을 추가했다.
  - `tests/regression.cjs`: 테스트 서버 허용 목록에 `barel-remake-*` 자산을 추가했다.

## 자산

| 게임 상태 | 새 폴더 | 대체 대상 | 셀 / 앵커 | 원본 모션 프레임 |
| --- | --- | --- | --- | --- |
| idle | barel-remake-idle-10 | barel-idle-stationary-10 | 448 / 224,416 | idle 1,3,…,19 |
| walk | barel-remake-walk-10 | barel-walk-revised-10 | 448 / 224,416 | walk 1,3,…,19 |
| dash | barel-remake-dash-10 | barel-dash-10 | 384 / 200,352 | dash 2,3,4,6,9,12,15,16,18,20 |
| dash_attack | barel-remake-dash-attack-10 | barel-dash-attack-10 | 640 / 320,576 | dash_thrust 3,5,6,8,9,10,13,15,17,20 |
| c1 일섬 | barel-remake-combo0-10 | barel-combo0-dot-10 | 384 / 200,352 | attack_combo 1–6 (보간) |
| c2 역일섬 | barel-remake-combo1-10 | barel-combo1-dot-10 | 384 / 200,352 | attack_combo 7–13 |
| c3 참격 | barel-remake-combo2-10 | barel-combo2-dot-10 | 384 / 200,352 | attack_combo 13–20 |
| jump | barel-remake-jump-10 | barel-jump-revised-10 | 640 / 320,576 | jump 3,4,6,8,10,11,14,16,17,19 |
| air | barel-remake-air-attack-10 | barel-air-attack-10 | 448 / 224,384 | jump_attack 1,3,4,5,6,7,8,10,13,16 |
| hurt | barel-remake-hurt-12 | barel-hurt-12 | 640 / 320,576 | 새 포즈 12장 (1 중립, 2–6 상단, 7–11 하단, 12 회복) |
| down | barel-remake-down-10 | barel-knockdown-getup-design-10 | 640 / 320,576 | 새 포즈 10장 (피격 → 날아감 → 등으로 낙하 → 무릎 → 일어섬) |
| grabbed | barel-remake-grabbed-10 | barel-grabbed-10 | 448 / 224,416 | 새 포즈 10장 (F1 끌려감, F2–10 몸부림 루프) |
| whirl / leap / slam / redwave | `assets/runtime/<sha24>.png` | 이름 있는 시트 / 아틀라스 클립 | 640 / 320,580 | 각 스킬 8~10장 |
| thrust (U 돌진 베기) | 〃 | 아틀라스 `thrust` | 〃 | dash_thrust 10장, 700ms |
| getup | 〃 | 이름 있는 `getup` | 〃 | 새 포즈 6장 (누움 → 웅크림 → 무릎 → 검 짚고 일어섬) |
| death | 〃 | 아틀라스 `death` | 〃 | 새 포즈 10장, 1000ms (비틀 → 검 짚고 무릎 → 엎어짐) |
| victory | 〃 | 아틀라스 `victory` | 〃 | 새 포즈 10장, 1500ms 루프 (검을 꽂고 양손으로 손잡이) |
| cast (뇌격) | 〃 | 아틀라스 `cast` | 〃 | 새 포즈 10장, 640ms (검을 하늘로, 380ms 발동) |
| special0–5 (필살기) | 〃 | 아틀라스 `super1` + 이름 있는 `special1`~`5` | 〃 | 0: 기 모으기·돌진(새 포즈), 1–4: 콤보·찌르기 재사용, 5: 도약 강하 재사용 |
| 초상화 | `assets/runtime/<sha24>.png` | `BAREL_ART.portrait` | 158×180 | 대기 F1의 투구~벨트를 2배 확대 |

- 각 폴더에 `F01.png`~`F10.png`, `review-strip.png`, `.aseprite`, `.animation.json`이 있다. 런타임 시트는 `exports/<폴더>/`에 있다(잘라내지 않은 가로 시트).
- 메타데이터는 대체 대상의 것을 복사했다. 프레임 시간, `combat`, `clock`, `poseMap`, `selection`, `physicsReference`, `combatReference`, 대시 찌르기의 `hitbox`·`bodyHeight`·`bladeTip`은 그대로 두었다. 그림 관련 값만 바꿨다: `renderScale`, `alignment`, `frameOffsets`(모두 0), `source`, 대기의 `previewBounds`.
- 몸 키는 188px(투구 장식 포함, 대기 F1 기준), `renderScale = 142/188 ≈ 0.7553`이다. 모든 클립과 스킬 시트에 같은 값을 쓴다.
- 리그의 지면점 (128,240)을 각 앵커에 맞췄다. 점프·공중 공격·도약 강하의 공중 프레임은 리그의 수직 이동을 빼고 제자리로 그렸다. 게임이 `actor.z`로 들어 올리기 때문이다.
- 검은 셀 크기 캔버스에 따로 그린다. 그래서 머리 위로 휘두르는 동작도 잘리지 않고, 원본 20프레임에서 스미어로 숨겼던 프레임에도 검이 보인다. 지상 프레임의 칼끝은 바닥에서 자른다.
- 이펙트는 굽지 않았다. 콤보 궤적(`BarelComboFx`), 대시 잔상(`BarelDashFx`), 대시 찌르기 섬광, 점프 먼지, 스킬 이펙트·파동은 게임이 그린다. 예외는 두 가지다. 대시의 정지 먼지 2장은 `hasBakedEffects()`가 게임 먼지를 끄기 때문에 넣었고, 붉은 파동의 칼날 발광은 캐릭터 그림의 일부라서 넣었다.

## 재생성

```
python tools/barel-remake/build.py      # numpy, Pillow
node tests/barel-remake.cjs
```

`tools/barel-remake/`에는 다음이 있다.
- 리그(`rig.py`): 몸 전체 회전(`body`)과 바닥 맞춤을 포함한다.
- 20프레임 모션 정의(`motion.py`)
- 원본 20프레임이 없는 상태들의 포즈(`motion_states.py`): 피격, 넉다운·기상, 붙잡힘, 사망, 승리, 시전, 필살기 시작
- 검 렌더러(`swordlib.py`)
- 승인된 base 파츠(`parts/`)

눕기·엎어지기는 서 있는 포즈를 엉덩이 기준으로 ±90° 돌린 뒤 바닥에 내려놓는다. 망토는 미리 몸 방향으로 접어 두어 회전 후 몸을 따라 깔린다. `build.py`의 `CLIPS`/`NAMED` 표에서 원본 프레임 선택을 바꾼 뒤 다시 실행한다. 스킬 시트는 내용 해시 이름으로 다시 쓰이고, `data/runtime-assets.json`과 `barel-remake-data.js`가 갱신되며, 이전에 생성한 시트는 지워진다.

## 검증

- `tests/barel-remake.cjs`: 실제 로더 9개와 이름 있는 모션을 Node vm에서 실행한다. `fetch`/`Image`는 저장소 파일을 읽는다. 다음을 확인한다.
  - 모든 로더가 검증을 통과해 `aseprite10`과 리메이크 시트를 쓴다.
  - 대시 찌르기의 판정 데이터가 이전과 같다.
  - 클립 간 `renderScale`이 같다.
  - 스킬 시트가 매니페스트에 들어 있고, 시간별 프레임 인덱스가 맞다.
  - `?barelRemake=0`이면 이전 아트로 돌아간다.
- 기존 Node 테스트(aseprite 계열, named-motion, combat-data, frame-data, combat-update)와 `test_server_bundle.py`가 통과한다.

## 남은 제한

- 바렐 플레이어가 쓰는 상태는 모두 리메이크했다. 쓰이지 않는 아틀라스 클립(`intro`, `back`, `hook`, `hurt_old`)과 각 로더의 legacy 폴백은 이전 아트로 남아 있다.
- 눕기·엎어지기는 포즈 전체를 회전해서 만들었다. 손으로 그린 쓰러짐보다 뻣뻣해 보일 수 있다.
- 걷기의 발 미끄러짐은 이전 자산과 같은 수준이다. 이동 3.1px/틱에 비해 900ms 주기의 보폭이 짧다.
- 회전베기의 앞모습·뒷모습은 몸을 좁혔다 뒤집는 방식으로 표현했다.
