'use strict';
// Coordinates use the supplied 1672 x 941 design; images may be decoded at any resolution.
const VIESA_UI = new Image();
const VIESA_ENEMY_UI = new Image();
VIESA_ENEMY_UI.src=VIESA_ENEMY_UI_SOURCE;
const VIESA_ENEMY_UI_LAYOUT={right:8,top:56,width:190,artWidth:2020,artHeight:778};
const viesaUI = { ready: false, atlas: null, hud: null };
VIESA_UI.onload = () => {
  const atlas=document.createElement('canvas');atlas.width=1672;atlas.height=941;
  atlas.getContext('2d').drawImage(VIESA_UI,0,0,1672,941);viesaUI.atlas=atlas;
  const hud=document.createElement('canvas');hud.width=1672;hud.height=720;
  const c=hud.getContext('2d');
  c.drawImage(atlas,0,80,1672,550,0,80,1672,550);
  c.drawImage(atlas,0,630,910,90,0,630,910,90);viesaUI.hud=hud;
  // The five icons retain their vine frame; key labels are live remappable DOM text.
  document.querySelectorAll('#skillbar .skillbtn').forEach((button,i)=>{
    const tile=document.createElement('canvas');tile.width=148;tile.height=260;
    const t=tile.getContext('2d');
    t.drawImage(atlas,932+i*140,635,148,260,0,0,148,260);
    t.fillStyle='#05111e';t.fillRect(20,66,45,37);
    button.style.setProperty('--viesa-icon',`url("${tile.toDataURL()}")`);
  });
  viesaUI.ready=true;
};
VIESA_UI.src=VIESA_UI_SOURCE;
function drawViesaUI(p){
  if(!viesaUI.ready)return false;
  const scale=390/1672;
  ctx.save();ctx.translate(3,20);ctx.scale(scale,scale);ctx.translate(0,-80);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(viesaUI.hud,0,0);
  for(const [y,h,ratio,dark,sampleWidth] of [[314,48,p.hp/p.max,'#290508',500],[400,48,p.sp/SP_MAX,'#031329',270]]){
    const amount=695*clamp(ratio,0,1);
    ctx.save();ctx.beginPath();ctx.roundRect(425,y,695,h,24);ctx.clip();
    ctx.fillStyle=dark;ctx.fillRect(425,y,695,h);
    if(amount>0)ctx.drawImage(viesaUI.atlas,445,y,sampleWidth,h,425,y,amount,h);
    ctx.restore();
  }
  for(let i=0;i<3;i++){
    if(i>=p.mg){ctx.fillStyle='rgba(5,9,16,.87)';ctx.fillRect(1176+i*123,323,113,128);}
    if(i>=p.lives){
      ctx.save();ctx.beginPath();ctx.ellipse(480+i*142,600,48,48,0,0,Math.PI*2);ctx.clip();
      ctx.fillStyle='rgba(5,9,16,.92)';ctx.fillRect(420+i*142,540,120,120);ctx.restore();
    }
  }
  if(p.buff>0){
    ctx.fillStyle='#132813';ctx.fillRect(110,510,180,7);
    ctx.fillStyle='#b7ec89';ctx.fillRect(110,510,180*clamp(p.buff/900,0,1),7);
  }
  ctx.restore();pxText(`score ${p.score}`,6,14,'#ffe1a0',11);return true;
}

function drawViesaEnemyBar(e){
  if(!VIESA_ENEMY_UI.complete||!VIESA_ENEMY_UI.naturalWidth)return false;
  const portrait=enemyHUDPortrait(e);
  if(!portrait)return false;
  const {right,top,width,artWidth,artHeight}=VIESA_ENEMY_UI_LAYOUT;
  const scale=width/artWidth,x=W-right-width;
  ctx.save();ctx.translate(x,top);ctx.scale(scale,scale);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(VIESA_ENEMY_UI,0,0,artWidth,artHeight);
  // Keep the leaf/jewel frame; the portrait belongs to the enemy actually hit.
  ctx.save();ctx.beginPath();ctx.ellipse(321,386,174,174,0,0,Math.PI*2);ctx.clip();
  const background=ctx.createRadialGradient(321,350,20,321,386,180);
  background.addColorStop(0,'#173a62');background.addColorStop(1,'#030c1b');
  ctx.fillStyle=background;ctx.fillRect(140,205,362,362);
  ctx.imageSmoothingEnabled=false;ctx.drawImage(portrait,147,212,348,348);ctx.restore();
  // Clip the original glossy red artwork rather than scaling a partial sample bar.
  const bx=580,by=422,bw=1288,bh=88;
  const ratio=clamp(e.hp/e.max,0,1),lag=clamp(lagTo(e,'hpLag',e.hp,e.max*.01)/e.max,0,1);
  ctx.save();ctx.beginPath();ctx.roundRect(bx,by,bw,bh,bh/2);ctx.clip();
  ctx.fillStyle='#200710';ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle='#a75236';ctx.fillRect(bx,by,bw*lag,bh);
  if(ratio>0){
    ctx.beginPath();ctx.rect(bx,by,bw*ratio,bh);ctx.clip();
    ctx.drawImage(VIESA_ENEMY_UI,0,0,artWidth,artHeight);
  }
  ctx.restore();ctx.restore();
  krText(e.d.name,x+1230*scale,top+347*scale,'#e4f1ff',11,'center','#031023');
  return true;
}
