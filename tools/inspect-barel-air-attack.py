"""Read-only component inspection of the supplied aerial slash sheet."""
from pathlib import Path
from PIL import Image
im=Image.open(Path(__file__).resolve().parents[1]/'assets/aseprite/barel-air-attack-10/source/original.png').convert('RGBA')
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
