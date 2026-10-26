local root=assert(app.params.root)
local out=root..'/assets/aseprite/barel-idle-dot-10'
local src=Image{fromFile=out..'/source/original.png'}
assert(src.width==1600 and src.height==533,'Unexpected idle dot source')
local pc=app.pixelColor
local w=src.width
local fg,seen,groups={},{},{}
for y=115,420 do for x=0,w-1 do if pc.rgbaA(src:getPixel(x,y))>=32 then fg[y*w+x]=true end end end
for y=115,420 do for x=0,w-1 do
 local key=y*w+x
 if fg[key] and not seen[key] then
  local q={key};local at=1;seen[key]=true;local left=x
  while at<=#q do
   local k=q[at];at=at+1;local xx,yy=k%w,math.floor(k/w);left=math.min(left,xx)
   for _,d in ipairs({{-1,0},{1,0},{0,-1},{0,1}}) do
    local nx,ny=xx+d[1],yy+d[2];local nk=ny*w+nx
    if nx>=0 and nx<w and ny>=115 and ny<=420 and fg[nk] and not seen[nk] then seen[nk]=true;q[#q+1]=nk end
   end
  end
  if #q>1500 then groups[#groups+1]={pixels=q,left=left} end
 end
end end
assert(#groups==9,'Expected F1/F2 pair and eight independent idle poses')
table.sort(groups,function(a,b)return a.left<b.left end)
local groupFor={}
for i,g in ipairs(groups) do for _,key in ipairs(g.pixels) do groupFor[key]=i end end
local function inside(x,y,p)
 local yes=false;local j=#p
 for i=1,#p do local a,b=p[i],p[j]
  if (a[2]>y)~=(b[2]>y) and x<(b[1]-a[1])*(y-a[2])/(b[2]-a[2])+a[1] then yes=not yes end
  j=i
 end
 return yes
end
local blade={{82,276},{102,282},{202,364},{204,384},{182,378},{78,302}}
local function owner(x,y)
 local group=groupFor[y*w+x]
 if not group then return nil end
 if group>1 then return group+1 end
 local c=src:getPixel(x,y);local metal=pc.rgbaR(c)<pc.rgbaG(c)*1.8+8
 if metal and inside(x,y,blade) then return 1 end
 return x<166 and 1 or 2
end
local anchors={102,260,418,578,736,896,1056,1214,1374,1534}
local spr=Sprite(448,448,ColorMode.RGB)
spr.layers[1].name='Barel idle dot - original samples'
local strip=Image(4480,448,ColorMode.RGB)
local audit={sourceSize={w,src.height},canvas={448,448},anchor={224,416},alphaThreshold=32,frames={},connectedGroups={{1,2},{3},{4},{5},{6},{7},{8},{9},{10}}}
for i=1,10 do
 local tile=Image(448,448,ColorMode.RGB)
 for y=115,420 do for x=0,w-1 do if fg[y*w+x] and owner(x,y)==i then
  local dx,dy=x-anchors[i]+224,y-410+416
  assert(dx>0 and dx<447 and dy>0 and dy<447,'Idle source outside cel');tile:drawPixel(dx,dy,src:getPixel(x,y))
 end end end
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
 spr:newCel(spr.layers[1],i,clean,Point(0,0));spr.frames[i].duration=.130
 clean:saveAs(out..string.format('/F%02d.png',i));strip:drawImage(clean,Point((i-1)*448,0))
 audit.frames[i]={sourceAnchor={anchors[i],410},retainedPixels=#largest,durationMs=130,pixelClones=false}
end
local tag=spr:newTag(1,10);tag.name='idle';tag.aniDir=AniDir.FORWARD
spr:saveAs(out..'/barel-idle-dot-10.aseprite');strip:saveAs(out..'/review-strip.png')
local f=assert(io.open(out..'/separation.json','wb'));f:write(json.encode(audit));f:close()
