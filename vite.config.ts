import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import { readableStrings } from './scripts/readable-strings';

export default defineConfig({
  plugins: [
    readableStrings(),
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'Materialized Canvas',
        namespace: 'https://github.com/cristimezzz/MaterializedCanvas',
        homepageURL: 'https://github.com/cristimezzz/MaterializedCanvas',
        supportURL: 'https://github.com/cristimezzz/MaterializedCanvas/issues',
        description: '为上海交通大学 Canvas (oc.sjtu.edu.cn) 换上 Material Design 3 外观，支持自选主色与深色模式',
        version: '0.7.3',
        license: 'MIT',
        icon: 'https://oc.sjtu.edu.cn/favicon.ico',
        match: ['https://oc.sjtu.edu.cn/*'],
        'run-at': 'document-start',
        grant: ['GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_registerMenuCommand', 'GM_xmlhttpRequest', 'unsafeWindow'],
        // The account logo redirects to a signed URL on a file host; fetched once and cached (src/logo.ts).
        connect: ['self', '*'],
        noframes: false,
      },
      build: {
        fileName: 'materialized-canvas.user.js',
      },
    }),
  ],
  build: {
    // Keep esbuild's CSS pass (it flattens nesting, which is what was tested); readableStrings then
    // re-indents the result, because GreasyFork rejects minified-looking code.
    minify: false,
    cssMinify: true,
  },
});
