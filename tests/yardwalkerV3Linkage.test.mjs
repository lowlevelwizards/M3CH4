import test from 'node:test';
import assert from 'node:assert/strict';
import {YARDWALKER_DESIGN as model} from '../yardwalkerDesignData.js';
import {YARDWALKER_LAYOUT} from '../mobilityDefinitions.js';
import {makeYardwalkerWorkbenchAsset,yardwalkerShapes} from '../yardwalkerWorkbenchExport.js';

// Real station centroids from closed indexed meshes; not labels or artist-authored annotations.
function stations(shape) {
  const g=shape.geometry,p=g.positions,center=shape.position;
  assert.equal(g.type,'mesh');
  const result=[];
  for(let i=0;i<p.length/3-2;i+=8){
    const sum=[0,0,0];
    for(let j=0;j<8;j++)for(let k=0;k<3;k++)sum[k]+=p[3*(i+j)+k]+center[k];
    result.push(sum.map(x=>x/8));
  }
  return result;
}
const core=id=>model.core.find(s=>s.id===id);
const armor=id=>model.armor.find(s=>s.id===id);
function range(shape,axis=0){
  const a=shape.geometry.positions.filter((_,i)=>i%3===axis).map(v=>v+shape.position[axis]);
  return Math.max(...a)-Math.min(...a);
}
test('V4 preserves the V3-restored two opposing and visibly angled, independent walking links',()=>{
  assert.equal(model.version,4);
  assert.deepEqual(model.mountFace,YARDWALKER_LAYOUT.mountingFace);
  for(const word of ['left','right']){
    const upper=stations(core('Y4-'+word+'-primary-thigh'));
    const lower=stations(core('Y7-'+word+'-single-shin-housing'));
    const dzUpper=upper.at(-1)[2]-upper[0][2];
    const dzLower=lower.at(-1)[2]-lower[0][2];
    assert.ok(dzUpper>.13,word+' hip-to-knee must tilt rearward rather than stack vertically');
    assert.ok(dzLower<-.13,word+' knee-to-ankle must return forward');
    const theta1=Math.atan2(dzUpper,upper[0][1]-upper.at(-1)[1]);
    const theta2=Math.atan2(-dzLower,lower[0][1]-lower.at(-1)[1]);
    assert.ok(theta1>.25 && theta2>.28,word+' must have a legible side view profile');
    const joint=YARDWALKER_LAYOUT.legs.find(l=>l.side===(word==='left'?-1:1));
    assert.ok(Math.abs(joint.knee[2]-joint.hip[2]-.1)<1e-7);
    assert.ok(Math.abs(joint.ankle[2]-joint.knee[2]+.1)<1e-7);
  }
});
test('armor follows the inclined members rather than stacking short transverse cuffs',()=>{
  for(const word of ['left','right']){
    const a=armor('yard-'+word+'-thigh'),shin=armor('yard-'+word+'-shin');
    assert.equal(a.parent,word+'Hip');assert.equal(shin.parent,word+'Knee');
    for(const v of a.variants){
      const ss=stations(v);assert.ok(ss.at(-1)[2]-ss[0][2]>.15);
      assert.ok(ss[0][1]-ss.at(-1)[1]>.29);
    }
    for(const v of shin.variants){
      const ss=stations(v);assert.ok(ss.at(-1)[2]-ss[0][2]<-.09);
      assert.ok(ss[0][1]-ss.at(-1)[1]>.25);
    }
    const hip=armor('yard-'+word+'-hip');
    assert.equal(hip.parent,'carriage');
    assert.ok(range(hip.variants[2])>range(hip.variants[1]));
    assert.ok(range(hip.variants[1])>range(hip.variants[0]));
    assert.ok(range(a.variants[1])>range(a.variants[0]));
    assert.ok(range(shin.variants[2])>range(shin.variants[0]));
  }
});
test('all tiers preserve the same core, moving-parent split and editable Workbench geometry',()=>{
  const bare=yardwalkerShapes(0).filter(x=>!x.armorId);
  for(let tier=0;tier<4;tier++){
    const pieces=yardwalkerShapes(tier),asset=makeYardwalkerWorkbenchAsset(tier);
    assert.deepEqual(pieces.filter(x=>!x.armorId),bare);
    assert.equal(pieces.filter(x=>x.armorId).length,[0,4,6,8][tier]);
    assert.equal(asset.nodes.filter(x=>x.kind==='shape').length,pieces.length);
    assert.equal(asset.metadata.version,'Yardwalker-V4');
  }
});
