import test from 'node:test';
import assert from 'node:assert/strict';
import { runBout } from '../research/headlessDominationStudy.mjs';
import { runRosterCompetitiveStudy,winConfidence,COHORTS } from '../research/rosterCompetitiveStudy.mjs';
import { runRosterBalanceAudit } from '../research/rosterBalanceAudit.mjs';

test('paired seeded roster cohort uses current legal owned hardware and is fully repeatable',()=>{
    const opts={pairs:1,seconds:2,accuracy:0,seed:44881};
    const first=runRosterCompetitiveStudy(opts);
    assert.deepEqual(first,runRosterCompetitiveStudy(opts));
    assert.equal(first.cohorts.length,Object.keys(COHORTS).length);
    assert.equal(first.roster.definitions,16);
    assert.equal(first.roster.legal,237);
    const reference=runRosterBalanceAudit().references;
    for(const cohort of first.cohorts){
        assert.equal(cohort.bouts,2);
        assert.equal(cohort.boutRecords.length,2);
        assert.equal(cohort.boutRecords[0].seed,cohort.boutRecords[1].seed);
        assert.equal(cohort.boutRecords[0].swapped,false);
        assert.equal(cohort.boutRecords[1].swapped,true);
        assert.equal(cohort.wins+cohort.losses+cohort.draws,2);
        assert.ok(cohort.win95.low>=0&&cohort.win95.high<=1);
        for(const name of [...cohort.recipes.a,...cohort.recipes.b])
            assert.equal(reference[name].ready,true,name);
    }
    assert.match(first.modelLimitations,/approximat/);
});
test('an illegal research rig is rejected before simulation',()=>{
    const invalid={name:'INVALID HAULER DRAFT',pilot:'hauler',recipe:{
        structure:'frame-sr',mobility:'legs-hauler',power:'power-air',
        command:'cab-cyclops',combat:'gun-light',
    }};
    assert.throws(()=>runBout(42,{name:'invalid',maxSeconds:2,accuracy:0,
        rosters:{friendly:[invalid,invalid,invalid],hostile:['yard','yard','yard']}}),/Illegal research rig/);
});
test('legacy authored-only runner stays deterministic and supports short smoke without fake new abilities',()=>{
    const baseline={name:'legacy-regression',maxSeconds:1,accuracy:0,policy:'strict'};
    assert.deepEqual(runBout(211,baseline),runBout(211,baseline));
    assert.equal(runBout(211,baseline).actors.length,6);
});
test('uncertainty remains broad for tiny samples instead of prompting premature tuning',()=>{
    assert.deepEqual(winConfidence(0,0,0),{low:0,high:1});
    const small=winConfidence(1,0,2);
    assert.ok(small.low<.5&&small.high>.5);
});
