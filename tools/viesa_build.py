"""Import supplied Viesa sheets using alpha projections and the shared atlas packer.

No master-sheet frames or ZIP code are used. PNG is lossless, matching Barel.
Run: .venv-streamlit-test/Scripts/python.exe tools/viesa_build.py
"""
from pathlib import Path
import base64, hashlib, io, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from boss_art_common import pack_pages

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'assets_src/viesa/Viesa_Revised'
OUT=ROOT/'assets/viesa'
OUT.mkdir(parents=True,exist_ok=True)
SPEC={5:[('idle',8),('walk',8),('run',8)],6:[('slash1',5),('slash2',5),('kick',6)],
      7:[('shot',6),('jump',6),('jump_shot',5)],1:[('snipe_draw',6),('snipe_release',6)],
      2:[('rapid_start',4),('rapid_loop',6),('rapid_end',4)],3:[('dash_slash',7),('backflip',8)],
      4:[('ult_leap',6),('ult_summon',4),('ult_barrage',7),('ult_final',6)],
      8:[('hurt',4),('knockdown',6),('getup',6),('death',5)]}
REFERENCE={5:('idle',0),6:('slash1',0),7:('shot',0),1:('snipe_release',5),2:('rapid_end',3),3:('dash_slash',6),4:('ult_final',5),8:('getup',5)}

def chroma(im):
    rgb=np.array(im.convert('RGB'),dtype=np.float32)
    r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    alpha=1-np.clip((g-np.maximum(r,b)-18)/85,0,1)
    rgb[:,:,1]=np.minimum(g,np.maximum(r,b)+18)
    return Image.fromarray(np.dstack((rgb,alpha*255)).astype('uint8'))

def runs(a):
    delta=np.diff(np.r_[False,a,False].astype(int))
    return list(zip(np.flatnonzero(delta==1).tolist(),np.flatnonzero(delta==-1).tolist()))

def remove_cell_lines(im):
    rgb=np.array(im.convert('RGB'));dark=rgb.max(2)<65;erase=np.zeros(dark.shape,bool)
    for y in range(im.height):
        for a,b in runs(dark[y]):
            if b-a>im.width*.12:erase[max(0,y-1):y+2,a:b]=True
    for x in range(im.width):
        for a,b in runs(dark[:,x]):
            if b-a>im.height*.18:erase[a:b,max(0,x-1):x+2]=True
    rgb[erase]=[0,255,0]
    return Image.fromarray(rgb),int(erase.sum())

def components(mask):
    hh,ww=mask.shape;seen=np.zeros_like(mask);groups=[]
    for sy,sx in zip(*np.where(mask)):
        if seen[sy,sx]:continue
        stack=[(int(sy),int(sx))];seen[sy,sx]=True;points=[]
        while stack:
            y,x=stack.pop();points.append((y,x))
            for ny,nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
                if 0<=ny<hh and 0<=nx<ww and mask[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx]=True;stack.append((ny,nx))
        groups.append(np.array(points))
    return groups

def ultimate_rows(sheet):
    small=sheet.getchannel('A').resize((sheet.width//2,sheet.height//2),Image.Resampling.NEAREST)
    mask=np.array(small)>96;groups=components(mask);largest=max(map(len,groups))
    bodies=[g for g in groups if len(g)>max(120,largest*.12)]
    ys=np.array([np.mean(g[:,0]) for g in bodies]);centers=np.quantile(ys,[.12,.37,.62,.87])
    for _ in range(40):
        labels=np.argmin(abs(ys[:,None]-centers[None,:]),axis=1)
        centers=np.array([np.mean(ys[labels==i]) if (labels==i).any() else centers[i] for i in range(4)])
        centers.sort()
    labels=np.full(mask.shape,-1,dtype=np.int16)
    for g in groups:
        index=int(np.argmin(abs(centers-g[:,0].mean())));labels[g[:,0],g[:,1]]=index
    rows=[]
    for i in range(4):
        matte=Image.fromarray(np.uint8(labels==i)*255).resize(sheet.size,Image.Resampling.NEAREST).filter(ImageFilter.MaxFilter(5))
        rgba=np.array(sheet);rgba[:,:,3]=np.minimum(rgba[:,:,3],np.array(matte))
        row=Image.fromarray(rgba);box=row.getbbox();top,bottom=box[1],box[3]
        rows.append((row.crop((0,top,sheet.width,bottom)),top,bottom))
    return rows,[float(c*2) for c in centers]

def partitions(projection,count):
    """Find content bands with adaptive occupancy, then cut at ink minima.

    Thin bows/hair occasionally bridge silhouettes. Raise the occupancy threshold
    until body bands separate, retaining the actual low-ink valley as the cut.
    This uses image content, never fixed rows/columns or equally sized cells.
    """
    p=np.asarray(projection,dtype=float)
    best=None
    for fraction in np.linspace(.002,.70,350):
        active=p>max(1,p.max()*fraction)
        # Close holes shorter than 3px inside a body mass.
        for a,b in runs(~active):
            if a>0 and b<len(active) and b-a<=3:active[a:b]=True
        bands=[(a,b) for a,b in runs(active) if b-a>=max(3,len(p)//(count*18))]
        score=abs(len(bands)-count)*1000+fraction
        if best is None or score<best[0]:best=(score,bands,float(fraction))
        if len(bands)==count:break
    _,bands,threshold=best
    if len(bands)!=count:
        raise ValueError(f'Projection found {len(bands)} body bands; expected {count}, threshold={threshold}')
    edges=[0]
    for (_,a),(b,_) in zip(bands,bands[1:]):
        segment=p[a:b]
        minima=np.flatnonzero(segment<=segment.min()+max(1,p.max()*.005))
        edges.append(a+int(np.median(minima)))
    edges.append(len(p))
    # Low poses can otherwise vanish at a high threshold, while a bow splits a
    # neighbouring torso into two bands. Use a content-cost watershed for those
    # ambiguous rows, with only broad silhouette-width constraints (no grid).
    ink=np.flatnonzero(p>1);start=int(ink[0]);end=int(ink[-1])+1;average=(end-start)/count
    widths=np.diff(edges)
    if max(widths)>average*1.7 or min(widths)<average*.48 or threshold>.30:
        candidates=np.arange(start,end+1);length=len(candidates)
        smooth=np.convolve(p,np.ones(5)/5,mode='same')
        cost=smooth[np.minimum(candidates,len(p)-1)]/max(1,smooth.max())
        dp=np.full((count+1,length),np.inf);prev=np.zeros((count+1,length),dtype=int);dp[0,0]=0
        for k in range(1,count+1):
            for j in range(1,length):
                lo=max(0,j-int(average*1.65));hi=j-max(2,int(average*.55))+1
                if hi<=lo:continue
                inds=np.arange(lo,hi);w=(j-inds)/average
                scores=dp[k-1,inds]+((w-1)**2)*.35+cost[j]*3
                at=int(np.argmin(scores));dp[k,j]=scores[at];prev[k,j]=inds[at]
        j=length-1;boundaries=[end]
        for k in range(count,0,-1):j=prev[k,j];boundaries.append(int(candidates[j]))
        edges=sorted(boundaries);edges[0]=0;edges[-1]=len(p);threshold=-threshold
    return list(zip(edges,edges[1:])),threshold

def assign_fragments(image,columns):
    """Barel's connected-component matte, with nearest-body fragment ownership."""
    width,height=image.size
    small=image.getchannel('A').resize((max(1,width//2),max(1,height//2)),Image.Resampling.NEAREST)
    mask=np.array(small)>96;hh,ww=mask.shape;seen=np.zeros_like(mask);groups=[]
    for sy,sx in zip(*np.where(mask)):
        if seen[sy,sx]:continue
        stack=[(int(sy),int(sx))];seen[sy,sx]=True;points=[]
        while stack:
            y,x=stack.pop();points.append((y,x))
            for ny,nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
                if 0<=ny<hh and 0<=nx<ww and mask[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx]=True;stack.append((ny,nx))
        groups.append(np.array(points))
    edges=np.array([a for a,b in columns]+[columns[-1][1]])*ww/width
    bodies=[]
    for a,b in zip(edges,edges[1:]):
        yy,xx=np.where(mask[:,int(a):max(int(a)+1,int(b))]);xx=xx+int(a)
        bodies.append((float(np.median(yy)),float(np.median(xx))))
    owners=np.full(mask.shape,-1,dtype=np.int16);largest=max(map(len,groups))
    merged=0;discarded=0
    for pts in groups:
        yy,xx=pts[:,0],pts[:,1]
        if len(pts)>=max(20,largest*.08):
            # Whole silhouettes may extend past a neighbour's projection valley.
            # Keep each connected body intact; split only genuinely joined bodies.
            if xx.max()-xx.min() < np.median(np.diff(edges))*1.6:
                which=int(np.clip(np.searchsorted(edges,np.mean(xx),side='right')-1,0,len(columns)-1))
            else:which=np.clip(np.searchsorted(edges,xx,side='right')-1,0,len(columns)-1)
            owners[yy,xx]=which
        else:
            cy,cx=float(np.mean(yy)),float(np.mean(xx))
            which=min(range(len(bodies)),key=lambda i:(cx-bodies[i][1])**2+((cy-bodies[i][0])*.55)**2)
            # Isolated 1px fragments far above a low pose belong to the adjacent
            # source row. Keep genuine detached hair/bow fragments near the body.
            if len(pts)<=3 and abs(cy-bodies[which][0])>hh*.3:
                discarded+=len(pts);continue
            owners[yy,xx]=which;merged+=1
    tiles=[]
    for index in range(len(columns)):
        matte=Image.fromarray(np.uint8(owners==index)*255).resize(image.size,Image.Resampling.NEAREST).filter(ImageFilter.MaxFilter(5))
        rgba=np.array(image);rgba[:,:,3]=np.minimum(rgba[:,:,3],np.array(matte))
        tiles.append(Image.fromarray(rgba))
    return tiles,{'smallFragmentsMerged':merged,'strayHalfResolutionPixelsRemoved':discarded}

clips={}; raw={}; report={'format':'PNG lossless (same as Barel)','sources':{},'animations':{},'sheets':{}}
for number,spec in SPEC.items():
    path=next((SRC/'01_Character_Motions').glob(f'{number:02d}_*.png'))
    source=Image.open(path)
    if number==6:source,removed=remove_cell_lines(source);report['meleeLinePixelsRemoved']=removed
    sheet=chroma(source);alpha=np.array(sheet.getchannel('A'))
    if number==4:
        rows,centers=ultimate_rows(sheet);row_threshold='component-center clustering';report['ultimateRowCenters']=centers
    else:
        row_bounds,row_threshold=partitions((alpha>96).sum(1),len(spec))
        rows=[(sheet.crop((0,top,sheet.width,bottom)),top,bottom) for top,bottom in row_bounds]
    report['sources'][str(path.relative_to(ROOT))]=hashlib.sha256(path.read_bytes()).hexdigest()
    for (name,count),(row_sheet,top,bottom) in zip(spec,rows):
        band=np.array(row_sheet.getchannel('A'))
        columns,col_threshold=partitions((band>96).sum(0),count)
        separated,fragment_report=assign_fragments(row_sheet,columns)
        row=[]
        for index,(left,right) in enumerate(columns):
            tile=separated[index];box=tile.getbbox()
            if box is None:raise ValueError(name+' empty frame')
            row.append({'tile':tile.crop(box),'source':[box[0],top+box[1],box[2]-box[0],box[3]-box[1]],'rowTop':top})
        # Stable row ground, including airborne art: grounded foot positions share
        # the lower band; using their median avoids following a jump or tumbling bow.
        grounds=[r['source'][1]+r['source'][3] for r in row]
        ground=float(np.median(sorted(grounds)[len(grounds)//2:]))
        for r in row:
            a=np.array(r['tile'].getchannel('A'));h,w=a.shape
            yy,xx=np.where(a[int(h*.35):max(int(h*.75),1)]>128)
            r['pivotX']=float(np.median(xx)) if len(xx) else w/2
            r['pivotY']=ground-r['source'][1]
        for i in range(1,len(row)-1):
            before,after=row[i-1]['pivotX'],row[i+1]['pivotX']
            if abs(row[i]['pivotX']-(before+after)/2)>np.median([r['tile'].height for r in row])*.25:
                row[i]['pivotX']=(before+after)/2
        # Keep a small isolated bow/hair piece with its nearest full silhouette:
        # the projection cells already encompass fragments up to each ink valley.
        raw[name]=row
        report['animations'][name]={'actual':len(row),'expected':count,'row':[top,bottom],'columnCuts':columns,
                                    'thresholds':[row_threshold,col_threshold],'groundY':ground,'sheet':number,**fragment_report}

# Body measurements are recorded in original-sheet pixels, excluding hair/bow
# tips. Skin in the head/torso anchors the body column; feet determine its base.
def body_measure(frame):
    rgba=np.array(frame['tile']);rgb=rgba[:,:,:3].astype(float);a=rgba[:,:,3]>128;h,w=a.shape
    r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
    skin=a&(r>95)&(g>42)&(r>g*1.13)&(g>b*1.08)&(g/r.clip(1)>.38)
    # Standing references only; disregard the bow to the right and trailing hair.
    skin[:int(h*.08)]=False;skin[int(h*.64):]=False
    yy,xx=np.where(skin)
    head_y=int(np.percentile(yy,2)) if len(yy) else round(h*.10)
    top_skin=skin.copy();top_skin[head_y+max(10,round(h*.17)):]=False
    hy,hx=np.where(top_skin)
    cx=float(np.median(hx)) if len(hx) else w*.5
    # Skin locates the head, but its forehead isn't the top of the skull. Measure
    # the crown in a narrow head column, excluding trailing hair and raised bows.
    crown=a[:head_y+1,max(0,int(cx-w*.07)):min(w,int(cx+w*.07)+1)]
    crown_rows=np.flatnonzero(crown.sum(1)>=max(3,crown.shape[1]*.3))
    if len(crown_rows):head_y=int(crown_rows[0])
    column=a[:,max(0,int(cx-w*.22)):min(w,int(cx+w*.24))]
    feet=np.flatnonzero(column.sum(1)>=2)
    foot=int(feet[-1])+1 if len(feet) else h
    return {'height':foot-head_y,'top':head_y,'foot':foot,'bodyX':cx}

measurements={n:body_measure(raw[name][i]) for n,(name,i) in REFERENCE.items()}
base=measurements[5]['height']
# Existing Barel importer stores 142px standing art; runtime uses .72.
target_world=142*.72*.95
stored_body=target_world/.72
tiles=[]
# These two rows never touch the floor: carry the last leap's airborne offset.
air_offset=raw['ult_leap'][-1]['pivotY']-raw['ult_leap'][-1]['tile'].height
for name in ['ult_summon','ult_barrage']:
    for r in raw[name]:r['pivotY']=r['tile'].height+air_offset
report['ultimateAirPivotOffset']=air_offset
for number,spec in SPEC.items():
    relative=base/measurements[number]['height'];scale=stored_body/base*relative
    report['sheets'][number]={'reference':list(REFERENCE[number]),'bodyMeasurement':measurements[number],
                            'relativeToIdle':relative,'sourceToAtlas':scale}
    for name,_ in spec:
        clips[name]=[]
        for i,r in enumerate(raw[name]):
            tile=r['tile'];pixels=np.array(tile);rgb=pixels[:,:,:3].astype(float)
            purple=(pixels[:,:,3]>96)&(rgb[:,:,0]>80)&(rgb[:,:,2]>100)&(rgb[:,:,2]>rgb[:,:,1]*1.2)
            purple[:,:int(tile.width*.45)]=False
            py,px=np.where(purple)
            if len(px):
                tipx=float(px.max());tipy=float(np.median(py[px>=tipx-3]))
            else:tipx,tipy=tile.width*.88,tile.height*.43
            tile=tile.resize((max(1,round(tile.width*scale)),max(1,round(tile.height*scale))),Image.Resampling.LANCZOS)
            f={'atlas':[0,0,tile.width,tile.height],'anchor':[round(r['pivotX']*scale,3),round(r['pivotY']*scale,3)],
               'source':r['source'],'sourceSheet':number,'drawing':i+1,
               'tip':[round((tipx-r['pivotX'])*scale,3),round((r['pivotY']-tipy)*scale,3)]}
            clips[name].append(f);tiles.append((f,tile))

fx_path=next((SRC/'02_Basic_Effects').glob('*.png'));fx_image=Image.open(fx_path).convert('RGB');arr=np.array(fx_image)
brightness=arr.max(2);fx_rows,_=partitions((brightness>24).sum(1),6)
FX=[('arrow_and_trail',4),('arrow_fade',5),('snipe_arrow',4),('charge_glow',6),('hit_spark',6),('dash_and_dust',10)]
report['effects']={};report['sources'][str(fx_path.relative_to(ROOT))]=hashlib.sha256(fx_path.read_bytes()).hexdigest()
for row,((name,count),(top,bottom)) in enumerate(zip(FX,fx_rows)):
    columns,threshold=partitions((brightness[top:bottom]>24).sum(0),count)
    for i,(left,right) in enumerate(columns):
        key='arrow' if row==0 and i==0 else 'arrow_trail' if row==0 else 'dash_streak' if row==5 and i<5 else 'land_dust' if row==5 else name
        additive=key not in ['arrow','arrow_fade','land_dust']
        rgb=arr[top:bottom,left:right].astype(float);alpha=rgb.max(2)
        if additive:rgb=np.minimum(255,rgb*255/np.maximum(alpha[:,:,None],1))
        else:alpha=np.clip((alpha-12)*255/24,0,255)
        tile=Image.fromarray(np.dstack((rgb,alpha)).astype('uint8'));box=tile.getbbox()
        if box:tile=tile.crop(box)
        tile.thumbnail((240,160),Image.Resampling.LANCZOS)
        frame={'atlas':[0,0,tile.width,tile.height],'anchor':[tile.width/2,tile.height/2],
               'source':[left,top,right-left,bottom-top],'additive':additive}
        clips.setdefault('fx_'+key,[]).append(frame);tiles.append((frame,tile))
        report['effects'][key]=len(clips['fx_'+key])

fx_path=next((SRC/'03_Ultimate_Effects').glob('*.png'));arr=np.array(Image.open(fx_path).convert('RGB'))
brightness=arr.max(2);fx_rows,_=partitions((brightness>24).sum(1),6)
report['sources'][str(fx_path.relative_to(ROOT))]=hashlib.sha256(fx_path.read_bytes()).hexdigest()
for (name,count),(top,bottom) in zip([('phantom_arrow',4),('volley',4),('moon_sigil',6),('ult_impact',6),('giant_arrow',4),('ult_explosion',7)],fx_rows):
    if name=='ult_explosion':
        edges=np.linspace(0,arr.shape[1],8).round().astype(int);columns=list(zip(edges[:-1],edges[1:]));method='required equal seventh cuts for touching frames'
    else:columns,threshold=partitions((brightness[top:bottom]>24).sum(0),count);method='alpha projection'
    for left,right in columns:
        rgb=arr[top:bottom,left:right].astype(float);alpha=rgb.max(2)
        rgb=np.minimum(255,rgb*255/np.maximum(alpha[:,:,None],1))
        tile=Image.fromarray(np.dstack((rgb,alpha)).astype('uint8'));box=tile.getbbox()
        if box:tile=tile.crop(box)
        tile.thumbnail((360,260),Image.Resampling.LANCZOS)
        frame={'atlas':[0,0,tile.width,tile.height],'anchor':[tile.width/2,tile.height/2],
               'source':[int(left),top,int(right-left),bottom-top],'additive':True}
        clips.setdefault('fx_'+name,[]).append(frame);tiles.append((frame,tile))
    report['effects'][name]=len(clips['fx_'+name]);report.setdefault('effectCutMethods',{})[name]=method

pages=pack_pages(tiles,limit=2048)
def uri(im):
    b=io.BytesIO();im.save(b,format='PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
for i,im in enumerate(pages):im.save(OUT/f'atlas-{i}.png')
idle=raw['idle'][0]['tile'];m=measurements[5];portrait=idle.crop((max(0,int(m['bodyX']-idle.height*.25)),max(0,m['top']-8),min(idle.width,int(m['bodyX']+idle.height*.25)),int(idle.height*.62)))
portrait.thumbnail((180,180),Image.Resampling.LANCZOS);portrait.save(OUT/'portrait.png')
data={'version':'1.41','id':'viesa','name':'비에사','scale':.72,'worldHeight':target_world,'clips':clips,'sheets':[uri(im) for im in pages],'portrait':uri(portrait)}
(ROOT/'viesa-art.js').write_text('const VIESA_ART = '+json.dumps(data,separators=(',',':'))+';\n',encoding='utf-8')
(OUT/'frames.json').write_text(json.dumps({k:v for k,v in data.items() if k not in ['sheets','portrait']},ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
preview=Image.new('RGB',(1200,((len(SPEC and raw)+5)//6)*220),'#17151d');d=ImageDraw.Draw(preview)
for i,name in enumerate(raw):
    f=clips[name][0];sx,sy,w,h=f['atlas'];im=pages[f['sheet']].crop((sx,sy,sx+w,sy+h));im.thumbnail((190,185))
    x=(i%6)*200;y=(i//6)*220;preview.paste(im,(x+(200-im.width)//2,y),im);d.text((x+8,y+190),name,fill='white')
preview.save(OUT/'preview.jpg',quality=95)
print(json.dumps({'frames':{k:len(v) for k,v in clips.items()},'scales':report['sheets'],'pages':len(pages)},ensure_ascii=True))
