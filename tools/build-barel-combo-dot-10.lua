-- Dot replacement: raw source RGBA, anatomical anchors, no image resampling.
local root=assert(app.params.root)
local attack=tonumber(assert(app.params.attack))
local cfgs={
 [0]={ref={2172,724},size={1600,533},range={150,415},ground=404,
  guides={193,410,636,863,1090,1320,1540,1750,1960},anchors={119,348,568,796,1015,1243,1474,1694,1885,2080},
  groups={{1},{2},{3},{4},{5,6,7,8,9},{10}},durations={40,30,35,25,25,30,45,25,40,55},tag='basic-attack',
  blades={
   {owner=5,poly={{1064,438},{1081,446},{1132,508},{1140,522},{1111,512},{1055,461}},tip={1085,470}},
   {owner=6,poly={{1296,467},{1306,470},{1375,522},{1380,534},{1349,535},{1288,486}},tip={1310,485}},
   {owner=7,poly={{1525,466},{1540,471},{1612,513},{1625,527},{1597,528},{1524,491}},tip={1550,485}},
   {owner=8,poly={{1739,456},{1750,461},{1805,505},{1815,521},{1788,516},{1734,479}},tip={1765,480}},
   {owner=9,poly={{1870,421},{1884,425},{1985,501},{2001,522},{1968,516},{1868,442}},tip={1930,470}}},
  leftovers={[6]={1141,522},[7]={1378,532},[8]={1621,526},[9]={1817,524}}},
 [1]={ref={2172,724},size={1600,533},range={160,415},ground=402,
  guides={226,445,653,882,1128,1378,1600,1800,1990},anchors={145,360,570,804,1010,1260,1490,1700,1890,2070},
  groups={{1,2},{3},{4},{5,6,7,8,9,10}},durations={70,35,35,30,30,20,20,20,25,25},tag='basic-attack-2',
  blades={
   {owner=1,poly={{196,448},{205,453},{259,517},{272,540},{244,528},{182,467}},tip={225,475}},
   {owner=5,poly={{1054,437},{1066,438},{1132,495},{1142,514},{1115,508},{1047,457}},tip={1095,465}},
   {owner=6,poly={{1305,455},{1317,457},{1376,504},{1388,524},{1363,520},{1297,477}},tip={1340,477}},
   {owner=7,poly={{1531,460},{1546,465},{1610,506},{1625,525},{1595,522},{1527,483}},tip={1570,485}},
   {owner=8,poly={{1744,439},{1754,443},{1814,504},{1830,523},{1803,516},{1738,462}},tip={1775,470}}},
  leftovers={[2]={267,537},[6]={1138,511},[7]={1383,521},[8]={1621,523},[9]={1825,520}}},
 [2]={ref={1916,821},size={1600,686},range={225,500},ground=488,
  guides={208,401,576,755,930,1138,1330,1515,1698},anchors={120,320,500,680,865,1050,1250,1430,1620,1810},
  groups={{1},{2},{3,4},{5},{6,7,8},{9},{10}},durations={70,60,70,20,29,91,30,90,90,130},tag='basic-attack-3',
  blades={
   {owner=6,poly={{1098,523},{1104,525},{1168,563},{1177,577},{1174,581},{1155,580},{1090,542}},tip={1135,540}},
   {owner=7,poly={{1310,518},{1320,521},{1366,555},{1376,573},{1373,578},{1355,575},{1304,536}},tip={1350,540}}},
  leftovers={[7]={1175,579},[8]={1372,576}}}
}
local cfg=assert(cfgs[attack])
local out=root..'/assets/aseprite/barel-combo'..attack..'-dot-10'
local src=Image{fromFile=out..'/source/original.png'}
assert(src.width==cfg.size[1] and src.height==cfg.size[2],'Unexpected dot revision')
local pc=app.pixelColor
local w=src.width
local top,bottom=cfg.range[1],cfg.range[2]
local sx,sy=w/cfg.ref[1],src.height/cfg.ref[2]
local function X(n)return math.floor(n*sx+.5) end
local function Y(n)return math.floor(n*sy+.5) end
for _,b in ipairs(cfg.blades) do
  for _,p in ipairs(b.poly) do p[1],p[2]=X(p[1]),Y(p[2]) end
  b.tip={X(b.tip[1]),Y(b.tip[2])}
end
for _,p in pairs(cfg.leftovers) do p[1],p[2]=X(p[1]),Y(p[2]) end
local fg,seen,groups={},{},{}
for y=top,bottom do for x=0,w-1 do if pc.rgbaA(src:getPixel(x,y))>=32 then fg[y*w+x]=true end end end
for y=top,bottom do for x=0,w-1 do
 local k=y*w+x
 if fg[k] and not seen[k] then
  local q={k};local at=1;seen[k]=true;local left=x
  while at<=#q do
   local key=q[at];at=at+1;local xx,yy=key%w,math.floor(key/w);left=math.min(left,xx)
   for _,d in ipairs({{-1,0},{1,0},{0,-1},{0,1}}) do
    local nx,ny=xx+d[1],yy+d[2];local nk=ny*w+nx
    if nx>=0 and nx<w and ny>=top and ny<=bottom and fg[nk] and not seen[nk] then seen[nk]=true;q[#q+1]=nk end
   end
  end
  if #q>1500 then groups[#groups+1]={pixels=q,left=left} end
 end
end end
assert(#groups==#cfg.groups,'Unexpected connected character groups')
table.sort(groups,function(a,b)return a.left<b.left end)
local groupFor={}
for i,g in ipairs(groups) do for _,key in ipairs(g.pixels) do groupFor[key]=i end end
local seams={}
for i,guide in ipairs(cfg.guides) do
 local g=X(guide);local radius=X((i==1 or i>=5) and 80 or 35)
 local lo,hi=g-radius,g+radius;local prev,back={},{}
 for x=lo,hi do prev[x]=0 end
 for y=top,bottom do
  local cur={};back[y]={}
  for x=lo,hi do
   local best,bx=math.huge,x
   for d=-3,3 do
    local xx=x+d
    if prev[xx] and prev[xx]+math.abs(d)*.2<best then best,bx=prev[xx]+math.abs(d)*.2,xx end
   end
   cur[x]=best+(fg[y*w+x] and 255 or 0)+math.abs(x-g)*.05;back[y][x]=bx
  end
  prev=cur
 end
 local bx,best=g,math.huge
 for x=lo,hi do if prev[x]<best then best,bx=prev[x],x end end
 seams[i]={}
 for y=bottom,top,-1 do seams[i][y]=bx;bx=back[y][bx] end
end
local function inside(x,y,p)
 local yes=false;local j=#p
 for i=1,#p do
  local a,b=p[i],p[j]
  if (a[2]>y)~=(b[2]>y) and x<(b[1]-a[1])*(y-a[2])/(b[2]-a[2])+a[1] then yes=not yes end
  j=i
 end
 return yes
end
local function owner(x,y)
 local group=groupFor[y*w+x]
 if not group then return nil end
 local options=cfg.groups[group]
 if #options==1 then return options[1] end
 -- At the dot sheet's block-aligned sword/boot contact, the boot starts at
 -- x=982. Keep F7's original heel with F7, before the blade ownership mask.
 if attack==2 and x>=982 and x<=1030 and y>=450 then return 7 end
 local c=src:getPixel(x,y);local metallic=pc.rgbaR(c)<pc.rgbaG(c)*1.8+8
 for _,b in ipairs(cfg.blades) do
  if metallic and inside(x,y,b.poly) then
   for _,candidate in ipairs(options) do if b.owner==candidate then return candidate end end
  end
 end
 for _,candidate in ipairs(options) do
  if candidate==10 then return candidate end
  local edge=seams[candidate][y]
  if attack==1 and candidate==7 and y>=Y(525) then edge=X(1600) end
  if x<edge then return candidate end
 end
 return options[#options]
end
local spr=Sprite(384,384,ColorMode.RGB)
spr.layers[1].name='Barel combo'..attack..' - original dot source pixels'
local strip=Image(3840,384,ColorMode.RGB)
local audit={sourceSize={src.width,src.height},canvas={384,384},anchor={200,352},alphaThreshold=32,
 connectedGroups=cfg.groups,frames={}}
if attack==2 then audit.sourceOwnerCorrections={{owner=7,rect={982,450,1031,501},reason='Original rear shin/boot beside preceding blade; no cloned pixels'}} end
for i=1,10 do
 local anchor=X(cfg.anchors[i]);local tile=Image(384,384,ColorMode.RGB)
 for y=top,bottom do for x=0,w-1 do
  if fg[y*w+x] and owner(x,y)==i then
   local c=src:getPixel(x,y);local metallic=pc.rgbaR(c)<pc.rgbaG(c)*1.8+8
   local limit=cfg.leftovers[i];local group=cfg.groups[groupFor[y*w+x]]
   local residue=#group>1 and limit and x<limit[1] and y>=Y(attack==2 and 535 or 470) and y<limit[2] and metallic
   if #group>1 then for _,b in ipairs(cfg.blades) do
    if b.owner==i and x>b.tip[1] and y>b.tip[2] and (not metallic or not inside(x,y,b.poly)) then residue=true end
   end end
   if attack==2 and i==7 and x>=982 and x<=1030 and y>=450 then residue=false end
   if not residue then
    local dx,dy=x-anchor+200,y-cfg.ground+352
    assert(dx>0 and dx<383 and dy>0 and dy<383,'Dot sprite outside cel')
    tile:drawPixel(dx,dy,c)
   end
  end
 end end
 local visited,largest={},{}
 for y=0,383 do for x=0,383 do
  local key=y*384+x
  if pc.rgbaA(tile:getPixel(x,y))>0 and not visited[key] then
   local q={key};local at=1;visited[key]=true
   while at<=#q do
    local k=q[at];at=at+1;local xx,yy=k%384,math.floor(k/384)
    for oy=-1,1 do for ox=-1,1 do
     local nx,ny=xx+ox,yy+oy;local nk=ny*384+nx
     if nx>=0 and nx<384 and ny>=0 and ny<384 and not visited[nk] and pc.rgbaA(tile:getPixel(nx,ny))>0 then visited[nk]=true;q[#q+1]=nk end
    end end
   end
   if #q>#largest then largest=q end
  end
 end end
 local clean=Image(384,384,ColorMode.RGB)
 for _,key in ipairs(largest) do local x,y=key%384,math.floor(key/384);clean:drawPixel(x,y,tile:getPixel(x,y)) end
 if i>1 then spr:newEmptyFrame() end
 spr:newCel(spr.layers[1],i,clean,Point(0,0));spr.frames[i].duration=cfg.durations[i]/1000
 clean:saveAs(out..string.format('/F%02d.png',i));strip:drawImage(clean,Point((i-1)*384,0))
 audit.frames[i]={sourceAnchor={anchor,cfg.ground},retainedPixels=#largest,durationMs=cfg.durations[i],pixelClones=false}
end
local tag=spr:newTag(1,10);tag.name=cfg.tag;tag.aniDir=AniDir.FORWARD
spr:saveAs(out..'/barel-combo'..attack..'-dot-10.aseprite');strip:saveAs(out..'/review-strip.png')
local f=assert(io.open(out..'/separation.json','wb'));f:write(json.encode(audit));f:close()
print('Created dot combo'..attack)
