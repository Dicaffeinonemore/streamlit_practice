-- Transparent source revision 16f5ba96. Preserve retained source RGBA.
local root=assert(app.params.root)
local out=root..'/assets/aseprite/barel-combo0-10'
local src=Image{fromFile=assert(app.params.input)}
assert(src.width==2172 and src.height==724,'Unexpected source revision')
app.fs.makeAllDirectories(out)
local pc=app.pixelColor
local width=src.width
local firstY,lastY=210,559
local originX,originY,ground=200,352,550
local fg={}
for y=firstY,lastY do for x=0,width-1 do
  if pc.rgbaA(src:getPixel(x,y))>=32 then fg[y*width+x]=true end
end end
local guides={193,410,636,863,1090,1320,1540,1750,1960}
local seams={}
for s,g in ipairs(guides) do
  local radius=(s==1 or s>=5) and 80 or 28
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
  {owner=1,poly={{103,420},{112,424},{222,500},{239,522},{212,517},{101,440}},tip={165,465}},
  {owner=5,poly={{1064,438},{1081,446},{1132,508},{1140,522},{1111,512},{1055,461}},tip={1085,470}},
  {owner=6,poly={{1296,467},{1306,470},{1375,522},{1380,534},{1349,535},{1288,486}},tip={1310,485}},
  {owner=7,poly={{1525,466},{1540,471},{1612,513},{1625,527},{1597,528},{1524,491}},tip={1550,485}},
  {owner=8,poly={{1739,456},{1750,461},{1805,505},{1815,521},{1788,516},{1734,479}},tip={1765,480}},
  {owner=9,poly={{1870,421},{1884,425},{1985,501},{2001,522},{1968,516},{1868,442}},tip={1930,470}}
}
local leftovers={[2]={240,525},[6]={1141,522},[7]={1378,532},[8]={1621,526},[9]={1817,524},[10]={2002,524}}
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
local anchors={119,348,568,796,1015,1243,1474,1694,1885,2080}
local durations={40,30,35,25,25,30,45,25,40,55}
local spr=Sprite(384,384,ColorMode.RGB)
spr.layers[1].name='Barel combo0 - source 16f5ba96, original RGBA'
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
  spr:newCel(spr.layers[1],i,clean,Point(0,0));spr.frames[i].duration=durations[i]/1000
  clean:saveAs(out..string.format('/F%02d.png',i))
  sheet:drawImage(clean,Point((i-1)*384,0))
  audit.frames[i]={sourceAnchor={anchors[i],ground},retainedPixels=#largest,durationMs=durations[i]}
end
local tag=spr:newTag(1,10);tag.name='basic-attack';tag.aniDir=AniDir.FORWARD
spr:saveAs(out..'/barel-combo0-10.aseprite');sheet:saveAs(out..'/review-strip.png')
local f=assert(io.open(out..'/separation.json','wb'));f:write(json.encode(audit));f:close()
print('Created source revision 16f5ba96: '..out)
