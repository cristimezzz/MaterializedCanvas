import {
  argbFromHex,
  Blend,
  hexFromArgb,
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot,
  TonalPalette,
} from '@material/material-color-utilities';

const kebab = (s: string) => s.replace(/_/g, '-').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

/** Fixed semantic hues, harmonized toward the seed so they sit well in the palette. */
const CUSTOM = {
  success: '#1E8E3E',
  warning: '#E37400',
  info: '#1A73E8',
};

function schemeVars(seed: number, dark: boolean, contrast: number): string[] {
  const scheme = new SchemeTonalSpot(Hct.fromInt(seed), dark, contrast);
  const out: string[] = [];
  for (const c of new MaterialDynamicColors().allColors) {
    out.push(`--md-sys-color-${kebab(c.name)}: ${hexFromArgb(c.getArgb(scheme))};`);
  }
  for (const [name, hex] of Object.entries(CUSTOM)) {
    const palette = TonalPalette.fromInt(Blend.harmonize(argbFromHex(hex), seed));
    const t = dark
      ? { base: 80, on: 20, container: 30, onContainer: 90 }
      : { base: 40, on: 100, container: 90, onContainer: 10 };
    out.push(
      `--mc-${name}: ${hexFromArgb(palette.tone(t.base))};`,
      `--mc-on-${name}: ${hexFromArgb(palette.tone(t.on))};`,
      `--mc-${name}-container: ${hexFromArgb(palette.tone(t.container))};`,
      `--mc-on-${name}-container: ${hexFromArgb(palette.tone(t.onContainer))};`,
    );
  }
  return out;
}

/**
 * Builds the CSS that defines every M3 color role for both schemes.
 * The active scheme is chosen with html[data-mc-theme="light|dark"].
 */
export function buildThemeCss(seedHex: string, contrast: number): string {
  let seed: number;
  try {
    seed = argbFromHex(seedHex);
  } catch {
    seed = argbFromHex('#C8161E');
  }
  const light = schemeVars(seed, false, contrast).join('\n  ');
  const dark = schemeVars(seed, true, contrast).join('\n  ');
  return `html[data-mc-theme="light"] {\n  color-scheme: light;\n  ${light}\n}\nhtml[data-mc-theme="dark"] {\n  color-scheme: dark;\n  ${dark}\n}\n`;
}
