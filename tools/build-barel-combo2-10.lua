-- Source 59d5dfc5, original-density third-hit cels. No image generation.
local root=assert(app.params.root)
local out=root..'/assets/aseprite/barel-combo2-10'
local src=Image{fromFile=assert(app.params.input)}
assert(src.width==1916 and src.height==821,'Unexpected combo2 source revision')
app.fs.makeAllDirectories(out)
local pc=app.pixelColor
local width=src.width
local firstY,lastY=270,590
local originX,originY,ground=200,352,583
local fg={}
for y=firstY,lastY do for x=0,width-1 do
  if pc.rgbaA(src:getPixel(x,y))>=32 then fg[y*width+x]=true end
end end
local guides={208,401,576,755,930,1138,1330,1515,1698}
local seams={}
for s,g in ipairs(guides) do
  local radius=(s==6 or s==7) and 85 or 35
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
  {owner=6,poly={{1098,523},{1104,525},{1168,563},{1177,577},{1174,581},{1155,580},{1090,542}},tip={1135,540}},
  {owner=7,poly={{1310,518},{1320,521},{1366,555},{1376,573},{1373,578},{1355,575},{1304,536}},tip={1350,540}}
}
local leftovers={[7]={1175,579},[8]={1372,576}}
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
local anchors={120,320,500,680,865,1050,1250,1430,1620,1810}
local durations={70,60,70,20,29,91,30,90,90,130}
local spr=Sprite(384,384,ColorMode.RGB)
spr.layers[1].name='Barel combo2 - source 59d5dfc5, original RGBA'
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
          local residue=limit and sx<limit[1] and sy>=535 and sy<limit[2] and metallic
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
  clean:saveAs(out..string.format('/F%02d.png',i));sheet:drawImage(clean,Point((i-1)*384,0))
  audit.frames[i]={sourceAnchor={anchors[i],ground},retainedPixels=#largest,durationMs=durations[i]}
end
local tag=spr:newTag(1,10);tag.name='basic-attack-3';tag.aniDir=AniDir.FORWARD
spr:saveAs(out..'/barel-combo2-10.aseprite');sheet:saveAs(out..'/review-strip.png')
local f=assert(io.open(out..'/separation.json','wb'));f:write(json.encode(audit));f:close()
print('Created combo2 original-density cels: '..out)
