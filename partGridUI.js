/** k.3l.1 — shared visual component-card UI for garage and salvage.
 * Cards intentionally show the physical object first. Names/serials/details live in
 * the focused detail panel so the grid reads like a rack of actual hardware.
 */
const SLOT_ORDER = Object.freeze(['structure', 'mobility', 'power', 'command', 'combat']);
const GLYPHS = Object.freeze({ structure: '⬡', mobility: '⋀', power: 'ϟ', command: '◉', combat: '✦' });
const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function normalizedPartStatus(entry) {
    if (entry?.destroyed || entry?.status === 'destroyed') return 'destroyed';
    if (entry?.status === 'disabled' || clamp01(entry?.condition) <= .001) return 'disabled';
    const condition = clamp01(entry?.condition);
    if (entry?.status === 'critical' || condition < .38) return 'critical';
    if (entry?.status === 'damaged' || condition < .78) return 'damaged';
    return 'operational';
}

export function sortPartEntries(entries = [], mode = 'wreck') {
    const list = [...entries];
    if (mode === 'value')
        return list.sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || (b.condition ?? 0) - (a.condition ?? 0) || String(a.id).localeCompare(String(b.id)));
    if (mode === 'condition')
        return list.sort((a, b) => Number(a.destroyed) - Number(b.destroyed) || (b.condition ?? 0) - (a.condition ?? 0) || (b.value ?? 0) - (a.value ?? 0));
    if (mode === 'type')
        return list.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || (b.value ?? 0) - (a.value ?? 0) || String(a.id).localeCompare(String(b.id)));
    return list;
}

export function installPartGridStyles() {
    if (document.querySelector('#m3ch4-part-grid-styles')) return;
    const style = document.createElement('style');
    style.id = 'm3ch4-part-grid-styles';
    style.textContent = `
.part-grid-toolbar{display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin:7px 0}.part-grid-toolbar button{min-height:26px;padding:4px 7px;border:1px solid #596b60;background:#171d1a;color:#9dac9d;font:800 7px/1 ui-monospace,monospace;letter-spacing:.06em}.part-grid-toolbar button.active{border-color:#d0a95f;color:#edc77a;background:#2b291e}.part-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:6px;margin-top:6px}.part-card{position:relative;aspect-ratio:1.12/1;min-height:82px;padding:0;border:2px solid #60766a;background:linear-gradient(#121915,#0a0f0d);overflow:hidden;color:#d7d1be;box-shadow:inset 0 0 0 1px #0b100e;touch-action:manipulation}.part-card.state-operational{border-color:#6fa786}.part-card.state-damaged{border-color:#c59f50}.part-card.state-critical{border-color:#d47645}.part-card.state-disabled{border-color:#cb5143}.part-card.state-destroyed{border-color:#4d3a35;background:#080a09}.part-card.selected{outline:2px solid #edcb7b;outline-offset:1px}.part-card.claimed{opacity:.46}.part-card img{position:absolute;inset:3px;width:calc(100% - 6px);height:calc(100% - 6px);object-fit:contain;image-rendering:auto}.part-card-slot,.part-card-value,.part-card-condition,.part-card-source{position:absolute;z-index:2;padding:2px 3px;background:#08100dd9;font:800 7px/1 ui-monospace,monospace;text-shadow:0 1px #000}.part-card-slot{left:3px;top:3px;font-size:11px;color:#b8cbbd}.part-card-value{right:3px;top:3px;color:#edc77a}.part-card-condition{right:3px;bottom:3px;color:#cbd4ca}.part-card-source{left:3px;bottom:3px;max-width:54%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#87998d}.part-card.state-destroyed img{filter:brightness(.38) saturate(.55)}.part-detail{display:grid;grid-template-columns:minmax(108px,34%) 1fr;gap:9px;margin-top:8px;padding:8px;border:1px solid #68776d;background:#111714}.part-detail-preview{position:relative;min-height:112px;border:1px solid #4f6056;background:#090e0c}.part-detail-preview img{position:absolute;inset:3px;width:calc(100% - 6px);height:calc(100% - 6px);object-fit:contain}.part-detail-copy{min-width:0}.part-detail h3{margin:0 0 4px;color:#edc77a;font:900 10px/1.15 ui-monospace,monospace}.part-detail-meta{white-space:pre-line;color:#aeb9ae;font:7px/1.45 ui-monospace,monospace}.part-detail-value{margin-top:5px;color:#edc77a;font:900 10px/1 ui-monospace,monospace}.part-detail-action{width:100%;min-height:34px;margin-top:7px;border:1px solid #d0a95f;background:#b99552;color:#101713;font:900 8px/1.1 ui-monospace,monospace}.part-detail-action:disabled{opacity:.42}.wreck-grid-section{margin-top:8px}.wreck-grid-section>header{display:flex;justify-content:space-between;gap:8px;align-items:end;padding:4px 1px;color:#d8bc78;font:800 8px/1.2 ui-monospace,monospace}.wreck-grid-section>header small{color:#829588;text-align:right;font-size:6px}@media(max-width:650px){.part-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.part-card{min-height:72px}.part-detail{grid-template-columns:100px 1fr;padding:6px;gap:7px}.part-detail-preview{min-height:98px}}
`;
    document.head.append(style);
}

export function createPartCard({ entry, thumbnailUrl = null, value = 0, selected = false, source = '', claimed = false, onSelect = null } = {}) {
    const status = normalizedPartStatus(entry);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `part-card state-${status}${selected ? ' selected' : ''}${claimed ? ' claimed' : ''}`;
    button.dataset.serial = entry?.sourceSerial ?? entry?.serial ?? '';
    button.dataset.entryId = entry?.id ?? '';
    button.setAttribute('aria-pressed', String(selected));
    const label = entry?.name ?? entry?.definition?.name ?? entry?.definitionId ?? 'component';
    button.setAttribute('aria-label', `${label} · ${status} · ${Math.round(clamp01(entry?.condition) * 100)} percent · value ${value} credits`);
    if (thumbnailUrl) {
        const img = document.createElement('img');
        img.src = thumbnailUrl;
        img.alt = '';
        img.draggable = false;
        button.append(img);
    }
    const glyph = document.createElement('span'); glyph.className = 'part-card-slot'; glyph.textContent = GLYPHS[entry?.slot] ?? '·';
    const credit = document.createElement('span'); credit.className = 'part-card-value'; credit.textContent = `₡${Math.round(value).toLocaleString()}`;
    const condition = document.createElement('span'); condition.className = 'part-card-condition'; condition.textContent = status === 'destroyed' ? 'SCRAP' : `${Math.round(clamp01(entry?.condition) * 100)}%`;
    button.append(glyph, credit, condition);
    if (source) { const sourceEl = document.createElement('span'); sourceEl.className = 'part-card-source'; sourceEl.textContent = source; button.append(sourceEl); }
    if (onSelect) button.addEventListener('click', () => onSelect(entry));
    return button;
}

export function createPartDetail({ entry, thumbnailUrl = null, value = 0, meta = '', actionLabel = null, actionDisabled = false, onAction = null } = {}) {
    const status = normalizedPartStatus(entry);
    const detail = document.createElement('section');
    detail.className = `part-detail state-${status}`;
    const preview = document.createElement('div'); preview.className = 'part-detail-preview';
    if (thumbnailUrl) { const img = document.createElement('img'); img.src = thumbnailUrl; img.alt = ''; preview.append(img); }
    const copy = document.createElement('div'); copy.className = 'part-detail-copy';
    const title = document.createElement('h3'); title.textContent = entry?.name ?? entry?.definition?.name ?? entry?.definitionId ?? 'COMPONENT';
    const info = document.createElement('div'); info.className = 'part-detail-meta';
    const serial = entry?.sourceSerial ?? entry?.serial ?? '—';
    info.textContent = `SERIAL ${serial}\n${status.toUpperCase()} · ${Math.round(clamp01(entry?.condition) * 100)}%${meta ? `\n${meta}` : ''}`;
    const credit = document.createElement('div'); credit.className = 'part-detail-value'; credit.textContent = `YARD VALUE · ₡${Math.round(value).toLocaleString()}`;
    copy.append(title, info, credit);
    if (actionLabel) {
        const action = document.createElement('button'); action.type = 'button'; action.className = 'part-detail-action'; action.textContent = actionLabel; action.disabled = !!actionDisabled;
        if (onAction) action.addEventListener('click', onAction);
        copy.append(action);
    }
    detail.append(preview, copy);
    return detail;
}
