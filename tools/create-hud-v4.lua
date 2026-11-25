-- HUD v4: dark-fantasy player / boss HUD, drawn at final 1x size for the 960x540 game screen.
-- Usage (from the repo root):
--   Aseprite.exe --batch --script-param output=assets/aseprite/ui/hud-v4 --script tools/create-hud-v4.lua
-- Writes <name>.aseprite (frames, tags, 9-slice) + <name>.png (horizontal frame strip) per asset,
-- hud-v4.gpl (palette) and hud-v4.json (sizes, frames, tags, slice centers, key font order, layout).
-- No text, numbers, portraits or skill icons are baked in: the game draws those.
local out = assert(app.params.output, 'pass --script-param output=<dir>')

-- 24-colour palette ---------------------------------------------------------------------------
local ORDER = {'ink','iron0','iron1','iron2','iron3','iron4','steel',
  'gold0','gold1','gold2','blood0','blood1','blood2','blood3','blood4',
  'soul0','soul1','soul2','soul3','parch0','parch1','bone','wine','navy'}
local PAL = {ink='080609', iron0='151014', iron1='241d21', iron2='3a3236', iron3='5a5055',
  iron4='8a7f80', steel='c1b5ae', gold0='5e4520', gold1='9a7434', gold2='d4b06a',
  blood0='3d0a12', blood1='74101c', blood2='ad1d2c', blood3='dd303e', blood4='f55a62',
  soul0='0c1a3e', soul1='1257bd', soul2='3e8fe8', soul3='8fd0ff', parch0='8d6841',
  parch1='e2c68d', bone='f0dfcf', wine='2a0a10', navy='0a1226'}
local function rgb(name)
  local h = assert(PAL[name], name)
  return tonumber(h:sub(1,2),16), tonumber(h:sub(3,4),16), tonumber(h:sub(5,6),16)
end
local function C(name, a) local r,g,b = rgb(name); return app.pixelColor.rgba(r,g,b,a or 255) end

-- Drawing helpers -----------------------------------------------------------------------------
local function new(w,h) return Image(w,h,ColorMode.RGB) end
local function px(im,x,y,c) if x>=0 and y>=0 and x<im.width and y<im.height then im:drawPixel(x,y,c) end end
local function rect(im,x,y,w,h,c) for yy=y,y+h-1 do for xx=x,x+w-1 do px(im,xx,yy,c) end end end
local function hline(im,x,y,w,c) rect(im,x,y,w,1,c) end
local function vline(im,x,y,h,c) rect(im,x,y,1,h,c) end
-- One rectangular ring, `i` pixels inside the box: top/left in `tl`, bottom/right in `br`.
local function ring(im,bx,by,bw,bh,i,tl,br,chamfer)
  local x0,y0,x1,y1 = bx+i, by+i, bx+bw-1-i, by+bh-1-i
  local s = chamfer and 1 or 0
  hline(im,x0+s,y0,x1-x0+1-2*s,tl); vline(im,x0,y0+s,y1-y0+1-2*s,tl)
  hline(im,x0+s,y1,x1-x0+1-2*s,br); vline(im,x1,y0+s,y1-y0+1-2*s,br)
end
-- Blackened-iron frame: ink outline (chamfered), 3-tone bevel lit from the top-left, optional
-- trim ring, ink inner shadow. Returns the interior inset.
local function box(im,bx,by,bw,bh,o)
  o = o or {}
  ring(im,bx,by,bw,bh,0,C'ink',C'ink',true)
  ring(im,bx,by,bw,bh,1,C(o.hi or 'iron3'),C(o.lo or 'iron1'))
  hline(im,bx+2,by+1,bw-4,C(o.shine or 'iron4'))
  local i = 2
  if o.trim then ring(im,bx,by,bw,bh,2,C(o.trim[1]),C(o.trim[2])); i = 3 end
  ring(im,bx,by,bw,bh,i,C'ink',C'ink')
  if o.fill then rect(im,bx+i+1,by+i+1,bw-2*i-2,bh-2*i-2,C(o.fill)) end
  return i + 1
end
-- Masks: procedural shapes with outline and edge shading.
local function mask(w,h,fn)
  local m = {w=w,h=h}
  for y=0,h-1 do m[y] = {}; for x=0,w-1 do m[y][x] = fn(x,y) and true or false end end
  return m
end
local function inside(M,x,y) return x>=0 and y>=0 and x<M.w and y<M.h and M[y][x] end
local function paint(im,ox,oy,M,colour,outline)
  for y=0,M.h-1 do for x=0,M.w-1 do
    if M[y][x] then px(im,ox+x,oy+y,colour(x,y,M))
    elseif outline and (inside(M,x-1,y) or inside(M,x+1,y) or inside(M,x,y-1) or inside(M,x,y+1)) then
      px(im,ox+x,oy+y,outline)
    end
  end end
end
local function shade(hi,mid,lo)
  return function(x,y,M)
    local tl = not inside(M,x-1,y) or not inside(M,x,y-1)
    local br = not inside(M,x+1,y) or not inside(M,x,y+1)
    if tl and not br then return C(hi) elseif br and not tl then return C(lo) end
    return C(mid)
  end
end
local function diamond(w,h,cx,cy,rx,ry)
  return mask(w,h,function(x,y) return math.abs(x-cx)/rx + math.abs(y-cy)/ry <= 1 end)
end
local function grid(im,ox,oy,rows,key)
  for y,row in ipairs(rows) do for x=1,#row do
    local ch = row:sub(x,x)
    if key[ch] then px(im,ox+x-1,oy+y-1,key[ch]) end
  end end
end
local GOLD = {'gold2','gold1','gold0'}
local BLOOD = {'blood4','blood2','blood0'}
local IRON = {'iron4','iron2','iron1'}
-- Gem / stud: shaded diamond with an ink outline, glint at the top-left.
local function gem(im,cx,cy,r,metal)
  local s = 2*r+3
  local M = diamond(s,s,r+1,r+1,r+0.5,r+0.5)
  paint(im,cx-r-1,cy-r-1,M,shade(metal[1],metal[2],metal[3]),C'ink')
end
-- Riveted 7x7 corner cap.
local function cornerCap(im,x,y,metal,rivet)
  rect(im,x+1,y,5,7,C'ink'); rect(im,x,y+1,7,5,C'ink')
  rect(im,x+1,y+1,5,5,C(metal[2]))
  hline(im,x+1,y+1,5,C(metal[1])); vline(im,x+1,y+1,5,C(metal[1]))
  hline(im,x+1,y+5,5,C(metal[3])); vline(im,x+5,y+1,5,C(metal[3]))
  px(im,x+3,y+3,C(rivet or metal[1])); px(im,x+4,y+4,C(metal[3]))
end
-- Crescent (the black-moon motif): disc minus an offset disc, shaded.
local function crescent(w,h,cx,cy,r,ox,oy,r2)
  return mask(w,h,function(x,y)
    local a = (x-cx)^2 + (y-cy)^2 <= r*r
    local b = (x-cx-ox)^2 + (y-cy-oy)^2 <= r2*r2
    return a and not b
  end)
end

-- Assets --------------------------------------------------------------------------------------
local assets, order = {}, {}
local function add(name,frames,extra)
  local a = extra or {}
  a.name, a.frames = name, frames
  assets[name] = a; order[#order+1] = name
end

do
  local im = new(202,88)
  box(im,0,0,202,88,{fill='iron0',trim={'gold0','iron1'}})
  hline(im,5,57,192,C'ink')
  hline(im,5,58,192,C'iron2')
  for i=0,3 do
    px(im,4+i*2,83-i,C'iron3')
    px(im,197-i*2,83-i,C'iron2')
  end
  add('player_panel',{im})
end

-- Player portrait frame 44x44: iron + gold trim, riveted gold corners, crescent badge.
local function portraitFrame(trim, cap, rivet, badge)
  local im = new(44,44)
  box(im,0,0,44,44,{trim=trim})
  for _,c in ipairs({{0,0},{37,0},{0,37},{37,37}}) do cornerCap(im,c[1],c[2],cap,rivet) end
  badge(im)
  rect(im,4,4,36,36,0)
  return im
end
add('portrait_frame',{portraitFrame({'gold1','gold0'},GOLD,'gold2',function(im)
  local M = crescent(13,9,6,0,6.4,0,-2.6,5.9)
  paint(im,15,36,M,shade('gold2','gold1','gold0'),C'ink')
end)},{inner={4,4,36,36}})
add('boss_portrait_frame',{portraitFrame({'blood2','blood0'},IRON,'blood3',function(im)
  gem(im,21,40,3,BLOOD)
  gem(im,21,3,2,BLOOD)
end)},{inner={4,4,36,36}})

-- Halo for buffs, drawn behind the portrait frame at (-4,-4); two frames pulse.
do
  local frames = {}
  for f,alphas in ipairs({{150,90,40},{220,140,70}}) do
    local im = new(52,52)
    for y=0,51 do for x=0,51 do
      local dx = math.max(4-x, x-47, 0); local dy = math.max(4-y, y-47, 0)
      local d = math.max(dx,dy) + ((dx>0 and dy>0) and 1 or 0)
      if d>=1 and d<=3 then px(im,x,y,C('gold2',alphas[d])) end
    end end
    frames[f] = im
  end
  add('buff_glow',frames,{tags={{'pulse',1,2}},duration=180,offset={-4,-4}})
end

-- Plates: iron, dark interior, a hairline of trim under the bevel, an end ornament on the left.
local function plate(w,h,hair,ornament)
  local im = new(w,h)
  box(im,0,0,w,h,{fill='iron0'})
  hline(im,3,2,w-6,C(hair))
  hline(im,3,3,w-6,C'iron1')
  if ornament then ornament(im,h) end
  return im
end
add('name_plate',{plate(150,16,'gold0',nil)},{center={4,4,142,8},text={7,4}})
add('score_plate',{plate(97,12,'gold0',nil)},{center={4,4,89,4},text={6,4}})
add('boss_name_plate',{plate(150,16,'blood1',function(im,h) gem(im,5,7,4,BLOOD) end)},
  {center={11,4,135,8},text={12,3}})

-- Lives: a small crescent (the black moon).
do
  local im = new(9,9)
  local M = crescent(9,9,4,4,3.6,1.9,-1.3,3.1)
  paint(im,0,0,M,shade('bone','gold2','gold1'),C'ink')
  add('life_icon',{im})
end

-- Bar frames: interior transparent (draw track, lag and fill first, the frame on top).
local function barFrame(w,h)
  local im = new(w,h)
  box(im,0,0,w,h,{})
  px(im,2,2,C'gold1'); px(im,w-3,2,C'gold1'); px(im,2,h-3,C'gold0'); px(im,w-3,h-3,C'gold0')
  return im
end
add('player_bar_frame',{barFrame(150,10)},{center={3,3,144,4},fill={3,3,144,4}})

-- Gauges: horizontally uniform so the game can crop them to the ratio.
local function strip(w,rows,decorate)
  local im = new(w,#rows)
  for y,c in ipairs(rows) do hline(im,0,y-1,w,C(c)) end
  if decorate then decorate(im,w,#rows) end
  return im
end
local function ticks(colour) return function(im,w,h)
  for q=1,3 do vline(im,math.floor(w*q/4),1,h-1,C(colour)) end
end end
add('hp_fill',{strip(144,{'blood4','blood3','blood2','blood1'})})
add('sp_fill',{strip(144,{'soul3','soul2','soul1','soul0'})})
add('hp_lag_fill',{strip(144,{'gold2','gold1','gold1','gold0'})})
add('hp_track',{strip(144,{'blood0','wine','wine','wine'},ticks('blood0'))})
add('sp_track',{strip(144,{'soul0','navy','navy','navy'},ticks('soul0'))})
add('bar_track',{strip(144,{'iron2','iron0','iron0','iron1'},ticks('iron2'))})
add('boss_hp_fill',{strip(374,{'blood3','blood2','blood2','blood1','blood1','blood1','blood0','blood0'},
  function(im,w) for x=0,w-1 do if x%7==0 then px(im,x,3,C'blood2') end; if x%7==3 then px(im,x,5,C'blood0') end end end)})
add('boss_lag_fill',{strip(374,{'gold2','gold1','gold1','gold1','gold0','gold0','gold0','gold0'})})
add('boss_track',{strip(374,{'blood0','wine','wine','wine','wine','wine','wine','wine'},ticks('blood0'))})

-- Boss bar: iron channel with spearhead end caps (iron, gold core, ruby).
do
  local w,h = 400,14
  local im = new(w,h)
  box(im,6,0,w-12,h,{})
  local cap = mask(13,h,function(x,y) return math.abs(x-6)/5.6 + math.abs(y-6.5)/6.2 <= 1 end)
  local core = mask(13,h,function(x,y) return math.abs(x-6)/2.6 + math.abs(y-6.5)/4.2 <= 1 end)
  for _,cx in ipairs({0,w-13}) do
    paint(im,cx,0,cap,shade('iron4','iron2','iron1'),C'ink')
    paint(im,cx,0,core,shade('gold2','gold1','gold0'),nil)
    px(im,cx+6,6,C'blood4'); px(im,cx+6,7,C'blood2')
  end
  local thorn = {".g...", "..g..", "...gg"}
  local mirror = {}
  for i,row in ipairs(thorn) do mirror[i] = row:reverse() end
  grid(im,8,0,thorn,{g=C'gold0'})
  grid(im,w-13,0,mirror,{g=C'gold0'})
  add('boss_bar_frame',{im},{center={14,3,372,8},fill={13,3,374,8}})
end
-- Phase pips: lit ruby / spent iron.
do
  local on, off = new(7,7), new(7,7)
  local M = diamond(7,7,3,3,2.5,2.5)
  paint(on,0,0,M,shade('blood4','blood3','blood1'),C'ink')
  paint(off,0,0,M,shade('iron3','iron1','iron0'),C'ink')
  add('boss_phase_pip',{on,off},{tags={{'on',1,1},{'off',2,2}}})
end
do
  local im = new(3,12)
  rect(im,0,0,3,12,C'ink'); vline(im,1,1,10,C'bone'); px(im,1,1,C'gold2')
  add('boss_groggy_marker',{im})
end

-- Slots. Skill interior and cooldown mask are 20x20.
local function slot(w,h)
  local im = new(w,h)
  local i = box(im,0,0,w,h,{fill='iron0'})
  px(im,2,2,C'gold1'); px(im,w-3,2,C'gold1'); px(im,2,h-3,C'gold0'); px(im,w-3,h-3,C'gold0')
  return im
end
add('skill_slot',{slot(26,26)},{inner={3,3,20,20}})
add('scroll_slot',{slot(16,18)},{inner={2,2,12,14}})
do
  local rows = {
    '.kkkkkkkk.',
    'kwppppppdk',
    'kddddddddk',
    '.kwppppdk.',
    '.kwppppdk.',
    '.kwprrpdk.',
    '.kwpRRpdk.',
    '.kwppRpdk.',
    '.kwppppdk.',
    'kwppppppdk',
    'kddddddddk',
    '.kkkkkkkk.'}
  local full, empty = new(12,14), new(12,14)
  grid(full,1,1,rows,{k=C'ink',w=C'bone',p=C'parch1',d=C'parch0',r=C'blood2',R=C'blood1'})
  grid(empty,1,1,rows,{k=C'ink',w=C'iron3',p=C'iron2',d=C'iron1',r=C'iron1',R=C'iron1'})
  add('scroll_icon',{full}); add('scroll_icon_empty',{empty})
end
-- Key cap 9x8: gold bevel, 5x5 glyph at (2,2).
do
  local im = new(9,8)
  ring(im,0,0,9,8,0,C'ink',C'ink',true)
  ring(im,0,0,9,8,1,C'gold1',C'gold0')
  hline(im,2,1,5,C'gold2')
  rect(im,2,2,5,5,C'iron0')
  add('skill_keycap',{im},{glyph={2,2}})
end
do
  local im = new(20,20)
  for y=0,19 do for x=0,19 do
    px(im,x,y,((x+y)%4==0) and C('iron1',205) or C('ink',175))
  end end
  add('skill_cooldown_mask',{im})
end
-- 5x5 key glyphs, 6px pitch, in KEYS order.
local KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
local GLYPHS = {
  A={'.###.','#...#','#####','#...#','#...#'}, B={'####.','#...#','####.','#...#','####.'},
  C={'.####','#....','#....','#....','.####'}, D={'####.','#...#','#...#','#...#','####.'},
  E={'#####','#....','####.','#....','#####'}, F={'#####','#....','####.','#....','#....'},
  G={'.####','#....','#..##','#...#','.####'}, H={'#...#','#...#','#####','#...#','#...#'},
  I={'#####','..#..','..#..','..#..','#####'}, J={'..###','...#.','...#.','#..#.','.##..'},
  K={'#...#','#..#.','###..','#..#.','#...#'}, L={'#....','#....','#....','#....','#####'},
  M={'#...#','##.##','#.#.#','#...#','#...#'}, N={'#...#','##..#','#.#.#','#..##','#...#'},
  O={'.###.','#...#','#...#','#...#','.###.'}, P={'####.','#...#','####.','#....','#....'},
  Q={'.###.','#...#','#.#.#','#..#.','.##.#'}, R={'####.','#...#','####.','#..#.','#...#'},
  S={'.####','#....','.###.','....#','####.'}, T={'#####','..#..','..#..','..#..','..#..'},
  U={'#...#','#...#','#...#','#...#','.###.'}, V={'#...#','#...#','#...#','.#.#.','..#..'},
  W={'#...#','#...#','#.#.#','##.##','#...#'}, X={'#...#','.#.#.','..#..','.#.#.','#...#'},
  Y={'#...#','.#.#.','..#..','..#..','..#..'}, Z={'#####','...#.','..#..','.#...','#####'},
  ['0']={'.###.','#..##','#.#.#','##..#','.###.'}, ['1']={'..#..','.##..','..#..','..#..','.###.'},
  ['2']={'####.','....#','.###.','#....','#####'}, ['3']={'####.','....#','.###.','....#','####.'},
  ['4']={'#..#.','#..#.','#####','...#.','...#.'}, ['5']={'#####','#....','####.','....#','####.'},
  ['6']={'.###.','#....','####.','#...#','.###.'}, ['7']={'#####','....#','...#.','..#..','..#..'},
  ['8']={'.###.','#...#','.###.','#...#','.###.'}, ['9']={'.###.','#...#','.####','....#','.###.'}}
do
  local im = new(#KEYS*6,5)
  for i=1,#KEYS do grid(im,(i-1)*6,0,GLYPHS[KEYS:sub(i,i)],{['#']=C'bone'}) end
  add('key_font',{im},{glyph_size={5,5},pitch=6,chars=KEYS})
end
-- Pause button 26x26: normal / pressed.
do
  local function pause(pressed)
    local im = new(26,26)
    if pressed then box(im,0,0,26,26,{hi='iron1',lo='iron3',shine='iron1',fill='ink'})
    else box(im,0,0,26,26,{fill='iron0'}) end
    px(im,2,2,C'gold1'); px(im,23,2,C'gold1'); px(im,2,23,C'gold0'); px(im,23,23,C'gold0')
    local dy = pressed and 1 or 0
    for _,x in ipairs({9,14}) do
      rect(im,x-1,7+dy,5,12,C'ink')
      rect(im,x,8+dy,3,10,C(pressed and 'iron4' or 'steel'))
      hline(im,x,8+dy,3,C(pressed and 'steel' or 'bone'))
    end
    return im
  end
  add('pause_frame',{pause(false),pause(true)},{tags={{'normal',1,1},{'pressed',2,2}}})
end

-- Layout for the 960x540 screen (positions are each asset's top-left).
local LAYOUT = {
  player = {panel={12,12,202,88}, portrait_frame={15,15}, portrait={19,19,36,36}, buff_glow={11,11},
    name_plate={60,13,150,16}, name_text={67,18}, life_icon={182,16}, lives_text={193,18},
    hp_frame={60,29,150,10}, hp_fill={63,32,144,4}, sp_frame={60,40,150,10}, sp_fill={63,43,144,4},
    scroll_slots={{60,51},{77,51},{94,51}}, scroll_icon_offset={2,2},
    score_plate={113,54,97,12}, score_text={148,58}, level_text_right={208,58},
    skill_slots={{42,72},{71,72},{100,72},{129,72},{158,72}}, skill_icon_offset={5,2}, keycap_offset={8,18}},
  pause = {pause_frame={922,12}},
  boss = {portrait_frame={258,480}, portrait={262,484,36,36}, name_plate={306,484,190,16},
    name_text={318,489}, bar_frame={304,503,400,14}, bar_fill={317,506,374,8},
    phase_plate={620,484,84,16}, phase_pips={{683,489},{692,489}}, tag_text={628,489}, groggy_marker_y=504},
}

-- Output --------------------------------------------------------------------------------------
local pal = Palette(#ORDER + 1)
pal:setColor(0, Color{r=0,g=0,b=0,a=0})
for i,name in ipairs(ORDER) do local r,g,b = rgb(name); pal:setColor(i, Color{r=r,g=g,b=b,a=255}) end
local function save(a)
  local w,h = a.frames[1].width, a.frames[1].height
  local s = Sprite(w,h,ColorMode.RGB)
  app.activeSprite = s
  s:setPalette(pal)
  s.layers[1].name = a.name
  for i,im in ipairs(a.frames) do
    if i > 1 then s:newEmptyFrame(i) end
    s:newCel(s.layers[1],i,im,Point(0,0))
    if a.duration then s.frames[i].duration = a.duration/1000 end
  end
  for _,t in ipairs(a.tags or {}) do local tag = s:newTag(t[2],t[3]); tag.name = t[1] end
  if a.center then
    local sl = s:newSlice(Rectangle(0,0,w,h)); sl.name = a.name
    sl.center = Rectangle(a.center[1],a.center[2],a.center[3],a.center[4])
  end
  s:saveAs(out..'/'..a.name..'.aseprite')
  local sheet = new(w*#a.frames,h)
  for i,im in ipairs(a.frames) do sheet:drawImage(im,Point((i-1)*w,0)) end
  sheet:saveAs(out..'/'..a.name..'.png')
  s:close()
end
for _,name in ipairs(order) do save(assets[name]) end

local gpl = io.open(out..'/hud-v4.gpl','w')
gpl:write('GIMP Palette\nName: hud-v4\nColumns: 8\n#\n')
for _,name in ipairs(ORDER) do local r,g,b = rgb(name); gpl:write(string.format('%3d %3d %3d\t%s\n',r,g,b,name)) end
gpl:close()

local function json(v, indent)
  indent = indent or ''
  local t = type(v)
  if t == 'number' then return string.format('%d', v) end
  if t == 'string' then return '"'..v..'"' end
  if t == 'boolean' then return tostring(v) end
  if #v > 0 then
    local flat = true
    for _,x in ipairs(v) do if type(x) == 'table' then flat = false end end
    local parts = {}
    for _,x in ipairs(v) do parts[#parts+1] = json(x, indent..'  ') end
    if flat then return '['..table.concat(parts,',')..']' end
    return '[\n'..indent..'  '..table.concat(parts,',\n'..indent..'  ')..'\n'..indent..']'
  end
  local keys = {}
  for k in pairs(v) do keys[#keys+1] = k end
  table.sort(keys)
  local parts = {}
  for _,k in ipairs(keys) do parts[#parts+1] = indent..'  "'..k..'": '..json(v[k], indent..'  ') end
  return '{\n'..table.concat(parts,',\n')..'\n'..indent..'}'
end
local manifest = {version=4, screen={960,540}, palette=ORDER, layout=LAYOUT, assets={}}
for _,name in ipairs(order) do
  local a = assets[name]
  local entry = {size={a.frames[1].width,a.frames[1].height}, frames=#a.frames}
  for _,k in ipairs({'center','fill','inner','text','glyph','glyph_size','pitch','chars','offset','duration'}) do
    if a[k] then entry[k] = a[k] end
  end
  if a.tags then
    entry.tags = {}
    for _,t in ipairs(a.tags) do entry.tags[t[1]] = {t[2]-1,t[3]-1} end
  end
  manifest.assets[name] = entry
end
local f = io.open(out..'/hud-v4.json','w')
f:write(json(manifest)..'\n')
f:close()
print('hud-v4: wrote '..#order..' assets to '..out)

-- Optional preview. This is the only output containing live text or game art.
if not app.params.stage then return end
local capture = Image{fromFile=app.params.stage}
local art = Image{fromFile=assert(app.params.art, 'pass --script-param art=<strip.png>')}
assert(capture.width==960 and capture.height==540, 'Expected a 960x540 gameplay capture')
assert(art.width==152 and art.height==36, 'Expected a 152x36 preview art strip')
local preview = new(960,540)
preview:drawImage(capture,Point(0,0))
local function paste(im,x,y) preview:drawImage(im,Point(x,y)) end
local function crop(im,x,y,w,h)
  local cut = new(w,h)
  cut:drawImage(im,Point(-x,-y))
  return cut
end
local function draw(name,at,frame)
  paste(assets[name].frames[frame or 1],at[1],at[2])
end
local function wide(name,at)
  local a = assets[name]
  local im, center = a.frames[1], a.center
  local x,y,w = at[1],at[2],at[3]
  local left, right = center[1],im.width-center[1]-center[3]
  paste(crop(im,0,0,left,im.height),x,y)
  for col=left,w-right-1,center[3] do
    paste(crop(im,left,0,math.min(center[3],w-right-col),im.height),x+col,y)
  end
  paste(crop(im,im.width-right,0,right,im.height),x+w-right,y)
end
local function label(value,x,y,color,pitch)
  local punctuation = {['.']={'.....','.....','.....','.....','..#..'},
    [',']={'.....','.....','.....','..#..','.#...'},
    ['*']={'.....','.#.#.','..#..','.#.#.','.....'}}
  for i=1,#value do
    local ch = value:sub(i,i)
    grid(preview,x+(i-1)*(pitch or 6),y,GLYPHS[ch] or punctuation[ch] or {},{['#']=C(color)})
  end
end
local function gauge(frame,at,track,track_at,fill_name,ratio,lag_name,lag)
  draw(track,track_at)
  local x,y,w,h = table.unpack(track_at)
  local function partial(name,value)
    local width = math.floor(w*value+0.5)
    if width>0 then paste(crop(assets[name].frames[1],0,0,width,h),x,y) end
  end
  if lag_name then partial(lag_name,lag) end
  partial(fill_name,ratio)
  draw(frame,at)
end

local p = LAYOUT.player
draw('player_panel',p.panel)
rect(preview,p.portrait[1],p.portrait[2],36,36,C'wine')
paste(crop(art,0,0,36,36),p.portrait[1],p.portrait[2])
draw('portrait_frame',p.portrait_frame)
wide('name_plate',p.name_plate)
label('VAREL',p.name_text[1],p.name_text[2],'bone')
draw('life_icon',p.life_icon)
label('*3',p.lives_text[1],p.lives_text[2],'bone')
gauge('player_bar_frame',p.hp_frame,'hp_track',p.hp_fill,'hp_fill',.72,'hp_lag_fill',.78)
gauge('player_bar_frame',p.sp_frame,'sp_track',p.sp_fill,'sp_fill',0)
for i,at in ipairs(p.scroll_slots) do
  draw('scroll_slot',at)
  draw(i<3 and 'scroll_icon' or 'scroll_icon_empty',{at[1]+2,at[2]+2})
end
wide('score_plate',p.score_plate)
label('SCORE',118,58,'iron4',5)
label('53040',p.score_text[1],p.score_text[2],'bone')
vline(preview,183,57,6,C'gold0')
label('LV 4',p.level_text_right[1]-23,p.level_text_right[2],'gold2')
for i,at in ipairs(p.skill_slots) do
  local x,y = at[1],at[2]
  draw('skill_slot',at)
  paste(crop(art,72+(i-1)*16,0,16,16),x+p.skill_icon_offset[1],y+p.skill_icon_offset[2])
  if i==2 then
    draw('skill_cooldown_mask',{x+3,y+2})
    label('2.4',x+4,y+7,'bone')
  end
  local kx,ky=x+p.keycap_offset[1],y+p.keycap_offset[2]
  draw('skill_keycap',{kx,ky})
  label(({'U','H','O','P','L'})[i],kx+2,ky+2,'bone')
end

local b = LAYOUT.boss
rect(preview,b.portrait[1],b.portrait[2],36,36,C'wine')
paste(crop(art,36,0,36,36),b.portrait[1],b.portrait[2])
draw('boss_portrait_frame',b.portrait_frame)
wide('boss_name_plate',b.name_plate)
label('VARGUL, THE FROZEN GRAVELORD',b.name_text[1],b.name_text[2],'bone')
wide('boss_name_plate',b.phase_plate)
label('PHASE II',b.tag_text[1]+5,b.tag_text[2],'gold2')
draw('boss_phase_pip',b.phase_pips[1],2)
draw('boss_phase_pip',b.phase_pips[2],1)
gauge('boss_bar_frame',b.bar_frame,'boss_track',b.bar_fill,'boss_hp_fill',.60,'boss_lag_fill',.65)
draw('boss_groggy_marker',{445,b.groggy_marker_y})
draw('pause_frame',LAYOUT.pause.pause_frame)
preview:saveAs(out..'/preview_composition.png')

local doubled = new(1920,1080)
for y=0,539 do
  for x=0,959 do
    local c = preview:getPixel(x,y)
    rect(doubled,x*2,y*2,2,2,c)
  end
end
doubled:saveAs(out..'/preview_2x.png')
