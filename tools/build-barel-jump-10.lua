-- Original jump pixels. Remove sheet-authored arc by registering each sole.
local root=assert(app.params.root)
local out=root..'/assets/aseprite/barel-jump-10'
local src=Image{fromFile=out..'/source/original.png'}
assert(src.width==1600 and src.height==686,'Unexpected jump source revision')
local pc=app.pixelColor
local w=src.width
local fg,seen,groups={},{},{}
for y=175,500 do for x=0,w-1 do if pc.rgbaA(src:getPixel(x,y))>=32 then fg[y*w+x]=true end end end
for y=175,500 do for x=0,w-1 do
 local key=y*w+x
 if fg[key] and not seen[key] then
  local q={key};local at=1;seen[key]=true;local left=x
  while at<=#q do
   local k=q[at];at=at+1;local xx,yy=k%w,math.floor(k/w);left=math.min(left,xx)
   for _,d in ipairs({{-1,0},{1,0},{0,-1},{0,1}}) do
    local nx,ny=xx+d[1],yy+d[2];local nk=ny*w+nx
    if nx>=0 and nx<w and ny>=175 and ny<=500 and fg[nk] and not seen[nk] then seen[nk]=true;q[#q+1]=nk end
   end
  end
  if #q>1500 then groups[#groups+1]={pixels=q,left=left} end
 end
end end
assert(#groups==9,'Expected eight independent poses and one paired contour')
table.sort(groups,function(a,b)return a.left<b.left end)
local assigned={}
local blade={{1012,298},{1032,304},{1098,348},{1098,358},{1080,354},{1012,316}}
local function inside(x,y,p)
 local yes=false;local j=#p
 for i=1,#p do local a,b=p[i],p[j]
  if (a[2]>y)~=(b[2]>y) and x<(b[1]-a[1])*(y-a[2])/(b[2]-a[2])+a[1] then yes=not yes end
  j=i
 end
 return yes
end
-- F7's blade touches F8's cape. Metal samples in the blade belong to F7;
-- the red cape and all lower pixels belong to F8, without cloning overlap.
for group,g in ipairs(groups) do
 for _,key in ipairs(g.pixels) do
  local x,y=key%w,math.floor(key/w)
  local owner=group<7 and group or group+1
  if group==7 then
   local c=src:getPixel(x,y);local metallic=pc.rgbaR(c)<pc.rgbaG(c)*1.8+8
   if metallic and inside(x,y,blade) then owner=7
   elseif y>=384 or x>=1060 then owner=8
   else owner=7 end
  end
  assigned[key]=owner
 end
end
local anchors={94,250,408,562,710,860,1018,1170,1328,1484}
local durations={17,33,83,84,66,50,134,133,34,50}
local spr=Sprite(384,384,ColorMode.RGB)
spr.layers[1].name='Barel jump - original dot RGBA, sole registration'
local strip=Image(3840,384,ColorMode.RGB)
local audit={sourceSize={w,src.height},canvas={384,384},anchor={200,352},alphaThreshold=32,
 connectedGroups={{1},{2},{3},{4},{5},{6},{7,8},{9},{10}},frames={}}
for i=1,10 do
 local tile=Image(384,384,ColorMode.RGB);local ground=0
 for key,owner in pairs(assigned) do if owner==i then ground=math.max(ground,math.floor(key/w)+1) end end
 for key,owner in pairs(assigned) do if owner==i then
  local x,y=key%w,math.floor(key/w);local dx,dy=x-anchors[i]+200,y-ground+352
  assert(dx>0 and dx<383 and dy>0 and dy<383,'Jump source outside cel')
  tile:drawPixel(dx,dy,src:getPixel(x,y))
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
 spr:newCel(spr.layers[1],i,clean,Point(0,0));spr.frames[i].duration=durations[i]/1000
 clean:saveAs(out..string.format('/F%02d.png',i));strip:drawImage(clean,Point((i-1)*384,0))
 audit.frames[i]={sourceAnchor={anchors[i],ground},retainedPixels=#largest,durationMs=durations[i],pixelClones=false}
end
local tag=spr:newTag(1,10);tag.name='jump';tag.aniDir=AniDir.FORWARD
spr:saveAs(out..'/barel-jump-10.aseprite');strip:saveAs(out..'/review-strip.png')
local f=assert(io.open(out..'/separation.json','wb'));f:write(json.encode(audit));f:close()
print('Created ten original-density jump cels')
