/**
 * Runtime motion helpers:
 *  - immediate "leaving" feedback (content recedes + progress bar) when navigating to another page
 *  - M3 ripple on buttons, nav items and course menu links
 *  - swaps jQuery's default "swing" easing (module collapse, slideDown, scroll …) for the M3 standard curve
 */
import { unsafeWindow } from '$';

const RIPPLE_TARGETS = [
  '.btn',
  '.Button',
  '.ui-button',
  '#section-tabs li.section a',
  '.ic-app-header__menu-list-link',
  '.ic-DashboardCard__action',
  '.ef-item-row',
  '.ig-header .ig-header-title',
].join(',');

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** cubic-bezier(x1,y1,x2,y2) as a progress → eased progress function. */
export function bezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-5) break;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return sy(Math.min(1, Math.max(0, t)));
  };
}

function ripple(e: PointerEvent): void {
  if (e.button !== 0 || reduceMotion()) return;
  if (!document.documentElement.hasAttribute('data-mc-theme')) return;
  const host = (e.target as Element | null)?.closest<HTMLElement>(RIPPLE_TARGETS);
  if (!host || (host as HTMLButtonElement).disabled) return;
  // Nav rail items ripple inside their pill, not across the whole column.
  const surface = host.matches('.ic-app-header__menu-list-link')
    ? host.querySelector<HTMLElement>('.menu-item-icon-container') ?? host
    : host;

  if (getComputedStyle(surface).position === 'static') surface.style.position = 'relative';
  surface.style.isolation = 'isolate';

  // A clipping layer that follows the host's shape, so the host itself never needs overflow:hidden
  // (which would clip badges and dropdowns).
  const clip = document.createElement('span');
  clip.className = 'mc-ripple-clip';
  clip.style.cssText =
    'position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none;z-index:-1;';
  const r = surface.getBoundingClientRect();
  const size = Math.hypot(Math.max(e.clientX - r.left, r.right - e.clientX), Math.max(e.clientY - r.top, r.bottom - e.clientY)) * 2;
  const dot = document.createElement('span');
  dot.className = 'mc-ripple';
  dot.style.width = dot.style.height = `${size}px`;
  dot.style.left = `${e.clientX - r.left - size / 2}px`;
  dot.style.top = `${e.clientY - r.top - size / 2}px`;
  clip.append(dot);
  surface.append(clip);

  const grow = dot.animate(
    [{ transform: 'scale(0)', opacity: 0.2 }, { transform: 'scale(1)', opacity: 0.14 }],
    { duration: 450, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'forwards' },
  );
  const release = () => {
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', release);
    grow.finished.catch(() => {}).finally(() => {
      dot.animate([{ opacity: 0.14 }, { opacity: 0 }], {
        duration: 250,
        easing: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
        fill: 'forwards',
      }).finished.then(() => clip.remove(), () => clip.remove());
    });
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
}

type JQ = { easing: Record<string, unknown> & { _default?: string } };

function patchJQueryEasing(): boolean {
  const w = unsafeWindow as unknown as { jQuery?: JQ; $?: JQ };
  const jq = w.jQuery;
  if (!jq?.easing) return false;
  const standard = bezier(0.2, 0, 0, 1);
  const decel = bezier(0.05, 0.7, 0.1, 1);
  // jQuery calls easing(p) in 1.8+/3.x (and easing(p, t, b, c, d) in old jQuery UI); support both.
  const wrap = (fn: (t: number) => number) =>
    function (this: unknown, p: number, _t?: number, b?: number, c?: number) {
      const v = fn(p);
      return b !== undefined && c !== undefined && arguments.length > 3 ? b + c * v : v;
    };
  jq.easing.swing = wrap(standard);
  jq.easing.mcStandard = wrap(standard);
  jq.easing.mcDecelerate = wrap(decel);
  jq.easing._default = 'swing';
  return true;
}

// ---------------------------------------------------------------------------- leaving state
let leaveTimer = 0;

function setLeaving(on: boolean): void {
  const html = document.documentElement;
  clearTimeout(leaveTimer);
  if (!on) {
    html.classList.remove('mc-leaving');
    return;
  }
  if (!html.hasAttribute('data-mc-theme') || !document.body) return;
  if (!document.querySelector('.mc-progress')) {
    const bar = document.createElement('div');
    bar.className = 'mc-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
  }
  html.classList.add('mc-leaving');
  // Safety net: downloads, cancelled or very slow navigations never leave the page.
  leaveTimer = window.setTimeout(() => setLeaving(false), 12000);
}

/** Is this click going to replace the current document? */
function isPageNavigation(e: MouseEvent): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
  if (!a || a.hasAttribute('download')) return false;
  if (a.target && a.target !== '_self') return false;
  const href = a.getAttribute('href') ?? '';
  if (!href || href.startsWith('#') || href.startsWith('javascript:') || a.getAttribute('role') === 'button') return false;
  let url: URL;
  try {
    url = new URL(a.href);
  } catch {
    return false;
  }
  if (url.origin !== location.origin) return false;
  if (url.pathname === location.pathname && url.search === location.search) return false; // hash-only
  if (/\/(download|preview)(\?|$)|\/files\/\d+\/download/.test(url.pathname + url.search)) return false;
  return true;
}

function watchNavigation(): void {
  // Bubble phase, so Canvas' own handlers (which preventDefault for in-page actions) run first.
  document.addEventListener('click', (e) => {
    if (isPageNavigation(e)) setLeaving(true);
  });
  // Back/forward cache restores the old page: clear the state.
  window.addEventListener('pageshow', () => setLeaving(false));
}

function watchCourseMenuToggle(): void {
  let t = 0;
  document.addEventListener(
    'click',
    (e) => {
      if (!(e.target as Element | null)?.closest('#courseMenuToggle')) return;
      const html = document.documentElement;
      // Restart the animation even on rapid repeated toggles.
      html.classList.remove('mc-menu-toggling');
      void html.offsetWidth;
      html.classList.add('mc-menu-toggling');
      clearTimeout(t);
      t = window.setTimeout(() => html.classList.remove('mc-menu-toggling'), 450);
    },
    true,
  );
}

export function initMotion(): void {
  watchNavigation();
  watchCourseMenuToggle();

  document.addEventListener('pointerdown', ripple, { capture: true, passive: true });

  if (!patchJQueryEasing()) {
    const retry = () => patchJQueryEasing();
    document.addEventListener('DOMContentLoaded', retry, { once: true });
    window.addEventListener('load', retry, { once: true });
  }
}
