from PIL import Image,ImageDraw
from pathlib import Path
import json
m=json.loads(Path('data/named-sprites.json').read_text(encoding='utf8'));a=Image.open('assets/named/combat.png');rows=[]
for actor,clips in m['clips'].items():
 for name,ids in clips.items():rows.append((actor,name,ids))
sheet=Image.new('RGB',(1000,len(rows)*130),'#25232c');d=ImageDraw.Draw(sheet)
for n,(actor,name,ids) in enumerate(rows):
 d.text((0,n*130),actor+' '+name,fill='white')
 for i,idx in enumerate(ids[:8]):
  f=m['frames'][idx];x,y,w,h=f['atlas'];im=a.crop((x,y,x+w,y+h));im.thumbnail((120,105));sheet.paste(im,(i*125,n*130+20),im)
sheet.save('assets/named/review.jpg')
sheet.crop((0,0,1000,1300)).save('assets/named/review-top.jpg')
sheet.crop((0,1300,1000,2600)).save('assets/named/review-mid.jpg')
sheet.crop((0,2600,1000,sheet.height)).save('assets/named/review-bottom.jpg')
