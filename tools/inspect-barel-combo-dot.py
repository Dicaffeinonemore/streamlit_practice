"""Read-only component and alpha inspection of preserved dot combo sheets."""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
for i in range(3):
    im=Image.open(root/f'assets/aseprite/barel-combo{i}-dot-10/source/original.png').convert('RGBA')
    a=im.getchannel('A');w,h=im.size
    occupied={(x,y) for y in range(h) for x in range(w) if a.getpixel((x,y))>=32};groups=[]
    while occupied:
        q=[occupied.pop()];at=0
        while at<len(q):
            x,y=q[at];at+=1
            for p in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                if p in occupied:occupied.remove(p);q.append(p)
        if len(q)>1500:groups.append((len(q),[min(x for x,y in q),min(y for x,y in q),max(x for x,y in q)+1,max(y for x,y in q)+1]))
    print(i,im.size,a.getbbox(),sorted(groups,key=lambda g:g[1][0]))
