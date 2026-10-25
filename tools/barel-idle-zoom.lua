local src=Image{fromFile=assert(app.params.input)}
local out=assert(app.params.output);app.fs.makeAllDirectories(out)
for i,r in ipairs({{175,495,135,70},{175,365,105,130},{380,495,135,70}}) do
  local image=Image(r[3]*5,r[4]*5,ColorMode.RGB)
  for y=0,image.height-1 do for x=0,image.width-1 do
    image:drawPixel(x,y,src:getPixel(r[1]+math.floor(x/5),r[2]+math.floor(y/5)))
  end end
  image:saveAs(out..'/boundary-'..i..'.png')
end
