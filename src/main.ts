import { GM_registerMenuCommand } from '$';
import { loadSettings, saveSettings, type Settings } from './settings';
import { buildThemeCss } from './theme';
import { addFixedStyle, primeFromCache, scheduleScan, setEnabled, startObserving } from './injector';
import { openPanel } from './panel/panel';
import { setDarkContent } from './darkContent';
import { initMotion } from './motion';
import { primeLogo, refreshLogo } from './logo';

import tokens from './styles/tokens.css?inline';
import base from './styles/base.css?inline';
import components from './styles/components.css?inline';
import layout from './styles/layout.css?inline';
import dashboard from './styles/pages/dashboard.css?inline';
import course from './styles/pages/course.css?inline';
import tools from './styles/pages/tools.css?inline';
import files from './styles/pages/files.css?inline';
import people from './styles/pages/people.css?inline';
import mobile from './styles/mobile.css?inline';
import dark from './styles/dark.css?inline';
import motion from './styles/motion.css?inline';

const isTop = window.top === window.self;
let settings: Settings = loadSettings();
const html = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');

const resolvedMode = (s: Settings) => (s.mode === 'system' ? (media.matches ? 'dark' : 'light') : s.mode);

// --------------------------------------------------------------------------- styles
let themeEl: HTMLStyleElement | null = null;
let themeKey = '';

function applyTheme(s: Settings): void {
  const key = `${s.seed}|${s.contrast}`;
  if (key !== themeKey) {
    themeKey = key;
    const css = buildThemeCss(s.seed, s.contrast);
    if (themeEl) themeEl.textContent = css;
    else themeEl = addFixedStyle('theme', css);
  }
  if (s.enabled) {
    const mode = resolvedMode(s);
    html.setAttribute('data-mc-theme', mode);
    setDarkContent(mode === 'dark', s.darkUserContent);
  } else {
    html.removeAttribute('data-mc-theme');
    setDarkContent(false, false);
  }
  syncThemeColor(s.enabled);
}

// Phone browsers tint their address bar with <meta name="theme-color">; match the top app bar.
let themeMeta: HTMLMetaElement | null = null;
function syncThemeColor(enabled: boolean): void {
  if (!enabled) {
    themeMeta?.remove();
    themeMeta = null;
    return;
  }
  const color = getComputedStyle(html).getPropertyValue('--md-sys-color-surface-container').trim();
  if (!color) return;
  if (!themeMeta) {
    themeMeta = document.createElement('meta');
    themeMeta.name = 'theme-color';
    themeMeta.id = 'mc-theme-color';
  }
  themeMeta.content = color;
  const head = document.head;
  if (head && themeMeta.parentNode !== head) {
    head.querySelectorAll('meta[name="theme-color"]:not(#mc-theme-color)').forEach((m) => m.remove());
    head.append(themeMeta);
  }
}

function apply(s: Settings): void {
  const wasEnabled = settings.enabled;
  settings = s;
  saveSettings(s);
  applyTheme(s);
  if (s.enabled !== wasEnabled) setEnabled(s.enabled);
}

// Order matters: theme vars first, then hand-written styles (they must beat recolor output).
applyTheme(settings);
addFixedStyle('styles', [tokens, base, components, layout, dashboard, course, tools, files, people, mobile, dark, motion].join('\n'));
if (settings.enabled) {
  primeLogo();
  primeFromCache();
  startObserving();
  scheduleScan();
} else {
  setEnabled(false);
  startObserving();
}

initMotion();
window.addEventListener('load', () => setTimeout(refreshLogo, 500));

media.addEventListener('change', () => settings.mode === 'system' && applyTheme(settings));

// --------------------------------------------------------------------------- settings entry points
const open = () => openPanel(settings, apply);

const PALETTE_ICON =
  '<svg class="ic-icon-svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 22A10 10 0 0 1 2 12 10 10 0 0 1 12 2c5.5 0 10 4 10 9a6 6 0 0 1-6 6h-1.8c-.3 0-.5.2-.5.5 0 .1.1.2.1.3.4.5.6 1 .6 1.6A2.4 2.4 0 0 1 12 22Zm0-18a8 8 0 0 0 0 16c.3 0 .5-.2.5-.5a.5.5 0 0 0-.1-.3c-.4-.5-.6-1-.6-1.7 0-1.4 1.1-2.5 2.5-2.5H16a4 4 0 0 0 4-4c0-3.9-3.6-7-8-7Zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/></svg>';

if (isTop) {
  GM_registerMenuCommand('Materialized Canvas 设置', open);

  // A rail destination at the bottom of the global nav.
  const mountNavButton = () => {
    const list = document.querySelector('.ic-app-header__secondary-navigation .ic-app-header__menu-list')
      ?? document.querySelector('#menu');
    if (!list || document.getElementById('mc-nav-settings')) return;
    const li = document.createElement('li');
    li.className = 'menu-item ic-app-header__menu-list-item';
    li.innerHTML = `
      <button id="mc-nav-settings" class="ic-app-header__menu-list-link" type="button" title="外观设置">
        <div class="menu-item-icon-container" aria-hidden="true">
          ${PALETTE_ICON}
        </div>
        <div class="menu-item__text">外观</div>
      </button>`;
    li.querySelector('button')!.addEventListener('click', open);
    list.prepend(li);
  };
  // External-tool nav items (e.g. 视频空间) ship a white PNG <img> instead of an SVG icon,
  // which vanishes on the light rail. Re-draw it as a mask filled with the theme icon color.
  const upgradeToolIcons = () => {
    for (const img of document.querySelectorAll<HTMLImageElement>('.ic-app-header__menu-list-link > img')) {
      const link = img.parentElement!;
      if (link.querySelector('.mc-nav-icon-wrap')) continue;
      const wrap = document.createElement('div');
      wrap.className = 'menu-item-icon-container mc-nav-icon-wrap';
      wrap.setAttribute('aria-hidden', 'true');
      const icon = document.createElement('span');
      icon.className = 'mc-nav-img-icon';
      icon.style.setProperty('--mc-icon', `url("${img.src.replace(/"/g, '%22')}")`);
      wrap.append(icon);
      img.after(wrap);
    }
  };
  // ---- Phone layout (< 768px): Canvas renders its own chrome, so hook into that instead.
  const markActive = (links: Iterable<HTMLAnchorElement>, exactOnly: boolean) => {
    let best: HTMLAnchorElement | null = null;
    let bestLen = -1;
    for (const a of links) {
      a.removeAttribute('data-mc-active');
      let path: string;
      try {
        const u = new URL(a.href);
        if (u.origin !== location.origin) continue;
        path = u.pathname.replace(/\/$/, '') || '/';
      } catch {
        continue;
      }
      const here = location.pathname.replace(/\/$/, '') || '/';
      const hit = path === here || (!exactOnly && path !== '/' && here.startsWith(path + '/'));
      if (hit && path.length > bestLen) {
        best = a;
        bestLen = path.length;
      }
    }
    best?.setAttribute('data-mc-active', ''); // not a class: React re-renders className
  };
  const enhanceMobileTray = (tray: Element) => {
    const list = tray.querySelector('ul');
    if (!list) return;
    markActive(list.querySelectorAll<HTMLAnchorElement>(':scope > li > a'), true);
    // White PNG icons of external tools → themed masks (same trick as the rail).
    for (const img of list.querySelectorAll<HTMLImageElement>(':scope > li > a img')) {
      if (img.nextElementSibling?.classList.contains('mc-nav-img-icon')) continue;
      const icon = document.createElement('span');
      icon.className = 'mc-nav-img-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.style.setProperty('--mc-icon', `url("${img.src.replace(/"/g, '%22')}")`);
      img.after(icon);
    }
    if (list.querySelector('.mc-mobile-nav-link')) return;
    const li = document.createElement('li');
    li.className = 'mc-mobile-nav-item';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mc-mobile-nav-link';
    btn.innerHTML = `<span class="mc-mobile-nav-icon" aria-hidden="true">${PALETTE_ICON}</span><span>外观</span>`;
    btn.addEventListener('click', () => {
      // Close the tray first, so focus returns to the page before the dialog takes it.
      const closeBtn = [...tray.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Close')
        ?? tray.querySelector('button');
      closeBtn?.click();
      setTimeout(open, 150);
    });
    li.append(btn);
    list.append(li);
  };
  let mobilePending = false;
  const scanMobile = () => {
    mobilePending = false;
    if (!html.hasAttribute('data-mc-theme')) return;
    const tray = document.querySelector('[role="dialog"][aria-label="全局导航"]');
    if (tray) enhanceMobileTray(tray);
    const courseNav = document.getElementById('mobileContextNavContainer');
    if (courseNav?.querySelector('a') && !courseNav.querySelector('a[data-mc-active]')) {
      markActive(courseNav.querySelectorAll<HTMLAnchorElement>('a'), false);
    }
  };
  const watchMobile = () => {
    if (!document.getElementById('mobile-header')) return; // desktop-only page (no phone chrome)
    new MutationObserver(() => {
      if (mobilePending) return;
      mobilePending = true;
      requestAnimationFrame(scanMobile);
    }).observe(document.body, { childList: true, subtree: true });
    scanMobile();
  };

  const onReady = () => {
    mountNavButton();
    upgradeToolIcons();
    syncThemeColor(settings.enabled);
    watchMobile();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();
}
