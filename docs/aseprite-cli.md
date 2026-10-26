# Steam Aseprite CLI 연동

일반 플레이어 idle도 10프레임을 기본 적용했다. 기존 1300ms 루프를 유지하며 [idle 적용·검증·복구 보고서](barel-idle-10-implementation.md)에 원본 보완·정렬과 상태 복귀 결과를 정리했다.

바렐 3타 `combo2`도 검증 후 10프레임을 기본 적용했다. [3타 적용·검증·복구 보고서](barel-combo2-10-implementation.md)에 마지막 공격 메타데이터와 독립적인 legacy 복구 방법을 정리했다.

바렐 2타 `combo1`도 검증 후 10프레임을 기본 적용했다. [combo1 적용·검증·복구 안내](barel-combo1-10-implementation.md)를 참고한다. 1타·2타의 모드 선택과 폴백은 독립적이다.

현재 실게임 `combo0`는 새 10프레임 테스트 모드를 기본으로 사용한다. 아래 기존 6프레임 테스트 설명과 별개로 [10프레임 적용·검증·복구 안내](barel-combo0-10-implementation.md)를 참고한다. 기존 CLI와 테스트 소스는 보존했다.

## 구조 분석과 적용 범위

- 실제 게임: 루트 `index.html` → `game.js`, 캐릭터별 `*-art.js` / `*-runtime.js`. `server.py`는 일반 로컬 실행과 Streamlit 번들을 제공한다.
- 플레이어 흑기사는 **바렐**(`barel-runtime.js`)이다. `assets/characters/knight`는 적 흑철 중기사 자료이므로 이번 테스트 대상으로 사용하지 않았다.
- 바렐의 기존 프레임 형식은 `{atlas: [x,y,w,h], anchor: [ax,ay]}`이며 Canvas `drawImage`로 그린다. 기본 공격 첫 동작은 `assets/barel/frames.json`의 `combo0`, 총 6프레임이다.
- 기존 `src/animation/player.js`는 고정 FPS 참조용 플레이어다. 새 `src/animation/aseprite.js`는 프레임마다 다른 duration을 지원하는 독립 어댑터다. 기존 플레이어/게임 런타임/전투 코드는 수정하지 않았다.
- 기존 `.aseprite` 원본이 없어 `combo0` 아틀라스의 복사본으로 편집 가능한 테스트 소스를 생성했다. 원본 아틀라스는 읽기만 한다.

## 설치 경로와 탐색

이번 환경에서 확인한 경로와 버전:

```text
C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe
Aseprite 1.3.18.6-x64
```

`tools/export-sprites.ps1`은 `-AsepritePath` → `ASEPRITE_PATH` 환경변수 → PATH → Steam 기본 경로/레지스트리 및 `steamapps/libraryfolders.vdf` 순으로 탐색한다. 개인 설치 경로를 소스에 고정하지 않는다. GUI 실행 파일의 완료를 기다린 뒤 종료 코드를 검사한다.

## 실행

프로젝트 루트 PowerShell에서 실행한다. `Bypass`는 이 명령의 PowerShell 프로세스에만 적용되며 시스템 실행 정책을 변경하지 않는다.

```powershell
# 최초 실행: 테스트 소스 생성 후 PNG + JSON 내보내기
powershell -NoProfile -ExecutionPolicy Bypass -File tools/export-sprites.ps1 -CreateTestSource

# Aseprite에서 소스를 편집한 뒤 테스트 출력만 다시 생성
powershell -NoProfile -ExecutionPolicy Bypass -File tools/export-sprites.ps1 -Source assets/aseprite/tests/black-knight-basic-attack.aseprite -Force

# assets/aseprite 하위의 모든 .aseprite 일괄 내보내기
powershell -NoProfile -ExecutionPolicy Bypass -File tools/export-sprites.ps1 -Force

# 다른 설치 위치를 직접 지정할 때
powershell -NoProfile -ExecutionPolicy Bypass -File tools/export-sprites.ps1 -AsepritePath 'D:\SteamLibrary\steamapps\common\Aseprite\Aseprite.exe' -Force
```

`-Source` 상대 경로는 프로젝트 루트를 기준으로 해석한다. 소스는 `assets/aseprite/` 내부의 `.aseprite` 파일만 허용한다. 출력은 그 하위 경로를 유지해 `assets/aseprite/exports/`에 생성한다. 파일명은 공백과 한글을 지원한다.

기존 출력이 있으면 기본 실행은 전체 내보내기 전에 중단한다. `-Force`도 생성 PNG/JSON에만 적용된다. `-CreateTestSource`는 이미 있는 `.aseprite` 파일을 항상 보존한다. CLI 오류 시 임시 `.stage-*` 폴더를 진단용으로 남기고 기존 정상 출력을 유지한다. 자동 감시 프로세스는 추가하지 않았으며 명령을 실행할 때 일괄 처리한다.

내보내기는 공식 CLI의 `--batch`, `--list-tags`, `--sheet-type horizontal`, `--format json-array`, `--sheet`, `--data`를 사용한다. 좌표·프레임 지속 시간·태그 범위/방향을 보존하며 `meta.image`만 이동 가능한 형제 PNG 파일명으로 정규화한다. [Aseprite 공식 CLI 문서](https://www.aseprite.org/docs/cli/)

## 생성물과 미리보기

```text
assets/aseprite/tests/black-knight-basic-attack.aseprite
assets/aseprite/exports/tests/black-knight-basic-attack.png
assets/aseprite/exports/tests/black-knight-basic-attack.json
```

테스트 PNG는 996×143, 각 프레임은 166×143이다. 발 기준점을 `[67,143]`으로 정렬했다. 태그는 `basic-attack`, 프레임은 0~5, 방향은 `forward`다. 지속 시간은 100/80/60/90/110/160ms, 합계 600ms이며 **파이프라인 확인용 샘플 타이밍**이다. 게임 공격 판정 시간은 변경하지 않았다.

미리보기는 별도 로컬 HTTP 페이지다. 프로젝트의 Python 환경에서 다음 명령을 실행한다.

```powershell
.venv-streamlit-test\Scripts\python.exe -m http.server 8766 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:8766/aseprite-test.html`을 연다. 공격 재생, 좌우 반전, 반복을 조작할 수 있으며 현재 좌표와 지속 시간이 표시된다. 서버 종료는 Ctrl+C다. 이 페이지는 `index.html`이나 Streamlit 게임 번들에 자동 삽입되지 않는다.

## Canvas 호환 API

```javascript
const asset = await AsepriteAnimation.load(
  'assets/aseprite/exports/tests/black-knight-basic-attack.json',
  { anchor: [67, 143] }
);
const player = new AsepriteAnimation.AnimationPlayer(asset.clips);
player.play('basic-attack'); // 기본값: 일회 재생, 마지막 프레임 유지
player.advance(deltaMs);
AsepriteAnimation.draw(ctx, asset.image, player.frame, {
  x: actor.x - camX, y: actor.y - (actor.z || 0),
  face: actor.face, scale: .72
});
// 기존 barelFrame(name, progress, loop) 방식과 같은 정규화 진행률 샘플링:
const frame = AsepriteAnimation.frameAtProgress(asset.clips['basic-attack'], progress, false);
// frame.atlas / frame.anchor를 기존 Canvas 렌더러에 넘길 수도 있다.
```

스크립트 `src/animation/aseprite.js`를 먼저 로드해야 한다. 어댑터는 json-array/json-hash, 태그 범위와 forward/reverse/pingpong/pingpong_reverse, 프레임별 duration, trim 오프셋을 읽는다. 회전 패킹은 명시적으로 거부하며 현재 내보내기는 회전하지 않는다. 태그의 repeat 등 원본 속성은 `clip.tag`에 보존하고, 반복 재생은 `play(id,{loop:true})`에서 명시한다. 태그가 없으면 `default` 클립을 만든다.

테스트 클립의 `gameReady`는 false다. 어댑터 플레이어는 미리보기용이며 기존 `ReferenceAnimation`의 전투 이벤트 처리나 전투용 사용 승인 검사를 대체하지 않는다. 실제 게임에 적용하려면 별도 검수 후 렌더링 연결과 공격 타이밍 정책을 결정해야 한다.

## 검증

```powershell
node tests/aseprite.cjs
.venv-streamlit-test\Scripts\python.exe tests/aseprite-assets.py
node tests/reference-runtime.cjs
```

- Steam CLI로 테스트 `.aseprite` 생성과 PNG/JSON 내보내기 및 명시적 재내보내기 성공.
- 실제 출력 JSON의 6프레임, 좌표, 지속 시간, 태그 읽기 성공.
- 지속 시간 경계, 일회/반복 재생, seek, 태그 방향, trim 기준점, Canvas draw 인수와 좌우 반전 테스트 통과.
- 기존 바렐 combo0와 6프레임의 보이는 픽셀 일치 확인. 기본 덮어쓰기 차단 전후 원본/출력/게임 코드 SHA-256 일치 확인.
- 기존 참조 애니메이션/전투 테스트 통과. Git 변경 목록은 신규 파일만 포함.
- 출력 PNG를 시각적으로 확인했다. 이 세션에는 사용 가능한 브라우저 자동화 연결이 없어 실제 브라우저의 Canvas 재생 확인은 수행하지 못했다.
