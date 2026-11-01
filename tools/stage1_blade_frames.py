"""Separate the sword bandit's overlapping attack poses without changing source pixels."""
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

PAD_X, PAD_Y = 160, 64

# Sword ownership where the blade extends into the next pose's grid cell.
# Coordinates are in the original 1600x800 sheet, frame numbers are zero-based.
SWORDS = {
    'atk2': [
        (5, [(304,570),(460,570),(460,590),(440,608),(304,610)]),
        (6, [(654,610),(802,620),(802,646),(778,660),(654,645)]),
        (7, [(905,520),(995,475),(995,520),(940,585),(905,585)]),
    ],
}


def seam(mask, axis, guide, radius):
    """Minimum-ink separator with a soft preference for the nominal boundary."""
    if axis == 0: mask = mask.T
    length, width = mask.shape
    lo, hi = max(1, guide-radius), min(width-2, guide+radius)
    coords = np.arange(lo, hi+1)
    prev = np.abs(coords-guide)*.12
    back = np.empty((length,len(coords)),dtype=np.int8)
    for y in range(length):
        candidates = np.stack((np.r_[np.inf,prev[:-1]]+.35,prev,np.r_[prev[1:],np.inf]+.35))
        choice = candidates.argmin(axis=0)
        back[y] = choice-1
        prev = candidates[choice,np.arange(len(coords))] + mask[y,lo:hi+1]*1000 + np.abs(coords-guide)*.12
    index = int(prev.argmin()); out = np.empty(length,dtype=np.int32)
    for y in range(length-1,-1,-1):
        out[y] = lo+index; index += int(back[y,index])
    return out


def split(image, clip):
    a = np.asarray(image.convert('RGBA'))
    h,w = a.shape[:2]
    assert (w,h)==(1600,800)
    fg = a[:,:,3] >= 32
    # Top-row feet can extend below y=400; find the gap for each column.
    row_edge = seam(fg, 0, 400, 55)
    rows = (np.arange(h)[:,None] >= row_edge[None,:]).astype(np.uint8)
    owner = np.full((h,w),-1,dtype=np.int8)
    for row in (0,1):
        row_mask = fg & (rows == row)
        boundaries = [seam(row_mask,1,320*i,90) for i in range(1,5)]
        xs = np.arange(w)[None,:]
        col = sum((xs >= b[:,None]).astype(np.int8) for b in boundaries)
        owner[rows==row] = (row*5+col)[rows==row]
    for frame, polygon in SWORDS.get(clip,[]):
        m=Image.new('1',(w,h)); ImageDraw.Draw(m).polygon(polygon,fill=1)
        rgb=a[:,:,:3].astype(np.int16)
        # A neighbouring character can lie underneath the blade. Move only
        # metallic pixels and their immediate antialiased edge, not the leg.
        steel=(rgb[:,:,1]>=55) & (np.abs(rgb[:,:,0]-rgb[:,:,1])<32) & (np.abs(rgb[:,:,1]-rgb[:,:,2])<32)
        steel=ndimage.binary_dilation(steel,iterations=6)
        mask=np.asarray(m,dtype=bool) & fg & steel
        owner[mask]=frame
    cells=[]
    for i in range(10):
        row,col=divmod(i,5)
        x0,y0=col*320-PAD_X,row*400-PAD_Y
        cell=np.zeros((400+2*PAD_Y,320+2*PAD_X,4),dtype=np.uint8)
        x1,y1=x0+cell.shape[1],y0+cell.shape[0]
        sx0,sy0=max(0,x0),max(0,y0);sx1,sy1=min(w,x1),min(h,y1)
        section=a[sy0:sy1,sx0:sx1].copy()
        section[owner[sy0:sy1,sx0:sx1]!=i]=0
        cell[sy0-y0:sy1-y0,sx0-x0:sx1-x0]=section
        labels,count=ndimage.label(cell[:,:,3]>=32,structure=np.ones((3,3)))
        if count:
            sizes=np.bincount(labels.ravel());sizes[0]=0
            largest=int(sizes.argmax())
            # Small, detached intruders are never part of these sword poses.
            cell[(labels!=0)&(labels!=largest)&(sizes[labels]<sizes[largest]*.02)]=0
        cells.append(cell)
    return cells
