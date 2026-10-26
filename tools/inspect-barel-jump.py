"""Read-only contour inspection for the preserved jump dot source."""
from pathlib import Path
from PIL import Image
im=Image.open(Path(__file__).resolve().parents[1]/'assets/aseprite/barel-jump-10/source/original.png').convert('RGBA')
a=im.getchannel('A');w,h=im.size
points={(x,y) for y in range(h) for x in range(w) if a.getpixel((x,y))>=32};groups=[]
while points:
    q=[points.pop()];at=0
    while at<len(q):
        x,y=q[at];at+=1
        for p in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            if p in points:points.remove(p);q.append(p)
    if len(q)>1500:groups.append((len(q),[min(x for x,y in q),min(y for x,y in q),max(x for x,y in q)+1,max(y for x,y in q)+1]))
print(im.size,sorted(groups,key=lambda g:g[1][0]))
z=0;vz=9.6;trace=[]
for n in range(1,38):
    z+=vz;vz-=.55
    if z<=0:z=vz=0
    trace.append({'tick':n,'z':round(z,5),'vz':round(vz,5)})
    if z==0:break
print(trace)
