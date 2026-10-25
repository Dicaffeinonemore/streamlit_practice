local src=Image{fromFile=assert(app.params.input)}
local out=assert(app.params.output);app.fs.makeAllDirectories(out)
for i,r in ipairs({{1065,510,140,80},{1280,490,135,100}}) do
  local image=Image(r[3]*5,r[4]*5,ColorMode.RGB)
  for y=0,image.height-1 do for x=0,image.width-1 do
    image:drawPixel(x,y,src:getPixel(r[1]+math.floor(x/5),r[2]+math.floor(y/5)))
  end end
  image:saveAs(out..'/overlap-'..i..'.png')
end
