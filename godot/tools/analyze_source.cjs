// Phase 0 only: inventory source files and global bindings; never execute game code.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let acorn;
try { acorn = require('acorn'); } catch {
  // Node 24 ships Acorn internally. This fallback avoids installing dependencies.
  const source = process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];
  if (!source) throw Error('Use Node 24 or install acorn to regenerate the analysis.');
  const context = {exports: {}}; context.module = {exports: context.exports};
  vm.runInNewContext(source, context); acorn = context.exports;
}
const html = read('index.html');
const files = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map(m => m[1]);
const serverFiles = JSON.parse(read('server.py').match(/^SCRIPTS = (\[.*\])/m)[1]);
const aliases = new Set(['globalThis', 'window', 'global', 'root']);
const modules = [];
const dynamic = [];
function owner(file, name) {
  if (file === 'perf-runtime.js') return 'AssetRegistry (GameAssets); omit GamePerf instrumentation';
  if (file === 'combat-data.js') return 'CombatData Resource / pure combat helpers';
  if (file === 'game-ui.js') return 'SettingsStore + SaveStore + InputRouter + menu Controls';
  if (file === 'audio.js' || /sfx|score\.js/.test(file)) return 'AudioManager + audio/ Resources';
  if (file === 'mobile-display.js') return 'MobileLayout Resource + TouchControls';
  if (file === 'motion.js' || file === 'sprites.js' || /sprites|art\.js/.test(file)) return 'AssetRegistry + generated visual Resources';
  if (file.startsWith('src/animation/')) return 'ActorVisual / AnimationTimeline Resources';
  if (file === 'stage1-runtime.js') return 'StageOneController + StageOneEnemyController + StageOneVisuals';
  if (file === 'feel-runtime.js') return 'CombatResolver + TelegraphRenderer + DebugOverlay';
  if (file === 'demo-runtime.js') return 'DemoController (isolated session) + TutorialScreen';
  if (file === 'backgrounds.js' || file === 'floor-runtime.js') return 'StageBackdrop + FloorRenderer';
  if (file === 'zone-runtime.js') return 'HazardRenderer + HazardSystem';
  if (file === 'item-runtime.js') return 'ItemCatalog Resource + ItemVisual';
  if (/ui\.js$/.test(file)) return 'HUD / character HUD Controls';
  if (file === 'release.js') return 'TitleScreen + OpeningController';
  if (file === 'named-runtime.js') return 'ActorVisual + roster Resources';
  if (file === 'barel-runtime.js') return 'BarelVisual + BarelController';
  if (file === 'viesa-runtime.js') return 'ViesaController + ViesaVisual + ProjectileSystem';
  if (/gorath-remake-runtime/.test(file)) return 'GorathRemakeController + GorathVisual';
  if (/runtime|data\.js/.test(file)) return path.basename(file).replace(/-(runtime|data)\.js/,'') + ' controller / Resources';
  if (file === 'game.js') {
    if (/^(keys|pressed|lastTap|dashReq|JUMP_KEYS|TAP_DIR|down|hit|input|clearInput|BUF|LINK)/.test(name)) return 'InputRouter (session node)';
    if (/^(player|newPlayer|updPlayer|startAtk|startDash|updDash|startSkill|updSkill|skillStrike|startSpecial|updSpecial|specialHit|startCast|fireBolts|aimPlayerSkill|canStartSkill|DASH|ATK|SPECIAL|MAGIC|SKILL|PLAYER|BAREL|COMBO)/.test(name)) return 'PlayerController + PlayerState + CombatData';
    if (/^(damageEnemy|damageBarrel|hurtPlayer|playerStrike|canHit|inReach|playerImpactHeight|FEEL|lastHit|chain|GROGGY)/.test(name)) return 'CombatResolver + FeelSystem';
    if (/^(scene|resumeScene|settingsFrom|helpFrom|selectedCharacterId|characterSelectBossStage)/.test(name)) return 'GameState Autoload / screen routing';
    if (/^(stage|cam|wave|lock|STAGES|startStage|nextStage|spawnWave|retryStage|arena|updArena|finishStage)/.test(name)) return 'GameSession + StageController + ScrollCamera';
    if (/^(enemies|mkEnemy|updEnemy|archer|spawnAdds|ET|TELE|startAttack|pickPat|runPat|runLegacyPat|startPat|endPat|bossChase|alignY|phase2|beginBossPhase2|resetBossFx)/.test(name)) return 'EnemySystem + BossController interfaces';
    if (/^(hazards|items|barrels|drop|heal|updHazards)/.test(name)) return 'HazardSystem + ItemSystem';
    if (/^(practice|bossChallenge|challenge|beginPractice|updatePractice|openBossChallenge|beginBossChallenge)/.test(name)) return 'PracticeController / BossChallengeController';
    if (/^(tick|hitStop|slowT|last$|acc|loop|update$|scheduleLoop|wakeLoop|frozenFrame|waitingAssets|stat|nextId)/.test(name)) return 'SimulationClock + GameSession (exclude browser scheduling)';
    if (/^(rankOf|tallyHtml|entrySnapshot|continueGame)/.test(name)) return 'RankCalculator + ResultsScreen + SaveStore';
    if (/^(showScreen|screens|CHARACTER_ROSTER|selectCharacter|openCharacterSelect|confirmCharacter|backFromCharacterSelect|toTutorial|beginGame|toTitle|pauseGame|resumeGame|openSettings|closeSettings|syncTouchControls|onKeyOnce)/.test(name)) return 'ScreenRouter + screen Controls / InputRouter';
    if (/^(introBoss|introT|introLand|updIntro|introPoseT|INTRO_MS|bannerT|clearT|goT|flashT|flashCol|shake)/.test(name)) return 'SessionPresentation + IntroController';
    if (/^(drawHUD|updateSkillButtons|drawPortrait|portrait|PORTRAIT|panel|pxText|krText|hpCols|lifeBar|lagTo|PIX|drawCharacterPreview)/.test(name)) return 'HUD / CharacterSelectScreen';
    if (/^(sparks|floatText|impact|burst|ghost|cutIn)/.test(name)) return 'EffectsSystem / CutInControl';
    if (/^(W|H|MS|GTOP|GBOT|SC|BOSS_VISUAL_SCALE|Z|VW|VH|OY|SP_MAX|CHAIN_MS)$/.test(name)) return 'WorldConstants / CombatData';
    return 'WorldRenderer + pure render/pose helpers (scene-local)';
  }
  return 'Scene-local system / Resource (see PORTING_PLAN module table)';
}
for (const file of files) {
  const code = read(file);
  const ast = acorn.parse(code, {ecmaVersion:'latest',sourceType:'script',locations:true});
  const bindings = [];
  const exports = [];
  const refs = [];
  const scopes = [];
  const pattern = (p, s, kind) => {
    if (!p) return;
    if (p.type === 'Identifier') {s.names.add(p.name); if(s.root) bindings.push({name:p.name,kind,line:p.loc.start.line});}
    else if(p.type==='RestElement') pattern(p.argument,s,kind);
    else if(p.type==='AssignmentPattern') {pattern(p.left,s,kind); walk(p.right,s);}
    else if(p.type==='ObjectPattern') for(const p2 of p.properties) pattern(p2.type==='RestElement'?p2.argument:p2.value,s,kind);
    else if(p.type==='ArrayPattern') p.elements.forEach(v=>pattern(v,s,kind));
  };
  const scope = (parent,fn=false) => {const s={parent,fn,root:!parent,names:new Set()}; scopes.push(s);return s;};
  function walk(n,s) {
    if(!n || typeof n !== 'object') return;
    if(Array.isArray(n)) {n.forEach(v=>walk(v,s));return;}
    if(n.type==='Program') {n.body.forEach(v=>walk(v,s));return;}
    if(n.type==='Identifier') {refs.push({name:n.name,scope:s,line:n.loc.start.line});return;}
    if(n.type==='VariableDeclaration') {
      for(const d of n.declarations) {let dst=s;if(n.kind==='var') while(!dst.fn&&!dst.root)dst=dst.parent; pattern(d.id,dst,n.kind);walk(d.init,s);}return;
    }
    if(/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type)) {
      if(n.type==='FunctionDeclaration'&&n.id) pattern(n.id,s,'function');
      const child=scope(s,true);if(n.id)child.names.add(n.id.name);n.params.forEach(p=>pattern(p,child,'parameter'));walk(n.body,child);return;
    }
    if(n.type==='ClassDeclaration'||n.type==='ClassExpression') {
      if(n.type==='ClassDeclaration'&&n.id)pattern(n.id,s,'class');walk(n.superClass,s);const child=scope(s);if(n.id)child.names.add(n.id.name);walk(n.body,child);return;
    }
    if(n.type==='BlockStatement'||n.type==='CatchClause'||n.type==='ForStatement'||n.type==='ForOfStatement'||n.type==='ForInStatement') {
      const child=scope(s);if(n.type==='CatchClause')pattern(n.param,child,'catch');for(const [k,v]of Object.entries(n))if(!['type','start','end','loc','param'].includes(k))walk(v,child);return;
    }
    if(n.type==='MemberExpression') {walk(n.object,s);if(n.computed)walk(n.property,s);return;}
    if(n.type==='Property'||n.type==='MethodDefinition'||n.type==='PropertyDefinition') {if(n.computed)walk(n.key,s);walk(n.value,s);return;}
    if(n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&n.left.object.type==='Identifier'&&aliases.has(n.left.object.name)) {
      const m=n.left;const name=!m.computed?m.property.name:(m.property.type==='Literal'?String(m.property.value):null);
      if(name)exports.push({name,kind:'global property',line:m.loc.start.line});else dynamic.push({file,line:m.loc.start.line,expression:code.slice(m.start,m.end)});
    }
    if(n.type==='LabeledStatement') {walk(n.body,s);return;}
    if(n.type==='BreakStatement'||n.type==='ContinueStatement')return;
    for(const [k,v]of Object.entries(n))if(!['type','start','end','loc'].includes(k))walk(v,s);
  }
  const top=scope(null);walk(ast,top);
  const free=refs.filter(r=>{let s=r.scope;while(s){if(s.names.has(r.name))return false;s=s.parent;}return true;});
  modules.push({file,sha256:crypto.createHash('sha256').update(code).digest('hex'),lines:code.split('\n').length,owner:owner(file,''),bindings,exports,freeIdentifiers:[...new Set(free.map(r=>r.name))].sort()});
}
const globals = new Map();
for(const m of modules) for(const b of [...m.bindings,...m.exports]) {
  if(!globals.has(b.name)) globals.set(b.name,{name:b.name,definitions:[],consumers:[]});
  const g=globals.get(b.name);g.definitions.push({file:m.file,line:b.line,kind:b.kind,target:owner(m.file,b.name)});
}
for(const g of globals.values())for(const m of modules)if(m.freeIdentifiers.includes(g.name))g.consumers.push(m.file);
const assets = JSON.parse(read('data/runtime-assets.json'));
const missingAssets=assets.filter(f=>!fs.existsSync(path.join(root,f)));
const report={schema:1,date:'2026-11-14',parser:acorn.version,node:process.version,entry:'index.html',scripts:files,serverOnly:serverFiles.filter(f=>!files.includes(f)),htmlOnly:files.filter(f=>!serverFiles.includes(f)),modules,globals:[...globals.values()].sort((a,b)=>a.name.localeCompare(b.name)),dynamicExports:dynamic,runtimeAssets:{count:assets.length,missing:missingAssets}};
const out=path.join(root,'godot/docs');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'GLOBAL_INVENTORY.json'),JSON.stringify(report,null,2)+'\n');
const lines=['# JavaScript global ownership inventory','','Generated by `node godot/tools/analyze_source.cjs`. Full declarations and cross-file free-identifier consumers are in `GLOBAL_INVENTORY.json`.', '',`Snapshot: ${files.length} loaded scripts; ${globals.size} unique global names; ${assets.length} runtime assets; ${missingAssets.length} missing manifest files.`, '', 'This deliberately includes all script-level bindings and explicitly exported global properties, even when currently used only by their declaring file. Function-local variables and closure-private names are excluded. Namespace fields are data/API members rather than separate global bindings. Browser built-ins and DOM IDs are dependencies, not application globals. Property writes on IIFE parameters named root/global are treated as exports; their entry calls bind these to window/globalThis in this codebase.', '', 'Cross-file consumers are lexical free-identifier uses. Explicit window/globalThis member accesses and reflective accesses are not included in the consumer column; all export definitions remain listed. This is a conservative migration inventory, not a whole-program reachability proof.',''];
for(const m of modules) {
 lines.push(`## ${m.file}`,'',`Proposed default owner: ${m.owner}.`,'','| Global | Source line / kind | Godot owner | Other files using lexical name |','|---|---|---|---|');
 for(const b of [...m.bindings,...m.exports]) {const g=globals.get(b.name);lines.push(`| \`${b.name}\` | ${b.line} / ${b.kind} | ${owner(m.file,b.name)} | ${g.consumers.filter(f=>f!==m.file).join(', ')||'—'} |`);}
 lines.push('');
}
lines.push('## Computed export sites','');for(const d of dynamic)lines.push(`- ${d.file}:${d.line}: \`${d.expression}\` (enumerate runtime keys in Phase 1).`);
fs.writeFileSync(path.join(out,'GLOBAL_INVENTORY.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({scripts:files.length,globals:globals.size,dynamic,serverOnly:report.serverOnly,htmlOnly:report.htmlOnly,assets:report.runtimeAssets}));
