-- Original RGB samples, no redraw, resampling, or palette conversion.
-- Reviewed row boundaries keep adjacent swords/boots out of each cel.
local root=assert(app.params.root)
local input=assert(app.params.input)
local out=root..'/assets/aseprite/barel-combo0-10'
app.fs.makeAllDirectories(out)
local src=Image{fromFile=input}
assert(src.width==2048 and src.height==682,'Unexpected source revision')
local pc=app.pixelColor
local width,height=src.width,src.height
local fg={}
for y=190,519 do for x=0,width-1 do
  local c=src:getPixel(x,y)
  local r,g,b=pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c)
  local hi,lo=math.max(r,g,b),math.min(r,g,b)
  if lo<175 or hi-lo>12 then fg[y*width+x]=true end
end end
-- Recover only narrow interior highlight lines, never large checkerboard holes.
local highlights={}
for y=191,518 do for x=1,width-2 do
  local k=y*width+x
  if not fg[k] then
    if fg[k-1] and fg[k+1] or fg[k-width] and fg[k+width] then highlights[k]=true end
  end
end end
for k in pairs(highlights) do fg[k]=true end
-- Small, enclosed bright armor highlights are source detail, not exterior matte.
local checked={}
for y=190,519 do for x=0,width-1 do
  local key=y*width+x
  if not fg[key] and not checked[key] then
    local q={key};local at=1;local exterior=false;checked[key]=true
    while at<=#q do
      local k=q[at];at=at+1;local xx,yy=k%width,math.floor(k/width)
      if xx==0 or xx==width-1 or yy==190 or yy==519 then exterior=true end
      for _,d in ipairs({{-1,0},{1,0},{0,-1},{0,1}}) do
        local nx,ny=xx+d[1],yy+d[2];local nk=ny*width+nx
        if nx>=0 and nx<width and ny>=190 and ny<=519 and not fg[nk] and not checked[nk] then checked[nk]=true;q[#q+1]=nk end
      end
    end
    if not exterior and #q<=24 then for _,k in ipairs(q) do fg[k]=true end end
  end
end end
local guides={201,392,603,813,1035,1247,1458,1657,1851}
local seams={}
for s,g in ipairs(guides) do
  local radius=(s>=5 and s<=7) and 75 or 27
  local lo,hi=g-radius,g+radius
  local prev,back={},{}
  for x=lo,hi do prev[x]=0 end
  for y=190,519 do
    local cur={};back[y]={}
    for x=lo,hi do
      local best,bx=math.huge,x
      for dx=-3,3 do
        local xx=x+dx
        if prev[xx] then
          local cost=prev[xx]+math.abs(dx)*0.2
          if cost<best then best,bx=cost,xx end
        end
      end
      cur[x]=best+(fg[y*width+x] and 255 or 0)+math.abs(x-g)*0.05
      back[y][x]=bx
    end
    prev=cur
  end
  local bx,best=g,math.huge
  for x=lo,hi do if prev[x]<best then best,bx=prev[x],x end end
  seams[s]={}
  for y=519,190,-1 do seams[s][y]=bx;bx=back[y][bx] end
end
-- The sword belongs to the earlier pose even where it crosses the next boot.
local blades={
  {owner=5,poly={{982,397},{1003,407},{1060,465},{1073,484},{1049,478},{991,428},{976,419}}},
  {owner=6,poly={{1200,420},{1223,442},{1288,485},{1300,497},{1271,495},{1210,455},{1190,441}}},
  {owner=7,poly={{1425,420},{1443,439},{1513,478},{1530,495},{1490,495},{1430,459},{1417,444}}},
  {owner=8,poly={{1632,422},{1718,480},{1720,498},{1700,493},{1620,440}}},
  {owner=9,poly={{1760,388},{1780,395},{1870,459},{1887,481},{1850,477},{1760,420}}}
}
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
  for k=1,9 do if x<seams[k][y] then return k end end
  return 10
end
local anchors={110,320,520,735,939,1165,1385,1596,1768,1960}
local durations={40,30,35,25,25,30,45,25,40,55}
local spr=Sprite(384,384,ColorMode.RGB)
spr.layers[1].name='Barel combo0 - original RGB, reviewed separation'
local sheet=Image(3840,384,ColorMode.RGB)
local audit={sourceSize={width,height},canvas={384,384},anchor={160,352},frames={}}
for i=1,10 do
  local tile=Image(384,384,ColorMode.RGB)
  for dy=0,383 do
    local sy=dy-352+512
    if sy>=190 and sy<=519 then
      local left=i==1 and 0 or seams[i-1][sy]
      local right=i==10 and width or seams[i][sy]
      for dx=0,383 do
        local sx=dx-160+anchors[i]
        if sx>=0 and sx<width and owner(sx,sy)==i and fg[sy*width+sx] then
          local c=src:getPixel(sx,sy)
          local limits={[6]={1068,482},[7]={1294,491},[8]={1530,497}}
          local limit=limits[i]
          local residue=limit and sx<limit[1] and sy>=440 and sy<limit[2] and pc.rgbaR(c)<pc.rgbaG(c)*1.8+8
          if i==1 and sx>165 and sy>430 and pc.rgbaR(c)>=pc.rgbaG(c)*1.8+8 then residue=true end
          local tips={[5]={1030,445},[6]={1235,450},[7]={1465,455},[8]={1665,455},[9]={1820,430}}
          local tip=tips[i]
          if tip and sx>tip[1] and sy>tip[2] then
            if pc.rgbaR(c)>=pc.rgbaG(c)*1.8+8 or not inside(sx,sy,blades[i-4].poly) then residue=true end
          end
          if not residue then tile:drawPixel(dx,dy,c) end
        end
      end
    end
  end
  -- One connected character per frame; no isolated slash/neighbor fragments.
  local visited,largest={},{}
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
  spr:newCel(spr.layers[1],i,clean,Point(0,0))
  spr.frames[i].duration=durations[i]/1000
  clean:saveAs(out..string.format('/F%02d.png',i))
  sheet:drawImage(clean,Point((i-1)*384,0))
  audit.frames[i]={sourceAnchor={anchors[i],512},retainedPixels=#largest,durationMs=durations[i]}
end
local tag=spr:newTag(1,10);tag.name='basic-attack';tag.aniDir=AniDir.FORWARD
spr:saveAs(out..'/barel-combo0-10.aseprite')
sheet:saveAs(out..'/review-strip.png')
local f=assert(io.open(out..'/separation.json','wb'));f:write(json.encode(audit));f:close()
print('Created 10 original-density cels: '..out)
