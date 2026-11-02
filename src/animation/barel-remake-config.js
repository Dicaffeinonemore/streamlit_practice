(function(root){
  'use strict';
  // Remade Barel art (tools/barel-remake). Points the ten-frame loaders at the barel-remake-* exports and
  // adds the remade skill sheets. Every loader keeps its own validation and legacy fallback.
  // ?barelRemake=0 keeps the previous art.
  if(new URLSearchParams(root.location?.search||'').get('barelRemake')==='0'){root.BAREL_REMAKE_NAMED={};return;}
  const metadata=name=>`assets/aseprite/barel-remake-${name}-10/barel-remake-${name}-10.animation.json`;
  const use=(key,name)=>{root[key]={...root[key],metadataUrl:metadata(name)};};
  use('BAREL_IDLE_CONFIG','idle');
  use('BAREL_WALK_CONFIG','walk');
  use('BAREL_DASH_CONFIG','dash');
  use('BAREL_DASH_ATTACK_CONFIG','dash-attack');
  use('BAREL_COMBO0_CONFIG','combo0');
  use('BAREL_COMBO1_CONFIG','combo1');
  use('BAREL_COMBO2_CONFIG','combo2');
  use('BAREL_JUMP_CONFIG','jump');
  use('BAREL_AIR_ATTACK_CONFIG','air-attack');
  root.BAREL_REMAKE_NAMED=root.BAREL_REMAKE_NAMED_DATA||{};
})(typeof globalThis!=='undefined'?globalThis:window);
