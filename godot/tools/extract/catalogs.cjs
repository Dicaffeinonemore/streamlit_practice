const {fs,path,root,read,json,write,slug} = require('./common.cjs');
async function captureCatalogs(browser) {
  const inventory=JSON.parse(read('godot/docs/GLOBAL_INVENTORY.json'));
  const names=[...new Set(inventory.modules.filter(m=>/art\.js$|rika-data|named-motion-data/.test(m.file)).flatMap(m=>[...m.bindings,...m.exports].map(b=>b.name)))].filter(n=>!/_ATLAS$/.test(n));
  names.push('COMBAT_FRAME_DATA','HD_DATA','HD_SCALE','HERO_FRAMES','G2','G2_MOVES','G2_MEAT','G2_TRANSFORM','G2_INTRO','S1_MOVES','S1_ANIM','S1_CLUB_ATTACK','STAGE1_ET','STAGE1_SECTIONS','VARGUL_RULES','VARGUL_VISUAL_SCALES','SOVEREIGN_RULES','SPECIAL','MAGIC','STAGES');
  const snapshot=await browser.evaluate(`(()=>{const names=${JSON.stringify(names)};const out={};for(const name of names){try{out[name]=eval(name)}catch{}}out.barel_timelines=BarelRika.TIMELINES;return JSON.parse(JSON.stringify(out,(k,v)=>v instanceof HTMLImageElement?v.getAttribute('src'):typeof v==='function'?undefined:v));})()`);
  snapshot.script_order=inventory.scripts;
  snapshot.source_hashes=Object.fromEntries(inventory.modules.map(m=>[m.file,m.sha256]));
  return snapshot;
}
function normalizeCatalogs(s,map) {
  const animations=[];
  const add=(id,frames,metadata={})=>{if(frames.length)animations.push({id:slug(id),frames,metadata});};
  function frame(f,image,scale=1,duration=null){if(!image)throw Error('Missing frame image');return {image:map[image]||image,source_image:image,rect:f.atlas,pivot:f.anchor||[0,0],scale,duration_ms:duration,source:f};}
  // Complete sheets retain every source frame; state-dependent playback is stored separately.
  for(const name of ['BAREL_ART','GORATH_ART','MORGRA_ART','AURELION_ART','VIESA_ART','VARGUL_ART','SOVEREIGN_ART']) {
    const art=s[name];if(!art)continue;
    for(const[clip,frames]of Object.entries(art.clips)) {
      if(!Array.isArray(frames))continue;
      let scale=art.scale||1;
      if(name==='BAREL_ART')scale=.72;
      if(name==='MORGRA_ART')scale=.85/(art.hd||1);
      if(name==='AURELION_ART')scale=.85/(art.hd||1);
      if(name==='VARGUL_ART')scale=(art.scale||1)/(art.hd||1);
      if(name==='SOVEREIGN_ART')scale=1/(art.ppw||1);
      add(name+'.'+clip,frames.map((f,i)=>{const factor=name==='VARGUL_ART'?(s.VARGUL_VISUAL_SCALES?.[clip]?.[i]??1):1;const normalized=frame(f,art.atlas||art.sheets?.[f.sheet||0],scale*factor);if(['MORGRA_ART','AURELION_ART','VARGUL_ART'].includes(name))normalized.pivot=f.anchor.map(x=>x*(art.hd||1));return normalized;}),{catalog:name,clip,timing:'state-driven; see original timing catalog',source_scale:art.scale??null});
    }
  }
  for(const[clip,c]of Object.entries(s.GORATH2_ART.clips))add('gorath_remake.'+clip,c.frames.map(f=>frame(f,s.GORATH2_ART.pages[f.p],c.k)),{catalog:'GORATH2_ART',clip});
  for(const[species,art]of Object.entries(s.STAGE1_ENEMY_ART))for(const[clip,indices]of Object.entries(art.clips)) {
    const lens=s.S1_MOVES[species]?.[clip]?.len;
    add('stage1_enemy.'+species+'.'+clip,indices.map((i,k)=>frame(art.frames[i],art.atlas,art.scale*(species==='heavy'&&clip==='spin'?1.6:1),lens?lens[k]*1000/60:null)),{catalog:'STAGE1_ENEMY_ART',species,clip,source_sheet_ratio:art.sheetRatio});
  }
  for(const[clip,c]of Object.entries(s.BAREL_RIKA_DATA)) {
    add('barel_rika.sheet.'+clip,c.frames.map(f=>frame(f,c.path,c.renderScale*.72)),{catalog:'BAREL_RIKA_DATA',clip,smooth:true});
    const entries=s.barel_timelines[clip]||s.barel_timelines.skill[clip];
    if(entries){let previous=0;add('barel_rika.timeline.'+clip,entries.map(([i,end])=>{const value=frame(c.frames[i],c.path,c.renderScale*.72,end-previous);previous=end;return value;}),{catalog:'BAREL_RIKA_DATA',clip,timeline:entries,smooth:true});}
  }
  {const entries=s.barel_timelines.skill.redwave,c=s.BAREL_RIKA_DATA.special4;let previous=0;add('barel_rika.timeline.redwave',entries.map(([i,end])=>{const value=frame(c.frames[i],c.path,c.renderScale*.72,end-previous);previous=end;return value;}),{catalog:'BAREL_RIKA_DATA',clip:'special4',action:'redwave',timeline:entries,smooth:true});}
  for(const[clip,c]of Object.entries(s.BAREL_NAMED_MOTION_DATA))add('barel_named.'+clip,Array.from({length:c.frames},(_,i)=>frame({atlas:[i%c.columns*640,Math.floor(i/c.columns)*640,640,640],anchor:[320,580]},c.path,c.scale*.72)),{catalog:'BAREL_NAMED_MOTION_DATA',clip});
  for(const[clip,c]of Object.entries(s.STAGE1_FX))add('stage1_fx.'+clip,Array.from({length:c.frames},(_,i)=>frame({atlas:[i*c.w,0,c.w,c.h],anchor:[c.ax,c.ay]},c.file,c.scale)),{catalog:'STAGE1_FX',clip,additive:c.additive});
  for(const[section,b]of Object.entries(s.STAGE1_BG)) {
    add('stage1_background.'+section+'.base',[frame({atlas:[0,0,b.width,b.height],anchor:[0,b.floorY]},b.base,b.scale)],{catalog:'STAGE1_BG',section,world_floor_y:340});
    b.anims.forEach((a,index)=>add('stage1_background.'+section+'.layer_'+index,Array.from({length:a.frames},(_,i)=>frame({atlas:[i%a.cols*a.w,Math.floor(i/a.cols)*a.h,a.w,a.h],anchor:[0,0]},a.file,b.scale,1000/b.fps)),{catalog:'STAGE1_BG',section,layer:index,source_x:a.x,source_y:a.y}));
  }
  for(const[kind,z]of Object.entries(s.ZONE_ART))add('zone.'+kind,Array.from({length:z.frames},(_,i)=>frame({atlas:[i*z.fw,0,z.fw,z.h],anchor:[0,z.ground]},s.ZONE_IMAGES?.[kind]||'',.6)),{catalog:'ZONE_ART',kind,frame_selection:'zoneFrame(age,delay,life); source phase-dependent'});
  const fx=s.BAREL_COMBO_FX_ART;
  for(let row=0;row<3;row++)add('barel_combo_fx.row_'+row,Array.from({length:6},(_,i)=>frame({atlas:[fx.columns[i],fx.rows[row],fx.columns[i+1]-fx.columns[i],fx.rows[row+1]-fx.rows[row]],anchor:[fx.centers[i]-fx.columns[i],fx.anchorY[row]]},fx.image,.42)),{catalog:'BAREL_COMBO_FX_ART',row,additive:true,dx:48,height:row===2?50:55,flip:row===2,frame_selection:'BarelComboFx.frameFor'});
  // Named actors use a shared atlas with per-role clip maps.
  const named=s.NAMED_SPRITES;
  if(named?.clips)for(const[role,clips]of Object.entries(named.clips))for(const[clip,frames]of Object.entries(clips))if(Array.isArray(frames))add('named.'+role+'.'+clip,frames.map(i=>{const f=named.frames[i];return frame(f,s.NAMED_ART.atlas,f.scale||1);}),{catalog:'NAMED_SPRITES',role,clip});
  return {schema:1,animations,source_catalogs:s};
}
module.exports={captureCatalogs,normalizeCatalogs};
