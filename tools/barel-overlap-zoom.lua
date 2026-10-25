local src=Image{fromFile=assert(app.params.input)}
local out=assert(app.params.output);app.fs.makeAllDirectories(out)
for i,r in ipairs({{970,395,140,125},{1190,415,145,110},{1410,415,150,110},{1620,410,140,110},{1770,390,160,130}}) do
  local im=Image(r[3]*4,r[4]*4,ColorMode.RGB)
  for y=0,im.height-1 do for x=0,im.width-1 do
    im:drawPixel(x,y,src:getPixel(r[1]+math.floor(x/4),r[2]+math.floor(y/4)))
  end end
  im:saveAs(out..'/overlap-'..i..'.png')
end
