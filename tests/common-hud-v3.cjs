const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('common-hud-v3.js','utf8');
const draws=[];
const ctx={save(){},restore(){},drawImage(...args){draws.push(args)},fillRect(){},fillText(){},strokeText(){},beginPath(){},rect(){},clip(){},translate(){},scale(){},measureText(){return {width:10}}};
class Img { constructor(){this.complete=true;this.naturalWidth=100;this.width=100;this.height=100} }
const sandbox={Image:Img,ctx,W:960,H:540,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),SP_MAX:100,scene:'pause',stageIdx:0,isViesa:p=>p.viesa,portrait:()=>new Img(),hudBossFace:()=>new Img(),lagTo:(_,__,v)=>v};
vm.createContext(sandbox); vm.runInContext(source,sandbox);
assert.equal(vm.runInContext('drawCompactPlayer({hp:50,max:100,sp:50,mg:1,lives:3,score:10})',sandbox),true);
assert.equal(draws.filter(x=>x[0].src?.endsWith('/scroll_icon.png')).length,1,'only remaining scroll is drawn');
assert.equal(draws.filter(x=>x[0].src?.endsWith('/scroll_icon_empty.png')).length,2,'spent scrolls use their silhouette asset');
draws.length=0;
assert.equal(vm.runInContext('drawCompactEnemy({hp:0,max:100,d:{name:"Enemy"}})',sandbox),true);
assert.equal(draws.filter(x=>x[0].src?.endsWith('/enemy_health_fill.png')).length,0,'empty enemy bar has no fill');
console.log('Compact HUD: player scroll and empty enemy HP passed');
