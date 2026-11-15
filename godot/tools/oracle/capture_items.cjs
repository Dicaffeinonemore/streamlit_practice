const {fs,path,root,canonical}=require('../extract/common.cjs');
const {openBrowser}=require('../extract/browser.cjs');
async function main(){const b=await openBrowser();try{
 await b.evaluate('ITEM_READY');const keys=await b.evaluate('Object.keys(ITEM_SPRITES)');const catalog={};
 const dir=path.join(root,'godot/phase3/assets/items');fs.mkdirSync(dir,{recursive:true});
 for(const key of keys){const item=await b.evaluate(`(()=>{const s=ITEM_SPRITES[${JSON.stringify(key)}],c=document.createElement('canvas');c.width=s.w;c.height=s.h;c.getContext('2d').drawImage(s.image,s.x,s.y,s.w,s.h,0,0,s.w,s.h);return {w:s.w,h:s.h,png:c.toDataURL('image/png').split(',')[1]};})()`);fs.writeFileSync(path.join(dir,key+'.png'),Buffer.from(item.png,'base64'));catalog[key]={w:item.w,h:item.h};}
 fs.writeFileSync(path.join(dir,'index.json'),JSON.stringify(canonical(catalog),null,2)+'\n');console.log('Exported '+keys.length+' original prepared item cutouts');
}finally{await b.close();}}main().catch(e=>{console.error(e.stack);process.exit(1);});
