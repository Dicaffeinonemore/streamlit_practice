-- Source cf070279, row-major 5x2 walking poses. Original RGBA only.
local root=assert(app.params.root)
local out=root..'/assets/aseprite/barel-walk-10'
local src=Image{fromFile=assert(app.params.input)}
assert(src.width==1536 and src.height==1024,'Unexpected walk source revision')
app.fs.makeAllDirectories(out)
local pc=app.pixelColor
local width=src.width
local originX,originY=224,416
local anchors={224,525,827,1124,1425,223,525,828,1125,1427}
local sprite=Sprite(448,448,ColorMode.RGB)
sprite.layers[1].name='Barel walk - original samples, row-major 5x2'
local sheet=Image(4480,448,ColorMode.RGB)
local audit={sourceSize={src.width,src.height},canvas={448,448},anchor={originX,originY},alphaThreshold=32,frames={}}
local frame=0
for row,range in ipairs({{70,485,465},{540,950,927}}) do
  local firstY,lastY,ground=range[1],range[2],range[3]
  local fg={}
  for y=firstY,lastY do for x=0,width-1 do
    if pc.rgbaA(src:getPixel(x,y))>=32 then fg[y*width+x]=true end
  end end
  local seen,components={},{}
  for y=firstY,lastY do for x=0,width-1 do
    local key=y*width+x
    if fg[key] and not seen[key] then
      local q={key};local at=1;seen[key]=true
      local minx,miny,maxx,maxy=x,y,x,y
      while at<=#q do
        local k=q[at];at=at+1
        local xx,yy=k%width,math.floor(k/width)
        minx=math.min(minx,xx);miny=math.min(miny,yy);maxx=math.max(maxx,xx);maxy=math.max(maxy,yy)
        for _,d in ipairs({{-1,0},{1,0},{0,-1},{0,1}}) do
          local nx,ny=xx+d[1],yy+d[2];local nk=ny*width+nx
          if nx>=0 and nx<width and ny>=firstY and ny<=lastY and fg[nk] and not seen[nk] then
            seen[nk]=true;q[#q+1]=nk
          end
        end
      end
      if #q>=15000 then components[#components+1]={pixels=q,bounds={minx,miny,maxx+1,maxy+1}} end
    end
  end end
  assert(#components==5,'Expected five independent character components in row '..row)
  table.sort(components,function(a,b)return a.bounds[1]<b.bounds[1] end)
  for col,c in ipairs(components) do
    frame=frame+1
    local tile=Image(448,448,ColorMode.RGB)
    for _,k in ipairs(c.pixels) do
      local sx,sy=k%width,math.floor(k/width)
      local dx,dy=sx-anchors[frame]+originX,sy-ground+originY
      assert(dx>0 and dx<447 and dy>0 and dy<447,'Character touches output canvas')
      tile:drawPixel(dx,dy,src:getPixel(sx,sy))
    end
    if frame>1 then sprite:newEmptyFrame() end
    sprite:newCel(sprite.layers[1],frame,tile,Point(0,0));sprite.frames[frame].duration=.090
    tile:saveAs(out..string.format('/F%02d.png',frame));sheet:drawImage(tile,Point((frame-1)*448,0))
    audit.frames[frame]={gridRow=row,gridColumn=col,sourceAnchor={anchors[frame],ground},sourceBounds=c.bounds,
      retainedPixels=#c.pixels,durationMs=90,pixelClones=false}
  end
end
local tag=sprite:newTag(1,10);tag.name='walk';tag.aniDir=AniDir.FORWARD
sprite:saveAs(out..'/barel-walk-10.aseprite');sheet:saveAs(out..'/review-strip.png')
local file=assert(io.open(out..'/separation.json','wb'));file:write(json.encode(audit));file:close()
print('Created ten complete original-density components in row-major order')
