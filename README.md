# Materialized Canvas

给上海交通大学 Canvas（<https://oc.sjtu.edu.cn>）换上 **Material Design 3** 外观的用户脚本。

- M3 导航栏（Navigation Rail）、课程菜单抽屉、胶囊按钮、填充式输入框、圆角卡片与对话框
- 由一个**种子色**动态生成整套 M3 色板（默认交大红，可选预设或任意颜色）
- **浅色 / 深色 / 跟随系统**，三档对比度
- 深色模式下也会重新着色老师设置了文字/背景颜色的课程页面、公告，以及富文本编辑器
- 设置即时生效，保存在脚本管理器中
- 手机适配：窄屏（< 768px）下的顶栏、导航抽屉、课程菜单和设置面板（底部抽屉）同样是 M3 外观

## 安装

1. 安装脚本管理器：[Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)。
2. 点击 **[安装脚本](https://github.com/cristimezzz/MaterializedCanvas/raw/main/dist/materialized-canvas.user.js)**，脚本管理器会弹出安装页面；也可以把 `dist/materialized-canvas.user.js` 拖进浏览器。
3. 打开 <https://oc.sjtu.edu.cn>。
4. 第一次加载时 Tampermonkey 可能会询问是否允许脚本访问一个文件服务器域名：这是用来把校徽缓存到本地的（校徽链接每次都会跳转到一个不可缓存的签名地址，约 3 秒），选「总是允许」即可。

## 设置

- 左侧导航栏底部的 **「外观」** 按钮（手机上：左上角菜单 → **「外观」**），或
- 脚本管理器菜单里的 **「Materialized Canvas 设置」**。

可调整主色、外观模式、对比度、是否在深色模式下重新着色正文，或一键关闭美化。

## 工作原理

| 层 | 文件 | 作用 |
| --- | --- | --- |
| 色板 | `src/theme.ts` | `@material/material-color-utilities` 从种子色生成浅/深两套 `--md-sys-color-*` 变量 |
| 品牌变量 | `src/styles/tokens.css` | 把 Canvas 的 `--ic-brand-*` 变量指向 M3 角色 |
| 重新着色引擎 | `src/recolor.ts`、`src/injector.ts` | 扫描 Canvas 与 InstUI 的样式表，按"背景/文字/边框 + 色相/彩度/明度"把每个硬编码颜色映射到 M3 角色，生成同选择器的覆盖规则；结果按样式表 URL 缓存，下次在页面绘制前注入，避免闪烁 |
| 手写样式 | `src/styles/*.css` | 形状、排版、导航栏、按钮、表单、表格、对话框及各页面细节 |
| 深色正文 | `src/darkContent.ts` | 处理内联颜色和 TinyMCE 编辑器 iframe |
| 设置面板 | `src/panel/` | Shadow DOM 内的 M3 对话框 |

由于覆盖规则只引用 CSS 变量，切换主色或深浅色不需要重新生成。

## 开发

```bash
npm install
npm run build        # 生成 dist/materialized-canvas.user.js
npm run dev          # vite-plugin-monkey 开发模式，可直接装到 Tampermonkey 热更新
```

`npm run serve:test` 启动一个本地服务器（`scripts/serve.mjs`），用于在已登录的页面里注入构建产物做测试；因为站点 CSP 带 `upgrade-insecure-requests`，它通过同源 `robots.txt#mcdev=…` 把代码交给页面存入 `localStorage`。

Canvas 更新后类名变化时，先看 `docs/selectors.md` 里的结构笔记。

## 已知限制

- 跨域 iframe（LTI 工具、视频平台、PDF 预览）无法改样式，保持原样。
- 课程卡片/日历的课程颜色是用户自选的，保留原色（深色模式下稍微压暗）。
- 教师端页面（SpeedGrader、成绩册等）仅由重新着色引擎兜底，未逐页打磨。
- 第一次访问某个页面时，新的样式表需要处理一次，可能会有一瞬间的原始配色；之后会走缓存。

## 许可

[MIT](LICENSE)
