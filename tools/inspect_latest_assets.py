from pathlib import Path
from zipfile import ZipFile
from io import BytesIO
from PIL import Image,ImageOps,ImageDraw
import json
out=Path('assets/incoming');out.mkdir(exist_ok=True)
rows=[]
def unpack(z,prefix=''):
 for i in z.infolist():
  if i.is_dir():continue
  data=z.read(i);name=prefix+Path(i.filename).name
  if name.lower().endswith('.zip'):
   unpack(ZipFile(BytesIO(data)),Path(name).stem+'/');continue
  dest=out/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
  r={'source':name,'bytes':len(data),'status':'pending review'}
  try:
   im=Image.open(BytesIO(data));r.update(format=im.format,size=list(im.size),frames=getattr(im,'n_frames',1),alpha=im.convert('RGBA').getextrema()[3])
  except Exception:pass
  rows.append(r)
unpack(ZipFile(r'C:\Users\hoondo\Desktop\흑월의 기사 이미지.zip'))
Path('data/latest-assets.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
images=[r for r in rows if 'size'in r]
sheet=Image.new('RGB',(1000,180*((len(images)+3)//4)), '#282830');d=ImageDraw.Draw(sheet)
for n,r in enumerate(images):
 im=Image.open(out/r['source']).convert('RGB');im.thumbnail((246,150));x=n%4*250;y=n//4*180;sheet.paste(im,(x,y));d.text((x+4,y+151),f"{n}: {r['size']} {r['format']}",fill='white')
sheet.save('assets/incoming/contact.jpg')
print('\n'.join(f"{n}: {r['source']} {r['size']} alpha={r['alpha']}" for n,r in enumerate(images)))
