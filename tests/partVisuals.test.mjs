import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BY_ID, installedPart, makeTestAssembly } from '../components.js';
import { fitFixtureFor } from '../chassisFitFixtures.js';
import { YARDWALKER_LAYOUT, validateYardwalkerLayout } from '../mobilityDefinitions.js';

const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('Yardwalker visuals take their envelope and mass from the original catalogue', () => {
    const part = BY_ID.get('legs-yard');
    const fixture = fitFixtureFor('legs-yard');
    assert.ok(part);
    assert.ok(fixture);
    assert.deepEqual(fixture.envelope, part.envelope);
    assert.equal(fixture.massKg, part.massKg);
    assert.equal(fixture.standard, part.mountSize);
});

test('Yardwalker rest pose still fits its catalogue interface', () => {
    const verdict = validateYardwalkerLayout(YARDWALKER_LAYOUT, fitFixtureFor('legs-yard'));
    assert.deepEqual(verdict.errors, []);
    assert.equal(verdict.valid, true);
});

test('the original starting assembly still equips the existing Yardwalker ID', () => {
    const fitted = installedPart(makeTestAssembly(), 'mobility');
    assert.equal(fitted.definition.id, 'legs-yard');
});

test('gameplay and both preview entrypoints use one Yardwalker visual registry', () => {
    assert.match(source('partVisuals.js'), /'legs-yard':\s*buildYardwalkerVisual/);
    assert.match(source('scene.js'), /buildPartVisual\(def\.id,\s*\{\s*mode:\s*'gameplay'\s*\}\)/);
    assert.match(source('chassisFitVisuals.js'), /buildPartVisual\(fixture\.id\)/);
    assert.match(source('mobilityAnatomyLab.js'), /buildPartVisual\('legs-yard'\)/);
});
