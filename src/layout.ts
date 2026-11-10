import { GM_getValue, GM_setValue } from '$';

/**
 * Desktop column layout:
 *  - drag handles on the course menu (#left-side) and the right sidebar (#right-side-wrapper)
 *    resize them; the content column takes what is left. Widths persist across pages.
 *  - global nav trays (#nav-tray-portal) push #wrapper aside instead of covering it.
 * The CSS half lives in styles/columns.css.
 */

type Side = 'left' | 'right';
interface ColumnWidths {
  left?: number;
  right?: number;
}

const KEY = 'layout';
const html = document.documentElement;
const desktop = window.matchMedia('(min-width: 768px)');

const LIMITS: Record<Side, [number, number]> = { left: [160, 400], right: [200, 480] };
const DEFAULTS: Record<Side, number> = { left: 192, right: 288 }; // Canvas: $ic-sp * 16, $ic-sp * 24
const MIN_CONTENT = 400;

let widths: ColumnWidths = {};

const host = (side: Side) =>
  document.querySelector<HTMLElement>(side === 'left' ? '#left-side' : '#right-side-wrapper');

const currentWidth = (side: Side) =>
  widths[side] ?? (host(side)?.getBoundingClientRect().width || DEFAULTS[side]);

function applyWidth(side: Side, w: number | undefined): void {
  const v = `--mc-${side}-w`;
  if (w === undefined) {
    html.style.removeProperty(v);
    html.removeAttribute(`data-mc-${side}-w`);
  } else {
    html.style.setProperty(v, `${w}px`);
    html.setAttribute(`data-mc-${side}-w`, '');
  }
  const handle = document.querySelector<HTMLElement>(`.mc-resizer[data-side="${side}"]`);
  handle?.setAttribute('aria-valuenow', String(Math.round(w ?? currentWidth(side))));
}

function save(): void {
  GM_setValue(KEY, widths);
}

/** Clamp to the side's range, and never squeeze the content column below MIN_CONTENT. */
function clamp(side: Side, w: number): number {
  const [lo, hi] = LIMITS[side];
  let max = hi;
  const content = document.querySelector<HTMLElement>('#content-wrapper');
  if (content) {
    const room = content.getBoundingClientRect().width + currentWidth(side) - MIN_CONTENT;
    max = Math.min(max, Math.max(lo, room));
  }
  return Math.round(Math.min(max, Math.max(lo, w)));
}

function setWidth(side: Side, w: number, persist: boolean): void {
  widths[side] = clamp(side, w);
  applyWidth(side, widths[side]);
  if (persist) save();
}

function resetWidth(side: Side): void {
  delete widths[side];
  applyWidth(side, undefined);
  save();
}

function makeHandle(side: Side): HTMLElement {
  const el = document.createElement('div');
  el.className = 'mc-resizer';
  el.dataset.side = side;
  el.tabIndex = 0;
  el.setAttribute('role', 'separator');
  el.setAttribute('aria-orientation', 'vertical');
  el.setAttribute('aria-label', side === 'left' ? '调整课程菜单宽度' : '调整侧栏宽度');
  el.setAttribute('aria-valuemin', String(LIMITS[side][0]));
  el.setAttribute('aria-valuemax', String(LIMITS[side][1]));
  el.title = '拖动调整宽度，双击恢复默认';

  // The left column grows rightwards, the right column grows leftwards.
  const dir = side === 'left' ? 1 : -1;

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startW = currentWidth(side);
    let frame = 0;
    let lastX = startX;
    html.setAttribute('data-mc-resizing', '');
    el.classList.add('mc-resizer--active');

    const move = (ev: PointerEvent) => {
      lastX = ev.clientX;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setWidth(side, startW + dir * (lastX - startX), false);
      });
    };
    const end = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (lastX !== startX) setWidth(side, startW + dir * (lastX - startX), true);
      html.removeAttribute('data-mc-resizing');
      el.classList.remove('mc-resizer--active');
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });

  el.addEventListener('dblclick', () => resetWidth(side));

  el.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 48 : 16;
    let delta = 0;
    if (e.key === 'ArrowRight') delta = step * dir;
    else if (e.key === 'ArrowLeft') delta = -step * dir;
    else if (e.key === 'Home' || e.key === 'Escape') {
      e.preventDefault();
      resetWidth(side);
      return;
    } else return;
    e.preventDefault();
    setWidth(side, currentWidth(side) + delta, true);
  });

  return el;
}

function mountHandles(): void {
  for (const side of ['left', 'right'] as const) {
    const parent = host(side);
    if (!parent || parent.querySelector(':scope > .mc-resizer')) continue;
    const handle = makeHandle(side);
    parent.append(handle);
    handle.setAttribute('aria-valuenow', String(Math.round(currentWidth(side))));
  }
}

// ---------------------------------------------------------------------------- nav tray push
/**
 * Follow the tray's real position every frame while it moves, so the page slides in lockstep
 * with InstUI's own enter/exit transition (whatever its timing), then go idle once it settles.
 */
function watchTray(): void {
  let portal: HTMLElement | null = null;
  let frame = 0;
  let still = 0;
  let last = -1;

  const set = (push: number) => {
    if (push === last) return;
    last = push;
    if (push > 0) {
      html.style.setProperty('--mc-tray-w', `${push}px`);
      html.setAttribute('data-mc-tray-open', '');
    } else {
      html.style.removeProperty('--mc-tray-w');
      html.removeAttribute('data-mc-tray-open');
    }
  };

  const measure = (): number => {
    if (!desktop.matches || !html.hasAttribute('data-mc-theme')) return 0;
    const dialog = portal?.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return 0;
    const tray = dialog.getBoundingClientRect();
    const railRight = document.getElementById('header')?.getBoundingClientRect().right ?? 0;
    return Math.max(0, Math.round(tray.right - railRight));
  };

  const tick = () => {
    frame = 0;
    const push = measure();
    still = push === last ? still + 1 : 0;
    set(push);
    // Keep following until the position has held for a handful of frames.
    if (still < 8) frame = requestAnimationFrame(tick);
  };
  const wake = () => {
    still = 0;
    // Tray gone: nothing to follow, release the page now rather than on the next frame.
    if (last > 0 && !portal?.querySelector('[role="dialog"]')) set(0);
    if (!frame) frame = requestAnimationFrame(tick);
  };

  const attach = () => {
    const p = document.getElementById('nav-tray-portal');
    if (!p || p === portal) return;
    portal = p;
    new MutationObserver(wake).observe(p, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    p.addEventListener('transitionrun', wake, true);
    p.addEventListener('transitionend', wake, true);
    wake();
  };

  attach();
  if (!portal) {
    const mo = new MutationObserver(() => {
      attach();
      if (portal) mo.disconnect();
    });
    mo.observe(document.body, { childList: true });
  }
  desktop.addEventListener('change', wake);
  window.addEventListener('resize', wake);
  // Theme switched on/off from the settings panel.
  new MutationObserver(wake).observe(html, { attributes: true, attributeFilter: ['data-mc-theme'] });
}

// ---------------------------------------------------------------------------- entry
export function initLayout(): void {
  widths = GM_getValue<ColumnWidths>(KEY, {}) ?? {};
  for (const side of ['left', 'right'] as const) {
    const w = widths[side];
    if (typeof w === 'number' && w >= LIMITS[side][0] && w <= LIMITS[side][1]) applyWidth(side, w);
    else delete widths[side];
  }
  mountHandles();
  // Canvas (and React islands) may render the sidebars after DOMContentLoaded.
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      mountHandles();
    });
  }).observe(document.getElementById('main') ?? document.body, { childList: true, subtree: true });
  watchTray();
}
