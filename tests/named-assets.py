"""Verify the explicit named-source atlas against original RGBA pixels."""
from pathlib import Path
from PIL import Image
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
m=json.loads((ROOT/'data/named-sprites.json').read_text(encoding='utf8'))
a=Image.open(ROOT/'assets/named/combat.png').convert('RGBA');src={}
for key,r in m['sources'].items():
 p=ROOT/r['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==r['sha256'];src[key]=Image.open(p).convert('RGBA')
for f in m['frames']:
 x,y,w,h=f['atlas'];original=src[f['source']].crop(f['rect']);cut=a.crop((x,y,x+w,y+h))
 assert cut.size==original.size,f['id']
 assert cut.convert('RGB').tobytes()==original.convert('RGB').tobytes(),f['id']
 diffs=[(a,b) for a,b in zip(cut.getchannel('A').tobytes(),original.getchannel('A').tobytes()) if a!=b]
 assert len(diffs)==f.get('edgeFragmentPixels',0) and all(a==0 and b>0 for a,b in diffs),f['id']
 if diffs:assert f['source'].startswith('soldiers') or f['source']=='emperor'
 assert f['scale']>0 and all(isinstance(n,(int,float)) for n in f['anchor'])
for actor,clips in m['clips'].items():
 for clip,ids in clips.items():
  assert ids and all(0<=i<len(m['frames']) for i in ids)
  expected={'boss1':{'gorath_motion','gorath_moves'},'boss2p2':{'witch2'},'boss3':{'gold'},'boss4':{'ice'},'boss5':{'emperor'},'player':{'player'}}.get(actor,({'soldiers'+actor[5]} if actor.startswith('stage') else set()))
  assert all(m['frames'][i]['source'] in expected for i in ids),(actor,clip)
print('PASS named source hashes,',len(m['frames']),'RGB-preserving crops, recorded edge-alpha cleanup, anchors and exclusive role mappings')
