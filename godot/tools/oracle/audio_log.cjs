// Phase 11: records every AUDIO.sfx / music request the original game makes, per executed step.
// Injected into each phase oracle right after Math.random is fixed; frames carry audio:[...].
//   ['sfx', name, variant]   variant = the numeric second argument (0 when absent or an options object)
//   ['music', 'stage' | 'boss' | 'victory' | 'ending']   ['stop', fadeSeconds]
module.exports.hook=`globalThis.__audioLog=[];if(!AUDIO.__phase11){AUDIO.__phase11=true;const wrap=(k,f)=>{const o=AUDIO[k];AUDIO[k]=(...a)=>{__audioLog.push(f(...a));return o(...a);};};wrap('sfx',(n,a)=>['sfx',n,typeof a==='number'?a:0]);wrap('music',()=>['music','stage']);wrap('bossMusic',()=>['music','boss']);wrap('victoryMusic',(i,f)=>['music',f?'ending':'victory']);wrap('stop',f=>['stop',f??0]);wrap('silence',()=>['stop',.25]);}`;
