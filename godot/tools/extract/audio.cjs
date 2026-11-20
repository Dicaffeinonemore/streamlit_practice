const {fs,path,root,project,read,hash,write,json,python,cp}=require('./common.cjs');
const audioSources=['score.js','audio.js','death-sfx.js','barel-sfx.js','viesa-sfx.js','aurelion-sfx.js','gorath-hook-sfx.js','gorath-charge-sfx.js'];
// Phase 11: synthesized effects are captured at the SFX bus input (sfxB gain = SYNTH_RENDER_GAIN), before the
// master gain and compressor, which the native mix bus applies once to the whole mix like the browser.
const SYNTH_RENDER_GAIN=.5;
const sourceKey=browser=>hash(audioSources.map(read).join('\n')+'\n'+browser.version.product+'\n48000/pcm16/soundfile-0.13.1/libsndfile-1.2.2/synth-pre-master-'+SYNTH_RENDER_GAIN);
function sealAudioCache(browser) {
  const manifest=JSON.parse(fs.readFileSync(path.join(project,'port_assets/catalogs/audio.json'),'utf8'));
  const recorded=JSON.parse(fs.readFileSync(path.join(project,'port_assets/catalogs/toolchain.json'),'utf8'));
  for(const file of audioSources)if(recorded.source_hashes[file]!==hash(read(file)))throw Error('Canonical audio belongs to different source: '+file);
  if(recorded.browser!==browser.version.product)throw Error('Canonical audio browser version changed');
  manifest.source_cache_key=sourceKey(browser);
  manifest.output_hashes=[...manifest.embedded,...manifest.synthesized,...manifest.music.flatMap(t=>[{file:t.file},{file:t.pcm},...(t.intro?[{file:t.intro}]:[])])].map(f=>({file:f.file,sha256:hash(fs.readFileSync(path.join(project,f.file)))}));
  manifest.canonical_policy='Preserve source-keyed PCM captures as build inputs. Chromium convolution float LSBs vary between fresh captures; --rerender-audio explicitly replaces this baseline.';
  json('catalogs/audio.json',manifest);
  return manifest;
}
function pcmWav(channels,rate=48000) {
  const count=channels[0].length,header=Buffer.alloc(44),data=Buffer.alloc(count*channels.length*2);
  header.write('RIFF');header.writeUInt32LE(36+data.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(channels.length,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*channels.length*2,28);header.writeUInt16LE(channels.length*2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
  for(let i=0;i<count;i++)for(let ch=0;ch<channels.length;ch++)data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,channels[ch][i]))*32767),(i*channels.length+ch)*2);
  return Buffer.concat([header,data]);
}
async function bufferFromBrowser(browser,expression) {
  await browser.evaluate(`(async()=>{globalThis.__rendered=await (${expression});return __rendered.length;})()`);
  const info=await browser.evaluate('({length:__rendered.length,channels:__rendered.numberOfChannels,rate:__rendered.sampleRate})');
  const channels=[];
  for(let ch=0;ch<info.channels;ch++){
    const chunks=[];
    for(let at=0;at<info.length;at+=240000){const bytes=await browser.evaluate(`(()=>{const f=__rendered.getChannelData(${ch}).slice(${at},${Math.min(info.length,at+240000)}),b=new Uint8Array(f.buffer);let s='';for(let i=0;i<b.length;i+=16384)s+=String.fromCharCode(...b.subarray(i,i+16384));return btoa(s);})()`);chunks.push(Buffer.from(bytes,'base64'));}
    const b=Buffer.concat(chunks);channels.push(new Float32Array(b.buffer,b.byteOffset,b.length/4));
  }
  await browser.evaluate('globalThis.__rendered=null');return {...info,channel_count:info.channels,channels};
}
async function extractAudio(browser) {
  const cacheKey=sourceKey(browser);
  const previousPath=path.join(project,'port_assets/catalogs/audio.json');
  if(fs.existsSync(previousPath)&&!process.argv.includes('--rerender-audio')) {
    const previous=JSON.parse(fs.readFileSync(previousPath,'utf8'));
    if(previous.source_cache_key===cacheKey&&previous.output_hashes?.every(f=>fs.existsSync(path.join(project,f.file))&&hash(fs.readFileSync(path.join(project,f.file)))===f.sha256)) {
      console.log('Audio: verified source-keyed canonical PCM/OGG cache');return previous;
    }
  }
  const embedded=await browser.evaluate(`({death:{mobdie:ENEMY_DEATH_SFX_URL},barel:BAREL_SFX_URLS,viesa:VIESA_SFX_URLS,aurelion:AURELION_SFX_URLS,gorath:{g2hook:GORATH_HOOK_SFX_URL,g2charge:GORATH_CHARGE_SFX_URL}})`);
  const manifest={schema:1,synth_render_gain:SYNTH_RENDER_GAIN,mix:'browser: voices -> sfxB(.9 x sfx volume) -> master .8 -> DynamicsCompressor; music -> engine bus -> musB(.34 x music volume) -> master. Synthesized WAVs stop at the sfxB input (scaled by synth_render_gain); music OGGs include .34 x bus 2.5; samples are raw.',source_cache_key:cacheKey,sample_rate:48000,embedded:[],synthesized:[],music:[],priority:['custom_boss_file','original/boss.mp3','synthesized_boss_track'],sample_playback_source:read('audio.js').slice(read('audio.js').indexOf('  const GORATH_SAMPLE_FALLBACK'),read('audio.js').indexOf('  async function renderPreview'))};
  for(const[group,values]of Object.entries(embedded))for(const[key,uri]of Object.entries(values)){
    const match=uri.match(/^data:audio\/mpeg;base64,(.+)$/);if(!match)throw Error('Unsupported embedded audio');
    const bytes=Buffer.from(match[1],'base64');const file=write(`audio/original/${group}/${key}.mp3`,bytes);
    const details=await browser.evaluate(`(async()=>{const c=new OfflineAudioContext(2,1,48000),b=await c.decodeAudioData(await(await fetch(${JSON.stringify(uri)})).arrayBuffer());let first=b.length;for(let ch=0;ch<b.numberOfChannels;ch++){const d=b.getChannelData(ch);for(let i=0;i<first;i++)if(Math.abs(d[i])>.003){first=i;break;}}return {duration:b.duration,channels:b.numberOfChannels,sample_rate:b.sampleRate,leading_silence_offset:Math.max(0,first/b.sampleRate-.002)};})()`);
    manifest.embedded.push({key,namespace:group,file,sha256:hash(bytes),...details});
  }
  const keys=await browser.evaluate('Object.keys(__BMK_OFFLINE.SFX)');
  for(const key of keys)for(const variant of [0,1,2]) {
    const audio=await bufferFromBrowser(browser,`(async()=>{let seed=11939;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);const c=new OfflineAudioContext(2,48000*4,48000);__BMK_OFFLINE.setup(c);const A=__BMK_OFFLINE.AU;A.sfxB.disconnect();A.sfxB.gain.value=${SYNTH_RENDER_GAIN};A.sfxB.connect(c.destination);A.gm=__BMK_OFFLINE.GAIN[${JSON.stringify(key)}]||1;__BMK_OFFLINE.SFX[${JSON.stringify(key)}](${variant});return await c.startRendering();})()`);
    let end=audio.length;while(end>1&&audio.channels.every(ch=>Math.abs(ch[end-1])<0.00003))end--;
    end=Math.min(audio.length,end+480);const channels=audio.channels.map(c=>c.slice(0,end));
    const file=write(`audio/sfx/${key}_${variant}.wav`,pcmWav(channels,audio.rate));
    manifest.synthesized.push({key,variant,file,samples:end,sample_rate:audio.rate,source:'audio.js SFX at the sfxB input x synth_render_gain (GAIN table applied, no master/compressor)'});
  }
  const tracks=await browser.evaluate('SCORE.tracks.map((t,i)=>({...t,id:(i<5?"stage_":"boss_")+(i%5+1),index:i}))');
  const victory=await browser.evaluate('SCORE.victory');
  for(const[id,t]of Object.entries(victory))tracks.push({...t,id,index:null});
  for(const track of tracks) {
    const step=60/track.bpm/4;
    const victoryTrack=track.victory===true;
    const loopSteps=victoryTrack?128:256;
    const warmSteps=victoryTrack?160:256;
    const totalSteps=warmSteps+loopSteps;
    const sampleRate=48000;
    console.log(`Rendering ${track.id}: ${(loopSteps*step).toFixed(2)}s loop`);
    const audio=await bufferFromBrowser(browser,`(async()=>{const T=${JSON.stringify(track)},rate=48000,c=new OfflineAudioContext(2,Math.ceil((${totalSteps}*${step}+4)*rate),rate),g=c.createGain();g.gain.value=.34;g.connect(c.destination);const e=SCORE.create(c,g);e.bus.gain.value=2.5;for(let st=0;st<${totalSteps};st++)SCORE.step(e,T,st,st*${step},${step});const b=await c.startRendering();e.dispose();return b;})()`);
    const start=Math.round(warmSteps*step*sampleRate),length=Math.round(loopSteps*step*sampleRate);
    const channels=audio.channels.map(c=>c.slice(start,start+length));
    const wav=write(`audio/pcm/${track.id}_loop.wav`,pcmWav(channels));
    const first=channels.map(c=>c[0]),last=channels.map(c=>c[c.length-1]);
    const entry={id:track.id,name:track.name,bpm:track.bpm,pcm:wav,file:`port_assets/audio/music/${track.id}_loop.ogg`,loop_start:0,loop_end:length,sample_rate:sampleRate,loop_steps:loopSteps,warmup_steps:warmSteps,source:'score.js SCORE.create/step; gain .34 x bus 2.5; no preview fade',seam_delta:Math.max(...first.map((v,i)=>Math.abs(v-last[i])))};
    // Preserve the exact initial fanfare separately from its warmed-up repeating march.
    if(victoryTrack){const introSamples=Math.round(32*step*sampleRate);entry.intro=write(`audio/music/${track.id}_intro.wav`,pcmWav(audio.channels.map(c=>c.slice(0,introSamples))));entry.intro_samples=introSamples;}
    manifest.music.push(entry);
  }
  json('catalogs/audio.json',manifest);
  const encoder=cp.spawnSync(python(),[path.join(__dirname,'encode_ogg.py')],{cwd:root,encoding:'utf8',maxBuffer:1024*1024,windowsHide:true});
  if(encoder.status!==0)throw Error(String(encoder.error||encoder.signal||'Encoder failure')+'\n'+encoder.stdout+'\n'+encoder.stderr);
  console.log(encoder.stdout.trim());
  const final=JSON.parse(fs.readFileSync(path.join(project,'port_assets/catalogs/audio.json'),'utf8'));
  final.output_hashes=[...final.embedded,...final.synthesized,...final.music.flatMap(t=>[{file:t.file},{file:t.pcm},...(t.intro?[{file:t.intro}]:[])])].map(f=>({file:f.file,sha256:hash(fs.readFileSync(path.join(project,f.file)))}));
  json('catalogs/audio.json',final);
  return final;
}
module.exports={extractAudio,sealAudioCache};
