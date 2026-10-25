local src=Image{fromFile=assert(app.params.input)}
local out=assert(app.params.output);app.fs.makeAllDirectories(out)
for i,r in ipairs({{160,425,130,125},{1040,420,130,130},{1270,435,145,125},{1500,445,150,115},{1720,425,140,130}}) do
  local image=Image(r[3]*4,r[4]*4,ColorMode.RGB)
  for y=0,image.height-1 do for x=0,image.width-1 do
    image:drawPixel(x,y,src:getPixel(r[1]+math.floor(x/4),r[2]+math.floor(y/4)))
  end end
  image:saveAs(out..'/overlap-'..i..'.png')
end
