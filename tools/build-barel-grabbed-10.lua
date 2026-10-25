local root=assert(app.params.root)
local out=root..'/assets/aseprite/barel-grabbed-10'
local src=Image{fromFile=out..'/source/original.png'}
assert(src.width==1600 and src.height==533,'Unexpected grabbed source')
local pc=app.pixelColor
local w=src.width
local fg,seen,groups={},{},{}
for y=150,415 do for x=0,w-1 do if pc.rgbaA(src:getPixel(x,y))>=32 then fg[y*w+x]=true end end end
for y=150,415 do for x=0,w-1 do
 local key=y*w+x
 if fg[key] and not seen[key] then
  local q={key};local at=1;seen[key]=true;local left=x
  while at<=#q do
   local k=q[at];at=at+1;local xx,yy=k%w,math.floor(k/w);left=math.min(left,xx)
   for _,d in ipairs({{-1,0},{1,0},{0,-1},{0,1}}) do
    local nx,ny=xx+d[1],yy+d[2];local nk=ny*w+nx
    if nx>=0 and nx<w and ny>=150 and ny<=415 and fg[nk] and not seen[nk] then seen[nk]=true;q[#q+1]=nk end
   end
  end
  if #q>1500 then groups[#groups+1]={pixels=q,left=left} end
 end
end end
assert(#groups==10,'Expected ten independent grabbed silhouettes')
table.sort(groups,function(a,b)return a.left<b.left end)
local anchors={88,232,394,558,710,874,1030,1190,1350,1510}
local spr=Sprite(448,448,ColorMode.RGB)
spr.layers[1].name='Barel grabbed - original dot pixels'
local strip=Image(4480,448,ColorMode.RGB)
local audit={sourceSize={w,src.height},canvas={448,448},anchor={224,416},alphaThreshold=32,frames={}}
for i,g in ipairs(groups) do
 local tile=Image(448,448,ColorMode.RGB)
 for _,key in ipairs(g.pixels) do
  local x,y=key%w,math.floor(key/w);local dx,dy=x-anchors[i]+224,y-404+416
  assert(dx>0 and dx<447 and dy>0 and dy<447,'Grabbed sample outside cel');tile:drawPixel(dx,dy,src:getPixel(x,y))
 end
 if i>1 then spr:newEmptyFrame() end
 spr:newCel(spr.layers[1],i,tile,Point(0,0));spr.frames[i].duration=.065
 tile:saveAs(out..string.format('/F%02d.png',i));strip:drawImage(tile,Point((i-1)*448,0))
 audit.frames[i]={sourceAnchor={anchors[i],404},retainedPixels=#g.pixels,durationMs=65,pixelClones=false}
end
local tag=spr:newTag(1,10);tag.name='grabbed';tag.aniDir=AniDir.FORWARD
spr:saveAs(out..'/barel-grabbed-10.aseprite');strip:saveAs(out..'/review-strip.png')
local f=assert(io.open(out..'/separation.json','wb'));f:write(json.encode(audit));f:close()
