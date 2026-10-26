local root=assert(app.params.root)
local folder=root..'/assets/aseprite/barel-knockdown-getup-design-10'
local file=assert(io.open(folder..'/build.json','rb'))
local build=json.decode(file:read('*a'));file:close()
local sprite=Sprite(build.cell[1],build.cell[2],ColorMode.RGB)
sprite.layers[1].name='Barel - knockdown and getup'
for i,frame in ipairs(build.frames) do
  if i>1 then sprite:newEmptyFrame() end
  local image=Image{fromFile=folder..'/'..frame.file}
  sprite:newCel(sprite.layers[1],i,image,Point(0,0))
  sprite.frames[i].duration=frame.durationMs/1000
end
for _,tag in ipairs({{'knockdown_getup',1,10},{'knockdown',1,6},{'getup',7,10}}) do
  local result=sprite:newTag(tag[2],tag[3]);result.name=tag[1];result.aniDir=AniDir.FORWARD
end
sprite:saveAs(folder..'/barel-knockdown-getup-design-10.aseprite')
print('Saved 10-frame Barel knockdown/getup Aseprite')
