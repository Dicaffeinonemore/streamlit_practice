# 원본 아트 관리 (2026-11-10)

게임이 실제로 읽는 파일만 저장소에 둡니다. 그림을 다시 뽑을 때만 필요한 원본 시트·작업 파일은 `.gitignore`로 제외했고, 각자의 PC에 그대로 남아 있습니다. **저장소에 없으므로 따로 백업해야 합니다.**

## 저장소에 남는 것

- `assets/runtime/` — 게임이 읽는 이미지 전부(`data/runtime-assets.json` 매니페스트)
- `assets/aseprite/NAME/NAME.animation.json`, `assets/aseprite/exports/NAME/` — 바렐 모션
- `assets/aseprite/tests/`, `assets/aseprite/exports/tests/` — 애니메이션 엔진 테스트 고정 파일
- `assets/bgm/boss.mp3`
- `assets/characters/`, `assets/bosses/`, `assets/effects/`(후보·원본 비교), `assets/reference/` — 스프라이트 검수 화면(sprite-lab.html)

기준은 `server.py`가 게임과 검수 화면을 배포할 때 모으는 파일 목록입니다. 새 그림을 만들면 도구가 `assets/runtime/`에 결과를 쓰므로 평소처럼 커밋하면 됩니다.

## 저장소에서 빠진 원본 (약 560MiB)

| 폴더 | 내용 |
|---|---|
| `assets_src/` | 1스테이지 배경 영상·적 시트·이펙트 시트, 비에사·바렐 원본 |
| `assets/incoming/` | 받은 그대로의 원본 이미지·GIF |
| `assets/named/` | 스테이지 병사·보스 원본 시트와 JPG 참고본 |
| `assets/vargul_src/`, `assets/sovereign_src/` | 보스 4·5 원본 |
| `assets/vargul/`, `assets/aurelion/`, `assets/morgra/`, `assets/gorath/`, `assets/barel/`, `assets/viesa/`, `assets/sovereign/` | 캐릭터별 아틀라스·프레임 원본 |
| `assets/floors/`, `assets/items/`, `assets/release/`, `assets/ui/`, `assets/sfx/`, `assets/effects/zones/` | 바닥·아이템·타이틀·UI·효과음 원본 |
| `assets/aseprite/*/` 의 `F01~F10.png`, `*.aseprite`, `source/`, `review-strip.png`, `separation.json`, `hurt_old/`, `jump_old/` | Aseprite 작업 파일 |

## 원본이 있어야 하는 작업

- `tools/`의 그림 생성 도구(`stage_bg.py`, `enemy_sheets.py`, `viesa_build.py`, `build_*.py`, `*.lua` 등)
- 원본 검증 테스트: `tests/named-assets.py`, `tests/stage-soldiers.py`, `tests/aseprite-assets.py`, `tests/*-assets.py`, `tests/aurelion-build.py`, `tests/vargul-art.py`

게임 실행, `node tests/regression.cjs`, `node tests/combat-data.cjs`, 서버 번들 테스트, 스프라이트 검수 화면은 원본 없이 동작합니다. 원본을 뺀 깨끗한 작업 트리에서 전체 테스트를 돌려 확인했습니다.

## 백업과 복원

1. 위 폴더들을 저장소 폴더 구조 그대로 압축해 클라우드 드라이브나 외장 디스크에 둡니다.
2. 다른 PC에서 작업할 때는 저장소를 받은 뒤 압축을 저장소 루트에 풉니다. `.gitignore`가 있으므로 실수로 커밋되지 않습니다.
3. 원본을 다시 저장소에 넣고 싶으면 git-lfs를 쓰는 것을 권합니다. GitHub 무료 LFS 용량은 1GiB입니다.
