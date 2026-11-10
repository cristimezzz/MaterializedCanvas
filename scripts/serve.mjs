// Dev helper: serves dist/ with CORS so the built userscript can be injected into a logged-in page for testing.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const shim = `
var GM_getValue=(k,d)=>{try{const v=localStorage.getItem('mc:'+k);return v===null?d:JSON.parse(v)}catch{return d}};
var GM_setValue=(k,v)=>{try{localStorage.setItem('mc:'+k,JSON.stringify(v))}catch{}};
var GM_registerMenuCommand=()=>{};
var unsafeWindow=window;
`;
createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.url.startsWith('/bridge')) {
    // Navigates to the Canvas page with the script in the URL hash; the page stores it in
    // localStorage ('mcdev') so later test loads can eval it without another round trip.
    const to = new URL(req.url, 'http://x').searchParams.get('to') || 'https://oc.sjtu.edu.cn/robots.txt';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<script>fetch('/').then(r=>r.text()).then(c=>{location.href=${JSON.stringify(to)}+'#mcdev='+encodeURIComponent(c)})</script>`);
    return;
  }
  try {
    const code = await readFile(new URL('../dist/materialized-canvas.user.js', import.meta.url), 'utf8');
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.end(shim + code);
  } catch (e) {
    res.statusCode = 500;
    res.end(String(e));
  }
}).listen(8765, '127.0.0.1', () => console.log('serving on http://127.0.0.1:8765'));
