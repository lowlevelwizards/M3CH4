import test from 'node:test';
import assert from 'node:assert/strict';
import { CAB_SERVICE_POLICY, cockpitFailurePresentation, auditCockpitLayouts } from '../cockpitProfiles.js';
import { drawCockpitChannel } from '../cockpitDisplays.js';
import { makeTestAssembly, equip, installedPart } from '../components.js';

const ids=['cab-cyclops','cab-utility','cab-armored'];
const screen=()=>{
    const labels=[];
    const ctx={globalAlpha:1,textAlign:'left',clearRect(){},fillRect(){},strokeRect(){},
        fillText(s){labels.push(String(s));}};
    return {ctx,canvas:{width:220,height:82},texture:{needsUpdate:false},labels};
};
test('real serialized command integrity governs optional readouts without new condition state',()=>{
    for(const id of ids){
        const a=makeTestAssembly();equip(a,'command',id);
        const part=installedPart(a,'command').instance;
        assert.equal(part.condition,1);
        const initial=cockpitFailurePresentation(part.condition,1,1,id);
        assert.equal(initial.diagnosticsAvailable,true);
        part.condition=.3;
        const damaged=cockpitFailurePresentation(part.condition,1,1,id);
        assert.equal(damaged.diagnosticsAvailable,id==='cab-armored');
        part.condition=1;assert.equal(cockpitFailurePresentation(part.condition,1,1,id).diagnosticsAvailable,true);
    }
    assert.deepEqual(auditCockpitLayouts().flatMap(x=>x.violations),[]);
    assert.ok(CAB_SERVICE_POLICY['cab-armored'].secondaryFloor<CAB_SERVICE_POLICY['cab-utility'].secondaryFloor);
});
test('critical driving, power and recoil signals survive secondary diagnostic interruption',()=>{
    const data={speed:3.3,turnRate:28,slip:.67,footing:.9,recoil:.6,brace:0,direction:'FWD'};
    for(const id of ids){
        const profile={theme:id==='cab-armored'?'armored':id==='cab-utility'?'observation':'workhorse'};
        const failure=cockpitFailurePresentation(.05,1,.95,id);
        const hit=screen();drawCockpitChannel(hit,'motion',data,profile,failure);
        assert.ok(hit.labels.some(t=>t.includes('3.3')),'essential speed must remain visible');
        assert.ok(hit.labels.includes('FOOT SCRAPE'),'critical traction warning survives');
        const quiet=screen();drawCockpitChannel(quiet,'motion',{...data,slip:0,recoil:0,footing:.3},profile,failure);
        assert.ok(quiet.labels.includes('DIAG SERVICE'),'optional diagnosis accurately unavailable');
        const restored=screen();drawCockpitChannel(restored,'motion',{...data,slip:0,recoil:0,footing:.3},
            profile,cockpitFailurePresentation(1,1,1,id));
        assert.ok(!restored.labels.includes('DIAG SERVICE'));
    }
});
test('low electrical bus cannot masquerade as healthy secondary instruments',()=>{
    for(const id of ids){
        const p=cockpitFailurePresentation(1,1,.55,id);
        assert.equal(p.busSag,true);
        assert.equal(p.diagnosticsAvailable,false);
        assert.ok(p.commandHealth===1);
    }
});
