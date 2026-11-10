// 바렐 Rika AI 모션 (assets/barel/rika-source → tools/build-barel-rika.py → barel-rika-data.js)
// 모든 시트는 서 있는 자세(0번)에서 시작하므로, 게임에서는 동작이 시작되는 장부터 재생한다.
// 타임라인: [시트의 장 번호(0부터), 그 장이 끝나는 ms] 목록. 판정 시점은 combat-data.js / game.js 와 맞춘다.
(function(root){
  'use strict';
  const clips={};
  // ?barelRika=off 이면 이전 모션(BarelCombo0 등)으로 그린다 — 이전 모션 검사용
  let mode=(root.location?.search&&new URLSearchParams(root.location.search).get('barelRika'))||root.BAREL_RIKA_CONFIG?.mode||'rika';
  if(!['rika','off'].includes(mode))mode='rika';
  for(const [name,clip] of Object.entries(root.BAREL_RIKA_DATA||{})){
    const image=new Image();image.src=clip.path;
    clips[name]={...clip,image,frames:clip.frames.map((f,index)=>({image,atlas:f.atlas,anchor:f.anchor,renderScale:clip.renderScale,smooth:true,clip:name,index}))};
  }
  const TIMELINES={
    // 지상 3연타: 판정 시작(일섬 128.5 / 역일섬 105 / 참격 249ms)에 칼이 지나가는 장이 오도록
    combo0:[[2,25],[3,50],[4,80],[6,125],[7,210],[8,280],[9,350]],
    combo1:[[0,35],[1,70],[2,105],[3,165],[4,215],[5,260],[6,310]],                          // 2타 7장: 앞으로 겨눈 칼을 위로 올려벤다
    combo2:[[1,30],[2,60],[3,90],[4,120],[5,150],[7,180],[9,210],[11,240],[12,270],[13,320],[14,420],[15,680]],
    // 공중 베기: 착지할 때까지 마지막 장 유지
    air:[[1,50],[5,100],[6,170],[7,400]],
    dash:[[5,30],[6,70],[7,110],[8,150],[9,190]],
    cast:[[1,60],[2,120],[3,180],[4,240],[5,300],[6,380],[7,470],[8,560],[9,640]],
    skill:{
      thrust:[[2,40],[3,90],[4,140],[5,220],[6,270],[7,360],[8,440],[9,520]],                   // 견제 찌르기: 220ms 부터 판정
      slam:[[0,45],[1,90],[2,135],[3,180],[4,230],[5,280],[6,330],[7,430],[8,560],[9,820]], // 내려찍기 착지: 330ms
      whirl:[[2,50],[3,110],[4,170],[5,200],[7,260],[8,330],[9,400],[6,460],[7,520],[8,600],[9,760]], // 200/330/460ms 세 번
      leap:[[1,60],[2,120],[3,210],[4,300],[5,390],[6,470],[7,530],[8,560],[9,960]],           // 560ms 착지 일격
      redwave:[[2,40],[3,90],[4,140],[5,190],[6,240],[7,300],[8,450],[9,720]],                  // 흑월참 4타 시트의 수평 베기 (300ms 발사)
    },
    special1:[[1,70],[2,140],[3,210],[4,300],[5,375],[6,450],[7,535],[8,600],[9,620]],          // 기 모으기 → 솟구침 → 돌진
    special5:[[2,1320],[3,1385],[4,1450],[5,1515],[6,1580],[7,1700],[8,1880],[9,2100]],       // 1580ms 마무리 일격 (초승달)
  };
  const IDLE_FRAME_MS=130;   // 대기 10장 × 130ms = 1300ms 반복 (이전 바렐 대기와 같은 호흡)
  const SPECIAL_DEFAULT={slashFromMs:620,slashMs:640/3,slashHitMs:[80,80,160],finMs:1580};
  const ready=c=>c&&c.image.complete&&c.image.naturalWidth;
  function frame(name,index){
    const c=clips[name];
    if(!ready(c))return null;
    return c.frames[Math.max(0,Math.min(c.frames.length-1,index|0))];
  }
  function onTimeline(name,timeline,ms){
    for(const [index,end] of timeline)if(ms<end)return frame(name,index);
    return frame(name,timeline[timeline.length-1][0]);
  }
  function specialFrame(ms){
    const S=root.SPECIAL_TIMING||SPECIAL_DEFAULT,end=S.slashFromMs+S.slashMs*S.slashHitMs.length;
    if(ms<S.slashFromMs)return onTimeline('special1',TIMELINES.special1,ms);
    if(ms<end){
      // 2~4번 시트 = 연속 베기 세 번. 0~1번(서 있는 자세)은 건너뛰고 2~9번 여덟 장을 고르게 재생
      const k=Math.floor((ms-S.slashFromMs)/S.slashMs),u=(ms-S.slashFromMs-k*S.slashMs)/S.slashMs;
      return frame('special'+(k+2),2+Math.min(7,Math.floor(u*8)));
    }
    return onTimeline('special5',TIMELINES.special5,ms);
  }
  // BarelJump 의 1~10장 선택(도약 준비·상승·정점·낙하·착지)을 새 점프 시트로 옮긴다
  const JUMP_FROM_LEGACY=[3,3,4,5,5,6,6,7,7,8,9];
  function jumpFrame(actor,allowLanding){
    const legacy=root.BarelJump?.sourceFrame?.(actor,allowLanding);
    if(legacy)return frame('jump',JUMP_FROM_LEGACY[legacy]);
    if(actor.z>0)return frame('jump',actor.vz>0?5:7);
    return null;
  }
  function downFrame(actor){
    if(actor.z>0)return frame('down',actor.t<3?1:actor.t<6?2:actor.vz>0?3:4);
    // 착지 → 누움 → 기상 직전에 상체를 일으킨다 (getupAfterTicks 55)
    const t=actor.t;
    return frame('down',t<22?5:t<36?6:t<44?7:t<50?8:9);
  }
  root.BarelRika={
    clips,TIMELINES,
    ready(){return Object.values(clips).every(ready);},
    setMode(value){if(!['rika','off'].includes(value))throw Error('Unknown Barel Rika mode');mode=value;},
    status(){return {mode,loaded:Object.values(clips).every(ready)};},
    frameFor(actor,tickMs,elapsedMs,allowLanding=true){
      if(mode!=='rika'||!actor||actor.characterId&&actor.characterId!=='barel'||!Number.isFinite(tickMs))return null;
      const t=actor.t*tickMs;
      switch(actor.st){
        case 'atk':
          if(actor.atk==='air')return onTimeline('air',TIMELINES.air,t);
          {const id={c1:'combo0',c2:'combo1',c3:'combo2'}[actor.atk]||'combo'+(actor.combo|0);
           return TIMELINES[id]?onTimeline(id,TIMELINES[id],t):null;}
        case 'dash_attack':{
          const ends=root.COMBAT_FRAME_DATA?.barel.dashAttack.frameEndTicks||[3,7,11,14,17,23,29,35,41,47];
          const i=ends.findIndex(end=>actor.t<end);
          return frame('thrust',[2,3,4,5,6,7,7,8,9,9][i<0?9:i]);
        }
        case 'skill':return TIMELINES.skill[actor.skill]?onTimeline(actor.skill==='redwave'?'special4':actor.skill,TIMELINES.skill[actor.skill],t):null;
        case 'special':return specialFrame(t);
        case 'cast':return onTimeline('cast',TIMELINES.cast,t);
        case 'dash':return onTimeline('dash',TIMELINES.dash,t);
        case 'hurt':{
          const u=Math.min(.999,Math.max(0,actor.t/(actor.hurtDuration||17)));
          return frame('hurt',1+Math.floor(u*11));
        }
        case 'grabbed':return frame('hurt',[4,5,6,5][Math.floor(t/120)%4]);
        case 'down':return downFrame(actor);
        case 'dead':return frame('down',1+Math.min(6,Math.floor(t/1000*7)));
        default:{
          const jump=jumpFrame(actor,allowLanding);
          if(jump)return jump;
          if(actor.walk)return frame('walk',1+Math.floor(((actor.walkTime||0)%900)/900*11));
          return frame('idle',Math.floor(Math.max(0,elapsedMs||0)/IDLE_FRAME_MS)%clips.idle.frames.length);
        }
      }
    },
    // 캐릭터 선택 화면: 대기 전체 장을 감싸는 고정 테두리
    preview(elapsedMs){
      const c=clips.idle;
      if(mode!=='rika'||!ready(c)||!Number.isFinite(elapsedMs))return null;
      const fs=c.frames,bounds=[Math.min(...fs.map(f=>-f.anchor[0])),Math.min(...fs.map(f=>-f.anchor[1])),
        Math.max(...fs.map(f=>f.atlas[2]-f.anchor[0])),Math.max(...fs.map(f=>f.atlas[3]-f.anchor[1]))];
      return {image:c.image,frame:fs[Math.floor(elapsedMs/IDLE_FRAME_MS)%fs.length],bounds};
    }
  };
})(globalThis);
