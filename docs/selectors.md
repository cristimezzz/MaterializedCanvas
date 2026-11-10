# Canvas DOM notes (oc.sjtu.edu.cn, surveyed 2026-11-10)

- Theme: Canvas brand variables (`--ic-brand-*`, `--ic-link-color`) defined on `:root` in
  `/dist/brandable_css/<hash>/variables-*.css`. Overridden in `src/styles/tokens.css`.
- InstUI is v7-style "themeable": each component gets a 5-letter hash (`fOyUs` = View,
  `fQfxa` = BaseButton …) and its theme as CSS custom properties on `:root`
  (`--fQfxa-primaryBackground: #0374B5`). Hashes change between Canvas releases, so
  `src/recolor.ts` maps these by *value + property-name suffix*, never by hash.
- Layout: `#application.ic-app` › `header#header.ic-app-header` (global nav, `#menu`,
  `.ic-app-header__menu-list-item--active`) › `#wrapper` › `.ic-app-nav-toggle-and-crumbs`
  (`#breadcrumbs`) › `#main` › `#left-side` (`#section-tabs li.section a.active`) /
  `#content` / `#right-side`.
- Dashboard: card view `.ic-DashboardCard*`; list view = planner (`.planner-day`,
  `.planner-grouping`, `.planner-item`, CSS-module classes like `Grouping-styles__*`).
- Modules / assignments / quizzes share `.item-group-condensed` › `.ig-header` › `.ig-row`.
- Files `.ef-*`, calendar FullCalendar `.fc-*` (context colors in `.group_course_*` — skipped
  by the recolor engine), inbox is the legacy conversations UI.
- Site CSP: `upgrade-insecure-requests`, so the test server hands the build over via a
  same-origin `robots.txt#mcdev=…` hash (see `scripts/serve.mjs`).
- Phone layout (< 768px, styled in `src/styles/mobile.css`): `#header` is hidden and
  `header#mobile-header` (no `.mobile-header` class!) shows `.mobile-header-hamburger`,
  `.mobile-header-title` (two `<div>` lines on course pages, `.expandable`) and `.mobile-header-arrow`.
  The hamburger opens an InstUI Tray `[role="dialog"][aria-label="全局导航"]` (content loads async:
  `ul > li > a` links and `button[aria-expanded]` ToggleDetails). Course nav renders into
  `nav#mobileContextNavContainer[aria-expanded]` with no current-page marker; `main.ts` sets
  `data-mc-active` (an attribute, because React rewrites `className`).
