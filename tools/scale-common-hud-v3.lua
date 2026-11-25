-- Create smaller, independently editable copies using nearest-neighbor pixels.
local source=assert(app.params.source)
local output=assert(app.params.output)
local names={'portrait_frame','name_plate','player_bar_frame','skill_slot','scroll_slot',
  'pause_frame','boss_portrait_frame','boss_name_plate','boss_bar_frame','hp_fill',
  'mana_fill','boss_hp_fill','scroll_icon'}
local assets={}
local function save(name,im)
  local s=Sprite(im.width,im.height,ColorMode.RGB)
  s.layers[1].name=name
  s:newCel(s.layers[1],1,im,Point(0,0))
  s:saveAs(output..'/'..name..'.aseprite')
  s:saveCopyAs(output..'/'..name..'.png')
  s:close()
end
for _,name in ipairs(names) do
  local src=Image{fromFile=source..'/'..name..'.png'}
  local w=math.max(1,math.floor(src.width*0.75+0.5))
  local h=math.max(1,math.floor(src.height*0.75+0.5))
  local dest=Image(w,h,ColorMode.RGB)
  for y=0,h-1 do for x=0,w-1 do
    dest:drawPixel(x,y,src:getPixel(math.floor(x*src.width/w),math.floor(y*src.height/h)))
  end end
  assets[name]=dest
  save(name,dest)
end
local preview=Image(640,360,ColorMode.RGB)
local function color(r,g,b) return app.pixelColor.rgba(r,g,b,255) end
for y=0,359 do for x=0,639 do
  local c=color(49,38,38)
  if y%16==0 then c=color(70,53,55) elseif x%32==0 then c=color(59,44,46) end
  preview:drawPixel(x,y,c)
end end
local function put(name,x,y) preview:drawImage(assets[name],Point(x,y)) end
put('portrait_frame',12,12); put('name_plate',56,12)
put('player_bar_frame',56,30); put('hp_fill',61,33)
put('player_bar_frame',56,42); put('mana_fill',61,45)
for i=0,2 do put('scroll_slot',172+i*21,28) end
put('scroll_icon',175,32); put('scroll_icon',196,32)
for i=0,4 do put('skill_slot',56+i*25,56) end
put('pause_frame',605,12)
put('boss_portrait_frame',100,307); put('boss_name_plate',144,313)
put('boss_bar_frame',144,332); put('boss_hp_fill',149,335)
save('preview_composition',preview)
print('Created 75% HUD copies in '..output)
