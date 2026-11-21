// Phase 12: writes phase12/core/demo_steps.gd from the source DEMO_STEPS recorded by
// phase12_traces.cjs (phase12/fixtures/traces.json). Run after the oracle when the steps change.
const {fs,path,root}=require('../extract/common.cjs');
const f=JSON.parse(fs.readFileSync(path.join(root,'godot/phase12/fixtures/traces.json'),'utf8'));
const esc=s=>JSON.stringify(s);
const val=v=>Array.isArray(v)?'['+v.map(val).join(',')+']':(v&&typeof v==='object')?'{'+Object.entries(v).map(([k,x])=>esc(k)+':'+val(x)).join(',')+'}':v===null?'null':esc(v);
let out='class_name BmkDemoSteps\nextends RefCounted\n## demo-runtime.js DEMO_STEPS, generated from the source by tools/oracle/phase12_steps.cjs\n## (phase12/fixtures/traces.json). script: [kind, action, start ms, press ms]; setup: {sp} or {mg}.\nconst MAX_MS: float = '+f.meta.maxMs+'.0\nconst STEPS: Dictionary = {\n';
for(const c of ['barel','viesa']){out+='\t'+esc(c)+': [\n';for(const s of f.steps[c])out+='\t\t'+val({title:s.title,keys:s.keys,dummy:s.dummy,desc:s.desc,script:s.script,setup:s.setup})+',\n';out+='\t],\n';}
out+='}\n';
fs.writeFileSync(path.join(root,'godot/phase12/core/demo_steps.gd'),out);
console.log('demo_steps.gd: '+f.steps.barel.length+' + '+f.steps.viesa.length+' steps');
