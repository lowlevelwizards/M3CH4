import test from 'node:test';
import assert from 'node:assert/strict';
import { cycleBayId } from '../bayCycle.js';

const bays=['rig-01','rig-02','rig-03'];
test('arrows wrap from third to first and first to third',()=>{
    assert.equal(cycleBayId(bays,'rig-03',1),'rig-01');
    assert.equal(cycleBayId(bays,'rig-01',-1),'rig-03');
});
test('every bay is reachable by forward and backward taps',()=>{
    for(const start of bays){
        let next=start;
        for(let n=0;n<3;n++)next=cycleBayId(bays,next,1);
        assert.equal(next,start);
        next=start;
        for(let n=0;n<3;n++)next=cycleBayId(bays,next,-1);
        assert.equal(next,start);
    }
});
test('uninitialized or empty nav never traps the user',()=>{
    assert.equal(cycleBayId(bays,'unknown',1),'rig-02');
    assert.equal(cycleBayId([], 'rig-01',1),null);
});
