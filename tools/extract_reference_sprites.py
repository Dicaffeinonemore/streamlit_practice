"""Lossless reference-sheet inventory. Never invent missing poses or repaint RGB.

Usage: python tools/extract_reference_sprites.py --source-dir PATH
Requires Pillow. Output coordinates are in the original 1672 x 941 sheets.
Alpha masks are REVIEW CANDIDATES, not recovered original alpha channels.
"""
from __future__ import annotations

import argparse
from collections import deque
import hashlib
import json
from pathlib import Path
import shutil

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "knight": "ChatGPT 이미지 2026년 10월 15일 오후 08_38_06-1.png",
    "soldiers": "ChatGPT 이미지 2026년 10월 15일 오후 08_38_08-2.png",
    "aurelion": "ChatGPT 이미지 2026년 10월 15일 오후 08_38_10-4.png",
    "frozen_graveblord": "ChatGPT 이미지 2026년 10월 15일 오후 08_38_11-5.png",
    "black_moon_emperor": "ChatGPT 이미지 2026년 10월 15일 오후 08_39_04.png",
}
NAMES = {"infantry": "보병", "spearman": "창병", "archer": "궁병", "knight": "기사",
         "aurelion": "황금왕 아우렐리온", "frozen_graveblord": "프로즌 그레이브로드",
         "black_moon_emperor": "블랙 문 엠페러"}
EFFECTS = {
    "frozen_graveblord": [
        ("frost_slash", "서리 검기", [590,850,692,916]),
        ("ice_pillar", "얼음 기둥", [696,848,813,916]),
        ("freeze_burst", "빙결 폭발", [815,848,947,916]),
        ("cold_wave", "냉기 파동", [951,848,1088,916]),
        ("ice_fragments", "얼음 파편", [1092,848,1235,916]),
    ],
    "black_moon_emperor": [
        ("eclipse_slash", "월식 베기 이펙트", [590,848,692,917]),
        ("dark_burst", "암흑 폭발", [695,848,813,917]),
        ("void_pillar", "허무의 기둥", [816,845,945,917]),
        ("eclipse_trace", "월식 잔흔 (바닥)", [949,848,1087,917]),
        ("dark_fragments", "어둠의 파편", [1091,848,1245,917]),
    ],
}


def row(key, name, rect, declared=None, cuts=None, top=None, feet=None, anchors=None, note="", labels=None):
    return dict(id=key, name=name, sourceRect=rect, declaredFrames=declared,
                cuts=cuts, top=top, feet=feet, anchors=anchors, note=note, printedLabels=labels)


def inventory():
    """Explicit visual annotations; counts are never inferred from printed numbers."""
    chars = {}
    for char, y0, y1, idle_top, atk_top, ground in [
        ("infantry", 133, 279, 184, 327, 416),
        ("spearman", 439, 581, 474, 628, 696),
        ("archer", 708, 831, 748, 864, 921),
    ]:
        idle_bottom = {"infantry": 271, "spearman": 574, "archer": 826}[char]
        bottom = {"infantry": 428, "spearman": 705, "archer": 928}[char]
        # Boundaries follow visible figures, not the printed frame numbers.
        rows = [
            row("idle", "대기 모션", [578,y0,1058,y1-3], 6,
                [587,666,744,820,895,969,1048], idle_top, idle_bottom,
                [639,710,786,859,933,1008]),
            row("walk", "이동 모션", [1061,y0,1662,y1-3], 8,
                [1067,1141,1216,1292,1367,1442,1517,1592,1655], idle_top, idle_bottom,
                [1116,1190,1265,1340,1415,1490,1565,1636],
                note="망토·무기가 이웃 자세와 가까움. 경계 잘림과 번호 혼입을 검수해야 함."),
            row("attack", "기본 공격", [578,y1,1039,bottom], 6,
                ([584,660,735,812,889,965,1034] if char != "archer" else [584,661,736,811,885,958]),
                atk_top, ground,
                ([626,701,778,851,927,1002] if char != "archer" else [625,699,774,848,922]),
                note=("5개 인물 자세만 식별됨. 마지막 칸은 화살/잔상이며 6번째 인물로 복제하지 않음."
                      if char == "archer" else "검기/창끝이 이웃 자세와 겹칠 수 있음. 공격 판정 프레임 확정 보류.")),
            row("hurt", "피격 모션", [1041,y1,1317,bottom], 4,
                [1047,1114,1182,1250,1313], atk_top+7, ground,
                [1083,1150,1219,1284]),
            row("death", "사망 모션", [1319,y1,1662,bottom], 5,
                [1326,1404,1487,1571,1657], atk_top+7, ground,
                [1370,1451,1532,1614], note="표기 5프레임과 달리 4개 인물 자세만 식별됨. 누락 자세는 생성하지 않음."),
        ]
        chars[char] = ("soldiers", rows)
    chars["archer"][1].append(row("arrow_reference", "화살 / 잔상 참고", [950,866,1033,898],
                                       note="궁병 기본 공격 마지막 구간. 발사체 원화와 인물 모션을 구분. 가장자리 발광의 정확한 알파는 복원 불가."))
    chars["knight"] = ("knight", [
        row("idle", "대기 모션", [630,123,1661,298], 6,
            [641,807,971,1137,1302,1468,1653], 173, 292,
            [725,888,1053,1219,1383,1550], labels=[1,2,4,3,5,6],
            note="인쇄 번호가 1,2,4,3,5,6. 왼쪽→오른쪽 공간 순서로 보관하며 의도된 시간 순서는 미확정."),
        row("walk", "이동 모션", [630,305,1661,473], 8,
            [638,764,892,1020,1148,1276,1404,1532,1656], 357, 463,
            [713,840,968,1096,1224,1352,1480,1607]),
        row("attack", "기본 공격", [630,480,1661,634], 6,
            note="6개 인물 자세가 보이지만 3→4 구간 검기가 이어져 있음. 검기를 자르지 않는 독립 프레임 분리 보류."),
        row("heavy", "강공격", [9,639,832,786], 6,
            note="4개 인물 자세와 겹친 검기. 숫자 1,2,3,5,6이 자세 수와 불일치. 6프레임으로 복원 불가."),
        row("ambiguous_hurt", "피격 모션 (오른쪽 중단 중복 표기)", [838,639,1661,786], 4,
            note="5개 인물 자세와 공격 검기가 함께 있음. 아래쪽 정상 피격 패널과 섞지 않음."),
        row("hurt", "피격 모션", [9,794,713,908], 4,
            [17,188,360,533,707], 833, 902, [108,280,453,622]),
        row("death", "사망 모션", [721,794,1661,908], 5,
            [728,909,1097,1284,1472,1655], 834, 902, [806,997,1180,1370,1558]),
    ])
    chars["aurelion"] = ("aurelion", [
        row("idle", "기본 자세 / 대기", [7,211,831,355], 16,
            note="약 13개 인물 자세가 보임. 번호 16개와 불일치하며 망토/검이 이웃 자세와 겹쳐 독립 분리 보류."),
        row("walk", "이동 (걷기)", [842,211,1666,355], 16,
            note="16개로 보이는 자세가 밀집. 망토/검 겹침으로 개별 경계 확정 보류."),
        row("intro", "등장 씬", [7,359,1666,499], note="번호 중복·역순 및 장면 겹침. 배경과 등장 광원이 합성되어 있음."),
        row("attack", "기본 베기", [7,502,831,624], 16),
        row("upper", "올려치기", [842,502,1666,624], 16),
        row("slam", "내려찍기", [7,627,831,741], 16),
        row("dash", "돌진 베기", [842,627,1666,741], 16),
        row("skill1", "3단 검기 선풍", [7,745,831,861], 16),
        row("skill2", "황금의 엄벌", [842,745,1666,861], 16),
        row("skill3", "황금중파참", [7,865,831,940], 16,
            note="원본에 적힌 이름을 보존. 행 높이가 매우 작고 번호 중복, 효과 식별이 어려워 공격 형태 확정 불가."),
        row("death", "사망", [842,865,1666,940], 16),
        row("hurt", "피격 모션", None, note="독립 피격 패널 없음. 다른 모션으로 대체하지 않음."),
    ])
    chars["frozen_graveblord"] = ("frozen_graveblord", [
        row("idle", "대기 모션", [9,240,553,395], 16,
            [17,104,168,231,292,354,415,477,550], 294, 390,
            [64,136,199,261,322,383,444,505], note="16 표기지만 식별되는 인물 자세는 8개. 번호와 자세 대응 미확정."),
        row("walk", "이동 모션 (걷기)", [560,240,1112,395], 16,
            [563,641,700,758,816,874,932,991,1049,1108], 305, 390,
            [612,672,729,788,845,904,960,1018,1077], note="16 표기지만 식별되는 인물 자세는 9개. 망토 겹침 가능."),
        row("intro", "등장 씬", [1118,240,1662,395], 16),
        row("attack", "서리 베기", [9,401,683,550], 16),
        row("dash", "냉기 돌진", [689,401,1155,550], 16),
        row("wave", "얼음 파동", [1162,401,1662,550], 16),
        row("spin", "빙결 회전베기", [9,555,842,680], 16),
        row("spear", "서리 창 투척", [849,555,1193,680], 16),
        row("summon", "망자 소환", [1200,555,1662,680], 16),
        row("skill1", "삼중 빙환참", [9,685,592,814], 16),
        row("skill2", "절대영도", [599,685,1112,814], 16),
        row("skill3", "빙옥의 감옥", [1118,685,1662,814], 16),
        row("death", "사망 모션", [9,819,563,936], 16),
        row("hurt", "피격 모션", None, note="독립 피격 패널 없음."),
        row("effects", "주요 이펙트 (일부 발췌)", [570,819,1239,936],
            note="서리 검기 / 얼음 기둥 / 빙결 폭발 / 냉기 파동 / 얼음 파편. 시간 순서가 아닌 효과 견본."),
    ])
    chars["black_moon_emperor"] = ("black_moon_emperor", [
        row("idle", "대기 모션", [9,241,559,370], 16,
            [16,81,148,214,281,348,415,482,554], 289, 365,
            [52,115,182,248,314,381,447,514], note="16 표기지만 식별되는 인물 자세는 8개. 누락 프레임 복제 금지."),
        row("walk", "이동 모션 (걷기)", [565,241,1104,370], 16,
            [570,636,702,768,834,900,966,1032,1100], 290, 365,
            [611,676,742,807,872,937,1003,1069], note="16 표기지만 식별되는 인물 자세는 8개. 망토 겹침 가능."),
        row("intro", "등장 씬", [1111,241,1662,370], 16),
        row("attack", "월식 베기", [9,374,682,492], 16),
        row("upper", "흑월 올려치기", [688,374,1187,492], 16),
        row("empower", "암흑 강화", [1193,374,1662,492], 16,
            note="원본 제목은 ‘암흑 강화’. ‘암흑 강하’로 변경하지 않음."),
        row("dash", "월영 돌진", [9,497,1662,594], 16),
        row("skill1", "흑월 연참", [9,599,845,708], 16),
        row("skill2", "종언의 월식", [852,599,1662,708], 16),
        row("skill3", "허무의 처형식", [9,714,1662,827], 16),
        row("death", "사망 모션", [9,832,578,936], 16),
        row("hurt", "피격 모션", None, note="독립 피격 패널 없음."),
        row("effects", "주요 이펙트 (일부 발췌)", [585,832,1254,936],
            note="월식 베기 이펙트 / 암흑 폭발 / 허무의 기둥 / 월식 잔흔 (바닥) / 어둠의 파편. 효과 견본이며 애니메이션 아님."),
    ])
    return chars


def candidate_alpha(crop):
    """Remove ONLY boundary-connected blue/green background candidates.

    This deliberately keeps enclosed pixels opaque, avoiding the previous dark
    armor pinholes. It cannot recover alpha of baked glows or distinguish every
    boundary pixel. All outputs require manual review; RGB is never altered.
    """
    rgb = crop.convert("RGB")
    w, h = rgb.size
    flat = rgb.tobytes()
    pixels = zip(flat[0::3], flat[1::3], flat[2::3])
    possible = bytearray(w*h)
    for i, (r,g,b) in enumerate(pixels):
        # Background hue, not brightness-only chroma key. Keep neutral black armor.
        possible[i] = int(g > r + 3 and b > r + 2 and max(r,g,b) < 116 and abs(g-b) < 28)
    removed = bytearray(w*h)
    q = deque()
    for y in range(h):
        for x in (0,w-1):
            i = y*w+x
            if possible[i] and not removed[i]: removed[i]=1; q.append(i)
    for x in range(w):
        for y in (0,h-1):
            i=y*w+x
            if possible[i] and not removed[i]: removed[i]=1; q.append(i)
    while q:
        i = q.popleft(); x,y = i%w,i//w
        for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if 0 <= nx < w and 0 <= ny < h:
                j=ny*w+nx
                if possible[j] and not removed[j]: removed[j]=1; q.append(j)
    rgba = rgb.convert("RGBA")
    rgba.putalpha(Image.frombytes("L", (w,h), bytes(0 if v else 255 for v in removed)))
    return rgba


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")


def export(source_dir):
    definitions = inventory()
    images, sources = {}, []
    # Validate every input before producing anything.
    for key, name in FILES.items():
        path = source_dir/name
        im = Image.open(path); im.load()
        if im.size != (1672,941): raise ValueError(f"{name}: expected 1672x941, got {im.size}; re-annotate coordinates")
        images[key] = im.convert("RGB")
    for key, name in FILES.items():
        out = ROOT/"assets"/"reference"/"sources"/f"{key}.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_dir/name, out)
        sources.append(dict(id=key, originalFilename=name, image=out.relative_to(ROOT).as_posix(),
                            size=[1672,941], sha256=hashlib.sha256(out.read_bytes()).hexdigest(),
                            hasAlpha=False))
    catalog = dict(version=1, sourcePolicy="original-pixels-only", sources=sources, characters=[], effects="data/effects/reference.json")
    effects = []
    for source, samples in EFFECTS.items():
        dest = ROOT/"assets"/"effects"/source
        dest.mkdir(parents=True, exist_ok=True)
        for key, name, rect in samples:
            raw = images[source].crop(rect)
            original = dest/f"{key}-original.png"
            candidate = dest/f"{key}-candidate.png"
            raw.save(original); candidate_alpha(raw).save(candidate)
            effects.append(dict(id=key,name=name,source=source,sourceRect=rect,
                original=original.relative_to(ROOT).as_posix(),image=candidate.relative_to(ROOT).as_posix(),
                status="review",gameReady=False,animated=False,
                note="원본의 효과 견본 한 장. 지속 시간/재생 순서/알파 미확정. 연속 애니메이션으로 재사용하지 않음."))
    write_json(ROOT/catalog["effects"], dict(samples=effects))
    total = 0
    for char, (source, rows) in definitions.items():
        category = "bosses" if char in FILES and char != "knight" else "characters"
        dest = ROOT/"assets"/category/char
        dest.mkdir(parents=True, exist_ok=True)
        anims = {}
        for spec in rows:
            key = spec["id"]; rect=spec["sourceRect"]
            note = spec["note"]
            anim = dict(id=key, name=spec["name"], source=source, sourceRect=rect,
                        declaredFrames=spec["declaredFrames"], identifiedFrames=None,
                        fps=8 if key=="idle" else 10, loop=key in ("idle","walk"),
                        fpsSource="preview-default-not-source",
                        gameReady=False, status="missing" if rect is None else "blocked",
                        order="source-left-to-right-unverified", printedLabels=spec["printedLabels"],
                        frames=[], notes=[])
            if rect:
                panel = dest/f"{key}-source.png"
                images[source].crop(rect).save(panel)
                anim["panel"] = panel.relative_to(ROOT).as_posix()
            if key == "effects": anim["samples"] = [e for e in effects if e["source"] == source]
            cuts = spec["cuts"]
            if cuts:
                anim["identifiedFrames"] = len(cuts)-1
                anim["status"] = "review"
                anim["notes"].append("인물 수를 기준으로 잘라낸 검수 후보. 원본 시간 순서·경계·발 기준점·알파 검증 전이며 게임 적용은 차단됨.")
                count = len(cuts)-1
                frame_dir=dest/key; frame_dir.mkdir(exist_ok=True)
                # Common canvas and origin, integer translations only (no resampling).
                raw_rects=[[cuts[i],spec["top"],cuts[i+1],spec["feet"]+1] for i in range(count)]
                local_anchors=[[spec["anchors"][i]-r[0],spec["feet"]-r[1]] for i,r in enumerate(raw_rects)]
                left=max(p[0] for p in local_anchors)+8
                right=max(r[2]-r[0]-p[0] for r,p in zip(raw_rects,local_anchors))+8
                height=spec["feet"]-spec["top"]+17
                origin=[left,height-9]; anim["canvas"]=[left+right,height]; anim["origin"]=origin
                for i,(r,p) in enumerate(zip(raw_rects,local_anchors)):
                    raw=images[source].crop(r)
                    rawpath=frame_dir/f"{i:02d}-original.png"; raw.save(rawpath)
                    masked=candidate_alpha(raw)
                    frame=Image.new("RGBA",tuple(anim["canvas"]),(0,0,0,0))
                    offset=[origin[0]-p[0],origin[1]-p[1]]
                    frame.paste(masked,tuple(offset))
                    path=frame_dir/f"{i:02d}-candidate.png"; frame.save(path)
                    anim["frames"].append(dict(index=i, image=path.relative_to(ROOT).as_posix(),
                        original=rawpath.relative_to(ROOT).as_posix(), sourceRect=r,
                        sourceAnchor=spec["anchors"][i:i+1]+[spec["feet"]],
                        offset=offset, origin=origin, alphaStatus="boundary-mask-unverified"))
                    total += 1
            elif rect and not note:
                note="번호와 자세의 대응 및 이펙트 경계 미확정. 인접 효과/배경이 합성된 패널은 독립 프레임으로 등분하지 않음."
            if note: anim["notes"].append(note)
            anims[key]=anim
        animfile=ROOT/"data"/"animations"/f"{char}.json"
        write_json(animfile,dict(id=char,name=NAMES[char],animations=anims))
        # Balance values are deliberately unset where source timing is unknown.
        skills={}
        for key,a in anims.items():
            if key in ("attack","heavy","upper","slam","dash","wave","spin","spear","summon","empower","skill1","skill2","skill3"):
                skills[key]=dict(id=key,name=a["name"],animation=key,enabled=False,
                    disabledReason="원본 프레임 및 타격 시점 검수 전. 임의 판정·다른 모션 대체 금지.",
                    balance=dict(damage=None,cooldownMs=None),activeFrames=[],hitboxes=[],
                    lockMovement=True,lockActions=True)
        skillfile=ROOT/"data"/"skills"/f"{char}.json"; write_json(skillfile,dict(character=char,skills=skills))
        enemyfile=ROOT/"data"/"enemies"/f"{char}.json"
        write_json(enemyfile,dict(id=char,name=NAMES[char],animations=animfile.relative_to(ROOT).as_posix(),
            skills=skillfile.relative_to(ROOT).as_posix(),productionReady=False,
            blockers=["프레임 경계 및 알파 검수", "누락/중복 프레임과 순서 확인", "공격 판정 타이밍 확인"],
            balance=dict(hp=None,speed=None),render=dict(filter="nearest",anchor="feet",scale=1)))
        catalog["characters"].append(dict(id=char,name=NAMES[char],source=source,
            animations=animfile.relative_to(ROOT).as_posix(),skills=skillfile.relative_to(ROOT).as_posix(),
            enemy=enemyfile.relative_to(ROOT).as_posix()))
    catalog["candidateFrames"]=total
    write_json(ROOT/"data"/"reference-catalog.json",catalog)
    print(f"Exported {len(sources)} unchanged sources, {len(definitions)} characters, {total} candidate frames. Production-ready: 0 (review required).")


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir",type=Path,required=True)
    export(parser.parse_args().source_dir)
