-- Original transparent idle samples. No redraw or source resampling.
local root=assert(app.params.root)
local out=root..'/assets/aseprite/barel-idle-10'
local src=Image{fromFile=assert(app.params.input)}
assert(src.width==2172 and src.height==724,'Unexpected idle source revision')
app.fs.makeAllDirectories(out)
local pc=app.pixelColor
local width=src.width
local firstY,lastY=160,570
local originX,originY,ground=200,416,561
local fg={}
for y=firstY,lastY do for x=0,width-1 do
  if pc.rgbaA(src:getPixel(x,y))>=32 then fg[y*width+x]=true end
end end
local guides={234,442,652,864,1078,1290,1506,1721,1939}
local seams={}
for s,g in ipairs(guides) do
  local lo,hi=g-35,g+35
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
local anchors={143,350,560,771,984,1197,1412,1626,1843,2058}
-- Adjacent front toes touch the next rear heel in the supplied strip.
local rearHeelEdges={0,233,443,654,866,1079,1295,1510,1725,1947}
local sprite=Sprite(448,448,ColorMode.RGB)
sprite.layers[1].name='Barel idle - source 9e910d98, original RGBA'
local sheet=Image(4480,448,ColorMode.RGB)
local audit={sourceSize={src.width,src.height},canvas={448,448},anchor={originX,originY},alphaThreshold=32,frames={}}
for i=1,10 do
  local tile=Image(448,448,ColorMode.RGB)
  for dy=0,447 do
    local sy=dy-originY+ground
    if sy>=firstY and sy<=lastY then
      local left=i==1 and 0 or seams[i-1][sy]
      local right=i==10 and width or seams[i][sy]
      for dx=0,447 do
        local sx=dx-originX+anchors[i]
        if sx>=left and sx<right and fg[sy*width+sx] then
          local c=src:getPixel(sx,sy)
          local neighborCape=sx>anchors[i]+50 and sy>350 and pc.rgbaR(c)>=pc.rgbaG(c)*1.8+8
          local previousToe=i>1 and sy>=520 and sx<rearHeelEdges[i]
          if not neighborCape and not previousToe then tile:drawPixel(dx,dy,c) end
        end
      end
    end
  end
  -- F1-F9 front toes are occluded by the next rear heel in the source.
  -- Fill missing toe pixels only from the unoccluded supplied F10 toe.
  local repairs={}
  if i<10 then
    for sy=525,553 do for rx=85,113 do
      local dx,dy=originX+rx,sy-ground+originY
      local sample=src:getPixel(anchors[10]+rx,sy)
      if pc.rgbaA(tile:getPixel(dx,dy))==0 and pc.rgbaA(sample)>=32 then
        tile:drawPixel(dx,dy,sample)
        repairs[#repairs+1]={dx,dy,anchors[10]+rx,sy}
      end
    end end
  end
  local visited,largest={},{}
  for yy=0,447 do for xx=0,447 do
    local key=yy*448+xx
    if not visited[key] and pc.rgbaA(tile:getPixel(xx,yy))>0 then
      local component={{xx,yy}};local at=1;visited[key]=true
      while at<=#component do
        local p=component[at];at=at+1
        for oy=-1,1 do for ox=-1,1 do
          local nx,ny=p[1]+ox,p[2]+oy;local nk=ny*448+nx
          if nx>=0 and nx<448 and ny>=0 and ny<448 and not visited[nk] and pc.rgbaA(tile:getPixel(nx,ny))>0 then
            visited[nk]=true;component[#component+1]={nx,ny}
          end
        end end
      end
      if #component>#largest then largest=component end
    end
  end end
  local clean=Image(448,448,ColorMode.RGB)
  for _,p in ipairs(largest) do clean:drawPixel(p[1],p[2],tile:getPixel(p[1],p[2])) end
  if i>1 then sprite:newEmptyFrame() end
  sprite:newCel(sprite.layers[1],i,clean,Point(0,0));sprite.frames[i].duration=.130
  clean:saveAs(out..string.format('/F%02d.png',i));sheet:drawImage(clean,Point((i-1)*448,0))
  audit.frames[i]={sourceAnchor={anchors[i],ground},retainedPixels=#largest,durationMs=130,sourcePixelClones=repairs}
end
local tag=sprite:newTag(1,10);tag.name='idle';tag.aniDir=AniDir.FORWARD
sprite:saveAs(out..'/barel-idle-10.aseprite');sheet:saveAs(out..'/review-strip.png')
local f=assert(io.open(out..'/separation.json','wb'));f:write(json.encode(audit));f:close()
print('Created original-density idle cels: '..out)
