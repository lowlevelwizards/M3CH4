/** M3CH4 k4t.1 — canvas/Three.js mirrors of typography.css roles.
 * Keep these names in sync with the three CSS custom properties.
 * Decorative glyphs can continue to use a Unicode-capable system fallback.
 */
export const TYPEFACES = Object.freeze({
  identity: 'Quantico',
  ui: 'Oxanium',
  data: 'Share Tech Mono',
});

export function canvasFont(size, role = 'data', weight = 700) {
  const family = TYPEFACES[role] ?? TYPEFACES.data;
  const fallback = role === 'data' ? 'monospace' : 'sans-serif';
  // Share Tech Mono only publishes a regular face; don't synthetically bold it.
  const resolvedWeight = role === 'data' ? 400 : weight;
  return `${resolvedWeight} ${size}px "${family}", ${fallback}`;
}

/** Refresh any once-painted CanvasTextures when real fonts become available.
 * Never blocks a game boot: fallback text is valid while remote fonts load.
 */
export function whenGameFontsReady(redraw) {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  Promise.allSettled([
    document.fonts.load('700 24px "Quantico"'),
    document.fonts.load('700 24px "Oxanium"'),
    document.fonts.load('400 24px "Share Tech Mono"'),
  ]).then(() => redraw()).catch(() => {});
}
