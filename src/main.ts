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
addFixedStyle('styles', [tokens, base, components, layout, dashboard, course, tools, files, dark, motion].join('\n'));
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
          <svg class="ic-icon-svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 22A10 10 0 0 1 2 12 10 10 0 0 1 12 2c5.5 0 10 4 10 9a6 6 0 0 1-6 6h-1.8c-.3 0-.5.2-.5.5 0 .1.1.2.1.3.4.5.6 1 .6 1.6A2.4 2.4 0 0 1 12 22Zm0-18a8 8 0 0 0 0 16c.3 0 .5-.2.5-.5a.5.5 0 0 0-.1-.3c-.4-.5-.6-1-.6-1.7 0-1.4 1.1-2.5 2.5-2.5H16a4 4 0 0 0 4-4c0-3.9-3.6-7-8-7Zm-5.5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/></svg>
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
  const onReady = () => {
    mountNavButton();
    upgradeToolIcons();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();
}
