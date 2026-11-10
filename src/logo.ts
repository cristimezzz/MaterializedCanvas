/**
 * The school logo (--ic-brand-header-image) is served from /accounts/1/files/…/download, which
 * redirects to a signed, uncacheable URL on another host — every page load re-downloads it
 * (≈3 s on oc.sjtu.edu.cn) and the rail shows a blank circle meanwhile.
 *
 * We keep a data-URL copy in userscript storage and inject it at document-start, then refresh
 * the copy in the background whenever the account's logo URL changes.
 */
import { GM_getValue, GM_setValue, GM_xmlhttpRequest } from '$';

const KEY = 'logoCache';
const MAX_BYTES = 512 * 1024;

interface LogoCache { src: string; data: string }

let styleEl: HTMLStyleElement | null = null;

function apply(data: string): void {
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.setAttribute('data-mc', 'logo');
    (document.head ?? document.documentElement).appendChild(styleEl);
  }
  styleEl.textContent = `html:root { --ic-brand-header-image: url("${data}"); }`;
}

/** Called at document-start. */
export function primeLogo(): void {
  const c = GM_getValue<LogoCache | null>(KEY, null);
  if (c?.data) apply(c.data);
}

/** The logo URL as Canvas' own variables stylesheet defines it (not our override). */
function canvasLogoUrl(): string | null {
  for (const sheet of Array.from(document.styleSheets)) {
    if (!sheet.href || !sheet.href.includes('/variables-')) continue;
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const r of Array.from(rules)) {
      if (!(r instanceof CSSStyleRule)) continue;
      const v = r.style.getPropertyValue('--ic-brand-header-image');
      const m = v.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
      if (m) return new URL(m[1], location.href).href;
    }
  }
  return null;
}

let refreshing = false;

/** Called once stylesheets are loaded: re-download only if the logo URL changed. */
export function refreshLogo(): void {
  if (refreshing) return;
  const src = canvasLogoUrl();
  if (!src) return;
  const cached = GM_getValue<LogoCache | null>(KEY, null);
  if (cached?.src === src && cached.data) {
    // Our <style> may have been created before <head> existed; keep it after Canvas' sheets.
    if (styleEl && styleEl.parentNode !== document.head) document.head.appendChild(styleEl);
    return;
  }
  refreshing = true;
  GM_xmlhttpRequest({
    url: src,
    method: 'GET',
    responseType: 'blob',
    onload: (res) => {
      const blob = res.response as Blob | undefined;
      if (res.status !== 200 || !blob || blob.size > MAX_BYTES || !/^image\//.test(blob.type)) {
        refreshing = false;
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result);
        GM_setValue(KEY, { src, data } satisfies LogoCache);
        apply(data);
        refreshing = false;
      };
      reader.onerror = () => (refreshing = false);
      reader.readAsDataURL(blob);
    },
    onerror: () => (refreshing = false),
    ontimeout: () => (refreshing = false),
  });
}
