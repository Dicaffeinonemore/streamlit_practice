(async function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const bundle = window.REFERENCE_BUNDLE;
  const getJSON = async path => {
    if (bundle) { if (!bundle.json[path]) throw new Error('번들에 없는 데이터: ' + path); return bundle.json[path]; }
    const res = await fetch(path); if (!res.ok) throw new Error(path + ': HTTP ' + res.status); return res.json();
  };
  const url = path => bundle?.images[path] || path;
  const imageCache = new Map();
  const getImage = path => {
    if (!imageCache.has(path)) imageCache.set(path, new Promise((resolve,reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('이미지 로딩 실패: ' + path)); img.src = url(path);
    }));
    return imageCache.get(path);
  };
  const statuses = { review:'검수 후보 · 전투 적용 보류', blocked:'분리 보류', missing:'원본에 없음' };
  let catalog, entries, character, animation, player, playing = false, version = 0, pictures = [];
  function fail(error) { $('status').textContent = error.message; $('status').style.color = '#ff9b9b'; window.labError = error.message; }
  function option(value,text) { const o = document.createElement('option'); o.value=value; o.textContent=text; return o; }
  function fillFacts(values) {
    $('facts').replaceChildren();
    for (const [key,value] of Object.entries(values)) {
      const dt=document.createElement('dt'),dd=document.createElement('dd'); dt.textContent=key; dd.textContent=value; $('facts').append(dt,dd);
    }
  }
  function backdrop(ctx) {
    const {width,height}=ctx.canvas;
    const bg=$('background').value;
    ctx.fillStyle=bg==='light'?'#dedee3':'#0d1520'; ctx.fillRect(0,0,width,height);
    if(bg==='checker') for(let y=0;y<height;y+=16) for(let x=0;x<width;x+=16) {
      ctx.fillStyle=(x/16+y/16)%2?'#28384a':'#1d2a3a';ctx.fillRect(x,y,16,16);
    }
  }
  function paint() {
    const f=player?.frame, imgs=pictures[player?.index], scale=Number($('zoom').value), flip=$('flip').checked;
    const width=Math.max(640,(animation?.canvas?.[0]||0)*scale+40),height=Math.max(400,(animation?.canvas?.[1]||0)*scale+40);
    const center=Math.floor(width/2),ground=height-30;
    for (const kind of ['original','candidate']) {
      const c=$(kind);
      if(c.width!==width||c.height!==height){c.width=width;c.height=height;c.style.width=width+'px';c.style.height=height+'px';}
      const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false; backdrop(ctx);
      if(f && imgs) {
        const anchor=kind==='candidate'?f.origin:[f.sourceAnchor[0]-f.sourceRect[0],f.sourceAnchor[1]-f.sourceRect[1]];
        const im=imgs[kind]; ctx.save();ctx.translate(center,ground);ctx.scale(flip?-scale:scale,scale);ctx.drawImage(im,-anchor[0],-anchor[1]);ctx.restore();
      }
      if($('guide').checked){ctx.strokeStyle='#e2bb67';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,ground+.5);ctx.lineTo(width,ground+.5);ctx.moveTo(center+.5,20);ctx.lineTo(center+.5,height-10);ctx.stroke();}
    }
    $('frame').value=player?.index || 0;
    $('counter').textContent=f?`${player.index+1} / ${animation.frames.length}${player.ended?' · 종료':''}`:'프레임 미확정';
    $('play').textContent=playing?'일시정지':'재생';
  }
  async function chooseMotion() {
    const token=++version;playing=false;pictures=[];
    animation=entries[character.id].animations.animations[$('motion').value];
    const clip=animation;
    player=new ReferenceAnimation.AnimationPlayer({[clip.id]:{...clip}}, {preview:true,onComplete:()=>{playing=false;}});
    $('fps').value=clip.fps;
    $('status').textContent=statuses[clip.status] || clip.status;
    fillFacts({'원본 표기':clip.declaredFrames===null?'미확정':clip.declaredFrames+'프레임','추출 후보':clip.frames.length+'개','반복':clip.loop?'대기·이동 반복':'한 번 재생','게임 적용':clip.gameReady?'가능':'차단','배율':'정수 확대 · Nearest'});
    $('notes').replaceChildren(...clip.notes.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
    const skill=entries[character.id].skills.skills[clip.id];
    $('skill').textContent=skill?`${skill.name}\n상태: ${skill.enabled?'활성':'미검수 · 비활성'}\n피해량: ${skill.balance.damage??'미설정'}\n쿨타임: ${skill.balance.cooldownMs??'미설정'}\n타격 프레임: ${skill.activeFrames.length?skill.activeFrames.join(', '):'미확정'}\n${skill.disabledReason}`:'이 모션에는 스킬 설정이 없습니다.';
    $('panel').hidden=!clip.panel;if(clip.panel)$('panel').src=url(clip.panel);else $('panel').removeAttribute('src');
    $('samples').replaceChildren();$('samples').hidden=!clip.samples?.length;
    for(const sample of clip.samples||[]){
      const figure=document.createElement('figure'),caption=document.createElement('figcaption'),img=document.createElement('img');
      caption.textContent=sample.name+' · 단일 견본 / 알파 미검수';img.alt=sample.name;img.src=url(sample.image);
      img.width=(sample.sourceRect[2]-sample.sourceRect[0])*2;img.height=(sample.sourceRect[3]-sample.sourceRect[1])*2;
      figure.append(caption,img);$('samples').append(figure);
    }
    $('unavailable').hidden=!!clip.frames.length;
    $('unavailable').textContent=clip.status==='missing'?'이 모션은 원본에 없습니다. 다른 모션을 대신 재생하지 않습니다.':'개별 프레임과 이펙트 경계를 확정할 수 없어 원본 패널만 표시합니다. 아래 숫자만으로 등분하거나 16장으로 복제하지 않습니다.';
    for(const id of ['play','restart','prev','next','frame'])$(id).disabled=true;
    player.play(clip.id);$('frame').max=Math.max(0,clip.frames.length-1);paint();
    const loaded=await Promise.all(clip.frames.map(async f=>({original:await getImage(f.original),candidate:await getImage(f.image)})));
    if(token!==version)return;
    pictures=loaded;
    for(const id of ['play','restart','prev','next','frame'])$(id).disabled=!clip.frames.length;
    paint();
  }
  async function chooseCharacter() {
    character=catalog.characters.find(c=>c.id===$('character').value);
    const source=catalog.sources.find(s=>s.id===character.source);$('sourceLink').href=url(source.image);
    if(bundle){$('sourceLink').download=character.source+'.png';$('sourceLink').textContent='원본 시트 PNG 저장 ↓';}
    $('motion').replaceChildren(...Object.values(entries[character.id].animations.animations).map(a=>option(a.id,`${a.name} · ${a.frames.length?'후보 '+a.frames.length+'개':statuses[a.status]}`)));
    await chooseMotion();
  }
  try {
    catalog=await getJSON('data/reference-catalog.json');entries={};
    await Promise.all(catalog.characters.map(async c=>entries[c.id]={animations:await getJSON(c.animations),skills:await getJSON(c.skills)}));
    $('character').replaceChildren(...catalog.characters.map(c=>option(c.id,c.name)));
    for(const c of catalog.characters)for(const a of Object.values(entries[c.id].animations.animations)){
      const tr=document.createElement('tr');
      for(const text of [c.name,a.name,a.declaredFrames??'—',a.frames.length||'—',statuses[a.status]]){const td=document.createElement('td');td.textContent=text;tr.append(td);}
      $('inventory').append(tr);
    }
    $('character').onchange=()=>chooseCharacter().catch(fail);$('motion').onchange=()=>chooseMotion().catch(fail);
    $('play').onclick=()=>{if(player.ended)player.play(animation.id);playing=!playing;paint();};
    $('restart').onclick=()=>{player.play(animation.id);playing=false;paint();};
    const seek=i=>{playing=false;player.seek(i);paint();};
    $('prev').onclick=()=>seek(player.index-1);$('next').onclick=()=>seek(player.index+1);$('frame').oninput=()=>seek(Number($('frame').value));
    $('fps').onchange=()=>{const fps=Number($('fps').value);if(Number.isFinite(fps)&&fps>=1&&fps<=30&&player.clip)player.clip.fps=fps;else $('fps').value=player.clip?.fps||8;};
    for(const id of ['zoom','flip','guide','background'])$(id).onchange=paint;
    document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;paint();}});
    await chooseCharacter();window.labReady=true;
    let last=performance.now();
    function frame(now){if(playing)player.advance(Math.min(100,now-last));last=now;paint();requestAnimationFrame(frame);}
    requestAnimationFrame(frame);
  }catch(error){fail(error);}
})();
