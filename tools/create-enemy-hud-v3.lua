-- Standalone enemy HUD sprites in the compact common-v3 palette.
local out=assert(app.params.output)
local function rgba(hex)
  return app.pixelColor.rgba((hex >> 16) & 255,(hex >> 8) & 255,hex & 255,(hex >> 24) & 255)
end
local function rect(im,x,y,w,h,hex)
  local c=rgba(hex)
  for yy=y,y+h-1 do for xx=x,x+w-1 do
    if xx>=0 and yy>=0 and xx<im.width and yy<im.height then im:drawPixel(xx,yy,c) end
  end end
end
local function save(name,im)
  local s=Sprite(im.width,im.height,ColorMode.RGB)
  s.layers[1].name=name
  s:newCel(s.layers[1],1,im,Point(0,0))
  s:saveAs(out..'/'..name..'.aseprite')
  s:saveCopyAs(out..'/'..name..'.png')
  s:close()
end
local frame=Image(96,12,ColorMode.RGB)
rect(frame,2,0,92,12,0xff080609); rect(frame,0,2,96,8,0xff080609)
rect(frame,3,1,90,10,0xff595054); rect(frame,1,3,94,6,0xff595054)
rect(frame,4,2,88,8,0xff151014); rect(frame,2,4,92,4,0xff151014)
rect(frame,6,2,84,1,0xff897e80); rect(frame,6,9,84,1,0xff302a2d)
rect(frame,2,2,2,2,0xff897e80); rect(frame,92,2,2,2,0xff897e80)
save('enemy_health_frame',frame)
local fill=Image(84,4,ColorMode.RGB)
local reds={0xfff55a62,0xffd52d3b,0xffaa1c2b,0xff6f101d}
for y=0,3 do rect(fill,0,y,84,1,reds[y+1]) end
save('enemy_health_fill',fill)
local plate=Image(72,14,ColorMode.RGB)
rect(plate,2,0,68,14,0xff080609); rect(plate,0,2,72,10,0xff080609)
rect(plate,3,1,66,12,0xff595054); rect(plate,2,3,68,8,0xff151014)
rect(plate,5,2,62,1,0xff897e80); rect(plate,5,11,62,1,0xff302a2d)
save('enemy_name_plate',plate)
local preview=Image(320,100,ColorMode.RGB)
rect(preview,0,0,320,100,0xff312626)
for y=0,99,16 do rect(preview,0,y,320,1,0xff463537) end
for x=0,319,32 do rect(preview,x,0,1,100,0xff3b2c2e) end
preview:drawImage(plate,Point(28,20)); preview:drawImage(frame,Point(100,21)); preview:drawImage(fill,Point(106,25))
preview:drawImage(plate,Point(28,56)); preview:drawImage(frame,Point(100,57))
local partial=Image(42,4,ColorMode.RGB)
partial:drawImage(fill,Point(0,0))
preview:drawImage(partial,Point(106,61))
save('enemy_hud_preview',preview)
print('Created enemy HUD assets in '..out)
