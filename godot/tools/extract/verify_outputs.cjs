const {fs,path,project,output,hash}=require('./common.cjs');
const manifest=JSON.parse(fs.readFileSync(path.join(output,'catalogs/output_hashes.json'),'utf8'));
let errors=0;
for(const entry of manifest){const target=path.join(project,entry.file);if(!fs.existsSync(target)||hash(fs.readFileSync(target))!==entry.sha256){console.error('Changed output: '+entry.file);errors++;}}
console.log(`HASH VERIFY: ${manifest.length} generated files, ${errors} mismatches`);
if(process.argv[2]) {
  const previous=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const a=new Map(previous.map(f=>[f.file,f.sha256])),b=new Map(manifest.map(f=>[f.file,f.sha256]));
  const changed=[...new Set([...a.keys(),...b.keys()])].filter(k=>a.get(k)!==b.get(k));
  for(const file of changed)console.error('Non-deterministic: '+file);
  console.log(`REPEAT VERIFY: ${b.size} outputs, ${changed.length} changes`);errors+=changed.length;
}
process.exitCode=errors?1:0;
