-- 순검정 배경을 '같은 색 전체 선택'으로 지우면서 함께 지워진 캐릭터의 검은 픽셀(외곽선, 깊은 음영)을 복원한다.
--   1) 몸 안쪽의 닫힌 투명 영역(maxhole 미만) → 어두운 색으로 채움
--   2) 외곽으로 뚫린 좁은 홈(모폴로지 닫기, 반경 closer) → 어두운 색
--   3) 밝은 픽셀이 투명에 바로 닿아 '잘린' 가장자리 → 바깥에 1px 외곽선 (outline=1)
-- 사용:
--   aseprite -b --script-param src=in.png --script-param outdir=DIR --script-param name=NAME \
--     [--script-param cell=384] [--script-param maxhole=100000] [--script-param closer=2] \
--     [--script-param outline=1] [--script-param outlinelum=35] [--script-param dark=7,3,3] \
--     --script tools/fill-sprite-holes.lua
local src = app.params.src
local outdir = app.params.outdir
local name = app.params.name
local CELL = tonumber(app.params.cell or "384")
local MAXHOLE = tonumber(app.params.maxhole or "100000")
local CLOSE_R = tonumber(app.params.closer or "2")
local OUTLINE = (app.params.outline or "1") == "1"
local OUTLINE_LUM = tonumber(app.params.outlinelum or "35")
local dr, dg, db = (app.params.dark or "7,3,3"):match("(%d+),(%d+),(%d+)")
local pc = app.pixelColor
local DARK = pc.rgba(tonumber(dr), tonumber(dg), tonumber(db), 255)

local sheet = Image{ fromFile = src }
local W, H = sheet.width, sheet.height
local function idx(x, y) return y * W + x end

local real = {}
for y = 0, H - 1 do
  for x = 0, W - 1 do
    real[idx(x, y)] = pc.rgbaA(sheet:getPixel(x, y)) > 0
  end
end

-- 0) 모폴로지 닫기: 외곽선이 지워져 바깥으로 뚫린 좁은 홈까지 '몸 안쪽'으로 본다
local disk = {}
for dy = -CLOSE_R, CLOSE_R do
  for dx = -CLOSE_R, CLOSE_R do
    if dx * dx + dy * dy <= CLOSE_R * CLOSE_R + CLOSE_R then disk[#disk + 1] = { dx, dy } end
  end
end
local function morph(m, dilate)
  local out = {}
  for y = 0, H - 1 do
    for x = 0, W - 1 do
      local v = not dilate
      for _, d in ipairs(disk) do
        local nx, ny = x + d[1], y + d[2]
        local s = (nx >= 0 and nx < W and ny >= 0 and ny < H) and m[idx(nx, ny)] or false
        if dilate and s then v = true; break end
        if not dilate and not s then v = false; break end
      end
      out[idx(x, y)] = v
    end
  end
  return out
end
local solid = real
if CLOSE_R > 0 then solid = morph(morph(real, true), false) end

-- 1) 바깥과 이어진 투명 영역 (4방향 flood fill)
local outside, stack = {}, {}
local function push(x, y)
  local i = idx(x, y)
  if not solid[i] and not outside[i] then outside[i] = true; stack[#stack + 1] = i end
end
for x = 0, W - 1 do push(x, 0); push(x, H - 1) end
for y = 0, H - 1 do push(0, y); push(W - 1, y) end
while #stack > 0 do
  local i = stack[#stack]; stack[#stack] = nil
  local x, y = i % W, i // W
  if x > 0 then push(x - 1, y) end
  if x < W - 1 then push(x + 1, y) end
  if y > 0 then push(x, y - 1) end
  if y < H - 1 then push(x, y + 1) end
end

-- 2) 몸 안쪽 투명 픽셀 = 홈(solid인데 실제로 투명) + 닫힌 영역(maxhole 미만)
local holeImg = Image(W, H, ColorMode.RGB)
local filled = {}
local notchPx, holePx, holeCount, keptGaps = 0, 0, 0, 0
for i, v in pairs(solid) do
  if v and not real[i] then filled[i] = true; notchPx = notchPx + 1 end
end
local seen = {}
for y = 0, H - 1 do
  for x = 0, W - 1 do
    local i = idx(x, y)
    if not solid[i] and not outside[i] and not seen[i] then
      local comp, st = {}, { i }
      seen[i] = true
      while #st > 0 do
        local j = st[#st]; st[#st] = nil
        comp[#comp + 1] = j
        local jx, jy = j % W, j // W
        for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }) do
          local nx, ny = jx + d[1], jy + d[2]
          if nx >= 0 and nx < W and ny >= 0 and ny < H then
            local k = idx(nx, ny)
            if not solid[k] and not outside[k] and not seen[k] then seen[k] = true; st[#st + 1] = k end
          end
        end
      end
      if #comp < MAXHOLE then
        holeCount = holeCount + 1; holePx = holePx + #comp
        for _, j in ipairs(comp) do filled[j] = true end
      else
        keptGaps = keptGaps + 1
      end
    end
  end
end
for i in pairs(filled) do holeImg:drawPixel(i % W, i // W, DARK) end

-- 3) 잘린 가장자리 외곽선: 밝은 픽셀이 바깥 투명에 4방향으로 닿으면 그 바깥 칸을 어둡게
local lineImg = Image(W, H, ColorMode.RGB)
local linePx = 0
if OUTLINE then
  local function lum(c) return 0.3 * pc.rgbaR(c) + 0.59 * pc.rgbaG(c) + 0.11 * pc.rgbaB(c) end
  for y = 0, H - 1 do
    for x = 0, W - 1 do
      local i = idx(x, y)
      if not real[i] and not filled[i] then
        for _, d in ipairs({ { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }) do
          local nx, ny = x + d[1], y + d[2]
          if nx >= 0 and nx < W and ny >= 0 and ny < H and real[idx(nx, ny)]
              and lum(sheet:getPixel(nx, ny)) > OUTLINE_LUM then
            lineImg:drawPixel(x, y, DARK); linePx = linePx + 1
            break
          end
        end
      end
    end
  end
end

-- 4) 평탄화한 시트 PNG
local fixed = Image(sheet)
fixed:drawImage(holeImg, Point(0, 0))
fixed:drawImage(lineImg, Point(0, 0))
fixed:saveAs(outdir .. "/" .. name .. ".png")

-- 5) 작업용 .aseprite: 프레임별, 아래부터 "외곽선 복원" / "구멍 메움" / "원본"
local cols, rows = W // CELL, H // CELL
local spr = Sprite(CELL, CELL, ColorMode.RGB)
local lineLayer = spr.layers[1]; lineLayer.name = "외곽선 복원"
local holeLayer = spr:newLayer(); holeLayer.name = "구멍 메움"
local origLayer = spr:newLayer(); origLayer.name = "원본"
for _ = 2, cols * rows do spr:newEmptyFrame() end
local f = 1
for r = 0, rows - 1 do
  for c = 0, cols - 1 do
    local rect = Rectangle(c * CELL, r * CELL, CELL, CELL)
    spr:newCel(origLayer, f, Image(sheet, rect), Point(0, 0))
    spr:newCel(holeLayer, f, Image(holeImg, rect), Point(0, 0))
    spr:newCel(lineLayer, f, Image(lineImg, rect), Point(0, 0))
    spr.frames[f].duration = 0.1
    f = f + 1
  end
end
spr:saveAs(outdir .. "/" .. name .. ".aseprite")

print(string.format("enclosed=%d (%dpx) notch=%dpx outline=%dpx keptGaps=%d",
  holeCount, holePx, notchPx, linePx, keptGaps))
