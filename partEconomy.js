/** k.3l.1 — physical component valuation.
 *
 * Values describe the yard value of one specific owned instance, not rarity tiers.
 * Definition values are authored; condition/wear then modify what that real object is
 * worth. Disabled hardware retains rebuild value, while destroyed hardware is scrap.
 */
const BASE_VALUES = Object.freeze({
    'frame-sr': 1600,
    'frame-utility': 1250,
    'frame-wedge': 1550,
    'legs-yard': 1450,
    'legs-hauler': 1850,
    'legs-compact': 1600,
    'power-dynamo': 980,
    'power-air': 820,
    'power-forge': 1680,
    'cab-cyclops': 850,
    'cab-armored': 1100,
    'cab-utility': 760,
    'gun-cannon': 1250,
    'gun-short': 1150,
    'gun-light': 1350,
    'gun-scatter': 1250,
});

const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const nearestTen = value => Math.max(10, Math.round(value / 10) * 10);

export function basePartValue(definitionOrId) {
    const id = typeof definitionOrId === 'string' ? definitionOrId : definitionOrId?.id;
    return BASE_VALUES[id] ?? 500;
}

/** Disabled-but-intact hardware remains a real rebuildable component, so zero
 * condition still carries meaningful value. Destroyed hardware is only carcass/scrap. */
export function partCreditValue(definitionOrId, condition = 1, { destroyed = false, wear = 0 } = {}) {
    const base = basePartValue(definitionOrId);
    const c = clamp01(condition);
    const wearFactor = 1 - clamp01(wear) * .30;
    if (destroyed)
        return nearestTen(base * (.065 + c * .025) * wearFactor);
    const conditionFactor = .22 + .78 * Math.pow(c, .72);
    return nearestTen(base * conditionFactor * wearFactor);
}

export function valueTable() {
    return { ...BASE_VALUES };
}
