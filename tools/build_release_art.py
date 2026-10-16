from pathlib import Path
from PIL import Image
import json,base64,io
rows=json.loads(Path('data/latest-assets.json').read_text(encoding='utf8')); imgs=[r for r in rows if 'size'in r]; out=Path('assets/release');out.mkdir(exist_ok=True)
choices={'field1': ('1스테이지-처형자의 성채.png', None), 'boss1': ('1스테이지 보스 구간- 피의 처형장.png', None), 'field2': ('Stage2_Crow_Witch_Background_Concepts/Stage2_Field_Panorama.png', None), 'boss2': ('Stage2_Crow_Witch_Background_Concepts/Stage2_Boss_Arena_Panorama.png', None), 'phase2': ('폐허의 보랏빛 고딕 성당 арена.png', (0, 205, 1672, 660)), 'field3': ('Stage3_Golden_King_Background_Concepts/Stage3_Field_Golden_Citadel.png', None), 'boss3': ('Stage3_Golden_King_Background_Concepts/Stage3_Boss_Throne_Arena.png', None), 'approach3': ('Stage3_Golden_King_Background_Concepts/Stage3_Throne_Approach.png', None), 'field4': ('ChatGPT 이미지 2026년 10월 16일 오후 11_06_49-1.png', None), 'boss4': ('ChatGPT 이미지 2026년 10월 16일 오후 11_06_49-1.png', None), 'phase4': ('ChatGPT 이미지 2026년 10월 16일 오후 11_06_55-2.png', None), 'field5': ('붉은 월식 아래의 폐허와 공허-1.png', (0, 0, 1983, 390)), 'boss5': ('붉은 월식 아래의 폐허와 공허-1.png', (0, 402, 1983, 793)), 'phase5': ('붕괴한 성좌의 고딕 아레나-2.png', (0, 0, 2068, 700)), 'continue': ('ChatGPT 이미지 2026년 10월 14일 오후 10_22_04-1.png', None), 'newgame': ('ChatGPT 이미지 2026년 10월 14일 오후 10_22_06-2.png', None), 'settings': ('ChatGPT 이미지 2026년 10월 14일 오후 10_22_07-3.png', None)}
payload={}
def save(key,im):
 im.thumbnail((960,540),Image.Resampling.NEAREST);b=io.BytesIO();im.save(b,format='PNG',optimize=True);(out/(key+'.png')).write_bytes(b.getvalue());payload[key]='data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
for key,(filename,box) in choices.items():
 r=next(r for r in rows if r['source']==filename);im=Image.open(Path('assets/incoming')/r['source']);im=im.crop(box) if box else im.copy();save(key,im);r['status']='applied';r.setdefault('outputs',[]).append('assets/release/'+key+'.png');r['treatment']='Preserved source; explicit panel crop where necessary, nearest-neighbor reduction. Background only, no collision.'
opening=next(r for r in rows if r['source']=='opening_movie_pixel_intro.gif')
gif=Image.open(Path('assets/incoming')/opening['source'])
for i in range(6):
 gif.seek(min(gif.n_frames-1,round(i*(gif.n_frames-1)/5)));save('opening'+str(i),gif.convert('RGB'))
opening['status']='applied as six scene stills, not complete character animation'
for r in rows:
 if r['status']=='pending review':r['status']='held';r['reason']='Unverified frame bounds / overlapping effects or reference artwork; keep existing runtime sprites. No Aseprite file supplied.'
Path('data/latest-assets.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
Path('release-art.js').write_text("'use strict';\nconst RELEASE_ART = "+json.dumps(payload)+";\nconst RELEASE_IMAGES = {};\nfor (const [key, src] of Object.entries(RELEASE_ART)) { const im = new Image(); im.src = src; RELEASE_IMAGES[key] = im; }\n",encoding='utf8')
