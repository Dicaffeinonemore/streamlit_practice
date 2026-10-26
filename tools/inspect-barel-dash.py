"""Read-only alpha boundary inspection for the supplied dash sheet."""
from PIL import Image
from pathlib import Path
im=Image.open(Path(__file__).resolve().parents[1]/'assets/aseprite/barel-dash-10/source/original.png').convert('RGBA')
w,h=im.size;a=im.getchannel('A');fg={(x,y) for y in range(h) for x in range(w) if a.getpixel((x,y))>=32}
components=[]
while fg:
    first=fg.pop();q=[first];i=0
    while i<len(q):
        x,y=q[i];i+=1
        for p in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            if p in fg:fg.remove(p);q.append(p)
    if len(q)>500:components.append((len(q),(min(x for x,y in q),min(y for x,y in q),max(x for x,y in q)+1,max(y for x,y in q)+1)))
print(sorted(components,key=lambda c:c[1][0]))
for y0,y1 in [(280,350),(350,410),(410,480),(480,550)]:
    counts=[sum(a.getpixel((x,y))>=128 for y in range(y0,y1)) for x in range(w)]
    runs=[];start=None
    for x,c in enumerate(counts+[0]):
        if c and start is None:start=x
        if not c and start is not None:runs.append((start,x));start=None
    print((y0,y1),[r for r in runs if r[1]-r[0]>5])
