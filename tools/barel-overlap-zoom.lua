local src=Image{fromFile=assert(app.params.input)}
local out=assert(app.params.output);app.fs.makeAllDirectories(out)
for i,r in ipairs({{95,410,165,145},{1030,425,145,130},{1260,450,155,110},{1490,450,160,110},{1710,430,155,130},{1850,410,170,140}}) do
  local im=Image(r[3]*4,r[4]*4,ColorMode.RGB)
  for y=0,im.height-1 do for x=0,im.width-1 do
    im:drawPixel(x,y,src:getPixel(r[1]+math.floor(x/4),r[2]+math.floor(y/4)))
  end end
  im:saveAs(out..'/overlap-'..i..'.png')
end
