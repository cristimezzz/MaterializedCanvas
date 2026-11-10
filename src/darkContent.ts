/**
 * Dark mode for content Canvas doesn't style through stylesheets:
 *  - inline colors in teacher-authored HTML (.user_content, announcements, syllabus)
 *  - the TinyMCE editor iframe (about:blank, so the userscript itself doesn't run there)
 */
import { recolorInline } from './recolor';

const ORIG = 'data-mc-orig-style';
const SCOPE = '.user_content, .show-content, #course_syllabus, .discussion-section .message, [data-resource-type="wiki_page.body"]';

let active = false;
let recolorUC = true;
let mo: MutationObserver | null = null;

function recolorTree(root: ParentNode): void {
  const els = root.querySelectorAll<HTMLElement>(
    `:is(${SCOPE}) [style*="color"], :is(${SCOPE}) [style*="background"], :is(${SCOPE}) [style*="border"], :is(${SCOPE}) font[color], :is(${SCOPE}) [bgcolor]`,
  );
  for (const el of els) {
    if (el.closest('#mc-settings-host')) continue;
    if (!el.hasAttribute(ORIG)) el.setAttribute(ORIG, el.getAttribute('style') ?? '');
    if (el.tagName === 'FONT' && el.getAttribute('color')) {
      el.style.color = el.getAttribute('color')!;
    }
    const bg = el.getAttribute('bgcolor');
    if (bg) el.style.backgroundColor = bg;
    recolorInline(el.style);
  }
}

function restoreTree(): void {
  for (const el of document.querySelectorAll<HTMLElement>(`[${ORIG}]`)) {
    const orig = el.getAttribute(ORIG)!;
    if (orig) el.setAttribute('style', orig);
    else el.removeAttribute('style');
    el.removeAttribute(ORIG);
  }
}

// ---------------------------------------------------------------- TinyMCE / same-origin iframes
const EDITOR_CSS = `
html, body { background: var(--md-sys-color-surface-container-lowest) !important; color: var(--md-sys-color-on-surface) !important; color-scheme: dark; }
a { color: var(--md-sys-color-primary) !important; }
table, td, th { border-color: var(--md-sys-color-outline-variant) !important; }
`;

function themeIframe(iframe: HTMLIFrameElement, vars: string): void {
  let doc: Document | null = null;
  try {
    doc = iframe.contentDocument;
  } catch {
    return;
  }
  if (!doc || !doc.head) return;
  if (doc.location.href !== 'about:blank' && !doc.location.href.startsWith(location.origin)) return;
  let el = doc.getElementById('mc-editor-theme') as HTMLStyleElement | null;
  if (!active) {
    el?.remove();
    return;
  }
  if (!el) {
    el = doc.createElement('style');
    el.id = 'mc-editor-theme';
    doc.head.appendChild(el);
  }
  el.textContent = `:root{${vars}}\n${EDITOR_CSS}`;
}

function currentVars(): string {
  const cs = getComputedStyle(document.documentElement);
  const names = ['surface-container-lowest', 'on-surface', 'primary', 'outline-variant'];
  return names.map((n) => `--md-sys-color-${n}:${cs.getPropertyValue(`--md-sys-color-${n}`)};`).join('');
}

function themeEditors(): void {
  const vars = currentVars();
  for (const f of document.querySelectorAll<HTMLIFrameElement>('.tox-edit-area__iframe, iframe[id$="_ifr"]')) {
    themeIframe(f, vars);
    f.addEventListener('load', () => themeIframe(f, currentVars()), { once: true });
  }
}

// ---------------------------------------------------------------- public API
let pending = false;
function schedule(): void {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    if (!active) return;
    if (recolorUC) recolorTree(document);
    themeEditors();
  });
}

export function setDarkContent(on: boolean, recolorUserContent: boolean): void {
  const was = active;
  active = on;
  recolorUC = recolorUserContent;
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', () => setDarkContent(on, recolorUserContent), { once: true });
    return;
  }
  if (on) {
    if (recolorUserContent) recolorTree(document);
    else restoreTree();
    themeEditors();
    if (!mo) {
      mo = new MutationObserver(schedule);
      mo.observe(document.body, { childList: true, subtree: true });
    }
  } else if (was || mo) {
    mo?.disconnect();
    mo = null;
    restoreTree();
    themeEditors(); // removes injected editor styles
  }
}
