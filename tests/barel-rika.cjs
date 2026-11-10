// node tests/barel-rika.cjs — 바렐 Rika AI 모션: 에셋·타임라인·판정 시점 확인 (브라우저 없이)
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
class Image { constructor(){this.complete=true;this.naturalWidth=2048;} }
const context=vm.createContext({Image,console});
for(const file of ['combat-data.js','src/animation/barel-rika-data.js','src/animation/barel-rika.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const data=context.BAREL_RIKA_DATA,rika=context.BarelRika,D=context.COMBAT_FRAME_DATA.barel,T=rika.TIMELINES;
const manifest=new Set(JSON.parse(fs.readFileSync(path.join(root,'data/runtime-assets.json'),'utf8')));

// 원본 시트 19장이 모두 들어 있고, 서 있는 자세 기준으로 이전 바렐(142)과 같은 키
const expected=['idle','walk','dash','jump','air','hurt','down','combo0','combo1','combo2','cast','whirl','leap','thrust',
  'slam','special1','special2','special3','special4','special5'];
assert.deepEqual(Object.keys(data).sort(),expected.slice().sort());
for(const [name,clip] of Object.entries(data)){
  assert.ok(fs.existsSync(path.join(root,clip.path)),name+' atlas file');
  assert.ok(manifest.has(clip.path),name+' absent from runtime manifest');
  assert.ok(Math.abs(clip.renderScale*clip.standingHeight-142)<1e-9,name+' body height');
  for(const f of clip.frames)assert.ok(f.atlas.every(Number.isInteger)&&f.anchor.every(Number.isFinite),name+' frame record');
}

// 모든 타임라인: 장 번호가 시트 안, 끝 시각이 늘어나며 동작 길이와 같다
const clipFor={combo0:'combo0',combo1:'combo1',combo2:'combo2',air:'air',dash:'dash',cast:'cast',special1:'special1',special5:'special5',
  thrust:'thrust',slam:'slam',whirl:'whirl',leap:'leap',redwave:'special4'};
const lengths={combo0:350,combo1:310,combo2:680,air:400,dash:D.dash.durMs,cast:640,special1:620,special5:2100,
  ...Object.fromEntries(Object.entries(D.skills).map(([id,s])=>[id,s.durMs]))};
for(const [id,line] of [...Object.entries(T).filter(([k])=>k!=='skill'),...Object.entries(T.skill)]){
  const frames=data[clipFor[id]].frames.length;
  line.forEach(([index,end],i)=>{
    assert.ok(index>=0&&index<frames,`${id}: frame ${index} outside ${frames}`);
    if(i)assert.ok(end>line[i-1][1],`${id}: end times must increase`);
  });
  assert.equal(line.at(-1)[1],lengths[id],`${id}: timeline length`);
}

const at=(actor,ms)=>rika.frameFor({characterId:'barel',z:0,vz:0,...actor,t:ms},1,0);
const index=f=>data[f.clip].frames.findIndex(r=>r.atlas.join()===f.atlas.join());
const is=(actor,ms,clip,i,label)=>{const f=at(actor,ms);assert.ok(f,label);assert.equal(f.clip,clip,label);assert.equal(index(f),i,label);};

// 3연타: 판정이 시작되는 순간 칼이 지나가는 장
is({st:'atk',atk:'c1'},128.5,'combo0',7,'일섬 판정 장');
is({st:'atk',atk:'c2'},105,'combo1',3,'역일섬 판정 장 (2타 7장 시트, 칼을 끝까지 올려벤 장)');
assert.equal(data.combo1.frames.length,7,'2타 7장');
is({st:'atk',atk:'c3'},300,'combo2',13,'참격 내려베기 장');
// 견제 찌르기: 판정 구간 동안 팔을 뻗은 장(6~7), 이동하지 않는 스킬
const poke=D.skills.thrust;
assert.equal(poke.name,'견제 찌르기');assert.ok(!poke.travelMs&&poke.reachPx>=120&&poke.behindPx===0,'stationary long poke');
for(let ms=poke.strikeMs[0];ms<poke.strikeMs[1];ms+=10)assert.ok([6,7].includes(index(at({st:'skill',skill:'thrust'},ms))),'poke extended at '+ms);
is({st:'skill',skill:'leap'},D.skills.leap.strikeMs,'leap',9,'점프 강하 착지 일격');
assert.equal(data.slam.frames.length,10,'내려찍기 10프레임');
is({st:'skill',skill:'slam'},D.skills.slam.strikeMs,'slam',7,'내려찍기 착지');
assert.equal(at({st:'skill',skill:'slam'},560).index,9,'마지막 내려찍기 프레임 식별');
is({st:'cast'},380,'cast',7,'뇌격 발사');
// 흑월참: 기 모으기(1타 시트) → 3연 베기(2~4타 시트) → 마무리(5타 시트 초승달)
const S={slashFromMs:620,slashMs:640/3,slashHitMs:[80,80,160],finMs:1580};
is({st:'special'},0,'special1',1,'흑월참 시작');
for(let k=0;k<3;k++){
  const start=S.slashFromMs+k*S.slashMs;
  assert.equal(at({st:'special'},start+1).clip,'special'+(k+2),'slash sheet '+k);
  assert.equal(index(at({st:'special'},start+S.slashHitMs[k])),2+Math.floor(S.slashHitMs[k]/S.slashMs*8),'slash hit '+k);
}
is({st:'special'},S.finMs,'special5',7,'초승달 마무리');
is({st:'special'},2099,'special5',9,'흑월참 끝');
assert.equal(at({st:'special',characterId:'viesa'},700),null,'비에사는 제외');
// 대시 찌르기는 찌르기 시트, 판정 틱(14~23)에 팔을 뻗은 장
for(let tick=14;tick<23;tick++)assert.ok([6,7].includes(index(rika.frameFor({characterId:'barel',st:'dash_attack',t:tick,z:0},1,0))),'dash attack tick '+tick);
// 대기·걷기·점프·피격·넉다운
is({st:'free'},0,'idle',0,'대기');
assert.equal(data.idle.frames.length,10,'대기 10장');
assert.equal(index(rika.frameFor({st:'free',z:0,vz:0,t:0},1,1299)),9,'대기 마지막 장');
assert.equal(index(rika.frameFor({st:'free',z:0,vz:0,t:0},1,1300)),0,'대기 1300ms 반복');
is({st:'free',walk:true,walkTime:0},0,'walk',1,'걷기');
is({st:'free',z:40,vz:3},0,'jump',5,'점프 상승');
is({st:'free',z:40,vz:-3},0,'jump',7,'점프 낙하');
is({st:'hurt',hurtDuration:17},0,'hurt',1,'피격 시작');
is({st:'down',z:0},30,'down',6,'넉다운 누움');
is({st:'down',z:0},54,'down',9,'기상 직전');
const view=rika.preview(0);assert.ok(view&&view.bounds[0]<0&&view.bounds[2]>0&&view.bounds[1]<0,'선택 화면 미리보기');

// 게임 코드의 흑월참 타이밍과 같은 값인지
const game=fs.readFileSync(path.join(root,'game.js'),'utf8');
assert.match(game,/slashFromMs: 620, slashMs: 640 \/ 3, slashHitMs: \[80, 80, 160\], finMs: 1580/);
console.log('PASS Barel Rika motions: 20 sheets, timelines, hit frames, poke thrust, three-slash ultimate');
