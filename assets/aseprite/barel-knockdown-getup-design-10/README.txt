바렐 넉다운 → 기상 / 10프레임 Aseprite

원본 동작: 10_Knockdown_getup_export.png
디자인 기준: 02_Barel_reference_diagonal.png
image_gen으로 두 번째 캐릭터 기준의 디자인을 적용한 새 모션 시트를 생성한 후,
투명 알파 연결 요소를 분리해 Aseprite 1.3.18.6에서 실제 10프레임 문서로 저장.

동작: 준비 → 뒤로 휘청임 → 공중 넉백 → 등 착지 → 구름 → 누움 → 무릎 기상 → 일어섬 → 회수 → 준비.
첫 번째 원본은 11개 자세이며 중복 누운 자세(7번째)를 제외한 [1,2,3,4,5,6,8,9,10,11]을 기준으로 구성.
프레임별 길이: 80/80/80/80/100/240/120/120/100/100ms, 총 1100ms.
편집 셀 640×640 RGBA, 기준점 [320,576], 발/바닥 정렬, 원본 픽셀 재샘플링 없음.
태그: knockdown_getup(1~10), knockdown(1~6), getup(7~10).

barel-knockdown-getup-design-10.aseprite: 편집용 원본.
F01.png~F10.png: 개별 투명 프레임.
review-sheet.png: 원본 해상도 5열×2행 시트.
preview-sheet.png: 50% nearest 보기용 시트.
preview.gif: 50% 크기 애니메이션 미리보기.
build.json: 프레임별 시간/좌표/소스 해시.
source/: 생성 시트, 원본 동작/디자인 참고 이미지, 실제 생성 프롬프트.

v1.51부터 바렐 down 상태의 기본 넉다운/기상 모션에 적용.
편집용 1100ms는 보존하고 게임에서는 기존 물리/기상 시간에 맞춰 56틱 재생.
idle 투구 너비 기준 renderScale=0.3873431533, 플레이어 배율0.72 적용.
manifest: barel-knockdown-getup-design-10.animation.json.
재생성: Python 분리 도구 → Aseprite batch Lua → tools/export-sprites.ps1.
