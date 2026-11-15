const vm=require('node:vm');
const {fs,path,root,read,write,slug}=require('./common.cjs');
function extractAseprite(map) {
  const context={};context.globalThis=context;vm.createContext(context);vm.runInContext(read('src/animation/aseprite.js'),context);
  const animations=[],manifests=[];
  const dir=path.join(root,'assets/aseprite');
  function visit(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){if(entry.name==='tests'||entry.name==='source'||entry.name==='exports')continue;const file=path.join(folder,entry.name);if(entry.isDirectory())visit(file);else if(entry.name.endsWith('.animation.json'))manifests.push(file);}}
  visit(dir);
  for(const file of manifests.sort()) {
    const source=path.relative(root,file).replaceAll('\\','/');
    const metadata=JSON.parse(fs.readFileSync(file,'utf8'));
    const sprite=path.resolve(path.dirname(file),metadata.sprite);
    if(!sprite.startsWith(root+path.sep))throw Error('Aseprite source outside repository');
    const data=JSON.parse(fs.readFileSync(sprite,'utf8'));
    const parsed=context.AsepriteAnimation.parse(data,{metadata});
    const image=path.resolve(path.dirname(sprite),data.meta.image);
    if(!image.startsWith(root+path.sep))throw Error('Aseprite image outside repository');
    const id=slug(path.relative(dir,file).replaceAll('\\','/').replace(/\.animation\.json$/,''));
    const copied=write('aseprite/'+id+path.extname(image),fs.readFileSync(image));
    map[path.relative(root,image).replaceAll('\\','/')]=copied;
    write('aseprite/'+id+'.animation.json',fs.readFileSync(file));
    write('aseprite/'+id+'.source.json',fs.readFileSync(sprite));
    for(const[name,clip]of Object.entries(parsed.clips))animations.push({id:'aseprite_'+id+'_'+slug(name),metadata:{source,metadata,tag:clip.tag,loop:clip.loop},frames:clip.frames.map(f=>({image:copied,rect:f.atlas,pivot:f.anchor,scale:metadata.renderScale??1,duration_ms:f.duration,source:f}))});
  }
  console.log(`Aseprite: ${manifests.length} original manifests parsed and validated`);
  return animations;
}
module.exports={extractAseprite};
