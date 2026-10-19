# v1.36 바르굴 — 1단계 그림 처리 보고서

작성일: 2026-10-20 (Asia/Seoul). **1단계 그림 처리만 완료했다. 2단계 데이터·로직 연결은 시작하지 않고 여기서 멈춘다.**

기준은 [설계·사용자 결정 사항](boss4_vargul.md)이다. p2_cast 19장 정정과 p1_sword_summon 씨앗 기반 분리 지시까지 최상단에 기록했다. 기존 사용자 변경은 보존했다.

## 결과와 용량

- 동작 24종, **316장**. p1_spear_combo의 크기 기준만 제외했고 p2_cast의 첫 그림은 유지했다.
- FX 15줄, **219칸씩 _add / _alpha 두 벌**. P2 및 변신 마스크 163칸(변신 초반·얼음 잔해 구간은 비움).
- `vargul-art.js`: **1,559,981 bytes**, 아우렐리온 1,602,584 bytes보다 **42,603 bytes (2.66%) 작다**. 게임에 연결되면 이 JS만큼 추가된다.
- 런타임 아틀라스 합계: 1,098,534 bytes. 가로 띠·JSON·검수 자료는 별도이며 JS에 중복 포함하지 않는다.
- 보존한 원본 PNG 37장 합계 83,792,243 bytes. 정리한 사본과 original/을 함께 두므로 원본 데이터가 두 벌이다. 이 크기는 게임 다운로드 크기와 구분한다.
- assets/vargul/ 전체(띠·JSON·아틀라스): 9,962,515 bytes. 검수 이미지·원본 사본은 위 번들 크기에 포함되지 않는다.

## 파일과 연결 상태

- `assets/vargul_src/original/`: ZIP 원본 이름 37장 보존. source SHA-256과 정리한 사본은 37/37 일치한다. ZIP 속 실행 코드는 사용하지 않았다.
- `assets/vargul_src/manifest.json`: 사용자 지정 이름·행별 개수·용도·기준 그림 제외·원본 해시. `motion/`, `fx/`, `reference/`, `unused/`에 사본을 정리했다.
- `assets/vargul_src/processing.json`: 측정 좌표, 씨앗/발 위치, 외래 조각 제거 위치, FX 칸 경계와 문신 ROI. 재현 가능한 처리 설정이다.
- `assets/vargul/motion/`, `fx/`, `masks/`: 동작별 가로 WebP 띠와 JSON(cell/pivot/frames/frame_data). working 띠는 무손실 WebP다.
- `vargul-art.js`, `assets/vargul/frames.json`: 기존 아우렐리온과 같은 sheets + clips[{atlas,anchor,sheet}] 형식. 동작 그림 번호와 게임 타이밍은 분리했다.
- `tools/build_vargul_art.py`, `tests/vargul-art.py`, `tools/report_vargul_art.py`: 재생성·검증·보고서/미리보기 생성.
- `README.md`: 표시 버전을 v1.36으로 올리고 아우렐리온 HP를 실제 1,800→2,200으로 수정했다. 바르굴은 그림 준비 단계임을 표시했다.
- **index.html·server.py·named 렌더러·게임 전투 로직에는 이번 작업의 연결 변경이 없다.** 새 보스가 등장한다고 보고하지 않는다.

## 단위와 결정 반영

| 종류 | 계산 | 배율 |
|---|---|---:|
| 피해 | 검기10/10, 충격파12/12, 엄벌16/16 | 1.0 |
| x·높이·해당 속도 | 바렐102.24 / 시제품200 | .5112 |
| 깊이 판정·깊이 반지름 | 게임 검기 depth16 / 시제품16, 충격파24 / 시제품24 | **1.0** |
| 시간 | 60fps 틱 그대로 | 1.0 |

깊이 속도 등 그 밖의 z 수치는 후속 데이터·로직 단계에서 이 축 기준과 기존 아우렐리온 규칙으로 명시한다. 이 단계에서 플레이어의 피격·아머·무적 규칙을 바꾸지 않았다. HP는 결정대로 P1 2,000 소진 후 P2 2,500 회복, 궁극기 최초 사용은 P2 HP35% 이하로 문서에 고정했으며 아직 전투에 적용하지 않았다.

## 크기 정규화와 피벗

바렐은 142×.72=102.24 월드 px, 바르굴 P1 목표는 ×1.25=127.8이다. 창을 제외한 정수리~발의 정수 픽셀 좌표를 시각 측정했다. 세부 털·왕관 끝과 접지 픽셀 선택에는 수 px의 측정 오차가 있을 수 있다.

변신 d1은383px, d8은412px로 측정했다. 따라서 P2/P1=**412/383=1.075718**이고 P2 기준 높이는 **137.4768 월드 px**다. 두 페이즈를 무조건 같은 높이로 눌러 맞추지 않았다.

저장 그림의 P1 기준 몸 높이는80px이며 공통 렌더 K=**127.8/80=1.5975**다. 아래 raw→저장 배율에 이 K를 곱하면 raw→월드 배율이 된다. 그림의 외곽 bbox(창·왕좌 포함)를 몸 키로 사용하지 않았다.

발 접점을 y 피벗으로 쓰고 양쪽 발이 놓인 하단의 중심으로 x를 잡았다. 다운·사망은 몸 중심 아래 바닥을 사용한다. 실제 원화의 자세·발 위치 변화까지 강제로 정지시키지는 않는다.

| 동작 | 기준 그림 | 몸 높이 원본 px | raw→저장 | raw→월드 | 기준 월드 높이 | 확인 |
|---|---:|---:|---:|---:|---:|---|
| p1_idle | d1 | 394 | 0.203046 | 0.324365 | 127.800 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p1_idle.png) |
| p1_walk | d1 | 379 | 0.211082 | 0.337203 | 127.800 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p1_walk.png) |
| p1_intro | d16 | 340 | 0.235294 | 0.375882 | 127.800 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p1_intro.png) |
| p1_spear_combo | 버린 기준 | 293 | 0.273038 | 0.436177 | 127.800 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p1_spear_combo.png) |
| p1_dash | d16 | 243 | 0.329218 | 0.525926 | 127.800 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p1_dash.png) |
| p1_sword_summon | d1 | 322 | 0.248447 | 0.396894 | 127.800 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p1_sword_summon.png) |
| p1_cross | d16 | 200 | 0.400000 | 0.639000 | 127.800 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p1_cross.png) |
| p1_orb_summon | d1 | 387 | 0.206718 | 0.330233 | 127.800 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p1_orb_summon.png) |
| p1_sweep | d16 | 217 | 0.368664 | 0.588940 | 127.800 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p1_sweep.png) |
| p1_taunt | d1 | 274 | 0.291971 | 0.466423 | 127.800 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p1_taunt.png) |
| p1_hurt | d14 | 369 | 0.216802 | 0.346341 | 127.800 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p1_hurt.png) |
| p1_knockdown | d16 | 258 | 0.310078 | 0.495349 | 127.800 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p1_knockdown.png) |
| awaken | d1 | 383 | 0.208877 | 0.333681 | 127.800 | [번호별 그림](../artifacts/vargul-1.36/art/motion/awaken.png) |
| p2_idle | d1 | 368 | 0.233852 | 0.373578 | 137.477 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p2_idle.png) |
| p2_walk | d12 | 261 | 0.329722 | 0.526731 | 137.477 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p2_walk.png) |
| p2_combo | d16 | 204 | 0.421850 | 0.673906 | 137.477 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p2_combo.png) |
| p2_dash | d16 | 234 | 0.367767 | 0.587508 | 137.477 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p2_dash.png) |
| p2_cast | d19 | 163 | 0.527960 | 0.843416 | 137.477 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p2_cast.png) |
| p2_cast_b | d1 | 239 | 0.360073 | 0.575217 | 137.477 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p2_cast_b.png) |
| p2_sweep | d1 | 363 | 0.237073 | 0.378724 | 137.477 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p2_sweep.png) |
| ultimate | d16 | 223 | 0.385908 | 0.616488 | 137.477 | [번호별 그림](../artifacts/vargul-1.36/art/motion/ultimate.png) |
| p2_hurt | d14 | 306 | 0.281233 | 0.449270 | 137.477 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p2_hurt.png) |
| p2_knockdown | d16 | 224 | 0.384185 | 0.613736 | 137.477 | [번호별 그림](../artifacts/vargul-1.36/art/motion/p2_knockdown.png) |
| death | d1 | 246 | 0.349827 | 0.558849 | 137.477 | [번호별 그림](../artifacts/vargul-1.36/art/motion/death.png) |

![바렐과 두 페이즈 비교](../artifacts/vargul-1.36/art/barel-p1-p2-comparison.png)

[변신 8장 + p2_idle 8틱 크로스페이드 미리보기(APNG)](../artifacts/vargul-1.36/art/awaken-crossfade.png)

p2_cast는 사용자 지시대로19장째의 몸 높이를 기준으로 맞췄다. 이 그림은 낮게 겨누는 자세여서 앞부분의 몸이 대기보다 크게 보일 수 있다. 첫 장은 버리지 않았으며 장별 크기를 제각각 바꿔 이 차이를 숨기지 않았다.

## p1_sword_summon 분리와 수정 이력

- 두 줄 경계는 y=464. 몸통·발·창 상단 씨앗에서 원본 전경 안으로 전파하는 geodesic watershed로16개 소유 영역을 나눴다. 사용자 제공 x 경계와 몸 연결을 함께 검수했다.
- 얼굴·시전 손·창날이 읽히는16장을 유지했다. 겹친 코트의 가려진 부분을 다시 그리지 않았다. 코트 자락 일부의 직선 절단/가림 흔적은 원본 겹침에서 온 것이다.
- 색 메움: **0곳**. 인접 장 복사/대체: **0장**. 크게 상해 대체가 필요한 장: **0장(시각 판단)**. 따라서5장 이상 중단 조건에는 해당하지 않았다.
- 외래 손 조각 제거: d8의 원본 좌표 [1419,224,1449,274], d12의 [696,589,735,645]. 이는 픽셀 추가가 아니라 삭제다. 나머지 경계 작은 섬은 씨앗 소유/연결성 기준으로 제거했다.
- 처음의 균등 분할 결과는 `source-review/p1_sword_summon.jpg`에 비교 자료로 남겼다. 최종 확인용은 아래의 decoded atlas 이미지다.

![빙검 시전 최종16장](../artifacts/vargul-1.36/art/motion/p1_sword_summon.png)

## 3타 깊이 찌르기 판독 의견

**d7–8은 깊이 찌르기로 읽힌다.** d7은 몸을 낮추고 창을 겨누는 준비 자세, d8은 더 낮게 뻗으며 창끝이 앞으로 나가는 자세다. d7을14틱 유지한 뒤 d8로 전진시키면 세 번째 찌르기의 힘이 구분될 것으로 본다. 실제 전투의 판독성과1.2배 사거리 동기화는2·3단계에서 확인해야 한다.

버린 크기 기준 때문에 게임 d7/d8은 원본 순서8/9에 해당한다. 이 대응과 thirdWindupHold=7, thirdHit=[7,8], kind=deep_thrust를 기록했다. P2 콤보의 올려베기 지시는 유지한다.

![3타 그림7과8](../artifacts/vargul-1.36/art/p1-third-hit-review.png)

## FX 줄별 개수와 칸 경계

원본의 발광·파편이 서로 붙어 있으므로 행별로 보이는 중심을 세고 그 사이에 칸 경계를 기록했다. 모든 줄을16칸이라고 가정하지 않았다. 원본에 시간표·프레임 라벨이 없는 줄의 연결된 발광 경계는 검수용 분할안이며, 독립된 원본 프레임의 시간 정보가 확인된 것은 아니다. 특히 큰 폭발의 이웃 칸에는 발광 절단면이 보일 수 있다.

| 시트/줄 | 용도 | 칸 수 | 확인 이미지 |
|---|---|---:|---|
| A/1 | spear_flash | 16 | [번호별 칸](../artifacts/vargul-1.36/art/fx/A1-spear_flash.png) |
| A/2 | dash_frost | 13 | [번호별 칸](../artifacts/vargul-1.36/art/fx/A2-dash_frost.png) |
| A/3 | ice_orb | 13 | [번호별 칸](../artifacts/vargul-1.36/art/fx/A3-ice_orb.png) |
| A/4 | ice_shard | 11 | [번호별 칸](../artifacts/vargul-1.36/art/fx/A4-ice_shard.png) |
| A/5 | sword_fall_reserve | 16 | [번호별 칸](../artifacts/vargul-1.36/art/fx/A5-sword_fall_reserve.png) |
| A/6 | sword_warning_reserve | 15 | [번호별 칸](../artifacts/vargul-1.36/art/fx/A6-sword_warning_reserve.png) |
| B/1 | sword_fall | 17 | [번호별 칸](../artifacts/vargul-1.36/art/fx/B1-sword_fall.png) |
| B/2 | frost_burst | 13 | [번호별 칸](../artifacts/vargul-1.36/art/fx/B2-frost_burst.png) |
| B/3 | sword_warning | 15 | [번호별 칸](../artifacts/vargul-1.36/art/fx/B3-sword_warning.png) |
| B/4 | cross_warning | 13 | [번호별 칸](../artifacts/vargul-1.36/art/fx/B4-cross_warning.png) |
| B/5 | cross_eruption | 16 | [번호별 칸](../artifacts/vargul-1.36/art/fx/B5-cross_eruption.png) |
| C/1 | giant_spear | 21 | [번호별 칸](../artifacts/vargul-1.36/art/fx/C1-giant_spear.png) |
| C/2 | glacier_impact | 13 | [번호별 칸](../artifacts/vargul-1.36/art/fx/C2-glacier_impact.png) |
| C/3 | ultimate_warning | 11 | [번호별 칸](../artifacts/vargul-1.36/art/fx/C3-ultimate_warning.png) |
| C/4 | frost_aura | 16 | [번호별 칸](../artifacts/vargul-1.36/art/fx/C4-frost_aura.png) |

- _add는 검정 배경의 원래 발광 RGB, _alpha는 alpha=max(R,G,B), RGB/alpha로 만들어 검정 테두리를 제거했다. 빨간 경고선은 원래 색을 유지했다.
- 두 완성 변형을 모두 띠로 내보냈다. JS에는 RGB FX 아틀라스를 한 번만 넣고 _alpha 클립에 alphaFromMaxRGB를 표시한다. 후속 렌더러는 이 변형을 최초 로딩 때 한 번 복원해 캐시해야 한다. 이를 처리하지 않고 일반 source-over로 그리면 검정 배경이 보이므로 계약을 명시했다.
- 변신 별칭: 서리 폭발=B2, 파편=A4, 바닥 서리 고리=B5. 시트D는 만들지 않았다.
- 십자 경고 B4는 floor_scale_y=.35. 그 외 원본 FX를 임의의 새 그림으로 교체하지 않았다.

![FX A 분할](../artifacts/vargul-1.36/art/fx-sheet-A-review.jpg)

![FX B 분할](../artifacts/vargul-1.36/art/fx-sheet-B-review.jpg)

![FX C 분할](../artifacts/vargul-1.36/art/fx-sheet-C-review.jpg)

![빨간 십자 바닥 투영](../artifacts/vargul-1.36/art/cross-warning-floor.png)

## 문신 마스크·압축과 시각 한계

- 원본의 초록 우세 픽셀만 키잉하고 초록 번짐을 줄였다. blue가 green을 뒷받침하는 정상 하늘색은 전역 색조 변경으로 지우지 않았다.
- 마스크는 피부 ROI 안의 밝은 하늘색 선을 고른다. 창날·갑옷·의상 전체에 색 필터를 씌우지 않는다. 마스크는 가슴·목·배의 선을 보수적으로 추출하며 갑옷에 인접한 팔 문신의 약한 픽셀은 일부 제외될 수 있다. 원본 master_p2는 게임 번들에 넣지 않았다.
- 캐릭터 RGB는 WebP q75, 런타임 알파는96 이상을 불투명으로 하는 픽셀 경계다. 원본의8비트 반투명 가장자리를 완전히 보존했다고 주장하지 않는다. working 띠에는 그 이전 알파를 보존했다. 마스크 알파는8단계이며 별도 PNG로 넣었다.
- 316개 동작 그림·219개 FX를 아우렐리온 이하 용량으로 넣기 위해 저장 해상도80px를 택했다. 게임 표시 몸 높이127.8은 유지하지만 확대하면 원본보다 미세한 얼굴·문신·코트 정보가 줄어든다. 확인 이미지는 이 최종 decoded RGB를 사용한다.
- p1_hurt 상단 일부는 원화 자체의 창/코트 겹침으로 창대 일부가 비어 보인다. 누락된 부분을 다른 보스 그림이나 새 선으로 채우지 않았다. p1_intro는 요청대로 왕좌를 포함해 균등 칸으로 잘랐으며 인접 코트·왕좌의 겹침 흔적이 남을 수 있다. 다음의 전체 동작 이미지를 함께 검토해야 한다.

- death는 줄 경계를 겹쳐 창끝을 포함한 뒤, 윗줄 바닥의 얇은 잔여물을 제거했다. d9–12의 다음 줄 창끝 조각은 명시한 사각 영역으로 제거했고 d16의 윗줄 바닥은 원래 창끝 소유 영역을 남기는 마스크로 정리했다. 제거 좌표와 다각형은 processing.json에 기록했다. 가려진 원래 픽셀은 새로 그리지 않았다.

![캐릭터와 문신 마스크](../artifacts/vargul-1.36/art/tattoo-mask-review.png)

## 검증

- `python tests/vargul-art.py`: PASS. 원본/사본37개 해시, 동작316개·FX219칸×2,19장 시전 순서, 스케일·피벗, 모든 아틀라스 경계, 마스크 정렬, 용량 상한, 십자0.35,7–8장 대응을 검사했다.
- 최종 캐릭터 아틀라스의 강한 초록 우세 잔류 픽셀: **0**. 이것은 정의한 임계값의 검사이며 시각 품질 전체를 대신하지 않는다.
- 저장된 RGB FX에서 투명 변형을 복원한 뒤 다시 더했을 때 최대 채널 오차: **0**.
- `node --check vargul-art.js`: PASS. 원본 PNG37장과 최종 번들 모든 이미지의 디코딩을 확인했다.
- 무기 끝·시전·다운·사망·문신 및 FX 확인 이미지를 검토했다. 후딜/반격 표, 회피, 처치 비교, 콘솔0·60fps·실전 스크린샷은 아직 실행하지 않았다. 후속3단계의 검증 항목이다.

[기계 판독 검증 결과](../artifacts/vargul-1.36/art/validation.json) · [빌드 수치](../assets/vargul/build-report.json)

재현: `python tools/build_vargul_art.py` → `python tests/vargul-art.py` → `node --check vargul-art.js` → `python tools/report_vargul_art.py`.

## 동작별 전체 확인 이미지

d번호는 게임 그림 순서, src번호는 시트에서 세었던 원본 순서다. +는 피벗이다. 각 이미지는 최종 번들에서 디코딩한 그림이며 타격 박스나 시간은 아직 붙이지 않았다.

### p1_idle

![p1_idle 번호별 그림](../artifacts/vargul-1.36/art/motion/p1_idle.png)

### p1_walk

![p1_walk 번호별 그림](../artifacts/vargul-1.36/art/motion/p1_walk.png)

### p1_intro

![p1_intro 번호별 그림](../artifacts/vargul-1.36/art/motion/p1_intro.png)

### p1_spear_combo

![p1_spear_combo 번호별 그림](../artifacts/vargul-1.36/art/motion/p1_spear_combo.png)

### p1_dash

![p1_dash 번호별 그림](../artifacts/vargul-1.36/art/motion/p1_dash.png)

### p1_sword_summon

![p1_sword_summon 번호별 그림](../artifacts/vargul-1.36/art/motion/p1_sword_summon.png)

### p1_cross

![p1_cross 번호별 그림](../artifacts/vargul-1.36/art/motion/p1_cross.png)

### p1_orb_summon

![p1_orb_summon 번호별 그림](../artifacts/vargul-1.36/art/motion/p1_orb_summon.png)

### p1_sweep

![p1_sweep 번호별 그림](../artifacts/vargul-1.36/art/motion/p1_sweep.png)

### p1_taunt

![p1_taunt 번호별 그림](../artifacts/vargul-1.36/art/motion/p1_taunt.png)

### p1_hurt

![p1_hurt 번호별 그림](../artifacts/vargul-1.36/art/motion/p1_hurt.png)

### p1_knockdown

![p1_knockdown 번호별 그림](../artifacts/vargul-1.36/art/motion/p1_knockdown.png)

### awaken

![awaken 번호별 그림](../artifacts/vargul-1.36/art/motion/awaken.png)

### p2_idle

![p2_idle 번호별 그림](../artifacts/vargul-1.36/art/motion/p2_idle.png)

### p2_walk

![p2_walk 번호별 그림](../artifacts/vargul-1.36/art/motion/p2_walk.png)

### p2_combo

![p2_combo 번호별 그림](../artifacts/vargul-1.36/art/motion/p2_combo.png)

### p2_dash

![p2_dash 번호별 그림](../artifacts/vargul-1.36/art/motion/p2_dash.png)

### p2_cast

![p2_cast 번호별 그림](../artifacts/vargul-1.36/art/motion/p2_cast.png)

### p2_cast_b

![p2_cast_b 번호별 그림](../artifacts/vargul-1.36/art/motion/p2_cast_b.png)

### p2_sweep

![p2_sweep 번호별 그림](../artifacts/vargul-1.36/art/motion/p2_sweep.png)

### ultimate

![ultimate 번호별 그림](../artifacts/vargul-1.36/art/motion/ultimate.png)

### p2_hurt

![p2_hurt 번호별 그림](../artifacts/vargul-1.36/art/motion/p2_hurt.png)

### p2_knockdown

![p2_knockdown 번호별 그림](../artifacts/vargul-1.36/art/motion/p2_knockdown.png)

### death

![death 번호별 그림](../artifacts/vargul-1.36/art/motion/death.png)

**1단계 종료. 사용자 검토 전에는2단계 데이터·로직 및 등장 연결을 진행하지 않는다.**
