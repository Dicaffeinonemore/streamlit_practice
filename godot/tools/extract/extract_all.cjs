const {fs,path,root,project,output,read,write,json,hash,dependency}=require('./common.cjs');
const {openBrowser}=require('./browser.cjs');
const {captureCatalogs,normalizeCatalogs}=require('./catalogs.cjs');
const {exportManifest}=require('./manifest.cjs');
const {extractAseprite}=require('./aseprite.cjs');
const {extractRle,packFrames}=require('./rle.cjs');
const {bakeVisuals}=require('./bake_visuals.cjs');
const {extractAudio,sealAudioCache}=require('./audio.cjs');
const sharp=dependency('sharp');
async function main() {
  write('audio/pcm/.gdignore','');
  const browser=await openBrowser();
  try {
    console.log('Source initialized: '+browser.version.product);
    const snapshot=await captureCatalogs(browser);
    json('catalogs/source_snapshot.json',snapshot);
    const assets=await exportManifest(snapshot);
    console.log(`Original images: ${assets.entries.length-1} paths resolved`);
    const catalog=normalizeCatalogs(snapshot,assets.map);
    catalog.animations.push(...extractAseprite(assets.map));
    for(const entry of assets.entries.filter(e=>e.source.endsWith('.gif'))) {
      const metadata=await sharp(path.join(root,entry.source),{animated:true}).metadata();
      const frames=[];
      for(let page=0;page<metadata.pages;page++){
        const {data,info}=await sharp(path.join(root,entry.source),{page,pages:1}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
        frames.push({w:info.width,h:info.height,pivot:[0,0],duration_ms:metadata.delay[page],rgba:data});
      }
      catalog.animations.push({id:'title_original_gif',frames:await packFrames('title_original_gif',frames,'gif'),metadata:{source:entry.source,loop:metadata.loop,delays:metadata.delay}});
    }
    if(!process.argv.includes('--catalogs-only')) {
      catalog.animations.push(...await extractRle(snapshot,browser));
      const baked=await bakeVisuals(browser);catalog.animations.push(...baked.animations);
      json('catalogs/bake_recipes.json',baked.recipes);
    }
    // Every normalized frame must point to a real supported texture with valid bounds.
    const dimensions=new Map();let frames=0;let bakedChecks=0;let lastImage='';let decoded=null;
    for(const animation of catalog.animations)for(const f of animation.frames){
      if(!f.rect||f.rect.length!==4||!f.pivot?.every(Number.isFinite)||!Number.isFinite(f.scale))throw Error('Invalid frame metadata: '+animation.id);
      const filename=path.join(project,f.image);
      if(!dimensions.has(filename))dimensions.set(filename,await sharp(filename).metadata());
      const dim=dimensions.get(filename),[x,y,w,h]=f.rect;
      if(x<0||y<0||w<=0||h<=0||x+w>dim.width||y+h>dim.height)throw Error('Frame exceeds atlas: '+animation.id+' '+JSON.stringify(f.rect)+' '+filename);
      if(f.expected_rgba_sha256){
        if(lastImage!==filename){decoded=await sharp(filename).ensureAlpha().raw().toBuffer();lastImage=filename;}
        const rgba=Buffer.alloc(w*h*4);for(let row=0;row<h;row++)decoded.copy(rgba,row*w*4,((y+row)*dim.width+x)*4,((y+row)*dim.width+x+w)*4);
        if(hash(rgba)!==f.expected_rgba_sha256)throw Error('Baked PNG changed original RGBA: '+animation.id);
        bakedChecks++;
      }
      frames++;
    }
    // Keep authoritative source catalogs separately: no source fields are discarded.
    const sourceCatalogs=catalog.source_catalogs;delete catalog.source_catalogs;
    json('catalogs/source_catalogs.json',sourceCatalogs);
    json('catalogs/animations.json',catalog);
    if(!process.argv.includes('--catalogs-only')) {
      if(process.argv.includes('--reuse-audio')) {
        const audio=JSON.parse(fs.readFileSync(path.join(output,'catalogs/audio.json'),'utf8'));
        if(!audio.encoder)throw Error('Reusable encoded audio is not available');
        for(const track of audio.music)if(hash(fs.readFileSync(path.join(project,track.file)))!==track.ogg_sha256)throw Error('Reusable OGG hash mismatch');
        sealAudioCache(browser);
        console.log('Reusing verified audio; use a full run for audio determinism checks');
      } else await extractAudio(browser);
    }
    const validation={schema:1,animation_count:catalog.animations.length,frame_count:frames,texture_count:dimensions.size,original_asset_paths:assets.entries.length-1,baked_rgba_matches:bakedChecks,missing_assets:0,out_of_bounds_frames:0,source_errors:browser.errors};
    if(new Set(catalog.animations.map(a=>a.id)).size!==catalog.animations.length)throw Error('Duplicate animation identifiers');
    if(browser.errors.length)throw Error('Source runtime errors: '+browser.errors.join('\n'));
    json('catalogs/validation.json',validation);
    json('catalogs/toolchain.json',{node:process.version,sharp:sharp.versions,browser:browser.version.product,source_hashes:snapshot.source_hashes});
    console.log(JSON.stringify(validation));
    if(!process.argv.includes('--catalogs-only')) {
      const {compare}=require('./compare.cjs');await compare(browser,catalog,assets);
    }
    const files=[];
    function visit(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){if(e.name!=='resources')visit(p);}else if(!e.name.endsWith('.import')&&e.name!=='output_hashes.json')files.push({file:path.relative(project,p).replaceAll('\\','/'),sha256:hash(fs.readFileSync(p))});}}
    visit(output);json('catalogs/output_hashes.json',files.sort((a,b)=>a.file.localeCompare(b.file)));
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error.stack);process.exit(1);});
