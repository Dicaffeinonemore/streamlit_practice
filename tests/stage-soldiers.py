from pathlib import Path
from PIL import Image,ImageChops,ImageStat
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
entries=json.loads((ROOT/'data/stage-soldier-sources.json').read_text(encoding='utf8'))
assert [e['stage'] for e in entries]==[1,2,3,4,5]
for e in entries:
 ref=ROOT/e['reference'];assert hashlib.sha256(ref.read_bytes()).hexdigest()==e['referenceSha256']
 jpg=Image.open(ref).convert('RGB');png=Image.open(ROOT/e['runtimeSource']).convert('RGBA')
 assert jpg.size==png.size==(1672,941)
 black=Image.new('RGBA',png.size,(0,0,0,255));black.alpha_composite(png)
 error=ImageStat.Stat(ImageChops.difference(black.convert('RGB'),jpg)).mean
 assert max(error)<1.0,(e['stage'],error)
 assert png.getchannel('A').getextrema()==(0,255)
 print('PASS stage',e['stage'],'JPG matches transparent source; RGB mean error',*[round(v,3) for v in error])
