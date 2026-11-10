/**
 * Vite plugin: GreasyFork rejects scripts that look minified (very long lines). Vite inlines each
 * `?inline` stylesheet as a single-line, minified string. This pass rewrites every long string
 * literal assigned with `var x = "…";` into a template literal, pretty-printing CSS one declaration
 * per line. CSS semantics are untouched: only whitespace between tokens changes.
 */
import type { Plugin } from 'vite';

const LONG = 200;

/** Pretty-print minified CSS. Quotes and parentheses (url(), data URIs) are copied verbatim. */
export function formatCss(css: string): string {
  let out = '';
  let depth = 0;
  let quote: string | null = null;
  let parens = 0;
  const nl = () => '\n' + '  '.repeat(depth);
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      out += c;
      if (c === '\\') out += css[++i] ?? '';
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      out += c;
      continue;
    }
    if (c === '(') parens++;
    if (c === ')') parens--;
    if (parens > 0) {
      out += c;
      continue;
    }
    if (c === '{') {
      depth++;
      out = out.trimEnd() + ' {' + nl();
    } else if (c === '}') {
      depth = Math.max(0, depth - 1);
      out = out.trimEnd() + nl() + '}' + nl();
    } else if (c === ';') {
      out += ';' + nl();
    } else if (c === ',' && depth === 0) {
      out += ',' + nl(); // one selector per line
    } else if (c === '\n') {
      out += nl();
    } else {
      out += c;
    }
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim() + '\n';
}

const toTemplate = (s: string) => '`' + s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';

export function readableStrings(): Plugin {
  return {
    name: 'mc-readable-strings',
    apply: 'build',
    enforce: 'post',
    renderChunk(code) {
      const next = code.replace(/^(\s*var [\w$]+ = )("(?:[^"\\\n]|\\.)*");$/gm, (line, head: string, lit: string) => {
        if (line.length <= LONG) return line;
        let value: string;
        try {
          value = JSON.parse(lit);
        } catch {
          return line;
        }
        const looksCss = /[{}]/.test(value) && /:[^;]+;|:[^}]+\}/.test(value) && !value.trimStart().startsWith('<');
        const body = looksCss ? formatCss(value) : value.replace(/></g, '>\n<');
        return head + toTemplate('\n' + body) + ';';
      });
      return next === code ? null : { code: next, map: null };
    },
  };
}
