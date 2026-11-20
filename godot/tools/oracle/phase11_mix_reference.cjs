// Phase 11: renders phase11/fixtures/mix_scenario.json through the browser chain of audio.js:
// setup() (sfxB, musB, master .8, DynamicsCompressor), the synthesized SFX table with its GAIN
// corrections, playBarelSample() offsets/cut, playViesaSkill(), the enemy-death sample, and music()
// transitions (old track fades .6 s / .4 s, the new one rises over .8 s / .05 s). Scores are the
// extracted loops (their synthesis was verified at extraction), fed back through musB at the engine
// level (the OGGs carry .34 x 2.5). Usage: node phase11_mix_reference.cjs <out.wav>
const {fs,path,root}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
function pcmWav(channels,rate){const count=channels[0].length,header=Buffer.alloc(44),data=Buffer.alloc(count*channels.length*2);
  header.write('RIFF');header.writeUInt32LE(36+data.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(channels.length,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*channels.length*2,28);header.writeUInt16LE(channels.length*2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
  for(let i=0;i<count;i++)for(let ch=0;ch<channels.length;ch++)data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,channels[ch][i]))*32767),(i*channels.length+ch)*2);
  return Buffer.concat([header,data]);}
async function main(){
  const out=process.argv[2];if(!out)throw Error('usage: phase11_mix_reference.cjs <out.wav>');
  const scenario=JSON.parse(fs.readFileSync(path.join(root,'godot/phase11/fixtures/mix_scenario.json'),'utf8'));
  const b64=f=>fs.readFileSync(path.join(root,f)).toString('base64');
  const files={stage:b64(`godot/port_assets/audio/music/stage_${scenario.stage}_loop.ogg`),victoryIntro:b64('godot/port_assets/audio/music/victory_intro.wav'),
    victoryLoop:b64('godot/port_assets/audio/music/victory_loop.ogg'),boss:b64('godot/port_assets/audio/original/boss.mp3')};
  const b=await openBrowser();
  try{
    await b.evaluate(`globalThis.__mixFiles=${JSON.stringify(files)};true`);
    const info=await b.evaluate(`(async()=>{
      const S=${JSON.stringify(scenario)},rate=48000,c=new OfflineAudioContext(2,Math.ceil(S.seconds*rate),rate);
      __BMK_OFFLINE.setup(c);const A=__BMK_OFFLINE.AU;
      // setVolumes(music, effects) after setup.
      A.musB.gain.value=.34*S.music_volume;A.sfxB.gain.value=.9*S.sfx_volume;
      const raw=s=>Uint8Array.from(atob(s),ch=>ch.charCodeAt(0)).buffer;
      const decode=async s=>await c.decodeAudioData(raw(s));
      const offsetOf=buf=>{let first=buf.length;for(let ch=0;ch<buf.numberOfChannels;ch++){const d=buf.getChannelData(ch);for(let i=0;i<first;i++)if(Math.abs(d[i])>.003){first=i;break;}}return Math.max(0,first/buf.sampleRate-.002);};
      const samples={};
      for(const [k,u] of Object.entries({...BAREL_SFX_URLS,aurelionWave:AURELION_SFX_URLS.aurelionWave}))samples[k]={kind:'barel',buf:await decode(u.split(',')[1])};
      for(const [k,u] of Object.entries({...VIESA_SFX_URLS,aurelionExplosion:AURELION_SFX_URLS.aurelionExplosion}))samples[k]={kind:'viesa',buf:await decode(u.split(',')[1])};
      samples.mobdie={kind:'death',buf:await decode(ENEMY_DEATH_SFX_URL.split(',')[1])};
      const music={stage:await decode(__mixFiles.stage),boss:await decode(__mixFiles.boss),victoryIntro:await decode(__mixFiles.victoryIntro),victoryLoop:await decode(__mixFiles.victoryLoop)};
      let current=null;const fades=[];
      const startTrack=(id,t)=>{
        if(current){const g=current.gain;g.gain.setValueAtTime(g.gain.value,t);g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(current.level,t);g.gain.linearRampToValueAtTime(0,t+(id==='victory'?.4:.6));}
        const g=c.createGain(),win=id==='victory',level=id==='boss'?2:1/.34;g.connect(A.musB);
        g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(level,t+(win?.05:.8));
        if(win){const a=c.createBufferSource();a.buffer=music.victoryIntro;a.connect(g);a.start(t);
          const l=c.createBufferSource();l.buffer=music.victoryLoop;l.loop=true;l.connect(g);l.start(t+music.victoryIntro.duration);}
        else{const s=c.createBufferSource();s.buffer=music[id];s.loop=true;s.connect(g);s.start(t);}
        current={gain:g,level};
      };
      for(const ev of S.events){
        if(ev.music){startTrack(ev.music,ev.t);continue;}
        const name=ev.sfx==='hurtH'&&samples.hurt?'hurt':ev.sfx,s=samples[name];
        if(s){
          const src=c.createBufferSource();src.buffer=s.buf;const off=s.kind==='viesa'?0:offsetOf(s.buf);
          if(name==='barelCombo'){const d=Math.min(.88,s.buf.duration-off),g=c.createGain();g.gain.setValueAtTime(1,ev.t);g.gain.setValueAtTime(1,ev.t+Math.max(0,d-.008));g.gain.linearRampToValueAtTime(0,ev.t+d);src.connect(g);g.connect(A.sfxB);src.start(ev.t,off,d);}
          else{src.connect(A.sfxB);src.start(ev.t,off);}
        }else{
          c.suspend(ev.t).then(()=>{let seed=11939;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
            A.gm=__BMK_OFFLINE.GAIN[ev.sfx]||1;__BMK_OFFLINE.SFX[ev.sfx](ev.variant);A.gm=1;c.resume();});
        }
      }
      globalThis.__rendered=await c.startRendering();return {length:__rendered.length,channels:__rendered.numberOfChannels};
    })()`);
    const channels=[];
    for(let ch=0;ch<info.channels;ch++){const parts=[];
      for(let at=0;at<info.length;at+=240000){const s=await b.evaluate(`__b64(new Uint8Array(__rendered.getChannelData(${ch}).slice(${at},${Math.min(info.length,at+240000)}).buffer))`);parts.push(Buffer.from(s,'base64'));}
      const buf=Buffer.concat(parts);channels.push(new Float32Array(buf.buffer,buf.byteOffset,buf.length/4));}
    fs.writeFileSync(out,pcmWav(channels,48000));
    console.log('PHASE 11 REFERENCE: '+out+' '+(info.length/48000).toFixed(2)+' s');
  }finally{await b.close();}
}
main().catch(e=>{console.error(e.stack);process.exit(1);});
