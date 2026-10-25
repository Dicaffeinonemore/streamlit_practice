-- Original RGBA dash sheet, minimum-alpha seams through overlapping baked FX.
local root=assert(app.params.root)
local out=root..'/assets/aseprite/barel-dash-10'
local src=Image{fromFile=assert(app.params.input)}
assert(src.width==2172 and src.height==724,'Unexpected dash source revision')
app.fs.makeAllDirectories(out)
local pc=app.pixelColor
local w=src.width
local top,bottom=275,550
-- Seven independent connected groups. Preserve all isolated characters intact;
-- only the shared baked FX groups require seams (F4-F6 and F7-F8).
local fg,seen,groups={},{},{}
for y=top,bottom do for x=0,w-1 do
  if pc.rgbaA(src:getPixel(x,y))>=32 then fg[y*w+x]=true end
end end
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
    if #q>15000 then groups[#groups+1]={pixels=q,left=left} end
  end
end end
assert(#groups==7,'Unexpected connected dash groups')
table.sort(groups,function(a,b)return a.left<b.left end)
local groupFor={}
for i,g in ipairs(groups) do for _,key in ipairs(g.pixels) do groupFor[key]=i end end
local guides={218,438,655,925,1164,1365,1575,1780,1962}
local seams={}
for i,g in ipairs(guides) do
  local lo,hi=g-28,g+28;local previous,back={},{}
  for x=lo,hi do previous[x]=0 end
  for y=top,bottom do
    local current={};back[y]={}
    for x=lo,hi do
      local best,bx=math.huge,x
      for d=-3,3 do
        local xx=x+d
        if previous[xx] then
          local cost=previous[xx]+math.abs(d)*.15
          if cost<best then best,bx=cost,xx end
        end
      end
      local alpha=pc.rgbaA(src:getPixel(x,y))/255
      current[x]=best+alpha^3*255+math.abs(x-g)*.08;back[y][x]=bx
    end
    previous=current
  end
  local x,best=g,math.huge
  for xx=lo,hi do if previous[xx]<best then x,best=xx,previous[xx] end end
  seams[i]={}
  for y=bottom,top,-1 do seams[i][y]=x;x=back[y][x] end
end
local function owner(x,y)
  local group=groupFor[y*w+x]
  if group and group<=3 then return group end
  if group==4 then
    if x<seams[4][y] then return 4 elseif x<seams[5][y] then return 5 else return 6 end
  end
  if group==5 then return x<seams[7][y] and 7 or 8 end
  if group==6 then return 9 end
  if group==7 then return 10 end
  return nil
end
local anchors={117,333,548,806,1045,1253,1464,1684,1878,2081}
local grounds={540,539,538,536,536,536,542,541,546,545}
local spr=Sprite(384,384,ColorMode.RGB)
spr.layers[1].name='Barel dash - original RGBA with baked speed FX'
local strip=Image(3840,384,ColorMode.RGB)
local seamRows={}
for y=top,bottom do local row={} for i=1,9 do row[i]=seams[i][y] end seamRows[#seamRows+1]=row end
local audit={sourceSize={w,src.height},canvas={384,384},anchor={200,352},alphaThreshold=32,
  seamGuides=guides,seamTop=top,seamRows=seamRows,frames={},bakedEffects=true,
  connectedGroups={1,2,3,{4,5,6},{7,8},9,10}}
for i=1,10 do
  local tile=Image(384,384,ColorMode.RGB)
  local occupied={}
  for y=top,bottom do for x=0,w-1 do
    local c=src:getPixel(x,y)
    if pc.rgbaA(c)>=32 and owner(x,y)==i then
      local dx,dy=x-anchors[i]+200,y-grounds[i]+352
      assert(dx>0 and dx<383 and dy>0 and dy<383,'Dash sample outside canvas')
      tile:drawPixel(dx,dy,c);occupied[dy*384+dx]=true
    end
  end end
  -- Detached remnants from adjacent dust/blur are excluded, original samples only.
  local seen,largest={},{}
  for k,_ in pairs(occupied) do
    if not seen[k] then
      local q={k};local at=1;seen[k]=true
      while at<=#q do
        local key=q[at];at=at+1;local x,y=key%384,math.floor(key/384)
        for oy=-1,1 do for ox=-1,1 do
          local xx,yy=x+ox,y+oy;local nk=yy*384+xx
          if xx>=0 and xx<384 and yy>=0 and yy<384 and occupied[nk] and not seen[nk] then seen[nk]=true;q[#q+1]=nk end
        end end
      end
      if #q>#largest then largest=q end
    end
  end
  local clean=Image(384,384,ColorMode.RGB)
  for _,key in ipairs(largest) do local x,y=key%384,math.floor(key/384);clean:drawPixel(x,y,tile:getPixel(x,y)) end
  if i>1 then spr:newEmptyFrame() end
  spr:newCel(spr.layers[1],i,clean,Point(0,0));spr.frames[i].duration=.019
  clean:saveAs(out..string.format('/F%02d.png',i));strip:drawImage(clean,Point((i-1)*384,0))
  audit.frames[i]={sourceAnchor={anchors[i],grounds[i]},retainedPixels=#largest,durationMs=19,pixelClones=false}
end
local tag=spr:newTag(1,10);tag.name='dash';tag.aniDir=AniDir.FORWARD
spr:saveAs(out..'/barel-dash-10.aseprite');strip:saveAs(out..'/review-strip.png')
local file=assert(io.open(out..'/separation.json','wb'));file:write(json.encode(audit));file:close()
print('Created ten original dash poses, 190ms total')
