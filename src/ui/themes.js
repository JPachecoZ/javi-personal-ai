/**
 * Theme system — ported from the Javi design (coral / salvia / terra / noche).
 *
 * Each theme is a set of design tokens. `createThemes` applies a theme by
 * writing CSS custom properties on :root (so a theme switch is one cheap style
 * update, no re-render), renders the swatch picker, and persists the choice to
 * localStorage. The rest of the app reads these via var(--token) in CSS.
 */

export const THEMES = {
  coral: {
    name: 'Coral',
    color: '#f4a99c', glow: 'rgba(240,138,126,.6)', haze: 'rgba(240,138,126,.34)',
    dot: '#f08a7e', word: '#f6dcd4', sc: '#a8847e',
    segBg: 'rgba(56,32,30,.5)', segBd: 'rgba(240,150,138,.18)',
    ib: 'rgba(56,32,30,.5)', ibd: 'rgba(240,150,138,.22)',
    accent: '#f29385', accent2: '#d9604f', accentInk: '#2c1311',
    bg: 'radial-gradient(132% 100% at 50% 22%, #321d1f 0%, #1c1012 58%, #140b0c 100%)',
  },
  salvia: {
    name: 'Salvia',
    color: '#aed5b2', glow: 'rgba(156,196,160,.55)', haze: 'rgba(156,196,160,.3)',
    dot: '#9cc4a0', word: '#dfeadf', sc: '#8aa090',
    segBg: 'rgba(34,44,38,.5)', segBd: 'rgba(156,196,160,.18)',
    ib: 'rgba(34,44,38,.5)', ibd: 'rgba(156,196,160,.22)',
    accent: '#a6cfaa', accent2: '#6fa97c', accentInk: '#15201a',
    bg: 'radial-gradient(132% 100% at 50% 22%, #21291f 0%, #141a16 58%, #0f130f 100%)',
  },
  terra: {
    name: 'Terracota',
    color: '#f0a86a', glow: 'rgba(219,124,65,.6)', haze: 'rgba(219,124,65,.32)',
    dot: '#db7c41', word: '#f0d8c2', sc: '#a8866e',
    segBg: 'rgba(50,34,22,.5)', segBd: 'rgba(219,124,65,.2)',
    ib: 'rgba(50,34,22,.5)', ibd: 'rgba(219,124,65,.26)',
    accent: '#e8915a', accent2: '#d9703f', accentInk: '#2a1810',
    bg: 'radial-gradient(132% 100% at 50% 22%, #2e1f13 0%, #1a110a 58%, #120c07 100%)',
  },
  noche: {
    name: 'Azul Noche',
    color: '#9fc0f2', glow: 'rgba(108,150,230,.6)', haze: 'rgba(108,150,230,.3)',
    dot: '#7aa0ec', word: '#dde7f7', sc: '#8595b4',
    segBg: 'rgba(28,36,56,.5)', segBd: 'rgba(120,160,236,.18)',
    ib: 'rgba(28,36,56,.5)', ibd: 'rgba(120,160,236,.22)',
    accent: '#7aa0ec', accent2: '#4f6fc9', accentInk: '#101626',
    bg: 'radial-gradient(132% 100% at 50% 22%, #1a2238 0%, #111726 58%, #0c111c 100%)',
  },
};

/** hex (#rrggbb) + alpha → rgba() string. */
function hexA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Map a theme's tokens to the CSS custom properties the stylesheet consumes. */
function toCssVars(t) {
  return {
    '--bg': t.bg,
    '--word': t.word,
    '--sc': t.sc,
    '--dot': t.dot,
    '--orb-color': t.color,
    '--orb-glow': t.glow,
    '--haze': t.haze,
    '--seg-bg': t.segBg,
    '--seg-bd': t.segBd,
    '--ib': t.ib,
    '--ibd': t.ibd,
    '--accent': t.accent,
    '--accent2': t.accent2,
    '--accent-ink': t.accentInk,
    '--accent-grad': `linear-gradient(135deg, ${t.accent}, ${t.accent2})`,
    '--mic-bg-idle': hexA(t.accent, 0.14),
    '--mic-ring': hexA(t.accent, 0.18),
    '--send-bg-idle': hexA(t.accent, 0.12),
  };
}

const STORAGE_KEY = 'javi-theme';

export function createThemes(swatchHost, { defaultKey = 'coral', onChange } = {}) {
  let current = localStorage.getItem(STORAGE_KEY);
  if (!current || !THEMES[current]) current = THEMES[defaultKey] ? defaultKey : 'coral';

  function renderSwatches() {
    swatchHost.innerHTML = '';
    for (const key of Object.keys(THEMES)) {
      const t = THEMES[key];
      const el = document.createElement('button');
      el.className = 'swatch' + (key === current ? ' active' : '');
      el.title = t.name;
      el.style.background = t.dot;
      el.style.color = t.dot; // drives the active ring via currentColor
      el.addEventListener('click', () => apply(key));
      swatchHost.appendChild(el);
    }
  }

  function apply(key) {
    if (!THEMES[key]) return;
    current = key;
    const vars = toCssVars(THEMES[key]);
    for (const [k, v] of Object.entries(vars)) {
      document.documentElement.style.setProperty(k, v);
    }
    localStorage.setItem(STORAGE_KEY, key);
    renderSwatches();
    onChange?.(key);
  }

  return {
    get current() {
      return current;
    },
    /** Apply the persisted/default theme and render the picker. */
    init() {
      apply(current);
    },
  };
}
