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
- Assignments index (`body.assignments`): `#ag-list` › `li.item-group-condensed` (the outer `ul`
  is also `.ig-list`, so target rows as `li.assignment`) › `.ig-row` › `.ig-row__layout`.
  "显示方式" is an InstUI toggle radio group under `[data-view="showBy"]`. Detail page:
  `#assignment_show`; Canvas styles `#assignment_show .student-assignment-overview` by ID.
- Modules: each `.ig-header` holds both `.collapse_module_link` and `.expand_module_link` and
  hides one with `display` — never set `display` on them. Item type = class on
  `li.context_module_item` (`attachment`, `assignment`, `quiz`, `discussion_topic`, `wiki_page`,
  `external_url`, `context_external_tool`, `context_module_sub_header`).
- Grades (`body.grades`): `table#grades_summary` uses auto layout; `th.title .context` is
  `visibility: hidden` until hover in Canvas. Group/total rows: `tr.hard_coded.group_total` /
  `.final_grade`. Course/sort pickers are InstUI Selects in `#GradeSummarySelectMenuGroup`.
- Discussions index (`body.discussions`): `.discussions-container__wrapper` per section, header is
  an InstUI ToggleDetails `button[aria-expanded]`; each `.ic-discussion-row` sits in an InstUI
  grid whose leading column holds the unread dot (hashed classes only). Search is
  `input[name="discussion_search"]`, filter is a native `select#discussion-filter`.
- Course home: `#course_home_content`; default view is syllabus (`body.syllabus`,
  `table#syllabus` with `table-layout: fixed`, size it via `thead th`), modules, feed
  (`.recent_activity`), or assignments. Sidebar: `#course_show_secondary`, InstUI to-do
  `.ToDoSidebarItem` (its SVG icon is sized 1em by InstUI), `.events_list`, `.mini_month`.
- Column sizes (Canvas `_ic_app_layout.scss`): `#left-side` is `position: absolute` (192px) next to a
  matching `margin-left` on `.ic-Layout-columns` (≥768px, `body.course-menu-expanded`); the right
  sidebar `#right-side-wrapper.ic-app-main-content__secondary` (288px, 24px leading padding) is a flex
  column from 992px, or 1140px with the course menu open. `src/layout.ts` stores user widths under
  GM key `layout` and exposes them as `--mc-left-w` / `--mc-right-w` (+ `data-mc-left-w` /
  `data-mc-right-w` on `<html>`); `.mc-resizer` handles live inside both columns.
- Global nav trays render in `#nav-tray-portal`; `layout.ts` tracks the tray's right edge each frame
  while it moves and pads `#wrapper` by `--mc-tray-w` (`html[data-mc-tray-open]`), so the page is
  pushed instead of covered.
