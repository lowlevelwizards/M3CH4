/** M3CH4 k4t.1 — canvas/Three.js mirrors of typography.css roles.
 * Keep these names in sync with the three CSS custom properties.
 * Decorative glyphs can continue to use a Unicode-capable system fallback.
 */
export const TYPEFACES = Object.freeze({
  identity: 'Quantico',
  ui: 'Oxanium',
  data: 'Share Tech Mono',
});

function fontStack(role) {
  const fallback = role === 'data' ? 'monospace' : 'sans-serif';
  // CSS tokens are the source of truth. Editing typography.css switches
  // DOM and painted 3D labels together, without touching scene code.
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const style = window.getComputedStyle(document.documentElement);
    const stack = style.getPropertyValue('--m3-font-' + role).trim();
    if (stack) return stack;
  }
  return `"${TYPEFACES[role] ?? TYPEFACES.data}", ${fallback}`;
}

export function canvasFont(size, role = 'data', weight = 700) {
  // Share Tech Mono only publishes a regular face; don't synthesize bold.
  const resolvedWeight = role === 'data' ? 400 : weight;
  return `${resolvedWeight} ${size}px ${fontStack(role)}`;
}

/** Refresh any once-painted CanvasTextures when real fonts become available.
 * Never blocks a game boot: fallback text is valid while remote fonts load.
 */
export function whenGameFontsReady(redraw) {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  const loadRole = (role, weight) => {
    const family = fontStack(role).match(/^["']([^"']+)["']/)?.[1] ?? TYPEFACES[role];
    return document.fonts.load(`${weight} 24px "${family}"`);
  };
  Promise.allSettled([
    loadRole('identity', 700),
    loadRole('ui', 700),
    loadRole('data', 400),
  ]).then(() => redraw()).catch(() => {});
}
