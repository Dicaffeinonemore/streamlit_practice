"""Named source -> explicit frame rectangles. Preserve original RGBA, never key black out."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,base64,io,hashlib,shutil
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(r'C:/Users/hoondo/Desktop/흑월의 기사 이미지')
out=ROOT/'assets/named';out.mkdir(exist_ok=True)
files={**{f'soldiers{i}':f'{i}스테이지 병사' for i in range(2,6)},'soldiers1':'1스테이지 병사','gorath_motion':'1스테이지 보스 고라스 모션.png','gorath_moves':'1스테이지 보스 고라스 무브셋.png','player':'다크 기사 전투 스프라이트 시트.png','witch2':'까마귀 마녀 2페이즈 스프라이트 시트.png','ice':'얼음 망자의 왕 스프라이트 시트.png','gold':'황금 왕 팔라딘 스프라이트 아틀라스.png'}
files['emperor']='5스테이지 보스.png'
files['player_base']='어둠의 기사와 룬 대검 스프라이트 시트.png'
files['player_moves']='다크 나이트 전투 스프라이트 시트.png'
files['player_walk']='암흑 기사 대검 보행 사이클 스프라이트.png'
files.update({f'heavy{i}':f'{i}스테이지 중기사.png' for i in range(1,6)})
images={};sources={}
for key,name in files.items():
 src=SOURCE/name
 if not src.exists():src=ROOT/'assets/incoming'/name
 data=src.read_bytes();dest=out/(key+'.png')
 if not dest.exists() or dest.read_bytes()!=data:dest.write_bytes(data)
 images[key]=Image.open(io.BytesIO(data)).convert('RGBA');sources[key]={'filename':name,'path':str(dest.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(data).hexdigest(),'size':list(images[key].size)}
clips={};frames=[]
def remove_edge_fragments(im, margin=3, main_only=False):
 # Keep original RGB/alpha in the main sprite. Only discard disconnected small
 # components that touch a frame border (pieces of the neighbouring pose).
 # All regular soldiers can contain neighbouring weapons away from the borders.
 # Keep the body and its connected equipment, including during attacks/death.
 from collections import deque
 a=im.getchannel('A');w,h=im.size;alpha=list(a.tobytes());seen=bytearray(w*h);groups=[]
 original_alpha=alpha[:]
 if main_only:alpha=[v if v>=64 else 0 for v in alpha]
 for start,value in enumerate(alpha):
  if not value or seen[start]:continue
  todo=[start];seen[start]=1;group=[];edge=False
  while todo:
   i=todo.pop();group.append(i);x=i%w;y=i//w
   if x<margin or x>=w-margin or y<margin or y>=h-margin:edge=True
   for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
    if 0<=nx<w and 0<=ny<h:
     j=ny*w+nx
     if alpha[j] and not seen[j]:seen[j]=1;todo.append(j)
  groups.append((group,edge))
 largest=max((len(g) for g,e in groups),default=0);removed=[]
 for g,edge in groups:
  if (main_only and len(g)<largest) or (not main_only and edge and len(g)<largest*.22):
   for i in g:alpha[i]=0
   removed.extend(g)
 if main_only:
  # Faint alpha bridges from neighbouring poses must not join their silhouettes.
  # Restore two connected edge pixels of the original antialiasing around the body.
  kept={i for i,v in enumerate(alpha) if v}
  for _ in range(2):
   extra=set()
   for i in kept:
    x=i%w;y=i//w
    for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
     j=ny*w+nx
     if 0<=nx<w and 0<=ny<h and original_alpha[j]:extra.add(j)
   kept.update(extra)
  alpha=[v if i in kept else 0 for i,v in enumerate(original_alpha)]
 if removed or main_only:
  a.putdata(alpha);im.putalpha(a)
 return im,len(removed)

def row(actor,clip,src,y0,y1,cuts,anchors,feet,scale):
 ids=[]
 for j,(x0,x1) in enumerate(zip(cuts,cuts[1:])):
  if actor=='boss5':
   # Explicit gaps exclude visible strips of the adjacent pose, even where faint
   # source alpha bridges would make connected-component cleanup ineffective.
   bounds={'idle':[(170,275),(280,375)], 'walk':[(252,358),(365,474)],
           'cast':[(390,498),(510,610),(623,724)],
           'slash':[(0,100),(103,197),(200,300),(314,432)],
           'hurt':[(198,348),(350,464)],
           'death':[(350,464),(500,654),(660,802),(816,950),(980,1124),(1140,1280),(1304,1448)]}
   if clip in bounds:x0,x1=bounds[clip][j]
  rect=[x0,y0,x1,y1];im=images[src].crop(rect)
  removed=0
  if src.startswith(('soldiers','heavy')) or src in ('emperor','player_moves'):im,removed=remove_edge_fragments(im,24 if src=='emperor' else 6 if src=='player_moves' or src.startswith('heavy') else 3,main_only=actor.startswith('stage'))
  # Only trim already-transparent margins, preserving all original opaque black pixels.
  bbox=im.getbbox()
  if not bbox:raise ValueError((actor,clip,j))
  l,t,r,b=bbox;im=im.crop(bbox);idx=len(frames)
  removed=sum(aa!=bb for aa,bb in zip(images[src].crop((x0+l,y0+t,x0+r,y0+b)).getchannel('A').tobytes(),im.getchannel('A').tobytes()))
  frames.append({'id':idx,'source':src,'rect':[x0+l,y0+t,x0+r,y0+b],'anchor':[anchors[j]-x0-l,feet-y0-t],'scale':scale,'edgeFragmentPixels':removed,'image':im})
  ids.append(idx)
 clips.setdefault(actor,{})[clip]=ids
# Gorath motion sheet: idle, walk, reactions and collapse. Moveset: actual attack rows.
row('boss1','idle','gorath_motion',0,132,[400,575,730,880,1030],[514,670,823,973],128,.94)
row('boss1','walk','gorath_motion',132,254,[160,350,530,720,910,1090,1270],[280,464,650,838,1026,1210],246,.94)
row('boss1','hurt','gorath_motion',853,958,[450,640,825,980],[538,730,906],950,.94)
row('boss1','death','gorath_motion',958,1086,[280,495,702,962,1220],[400,610,840,1090],1057,.94)
row('boss1','sweep','gorath_moves',138,267,[8,195,393,613,819,1000,1168,1300,1448],[120,307,502,706,904,1084,1230,1375],261,.94)
row('boss1','slam','gorath_moves',270,477,[10,180,345,510,655,760,930,1100,1250,1448],[110,265,422,577,706,835,1004,1186,1360],449,.94)
row('boss1','rage','gorath_moves',478,587,[10,162,322,470,632,813,1017,1158,1305,1448],[110,255,412,565,740,930,1090,1225,1375],578,.94)
row('boss1','hook','gorath_motion',745,852,[170,420,775,1040,1240],[260,516,867,1158],849,.94)
# Player sheet contains combat techniques, not walk/death. Keep existing locomotion.
row('player','dash','player',0,204,[0,210,480,730,1030,1260,1448],[140,385,650,870,1150,1380],195,.70)
row('player','whirl','player',215,422,[0,215,515,738,1014,1260,1448],[140,385,645,870,1130,1380],411,.70)
row('player','leap','player',425,680,[0,250,515,780,975,1245,1448],[150,388,650,880,1100,1370],665,.70)
row('player','special','player',690,902,[0,255,598],[150,390],893,.70)
row('player','upper','player',902,1086,[80,290,540,760,970,1180],[220,440,650,862,1090],1070,.70)
# Witch material is exclusively phase two.
row('boss2p2','idle','witch2',0,121,[0,145,273,405,533,665,795,930,1065,1194,1325,1448],[90,210,342,475,610,740,872,1004,1133,1263,1394],115,1.03)
row('boss2p2','walk','witch2',121,212,[0,160,310,465,620,775,930,1085,1250,1448],[90,235,390,545,700,855,1010,1175,1370],205,1.03)
row('boss2p2','staff','witch2',386,473,[0,210,425,640,855,1075,1260,1448],[95,300,510,725,945,1160,1360],477,1.03)
row('boss2p2','cast','witch2',482,550,[0,140,275],[90,210],549,1.03)
row('boss2p2','death','witch2',849,932,[0,150,275,420,565,700,855,1005,1155,1300,1448],[90,215,355,500,635,770,925,1080,1225,1370],922,1.03)
row('boss2p2','awaken','witch2',979,1086,[0,140,285,440,625,815,995,1160,1315,1448],[90,220,365,540,730,905,1080,1245,1390],1070,1.03)
# Golden king, stage three; frame bounds follow each visible pose, not an equal grid.
row('boss3','idle','gold',0,110,[0,129,214,300,383,455,525,600,673],[80,175,260,345,420,495,568,640],104,1.10)
row('boss3','walk','gold',0,110,[673,763,876,987,1090,1180,1267,1350,1448],[725,825,925,1040,1135,1225,1310,1405],104,1.10)
row('boss3','slash','gold',213,345,[0,115,240,375,525,650,820,980,1120,1265,1370,1448],[78,170,290,435,575,705,860,1030,1170,1320,1410],334,1.10)
row('boss3','charge','gold',345,471,[0,125,250,410,590,735],[80,190,325,470,665],460,1.10)
row('boss3','cast','gold',716,875,[0,175,335,530,780],[90,250,425,650],849,1.10)
row('boss3','death','gold',112,213,[276,385,505,668,795,953,1081,1245,1448],[345,450,580,730,870,1020,1160,1350],207,1.10)
# Frozen king, stage four (never final emperor).
row('boss4','idle','ice',0,122,[0,145,275,375,470,580,695,790],[80,215,330,425,530,640,745],115,1.25)
row('boss4','walk','ice',124,220,[254,360,474,600],[310,420,550],211,1.25)
row('boss4','slash','ice',221,329,[0,150,325,490,640,790,970,1135,1290,1448],[80,230,405,560,720,865,1045,1210,1370],317,1.25)
row('boss4','cast','ice',330,434,[0,120,235,355],[80,180,295],420,1.25)
row('boss4','awaken','ice',786,949,[0,190],[105],934,1.25)
row('boss4','death','ice',950,1086,[0,135,270,405,545,700,860,1025,1190,1350,1448],[80,205,345,480,620,780,945,1110,1270,1400],1046,1.25)
# Final emperor: hand-selected character poses; isolated spell panels are not actors.
row('boss5','idle','emperor',0,130,[170,280,390],[217,326],126,1.15)
row('boss5','walk','emperor',132,252,[252,365,492],[305,411],246,1.15)
row('boss5','cast','emperor',0,130,[390,510,623,739],[435,548,659],126,1.15)
row('boss5','slash','emperor',254,370,[0,103,200,310,440],[48,140,250,355],362,1.15)
row('boss5','awaken','emperor',582,738,[0,320,610,920],[167,465,767],727,1.15)
row('boss5','hurt','emperor',964,1086,[198,350,480],[266,411],1073,1.15)
row('boss5','death','emperor',964,1086,[350,480,660,810,970,1130,1290,1448],[411,554,719,875,1040,1200,1375],1073,1.15)
# Extensionless PNG: stage-one infantry/spearman/archer, not a generic preview.
row('stage1_grunt','idle','soldiers1',140,286,[240,335,425],[292,380],278,.72)
row('stage1_grunt','walk','soldiers1',140,286,[440,525,600,680,770],[485,565,640,720],278,.72)
row('stage1_grunt','attack','soldiers1',104,286,[775,880,975,1172],[835,930,1030],278,.72)
row('stage1_grunt','hurt','soldiers1',140,286,[1175,1264,1355],[1225,1308],278,.72)
row('stage1_grunt','death','soldiers1',175,286,[1355,1480,1672],[1410,1560],278,.72)
row('stage1_rogue','idle','soldiers1',400,615,[220,320,415],[270,365],607,.72)
row('stage1_rogue','walk','soldiers1',400,615,[420,501,569,642,715],[470,535,608,683],607,.72)
row('stage1_rogue','attack','soldiers1',400,615,[715,830,952,1185],[775,888,1020],607,.72)
row('stage1_rogue','hurt','soldiers1',400,615,[1190,1280,1370],[1245,1320],607,.72)
row('stage1_rogue','death','soldiers1',490,615,[1370,1490,1672],[1435,1570],607,.72)
row('stage1_archer','idle','soldiers1',750,889,[235,332,427],[290,385],880,.72)
row('stage1_archer','walk','soldiers1',750,889,[430,519,595,673,758],[480,560,640,720],880,.72)
row('stage1_archer','attack','soldiers1',750,889,[760,870,968,1050,1148],[820,925,1010,1095],880,.72)
row('stage1_archer','hurt','soldiers1',750,889,[1160,1264,1362],[1220,1310],880,.72)
row('stage1_archer','death','soldiers1',790,901,[1362,1480,1672],[1425,1560],880,.72)
for entry in json.loads((ROOT/'data/stage-soldier-layout.json').read_text(encoding='utf8')):
 row(**entry)
# Exclude frames whose neighbouring pose/FX crosses the cut. Keep them in inventory, not runtime.
reviewed={'player':{'whirl':[0,4,5],'upper':[0,1,4]},'boss2p2':{'staff':[6],'awaken':[0,1,2]},'boss3':{'walk':[0], 'slash':[0,1,2,3,6,7], 'charge':[0,1], 'cast':[0,2,3]},'boss4':{'idle':[0,1,2,3,4,5], 'slash':[7,8], 'death':[0,1,2,3,4,5,6,7]}}
for actor,groups in reviewed.items():
 for clip,indices in groups.items():clips[actor][clip]=[clips[actor][clip][i] for i in indices]
# New hero: nonuniform source rectangles, feet and body centres explicitly aligned.
row('player','idle','player_base',130,480,[0,365],[245],470,.36)
row('player','walk','player_walk',140,490,[0,425,855,1260,1672],[275,695,1105,1525],478,.36)
walk_first=clips['player']['walk'][:]
row('player','walk','player_walk',550,900,[0,435,855,1265,1672],[275,695,1105,1525],880,.36)
clips['player']['walk']=walk_first+clips['player']['walk']
row('player','crouch','player_base',200,480,[830,1190],[1035],470,.36)
row('player','swing','player_base',195,480,[1230,1672],[1405],470,.36)
row('player','overhead','player_base',480,900,[0,365],[225],887,.36)
row('player','stab','player_base',630,905,[385,925],[595],887,.36)
row('player','hurt','player_base',595,900,[925,1225],[1060],887,.36)
row('player','death','player_base',730,920,[1225,1672],[1450],887,.36)
row('player','dash','player_moves',0,185,[0,200,410,620,840,1047,1240,1450,1672],[140,350,565,778,995,1188,1380,1590],170,.72)
row('player','rush','player_moves',190,375,[0,215,505,790,1120,1465,1672],[140,375,635,930,1235,1590],361,.72)
row('player','whirl','player_moves',380,555,[0,220,550,825,1110,1460,1672],[140,400,665,935,1240,1590],549,.72)
row('player','jump','player_moves',555,775,[235,470,695],[375,590],760,.72)
row('player','plunge','player_moves',555,775,[695,895],[815],760,.72)
row('player','impact','player_moves',555,775,[895,1237],[1055],760,.50)
row('player','cast','player_moves',780,941,[0,220,505,790],[140,365,635],921,.72)
row('player','wave','player_moves',790,930,[790,945,1120,1287,1455],[870,1030,1205,1370],858,.40)
# Pack lossless crops into one atlas; original positions and foot anchors remain in JSON.
heavy_layout={
 1: [
  ('idle',0,240,[0,283,526,815],[135,389,630],238,.53),
  ('walk',240,455,[0,300,555,800,1100],[152,405,660,914],450,.53),
  ('attack',455,680,[0,280,570,970,1340,1672],[158,410,680,1065,1445],675,.53),
  ('hurt',680,920,[0,305,565],[155,418],895,.53),
  ('death',680,925,[565,895,1250,1672],[707,1040,1450],900,.53)],
 2: [
  ('idle',70,340,[25,285,495,705],[174,390,610],331,.50),
  ('walk',70,340,[715,975,1190,1415,1672],[865,1095,1305,1515],331,.50),
  ('attack',360,665,[25,280,560,885,1360,1672],[175,425,720,1010,1505],657,.50),
  ('hurt',680,915,[25,325,620],[188,480],899,.50),
  ('death',685,920,[620,925,1210,1672],[775,1060,1450],899,.50)],
 3: [
  ('idle',55,340,[0,235,445,660],[140,350,560],331,.48),
  ('walk',70,345,[725,990,1210,1430,1672],[880,1105,1325,1545],332,.48),
  ('attack',345,675,[0,325,600,1015,1375,1672],[195,475,810,1145,1505],663,.48),
  ('hurt',680,925,[0,305,565],[175,445],910,.48),
  ('death',700,930,[565,930,1240,1672],[755,1100,1460],910,.48)],
 4: [
  ('idle',60,360,[0,275,500,730],[170,390,620],350,.45),
  ('walk',60,360,[735,1018,1230,1440,1672],[900,1135,1350,1560],350,.45),
  ('attack',380,670,[0,280,645,965,1410,1672],[175,440,820,1120,1540],662,.45),
  ('hurt',680,935,[0,310,600],[190,450],917,.45),
  ('death',700,935,[600,910,1210,1672],[780,1070,1440],918,.45)],
 5: [
  ('idle',105,355,[0,245,480,720],[155,390,620],344,.54),
  ('walk',110,355,[765,1015,1235,1445,1672],[935,1150,1360,1580],344,.54),
  ('attack',365,670,[0,285,625,1000,1340,1672],[165,425,775,1100,1505],659,.54),
  ('hurt',700,905,[0,300,590],[170,450],889,.54),
  ('death',700,915,[590,930,1240,1672],[780,1100,1450],890,.54)]
}
for stage,entries in heavy_layout.items():
 for clip,y0,y1,cuts,anchors,feet,scale in entries:
  row(f'stage{stage}_brute',clip,f'heavy{stage}',y0,y1,cuts,anchors,feet,scale)
x=y=h=0;placements=[]
for f in frames:
 im=f['image'];w,hh=im.size
 if x+w+2>2048:x=0;y+=h+2;h=0
 f['atlas']=[x,y,w,hh];placements.append((im,(x,y)));x+=w+2;h=max(h,hh)
atlas=Image.new('RGBA',(2048,y+h));
for im,xy in placements:atlas.paste(im,xy)
atlas.save(out/'combat.png',optimize=True)
for f in frames:del f['image']
manifest={'version':1,'sources':sources,'clips':clips,'frames':frames,'policy':'Original RGB preserved; small disconnected soldier edge fragments have recorded alpha cleanup. Missing motions retain existing renderer; witch2 is phase-two-only. Embedded effects remain in source frames.'}
(ROOT/'data/named-sprites.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
gifpath=SOURCE/'게임 타이틀 화면.gif'
if not gifpath.exists():gifpath=ROOT/'assets/incoming/게임 타이틀 화면.gif'
gif=gifpath.read_bytes();(out/'title.gif').write_bytes(gif)
still=Image.open(gifpath).convert('RGB');still.save(out/'title-still.png')
bundle={'atlas':'data:image/png;base64,'+base64.b64encode((out/'combat.png').read_bytes()).decode(),'title':'data:image/gif;base64,'+base64.b64encode(gif).decode(),'titleStill':'data:image/png;base64,'+base64.b64encode((out/'title-still.png').read_bytes()).decode()}
(ROOT/'named-art.js').write_text("'use strict';\nconst NAMED_SPRITES="+json.dumps(manifest,ensure_ascii=False)+";\nconst NAMED_ART="+json.dumps(bundle)+";\nconst NAMED_ATLAS=new Image(); NAMED_ATLAS.src=NAMED_ART.atlas;\n",encoding='utf8')
print('Built',len(frames),'frames,',len(clips),'roles; RGB preserved, edge-fragment alpha cleanup recorded')
