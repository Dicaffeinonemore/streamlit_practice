// Actual game rendering, staged camera/edit, no changes to game source.
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');
const {spawn}=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/trailer');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]);const file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');fs.createReadStream(file).pipe(res);});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'bmk-trailer-'));
let browser,ws,session,id=0;const pending=new Map(),errors=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function call(method,params={},sid=session){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params,...(sid?{sessionId:sid}:{})}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function record(){
  requestAnimationFrame=()=>0;AUDIO.enable(false);beginGame();showScreen(null);
  UX.options.touch=false;UX.options.shake=true;document.body.classList.remove('touch');
  await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));
  await Promise.all([VARGUL_READY,...SOV_SHEETS.map(i=>i.decode()),...AURELION_SHEETS.map(i=>i.decode())]);
  drawHUD=()=>{};drawVargulDebug=()=>{};
  const output=document.createElement('canvas');output.width=1280;output.height=720;
  const g=output.getContext('2d');g.imageSmoothingEnabled=false;
  const clips=[
    [0,3,3,'sweep',true,'왕좌는 저주받았다.','THE THRONES ARE CURSED', 'opening'],
    [3,6,0,null,false,'검을 들어라.','BECOME THE BLACK MOON KNIGHT','fight'],
    [6,9.5,0,'hook',false,'도살자의 사슬을 끊고','GORATH / THE EXECUTIONER','boss'],
    [9.5,13,1,'moon',true,'죽음 너머의 마녀를 베어라','MORGRA / THE CROW WITCH','boss'],
    [13,16.5,2,'whirl',true,'황금의 수호를 무너뜨려라','AURELION / THE GOLDEN KING','boss'],
    [16.5,20.5,3,'combo',true,'얼어붙은 왕의 분노를 넘어','VARGUL / THE FROZEN GRAVE KING','boss'],
    [20.5,25,4,'ultimate',true,'검은 달의 군주에게 닿아라','SOVEREIGN / THE BLACK MOON','boss'],
    [25,27,3,'cross',true,'피하고.','READ THE ATTACK','action'],
    [27,29,0,null,false,'파고들고.','BREAK THE GUARD','special'],
    [29,31,2,'cleave',true,'베어라.','CLAIM YOUR OPENING','special'],
    [31,34,3,'ultimate',true,'다섯 개의 왕좌. 단 하나의 검.','FIVE THRONES. ONE BLADE.','action'],
    [34,42,4,null,true,'흑월의 기사','BLACK MOON KNIGHT','end']
  ];
  let current=-1,boss=null;
  function setup(c){
    clearInput();practice=false;player=newPlayer();startStage(c[2]);scene='play';showScreen(null);
    camX=lockAt=0;camLock=true;waveIdx=stage.waves.length;arena=null;
    barrels=[];hazards=[];items=[];parts=[];texts=[];impacts=[];bursts=[];ghosts=[];bolts=[];
    hitStop=shake=flashT=slowT=clearT=0;player.x=175;player.y=435;player.inv=99999;player.face=1;player.sp=100;
    boss=mkEnemy(STAGES[c[2]].boss,365,420);boss.p2shown=c[4];boss.hp=boss.max=c[4]?3000:2400;boss.atkCd=99999;enemies=[boss];
    if(isSovereign(boss)){const s=sovData(boss);for(const f of s.fists){const [x,y,h]=sovHome(boss,f,s);Object.assign(f,{x,y,h,st:'home',hp:180,max:180});}if(c[3])sovStartJob(boss,s,c[3]);}
    else if(c[3])startPat(boss,c[3]);
    if(c[7]==='fight'){enemies=[mkEnemy('grunt',270,420),mkEnemy('rogue',350,440),mkEnemy('brute',440,410)];startSkill('spin');}
    if(c[7]==='special'){player.x=260;startSpecial();}
    if(c[7]==='end'){enemies=[];player.x=VW/2;player.y=440;}
    for(let k=0;k<20;k++){tick++;enemies.forEach(updEnemy);updHazards();updFx();}
  }
  function text(s,y,size,color='#f0e7dc',spacing=0){g.font=`700 ${size}px "Malgun Gothic",sans-serif`;g.fillStyle=color;g.textAlign='center';g.shadowColor='#000';g.shadowBlur=16;g.fillText(s,640,y);g.shadowBlur=0;}
  function frame(n){
    const t=n/30,index=clips.findIndex(c=>t>=c[0]&&t<c[1]),c=clips[index],u=t-c[0],dur=c[1]-c[0];
    if(index!==current){setup(c);current=index;}
    for(let k=0;k<2;k++){
      tick++;player.inv=99999;hitStop=0;enemies.forEach(updEnemy);updHazards();updFx();
      if(c[7]==='fight'||c[7]==='special')updPlayer();
      else{player.st='idle';player.walk=false;}
      if(c[7]==='fight'&&n%32===0){player.st='idle';player.skillCd.spin=0;startSkill(n%64===0?'spin':'redwave');}
      if(c[7]==='special'&&player.st!=='special'){player.st='idle';player.sp=100;startSpecial();}
      if(boss&&boss.st==='chase'&&c[3]&&!isSovereign(boss)){boss.x=365;startPat(boss,c[3]);}
    }
    render();g.fillStyle='#040308';g.fillRect(0,0,1280,720);
    const zoom=c[7]==='opening'?1.16+u*.025:c[7]==='end'?1.05+u*.012:1.04+u*.009;
    g.save();g.translate(640,360);g.scale(zoom,zoom);g.drawImage(cv,-640,-360,1280,720);g.restore();
    const shade=g.createLinearGradient(0,0,0,720);shade.addColorStop(0,'rgba(3,2,8,.6)');shade.addColorStop(.4,'rgba(3,2,8,0)');shade.addColorStop(.75,'rgba(3,2,8,.12)');shade.addColorStop(1,'rgba(3,2,8,.95)');g.fillStyle=shade;g.fillRect(0,0,1280,720);
    g.fillStyle='#040308';g.fillRect(0,0,1280,53);g.fillRect(0,650,1280,70);
    // Fine drifting embers, deterministic in the edit.
    for(let j=0;j<34;j++){const x=(j*137+t*(8+j%5))%1280,y=720-((j*83+t*(14+j%11))%720);g.fillStyle=`rgba(236,115,72,${.12+(j%4)*.1})`;g.fillRect(x,y,j%3===0?3:2,2);}
    const alpha=Math.min(1,u*2.3,(dur-u)*3);g.globalAlpha=Math.max(0,alpha);
    if(c[7]==='end'){
      g.fillStyle='rgba(3,2,8,.70)';g.fillRect(0,0,1280,720);
      g.strokeStyle='#a33d45';g.lineWidth=2;g.beginPath();g.arc(640,270,105,0,Math.PI*2);g.stroke();
      g.fillStyle='#9a263b';g.beginPath();g.arc(640,270,90,0,Math.PI*2);g.fill();g.fillStyle='#0a0710';g.beginPath();g.arc(672,244,86,0,Math.PI*2);g.fill();
      text(c[5],354,90);text(c[6],402,27,'#cb9b7b');
      g.fillStyle='#9a5154';g.fillRect(500,435,280,1);
      text('다섯 개의 왕좌. 단 하나의 검.',486,28);
      text('5 STAGES   /   5 BOSSES   /   BOSS CHALLENGE',542,18,'#bcaeac');
      text('검은 달 아래, 네 전설을 새겨라.',607,22,'#d3a893');
    }else if(c[7]==='opening'){
      g.fillStyle='rgba(2,2,8,.38)';g.fillRect(0,0,1280,720);text(c[6],290,18,'#b7a5a2');text(c[5],370,59);
      g.fillStyle='#b03a43';g.fillRect(590,405,100,2);
    }else{
      text(c[6],579,17,'#d6b797');text(c[5],625,c[7]==='action'||c[7]==='special'?47:37);
      g.fillStyle='#a63d49';g.fillRect(607,544,66,2);
    }
    g.globalAlpha=1;
    const fade=Math.max(0,1-u*7);if(index>0&&fade>0){g.fillStyle=`rgba(245,219,203,${fade*.65})`;g.fillRect(0,53,1280,597);}
    if(t<.6||t>41){g.fillStyle=`rgba(0,0,0,${t<.6?1-t/.6:t-41})`;g.fillRect(0,0,1280,720);}
    if([75,220,360,475,650,850,1110].includes(n)){const a=document.createElement('a');window.trailerStills=window.trailerStills||{};window.trailerStills[n]=output.toDataURL('image/jpeg',.9).split(',')[1];}
  }
  const stream=output.captureStream(30),chunks=[];
  const rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:7000000});
  return await new Promise((resolve,reject)=>{rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));stream.getTracks().forEach(t=>t.stop());};let n=0;rec.start();const timer=setInterval(()=>{try{frame(n++);if(n>=1260){clearInterval(timer);rec.stop();}}catch(e){clearInterval(timer);reject(e);}},1000/30);});
}
(async()=>{try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  browser=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{stdio:'ignore',windowsHide:true});
  const pf=path.join(profile,'DevToolsActivePort');for(let i=0;i<100&&!fs.existsSync(pf);i++)await delay(100);
  const [port,endpoint]=fs.readFileSync(pf,'utf8').trim().split(/\r?\n/);ws=new WebSocket('ws://127.0.0.1:'+port+endpoint);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const h=pending.get(m.id);if(h){pending.delete(m.id);m.error?h.reject(m.error):h.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);};
  const target=await call('Target.createTarget',{url:'about:blank'},null);session=(await call('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
  await call('Page.enable');await call('Runtime.enable');await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});
  for(let i=0;i<200;i++){if(await evaluate('document.readyState==="complete"&&typeof UX!=="undefined"&&typeof scene!=="undefined"'))break;await delay(250);}
  console.log('Rendering 42-second staged gameplay trailer...');
  const video=await evaluate('('+record.toString()+')()');fs.writeFileSync(path.join(out,'trailer-master.webm'),Buffer.from(video,'base64'));
  const stills=await evaluate('window.trailerStills');for(const [n,data] of Object.entries(stills))fs.writeFileSync(path.join(out,'frame-'+n+'.jpg'),Buffer.from(data,'base64'));
  fs.writeFileSync(path.join(out,'capture.json'),JSON.stringify({duration:42,fps:30,width:1280,height:720,errors,source:'Current game renderer; staged combat and cinematic overlays'},null,2));console.log('Captured master and review frames.');
}catch(e){console.error(e);process.exitCode=1;}finally{ws?.close();browser?.kill();server.close();}})();
