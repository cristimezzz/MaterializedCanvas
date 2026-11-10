/**
 * Keeps Materialized Canvas' <style> elements in the document, in the right order:
 *
 *   [Canvas & InstUI sheets] → [recolor overrides, one per source sheet] → [theme vars] → [hand-written M3 styles]
 *
 * Recolor output for <link> stylesheets is cached by URL (Canvas fingerprints its
 * bundle URLs), so on later page loads the overrides are injected at document-start
 * before the page paints.
 */
import { GM_getValue, GM_setValue } from '$';
import { recolorSheet } from './recolor';

const CACHE_KEY = 'recolorCache';
const CACHE_VERSION = 4; // bump when recolor.ts output changes
const CACHE_LIMIT = 40;

interface CacheEntry { css: string; t: number }
interface Cache { v: number; entries: Record<string, CacheEntry>; lastHrefs: string[] }

let cache: Cache = { v: CACHE_VERSION, entries: {}, lastHrefs: [] };
let cacheDirty = false;

function loadCache(): void {
  const c = GM_getValue<Cache | null>(CACHE_KEY, null);
  if (c && c.v === CACHE_VERSION) cache = c;
}

function flushCache(): void {
  if (!cacheDirty) return;
  const keys = Object.keys(cache.entries);
  if (keys.length > CACHE_LIMIT) {
    keys
      .sort((a, b) => cache.entries[a].t - cache.entries[b].t)
      .slice(0, keys.length - CACHE_LIMIT)
      .forEach((k) => delete cache.entries[k]);
  }
  GM_setValue(CACHE_KEY, cache);
  cacheDirty = false;
}

// ---------------------------------------------------------------------------
const root = () => document.head ?? document.documentElement;
const MARK = 'data-mc';

function makeStyle(id: string): HTMLStyleElement {
  const el = document.createElement('style');
  el.setAttribute(MARK, id);
  return el;
}

/** Fixed elements that must stay last. */
const fixed: HTMLStyleElement[] = [];
/** Recolor outputs keyed by source sheet key. */
const outputs = new Map<string, HTMLStyleElement>();
/** Source sheets already processed → rule count at processing time. */
const seen = new WeakMap<CSSStyleSheet, number>();

let enabled = true;

export function addFixedStyle(id: string, css: string): HTMLStyleElement {
  const el = makeStyle(id);
  el.textContent = css;
  fixed.push(el);
  root().appendChild(el);
  return el;
}

function isOurs(node: Node | null): boolean {
  return !!node && node instanceof Element && node.hasAttribute(MARK);
}

/** Move our elements to the end of <head> if some other stylesheet got appended after them. */
function ensureOrder(): void {
  const parent = root();
  const last = parent.lastElementChild;
  const ours = [...outputs.values(), ...fixed];
  // Check whether any non-ours stylesheet node sits after our first element.
  let needs = false;
  const first = ours.find((e) => e.parentNode);
  if (!first || first.parentNode !== parent) needs = true;
  else {
    for (let n = first.nextElementSibling; n; n = n.nextElementSibling) {
      if (!isOurs(n) && (n.tagName === 'STYLE' || (n.tagName === 'LINK' && (n as HTMLLinkElement).rel === 'stylesheet'))) {
        needs = true;
        break;
      }
    }
  }
  if (!needs && last && isOurs(last)) return;
  if (!needs) return;
  for (const el of ours) parent.appendChild(el);
}

function sheetKey(sheet: CSSStyleSheet, index: number): string {
  return sheet.href ?? `inline:${index}`;
}

function setOutput(key: string, css: string): void {
  let el = outputs.get(key);
  if (!el) {
    el = makeStyle(`recolor ${key.slice(-60)}`);
    outputs.set(key, el);
  }
  if (el.textContent !== css) el.textContent = css;
  if (!el.isConnected && enabled) {
    const before = fixed.find((f) => f.isConnected) ?? null;
    root().insertBefore(el, before && before.parentNode === root() ? before : null);
  }
}

/** Scan document stylesheets and (re)generate overrides where needed. */
export function scan(): void {
  if (!enabled) return;
  const sheets = Array.from(document.styleSheets);
  let inlineIdx = 0;
  const hrefs: string[] = [];
  for (const sheet of sheets) {
    const owner = sheet.ownerNode;
    if (isOurs(owner)) continue;
    if (sheet.disabled) continue;
    const key = sheet.href ? sheetKey(sheet, 0) : sheetKey(sheet, inlineIdx++);
    if (sheet.href) {
      if (!sheet.href.startsWith(location.origin)) continue;
      hrefs.push(sheet.href);
    }
    let count: number;
    try {
      count = sheet.cssRules.length;
    } catch {
      continue; // not loaded yet / cross-origin
    }
    if (seen.get(sheet) === count) continue;
    seen.set(sheet, count);

    if (sheet.href && cache.entries[sheet.href]) {
      cache.entries[sheet.href].t = Date.now();
      setOutput(key, cache.entries[sheet.href].css);
      continue;
    }
    const css = recolorSheet(sheet);
    if (css === null) continue;
    setOutput(key, css);
    if (sheet.href) {
      cache.entries[sheet.href] = { css, t: Date.now() };
      cacheDirty = true;
    }
  }
  if (hrefs.length && hrefs.join() !== cache.lastHrefs.join()) {
    cache.lastHrefs = hrefs;
    cacheDirty = true;
  }
  ensureOrder();
}

let scheduled = false;
export function scheduleScan(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    scan();
  });
}

/** Called at document-start: inject cached overrides for the sheets the last page used. */
export function primeFromCache(): void {
  loadCache();
  for (const href of cache.lastHrefs) {
    const e = cache.entries[href];
    if (e) setOutput(href, e.css);
  }
}

export function startObserving(): void {
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      for (const n of Array.from(r.addedNodes)) {
        if (n instanceof HTMLLinkElement && n.rel === 'stylesheet') {
          n.addEventListener('load', scheduleScan, { once: true });
        }
      }
    }
    // Any DOM change may correspond to InstUI inserting new rules into its sheet.
    scheduleScan();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', scheduleScan);
  window.addEventListener('load', () => {
    scan();
    flushCache();
  });
  // Persist cache once the page has settled even if load never fires (SPA-ish pages).
  setTimeout(flushCache, 8000);
}

export function setEnabled(on: boolean): void {
  enabled = on;
  for (const el of [...outputs.values(), ...fixed]) {
    if (on && !el.isConnected) root().appendChild(el);
    if (!on) el.remove();
  }
  if (on) scan();
}
