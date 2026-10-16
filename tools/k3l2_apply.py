from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT / path).read_text()

def write(path, text):
    (ROOT / path).write_text(text)

def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f"missing replacement anchor in {path}: {old[:90]!r}")
    write(path, text.replace(old, new, 1))

def regex_once(path, pattern, replacement, flags=0):
    text = read(path)
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"expected one regex replacement in {path}, got {count}: {pattern[:90]!r}")
    write(path, next_text)

# ---------------------------------------------------------------------------
# 1) Salvage must share the exact sceneAssembly module instance used by main.
# ---------------------------------------------------------------------------
replace_once(
    'acquisitionUI.js',
    "import { activePlayerArena } from './sceneAssembly.js';",
    "// Import through the canonical scene specifier. index.html maps this to the same\n// versioned sceneAssembly module instance used by main.js; importing sceneAssembly.js\n// directly would create a second module singleton and lose activePlayerArena().\nimport { activePlayerArena } from './scene.js';",
)

replace_once(
    'acquisitionUI.js',
    "const garage = document.querySelector('#debrief-garage');\nconst fieldStatus = document.querySelector('#field-status');\nif (!sheet || !lines || !garage)\n    throw new Error('Bout salvage UI needs the existing debrief surface.');",
    "const garage = document.querySelector('#debrief-garage');\nconst fieldStatus = document.querySelector('#field-status');\nconst pages = document.querySelector('#debrief-pages');\nconst scorePage = document.querySelector('#debrief-score-page');\nconst salvagePage = document.querySelector('#debrief-salvage-page');\nconst pageNav = document.querySelector('#debrief-page-nav');\nif (!sheet || !lines || !garage || !pages || !scorePage || !salvagePage || !pageNav)\n    throw new Error('Bout salvage UI needs the paged debrief surface.');\nconst pageButtons = [...pageNav.querySelectorAll('[data-debrief-target]')];",
)

replace_once(
    'acquisitionUI.js',
    "let selectedEntryId = null;",
    "let selectedEntryId = null;\nlet currentPageIndex = 0;\nlet lastRenderedResult = null;\nlet pageScrollFrame = null;",
)

replace_once(
    'acquisitionUI.js',
    ".salvage-note{margin:6px 0;color:#9eb0a0}.salvage-done{color:#9fd3a6}.salvage-charter{display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;padding:5px 0 7px;color:#8ea093;border-bottom:1px solid #59665a42}.salvage-grid-flat{margin-top:7px}.salvage-empty{padding:12px 6px;color:#87978a;text-align:center;border:1px dashed #59665a}.salvage-confirm-note{margin-top:5px;color:#89998e;font-size:7px}\n@media(max-width:730px){.bout-score,.salvage-draft{padding:7px}.bout-standing{grid-template-columns:15px minmax(66px,1fr) 42px minmax(95px,1.15fr);font-size:7px}}",
    ".salvage-note{margin:6px 0;color:#9eb0a0}.salvage-done{color:#9fd3a6}.salvage-charter{display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;padding:5px 0 7px;color:#8ea093;border-bottom:1px solid #59665a42}.salvage-grid-flat{margin-top:7px}.salvage-empty{padding:12px 6px;color:#87978a;text-align:center;border:1px dashed #59665a}.salvage-confirm-note{margin-top:5px;color:#89998e;font-size:7px}.salvage-action-message{margin:7px 0 0;padding:6px 7px;border:1px solid #bb7255;color:#efb188;background:#2c1815;font:800 7px/1.35 ui-monospace,monospace}.debrief-content{width:min(700px,92vw)!important;max-height:min(88dvh,720px)!important;overflow:hidden!important;display:flex;flex-direction:column;padding:14px!important}.debrief-pages{display:flex;flex:1 1 auto;min-height:0;width:100%;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-behavior:smooth;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;scrollbar-width:none}.debrief-pages::-webkit-scrollbar{display:none}.debrief-page{flex:0 0 100%;width:100%;min-width:0;min-height:0;overflow-y:auto;scroll-snap-align:start;scroll-snap-stop:always;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;padding:2px 4px 8px}.debrief-page-nav{display:flex;justify-content:center;gap:5px;flex:0 0 auto;padding:8px 0 6px;border-top:1px solid #8a754c44}.debrief-page-nav button{min-width:72px;min-height:26px;padding:4px 8px;border:1px solid #596b60;background:#151b18;color:#87998d;font:800 7px/1 ui-monospace,monospace;letter-spacing:.08em}.debrief-page-nav button.active{border-color:#d0a95f;background:#302a1c;color:#edc77a}.debrief-page .sheet-muted{margin:10px 0 4px}.debrief-content>.sheet-done{flex:0 0 auto;margin-top:2px}.debrief-page .bout-score,.debrief-page .salvage-draft{margin-top:0}.debrief-page-title{margin:0 0 6px;color:#86998a;font:800 7px/1 ui-monospace,monospace;letter-spacing:.15em}\n@media(max-width:730px){.bout-score,.salvage-draft{padding:7px}.bout-standing{grid-template-columns:15px minmax(66px,1fr) 42px minmax(95px,1.15fr);font-size:7px}.debrief-content{width:min(660px,94vw)!important;padding:9px!important}.debrief-page-nav{padding:6px 0 5px}.debrief-page-nav button{min-width:64px;min-height:24px;padding:3px 6px}}",
)

replace_once(
    'acquisitionUI.js',
    "function renderScore(result) {\n    sheet.querySelector('.bout-score')?.remove();\n    if (!result || sheet.classList.contains('hidden')) return;",
    "function renderScore(result) {\n    scorePage.replaceChildren();\n    if (!result || sheet.classList.contains('hidden')) return;",
)
replace_once('acquisitionUI.js', "    lines.after(box);\n}", "    scorePage.append(box);\n}")

replace_once(
    'acquisitionUI.js',
    "function renderDraft(result) {\n    sheet.querySelector('.salvage-draft')?.remove();\n    garage.textContent = 'RETURN TO GARAGE';",
    "function renderDraft(result) {\n    salvagePage.replaceChildren();\n    garage.textContent = 'RETURN TO GARAGE';",
)
replace_once(
    'acquisitionUI.js',
    "    const scoreBox = sheet.querySelector('.bout-score');\n    if (scoreBox) scoreBox.after(panel); else lines.after(panel);\n}",
    "    salvagePage.append(panel);\n}",
)

regex_once(
    'acquisitionUI.js',
    r"function claimPlayerPart\(result, entry\) \{.*?\n\}\n\n// Leaving during the player's turn",
    r'''function showClaimProblem(message) {
    const host = salvagePage.querySelector('.salvage-draft') ?? salvagePage;
    let notice = host.querySelector('.salvage-action-message');
    if (!notice) {
        notice = document.createElement('div');
        notice.className = 'salvage-action-message';
        notice.setAttribute('role', 'status');
        host.append(notice);
    }
    notice.textContent = message;
    if (fieldStatus) {
        fieldStatus.dataset.message = message;
        fieldStatus.textContent = message;
        fieldStatus.classList.add('message', 'blocked');
    }
}

function rollbackDraftClaim(draft, entry, entryId) {
    entry.claimedBy = null;
    const pickIndex = [...draft.picks].reverse().findIndex(pick => pick.actorId === 'player' && pick.entryId === entryId);
    if (pickIndex >= 0) draft.picks.splice(draft.picks.length - 1 - pickIndex, 1);
    draft.cursor = Math.max(0, draft.cursor - 1);
}

function claimPlayerPart(result, entry) {
    if (currentDrafter(result.draft) !== 'player' || entry.destroyed || entry.claimedBy) {
        showClaimProblem('CLAIM NO LONGER AVAILABLE · REFRESHED DRAFT STATE');
        return;
    }
    if (!storage) {
        showClaimProblem('CLAIM BLOCKED · LOCAL SAVE UNAVAILABLE');
        return;
    }
    const session = activePlayerArena();
    const liveAssembly = session?.assembly;
    if (!liveAssembly) {
        showClaimProblem('CLAIM BLOCKED · LIVE GARAGE ASSEMBLY NOT CONNECTED');
        return;
    }
    const offer = claimToRecoveryOffer(entry);
    if (!offer) {
        showClaimProblem('CLAIM BLOCKED · INVALID SALVAGE RECORD');
        return;
    }
    const recovered = recoverSalvage(liveAssembly, offer);
    if (!recovered.ok) {
        showClaimProblem(`CLAIM BLOCKED · ${recovered.reason}`);
        return;
    }
    const removeRecovered = () => {
        const index = liveAssembly.owned.findIndex(part => part.serial === recovered.instance.serial);
        if (index >= 0) liveAssembly.owned.splice(index, 1);
    };

    const claimed = claimDraftEntry(result.draft, 'player', entry.id);
    if (!claimed.ok) {
        removeRecovered();
        showClaimProblem(`CLAIM BLOCKED · ${claimed.reason}`);
        return;
    }

    // Persist the SAME live assembly that pagehide/visibilitychange will later see.
    // If persistence fails, roll both ownership and the draft back atomically instead
    // of leaving a button that appears to have succeeded but loses the physical part.
    const state = loadMachine(storage);
    state.assembly = structuredClone(liveAssembly);
    if (!storeMachine(storage, state)) {
        removeRecovered();
        rollbackDraftClaim(result.draft, entry, entry.id);
        showClaimProblem('CLAIM NOT SAVED · LOCAL STORAGE WRITE FAILED · TRY AGAIN');
        return;
    }

    advanceAiDraft(result.draft, 'player');
    selectedEntryId = entry.id;
    document.dispatchEvent(new CustomEvent('m3ch4:inventory-changed', {
        detail: { serial: recovered.instance.serial, definitionId: recovered.definition.id },
    }));
    if (fieldStatus) {
        fieldStatus.dataset.message = `RECOVERED · ${recovered.definition.name} · ${recovered.instance.serial} · ${percent(recovered.instance.condition)}`;
        fieldStatus.textContent = fieldStatus.dataset.message;
        fieldStatus.classList.remove('blocked');
        fieldStatus.classList.add('message');
    }
    render();
}

function syncPageNav() {
    const width = Math.max(1, pages.clientWidth);
    const maxIndex = pageButtons.reduce((max, button) => button.hidden ? max : Math.max(max, Number(button.dataset.debriefTarget) || 0), 0);
    currentPageIndex = Math.max(0, Math.min(maxIndex, Math.round(pages.scrollLeft / width)));
    for (const button of pageButtons) {
        const active = Number(button.dataset.debriefTarget) === currentPageIndex;
        button.classList.toggle('active', active);
        button.setAttribute('aria-current', active ? 'page' : 'false');
    }
}

function goToPage(index, behavior = 'smooth') {
    const button = pageButtons.find(item => Number(item.dataset.debriefTarget) === index && !item.hidden);
    if (!button) return;
    currentPageIndex = index;
    pages.scrollTo({ left: pages.clientWidth * index, top: 0, behavior });
    syncPageNav();
}

function syncPager(result) {
    const hasSalvage = !!result?.victory;
    salvagePage.hidden = !hasSalvage;
    const salvageButton = pageButtons.find(button => Number(button.dataset.debriefTarget) === 2);
    if (salvageButton) salvageButton.hidden = !hasSalvage;
    if (!hasSalvage && currentPageIndex === 2) currentPageIndex = 1;
    syncPageNav();
}

pageNav.addEventListener('click', event => {
    const button = event.target.closest('[data-debrief-target]');
    if (!button || button.hidden) return;
    goToPage(Number(button.dataset.debriefTarget));
});
pages.addEventListener('scroll', () => {
    if (pageScrollFrame !== null) return;
    pageScrollFrame = requestAnimationFrame(() => {
        pageScrollFrame = null;
        syncPageNav();
    });
}, { passive: true });

// Leaving during the player's turn''',
    flags=re.S,
)

replace_once(
    'acquisitionUI.js',
    "function render() {\n    const result = latestBoutResult();\n    renderScore(result);\n    renderDraft(result);\n}",
    "function render() {\n    const result = latestBoutResult();\n    const newResult = !!result && result !== lastRenderedResult;\n    renderScore(result);\n    renderDraft(result);\n    syncPager(result);\n    if (newResult) {\n        lastRenderedResult = result;\n        currentPageIndex = 0;\n        requestAnimationFrame(() => goToPage(0, 'auto'));\n    } else if (!result) {\n        lastRenderedResult = null;\n    }\n}",
)

# ---------------------------------------------------------------------------
# 2) Three horizontal post-bout pages: result, score, salvage.
# ---------------------------------------------------------------------------
old_debrief = '''    <div id="sortie-debrief" class="sheet hidden" role="dialog" aria-label="Sortie result" aria-modal="true" aria-hidden="true">
      <div class="sheet-content debrief-content">
        <div class="sheet-label">SCRAPYARD CONTRACT / RECOVERY</div>
        <h1 id="debrief-title">SORTIE COMPLETE</h1>
        <div id="debrief-lines" class="debrief-lines" aria-live="polite"></div>
        <p class="sheet-muted">Repair estimate is informational only. Nothing is repaired or charged until you choose a module in the garage.</p>
        <button id="debrief-garage" class="sheet-done" type="button">RETURN TO GARAGE</button>
      </div>
    </div>'''
new_debrief = '''    <div id="sortie-debrief" class="sheet hidden" role="dialog" aria-label="Sortie result" aria-modal="true" aria-hidden="true">
      <div class="sheet-content debrief-content">
        <div id="debrief-pages" class="debrief-pages" aria-label="Post-bout report pages">
          <section class="debrief-page debrief-page-result" data-debrief-page="0" aria-label="Result and accounting">
            <div class="debrief-page-title">01 / RESULT</div>
            <div class="sheet-label">SCRAPYARD CONTRACT / RECOVERY</div>
            <h1 id="debrief-title">SORTIE COMPLETE</h1>
            <div id="debrief-lines" class="debrief-lines" aria-live="polite"></div>
            <p class="sheet-muted">Repair estimate is informational only. Nothing is repaired or charged until you choose a module in the garage.</p>
          </section>
          <section id="debrief-score-page" class="debrief-page" data-debrief-page="1" aria-label="Bout scorecard">
            <div class="debrief-page-title">02 / SCORE</div>
          </section>
          <section id="debrief-salvage-page" class="debrief-page" data-debrief-page="2" aria-label="Salvage claim">
            <div class="debrief-page-title">03 / SALVAGE</div>
          </section>
        </div>
        <nav id="debrief-page-nav" class="debrief-page-nav" aria-label="Post-bout report pages">
          <button class="active" type="button" data-debrief-target="0" aria-current="page">RESULT</button>
          <button type="button" data-debrief-target="1">SCORE</button>
          <button type="button" data-debrief-target="2">SALVAGE</button>
        </nav>
        <button id="debrief-garage" class="sheet-done" type="button">RETURN TO GARAGE</button>
      </div>
    </div>'''
replace_once('index.html', old_debrief, new_debrief)

# ---------------------------------------------------------------------------
# 3) Cheap, intentionally chunky rendering for the desired low-res visual language.
# ---------------------------------------------------------------------------
replace_once('main.js', 'renderer.shadowMap.type = THREE.PCFSoftShadowMap;', 'renderer.shadowMap.type = THREE.BasicShadowMap;')
replace_once(
    'main.js',
    "renderer.domElement.style.touchAction = 'none';",
    "renderer.domElement.style.touchAction = 'none';\nrenderer.domElement.style.imageRendering = 'pixelated';",
)
replace_once('main.js', 'const renderScales = [.55, .70, .85];\nlet renderScaleIndex = 1;', 'const renderScales = [.42, .55, .70];\nlet renderScaleIndex = 1;')

replace_once('scene.js', 'partThumbnailRenderer.setSize(180, 132, false);', 'partThumbnailRenderer.setSize(96, 72, false);')
replace_once('scene.js', 'const camera = new THREE.PerspectiveCamera(36, 180 / 132, .03, 40);', 'const camera = new THREE.PerspectiveCamera(36, 96 / 72, .03, 40);')
replace_once('scene.js', 'sun.shadow.mapSize.set(1024, 1024);', 'sun.shadow.mapSize.set(128, 128);')

# ---------------------------------------------------------------------------
# 4) Cache/version identity. The scene wrapper query is part of the singleton fix.
# ---------------------------------------------------------------------------
replace_once('sceneAssembly.js', "from './scene.js?source=k3l1';", "from './scene.js?source=k3l2';")
replace_once('garageMountUI.js', "import './acquisitionUI.js?v=k3l1';", "import './acquisitionUI.js?v=k3l2';")

index = read('index.html')
index = index.replace('"./scene.js": "./sceneAssembly.js?v=k3l1"', '"./scene.js": "./sceneAssembly.js?v=k3l2"')
index = index.replace('<title>MECH ARENA — 0.0.1k.3l.1 — Bout Stakes + Salvage Draft</title>', '<title>MECH ARENA — 0.0.1k.3l.2 — Post-Bout + Pixel Lighting Polish</title>')
index = index.replace('<header>RIG DIAGNOSTICS <span>0.0.1k.3l.0</span></header>', '<header>RIG DIAGNOSTICS <span>0.0.1k.3l.2</span></header>')
index = index.replace('<button id="resolution-toggle" class="utility-button" type="button">RES 70</button>', '<button id="resolution-toggle" class="utility-button" type="button">RES 55</button>')
index = index.replace('<script type="module" src="./main.js?v=k3l1"></script>', '<script type="module" src="./main.js?v=k3l2"></script>')
index = index.replace('<script type="module" src="./garageMountUI.js?v=k3l1"></script>', '<script type="module" src="./garageMountUI.js?v=k3l2"></script>')
write('index.html', index)

# ---------------------------------------------------------------------------
# 5) Small regression test for the exact mobile failures from playtest.
# ---------------------------------------------------------------------------
test_path = ROOT / 'tests/k3l2PostBout.test.mjs'
test_path.write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const acquisition = readFileSync(new URL('../acquisitionUI.js', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../scene.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('post-bout salvage shares the canonical active arena singleton', () => {
  assert.match(acquisition, /activePlayerArena[^\n]+from '\.\/scene\.js'/s);
  assert.doesNotMatch(acquisition, /from '\.\/sceneAssembly\.js'/);
  assert.match(acquisition, /LIVE GARAGE ASSEMBLY NOT CONNECTED/);
});

test('post-bout report is split into result score and salvage swipe pages', () => {
  assert.match(html, /id="debrief-pages"/);
  assert.match(html, /id="debrief-score-page"/);
  assert.match(html, /id="debrief-salvage-page"/);
  assert.match(html, /data-debrief-target="0"/);
  assert.match(html, /data-debrief-target="1"/);
  assert.match(html, /data-debrief-target="2"/);
  assert.match(acquisition, /scroll-snap-type:x mandatory/);
});

test('mobile renderer deliberately uses a chunky low-cost lighting budget', () => {
  assert.match(main, /THREE\.BasicShadowMap/);
  assert.match(main, /const renderScales = \[\.42, \.55, \.70\]/);
  assert.match(scene, /sun\.shadow\.mapSize\.set\(128, 128\)/);
  assert.match(scene, /partThumbnailRenderer\.setSize\(96, 72, false\)/);
});
''')

print('k.3l.2 patch applied')
