-- Clean and register the user's ten-pose strip in Aseprite.
local root = assert(app.params.root)
local src = Image{fromFile=assert(app.params.input)}
local out = root .. '/assets/aseprite/barel-attack-256'
app.fs.makeAllDirectories(out)
local pc = app.pixelColor
local y0,y1 = 350,579
local guides = {155,310,470,628,796,983,1170,1337,1502}
local seams = {}
-- Find low-opacity paths through the gaps, allowing diagonal sword tips.
for s,g in ipairs(guides) do
  local radius = (s==6 or s==7) and 12 or 23
  local lo,hi = g-radius,g+radius
  local prev,back = {},{}
  for x=lo,hi do prev[x]=0 end
  for y=y0,y1 do
    local cur={}; back[y]={}
    for x=lo,hi do
      local best,bx=math.huge,x
      for dx=-3,3 do
        local xx=x+dx
        if prev[xx] then
          local cost=prev[xx]+math.abs(dx)*0.2
          if cost<best then best,bx=cost,xx end
        end
      end
      local a=pc.rgbaA(src:getPixel(x,y))
      cur[x]=best+(a>=32 and a or 0)+math.abs(x-g)*0.035
      back[y][x]=bx
    end
    prev=cur
  end
  local bx,best=g,math.huge
  for x=lo,hi do if prev[x]<best then best,bx=prev[x],x end end
  seams[s]={}
  for y=y1,y0,-1 do seams[s][y]=bx; bx=back[y][bx] end
end
local blades={
  {owner=6,poly={{958,505},{1031,544},{1046,561},{1030,563},{952,521}}},
  {owner=7,poly={{1133,506},{1214,544},{1229,558},{1210,552},{1128,519}}}
}
local function inside(x,y,p)
  local yes=false; local j=#p
  for k=1,#p do
    local a,b=p[k],p[j]
    if (a[2]>y)~=(b[2]>y) and x<(b[1]-a[1])*(y-a[2])/(b[2]-a[2])+a[1] then yes=not yes end
    j=k
  end
  return yes
end
local function owner(x,y)
  for _,b in ipairs(blades) do if inside(x,y,b.poly) then return b.owner end end
  for k=1,9 do if x<seams[k][y] then return k end end
  return 10
end
local anchors={96,253,406,580,741,914,1105,1284,1438,1598}
local durations={40,30,35,25,25,30,45,25,40,55}
local spr=Sprite(256,256,ColorMode.RGB)
spr.layers[1].name='Barel - cleaned original poses'
local sheet=Image(2560,256,ColorMode.RGB)
for i=1,10 do
  local frame=Image(256,256,ColorMode.RGB)
  -- One common transform for all poses: anchor (110,240), scale 0.9.
  for dy=0,255 do
    local sy=math.floor((dy-240)/0.9+570+0.5)
    if sy>=y0 and sy<=y1 then
      local left=i==1 and 0 or seams[i-1][sy]
      local right=i==10 and src.width or seams[i][sy]
      for dx=0,255 do
        local sx=math.floor((dx-110)/0.9+anchors[i]+0.5)
        if sx>=0 and sx<src.width and owner(sx,sy)==i then
          local c=src:getPixel(sx,sy)
          local overlap=(i==7 and sx<1040 or i==8 and sx<1218) and sy>=510
          local residue=overlap and pc.rgbaR(c)<pc.rgbaG(c)*1.8+6
          if pc.rgbaA(c)>=32 and not residue then
            frame:drawPixel(dx,dy,pc.rgba(pc.rgbaR(c),pc.rgbaG(c),pc.rgbaB(c),255))
          end
        end
      end
    end
  end
  -- Remove detached residue left by neighboring poses and source speckles.
  local seen={}
  for yy=0,255 do for xx=0,255 do
    local key=yy*256+xx
    if not seen[key] and pc.rgbaA(frame:getPixel(xx,yy))>0 then
      local queue={{xx,yy}}; local head=1; seen[key]=true
      while head<=#queue do
        local p=queue[head]; head=head+1
        for oy=-1,1 do for ox=-1,1 do
          local nx,ny=p[1]+ox,p[2]+oy; local nk=ny*256+nx
          if nx>=0 and nx<256 and ny>=0 and ny<256 and not seen[nk] and pc.rgbaA(frame:getPixel(nx,ny))>0 then
            seen[nk]=true; queue[#queue+1]={nx,ny}
          end
        end end
      end
      if #queue<16 then for _,p in ipairs(queue) do frame:drawPixel(p[1],p[2],0) end end
    end
  end end
  if i>1 then spr:newEmptyFrame() end
  spr:newCel(spr.layers[1],i,frame,Point(0,0))
  spr.frames[i].duration=durations[i]/1000
  frame:saveAs(out..string.format('/barel-attack-%02d.png',i))
  sheet:drawImage(frame,Point((i-1)*256,0))
end
local tag=spr:newTag(1,10); tag.name='basic-attack'; tag.aniDir=AniDir.FORWARD
spr:saveAs(out..'/barel-attack-256.aseprite')
sheet:saveAs(out..'/barel-attack-256-strip.png')
print('Saved ten 256x256 frames, source and strip: '..out)
