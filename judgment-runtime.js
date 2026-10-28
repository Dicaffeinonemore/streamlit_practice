'use strict';
// Both supplied sheets contain 24 frames, six columns by four rows.
const judgmentSources=Object.entries(JUDGMENT_ART).filter(([,src])=>typeof src==='string');
const JUDGMENT_GROUP=GameAssets.group(2,judgmentSources.map(([,src])=>src));
const JUDGMENT_IMAGES=Object.fromEntries(judgmentSources.map(([id],i)=>[id,JUDGMENT_GROUP.images[i]]));
const JUDGMENT_READY=JUDGMENT_GROUP.ready;
function judgmentSprite(id,frame,x,y,width,height,alpha=1){
  const image=JUDGMENT_IMAGES[id];if(!image?.naturalWidth)return false;
  const cw=image.naturalWidth/6,ch=image.naturalHeight/4,index=clamp(Math.floor(frame),0,23);
  ctx.save();ctx.globalAlpha*=alpha;
  const transform=ctx.getTransform();
  ctx.imageSmoothingEnabled=Math.hypot(transform.a,transform.b)*width/cw<2;
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(image,index%6*cw,Math.floor(index/6)*ch,cw,ch,x,y,width,height);ctx.restore();return true;
}
function judgmentMoonFrame(age){
  // Grow from crescent to full moon during the chant, then sustain the last six frames.
  return age<112?Math.min(17,Math.floor(age/112*18)):18+Math.floor((age-112)/3)%6;
}
function drawJudgmentMoon(z){
  const f=z.age/MS,fade=clamp(Math.min(f/10,(z.life-f)/14),0,1);
  const frame=UX.options.flash?judgmentMoonFrame(f):Math.min(18,Math.floor(f/112*18));
  // A 120px cell gives the visible moon the previous effect's roughly 100px height.
  return judgmentSprite('moon',frame,z.x-camX-60,z.y-z.h-60,120,120,fade);
}
function judgmentFieldFrame(z){
  if(!UX.options.flash)return 0;
  const durations=JUDGMENT_ART.fieldDurations,total=durations.reduce((a,b)=>a+b,0);
  let time=z.age%total;
  for(let i=0;i<durations.length;i++){if(time<durations[i])return i;time-=durations[i];}
  return 0;
}
const judgmentFieldPatterns=[];
function judgmentFieldPattern(frame){
  if(judgmentFieldPatterns[frame])return judgmentFieldPatterns[frame];
  const image=JUDGMENT_IMAGES.field;if(!image.naturalWidth)return null;
  // Use only a crack strip between the GIF's baked-in circles, so no false safe holes appear.
  const tile=document.createElement('canvas');tile.width=104;tile.height=198;
  const c=tile.getContext('2d'),sx=frame%6*1280+550,sy=Math.floor(frame/6)*360;
  c.imageSmoothingEnabled=false;
  for(let row=0;row<2;row++)for(let col=0;col<2;col++){
    c.save();c.translate(col?104:0,row?198:0);c.scale(col?-1:1,row?-1:1);
    c.drawImage(image,sx,sy,220,360,0,0,52,99);c.restore();
  }
  return judgmentFieldPatterns[frame]=ctx.createPattern(tile,'repeat');
}
function drawJudgmentField(z){
  const f=z.age/MS,a=f-z.delay,active=a>=0;
  const fade=clamp(Math.min(f/10,(z.life-f)/6),0,1);
  ctx.save();
  // Cut exactly the same ellipses used by updateMorgraHazard, including during eruption.
  ctx.beginPath();ctx.rect(0,GTOP,VW,GBOT-GTOP+12);
  for(const s of z.safe){ctx.moveTo(s.x-camX+42,s.y);ctx.ellipse(s.x-camX,s.y,42,22,0,0,Math.PI*2);}
  ctx.clip('evenodd');
  const glow=ctx.createLinearGradient(0,GTOP,0,GBOT+12);
  const strength=(active?.26:.14)*fade;
  glow.addColorStop(0,`rgba(96,22,166,${strength})`);
  glow.addColorStop(.5,`rgba(175,36,242,${strength})`);
  glow.addColorStop(1,`rgba(69,15,125,${strength})`);
  ctx.fillStyle=glow;ctx.fillRect(0,GTOP,VW,GBOT-GTOP+12);
  const frame=judgmentFieldFrame(z),pattern=judgmentFieldPattern(frame);
  ctx.globalAlpha=(active?1:.78)*fade;
  if(pattern){ctx.fillStyle=pattern;ctx.fillRect(0,GTOP,VW,GBOT-GTOP+12);}
  // Place the GIF rim's glow just outside the original 42 x 22 safe ellipse.
  // The same danger clip keeps its interior clear and prevents a visual/hitbox mismatch.
  const image=JUDGMENT_IMAGES.field;
  if(image.naturalWidth)for(const s of z.safe){
    ctx.imageSmoothingEnabled=true;
    ctx.drawImage(image,frame%6*1280+159,Math.floor(frame/6)*360+80,390,210,
      s.x-camX-195*44/180,s.y-105*24/80,390*44/180,210*24/80);
  }
  ctx.restore();
  // Beams rise above the floor boundary. Only the floor uses the GTOP crop.
  if(active){
    ctx.save();ctx.beginPath();ctx.rect(-100,OY-100,VW+200,VH+200);
    for(const s of z.safe){ctx.moveTo(s.x-camX+42,s.y);ctx.ellipse(s.x-camX,s.y,42,22,0,0,Math.PI*2);}
    ctx.clip('evenodd');
    ctx.globalAlpha=fade;
    for(const y of [GTOP+25,420,480])for(let x=camX+30;x<camX+VW;x+=60){
      if(z.safe.some(s=>Math.abs(x-s.x)<55&&Math.abs(y-s.y)<40))continue;
      paintMorgra(morgraFxFrame('moon_beam',a/6),x,y);
    }
    ctx.restore();
  }
}
