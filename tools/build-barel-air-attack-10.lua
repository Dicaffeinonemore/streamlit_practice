-- Supplied dot aerial slash: original pixels, reviewed blade ownership.
local root=assert(app.params.root)
local out=root..'/assets/aseprite/barel-air-attack-10'
local src=Image{fromFile=out..'/source/original.png'}
assert(src.width==1600 and src.height==686,'Unexpected aerial slash revision')
local pc=app.pixelColor
local w=src.width
local top,bottom=210,540
local fg,seen,groups={},{},{}
for y=top,bottom do for x=0,w-1 do if pc.rgbaA(src:getPixel(x,y))>=32 then fg[y*w+x]=true end end end
for y=top,bottom do for x=0,w-1 do
 local key=y*w+x
 if fg[key] and not seen[key] then
  local q={key};local at=1;seen[key]=true;local left=x
  while at<=#q do
   local k=q[at];at=at+1;local xx,yy=k%w,math.floor(k/w);left=math.min(left,xx)
   for _,d in ipairs({{-1,0},{1,0},{0,-1},{0,1}}) do
    local nx,ny=xx+d[1],yy+d[2];local nk=ny*w+nx
    if nx>=0 and nx<w and ny>=top and ny<=bottom and fg[nk] and not seen[nk] then seen[nk]=true;q[#q+1]=nk end
   end
  end
  if #q>1500 then groups[#groups+1]={pixels=q,left=left} end
 end
end end
assert(#groups==5,'Unexpected aerial slash connected groups')
table.sort(groups,function(a,b)return a.left<b.left end)
local groupFor={}
for i,g in ipairs(groups) do for _,key in ipairs(g.pixels) do groupFor[key]=i end end
local guides={800,964,1130,1286,1440}
local seams={}
for i,g in ipairs(guides) do
 local lo,hi=g-45,g+45;local prev,back={},{}
 for x=lo,hi do prev[x]=0 end
 for y=top,bottom do
  local cur={};back[y]={}
  for x=lo,hi do
   local best,bx=math.huge,x
   for d=-3,3 do local xx=x+d
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
local blades={
 {owner=5,poly={{770,402},{790,410},{866,456},{866,476},{848,470},{766,430}}},
 {owner=6,poly={{940,422},{952,428},{1058,488},{1066,502},{1052,500},{934,438}}},
 {owner=7,poly={{1082,420},{1096,426},{1150,460},{1152,470},{1138,466},{1076,434}}},
 {owner=8,poly={{1224,432},{1238,438},{1328,502},{1332,520},{1316,516},{1218,462}}},
 {owner=9,poly={{1398,472},{1410,478},{1482,518},{1486,534},{1468,530},{1392,500}}}}
local function inside(x,y,p)
 local yes=false;local j=#p
 for i=1,#p do local a,b=p[i],p[j]
  if (a[2]>y)~=(b[2]>y) and x<(b[1]-a[1])*(y-a[2])/(b[2]-a[2])+a[1] then yes=not yes end
  j=i
 end
 return yes
end
local function owner(x,y)
 local group=groupFor[y*w+x]
 if not group then return nil end
 if group<5 then return group end
 if x>=1308 and x<=1344 and y>=516 then return 9 end
 local c=src:getPixel(x,y);local metallic=pc.rgbaR(c)<pc.rgbaG(c)*1.8+8
 for _,b in ipairs(blades) do if metallic and inside(x,y,b.poly) then return b.owner end end
 for i=1,5 do if x<seams[i][y] then return i+4 end end
 return 10
end
local anchors={130,306,426,576,712,892,1052,1206,1360,1496}
local pelvisY={406,340,380,396,422,452,460,462,482,454}
local spr=Sprite(448,448,ColorMode.RGB)
spr.layers[1].name='Barel air attack - supplied dot pixels'
local strip=Image(4480,448,ColorMode.RGB)
local audit={sourceSize={w,src.height},canvas={448,448},anchor={224,384},alphaThreshold=32,
 connectedGroups={{1},{2},{3},{4},{5,6,7,8,9,10}},pelvisReferenceFromGround=76,frames={}}
for i=1,10 do
 local ground=pelvisY[i]+76;local tile=Image(448,448,ColorMode.RGB)
 for y=top,bottom do for x=0,w-1 do
  if fg[y*w+x] and owner(x,y)==i then
   local dx,dy=x-anchors[i]+224,y-ground+384
   assert(dx>0 and dx<447 and dy>0 and dy<447,'Air slash outside cel')
   tile:drawPixel(dx,dy,src:getPixel(x,y))
  end
 end end
 local visited,largest={},{}
 for y=0,447 do for x=0,447 do
  local key=y*448+x
  if pc.rgbaA(tile:getPixel(x,y))>0 and not visited[key] then
   local q={key};local at=1;visited[key]=true
   while at<=#q do
    local k=q[at];at=at+1;local xx,yy=k%448,math.floor(k/448)
    for oy=-1,1 do for ox=-1,1 do
     local nx,ny=xx+ox,yy+oy;local nk=ny*448+nx
     if nx>=0 and nx<448 and ny>=0 and ny<448 and not visited[nk] and pc.rgbaA(tile:getPixel(nx,ny))>0 then visited[nk]=true;q[#q+1]=nk end
    end end
   end
   if #q>#largest then largest=q end
  end
 end end
 local clean=Image(448,448,ColorMode.RGB)
 for _,key in ipairs(largest) do local x,y=key%448,math.floor(key/448);clean:drawPixel(x,y,tile:getPixel(x,y)) end
 if i>1 then spr:newEmptyFrame() end
 spr:newCel(spr.layers[1],i,clean,Point(0,0));spr.frames[i].duration=.040
 clean:saveAs(out..string.format('/F%02d.png',i));strip:drawImage(clean,Point((i-1)*448,0))
 audit.frames[i]={sourceAnchor={anchors[i],ground},sourcePelvis={anchors[i],pelvisY[i]},retainedPixels=#largest,durationMs=40,pixelClones=false}
end
local tag=spr:newTag(1,10);tag.name='air';tag.aniDir=AniDir.FORWARD
spr:saveAs(out..'/barel-air-attack-10.aseprite');strip:saveAs(out..'/review-strip.png')
local f=assert(io.open(out..'/separation.json','wb'));f:write(json.encode(audit));f:close()
print('Created ten original aerial slash cels')
