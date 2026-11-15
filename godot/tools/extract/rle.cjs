const vm=require('node:vm');
const {read,write,json,dependency,hash}=require('./common.cjs');
const sharp=dependency('sharp');
async function packFrames(id,frames,folder='baked') {
  const pages=[];let rects=[],composites=[],x=1,y=1,row=0,page=0;
  async function flush(){if(!composites.length)return;const h=y+row+1,rgba=Buffer.alloc(2048*h*4);for(const q of composites)for(let row=0;row<q.h;row++)q.rgba.copy(rgba,((q.top+row)*2048+q.left)*4,row*q.w*4,(row+1)*q.w*4);const png=await sharp(rgba,{raw:{width:2048,height:h,channels:4}}).png({compressionLevel:9,adaptiveFiltering:false}).toBuffer();pages.push(write(`${folder}/${id}_${page}.png`,png));page++;composites=[];x=1;y=1;row=0;}
  for(const f of frames){if(f.w+2>2048||f.h+2>2048)throw Error('Oversized bake frame');if(x+f.w+1>2048){x=1;y+=row+2;row=0;}if(y+f.h+1>2048)await flush();rects.push({page,rect:[x,y,f.w,f.h],pivot:f.pivot||[f.w/2,f.h],scale:f.scale??1,duration_ms:f.duration_ms??null,expected_rgba_sha256:hash(f.rgba),source:f.metadata||{}});composites.push({rgba:f.rgba,w:f.w,h:f.h,left:x,top:y});x+=f.w+2;row=Math.max(row,f.h);}
  await flush();return rects.map(f=>({...f,image:pages[f.page]}));
}
async function extractRle(s,browser) {
  const code=read('game.js');const start=code.indexOf('function sealSpritePinholes('),end=code.indexOf('\nconst HD =',start);
  const context={};vm.createContext(context);vm.runInContext(code.slice(start,end),context);
  const animations=[];const verification=[];
  for(const[id,art]of Object.entries(s.HD_DATA)) {
    const raw=[],presented=[];
    for(const f of art.f){const rgba=Buffer.alloc(f.w*f.h*4),rle=Buffer.from(f.d,'base64');let p=0;for(let i=0;i<rle.length;i+=2){const index=rle[i],run=rle[i+1];if(p+run>f.w*f.h)throw Error('RLE overflow');if(index){const color=art.pal[index-1];if(!color)throw Error('Invalid palette index');const value=parseInt(color.slice(1),16);for(let k=0;k<run;k++){const at=(p+k)*4;rgba[at]=value>>16&255;rgba[at+1]=value>>8&255;rgba[at+2]=value&255;rgba[at+3]=255;}}p+=run;}if(p!==f.w*f.h)throw Error('RLE underflow');const meta={w:f.w,h:f.h,pivot:[f.ax,f.ay],scale:s.HD_SCALE?.[id]||1,metadata:{names:Object.entries(art.n).filter(([,v])=>v===raw.length).map(([k])=>k)}};raw.push({...meta,rgba});const copy=Buffer.from(rgba);if(id==='player')context.sealSpritePinholes({w:f.w,h:f.h,d:copy});presented.push({...meta,rgba:copy});}
    const expected=await browser.evaluate(`HD[${JSON.stringify(id)}].F.map(f=>__b64(f.L.d))`);
    for(let i=0;i<presented.length;i++){if(!presented[i].rgba.equals(Buffer.from(expected[i],'base64')))throw Error(`RLE pixel mismatch ${id}:${i}`);}
    const rawFrames=await packFrames('rle_'+id+'_raw',raw,'rle');
    const displayFrames=id==='player'?await packFrames('rle_'+id+'_presented',presented,'rle'):rawFrames;
    animations.push({id:'rle_'+id,frames:displayFrames,metadata:{source:'HD_DATA',names:art.n,hd_scale:s.HD_SCALE?.[id]||1,raw_frames:rawFrames,pinhole_repair:id==='player'}});
    verification.push({id,frames:presented.length,exact_rgba_matches:presented.length});
    console.log(`RLE ${id}: ${presented.length} frames verified`);
  }
  json('catalogs/rle_verification.json',verification);return animations;
}
module.exports={packFrames,extractRle};
