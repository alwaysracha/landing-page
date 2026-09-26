// Builds two outputs from src/:
//   dist/            production site: index.html + main.js (anime.js tree-shaken in)
//   out/artifact.html  single-file preview (anime.js loaded from jsDelivr)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const ANIME_CDN = 'https://cdn.jsdelivr.net/npm/animejs@4.5.0/dist/bundles/anime.umd.min.js';
const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400..800&family=Martian+Mono:wght@400..600&display=swap';
const TITLE = 'Karthik Racha';
const DESC = 'Karthik Racha, software engineer and architect: .NET, SQL Server and Azure.';

const css = readFileSync('src/styles.css', 'utf8');
const markup = readFileSync('src/markup.html', 'utf8');
const preboot = `(function(){var r=document.documentElement;r.classList.add('js');try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)r.classList.add('rm')}catch(e){}r.setAttribute('data-view',location.hash==='#about'?'about':'home');setTimeout(function(){if(!window.__booted)r.classList.remove('js')},4000)})();`;
const fontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${FONTS}">`;

// 1) production bundle: tree-shaken anime.js + site code
mkdirSync('dist', { recursive: true });
await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020',
  outfile: 'dist/main.js', legalComments: 'none',
});
writeFileSync('dist/index.html', `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<meta name="description" content="${DESC}">
<meta name="theme-color" content="#1e1c1b">
<script>${preboot}</script>
${fontLinks}
<script defer src="main.js"></script>
<style>${css}</style>
</head>
<body>
${markup}
</body>
</html>
`);

// 2) artifact preview: same markup and CSS, anime.js as a global from the CDN
const shim = {
  name: 'anime-global',
  setup(b) {
    b.onResolve({ filter: /^animejs$/ }, () => ({ path: 'anime-global', namespace: 'shim' }));
    b.onLoad({ filter: /.*/, namespace: 'shim' }, () => ({
      contents: 'const A = window.anime; export const { animate, createTimeline, onScroll, stagger, splitText, utils, createScope, createAnimatable, svg, scrambleText } = A;',
      loader: 'js',
    }));
  },
};
const res = await build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020',
  write: false, plugins: [shim], legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
mkdirSync('out', { recursive: true });
writeFileSync('out/artifact.html', `<title>${TITLE}</title>
<script>${preboot}</script>
${fontLinks}
<style>${css}</style>
${markup}
<script src="${ANIME_CDN}"></script>
<script>${js}</script>
`);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1);
console.log('dist/main.js', kb(readFileSync('dist/main.js', 'utf8')), 'KB');
console.log('dist/index.html', kb(readFileSync('dist/index.html', 'utf8')), 'KB');
console.log('out/artifact.html', kb(readFileSync('out/artifact.html', 'utf8')), 'KB');
