import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodeMachine} from '../persistence.js';
import {installedPart} from '../components.js';
import {createFunctionalDamage, damageInstalledPart, functionalOutput} from '../functionalDamage.js';

test('AI shot value is distinct from persistent drive damage state', () => {
  const src=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const start=src.indexOf('function applyAiHitToPlayer(');
  const end=src.indexOf('/** A real tracer',start);
  assert.ok(start>=0 && end>start);
  const fn=src.slice(start,end);
  assert.match(fn,/function applyAiHitToPlayer\(actor, contact, shotDamage = actor\.weaponSpec\.damage/);
  assert.match(fn,/applyTargetHit\(playerCondition, contact\.slot, shotDamage\)/);
  assert.match(fn,/damageInstalledPart\(assembly, damage, 'mobility'/);
  assert.match(fn,/damageInstalledPart\(assembly, damage, contact\.slot, amount\)/);
  assert.doesNotMatch(fn,/function applyAiHitToPlayer\(actor, contact, damage =/);
});

test('drive damage lowers the struck section instead of throwing on the next hit', () => {
  const {assembly}=decodeMachine(null);
  const state=createFunctionalDamage();
  const mobile=installedPart(assembly,'mobility');
  const before=mobile.instance.condition;
  const after=damageInstalledPart(assembly,state,'mobility',.2,'left');
  assert.ok(after<=before);
  assert.ok(state.drives[mobile.instance.serial]);
  assert.ok(state.drives[mobile.instance.serial].left<state.drives[mobile.instance.serial].right);
  assert.ok(Number.isFinite(functionalOutput(assembly,state).drive));
});
