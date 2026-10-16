from pathlib import Path
from PIL import Image,ImageDraw
import json
m=json.loads(Path('data/named-sprites.json').read_text(encoding='utf8'));a=Image.open('assets/named/combat.png')
for stage in range(1,6):
 sheet=Image.new('RGB',(1920,435),'#343140');d=ImageDraw.Draw(sheet)
 for r,role in enumerate(['grunt','rogue','archer']):
  n=0
  for action,ids in m['clips'][f'stage{stage}_{role}'].items():
   for idx in ids:
    f=m['frames'][idx];x,y,w,h=f['atlas'];im=a.crop((x,y,x+w,y+h));im.thumbnail((108,112));sheet.paste(im,(n*120,r*145+20),im);d.text((n*120,r*145+3),action,fill='white');n+=1
 sheet.save(f'assets/named/stage{stage}-review.jpg')
