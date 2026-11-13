'use strict';
// Representative CSS viewports, not physical panel resolution or an OS emulator.
const PRESETS = [
  ['iphone-se','iPhone SE (2·3세대)',375,667,0,0],
  ['iphone-12-mini','iPhone 12 mini',375,812,50,34],
  ['iphone-13-mini','iPhone 13 mini',375,812,50,34],
  ['iphone-13','iPhone 12·13·14',390,844,47,34],
  ['iphone-pro','iPhone 14 Pro·15 Pro',393,852,59,34],
  ['iphone-max','iPhone 14·15 Pro Max',430,932,59,34],
  ['galaxy-s','Galaxy S 계열 · 소형',360,780,24,24],
  ['galaxy-plus','Galaxy S Plus 계열',384,854,24,24],
  ['galaxy-ultra','Galaxy Ultra·A 계열',412,915,24,24],
  ['galaxy-fold','Galaxy Z Fold · 내부',768,904,24,24],
  ['custom','직접 입력',844,390,0,0]
];
const $ = id => document.getElementById(id);
const frame=$('game');
let api, gameStyle, originalStyle, ready=false, busy=false, lastReport=null, batchResults=[];
const clone=value=>JSON.parse(JSON.stringify(value));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function message(text){$('status').textContent=text;}
function number(id,min,max){const n=Number($(id).value);const value=Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;$(id).value=value;return value;}
function geometry(){return {width:number('width',240,1600),height:Math.max(160,number('height',240,1600)-number('chrome',0,160)),top:number('top',0,120),bottom:number('bottom',0,120),left:number('left',0,120),right:number('right',0,120)};}
function setPreset(){
  const p=PRESETS.find(p=>p[0]===$('device').value),portrait=$('orientation').value==='portrait';
  if(p[0]==='custom')return;
  $('width').value=portrait?p[2]:p[3];$('height').value=portrait?p[3]:p[2];
  $('top').value=portrait?p[4]:0;$('bottom').value=portrait?p[5]:Math.min(p[5],21);
  $('left').value=$('right').value=portrait?0:p[4];
}
function resize(){
  const g=geometry(),scale=Math.min(1,Math.max(200,$('stage').clientWidth-38)/g.width,680/g.height);
  $('sizer').style.width=g.width*scale+'px';$('sizer').style.height=g.height*scale+'px';
  $('deviceFrame').style.width=g.width+'px';$('deviceFrame').style.height=g.height+'px';$('deviceFrame').style.transform=`scale(${scale})`;
  $('dimensions').textContent=`${g.width} × ${g.height} CSS px · 미리보기 ${Math.round(scale*100)}%`;
  if(ready){
    gameStyle.textContent=originalStyle.replace(/env\(safe-area-inset-(top|bottom|left|right)\)/g,(_,side)=>g[side]+'px');
    api.fitCanvas();api.UX.setTouchLayout(api.UX.options.touchLayout);
  }
}
function currentLayout(){return clone(api.UX.options.touchLayout);}
function syncFields(){
  if(!ready)return;const layout=currentLayout(),it=layout.items[$('control').value]||{dx:0,dy:0,k:1,hide:false};
  for(const option of $('control').options){const el=option.value==='stick'?frame.contentDocument.getElementById('touchStick'):frame.contentDocument.querySelector('#touchPad [data-control="'+option.value+'"]');option.textContent=el.getAttribute('aria-label');}
  $('scale').value=layout.scale;$('scaleValue').value=Math.round(layout.scale*100)+'%';$('alpha').value=layout.alpha;
  $('dx').value=it.dx;$('dy').value=it.dy;$('keyScale').value=it.k;$('hide').checked=it.hide;
}
function updateLayout(){
  if(!ready)return;const layout=currentLayout();layout.scale=number('scale',.6,1.6);layout.alpha=number('alpha',.1,1);
  layout.items[$('control').value]={dx:number('dx',-40,40),dy:number('dy',-40,40),k:number('keyScale',.5,2),hide:$('hide').checked};
  api.UX.setTouchLayout(layout);syncFields();inspect();
}
function setScene(){
  if(!ready)return;api.UX.endTouchEdit();api.show($('scene').value,$('character').value);syncFields();setTimeout(inspect,80);
}
function visible(el){const cs=frame.contentWindow.getComputedStyle(el),r=el.getBoundingClientRect();return !el.hidden&&cs.visibility!=='hidden'&&cs.display!=='none'&&r.width>0&&r.height>0&&el.getClientRects().length>0;}
function rect(el){const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};}
function inspect(draw=true){
  if(!ready)return null;
  const g=geometry(),doc=frame.contentDocument,controls=[doc.getElementById('touchStick'),...doc.querySelectorAll('#touchPad [data-control]')];
  const controlVisible=visible(doc.getElementById('touchControls'));
  const entries=(controlVisible?controls:[]).filter(visible).map(el=>({id:el.dataset.control||'stick',label:el.getAttribute('aria-label')||el.id,rect:rect(el)}));
  const issues=[];
  for(const item of entries){const r=item.rect;
    if(r.x<g.left-.5||r.y<g.top-.5||r.right>g.width-g.right+.5||r.bottom>g.height-g.bottom+.5)issues.push({type:'outside',label:`${item.label}: 화면 또는 안전영역 밖`,ids:[item.id]});
    if(Math.min(r.width,r.height)<44)issues.push({type:'small',label:`${item.label}: 터치 영역 ${r.width.toFixed(1)} × ${r.height.toFixed(1)}px`,ids:[item.id]});
  }
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    const a=entries[i],b=entries[j],x=Math.min(a.rect.right,b.rect.right)-Math.max(a.rect.x,b.rect.x),y=Math.min(a.rect.bottom,b.rect.bottom)-Math.max(a.rect.y,b.rect.y);
    if(x>2&&y>2)issues.push({type:'overlap',label:`${a.label} ↔ ${b.label}: 버튼 영역 겹침`,ids:[a.id,b.id]});
  }
  const wrap=rect(doc.getElementById('wrap'));
  if(wrap.x<-.5||wrap.y<-.5||wrap.right>g.width+.5||wrap.bottom>g.height+.5)issues.push({type:'viewport',label:'게임 화면이 뷰포트 밖으로 잘립니다.',ids:[]});
  const screen=doc.querySelector('.screen.show');
  if(screen)for(const el of screen.querySelectorAll('button,input,select,a'))if(visible(el)){
    const r=rect(el);if(r.x<g.left||r.y<g.top||r.right>g.width-g.right||r.bottom>g.height-g.bottom)issues.push({type:'menu',label:`메뉴 ${el.textContent.trim().slice(0,20)||el.id}: 안전영역 밖`,ids:[]});
  }
  lastReport={device:$('device').selectedOptions[0].textContent,orientation:$('orientation').value,character:$('character').value,scene:$('scene').value,viewport:g,game:wrap,controls:entries,issues};
  if(draw){
    $('summary').textContent=`${entries.length}개 조작키 · ${issues.length}개 확인 항목`;
    $('issues').replaceChildren();for(const issue of issues){const li=document.createElement('li');li.textContent=issue.label;li.className=issue.type==='outside'?'bad':'';$('issues').append(li);}
    if(!issues.length){const li=document.createElement('li');li.textContent='현재 화면에서 잘림·조작키 겹침·작은 터치 영역이 발견되지 않았습니다.';li.className='good';$('issues').append(li);}
    const overlay=$('overlay');overlay.replaceChildren();
    if($('guides').checked){
      for(const [x,y,w,h] of [[0,0,g.width,g.top],[0,g.height-g.bottom,g.width,g.bottom],[0,0,g.left,g.height],[g.width-g.right,0,g.right,g.height]]){const e=document.createElement('div');e.className='safe';Object.assign(e.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});overlay.append(e);}
      for(const item of entries){const found=issues.filter(i=>i.ids.includes(item.id));if(!found.length)continue;const e=document.createElement('div');e.className='outline'+(found.some(i=>i.type==='outside')?'':' warn');Object.assign(e.style,{left:item.rect.x+'px',top:item.rect.y+'px',width:item.rect.width+'px',height:item.rect.height+'px'});overlay.append(e);}
    }
  }
  return clone(lastReport);
}
function fitControls(){
  if(!ready)return;const g=geometry(),layout=currentLayout(),report=inspect(false),unit=frame.contentDocument.getElementById('touchUnit').getBoundingClientRect().width;
  for(const item of report.controls){const r=item.rect,it=layout.items[item.id]||{dx:0,dy:0,k:1,hide:false};
    const factor=Math.min(1,(g.width-g.left-g.right)/r.width,(g.height-g.top-g.bottom)/r.height);
    if(factor<1)it.k=Math.max(.5,it.k*factor);
    const x=Math.max(g.left,Math.min(r.x,g.width-g.right-r.width)),y=Math.max(g.top,Math.min(r.y,g.height-g.bottom-r.height));
    it.dx=Math.max(-40,Math.min(40,it.dx+(x-r.x)/unit));it.dy=Math.max(-40,Math.min(40,it.dy+(y-r.y)/unit));layout.items[item.id]=it;
  }
  api.UX.setTouchLayout(layout);syncFields();inspect();message('화면 밖 조작키를 이동했습니다. 겹침은 검사 결과를 보며 개별 조정하세요.');
}
const profileKey=()=>`bmk_mobile_lab_profile_${$('device').value}_${$('orientation').value}`;
function snapshot(){return {version:1,device:$('device').value,orientation:$('orientation').value,character:$('character').value,viewport:Object.fromEntries(['width','height','chrome','top','bottom','left','right'].map(k=>[k,Number($(k).value)])),layout:currentLayout()};}
function restore(data){
  if(data?.version!==1||!data.layout||!data.viewport||typeof data.layout!=='object'||!Number.isFinite(data.layout.scale)||!Number.isFinite(data.layout.alpha))throw Error('지원하지 않는 설정 파일입니다.');
  for(const key of ['width','height','chrome','top','bottom','left','right'])if(!Number.isFinite(data.viewport[key]))throw Error('화면 크기와 여백은 숫자여야 합니다.');
  $('device').value=PRESETS.some(p=>p[0]===data.device)?data.device:'custom';$('orientation').value=data.orientation==='portrait'?'portrait':'landscape';
  $('character').value=data.character==='viesa'?'viesa':'barel';for(const key of Object.keys(data.viewport))if(['width','height','chrome','top','bottom','left','right'].includes(key))$(key).value=data.viewport[key];
  api.UX.setTouchLayout(data.layout);resize();setScene();syncFields();inspect();
}
function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function runBatch(){
  if(!ready||busy)return;busy=true;const saved=snapshot(),savedScene=$('scene').value;batchResults=[];
  document.querySelectorAll('aside input,aside select,button').forEach(el=>el.disabled=true);
  try{
    $('scene').value='play';setScene();
    for(const p of PRESETS.filter(p=>p[0]!=='custom'))for(const orientation of ['landscape','portrait']){
      $('device').value=p[0];$('orientation').value=orientation;setPreset();resize();await wait(100);batchResults.push(inspect(false));
      message(`${p[1]} · ${orientation==='landscape'?'가로':'세로'} 검사 중…`);
    }
    const table=document.createElement('table');const head=document.createElement('tr');for(const text of ['기종 / 방향','게임 영역','잘림','겹침','작은 키']){const th=document.createElement('th');th.textContent=text;head.append(th);}table.append(head);
    for(const report of batchResults){const tr=document.createElement('tr');for(const value of [report.device+' / '+(report.orientation==='landscape'?'가로':'세로'),`${Math.round(report.game.width)} × ${Math.round(report.game.height)}`,report.issues.filter(i=>i.type==='outside'||i.type==='viewport').length,report.issues.filter(i=>i.type==='overlap').length,report.issues.filter(i=>i.type==='small').length]){const td=document.createElement('td');td.textContent=value;tr.append(td);}table.append(tr);}$('matrix').replaceChildren(table);message(`${batchResults.length}개 화면 조건 검사 완료. 현재 키 배치로 비교한 결과입니다.`);
  }finally{$('scene').value=savedScene;restore(saved);document.querySelectorAll('aside input,aside select,button').forEach(el=>el.disabled=false);busy=false;}
  return batchResults;
}
for(const p of PRESETS){const o=document.createElement('option');o.value=p[0];o.textContent=p[1];$('device').append(o);}$('device').value='iphone-13';setPreset();
for(const id of ['device','orientation'])$(id).onchange=()=>{if(id==='orientation'&&$('device').value==='custom'){const w=$('width').value;$('width').value=$('height').value;$('height').value=w;}setPreset();resize();setTimeout(inspect,80);};
for(const id of ['width','height','chrome','top','bottom','left','right'])$(id).onchange=()=>{resize();setTimeout(inspect,80);};
for(const id of ['scale','alpha','dx','dy','keyScale','hide'])$(id).oninput=updateLayout;
$('control').onchange=syncFields;$('guides').onchange=()=>inspect();$('character').onchange=$('scene').onchange=setScene;
$('edit').onclick=()=>{if(!ready)return;$('scene').value='play';api.show('play',$('character').value);api.UX.startTouchEdit();message('미리보기에서 키를 끌어 이동하세요. 개별 수치도 함께 사용할 수 있습니다.');};
$('play').onclick=()=>{$('scene').value='play';setScene();};$('fit').onclick=fitControls;
$('reset').onclick=()=>{api.UX.setTouchLayout({});syncFields();inspect();};
$('actual').onclick=()=>{$('device').value='custom';$('width').value=Math.round(window.visualViewport?.width||innerWidth);$('height').value=Math.round(window.visualViewport?.height||innerHeight);$('orientation').value=innerWidth>innerHeight?'landscape':'portrait';for(const k of ['top','bottom','left','right','chrome'])$(k).value=0;resize();setTimeout(inspect,80);message('현재 브라우저의 사용 가능 크기를 복사했습니다. 안전 여백은 실기기에 맞게 입력하세요.');};
$('save').onclick=()=>{try{localStorage.setItem(profileKey(),JSON.stringify(snapshot()));message('기종·방향별 설정을 이 브라우저에 저장했습니다.');}catch{message('저장 공간을 사용할 수 없습니다. JSON으로 내보내세요.');}};
$('load').onclick=()=>{try{const data=localStorage.getItem(profileKey());if(!data)throw Error('이 기종·방향에 저장된 설정이 없습니다.');restore(JSON.parse(data));message('저장된 설정을 불러왔습니다.');}catch(e){message(e.message);}};
$('export').onclick=()=>download('black-moon-mobile-layout.json',snapshot());$('import').onclick=()=>$('file').click();
$('file').onchange=async()=>{try{const f=$('file').files[0];if(!f)return;if(f.size>100000)throw Error('설정 파일이 너무 큽니다.');restore(JSON.parse(await f.text()));message('설정 파일을 불러왔습니다.');}catch(e){message('불러오기 실패: '+e.message);}finally{$('file').value='';}};
$('apply').onclick=()=>{try{const settings=JSON.parse(localStorage.getItem('bmk_settings')||'{}');settings.touch=true;settings.touchLayout=currentLayout();localStorage.setItem('bmk_settings',JSON.stringify(settings));message('이 브라우저의 게임에 조작키 배치를 저장했습니다. 게임을 새로고침하면 적용됩니다.');}catch{message('게임 설정을 저장하지 못했습니다. JSON으로 내보내세요.');}};
$('check').onclick=()=>inspect();$('batch').onclick=()=>runBatch().catch(e=>message(e.message));$('report').onclick=()=>download('black-moon-mobile-report.json',{createdAt:new Date().toISOString(),current:inspect(false),matrix:batchResults});
window.addEventListener('resize',()=>{resize();if(ready)inspect();});
frame.addEventListener('load',async()=>{
  try{
    api=frame.contentWindow.eval(`({UX,fitCanvas,show(mode,character){AUDIO.enable(false);UX.options.touch=true;document.body.classList.add('touch');clearInput();selectedCharacterId=character;if(mode==='title'){toTitle();}else{beginGame();scene='play';bannerT=0;showScreen(null);player.inv=999999;player.hp=player.max;if(mode==='settings')openSettings('play');}syncPlayerCharacterUI(character);syncTouchControls();}})`);
    gameStyle=frame.contentDocument.querySelector('style');originalStyle=gameStyle.textContent;ready=true;
    for(const el of [frame.contentDocument.getElementById('touchStick'),...frame.contentDocument.querySelectorAll('#touchPad [data-control]')]){const o=document.createElement('option');o.value=el.dataset.control||'stick';o.textContent=el.getAttribute('aria-label');$('control').append(o);}
    resize();setScene();syncFields();document.querySelectorAll('button').forEach(el=>el.disabled=false);message('준비 완료. 기종을 선택하고 실제 게임 화면에서 배치를 조정하세요.');
    frame.contentDocument.addEventListener('pointerup',()=>setTimeout(()=>{syncFields();inspect();},50));
    setInterval(()=>{if(!busy&&ready)inspect();},1500);
  }catch(e){message('게임 로딩 실패. 로컬 서버로 mobile-lab.html을 열어주세요. '+e.message);}
});
document.querySelectorAll('button').forEach(el=>el.disabled=true);
resize();
