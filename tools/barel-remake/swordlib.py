import numpy as np, math
def hx(h): h=h.lstrip("#"); return np.array([int(h[i:i+2],16) for i in (0,2,4)],np.uint8)
OUTL=hx("#0A0A0E")
B0,B1,B2,B3,B4=[hx(c) for c in ("#3A3A44","#6E6E7A","#A6A6B2","#D2D2DA","#F2F2F6")]
L0,L1=hx("#1E1418"),hx("#3A2A2A")
BASE_ANGLE=math.degrees(math.atan2(0.606,0.796))
BASE_GRIP=(107.6,146.4)
def render_sword(cx,cy,angle=BASE_ANGLE,size=256,blade_len=99.0,outline=True,glow=None):
    """grip point (cx,cy) = hand position; angle in degrees, 0 = blade pointing right, + = clockwise (screen)."""
    a=math.radians(angle); d=np.array([math.cos(a),math.sin(a)]); n=np.array([-d[1],d[0]])
    yy,xx=np.mgrid[0:size,0:size].astype(np.float64)+0.5
    gx,gy=cx+10*d[0],cy+10*d[1]          # guard centre is 10px ahead of the grip point
    t=(xx-gx)*d[0]+(yy-gy)*d[1]; u=(xx-gx)*n[0]+(yy-gy)*n[1]
    img=np.zeros((size,size,4),np.uint8)
    def put(m,c): img[m,:3]=c; img[m,3]=255
    # blade
    hw=np.clip((blade_len-t)/12.0,0,1)*4.6
    bl=(t>=1.5)&(t<=blade_len)&(np.abs(u)<=hw)
    put(bl&(u>0.5),B1); put(bl&(u>2.6),B0)
    put(bl&(u<=0.5),B1); put(bl&(u<-1.6),B2); put(bl&(np.abs(u)<=0.5)&(t>6),B3); put(bl&(u<-3.4),B4)
    # guard (flared, pointed ends)
    ga=np.abs(u); gt=np.where(ga>10.5,2.2-(ga-10.5)*0.25,1.6)
    gd=(np.abs(t)<=gt)&(ga<=14.0)
    put(gd,B1); put(gd&(t<0),B3); put(gd&(t<-1.0)&(ga>9),B4)
    # grip
    gp=(t<-1.5)&(t>=-20.5)&(np.abs(u)<=1.55)
    put(gp,L1); put(gp&(u>0.4),L0)
    for r in (-6,-11,-16): put(gp&(np.abs(t-r)<=0.5),L0)
    # pommel (diamond)
    pm=(np.abs(t+23.5)+np.abs(u))<=3.6
    put(pm,B1); put(pm&((t+23.5)+u<0),B2); put(pm&(np.abs(t+23.5)+np.abs(u)<=1.0),B3)
    # prune 1px spurs (sub-pixel tip / guard ends) so the silhouette stays clean at any angle
    for _ in range(3):
        a_=img[...,3]>0; p=np.pad(a_,1).astype(np.int8)
        nb=p[:-2,1:-1]+p[2:,1:-1]+p[1:-1,:-2]+p[1:-1,2:]
        spur=a_&(nb<=1)
        if not spur.any(): break
        img[spur]=0
    if outline:
        a_=img[...,3]>0; p=np.pad(a_,1)
        ring=~a_&(p[:-2,1:-1]|p[2:,1:-1]|p[1:-1,:-2]|p[1:-1,2:])
        img[ring,:3]=OUTL; img[ring,3]=255
    return img