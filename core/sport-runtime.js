(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.TEAM_APP_CORE=Object.freeze({...root.TEAM_APP_CORE,...api});
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function normalizeLayoutKey(unit,key){
    if(!unit)return 'standard';
    if(unit.layoutMap&&unit.layoutMap[key])return key;
    return unit.defaultLayoutKey||unit.layouts?.[0]?.key||'standard';
  }

  function layoutRoleForSlot(layout,slotKey){return layout?.slotMap?.[slotKey]?.roleCode||slotKey||null;}

  function remapAssignmentsForLayout(assignments,oldLayout,newLayout){
    const source=assignments&&typeof assignments==='object'&&!Array.isArray(assignments)?assignments:{};
    const result={},used=new Set(),oldSlots=oldLayout?.slots||[],newSlots=newLayout?.slots||[];
    newSlots.forEach(slot=>{const id=source[slot.key];if(id){result[slot.key]=id;used.add(id);}});
    const rolePools={};
    oldSlots.forEach(slot=>{const id=source[slot.key];if(!id||used.has(id))return;(rolePools[slot.roleCode]||(rolePools[slot.roleCode]=[])).push(id);});
    newSlots.forEach(slot=>{if(result[slot.key])return;const pool=rolePools[slot.roleCode]||[];while(pool.length&&used.has(pool[0]))pool.shift();const id=pool.shift();if(id){result[slot.key]=id;used.add(id);}});
    return result;
  }

  function validateAssignments(assignments,layout,validPlayerIds){
    const a=assignments&&typeof assignments==='object'&&!Array.isArray(assignments)?assignments:{};
    const slots=new Set((layout?.slots||[]).map(x=>x.key));const seen=new Set();const allowedPlayers=validPlayerIds?new Set(validPlayerIds):null;
    const errors=[];
    for(const [slot,id] of Object.entries(a)){
      if(!slots.has(slot))errors.push({code:'unknown_slot',slot,id});
      if(!id)continue;
      if(seen.has(id))errors.push({code:'duplicate_player',slot,id}); else seen.add(id);
      if(allowedPlayers&&!allowedPlayers.has(id))errors.push({code:'unknown_player',slot,id});
    }
    return {valid:errors.length===0,errors};
  }

  function benchPlayerIds(playerIds,assignments){const assigned=new Set(Object.values(assignments||{}).filter(Boolean));return (playerIds||[]).filter(id=>!assigned.has(id));}

  function roleCounts(assignments,layout){
    const counts={};for(const [slot,id] of Object.entries(assignments||{})){if(!id)continue;const role=layoutRoleForSlot(layout,slot);counts[role]=(counts[role]||0)+1;}return counts;
  }

  return {normalizeLayoutKey,layoutRoleForSlot,remapAssignmentsForLayout,validateAssignments,benchPlayerIds,roleCounts};
});
