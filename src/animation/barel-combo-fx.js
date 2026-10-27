(function(root){
  'use strict';
  const art=BAREL_COMBO_FX_ART,image=new Image();
  const ready=new Promise(resolve=>{
    image.onload=()=>resolve(true);image.onerror=()=>resolve(false);
    image.src=art.image;
  });
  function frameFor(actor,tickMs){
    if(!actor||actor.st!=='atk'||actor.characterId&&actor.characterId!=='barel'||
       !['c1','c2','c3'].includes(actor.atk)||!Number.isFinite(actor.t)||actor.t<0||
       !Number.isFinite(tickMs)||tickMs<=0)return null;
    const row=Number(actor.atk.slice(1))-1,a=ATK[actor.atk],elapsed=actor.t*tickMs;
    // The brightest (third) cel begins at the blade's damage window.
    const start=a.wind,peak=a.wind+a.act*.35,end=a.wind+a.act+70;
    if(elapsed<start||elapsed>=end)return null;
    const index=elapsed<peak?Math.min(1,Math.floor((elapsed-start)/(peak-start)*2)):
      Math.min(5,2+Math.floor((elapsed-peak)/(end-peak)*4));
    return {row,index,atlas:[art.columns[index],art.rows[row],
      art.columns[index+1]-art.columns[index],art.rows[row+1]-art.rows[row]],
      anchor:[art.centers[index]-art.columns[index],art.anchorY[row]],
      scale:.42,dx:48,height:row===2?50:55};
  }
  root.BarelComboFx={ready,frameFor,
    draw(actor,tickMs){
      const f=frameFor(actor,tickMs);
      if(!f||!image.complete||!image.naturalWidth)return false;
      const [sx,sy,w,h]=f.atlas,[ax,ay]=f.anchor;
      ctx.save();
      try{
        ctx.translate(actor.x-camX,actor.y-(actor.z||0));ctx.scale(actor.face||1,1);
        ctx.translate(f.dx,-f.height);ctx.scale(f.scale,f.scale);
        if(f.row===2)ctx.scale(-1,1);
        ctx.imageSmoothingEnabled=false;ctx.globalAlpha=UX.options.lowFx?.65:1;
        // The supplied black matte contributes no light; no black rectangle or recoloring.
        ctx.globalCompositeOperation='lighter';
        ctx.drawImage(image,sx,sy,w,h,-ax,-ay,w,h);
      }finally{ctx.restore();}
      return true;
    }
  };
})(globalThis);
