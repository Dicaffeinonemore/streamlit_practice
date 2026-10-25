# 바렐 combo0 350ms 적용 준비

기존 게임과 내보내기 도구는 변경하지 않았다. 실제 게임 연결은 아직 하지 않았다.

## 리소스

- 기존 `black-knight-basic-attack.aseprite`와 기존 600ms PNG/JSON은 그대로 유지했다.
- 별도 백업: `../backups/black-knight-basic-attack-600ms.aseprite.bak`. 기존 소스와 SHA-256/바이트가 일치한다. `.bak` 확장자로 일괄 내보내기 대상에서 제외된다.
- 새 소스: `black-knight-basic-attack-350ms.aseprite`.
- 새 출력: `../exports/tests/black-knight-basic-attack-350ms.png`, `.json`.
- 별도 메타데이터: `black-knight-basic-attack-350ms.animation.json`.

| 프레임 | duration ms | 구간 ms | 기준점 | 렌더링 오프셋 |
|---|---:|---|---|---|
| 1 | 65 | [0,65) | [67,143] | [0,0] |
| 2 | 55 | [65,120) | [67,143] | [0,0] |
| 3 | 50 | [120,170) | [67,143] | [0,0] |
| 4 | 50 | [170,220) | [67,143] | [0,0] |
| 5 | 55 | [220,275) | [67,143] | [0,0] |
| 6 | 75 | [275,350) | [67,143] | [0,0] |

원본 Aseprite 바이너리의 프레임 시간과 CLI 출력 JSON을 모두 검사한다. PNG의 RGBA 픽셀은 기존 600ms 버전과 동일하다.

## 발과 월드 좌표

기존 게임은 `actor.x`를 90~200ms에 smoothstep으로 8 월드 단위 전진시킨다. 이것이 실제 이동이다. 바렐의 스프라이트 배율은 .72이고, 그 바깥에 게임 카메라의 확대 변환이 적용된다.

원본 픽셀 `(u,v)`의 그리기 좌표는 다음과 같다. offset은 원본 픽셀 단위이며 배율과 좌우 반전 전에 적용한다.

```text
drawX = actor.x - camX + face * .72 * (u - anchorX + offsetX)
drawY = actor.y - actor.z + .72 * (v - anchorY + offsetY)
```

모든 프레임에서 불투명도 128 이상인 픽셀의 최하단 행은 142다. 픽셀의 아래 경계 143과 anchorY가 일치해 세로 지면 기준은 일정하다. Canvas 여백도 양방향/최대 전진량에서 충분하다. 2번의 상단과 4번의 좌우는 원래부터 이미지 경계에 닿으므로, 원화 검수 시 칼끝·망토의 크롭 여유를 확인해야 한다.

`x=[0,100), y=[139,143)` 영역의 불투명 픽셀 가로 중심은 `60.27,34.75,30.88,30.31,54.77,59.54`다. 이 변화는 월드 이동과 별개로 원래 그림에 들어 있는 자세 변화다. 약 30 원본 px는 .72 배율에서 약 21.6 월드 단위이므로, 단순히 8 월드 단위 전진과 같은 것으로 해석할 수 없다.

해당 측정은 같은 지지발을 추적한 결과가 아니다. 자세 전환과 미끄러짐을 확정적으로 분리할 근거가 부족하다. 발 중심을 무조건 고정하면 몸/검까지 반대 방향으로 튀는 보정이 생길 수 있어 오프셋은 모두 0으로 두었다. 실제 브라우저에서 지지발을 프레임별로 확인한 뒤 `frameOffsets`만 조정할 수 있다. 충돌/월드 위치에는 영향을 주지 않는다. 미리보기의 전진량/오프셋 토글, 지면선, 기준점 십자선, 발 영역 중심 표식을 함께 비교한다.

## 판정 동기화와 실제 게임 연결 계약

메타데이터는 기존 값을 복사한 검증용 참조다. 피해나 충돌을 발생시키지 않는다.

- 공격 총시간 350ms, 판정 `[128.5,230)`ms, 다음 콤보 연결 267.5ms부터.
- 새 프레임 기준으로 3·4번 전체 일부와 5번의 첫 10ms에 판정이 걸린다. 5번 회수 그림과 판정의 마지막 10ms가 시각적으로 어울리는지 검수해야 한다.
- 기존 60Hz에서는 약 133.3~216.7ms의 틱에서 판정을 검사한다. 267.5ms 연결 조건은 약 283.3ms의 첫 충족 틱에서 처리된다. 350ms 스프라이트 끝까지 항상 재생되는 것은 아니다.
- `hitSet`, 히트스톱, 피해, 입력 버퍼, 취소, 콤보 전환은 기존 게임이 계속 소유한다.

어댑터의 순수 함수만 렌더러에서 호출한다. 아래는 향후 연결 예시이며 기존 런타임에 추가하지 않았다.

```javascript
const asset = await AsepriteAnimation.loadMetadata(
  'assets/aseprite/tests/black-knight-basic-attack-350ms.animation.json'
);
const sample = AsepriteAnimation.sampleActor(asset, player, MS);
if (sample) {
  AsepriteAnimation.draw(ctx, asset.image, sample.frame, {
    x: player.x - camX, y: player.y - (player.z || 0),
    face: player.face, scale: BAREL_PLAYER_SCALE
  });
}
```

`sampleActor`는 바렐 combo0의 `st==='atk'`, `atk==='c1'`, `combo===0`을 확인하고 `player.t * MS`만 읽는다. 히트스톱으로 t가 멈추면 그림도 멈추고, 공격 취소나 다음 콤보 상태에서는 null을 반환한다. 실제 연결 시 호출부에서 바렐 선택 여부도 확인해야 한다. 별도 `advance(deltaMs)`를 호출하면 안 된다. `sample.active/canLink/ended`는 표시용이며 기존 판정 로직을 대체하지 않는다. `gameReady:false` 검수 상태도 유지한다.

기존 `{atlas,anchor}` 형태를 유지하며, frameOffsets는 최종 anchor에 반영되어 기존 Canvas 렌더러에도 전달할 수 있다. 자동으로 메타데이터를 아틀라스 JSON에 덧붙이지 않으므로 재내보내기해도 별도 메타데이터가 보존된다. 메타데이터와 duration이 다르면 로딩을 거부한다.

## 브라우저 확인 방법

프로젝트 루트에서 실행한다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/export-sprites.ps1 -Source assets/aseprite/tests/black-knight-basic-attack-350ms.aseprite -Force
.venv-streamlit-test\Scripts\python.exe -m http.server 8766 --bind 127.0.0.1
```

`http://127.0.0.1:8766/aseprite-test.html`에서 350ms 재생, 속도 .25/.5/1/2배, 일시정지/계속, 시크, 반전, 반복을 사용할 수 있다. 시간 슬라이더는 .5ms 단위로 128.5/230/267.5ms 경계를 선택할 수 있다. 판정 구간 띠와 콤보 연결선, 프레임별 기준점/오프셋 표도 표시한다. 탭을 숨기면 자동 일시정지한다.

미리보기 transport만 시연용 시간을 공급하며 렌더러는 그 시간을 읽는다. 실제 게임 연결에서는 이 transport를 사용하지 않는다.

## 검증 결과와 한계

```powershell
node tests/aseprite-350ms.cjs
.venv-streamlit-test\Scripts\python.exe tests/aseprite-350ms-assets.py
node tests/aseprite.cjs
.venv-streamlit-test\Scripts\python.exe tests/aseprite-assets.py
node tests/reference-runtime.cjs
```

실제 CLI 내보내기, 백업 일치, Aseprite 바이너리/JSON 시간, PNG 불변, 지면/Canvas 경계, 정확한 판정/연결 경계, 외부 게임 시계, 정지/취소 샘플링, 오프셋, 미리보기 로드/속도/정지/시크/반전/반복 모의 DOM 테스트를 검증했다. 기존 참조 전투 테스트도 유지한다. 게임/바렐 런타임/motion.js/CLI 스크립트는 작업 전후 SHA-256을 대조한다.

사용 가능한 브라우저 연결이 없어 실제 브라우저 화면과 디스플레이 재생 간격은 검증하지 못했다. 리소스 편집에 따른 anchor 변화, 5번 프레임과 마지막 판정의 시각적 적합성, 지지발 미끄러짐이 남은 검수 항목이다. 실제 연결에는 index.html/Streamlit 번들의 어댑터·메타데이터·이미지 제공도 필요하며 이번 변경에는 포함하지 않았다.
