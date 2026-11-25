-- Editable, standalone pixel assets inspired by the selected HUD concept.
local out = assert(app.params.output)
local C = {clear=0, ink=0xff080609, dark=0xff151014, iron=0xff302a2d,
  mid=0xff595054, light=0xff897e80, shine=0xffc1b5ae, red=0xff53131f,
  ruby=0xffac2735, white=0xffdfd2bb, blue=0xff9b4b0b}
local function image(w,h) return Image(w,h,ColorMode.RGB) end
local function rect(im,x,y,w,h,c)
  c=app.pixelColor.rgba((c >> 16) & 255,(c >> 8) & 255,c & 255,(c >> 24) & 255)
  for yy=y,y+h-1 do for xx=x,x+w-1 do
    if xx>=0 and yy>=0 and xx<im.width and yy<im.height then im:drawPixel(xx,yy,c) end
  end end
end
local function frame(w,h,transparent)
  local im=image(w,h)
  rect(im,3,0,w-6,h,C.ink); rect(im,0,3,w,h-6,C.ink)
  rect(im,3,2,w-6,h-4,C.mid); rect(im,2,4,w-4,h-8,C.mid)
  rect(im,4,3,w-8,h-6,C.dark); rect(im,3,5,w-6,h-10,C.dark)
  rect(im,6,4,w-12,1,C.light); rect(im,5,5,1,h-10,C.iron)
  rect(im,6,h-5,w-12,1,C.iron)
  if transparent then rect(im,6,6,w-12,h-12,C.clear) end
  for _,x in ipairs({4,w-6}) do for _,y in ipairs({3,h-5}) do rect(im,x,y,2,2,C.light) end end
  return im
end
local function gem(im,x,y)
  rect(im,x-1,y-3,3,7,C.red); rect(im,x-3,y-1,7,3,C.red)
  rect(im,x,y-2,1,5,C.ruby); rect(im,x-2,y,5,1,C.ruby); rect(im,x,y,1,1,C.white)
end
local function save(name,im)
  local s=Sprite(im.width,im.height,ColorMode.RGB)
  s.layers[1].name=name
  s:newCel(s.layers[1],1,im,Point(0,0))
  s:saveAs(out .. '/' .. name .. '.aseprite')
  s:saveCopyAs(out .. '/' .. name .. '.png')
  s:close()
end
local assets={}
assets.portrait_frame=frame(56,56,true)
assets.name_plate=frame(150,22,false)
gem(assets.name_plate,75,11)
assets.player_bar_frame=frame(150,14,false)
assets.skill_slot=frame(32,32,false)
assets.scroll_slot=frame(28,32,false)
assets.pause_frame=frame(30,30,false)
rect(assets.pause_frame,11,8,3,14,C.white); rect(assets.pause_frame,17,8,3,14,C.white)
assets.boss_portrait_frame=frame(56,56,true)
assets.boss_name_plate=frame(174,22,false)
assets.boss_bar_frame=frame(344,18,false)
gem(assets.boss_bar_frame,172,2)
local function fill(w,h,colors)
  local im=image(w,h)
  for y=0,h-1 do
    local color=colors[math.min(#colors,math.floor(y*#colors/h)+1)]
    rect(im,0,y,w,1,color)
  end
  rect(im,0,0,1,h,C.ink); rect(im,w-1,0,1,h,C.ink)
  return im
end
assets.hp_fill=fill(138,6,{0xfff55a62,0xffdd303e,0xffad1d2c,0xff6f101d})
assets.mana_fill=fill(138,6,{0xff5cc4ff,0xff208be8,0xff1257bd,0xff0c327e})
assets.boss_hp_fill=fill(332,10,{0xffeb525c,0xffd02b39,0xffa51a29,0xff74101c,0xff470b13})
local scroll=image(20,22)
rect(scroll,6,3,10,16,0xff604027); rect(scroll,7,3,8,16,0xffb68a58)
rect(scroll,8,4,6,14,0xffe2c68d); rect(scroll,7,9,8,4,0xff5d1421)
rect(scroll,8,9,7,2,0xffb32833); rect(scroll,5,2,4,4,0xffefdbab)
rect(scroll,13,16,4,4,0xffead4a1); rect(scroll,14,18,2,2,0xff8d6841)
assets.scroll_icon=scroll
for name,im in pairs(assets) do save(name,im) end
-- Presentation only; live text, portraits, icons and gauges remain separate.
local p=image(640,360)
rect(p,0,0,640,360,0xff312626)
for y=0,359,16 do rect(p,0,y,640,1,0xff463537) end
for x=0,639,32 do rect(p,x,0,1,360,0xff3b2c2e) end
local function put(name,x,y) p:drawImage(assets[name],Point(x,y)) end
put('portrait_frame',12,12); put('name_plate',70,12)
put('player_bar_frame',70,36); put('hp_fill',76,40)
put('player_bar_frame',70,52); put('mana_fill',76,56)
for i=0,2 do put('scroll_slot',224+i*28,33) end
put('scroll_icon',228,38); put('scroll_icon',256,38)
for i=0,4 do put('skill_slot',70+i*33,70) end
put('pause_frame',598,12)
put('boss_portrait_frame',100,287); put('boss_name_plate',158,303)
put('boss_bar_frame',158,329); put('boss_hp_fill',164,333)
save('preview_composition',p)
print('Created editable HUD assets in '..out)
