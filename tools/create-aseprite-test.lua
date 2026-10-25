-- Copy only Barel combo0 from the existing atlas. Never write to game assets.
local root = assert(app.params.root)
local output = assert(app.params.output)
local existing = io.open(output, "rb")
if existing then existing:close(); error("Refusing to overwrite source: " .. output) end
local file = assert(io.open(root .. "/assets/barel/frames.json", "rb"))
local frames = json.decode(file:read("*a")).combo0
file:close()
local atlas = Image{ fromFile=root .. "/assets/barel/atlas.png" }
local ax, ay, right = 0, 0, 0
for _, frame in ipairs(frames) do
  ax = math.max(ax, frame.anchor[1])
  ay = math.max(ay, frame.anchor[2])
  right = math.max(right, frame.atlas[3] - frame.anchor[1])
end
local sprite = Sprite(ax + right, ay, ColorMode.RGB)
sprite.layers[1].name = "Barel basic attack - test copy"
-- Deliberately varied sample timing; this does not change combat timing.
local durations = {100, 80, 60, 90, 110, 160}
for i, frame in ipairs(frames) do
  if i > 1 then sprite:newEmptyFrame() end
  local rect = frame.atlas
  local tile = Image(rect[3], rect[4], ColorMode.RGB)
  tile:drawImage(atlas, Point(-rect[1], -rect[2]))
  sprite:newCel(sprite.layers[1], i, tile, Point(ax-frame.anchor[1], ay-frame.anchor[2]))
  sprite.frames[i].duration = durations[i] / 1000
end
local tag = sprite:newTag(1, #frames)
tag.name = "basic-attack"
tag.aniDir = AniDir.FORWARD
sprite:saveAs(output)
print("Created test-only source: " .. output)
sprite:close()
