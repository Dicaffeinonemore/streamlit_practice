// Phase 11: measures the browser master chain (audio.js setup(): master gain .8 -> DynamicsCompressor
// threshold -14, ratio 5, attack .003, release .2, default 30 dB knee with automatic makeup) on steady
// sines, and fits Godot's AudioEffectCompressor to it. Writes godot/phase11/fixtures/compressor_curve.json.
// Godot's compressor (servers/audio/effects/audio_effect_compressor.cpp) is peak based:
//   over = 2.08136898 * dB(peak / threshold), gain reduction = over * (ratio - 1) / ratio, then makeup.
const {fs,path,root}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
const K=2.08136898;
function godot(inDb,t,r,g){const over=Math.max(0,K*(inDb-t));return inDb-over*(r-1)/r+g;}
async function main(){
  const b=await openBrowser();
  try{
    // Input amplitudes from -40 dBFS to +6 dBFS before the .8 master gain.
    const levels=[];for(let db=-40;db<=6;db+=2)levels.push(db);
    const measured=await b.evaluate(`(async()=>{
      const out=[];
      for(const db of ${JSON.stringify(levels)}){
        const rate=48000,c=new OfflineAudioContext(1,rate*1.5,rate);__BMK_OFFLINE.setup(c);
        const o=c.createOscillator();o.frequency.value=220;const g=c.createGain();g.gain.value=Math.pow(10,db/20);
        o.connect(g);g.connect(__BMK_OFFLINE.AU.master);o.start(0);
        const buf=await c.startRendering(),d=buf.getChannelData(0);let peak=0;
        for(let i=d.length-rate*.3;i<d.length;i++)peak=Math.max(peak,Math.abs(d[i]));
        out.push({inputDb:db,compressorInputDb:db+20*Math.log10(.8),outputDb:20*Math.log10(peak)});
      }
      return out;})()`);
    // Grid search Godot threshold / ratio / makeup over the compressor-input range that matters.
    let best=null;
    for(let t=-30;t<=0;t+=.5)for(let r=1;r<=4;r+=.02)for(let g=0;g<=12;g+=.1){
      let err=0;for(const m of measured){if(m.compressorInputDb<-34)continue;const d=godot(m.compressorInputDb,t,r,g)-m.outputDb;err+=d*d;}
      if(!best||err<best.err)best={err,threshold:t,ratio:+r.toFixed(2),gain:+g.toFixed(1)};
    }
    const fit=measured.map(m=>({...m,godotDb:godot(m.compressorInputDb,best.threshold,best.ratio,best.gain)}));
    const maxError=Math.max(...fit.filter(m=>m.compressorInputDb>=-34).map(m=>Math.abs(m.godotDb-m.outputDb)));
    const result={source:'audio.js setup() master chain, steady 220 Hz sine, peak of the last 0.3 s',browser:b.version.product,
      godot:{threshold_db:best.threshold,ratio:best.ratio,gain_db:best.gain,attack_us:2000,release_ms:200},maxErrorDb:maxError,points:fit};
    const out=path.join(root,'godot/phase11/fixtures');fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(path.join(out,'compressor_curve.json'),JSON.stringify(result,null,1)+'\n');
    console.log(JSON.stringify({godot:result.godot,maxErrorDb:+maxError.toFixed(2)}));
    for(const m of fit)console.log(m.inputDb.toString().padStart(4),'in',m.compressorInputDb.toFixed(1).padStart(6),'web',m.outputDb.toFixed(2).padStart(7),'godot',m.godotDb.toFixed(2).padStart(7));
  }finally{await b.close();}
}
main().catch(e=>{console.error(e.stack);process.exit(1);});
