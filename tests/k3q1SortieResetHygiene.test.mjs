import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const garage = fs.readFileSync(new URL('../garageMountUI.js', import.meta.url), 'utf8');

test('destructive garage resets clear session-scoped sortie intent before reload', () => {
    assert.match(garage, /import \{ clearSortieAssignment \} from '\.\/sortieAssignment\.js'/);
    assert.match(garage, /target\.id === 'wipe-save' && target\.getAttribute\('aria-pressed'\) === 'true'/);
    assert.match(garage, /target\.classList\.contains\('campaign-restart'\)/);
    assert.match(garage, /clearSortieAssignment\(window\.sessionStorage\)/);
});
