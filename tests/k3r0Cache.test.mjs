import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('mobile entrypoint advances emergency field work lifecycle modules', () => {
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /0\.0\.1k\.3w\.16 — Foot Contact & Lateral Gait/);
    assert.match(html, /"\.\/fieldWork\.js": "\.\/fieldWork\.js\?v=k3r0"/);
    assert.match(html, /"\.\/boutSession\.js": "\.\/boutSession\.js\?v=k3r0"/);
    assert.match(html, /garageMountUI\.js\?v=k3v6/);
});
