-- Diagnostic crops only. Never writes production sprites or alters source pixels.
local input=assert(app.params.input)
local out=assert(app.params.output)
app.fs.makeAllDirectories(out)
local source=Image{fromFile=input}
local regions={
  {'F1-F2',155,350,110,170},
  {'F2-F3',350,215,90,300},
  {'F5-F6',965,360,150,165},
  {'F6-F7',1170,370,170,155},
  {'F7-F8',1370,365,180,160},
  {'F8-F9',1590,350,180,175}
}
for _,r in ipairs(regions) do
  local image=Image(r[4],r[5],ColorMode.RGB)
  image:drawImage(source,Point(-r[2],-r[3]))
  image:saveAs(out..'/'..r[1]..'-review.png')
end
print('Saved unchanged diagnostic crops only: '..out)
