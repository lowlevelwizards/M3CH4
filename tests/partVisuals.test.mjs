import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BY_ID, installedPart, makeTestAssembly } from '../components.js';
import { fitFixtureFor } from '../chassisFitFixtures.js';
import {
    YARDWALKER_LAYOUT, KESTREL_LAYOUT, HAULER_LAYOUT,
    validateYardwalkerLayout, validateKestrelLayout, validateHaulerLayout,
    validateMobilityFamilySeparation,
} from '../mobilityDefinitions.js';

const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const families = [
    ['legs-yard', YARDWALKER_LAYOUT, validateYardwalkerLayout],
    ['legs-compact', KESTREL_LAYOUT, validateKestrelLayout],
    ['legs-hauler', HAULER_LAYOUT, validateHaulerLayout],
];

test('all shared mobility fixtures take physical facts from the original catalogue', () => {
    for (const [id] of families) {
        const part = BY_ID.get(id);
        const fixture = fitFixtureFor(id);
        assert.ok(part, id);
        assert.ok(fixture, id);
        assert.deepEqual(fixture.envelope, part.envelope, id);
        assert.equal(fixture.massKg, part.massKg, id);
        assert.equal(fixture.nativeStandard, part.mountSize, id);
    }
    assert.equal(fitFixtureFor('legs-hauler').previewAdapter.massKg, 110);
});

test('all three authored mobility rest poses still fit their catalogue interfaces', () => {
    for (const [id, layout, validate] of families) {
        const verdict = validate(layout, fitFixtureFor(id));
        assert.deepEqual(verdict.errors, [], id);
        assert.equal(verdict.valid, true, id);
    }
    assert.equal(validateMobilityFamilySeparation().valid, true);
});

test('the original starting assembly and mobility IDs remain unchanged', () => {
    const fitted = installedPart(makeTestAssembly(), 'mobility');
    assert.equal(fitted.definition.id, 'legs-yard');
    assert.deepEqual(families.map(([id]) => id), ['legs-yard', 'legs-compact', 'legs-hauler']);
});

test('all mobility families use the one shared visual registry in gameplay and previews', () => {
    const registry = source('partVisuals.js');
    assert.match(registry, /'legs-yard':\s*buildYardwalkerVisual/);
    assert.match(registry, /'legs-compact':\s*buildKestrelVisual/);
    assert.match(registry, /'legs-hauler':\s*buildHaulerVisual/);

    const scene = source('scene.js');
    assert.match(scene, /const sharedVisual = buildPartVisual\(def\.id, \{ mode: 'gameplay' \}\)/);
    assert.doesNotMatch(scene, /case 'legs-(?:yard|compact|hauler)'/);
    assert.doesNotMatch(scene, /adapterFor\(assembly, 'mobility'\)/);

    assert.match(source('chassisFitVisuals.js'), /const shared=buildPartVisual\(fixture\.id\)/);
    assert.match(source('mobilityAnatomyLab.js'), /const root=buildPartVisual\(id\)/);
});

test('the obsolete schematic mobility representation and UI are gone', () => {
    const fitVisuals = source('chassisFitVisuals.js');
    assert.doesNotMatch(fitVisuals, /single-top-drive-saddle|compact-top-saddle|heavy-carriage/);
    assert.doesNotMatch(fitVisuals, /mobilityModel/);

    const fitPreview = source('chassisFitPreview.js');
    assert.doesNotMatch(fitPreview, /mobilityModel|setMobilityModel|data-mobility-model/);

    const previewHtml = source('chassis-preview.html');
    assert.doesNotMatch(previewHtml, /OLD FIT BLOCK|data-mobility-model/);
});
