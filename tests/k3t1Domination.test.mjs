import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSortieObjective, advanceSortieObjective, objectivePointForTeam, objectivePresentation, objectiveStatusText } from '../sortieObjectives.js';
import { contractById, selectContract } from '../contracts.js';
import { createWorldModel, observeBattlefield } from '../ai/worldModel.js';
import { planTeam } from '../ai/teamPlanner.js';
import { DEFAULT_WORLD } from '../locomotion.js';
import { createCampaignState, availableCampaignNodes, CAMPAIGN_REQUIRED_NODES } from '../campaign.js';
import { hostileSupportRecipes } from '../squadBattle.js';

const contract=contractById('domination');
const newState=()=>createSortieObjective(contract);
const unit=(id,team,x,z,active=true)=>({id,team,rig:{x,z},active});
const A=unit('player','friendly',-17,-1.5);
const B=unit('ally-1','friendly',0,-9.1);
const C=unit('enemy-0','hostile',17,1.5);
const advance=(state,actors,seconds)=>{
    let result=null;
    for(let i=0;i<Math.ceil(seconds*60);i++){
        result=advanceSortieObjective(state,actors,1/60);
        if(result)return result;
    }
    return result;
};
const file=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('Domination is an optional ordinary three-rig BO3 contract unlocked after Yard Dog',()=>{
    assert.equal(contract.objective.type,'domination');
    assert.deepEqual(contract.objective.points.map(p=>p.id),['A','B','C']);
    assert.deepEqual(hostileSupportRecipes('domination'),['cutter','mule']);
    assert.equal(availableCampaignNodes(createCampaignState()).includes('domination'),false);
    assert.equal(availableCampaignNodes(createCampaignState({clearedNodes:['yard-dog']})).includes('domination'),true);
    assert.equal(CAMPAIGN_REQUIRED_NODES.includes('domination'),false);
    assert.equal(contract.objective.scoreToWin,60);
});
test('each A/B/C point sits on walkable ground rather than inside an arena collider',()=>{
    const nodes=contract.objective.points;
    const radius=contract.objective.radius;
    assert.equal(nodes.length,3);
    for(const p of nodes){
        assert.ok(p.x>DEFAULT_WORLD.minX+radius&&p.x<DEFAULT_WORLD.maxX-radius);
        assert.ok(p.z>DEFAULT_WORLD.minZ+radius&&p.z<DEFAULT_WORLD.maxZ-radius);
        for(const obstacle of DEFAULT_WORLD.obstacles){
            const distanceX=Math.max(obstacle.minX-p.x,0,p.x-obstacle.maxX);
            const distanceZ=Math.max(obstacle.minZ-p.z,0,p.z-obstacle.maxZ);
            assert.ok(Math.hypot(distanceX,distanceZ)>1.4,p.id+' overlaps '+obstacle.id);
        }
    }
});
test('one captured point awards no score; capture takes uncontested physical time',()=>{
    const state=newState();
    advance(state,[A],1.5);
    assert.equal(state.domination.points[0].owner,null);
    assert.equal(state.friendlyProgress,0);
    advance(state,[A],3);
    assert.equal(state.domination.points[0].owner,'friendly');
    assert.equal(state.friendlyProgress,0);
    advance(state,[A],20);
    assert.equal(state.friendlyProgress,0);
});
test('two friendly zones generate score and a territory win even with living hostile rigs',()=>{
    const state=newState();
    const enemies=[unit('enemy-0','hostile',0,-21),unit('enemy-1','hostile',20,17)];
    advance(state,[A,B,...enemies],5);
    assert.equal(state.domination.points[0].owner,'friendly');
    assert.equal(state.domination.points[1].owner,'friendly');
    assert.equal(state.domination.points[2].owner,null);
    const outcome=advance(state,[A,B,...enemies],57);
    assert.deepEqual(outcome,{victory:true,reason:'DOMINATION · FRIENDLY TERRITORY SECURED'});
    assert.equal(state.complete,true);
    assert.equal(state.winner,'friendly');
});
test('three held points score faster than two while scoring remains bounded',()=>{
    const first=newState(),second=newState();
    const actors=[A,B,unit('ally-2','friendly',17,1.5)];
    advance(first,actors.slice(0,2),5);
    advance(second,actors,5);
    advance(first,actors.slice(0,2),10);
    advance(second,actors,10);
    assert.ok(second.friendlyProgress>first.friendlyProgress*1.40);
    assert.ok(second.friendlyProgress<=second.domination.scoreToWin);
});
test('contesting a captured point freezes its capture and stops its majority contribution',()=>{
    const state=newState();advance(state,[A,B],5);
    const before=state.friendlyProgress;
    const hostile=unit('enemy-0','hostile',-17,-1.5);
    advance(state,[A,B,hostile],12);
    assert.equal(state.domination.points[0].contested,true);
    assert.equal(state.domination.points[0].owner,'friendly');
    assert.ok(state.friendlyProgress<before+0.001);
    assert.match(objectiveStatusText(state),/CONTESTED/);
});
test('an enemy can decapture a friendly point and reverse its ownership through neutral',()=>{
    const state=newState();advance(state,[A],5);
    const enemy=unit('enemy-1','hostile',-17,-1.5);
    advance(state,[enemy],4);
    assert.equal(state.domination.points[0].owner,null);
    assert.equal(state.domination.points[0].contested,false);
    advance(state,[enemy],5);
    assert.equal(state.domination.points[0].owner,'hostile');
});
test('a live hostile majority produces a hostile territory victory without killing allies',()=>{
    const state=newState();
    const hostile1=unit('enemy-0','hostile',-17,-1.5),hostile2=unit('enemy-1','hostile',0,-9.1);
    const surviving=unit('player','friendly',30,20);
    const result=advance(state,[hostile1,hostile2,surviving],58);
    assert.equal(result.victory,false);
    assert.match(result.reason,/HOSTILE TERRITORY/);
});
test('disabled or destroyed rig never captures or contests a point',()=>{
    const state=newState();
    advance(state,[{...A,active:false}],30);
    assert.equal(state.domination.points[0].owner,null);
    advance(state,[A],5);
    advance(state,[A,{...A,id:'enemy-0',team:'hostile',active:false}],10);
    assert.equal(state.domination.points[0].contested,false);
});
test('AI assigns territory dynamically instead of pinning every ID to a lane',()=>{
    const state=newState();
    const crew=[unit('ally-1','friendly',-9,21),
        unit('ally-2','friendly',9,21),unit('enemy-0','hostile',0,-22),
        unit('enemy-1','hostile',-9,-21),unit('enemy-2','hostile',9,-21)];
    const snapshot=observeBattlefield(createWorldModel(),crew,state,DEFAULT_WORLD,1);
    const orders=planTeam(snapshot,'hostile').orders;
    assert.equal(Object.keys(orders).length,3);
    assert.equal(new Set(Object.values(orders).map(o=>o.objectiveId)).size,3);
    assert.equal(objectivePointForTeam(state,'friendly').id,'B');
});
test('presentation exposes three distinct physical sites and capture/ownership data',()=>{
    const state=newState();advance(state,[A,B],5);
    const visual=objectivePresentation(state);
    assert.equal(visual.visible,true);
    assert.equal(visual.type,'domination');
    assert.deepEqual(visual.points.map(p=>p.id),['A','B','C']);
    assert.equal(visual.points[0].owner,'friendly');
    assert.equal(visual.points[2].owner,null);
    assert.match(objectiveStatusText(state),/DOM/);
    const scene=file('scene.js');
    assert.match(scene,/three-point-territory/);
    assert.match(scene,/CanvasTexture/);
    assert.match(scene,/dominationMarker/);
    assert.match(scene,/presentation.type==='domination'/);
});
test('tactical movement treats occupation as an explicit hold order, not a generic orbit',()=>{
    const ai=file('enemyMotion.js');
    const main=file('main.js');
    assert.match(ai,/teamIntent\?\.mode==='ORDER'/);
    assert.match(ai,/brake:\.85/);
    assert.match(main,/planTeam\(aiSnapshot/);
    assert.match(main,/executeIntent\(actor\.executor/);
    assert.ok(main.includes('if (outcome && !testEnded)'));
    assert.match(main,/domination-hud/);
});
