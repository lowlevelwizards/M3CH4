import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('mobile entrypoint advances emergency field work lifecycle modules', () => {
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /0\.0\.1k\.4q — Physical Workshop/);
    assert.match(html, /"\.\/fieldWork\.js": "\.\/fieldWork\.js\?v=k4l"/);
    assert.match(html, /"\.\/boutSession\.js": "\.\/boutSession\.js\?v=k3r0"/);
    assert.match(html, /garageMountUI\.js\?v=k4q/);
});
