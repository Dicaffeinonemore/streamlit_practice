'use strict';
// 흑월의 갑주왕 (boss5, v1.38). One flag selects the complete replacement; the
// legacy BLACK MOON EMPEROR (ET.boss5 / runLegacyPat / HD renderer) stays intact.
const USE_SOVEREIGN=globalThis.SOVEREIGN_OVERRIDE!==false;
const SOVEREIGN_SHEETS=USE_SOVEREIGN?SOVEREIGN_ART.sheets.map(src=>{const im=new Image();im.src=src;return im;}):[];
Promise.all(SOVEREIGN_SHEETS.map(im=>im.decode())).catch(()=>{});
const SR=SOVEREIGN_RULES;
let sovereignRemains=[];
function isSovereign(e){return USE_SOVEREIGN&&e?.type==='boss5';}
function sovP(e){return e.p2shown?1:0;}
function sovData(e){
  return e.sov||={now:0,cd:{},last:null,repeats:0,pressure:0,pressureT:0,forceBackhand:false,patterns:[],marks:[],waves:[],fx:[],
    beam:null,giant:null,bodyAct:null,bodyT:0,lastDanger:-999,wasDown:false,rising:false,ultUsed:false,banner:0,rooted:false,
    fists:['F','B'].map(role=>({role,x:e.x,y:e.y,h:340,face:e.face,st:'wait',t:0,hp:SR.fistHp[0],max:SR.fistHp[0],
      ang:0,pose:1,glow:null,flash:0,inv:0,pat:null,hidden:true,shield:false,vh:0}))};
}
function sovereignAttackGap(e){const [a,b]=SR.gaps[sovP(e)];return Math.round(rand(a,b));}
function sovFistSpeed(e){return SR.fistSpeed[sovP(e)];}
function sovBand(lo,hi){const p=player;return p.z+90>=lo&&p.z<=hi;}
function sovHurt(e,damage,kd,fromX,push=0){
  const dir=Math.sign(player.x-fromX)||e.face,hit=hurtPlayer(damage,dir,kd,e);
  if(hit&&push)player.vx=dir*push;
  return hit;
}
function sovFx(e,id,x,y,h,w,hh,life,extra={}){sovData(e).fx.push({id,x,y,h,w,hh,life,age:0,face:1,anchor:'bottom',...extra});}
function fistHome(e,f){
  const s=sovData(e),r=SR.home[f.role];
  const bob=Math.sin((s.now/SR.home.bobPeriod+(f.role==='B'?.5:0))*Math.PI*2)*SR.home.bob;
  return {x:e.x+e.face*r.dx,y:e.y,h:r.h+bob};
}
function moveFist(f,x,y,h,speed){
  const dx=x-f.x,dy=y-f.y,dh=h-f.h,d=Math.hypot(dx,dy*1.5,dh);
  if(d<=speed){f.x=x;f.y=y;f.h=h;return true;}
  f.x+=dx/d*speed;f.y+=dy/d*speed;f.h+=dh/d*speed;return false;
}
function fistHittable(f){return !f.hidden&&f.inv<=0&&['home','pat','recover','return'].includes(f.st);}
function sovBodyDown(e){return e.st==='stun'||e.st==='down'||(e.st==='pat'&&e.pat==='ukneel');}

// ---------------------------------------------------------------- fist life cycle
function dropFist(e,f,state){
  f.st=state;f.pat=null;f.glow=null;f.shield=false;f.hidden=false;f.vh=0;f.ang=0;f.t=state==='fallen'?SR.fallen[sovP(e)]:0;
  if(f.h>220)f.h=220;f.landed=f.h<=10;
}
function riseFist(e,f){
  f.st='rise';f.t=0;f.hp=f.max;f.hidden=false;f.glow=null;f.flash=0;
  sovFx(e,'reform',f.x,f.y,0,70,70,30);sfx('bwave');
}
function breakFist(e,f){
  const s=sovData(e);
  if(f.pat)cancelSovPattern(e,f.pat);
  f.hp=0;dropFist(e,f,'fallen');
  sovFx(e,'fist_shatter',f.x,f.y,f.h,80,80,30,{anchor:'center'});
  floatText(f.x,f.y-f.h-30,'주먹 파괴!','#ff7ac0');
  shake=Math.max(shake,12);hitStop=Math.max(hitStop,6);sfx('bossdie');
  e.gr=Math.min(e.grMax,e.gr+SR.fistGroggy);e.grT=150;
  if(e.gr>=e.grMax&&e.st!=='stun'&&e.st!=='dead'&&!e.phaseT)sovStun(e);
  s.pressure=0;
}
function sovStun(e){
  resetBossFx(e);e.st='stun';e.t=0;e.z=e.vz=e.vx=0;e.gr=e.grMax;e.grT=150;
  shake=Math.max(shake,16);hitStop=Math.max(hitStop,10);sfx('groggy');
  floatText(e.x,e.y-SR.home.F.h-80,'GROGGY!','#ffe14d');
}
function damageSovereignFist(e,f,damage,kd){
  if(f.shield||f.hp<=0)return;
  const dir=player.x<=f.x?1:-1;
  f.hp-=Math.round(damage*(kd?SR.fistKdMul:1));f.flash=6;
  hitStop=Math.max(hitStop,kd?5:3);sfx('hit',kd?2:1);impact(f.x-dir*10,f.y,f.h,kd?2:1,dir);
  floatText(f.x,f.y-f.h-24,Math.round(damage*(kd?SR.fistKdMul:1)),'#ffb3dc');
  if(practice)practiceDone.add(player.st==='skill'?'skill':'attack');
  if(f.hp<=0)breakFist(e,f);
}
function updateSovFists(e){
  const s=sovData(e),spd=sovFistSpeed(e);
  for(const f of s.fists){
    if(f.flash>0)f.flash--;
    if(f.inv>0)f.inv--;
    const home=fistHome(e,f);
    switch(f.st){
      case 'intro':{
        f.t++;const u=Math.min(1,f.t/SR.introFists.fall);
        f.x=home.x;f.y=home.y;f.h=340+(home.h-340)*ease(u);f.face=e.face;
        if(u>=1){f.st='home';sovFx(e,'reform',f.x,f.y,f.h-35,80,80,30);sfx('land');shake=Math.max(shake,8);}
        break;
      }
      case 'home':
        f.x+=(home.x-f.x)*.3;f.y+=(home.y-f.y)*.3;f.h+=(home.h-f.h)*.3;f.face=e.face;f.pose=1;f.ang=0;f.glow=null;break;
      case 'return':
        f.pose=1;f.ang=0;f.glow=null;
        if(moveFist(f,home.x,home.y,home.h,6*spd)){f.st='home';f.face=e.face;}
        break;
      case 'recover':
        if(--f.t<=0)f.st='return';break;
      case 'fallen':case 'down':case 'wreck':
        if(f.h>8){f.vh-=.6;f.h=Math.max(8,f.h+f.vh);}
        if(f.h<=8&&!f.landed){f.landed=true;sfx('land');impact(f.x,f.y,6,1,f.face);
          if(f.st==='wreck')sovFx(e,'fist_shatter',f.x,f.y,20,80,80,30,{anchor:'center'});}
        if(f.st==='fallen'&&--f.t<=0)riseFist(e,f);
        break;
      case 'rise':
        f.t++;f.pose=1;
        if(moveFist(f,home.x,home.y,home.h,f.t<12?2.5:5*spd)&&f.t>=12){f.st='home';f.face=e.face;}
        break;
    }
  }
}

// ---------------------------------------------------------------- patterns
function stageSov(pt,name){pt.stage=name;pt.lt=0;}
function claimFists(pt,list){for(const f of list){f.st='pat';f.pat=pt;f.glow=null;f.shield=false;}pt.fists=list;}
function sovHomeFists(e){return sovData(e).fists.filter(f=>f.st==='home');}
function nearestHomeFist(e){
  return sovHomeFists(e).sort((a,b)=>Math.abs(a.x-player.x)-Math.abs(b.x-player.x))[0];
}
function finishSovPattern(e,pt,state='return'){
  pt.done=true;
  for(const f of pt.fists)if(f.pat===pt){f.pat=null;f.glow=null;f.shield=false;f.ang=0;
    if(f.st==='pat'){f.st=state;if(state==='recover')f.t=SR.recover[sovP(e)];}}
}
function cancelSovPattern(e,pt){
  if(pt.done)return;
  const s=sovData(e),g=player.grab;
  if(g?.sovereign&&g.pt===pt)releaseSovereignGrab();
  if(pt.id==='ultimate'){
    const g2=s.giant;s.giant=null;
    for(const f of pt.fists)if(f.st==='merged'||f.pat===pt){f.x=(g2?.x??e.x)+(f.role==='F'?18:-18);f.y=g2?.y??e.y;f.h=g2?.h??120;dropFist(e,f,'down');}
  }
  if(pt.id==='beam')s.beam=null;
  finishSovPattern(e,pt);
}
function cancelAllSov(e){for(const pt of sovData(e).patterns)cancelSovPattern(e,pt);}
function sovMark(e,pt,x,y,rx,ry,extra={}){const m={x,y,rx,ry,age:0,owner:pt,flash:false,...extra};sovData(e).marks.push(m);return m;}
function inEllipse(x,y,m){return ((player.x-x)/m.rx)**2+((player.y-y)/m.ry)**2<=1;}

const SOV_PATTERNS={
  strike:{
    start(e,pt){const f=nearestHomeFist(e);claimFists(pt,[f]);pt.f=f;pt.dir=Math.sign(player.x-e.x)||e.face;f.glow='white';f.pose=12;stageSov(pt,'warn');},
    tick(e,pt,s){
      const r=SR.strike,f=pt.f,spd=sovFistSpeed(e);
      if(pt.stage==='warn'){
        const home=fistHome(e,f);f.face=pt.dir;f.x=home.x-pt.dir*pt.lt*.6;f.h=home.h+(r.h-home.h)*pt.lt/r.warn;
        if(pt.lt===r.lock){pt.lane=player.y;pt.dir=Math.sign(player.x-f.x)||pt.dir;}
        if(pt.lane!=null)f.y+=(pt.lane-f.y)/Math.max(1,r.warn-pt.lt);
        if(pt.lt>=r.warn-1){f.y=pt.lane??f.y;f.glow=null;f.pose=1;pt.from=f.x;stageSov(pt,'fly');sfx('dash');return;}
      }else if(pt.stage==='fly'){
        const next=clamp(f.x+pt.dir*r.speed*spd,camX+12,camX+VW-12);f.x=next;f.face=pt.dir;s.lastDanger=s.now;
        if(pt.lt%3===0)sovFx(e,'punch_trail',f.x-pt.dir*40,f.y,f.h-14,90,30,14,{face:pt.dir});
        if(!pt.hit&&Math.abs(player.x-f.x)<SR.fistBox.w+12&&Math.abs(player.y-f.y)<SR.fistBox.depth&&sovBand(f.h-SR.fistBox.h,f.h+SR.fistBox.h)&&
          sovHurt(e,r.damage,true,f.x-pt.dir*20)){pt.hit=true;sovFx(e,'fist_impact',player.x,player.y,f.h,70,70,20,{anchor:'center'});}
        if(Math.abs(f.x-pt.from)>=r.range||next===camX+12||next===camX+VW-12){stageSov(pt,'rec');return;}
      }else if(pt.stage==='rec'){
        if(pt.lt>=SR.recover[sovP(e)]){pt.hit=false;stageSov(pt,'back');return;}
      }else if(pt.stage==='back'){
        const dir=Math.sign(e.x-f.x)||-pt.dir;f.x+=dir*r.back*spd;s.lastDanger=s.now;
        if(!pt.hit&&Math.abs(player.x-f.x)<SR.fistBox.w+10&&Math.abs(player.y-f.y)<SR.fistBox.depth&&sovBand(f.h-SR.fistBox.h,f.h+SR.fistBox.h)&&
          sovHurt(e,r.backDamage,false,f.x-dir*20))pt.hit=true;
        if(Math.abs(f.x-e.x)<45){finishSovPattern(e,pt);return;}
      }
      pt.lt++;
    }
  },
  slam:{
    start(e,pt){const f=nearestHomeFist(e);claimFists(pt,[f]);pt.f=f;f.glow='white';pt.mark=sovMark(e,pt,player.x,player.y,SR.slam.rx,SR.slam.ry,{track:true});stageSov(pt,'rise');},
    tick(e,pt,s){
      const r=SR.slam,f=pt.f,m=pt.mark,P=sovP(e);
      f.pose=2;f.ang=0;
      if(pt.stage==='rise'){moveFist(f,m.x,m.y,r.h,9);if(pt.lt>=r.rise){stageSov(pt,'track');return;}}
      if(pt.stage==='rise'||pt.stage==='track'){
        m.x+=clamp(player.x-m.x,-r.trackX,r.trackX);m.y+=clamp(player.y-m.y,-r.trackY,r.trackY);
        if(pt.stage==='track'){moveFist(f,m.x,m.y,r.h,9);if(pt.lt>=r.track[P]){m.flash=true;m.track=false;stageSov(pt,'lock');return;}}
      }else if(pt.stage==='lock'){
        if(pt.lt>=r.lock[P]){f.glow=null;stageSov(pt,'fall');return;}
      }else if(pt.stage==='fall'){
        f.x=m.x;f.y=m.y;f.h=r.h*(1-(pt.lt+1)/r.fall);
        if(pt.lt>=r.fall-1){f.h=6;stageSov(pt,'active');sovImpact(e,m.x,m.y,true);m.dead=true;return;}
      }else if(pt.stage==='active'){
        s.lastDanger=s.now;
        if(!pt.hit&&player.z<40&&inEllipse(m.x,m.y,m)&&sovHurt(e,r.damage,true,m.x))pt.hit=true;
        if(pt.lt>=r.active-1){stageSov(pt,'stuck');return;}
      }else if(pt.stage==='stuck'){
        if(pt.lt>=r.stuck){finishSovPattern(e,pt);return;}
      }
      pt.lt++;
    }
  },
  hammer:{
    start(e,pt){const f=nearestHomeFist(e);claimFists(pt,[f]);pt.f=f;pt.n=0;f.glow='white';stageSov(pt,'aim');},
    tick(e,pt,s){
      const r=SR.hammer,f=pt.f;f.pose=2;
      if(pt.stage==='aim'){
        if(pt.lt===0){pt.hit=false;pt.mark=sovMark(e,pt,player.x,player.y,r.rx,r.ry);}
        const m=pt.mark;m.flash=r.wait-pt.lt<12;
        moveFist(f,m.x,m.y,r.h,12);
        if(pt.lt>=r.wait-1){stageSov(pt,'fall');return;}
      }else if(pt.stage==='fall'){
        const m=pt.mark;f.x=m.x;f.y=m.y;f.h=Math.max(6,f.h-(r.h/r.fall));
        if(pt.lt>=r.fall-1){f.h=6;sovImpact(e,m.x,m.y,pt.n===2);m.dead=true;stageSov(pt,'active');return;}
      }else if(pt.stage==='active'){
        const m=pt.mark;s.lastDanger=s.now;
        if(!pt.hit&&player.z<40&&inEllipse(m.x,m.y,m)&&sovHurt(e,r.damage[pt.n],pt.n===2,m.x))pt.hit=true;
        if(pt.lt>=r.active-1){pt.n++;f.glow=null;stageSov(pt,pt.n<r.hits?'aim':'stuck');if(pt.n<r.hits)f.glow='white';return;}
      }else if(pt.stage==='stuck'){
        if(pt.lt>=r.stuck){finishSovPattern(e,pt);return;}
      }
      pt.lt++;
    }
  },
  grab:{
    start(e,pt){const f=nearestHomeFist(e);claimFists(pt,[f]);pt.f=f;pt.dir=Math.sign(player.x-e.x)||e.face;f.glow='red';f.pose=3;stageSov(pt,'warn');},
    tick(e,pt,s){
      const r=SR.grab,f=pt.f,spd=sovFistSpeed(e);
      if(pt.stage==='warn'){
        const home=fistHome(e,f);f.face=pt.dir;f.pose=3;f.x=home.x-pt.dir*pt.lt*.5;f.h=home.h+(r.h-home.h)*pt.lt/r.warn;
        if(pt.lt===r.lock){pt.lane=player.y;pt.dir=Math.sign(player.x-f.x)||pt.dir;}
        if(pt.lane!=null)f.y+=(pt.lane-f.y)/Math.max(1,r.warn-pt.lt);
        if(pt.lt>=r.warn-1){f.y=pt.lane??f.y;pt.from=f.x;stageSov(pt,'fly');sfx('dash');return;}
      }else if(pt.stage==='fly'){
        const next=clamp(f.x+pt.dir*r.speed*spd,camX+12,camX+VW-12);f.x=next;s.lastDanger=s.now;
        if(pt.lt%3===0)sovFx(e,'punch_trail',f.x-pt.dir*40,f.y,f.h-14,90,30,14,{face:pt.dir});
        const p=player;
        if(!practice&&p.inv<=0&&!['dead','down','special','grabbed'].includes(p.st)&&p.z<40&&
          Math.abs(p.x-f.x)<SR.fistBox.w+6&&Math.abs(p.y-f.y)<SR.fistBox.depth){
          p.st='grabbed';p.t=0;p.grab={sovereign:true,owner:e,fist:f,pt,presses:0,hold:0};
          p.vx=p.vz=p.z=0;p.skill=null;p.combo=p.comboT=p.buf=0;p.walk=false;p.wave=false;clearInput();
          f.pose=4;f.glow=null;sfx('hit',1);impact(p.x,p.y,50,1,pt.dir);stageSov(pt,'hold');return;
        }
        if(Math.abs(f.x-pt.from)>=r.range||next===camX+12||next===camX+VW-12){f.glow=null;finishSovPattern(e,pt,'recover');return;}
      }else if(pt.stage==='hold'){
        const p=player;if(p.grab?.pt!==pt){finishSovPattern(e,pt,'recover');return;}
        s.lastDanger=s.now;f.pose=4;f.x=p.x;f.y=p.y+.2;f.h=50;
        if((p.grab?.hold||0)>=r.hold-14&&!pt.other){
          const o=s.fists.find(x=>x!==f&&x.st==='home');
          if(o){o.st='pat';o.pat=pt;o.glow='white';o.pose=9;pt.fists.push(o);pt.other=o;}
        }
        if(pt.other){const o=pt.other,side=Math.sign(o.x-p.x)||1;o.face=-side;moveFist(o,p.x+side*34,p.y,62,10);}
      }
      pt.lt++;
    }
  },
  clap:{
    start(e,pt){const fs=sovHomeFists(e);claimFists(pt,fs);pt.lane=player.y;pt.cx=player.x;stageSov(pt,'move');},
    tick(e,pt,s){
      const r=SR.clap,[a,b]=pt.fists,left=a.x<=b.x?a:b,right=left===a?b:a;
      if(pt.stage==='move'){
        pt.cx+=clamp(player.x-pt.cx,-4,4);
        const u=(pt.lt+1)/r.move;
        for(const [f,side] of [[left,-1],[right,1]]){moveFist(f,pt.cx+side*r.side,pt.lane+(side<0?-.1:.1),r.h,Math.max(4,Math.hypot(pt.cx+side*r.side-f.x,r.h-f.h)/(r.move-pt.lt)));f.face=-side;f.pose=1;}
        if(u>=1){left.glow=right.glow='white';stageSov(pt,'warn');return;}
      }else if(pt.stage==='warn'){
        if(pt.lt>=r.warn-1){left.glow=right.glow=null;stageSov(pt,'close');sfx('dash');return;}
      }else if(pt.stage==='close'){
        const half=r.side-(r.side-24)*(pt.lt+1)/r.close;left.x=pt.cx-half;right.x=pt.cx+half;s.lastDanger=s.now;
        if(!pt.hit&&Math.abs(player.y-pt.lane)<16&&Math.abs(player.x-pt.cx)<=half+10&&sovBand(r.low,r.high)&&sovHurt(e,r.damage,true,pt.cx))pt.hit=true;
        if(pt.lt>=r.close-1){sovFx(e,'fist_impact',pt.cx,pt.lane,r.h,90,90,22,{anchor:'center'});shake=Math.max(shake,12);sfx('slam');stageSov(pt,'stuck');return;}
      }else if(pt.stage==='stuck'){
        if(pt.lt>=r.stuck){finishSovPattern(e,pt);return;}
      }
      pt.lt++;
    }
  },
  wave:{
    start(e,pt){claimFists(pt,sovHomeFists(e));for(const f of pt.fists)f.glow='white';stageSov(pt,'rise');},
    tick(e,pt,s){
      const r=SR.wave;
      if(pt.stage==='rise'){
        for(const f of pt.fists){f.pose=11;f.h+=(r.h-f.h)/Math.max(1,r.rise-pt.lt);}
        if(pt.lt>=r.rise-1){stageSov(pt,'fall');return;}
      }else if(pt.stage==='fall'){
        for(const f of pt.fists){f.pose=10;f.h=r.h*(1-(pt.lt+1)/r.fall);}
        if(pt.lt>=r.fall-1){
          for(const f of pt.fists){f.h=6;f.glow=null;sovImpact(e,f.x,f.y,false);for(const dir of [-1,1])s.waves.push({x:f.x+dir*20,y:f.y,dir,age:0,hit:false});}
          shake=Math.max(shake,18);stageSov(pt,'stuck');return;
        }
      }else if(pt.stage==='stuck'){
        if(pt.lt>=r.stuck){finishSovPattern(e,pt);return;}
      }
      pt.lt++;
    }
  },
  bulwark:{
    start(e,pt){claimFists(pt,sovHomeFists(e));pt.root=true;for(const f of pt.fists){f.shield=true;f.pose=9;}stageSov(pt,'hold');sfx('bwind');},
    tick(e,pt,s){
      const r=SR.bulwark;
      for(const f of pt.fists){
        const lowSlot=f.role==='F',open=pt.stage==='open';
        moveFist(f,e.x+e.face*(lowSlot?44:50),e.y+(lowSlot?.6:.7),open?16:lowSlot?52:98,open?3:8);f.face=e.face;f.pose=open?1:9;
      }
      if(pt.stage==='hold'&&pt.lt>=r.hold){for(const f of pt.fists)f.shield=false;stageSov(pt,'open');return;}
      if(pt.stage==='open'&&pt.lt>=r.open){pt.root=false;finishSovPattern(e,pt);return;}
      pt.lt++;
    }
  },
  whirl:{
    start(e,pt){claimFists(pt,sovHomeFists(e));pt.root=true;for(const f of pt.fists)f.glow='white';stageSov(pt,'warn');},
    tick(e,pt,s){
      const r=SR.whirl;
      if(pt.stage==='warn'){
        for(const f of pt.fists){const h=fistHome(e,f);f.x=h.x;f.y=h.y;f.h=h.h;}
        if(pt.lt>=r.warn-1){for(const f of pt.fists)f.glow=null;stageSov(pt,'spin');sfx('bwave');return;}
      }else if(pt.stage==='spin'){
        const a=pt.lt/r.ticks*r.turns*Math.PI*2,grow=Math.min(1,pt.lt/10);s.lastDanger=s.now;
        for(const f of pt.fists){
          const t=a+(f.role==='B'?Math.PI:0)+(e.face<0?Math.PI:0);
          f.x=e.x+Math.cos(t)*(80+(r.rx-80)*grow);f.y=e.y+Math.sin(t)*r.ry*grow;f.h=r.h;f.face=-Math.sin(t)>=0?1:-1;f.pose=1;
          if(!pt.hit&&Math.abs(player.x-f.x)<SR.fistBox.w+8&&Math.abs(player.y-f.y)<18&&sovBand(r.low,r.high)&&sovHurt(e,r.damage,false,e.x,r.push))pt.hit=true;
          if(pt.lt%4===0)sovFx(e,'punch_trail',f.x,f.y,f.h-14,70,26,12,{face:f.face});
        }
        if(pt.lt>=r.ticks-1){stageSov(pt,'open');return;}
      }else if(pt.stage==='open'){
        for(const f of pt.fists)f.h=60+Math.sin((pt.lt+(f.role==='B'?9:0))*.35)*10;
        if(pt.lt>=r.open){pt.root=false;finishSovPattern(e,pt);return;}
      }
      pt.lt++;
    }
  },
  backhand:{
    start(e,pt){const f=nearestHomeFist(e);claimFists(pt,[f]);pt.f=f;pt.dir=Math.sign(player.x-e.x)||e.face;f.glow='white';f.pose=9;stageSov(pt,'warn');},
    tick(e,pt,s){
      const r=SR.backhand,f=pt.f;f.face=pt.dir;
      if(pt.stage==='warn'){moveFist(f,e.x+pt.dir*30,e.y+.3,70,8);if(pt.lt>=r.warn-1){f.glow=null;stageSov(pt,'swing');sfx('swing',2);return;}}
      else if(pt.stage==='swing'){
        f.x=e.x+pt.dir*(30+(r.reach-20)*(pt.lt+1)/r.swing);f.h=60;s.lastDanger=s.now;
        const dx=(player.x-e.x)*pt.dir;
        if(!pt.hit&&dx>=-10&&dx<=r.reach+12&&Math.abs(player.y-e.y)<24&&player.z<100&&sovHurt(e,r.damage,false,e.x,r.push))pt.hit=true;
        if(pt.lt>=r.swing-1){finishSovPattern(e,pt,'recover');return;}
      }
      pt.lt++;
    }
  },
  meteor:{
    start(e,pt){claimFists(pt,sovHomeFists(e));pt.n=0;pt.drops=[];for(const f of pt.fists)f.pose=11;stageSov(pt,'rise');sfx('bwind');},
    tick(e,pt,s){
      const r=SR.meteor,[F,B]=[pt.fists.find(f=>f.role==='F'),pt.fists.find(f=>f.role==='B')];
      if(pt.stage==='rise'){
        for(const f of pt.fists){f.h+=14;f.pose=11;if(f.h>300)f.hidden=true;}
        if(pt.lt>=r.rise-1){stageSov(pt,'rain');return;}
      }else if(pt.stage==='rain'){
        if(pt.n<r.marks&&pt.lt%r.every===0){
          const f=pt.n%2?B:F;pt.drops.push({mark:sovMark(e,pt,player.x,player.y,r.rx,r.ry),f,t:0,hit:false});pt.n++;
        }
        for(const d of pt.drops){
          if(d.done)continue;
          d.t++;d.mark.flash=r.delay-d.t<12;
          const left=r.delay-d.t;
          if(left<r.fall&&left>=0){const f=d.f;f.hidden=false;f.x=d.mark.x;f.y=d.mark.y;f.h=300*left/r.fall;f.pose=2;}
          if(left===0){d.f.h=6;sovImpact(e,d.mark.x,d.mark.y,true);sovFx(e,'eruption',d.mark.x,d.mark.y,0,90,110,30);d.mark.dead=true;}
          if(left<=0){
            s.lastDanger=s.now;
            if(!d.hit&&player.z<40&&inEllipse(d.mark.x,d.mark.y,d.mark)&&sovHurt(e,r.damage,true,d.mark.x))d.hit=true;
            if(-left>=r.active-1)d.done=true;
          }
        }
        // A fist about to fall again lifts out of its previous crater first.
        for(const d of pt.drops)if(!d.done&&r.delay-d.t===r.fall)d.f.hidden=true;
        if(pt.n>=r.marks&&pt.drops.every(d=>d.done)){for(const f of pt.fists)f.hidden=false;stageSov(pt,'stuck');return;}
      }else if(pt.stage==='stuck'){
        if(pt.lt>=r.stuck){finishSovPattern(e,pt);return;}
      }
      pt.lt++;
    }
  },
  ultimate:{
    start(e,pt,s){claimFists(pt,sovHomeFists(e));s.ultUsed=true;pt.body=true;stageSov(pt,'merge');sfx('phase2');
      s.giant={x:e.x,y:e.y+.5,h:170,frame:1,face:e.face};},
    tick(e,pt,s){
      const r=SR.ultimate,g=s.giant;if(!g){pt.done=true;return;}
      if(pt.stage==='merge'){
        const u=(pt.lt+1)/r.merge;
        for(const f of pt.fists){moveFist(f,e.x+(f.role==='F'?1:-1)*e.face*30*(1-u),e.y,170,6);if(u>.35)f.st='merged';}
        g.x=e.x;g.y=e.y+.5;g.frame=1+Math.min(2,Math.floor(u*3));
        if(pt.lt>=r.merge-1){
          g.dir=player.x>camX+VW/2?1:-1;g.from=g.dir>0?camX-60:camX+VW+60;g.to=g.dir>0?camX+VW+60:camX-60;
          stageSov(pt,'hover');sfx('bwind');return;
        }
      }else if(pt.stage==='hover'){
        g.frame=3;g.face=g.dir;g.x+=(g.from-g.x)*.25;g.h+=(25-g.h)*.25;g.y+=(((GTOP+GBOT)/2)-g.y)*.2;
        if(pt.lt>=r.hover-1){g.x=g.from;g.h=25;pt.hit=false;stageSov(pt,'sweep');pt.pass=1;sfx('dash');return;}
      }else if(pt.stage==='sweep'){
        g.x+=g.dir*r.speed;s.lastDanger=s.now;
        // Low ground spray instead of a horizontal streak, which read as the helm beam.
        if(pt.lt%4===0){sovFx(e,'ground_wave',g.x-g.dir*50,g.y,0,90,46,16,{face:-g.dir});
          parts.push({x:g.x-g.dir*40,y:g.y+rand(-10,10),z:rand(4,12),vx:-g.dir*rand(1,3),vz:rand(2,5),life:rand(16,26),col:['#3a2a34','#ff498d','#5a4652'][pt.lt%3]});}
        if(!pt.hit&&Math.abs(player.x-g.x)<r.halfWidth&&player.z<r.high&&sovHurt(e,r.damage,true,g.x-g.dir*30))pt.hit=true;
        if((g.x-g.to)*g.dir>=0){
          if(pt.pass===1){pt.pass=2;[g.from,g.to]=[g.to,g.from];g.dir*=-1;g.face=g.dir;pt.hit=false;stageSov(pt,'turn');return;}
          g.x=clamp(g.x,camX+70,camX+VW-70);stageSov(pt,'split');sfx('slam');shake=Math.max(shake,18);
          sovFx(e,'eruption',g.x,g.y,0,140,140,32);return;
        }
      }else if(pt.stage==='turn'){
        if(pt.lt>=19){stageSov(pt,'sweep');sfx('dash');return;}
      }else if(pt.stage==='split'){
        g.frame=6;g.h=Math.max(10,g.h-3);
        if(pt.lt>=19){
          for(const f of pt.fists){f.x=g.x+(f.role==='F'?22:-22);f.y=g.y;f.h=g.h;f.face=g.face;dropFist(e,f,'down');}
          s.giant=null;pt.done=true;
          e.pat='ukneel';s.bodyT=0;return;
        }
      }
      pt.lt++;
    }
  },
};
function sovImpact(e,x,y,heavy){
  sovFx(e,'fist_impact',x,y,4,heavy?110:85,heavy?110:85,22,{anchor:'center'});
  shake=Math.max(shake,heavy?14:9);sfx('slam');
  for(let i=0;i<6;i++)parts.push({x:x+rand(-16,16),y:y+rand(-6,6),z:rand(2,8),vx:rand(-3,3),vz:rand(3,6.5),life:rand(18,30),col:['#2a2228','#4a3a46','#ff498d'][i%3]});
}

// ---------------------------------------------------------------- scheduler
function sovDanger(e,id){
  const d=SR.danger[id];if(!d)return null;
  if(id!=='slam')return d;
  const P=sovP(e),first=SR.slam.rise+SR.slam.track[P]+SR.slam.lock[P]+SR.slam.fall;
  return [first,first+SR.slam.active];
}
// 2-4 rule 1: a new pattern's first judgment must land ≥20 ticks after every earlier one ends.
function sovDangerDelay(e,id){
  const s=sovData(e),d=sovDanger(e,id);if(!d)return 0;
  let end=s.lastDanger;
  for(const pt of s.patterns){
    if(pt.done)continue;const o=sovDanger(e,pt.id);
    if(o&&s.now<pt.start+o[1])end=Math.max(end,pt.start+o[1]);
  }
  if(s.waves.length)end=Math.max(end,s.now);
  return Math.max(0,end+SR.safeGap-(s.now+d[0]));
}
function pickSovereignPattern(e,adx){
  const s=sovData(e),P=sovP(e),active=s.patterns.filter(pt=>!pt.done);
  if(active.length>=SR.maxPatterns[P])return null;
  const home=sovHomeFists(e).length;
  const floorBusy=s.marks.some(m=>!m.dead)||active.some(pt=>SR.floor.includes(pt.id));
  const ok=id=>SR.fists[id]<=home&&!(s.cd[id]>0)&&!(s.last===id&&s.repeats>=2)&&
    !(SR.floor.includes(id)&&floorBusy)&&!(id==='beam'&&active.some(pt=>pt.id==='beam'));
  if(s.forceBackhand&&home&&ok('backhand'))return 'backhand';
  if(P&&e.hp<=e.max*SR.ultimate.hpGate&&!s.ultUsed&&home===2&&!active.length)return 'ultimate';
  const band=adx<SR.near?'near':adx<SR.mid?'mid':'far';
  const options=Object.entries(SR.weights[P][band]).filter(([id])=>ok(id));
  if(P&&s.ultUsed&&!active.length&&ok('ultimate'))options.push(['ultimate',15]);
  if(!options.length)return null;
  let r=Math.random()*options.reduce((n,[,w])=>n+w,0),id=options.at(-1)[0];
  for(const [choice,w] of options)if((r-=w)<0){id=choice;break;}
  return id;
}
function startSovereignPattern(e,id){
  const s=sovData(e);
  s.cd[id]=SR.cooldowns[id];s.repeats=s.last===id?s.repeats+1:1;s.last=id;
  const pt={id,lt:0,stage:null,start:s.now,fists:[],done:false};
  if(id==='backhand'){s.pressure=0;s.forceBackhand=false;}
  else{
    startPat(e,id==='beam'||id==='ultimate'?id:'command');s.bodyT=0;
    if(id!=='beam'&&id!=='ultimate')s.bodyAct={kind:SR.command.lift.includes(id)?'lift':'push'};
  }
  if(id==='beam'){pt.body=true;s.beam={stage:'charge',lt:0,lane:null,hit:false};}
  else SOV_PATTERNS[id].start(e,pt,s);
  s.patterns.push(pt);
}
function chaseSovereign(e){
  const s=sovData(e),p=player,dx=p.x-e.x,dy=p.y-e.y,P=sovP(e);
  if(p.st==='dead')return;
  if(!s.rooted)e.face=dx>=0?1:-1;
  if(e.atkCd<=0&&p.st!=='down'&&p.st!=='grabbed'){
    const id=pickSovereignPattern(e,Math.abs(dx));
    if(id){const delay=sovDangerDelay(e,id);if(delay>0)e.atkCd=delay;else{startSovereignPattern(e,id);return;}}
    else e.atkCd=10;
  }
  if(s.rooted)return;
  const [sx,sy]=SR.walk[P],target=p.x-e.face*95;
  if(Math.abs(target-e.x)>3){e.x+=clamp(target-e.x,-sx,sx);e.walk=true;}
  if(Math.abs(dy)>2){e.y+=clamp(dy,-sy,sy);e.walk=true;}
}
// Body-driven actions (command gesture, helm beam, ultimate, post-ultimate kneel).
function runSovereignPattern(e){
  const s=sovData(e);s.bodyT++;
  if(e.pat==='command'){if(s.bodyT>=SR.command.ticks)endPat(e);return;}
  if(e.pat==='ukneel'){if(s.bodyT>=SR.ultimateKneel)endPat(e);return;}
  if(e.pat==='ultimate'){const pt=s.patterns.find(x=>x.id==='ultimate'&&!x.done);if(!pt&&e.pat==='ultimate')endPat(e);return;}
  if(e.pat==='beam'){
    const r=SR.beam,b=s.beam,pt=s.patterns.find(x=>x.id==='beam'&&!x.done);
    if(!b||!pt){endPat(e);return;}
    if(b.stage==='charge'){
      if(b.lt===r.lock){b.lane=player.y;e.face=player.x>=e.x?1:-1;}
      if(b.lane!=null)e.y+=(b.lane-e.y)/Math.max(1,r.charge-b.lt);
      if(b.lt>=r.charge-1){e.y=b.lane??e.y;b.lane=e.y;b.stage='fire';b.lt=0;sfx('bolt');shake=Math.max(shake,8);return;}
    }else if(b.stage==='fire'){
      s.lastDanger=s.now;
      const p=player;
      if(!b.hit&&(p.x-e.x)*e.face>0&&Math.abs(p.y-b.lane)<=r.depth&&sovBand(r.low,r.high)&&sovHurt(e,r.damage,false,e.x))b.hit=true;
      if(b.lt>=r.fire[sovP(e)]-1){b.stage='recover';b.lt=0;return;}
    }else if(b.lt>=r.recover){pt.done=true;s.beam=null;endPat(e);return;}
    b.lt++;
  }
}
function resetSovereignPattern(e){
  if(!isSovereign(e)||!e.sov)return;
  const s=e.sov;s.bodyAct=null;
  for(const pt of s.patterns)if(pt.body&&!pt.done)cancelSovPattern(e,pt);
}
function interceptSovereignDamage(e){
  if(e.st==='intro'||e.phaseT>0||e.invuln||e.st==='dead')return true;
  const s=sovData(e);
  if(!sovBodyDown(e)&&s.fists.some(f=>f.st==='home')){
    s.pressure++;s.pressureT=120;
    if(s.pressure>=SR.pressure[sovP(e)])s.forceBackhand=true;
  }
  return false;
}

// ---------------------------------------------------------------- player strikes
// Gauntlet hurtboxes are tested before the body; a strike that meets one never reaches the body.
function strikeSovereignFists(o){
  const blocked=new Set();if(!USE_SOVEREIGN)return blocked;
  const x=o.x??player.x,y=o.y??player.y,h=o.h??player.z,face=o.face??player.face,behind=o.behind??8,depth=o.depth??24,B=SR.fistBox;
  for(const e of enemies){
    if(!isSovereign(e)||!e.sov||e.st==='dead'||e.st==='intro')continue;
    const s=e.sov;
    if(s.fists.some(f=>f.shield)&&(x-e.x)*e.face>0){
      const dx=(e.x-x)*face;
      if(dx>=-behind-e.hw&&dx<=o.reach+e.hw&&Math.abs(e.y-y)<depth){
        blocked.add(e);
        if(!o.hitSet?.has(s)){o.hitSet?.add(s);sparks(e.x+e.face*46,e.y,70,9,'#ffd0ee');sfx('hit',0);hitStop=Math.max(hitStop,2);}
        continue;
      }
    }
    for(const f of s.fists){
      if(f.shield||!fistHittable(f)||o.hitSet?.has(f))continue;
      const dx=(f.x-x)*face;
      if(dx<-behind-B.w||dx>o.reach+B.w||Math.abs(f.y-y)>=depth)continue;
      if(f.h+B.h<h+10||f.h-B.h>h+75)continue;
      o.hitSet?.add(f);blocked.add(e);damageSovereignFist(e,f,o.damage,!!o.kd);
      if(o.sp!==false)player.sp=Math.min(SP_MAX,player.sp+(o.kd?8:5));
    }
  }
  return blocked;
}

// ---------------------------------------------------------------- grab
function releaseSovereignGrab(){
  const p=player;if(!p.grab?.sovereign)return;
  p.grab=null;if(p.st==='grabbed'){p.st='free';p.t=0;}p.vx=p.vz=0;clearInput();p.inv=Math.max(p.inv,30);
}
function sovereignGrabEnd(e,g,result){
  const pt=g.pt,f=g.fist,p=player,dir=Math.sign(p.x-e.x)||e.face;
  releaseSovereignGrab();
  if(result==='escape'){
    finishSovPattern(e,pt);f.st='recover';f.t=SR.grab.stun;
    floatText(p.x,p.y-110,'탈출!','#aeeaff');impact(f.x,f.y,f.h,1,dir);
    damageSovereignFist(e,f,SR.grab.fistDamage,false);
  }else{
    p.inv=0;
    if(pt.other){hurtPlayer(SR.grab.backhand,dir,false,e);p.inv=0;impact(p.x,p.y,62,1,dir);}
    hurtPlayer(SR.grab.squeeze,dir,true,e);
    finishSovPattern(e,pt,'recover');
  }
}
function updateSovereignGrab(){
  const p=player,g=p.grab,e=g?.owner;
  if(!g||!e||!enemies.includes(e)||e.st==='dead'||e.phaseT>0||g.pt.done||g.fist.pat!==g.pt){releaseSovereignGrab();return;}
  p.t++;p.walk=false;p.z=p.vz=p.vx=0;dashReq=0;
  for(const code of GORATH_ESCAPE_KEYS)if(hit(code))g.presses++;
  for(const code in pressed)delete pressed[code];
  g.hold++;
  if(g.presses>=SR.grab.presses)sovereignGrabEnd(e,g,'escape');
  else if(g.hold>=SR.grab.hold)sovereignGrabEnd(e,g,'fail');
}

// ---------------------------------------------------------------- per-tick state
function updateSovFx(e){const s=sovData(e);for(const f of s.fx)f.age++;s.fx=s.fx.filter(f=>f.age<f.life);}
function updateSovWaves(e){
  const s=sovData(e),r=SR.wave;
  for(const w of s.waves){
    w.age++;w.x+=w.dir*r.speed;
    if(!w.hit&&Math.abs(player.x-w.x)<16&&player.z<=r.height&&sovHurt(e,r.damage,true,w.x-w.dir*10))w.hit=true;
  }
  s.waves=s.waves.filter(w=>w.x>camX-40&&w.x<camX+VW+40);
}
function beginSovereignTransition(e){
  const s=sovData(e);
  resetBossFx(e);cancelAllSov(e);releaseSovereignGrab();
  s.marks=[];s.waves=[];s.beam=null;s.giant=null;
  for(const f of s.fists)dropFist(e,f,'down');
  e.hp=0;e.phaseT=SR.kneelIn+SR.awaken;s.transitionAge=0;
  e.st='rec';e.t=0;e.z=e.vz=e.vx=0;e.invuln=true;e.gr=0;e.grT=0;
  player.inv=Math.max(player.inv,90);sfx('land');
}
function updateSovereignIntro(e){
  const s=sovData(e);s.now++;e.z=0;
  if(1+Math.floor(introT/MS/SR.intro*16)>=SR.introFists.drawing)
    for(const f of s.fists)if(f.st==='wait'){const h=fistHome(e,f);f.st='intro';f.t=0;f.hidden=false;f.x=h.x;f.y=h.y;f.h=340;}
  updateSovFists(e);updateSovFx(e);
}
function sovereignIntroDuration(e){return isSovereign(e)?SR.intro*MS:vargulIntroDuration(e);}
function updateSovereignState(e){
  if(!isSovereign(e))return false;
  const s=sovData(e);s.now++;
  for(const id in s.cd)if(s.cd[id]>0)s.cd[id]--;
  if(s.pressureT>0&&--s.pressureT===0)s.pressure=0;
  for(const f of s.fists)if(f.st==='wait'||f.st==='intro'){f.st='home';f.hidden=false;}
  updateSovFx(e);
  if(e.phaseT>0){
    const age=s.transitionAge;e.walk=false;e.invuln=true;e.flash=0;
    if(age===SR.kneelIn+Math.floor(SR.awaken*(SR.awakenShake-1)/16)){
      shake=Math.max(shake,22);sfx('phase2');sovFx(e,'eruption',e.x,e.y,0,150,150,36);
    }
    s.transitionAge++;e.phaseT--;
    updateSovFists(e);
    if(!e.phaseT){
      e.p2shown=true;e.max=e.hp=SR.hp[1];e.nextKd=e.max*.75;e.gr=e.grT=0;e.invuln=false;
      e.st='chase';e.atkCd=sovereignAttackGap(e);s.ultUsed=false;s.wasDown=false;s.pressure=0;
      for(const f of s.fists){f.max=SR.fistHp[1];riseFist(e,f);}
      floatText(e.x,e.y-180,'2 페이즈','#ff9ad0');s.banner=90;
    }
    return true;
  }
  if(e.st==='dead'){
    e.t++;e.invuln=true;
    if(!s.deathInit){s.deathInit=true;cancelAllSov(e);releaseSovereignGrab();s.marks=[];s.waves=[];s.beam=null;
      // Fists that sit on the body (merged / mid-pattern) fall beside it so the wreck shows both.
      for(const f of s.fists){if(f.st==='merged'){f.y=e.y;f.h=120;}
        if(Math.abs(f.x-e.x)<40){f.x=e.x+(f.role==='F'?1:-1)*e.face*72;f.y=e.y+(f.role==='F'?6:-6);}
        dropFist(e,f,'wreck');}}
    updateSovFists(e);
    if(e.t===40){sovFx(e,'fist_shatter',e.x,e.y,60,140,140,32,{anchor:'center'});sfx('land');}
    if(e.t>=SR.death+SR.deathHold){
      if(!s.remains){s.remains=true;sovereignRemains.push({x:e.x,y:e.y,face:e.face,fists:s.fists.map(f=>({x:f.x,y:f.y,face:f.face}))});}
      e.remove=true;
    }
    return true;
  }
  const down=sovBodyDown(e);
  if(down&&!s.wasDown){
    s.wasDown=true;cancelAllSov(e);
    for(const f of s.fists)if(f.st!=='fallen')dropFist(e,f,'down');
  }else if(!down&&s.wasDown){
    s.wasDown=false;s.rising=e.st==='rec';
    for(const f of s.fists)if(f.st==='down')riseFist(e,f);
  }
  if(e.st!=='rec')s.rising=false;
  for(const pt of s.patterns)if(!pt.done&&pt.id!=='beam')SOV_PATTERNS[pt.id].tick(e,pt,s);
  s.patterns=s.patterns.filter(pt=>!pt.done);
  s.marks=s.marks.filter(m=>!m.dead&&!m.owner.done);
  for(const m of s.marks)m.age++;
  s.rooted=s.patterns.some(pt=>pt.root);
  updateSovWaves(e);
  updateSovFists(e);
  // Both gauntlets broken at once: immediate groggy, once per double break.
  if(s.fists.every(f=>f.st==='fallen')){if(!s.doubleBreak&&!down){s.doubleBreak=true;sovStun(e);s.wasDown=true;}}
  else s.doubleBreak=false;
  if(s.banner>0)s.banner--;
  if(e.st!=='pat')e.invuln=false;
  return false;
}

// ---------------------------------------------------------------- drawing
function paintSov(frame,x,y,face=1,alpha=1,add=false,angle=0){
  const im=frame&&SOVEREIGN_SHEETS[frame.sheet];if(!im?.naturalWidth)return false;
  const [sx,sy,w,h]=frame.atlas,[ax,ay]=frame.anchor,d=1/SOVEREIGN_ART.hd;
  ctx.save();ctx.translate(x-camX,y);ctx.scale(face,1);if(angle)ctx.rotate(angle);ctx.globalAlpha*=alpha;smoothFor(d);
  if(add)ctx.globalCompositeOperation='lighter';
  ctx.drawImage(im,sx,sy,w,h,-ax,-ay,w*d,h*d);ctx.restore();return true;
}
function paintSovFx(id,progress,x,y,width,height,alpha=1,face=1,anchor='bottom'){
  const frames=SOVEREIGN_ART.clips['fx_'+id];if(!frames)return;
  const f=frames[clamp(Math.floor(progress*frames.length),0,frames.length-1)],im=SOVEREIGN_SHEETS[f.sheet];if(!im?.naturalWidth)return;
  const [sx,sy,w,h]=f.atlas;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha*=alpha;ctx.translate(x-camX,y);ctx.scale(face,1);smoothFor(height/h);
  ctx.drawImage(im,sx,sy,w,h,-width/2,anchor==='center'?-height/2:-height,width,height);ctx.restore();
}
function sovClip(e,name){return e.p2shown&&SOVEREIGN_ART.clips[name+'_p2']?name+'_p2':name;}
function sovPose(e){
  const s=sovData(e),A=SOVEREIGN_ART.clips;
  const at=(clip,u)=>({clip,drawing:clamp(1+Math.floor(u*A[clip].length),1,A[clip].length)});
  if(e.phaseT>0){const a=s.transitionAge;
    if(a<SR.kneelIn)return at('kneel',a/SR.kneelIn*10/16);
    return at('awaken',Math.min(.999,(a-SR.kneelIn)/SR.awaken));}
  if(e.st==='intro')return at('intro',Math.min(.999,introT/MS/SR.intro));
  if(e.st==='dead')return at('death',Math.min(.999,e.t/SR.death));
  if(sovBodyDown(e)){const t=e.st==='pat'?s.bodyT:e.t,clip=sovClip(e,'kneel');
    return {clip,drawing:t<18?1+Math.floor(t/3):7+Math.floor((t-18)/8)%4};}
  if(e.st==='rec'&&s.rising)return {clip:sovClip(e,'kneel'),drawing:Math.min(16,11+Math.floor(e.t/Math.max(1,e.recT)*6))};
  if(e.st==='hurt'){const clip=sovClip(e,'hurt'),half=A[clip].length/2;
    return {clip,drawing:(e.hheavy?half:0)+1+Math.min(half-1,Math.floor(e.t/11*half))};}
  if(e.st==='pat'){
    if(e.pat==='command'&&s.bodyAct)return {clip:sovClip(e,'command'),drawing:(s.bodyAct.kind==='lift'?9:1)+Math.min(7,Math.floor(s.bodyT/SR.command.ticks*8))};
    if(e.pat==='beam'&&s.beam){const b=s.beam,clip=sovClip(e,'beam');
      if(b.stage==='charge')return {clip,drawing:1+Math.min(5,Math.floor(b.lt/SR.beam.charge*6))};
      if(b.stage==='fire')return {clip,drawing:7+Math.floor(b.lt/4)%6};
      return {clip,drawing:13+Math.min(3,Math.floor(b.lt/SR.beam.recover*4))};}
    if(e.pat==='ultimate'){const pt=s.patterns.find(x=>x.id==='ultimate');
      if(pt?.stage==='merge')return {clip:'ultimate',drawing:1+Math.min(5,Math.floor(pt.lt/SR.ultimate.merge*6))};
      if(pt?.stage==='split')return {clip:'ultimate',drawing:13+Math.min(3,Math.floor(pt.lt/5))};
      return {clip:'ultimate',drawing:7+Math.floor(s.bodyT/6)%6};}
  }
  const clip=sovClip(e,e.walk?'walk':'idle');
  return {clip,drawing:1+Math.floor(tick/(e.walk?7:9))%A[clip].length};
}
function sovHelm(e){return {x:e.x+e.face*(e.p2shown?22:12),h:e.p2shown?112:128};}
function drawSovereign(e){
  if(!isSovereign(e))return false;
  const s=sovData(e),pose=sovPose(e),frame=SOVEREIGN_ART.clips[pose.clip]?.[pose.drawing-1];
  if(!SOVEREIGN_SHEETS[frame?.sheet]?.naturalWidth)return false;
  drawShadow(e.x-camX,e.y,SPRITES.boss5.sh,e.z);
  ctx.save();
  if(e.flash>0&&UX.options.flash)ctx.filter='brightness(1.8)';
  paintSov(frame,e.x,e.y-e.z,e.face);
  ctx.restore();
  const mask=SOVEREIGN_ART.clips['mask_'+pose.clip]?.[pose.drawing-1];
  if(mask&&(e.p2shown||pose.clip==='awaken'))paintSov(mask,e.x,e.y-e.z,e.face,.25+.7*(.5+.5*Math.sin(tick*Math.PI*2/90)),true);
  if(e.st==='pat'&&e.pat==='beam'&&s.beam?.stage==='charge'){
    const hm=sovHelm(e),k=s.beam.lt/SR.beam.charge;
    ctx.save();ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(hm.x-camX,e.y-hm.h,0,hm.x-camX,e.y-hm.h,8+18*k);
    g.addColorStop(0,`rgba(255,240,250,${.5+.5*k})`);g.addColorStop(.4,`rgba(255,73,141,${.6*k})`);g.addColorStop(1,'rgba(255,73,141,0)');
    ctx.fillStyle=g;ctx.fillRect(hm.x-camX-30,e.y-hm.h-30,60,60);ctx.restore();
  }
  return true;
}
function drawSovFist(e,f){
  if(f.hidden||f.st==='wait'||f.st==='merged')return;
  const A=SOVEREIGN_ART.clips,p2=e.p2shown;
  const lying=['fallen','down','wreck'].includes(f.st);
  ctx.save();ctx.globalAlpha=.35*(1-Math.min(1,f.h/260));ctx.fillStyle='#000';
  ctx.beginPath();ctx.ellipse(f.x-camX,f.y,24,7,0,0,Math.PI*2);ctx.fill();ctx.restore();
  if(lying){
    const waking=f.st==='fallen'&&f.t<30,y=f.y-f.h-12;
    if(p2){
      const idx=waking?(f.t<12?3:2):f.st==='down'?0:1;
      paintSov(A.fist_fallen_p2[idx],f.x,y,f.face);
    }else{
      const broken=f.st!=='down';paintSov(A.fist_p1_dim[broken?2:0],f.x,y,f.face);
      if(waking)paintSov(A.fist_p1[broken?6:0],f.x,y,f.face,1-f.t/30);
    }
    return;
  }
  if(f.st==='rise'&&f.t<12&&p2){paintSov(A.fist_fallen_p2[3],f.x,f.y-f.h-10,f.face);return;}
  const clip=p2?A.fist_p2:A.fist_p1,ratio=f.hp/f.max;
  let pose=f.pose||1;if(pose===1)pose=ratio>.66?5:ratio>.33?6:7;
  ctx.save();
  if(f.flash>0&&UX.options.flash)ctx.filter='brightness(1.9)';
  else if(f.role==='B'&&(f.st==='home'||f.st==='return'))ctx.filter='brightness(.75)';
  else if(ratio<=.33&&pose!==7&&Math.floor(tick/8)%2===0)ctx.filter='drop-shadow(0 0 3px #ff2050) brightness(1.15)';
  paintSov(clip[pose-1],f.x,f.y-f.h,f.face,1,false,f.ang);
  ctx.restore();
  if(f.glow){
    const frame=clip[pose-1],wx=f.x-f.face*frame.anchor[0]*.62,wy=f.y-f.h;
    const k=.55+.45*Math.sin(tick*.5),c=f.glow==='red'?'255,40,70':'255,255,255';
    ctx.save();ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(wx-camX,wy,0,wx-camX,wy,22);
    g.addColorStop(0,`rgba(${c},${.9*k})`);g.addColorStop(1,`rgba(${c},0)`);
    ctx.fillStyle=g;ctx.fillRect(wx-camX-22,wy-22,44,44);ctx.restore();
  }
  if(f.hp<f.max&&f.st!=='pat'){
    const x=f.x-camX,y=f.y-f.h-30;ctx.save();ctx.fillStyle='#1d1018';ctx.fillRect(x-14,y,28,3);
    ctx.fillStyle=ratio>.66?'#e8d6e2':ratio>.33?'#ff9ac6':'#ff3d6a';ctx.fillRect(x-13,y+.5,26*ratio,2);ctx.restore();
  }
}
function drawSovGiant(e){
  const g=sovData(e).giant;if(!g)return;
  const A=SOVEREIGN_ART.clips.fist_giant;
  ctx.save();ctx.globalAlpha=.4;ctx.fillStyle='#000';ctx.beginPath();ctx.ellipse(g.x-camX,g.y,60,12,0,0,Math.PI*2);ctx.fill();ctx.restore();
  paintSov(A[g.frame-1],g.x,g.y-g.h-(g.frame>=3&&g.frame!==4?20:0),g.face);
}
function sovereignDrawList(list){
  if(!USE_SOVEREIGN)return;
  for(const e of enemies){
    if(!isSovereign(e)||!e.sov)continue;
    for(const f of e.sov.fists)list.push({y:f.y+(f.role==='B'&&['home','return','rise'].includes(f.st)?-.5:.25),f:()=>drawSovFist(e,f)});
    if(e.sov.giant)list.push({y:e.sov.giant.y+.6,f:()=>drawSovGiant(e)});
  }
}
function drawSovereignGround(){
  if(!USE_SOVEREIGN)return;
  for(const r of sovereignRemains){
    // Embers keep the wreck readable after the victory dimming.
    const glow=.35+.15*Math.sin(tick*.05);
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.translate(r.x-camX,r.y-6);ctx.scale(1,.32);
    const g=ctx.createRadialGradient(0,0,0,0,0,120);
    g.addColorStop(0,`rgba(255,73,141,${glow})`);g.addColorStop(1,'rgba(255,73,141,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,120,0,Math.PI*2);ctx.fill();ctx.restore();
    paintSov(SOVEREIGN_ART.clips.death.at(-1),r.x,r.y,r.face);
    for(const f of r.fists)paintSov(SOVEREIGN_ART.clips.fist_fallen_p2[1],f.x,f.y-14,f.face);
  }
  for(const e of enemies){
    if(!isSovereign(e)||!e.sov)continue;
    const s=e.sov;
    for(const m of s.marks){
      // Dark pit + lit rim so the landing zone reads on the dark stage-5 floor.
      const fast=m.flash,alpha=UX.options.flash?(fast?(Math.floor(m.age/3)%2?1:.45):.75+.25*Math.sin(m.age*.2)):.9,x=m.x-camX;
      ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#12030b';ctx.beginPath();ctx.ellipse(x,m.y,m.rx,m.ry,0,0,Math.PI*2);ctx.fill();
      ctx.globalCompositeOperation='lighter';ctx.globalAlpha=alpha;ctx.fillStyle='rgba(255,73,141,.3)';ctx.fill();
      ctx.lineWidth=2;ctx.strokeStyle=fast?'#ffe0ef':'#ff498d';ctx.stroke();ctx.restore();
      paintSovFx('slam_mark',(m.age%30)/30,m.x,m.y,m.rx*2.5,m.ry*2.8,Math.min(1,alpha+.2),1,'center');
    }
    for(const w of s.waves)for(const y of [GTOP+18,(GTOP*2+GBOT)/3+10,(GTOP+GBOT*2)/3+10,GBOT+4])
      paintSovFx('ground_wave',(w.age%24)/24,w.x,y,70,34,.95,w.dir);
    const pt=s.patterns.find(x=>x.id==='ultimate'&&!x.done);
    if(pt&&['hover','turn'].includes(pt.stage)&&s.giant){
      const a=UX.options.flash?.18+.16*Math.sin(tick*.6):.25;
      ctx.save();ctx.fillStyle=`rgba(255,73,141,${a})`;ctx.fillRect(0,GTOP-8,VW,GBOT-GTOP+16);ctx.restore();
      paintSovFx('mark_alt',(tick%40)/40,s.giant.x,s.giant.y,170,60,.9,1,'center');
    }
    const b=s.beam;
    if(b?.stage==='charge'&&b.lane!=null&&e.st==='pat'){
      const x0=e.x-camX,x1=e.face>0?VW:0;ctx.save();ctx.globalAlpha=UX.options.flash?.35+.35*(Math.floor(tick/4)%2):.5;
      ctx.fillStyle='#ff498d';ctx.fillRect(Math.min(x0,x1),b.lane-SR.beam.depth,Math.abs(x1-x0),SR.beam.depth*2);ctx.restore();
    }
  }
}
function drawSovereignTop(){
  if(!USE_SOVEREIGN)return;
  for(const e of enemies){
    if(!isSovereign(e)||!e.sov)continue;
    const s=e.sov,b=s.beam;
    if(b?.stage==='fire'&&e.st==='pat'){
      const hm=sovHelm(e),edge=e.face>0?camX+VW+20:camX-20,len=Math.abs(edge-hm.x),fire=SR.beam.fire[sovP(e)];
      const f=b.lt<10?b.lt/10*3/8:b.lt>fire-10?(6+(b.lt-(fire-10))/10*2)/8:(3+(b.lt/3)%3)/8;
      paintSovFx('helm_beam',f,hm.x+e.face*len/2,b.lane-hm.h,len,62,1,e.face,'center');
      ctx.save();ctx.globalCompositeOperation='lighter';const y=b.lane-hm.h;
      const g=ctx.createLinearGradient(0,y-10,0,y+10);g.addColorStop(0,'rgba(255,73,141,0)');g.addColorStop(.5,'rgba(255,225,240,.85)');g.addColorStop(1,'rgba(255,73,141,0)');
      ctx.fillStyle=g;ctx.fillRect(Math.min(hm.x,edge)-camX,y-10,len,20);ctx.restore();
    }
    for(const f of s.fx)paintSovFx(f.id,f.age/f.life,f.x,f.y-f.h+(f.anchor==='center'?0:0),f.w,f.hh,1-f.age/f.life*.5,f.face,f.anchor);
  }
}
function sovereignTelegraph(e){
  const s=e.sov;if(!s)return false;
  return s.fists.some(f=>f.glow)||(e.st==='pat'&&e.pat==='beam'&&s.beam?.stage==='charge')||s.marks.some(m=>m.flash);
}
let sovereignPortrait=null;
function getSovereignPortrait(){
  if(!USE_SOVEREIGN)return null;
  const f=SOVEREIGN_ART.clips.idle[0],im=SOVEREIGN_SHEETS[f.sheet];if(!im?.naturalWidth)return null;
  if(!sovereignPortrait){const c=document.createElement('canvas');c.width=c.height=64;c.hd=true;const [x,y,w,h]=f.atlas;
    const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(im,x+w*.38,y+h*.04,w*.4,h*.26,0,0,64,64);sovereignPortrait=c;}
  return sovereignPortrait;
}
