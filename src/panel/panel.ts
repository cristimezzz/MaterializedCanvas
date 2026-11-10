import css from './panel.css?inline';
import { DEFAULTS, PRESETS, type Settings, type ThemeMode } from '../settings';

type Apply = (s: Settings) => void;

let host: HTMLElement | null = null;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...children);
  return el;
}

/** Opens the M3 settings dialog. Every change is applied and saved immediately. */
export function openPanel(current: Settings, apply: Apply): void {
  if (host) return;
  let s: Settings = { ...current };
  const update = (patch: Partial<Settings>) => {
    s = { ...s, ...patch };
    apply(s);
    render();
  };

  host = h('div', { id: 'mc-settings-host' });
  const shadow = host.attachShadow({ mode: 'open' });
  const style = h('style');
  style.textContent = css;
  const body = h('div');
  shadow.append(style, body);
  document.body.appendChild(host);

  const close = () => {
    host?.remove();
    host = null;
    document.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', onKey, true);

  // Scrim + dialog are created once (so the entrance animation plays once); render() refills the dialog.
  const scrim = h('div', { class: 'scrim' });
  scrim.addEventListener('click', (e) => e.target === scrim && close());
  const dialog = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mc-title' });
  scrim.append(dialog);
  body.append(scrim);

  function render() {
    const active = shadow.activeElement as HTMLElement | null;
    const focusKey = active?.textContent ?? null;
    dialog.replaceChildren();

    // Header
    dialog.append(
      h('h2', { id: 'mc-title' }, 'Materialized Canvas'),
      h('p', { class: 'sub' }, 'Material Design 3 外观设置，修改即时生效并自动保存。'),
    );

    // Color
    const swatches = h('div', { class: 'swatches', role: 'group', 'aria-label': '主色' });
    const isPreset = PRESETS.some((p) => p.color.toLowerCase() === s.seed.toLowerCase());
    for (const p of PRESETS) {
      const pressed = p.color.toLowerCase() === s.seed.toLowerCase();
      const b = h('button', { class: 'swatch', type: 'button', 'aria-pressed': String(pressed), title: p.color },
        h('span', { class: 'dot', style: `background:${p.color}` }), p.name);
      b.addEventListener('click', () => update({ seed: p.color }));
      swatches.append(b);
    }
    const picker = h('input', { type: 'color', value: s.seed, 'aria-label': '自定义颜色' }) as HTMLInputElement;
    let pickTimer = 0;
    picker.addEventListener('input', () => {
      clearTimeout(pickTimer);
      pickTimer = window.setTimeout(() => {
        s = { ...s, seed: picker.value };
        apply(s); // live preview without re-rendering (keeps the native picker open)
      }, 60);
    });
    picker.addEventListener('change', () => update({ seed: picker.value }));
    const custom = h('label', { class: 'swatch custom', 'aria-pressed': String(!isPreset) },
      h('span', { class: 'dot', style: isPreset ? '' : `background:${s.seed}` }), '自定义', picker);
    swatches.append(custom);

    const preview = h('div', { class: 'preview', 'aria-hidden': 'true' },
      ...['primary', 'secondary', 'tertiary', 'primary-container', 'secondary-container', 'surface-container-highest']
        .map((r) => h('span', { style: `background:var(--md-sys-color-${r})`, title: r })));

    dialog.append(h('div', { class: 'section' }, h('div', { class: 'label' }, '主色'), swatches, preview));

    // Mode
    const modes: { v: ThemeMode; label: string }[] = [
      { v: 'light', label: '浅色' },
      { v: 'dark', label: '深色' },
      { v: 'system', label: '跟随系统' },
    ];
    const seg = h('div', { class: 'segmented', role: 'group', 'aria-label': '外观模式' });
    for (const m of modes) {
      const b = h('button', { type: 'button', 'aria-pressed': String(s.mode === m.v) }, m.label);
      b.addEventListener('click', () => update({ mode: m.v }));
      seg.append(b);
    }
    dialog.append(h('div', { class: 'section' }, h('div', { class: 'label' }, '外观模式'), seg));

    // Contrast
    const contrasts = [
      { v: 0, label: '标准' },
      { v: 0.5, label: '中' },
      { v: 1, label: '高' },
    ];
    const cseg = h('div', { class: 'segmented', role: 'group', 'aria-label': '对比度' });
    for (const c of contrasts) {
      const b = h('button', { type: 'button', 'aria-pressed': String(s.contrast === c.v) }, c.label);
      b.addEventListener('click', () => update({ contrast: c.v }));
      cseg.append(b);
    }
    dialog.append(h('div', { class: 'section' }, h('div', { class: 'label' }, '对比度'), cseg));

    // Switches
    const sw = (key: 'enabled' | 'darkUserContent', title: string, desc: string) => {
      const b = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(s[key]), 'aria-label': title });
      b.addEventListener('click', () => update({ [key]: !s[key] } as Partial<Settings>));
      return h('div', { class: 'row' }, h('div', { class: 'text' }, title, h('small', {}, desc)), b);
    };
    dialog.append(
      h('div', { class: 'section' },
        sw('enabled', '启用美化', '关闭后恢复 Canvas 原始外观'),
        sw('darkUserContent', '深色模式下重新着色正文', '调整课程页面、公告中老师设置的文字/背景颜色'),
      ),
    );

    // Actions
    const reset = h('button', { class: 'btn', type: 'button' }, '恢复默认');
    reset.addEventListener('click', () => update({ ...DEFAULTS }));
    const done = h('button', { class: 'btn filled', type: 'button' }, '完成');
    done.addEventListener('click', close);
    dialog.append(h('div', { class: 'actions' }, reset, done));

    // Keep keyboard focus on the control that was just used (render() rebuilds the DOM).
    const target = focusKey
      ? [...dialog.querySelectorAll<HTMLElement>('button, label')].find((b) => b.textContent === focusKey)
      : dialog.querySelector<HTMLElement>('[aria-pressed="true"]');
    target?.focus({ preventScroll: true });
  }

  render();
}
