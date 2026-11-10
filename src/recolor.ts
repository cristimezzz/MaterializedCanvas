/**
 * Recolor engine.
 *
 * Canvas (legacy CSS bundles) and InstUI (CSS custom properties on :root) hard-code
 * a fixed palette. Instead of hand-overriding thousands of selectors, we scan every
 * same-origin stylesheet, and for each declaration that carries a color we emit an
 * override rule with the same selector, mapping the color to an M3 color role by
 * (a) what the property paints (background / text / border) and (b) the color's
 * hue, chroma and tone. Because the output only references CSS variables, switching
 * seed color or light/dark mode never requires regenerating it.
 */
import { Hct } from '@material/material-color-utilities';

type Kind = 'bg' | 'fg' | 'bd';

const V = (name: string) => `var(--md-sys-color-${name})`;
const C = (name: string) => `var(--mc-${name})`;

// ---------------------------------------------------------------------------
// Color parsing
// ---------------------------------------------------------------------------
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/g;

interface RGBA { r: number; g: number; b: number; a: number }

function parseColor(s: string): RGBA | null {
  s = s.trim().toLowerCase();
  if (s === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (s === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return null;
    return h.length === 6
      ? { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
      : { r: (n >>> 24) & 255, g: (n >> 16) & 255, b: (n >> 8) & 255, a: (n & 255) / 255 };
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/);
  if (!m) return null;
  let a = m[4] === undefined ? 1 : parseFloat(m[4]);
  if (m[4]?.endsWith('%')) a /= 100;
  return { r: +m[1], g: +m[2], b: +m[3], a };
}

// ---------------------------------------------------------------------------
// Color → role mapping
// ---------------------------------------------------------------------------
type Family = 'primary' | 'error' | 'success' | 'warning' | 'tertiary';

function family(hue: number): Family {
  if (hue < 40 || hue >= 345) return 'error';
  if (hue < 105) return 'warning';
  if (hue < 165) return 'success';
  if (hue < 290) return 'primary';
  return 'tertiary';
}

function familyRole(f: Family, kind: Kind, tone: number): string {
  const md = f === 'primary' || f === 'error' || f === 'tertiary';
  const base = md ? V(f) : C(f);
  const container = md ? V(`${f}-container`) : C(`${f}-container`);
  const onContainer = md ? V(`on-${f}-container`) : C(`on-${f}-container`);
  if (kind === 'bg') return tone >= 82 ? container : base;
  if (kind === 'bd') return tone >= 82 ? container : base;
  // text
  return tone >= 82 ? onContainer : base;
}

function neutralRole(kind: Kind, tone: number): string {
  if (kind === 'bg') {
    if (tone >= 98.5) return V('surface');
    if (tone >= 94) return V('surface-container');
    if (tone >= 89) return V('surface-container-high');
    if (tone >= 75) return V('surface-container-highest');
    if (tone >= 45) return V('outline');
    return V('inverse-surface');
  }
  if (kind === 'fg') {
    if (tone >= 92) return V('on-primary');
    if (tone >= 66) return V('outline');
    if (tone >= 40) return V('on-surface-variant');
    return V('on-surface');
  }
  // border
  if (tone >= 97) return V('surface');
  if (tone >= 70) return V('outline-variant');
  return V('outline');
}

const memo = new Map<string, string | null>();

export function mapColor(raw: string, kind: Kind): string | null {
  const key = kind + raw;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const c = parseColor(raw);
  let out: string | null = null;
  if (c && c.a > 0) {
    const isBlackAlpha = c.a < 1 && c.r < 60 && c.g < 60 && c.b < 70;
    const isWhiteAlpha = c.a < 1 && c.r > 230 && c.g > 230 && c.b > 230;
    if (isBlackAlpha) {
      // Hover tints and hairlines; leave real scrims (heavy alpha backgrounds) alone.
      if (kind !== 'bg' || c.a < 0.3) out = mix(V('on-surface'), c.a);
    } else if (isWhiteAlpha) {
      // Frosted headers (rgba(255,255,255,.9)) follow the surface; faint glints on images stay.
      out = kind === 'bg' && c.a >= 0.5 ? mix(V('surface'), c.a) : null;
    } else {
      const hct = Hct.fromInt(((255 << 24) | (c.r << 16) | (c.g << 8) | c.b) >>> 0);
      const role = hct.chroma < 14 ? neutralRole(kind, hct.tone) : familyRole(family(hct.hue), kind, hct.tone);
      out = c.a < 1 ? mix(role, c.a) : role;
    }
  }
  memo.set(key, out);
  return out;
}

const mix = (role: string, a: number) =>
  `color-mix(in srgb, ${role} ${Math.round(a * 1000) / 10}%, transparent)`;

// ---------------------------------------------------------------------------
// Property classification
// ---------------------------------------------------------------------------
function kindOfProp(prop: string): Kind | 'shadow' | null {
  if (prop.startsWith('--')) {
    const name = prop.replace(/^--[a-zA-Z]{5}-/, '');
    if (/shadow/i.test(name)) return 'shadow';
    if (/background|bg|track|fill(?!ed)|facade|checked(?!.*Label)/i.test(name)) return 'bg';
    if (/border|outline|focus|ring|stroke/i.test(name)) return 'bd';
    if (/color/i.test(name)) return 'fg';
    return 'fg';
  }
  if (prop.startsWith('background') || prop === 'fill') return 'bg';
  if (prop.startsWith('border') || prop.startsWith('outline') || prop === 'column-rule-color') return 'bd';
  if (prop === 'box-shadow' || prop === 'text-shadow') return 'shadow';
  if (prop === 'color' || prop === 'caret-color' || prop === 'text-decoration-color' || prop === 'stroke') return 'fg';
  return null;
}

const FONT_RE = /LatoWeb|"Lato Extended"|Lato\b/;

function mapRadius(v: string): string | null {
  const m = v.trim().match(/^([\d.]+)rem$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (n === 0 || n >= 100) return null;
  if (n <= 0.125) return '0.25rem';
  if (n <= 0.25) return 'var(--mc-shape-sm)';
  return 'var(--mc-shape-md)';
}

/** Returns the rewritten value, or null if the declaration needs no override. */
function rewrite(prop: string, value: string): string | null {
  if (!value || value.includes('var(--md-') || value.includes('var(--mc-')) return null;

  if (prop === 'font-family' || /^--[a-zA-Z]{5}-.*[fF]ontFamily$/.test(prop)) {
    return FONT_RE.test(value) && !/monospace/.test(value) ? 'var(--mc-font)' : null;
  }
  if (/^--[a-zA-Z]{5}-.*[rR]adius$/.test(prop)) return mapRadius(value);

  const kind = kindOfProp(prop);
  if (!kind) return null;
  if (kind === 'shadow') {
    // Keep shadows, but recolor dark shadows to the theme shadow color so they read in dark mode.
    return null;
  }
  let changed = false;
  const out = value.replace(COLOR_RE, (m) => {
    const r = mapColor(m, kind);
    if (r) changed = true;
    return r ?? m;
  });
  return changed ? out : null;
}

// ---------------------------------------------------------------------------
// Stylesheet walking
// ---------------------------------------------------------------------------
/** Selectors that encode user/course specific colors (calendar contexts, course colors). */
const SKIP_SELECTOR = /group_(course|user|group|appointment)_|\.fc-event|ic-DashboardCard__header_hero|\.mc-|#mc-/;

function processRules(rules: CSSRuleList, out: string[]): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      if (SKIP_SELECTOR.test(rule.selectorText)) continue;
      const decls: string[] = [];
      const st = rule.style;
      for (let i = 0; i < st.length; i++) {
        const prop = st[i];
        const value = st.getPropertyValue(prop);
        const nv = rewrite(prop, value);
        if (nv !== null) {
          decls.push(`${prop}:${nv}${st.getPropertyPriority(prop) ? ' !important' : ''}`);
        }
      }
      if (decls.length) out.push(`${rule.selectorText}{${decls.join(';')}}`);
    } else if (rule instanceof CSSMediaRule) {
      const inner: string[] = [];
      processRules(rule.cssRules, inner);
      if (inner.length) out.push(`@media ${rule.conditionText}{${inner.join('\n')}}`);
    } else if (rule instanceof CSSSupportsRule) {
      const inner: string[] = [];
      processRules(rule.cssRules, inner);
      if (inner.length) out.push(`@supports ${rule.conditionText}{${inner.join('\n')}}`);
    }
  }
}

export function recolorSheet(sheet: CSSStyleSheet): string | null {
  let rules: CSSRuleList;
  try {
    rules = sheet.cssRules;
  } catch {
    return null; // cross-origin
  }
  const out: string[] = [];
  processRules(rules, out);
  return out.join('\n');
}

/** Recolor a single inline style declaration block (used for user content in dark mode). */
export function recolorInline(style: CSSStyleDeclaration): void {
  for (const prop of ['color', 'background-color', 'background', 'border-color']) {
    const v = style.getPropertyValue(prop);
    if (!v) continue;
    const kind = kindOfProp(prop) as Kind;
    const nv = v.replace(COLOR_RE, (m) => mapColor(m, kind) ?? m);
    if (nv !== v) style.setProperty(prop, nv);
  }
}
