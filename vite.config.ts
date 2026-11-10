import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'Materialized Canvas',
        namespace: 'https://github.com/materialized-canvas',
        description: '为上海交通大学 Canvas (oc.sjtu.edu.cn) 换上 Material Design 3 外观，支持自选主色与深色模式',
        version: '0.1.0',
        icon: 'https://oc.sjtu.edu.cn/favicon.ico',
        match: ['https://oc.sjtu.edu.cn/*'],
        'run-at': 'document-start',
        grant: ['GM_getValue', 'GM_setValue', 'GM_registerMenuCommand'],
        noframes: false,
      },
      build: {
        fileName: 'materialized-canvas.user.js',
      },
    }),
  ],
});
