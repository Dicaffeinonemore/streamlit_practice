"""Read the frozen stage-1 atlas; measure combat geometry without changing art."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/vargul-1.36/runtime'
META = json.loads((ROOT / 'assets/vargul/frames.json').read_text(encoding='utf-8'))
ATLAS = Image.open(ROOT / 'assets/vargul/atlas-0.webp').convert('RGBA')
# The blade turns behind the body in these drawings (visually checked contact sheets).
BACK = {'p1_sweep': {5, 6, 7, 8}, 'p2_sweep': {4, 5}, 'p2_combo': {12}}


def measure():
    result = {}
    for name, motion in META['motions'].items():
        rows = []
        for n, frame in enumerate(META['clips'][name], 1):
            x, y, w, h = frame['atlas']
            ax, ay = frame['anchor']
            im = ATLAS.crop((x, y, x+w, y+h))
            candidates = [(px, py) for py in range(h) for px in range(w)
                          if (lambda c: c[3] > 0 and c[2] > 110 and c[1] > 95
                              and c[2] > c[0]*1.18 and c[1] > c[0]*1.12)(im.getpixel((px, py)))]
            direction = -1 if n in BACK.get(name, set()) else 1
            if candidates:
                edge = (min if direction < 0 else max)(px for px, _ in candidates)
                tip_pixels = [(px, py) for px, py in candidates if abs(px-edge) <= 2]
                tip = [edge, sum(py for _, py in tip_pixels)/len(tip_pixels)]
                # Cyan identifies the blade; include its connected pale/white
                # outer point as well, rather than shortening the painted tip.
                outer = [(px,py) for px in range(max(0,edge-5),min(w,edge+6))
                         for py in range(max(0,round(tip[1])-5),min(h,round(tip[1])+6))
                         if im.getpixel((px,py))[3] > 0]
                if outer:
                    edge = (min if direction < 0 else max)(px for px,_ in outer)
                    ys = [py for px,py in outer if px == edge]
                    tip = [edge, sum(ys)/len(ys)]
            else:
                tip = [ax, max(0, ay-motion['body_scale']['reference_body_world']/META['scale']*.65)]
            k = META['scale']
            world_tip = [round((tip[0]-ax)*k, 3), round((ay-tip[1])*k, 3)]
            fallen = name.endswith('knockdown') and 5 <= n <= 12 or name == 'death' and n >= 9
            crouched = name in ['p1_dash', 'p2_dash'] and n <= 2 or name == 'ultimate' and (n <= 2 or 11 <= n <= 13)
            # Same anatomical standing/crouched/fallen boxes as Aurelion; weapon/coat excluded.
            bh = motion['body_scale']['reference_body_world'] * (.30 if fallen else .76 if crouched else 1)
            half = bh * (.90 if fallen else .22 if crouched else .145)
            body = [round(-half, 3), 0, round(2*half, 3), round(bh, 3)]
            # Blade path from the hands to the measured tip. Tall upright weapons
            # are measured too, but never become attack boxes outside active phases.
            tx, th = world_tip
            left, right = sorted([direction*8, tx])
            low = max(0, min(th-7, motion['body_scale']['reference_body_world']*.47))
            high = max(th+7, motion['body_scale']['reference_body_world']*.55)
            attack = [round(left, 3), round(low, 3), round(max(8, right-left), 3), round(high-low, 3)]
            rows.append({'drawing': n, 'tip': world_tip, 'tip_pixel': [round(v, 2) for v in tip],
                         'direction': direction, 'attack': attack, 'body': body,
                         'body_pose': 'fallen' if fallen else 'crouched' if crouched else 'standing'})
        result[name] = rows
    return result


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    measurements = measure()
    payload = {'method': 'Decoded immutable atlas; cyan blade outermost 3 columns; manually reviewed blade direction; anatomical body boxes exclude spear and coat.',
               'units': 'world px, pivot at feet; +x=original facing, +h=up', 'scale': META['scale'], 'clips': measurements}
    (OUT/'measurements.json').write_text(json.dumps(payload, indent=2), encoding='utf-8')
    target = ROOT/'vargul-data.js'
    old = target.read_text(encoding='utf-8') if target.exists() else "'use strict';\n// MEASUREMENTS_BEGIN\n// MEASUREMENTS_END\n"
    start = old.index('// MEASUREMENTS_BEGIN')
    end = old.index('// MEASUREMENTS_END')+len('// MEASUREMENTS_END')
    code = '// MEASUREMENTS_BEGIN\nconst VARGUL_MEASUREMENTS = '+json.dumps(measurements, separators=(',', ':'))+';\n// MEASUREMENTS_END'
    target.write_text(old[:start]+code+old[end:], encoding='utf-8')
    # Review artifact only; source PNGs, processed strips and vargul-art.js stay untouched.
    for name in ['p1_spear_combo', 'p2_combo', 'p1_sweep', 'p2_sweep', 'p1_dash', 'p2_dash']:
        rows = measurements[name]
        canvas = Image.new('RGB', (1000, ((len(rows)+3)//4)*180), '#202632')
        d = ImageDraw.Draw(canvas)
        for j, row in enumerate(rows):
            f = META['clips'][name][j]; x,y,w,h = f['atlas']; ax,ay = f['anchor']
            cellx=(j%4)*250; basey=(j//4)*180+158; basex=cellx+100
            im=ATLAS.crop((x,y,x+w,y+h));canvas.paste(im,(round(basex-ax),round(basey-ay)),im)
            tx,th=row['tip']; px=basex+tx/META['scale'];py=basey-th/META['scale']
            d.ellipse((px-3,py-3,px+3,py+3),outline='#ff526d',width=2)
            d.line((basex-3,basey,basex+3,basey),fill='#ffd66f')
            d.text((cellx+4,(j//4)*180+3),f'{j+1}: tip {tx:.1f}, h {th:.1f}',fill='white')
        canvas.save(OUT/(name+'-measured.png'))
    print('Measured',sum(map(len, measurements.values())),'drawings; stage-1 art unchanged.')
