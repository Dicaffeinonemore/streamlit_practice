const {fs,path,root,output,read,hash,write,json,slug} = require('./common.cjs');
async function exportManifest(snapshot) {
  const required=new Set(JSON.parse(read('data/runtime-assets.json')));
  const aliases=new Map();const provenance=[];
  function walk(value,trail,raw=false) {
    if(typeof value==='string'&&/^assets\//.test(value)&&/\.(png|webp|gif|jpg|jpeg|mp3)$/i.test(value)){
      if(value.startsWith('assets/runtime/'))required.add(value);
      if(!aliases.has(value))aliases.set(value,[]);aliases.get(value).push(trail);
      if(!value.startsWith('assets/runtime/'))provenance.push({source:value,alias:trail,exists:fs.existsSync(path.join(root,value)),runtime:!raw});
    } else if(Array.isArray(value))value.forEach((v,i)=>walk(v,trail+'.'+i,raw));
    else if(value&&typeof value==='object')for(const[k,v]of Object.entries(value))walk(v,trail+'.'+k,raw||['sources','source','original','path'].includes(k)&&!String(v).startsWith('assets/runtime/'));
  }
  walk(snapshot,'source');
  // Include every literal runtime reference, including icon or replacement atlases outside catalogs.
  for(const file of snapshot.script_order)for(const m of read(file).matchAll(/assets\/runtime\/[a-f0-9]+\.(png|webp|gif|jpg|jpeg)/g))required.add(m[0]);
  const map={};const entries=[];const seen=new Map();
  for(const source of [...required].sort()) {
    if(!fs.existsSync(path.join(root,source)))throw Error('Missing required runtime asset: '+source);
    const bytes=fs.readFileSync(path.join(root,source)),digest=hash(bytes);
    const names=[...new Set(aliases.get(source)||[])].sort();
    const semantic=slug((names.find(x=>!x.includes('IMAGES')&&!x.includes('sources'))||'runtime_unreferenced').replace(/^source\./,'')).slice(0,105);
    const destination=seen.get(digest)||write('images/'+semantic+'__'+digest.slice(0,12)+path.extname(source),bytes);
    seen.set(digest,destination);map[source]=destination;
    entries.push({source,destination,sha256:digest,bytes:bytes.length,aliases:names});
  }
  map['assets/bgm/boss.mp3']=write('audio/original/boss.mp3',fs.readFileSync(path.join(root,'assets/bgm/boss.mp3')));
  entries.push({source:'assets/bgm/boss.mp3',destination:map['assets/bgm/boss.mp3'],sha256:hash(fs.readFileSync(path.join(root,'assets/bgm/boss.mp3'))),aliases:['default_boss_bgm']});
  json('catalogs/asset_map.json',{entries,provenance});
  return {map,entries,provenance};
}
module.exports={exportManifest};
