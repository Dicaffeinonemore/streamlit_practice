-- Source 64992ab7: preserve retained RGBA and source pixel density.
local root=assert(app.params.root)
local out=root..'/assets/aseprite/barel-combo1-10'
local src=Image{fromFile=assert(app.params.input)}
assert(src.width==2172 and src.height==724,'Unexpected combo1 source revision')
app.fs.makeAllDirectories(out)
local pc=app.pixelColor
local width=src.width
local firstY,lastY=220,556
local originX,originY,ground=200,352,547
local fg={}
for y=firstY,lastY do for x=0,width-1 do
  if pc.rgbaA(src:getPixel(x,y))>=32 then fg[y*width+x]=true end
end end
local guides={226,445,653,882,1128,1378,1600,1800,1990}
local seams={}
for s,g in ipairs(guides) do
  local radius=(s==1 or s>=5) and 85 or 35
  local lo,hi=g-radius,g+radius
  local prev,back={},{}
  for x=lo,hi do prev[x]=0 end
  for y=firstY,lastY do
    local cur={};back[y]={}
    for x=lo,hi do
      local best,bx=math.huge,x
      for dx=-3,3 do
        local xx=x+dx
        if prev[xx] then
          local cost=prev[xx]+math.abs(dx)*.2
          if cost<best then best,bx=cost,xx end
        end
      end
      cur[x]=best+(fg[y*width+x] and 255 or 0)+math.abs(x-g)*.05
      back[y][x]=bx
    end
    prev=cur
  end
  local bx,best=g,math.huge
  for x=lo,hi do if prev[x]<best then best,bx=prev[x],x end end
  seams[s]={}
  for y=lastY,firstY,-1 do seams[s][y]=bx;bx=back[y][bx] end
end
local blades={
  {owner=1,poly={{196,448},{205,453},{259,517},{272,540},{244,528},{182,467}},tip={225,475}},
  {owner=5,poly={{1054,437},{1066,438},{1132,495},{1142,514},{1115,508},{1047,457}},tip={1095,465}},
  {owner=6,poly={{1305,455},{1317,457},{1376,504},{1388,524},{1363,520},{1297,477}},tip={1340,477}},
  {owner=7,poly={{1531,460},{1546,465},{1610,506},{1625,525},{1595,522},{1527,483}},tip={1570,485}},
  {owner=8,poly={{1744,439},{1754,443},{1814,504},{1830,523},{1803,516},{1738,462}},tip={1775,470}}
}
local leftovers={[2]={267,537},[6]={1138,511},[7]={1383,521},[8]={1621,523},[9]={1825,520}}
local function inside(x,y,p)
  local yes=false;local j=#p
  for k=1,#p do
    local a,b=p[k],p[j]
    if (a[2]>y)~=(b[2]>y) and x<(b[1]-a[1])*(y-a[2])/(b[2]-a[2])+a[1] then yes=not yes end
    j=k
  end
  return yes
end
local function owner(x,y)
  local c=src:getPixel(x,y)
  local metallic=pc.rgbaR(c)<pc.rgbaG(c)*1.8+8
  for _,b in ipairs(blades) do if metallic and inside(x,y,b.poly) then return b.owner end end
  for k=1,9 do
    -- Below the seventh sword tip, the complete rear boot belongs to F8.
    local edge=k==7 and y>=525 and 1600 or seams[k][y]
    if x<edge then return k end
  end
  return 10
end
local anchors={145,360,570,804,1010,1260,1490,1700,1890,2070}
local durations={70,35,35,30,30,20,20,20,25,25}
local spr=Sprite(384,384,ColorMode.RGB)
spr.layers[1].name='Barel combo1 - source 64992ab7, original RGBA'
local sheet=Image(3840,384,ColorMode.RGB)
local audit={sourceSize={src.width,src.height},canvas={384,384},anchor={originX,originY},alphaThreshold=32,frames={}}
for i=1,10 do
  local tile=Image(384,384,ColorMode.RGB)
  for dy=0,383 do
    local sy=dy-originY+ground
    if sy>=firstY and sy<=lastY then
      for dx=0,383 do
        local sx=dx-originX+anchors[i]
        if sx>=0 and sx<width and fg[sy*width+sx] and owner(sx,sy)==i then
          local c=src:getPixel(sx,sy)
          local metallic=pc.rgbaR(c)<pc.rgbaG(c)*1.8+8
          local limit=leftovers[i]
          local residue=limit and sx<limit[1] and sy>=470 and sy<limit[2] and metallic
          for _,b in ipairs(blades) do
            if b.owner==i and sx>b.tip[1] and sy>b.tip[2] and (not metallic or not inside(sx,sy,b.poly)) then residue=true end
          end
          if not residue then tile:drawPixel(dx,dy,c) end
        end
      end
    end
  end
  -- The preceding sword occludes a short section of F8's rear shin.
  -- Clone only missing pixels from the same armored shin in supplied F5.
  -- No generated colors, redraw, scaling, or changes to visible F8 pixels.
  local repairs={}
  if i==8 then
    for sy=506,532 do for sx=1610,1645 do
      local dx,dy=sx-anchors[i]+originX,sy-ground+originY
      local sample=src:getPixel(sx-699,sy)
      if pc.rgbaA(tile:getPixel(dx,dy))==0 and pc.rgbaA(sample)>=128 and pc.rgbaR(sample)<pc.rgbaG(sample)*1.8+8 then
        tile:drawPixel(dx,dy,sample)
        repairs[#repairs+1]={dx,dy,sx-699,sy}
      end
    end end
  end
  local visited,largest={},{ }
  for yy=0,383 do for xx=0,383 do
    local key=yy*384+xx
    if not visited[key] and pc.rgbaA(tile:getPixel(xx,yy))>0 then
      local component={{xx,yy}};local at=1;visited[key]=true
      while at<=#component do
        local p=component[at];at=at+1
        for oy=-1,1 do for ox=-1,1 do
          local nx,ny=p[1]+ox,p[2]+oy;local nk=ny*384+nx
          if nx>=0 and nx<384 and ny>=0 and ny<384 and not visited[nk] and pc.rgbaA(tile:getPixel(nx,ny))>0 then
            visited[nk]=true;component[#component+1]={nx,ny}
          end
        end end
      end
      if #component>#largest then largest=component end
    end
  end end
  local clean=Image(384,384,ColorMode.RGB)
  for _,p in ipairs(largest) do clean:drawPixel(p[1],p[2],tile:getPixel(p[1],p[2])) end
  if i>1 then spr:newEmptyFrame() end
  spr:newCel(spr.layers[1],i,clean,Point(0,0));spr.frames[i].duration=durations[i]/1000
  clean:saveAs(out..string.format('/F%02d.png',i))
  sheet:drawImage(clean,Point((i-1)*384,0))
  audit.frames[i]={sourceAnchor={anchors[i],ground},retainedPixels=#largest,durationMs=durations[i],sourcePixelClones=repairs}
end
local tag=spr:newTag(1,10);tag.name='basic-attack-2';tag.aniDir=AniDir.FORWARD
spr:saveAs(out..'/barel-combo1-10.aseprite');sheet:saveAs(out..'/review-strip.png')
local f=assert(io.open(out..'/separation.json','wb'));f:write(json.encode(audit));f:close()
print('Created combo1 source 64992ab7: '..out)
