# Karthik — personal site

Two pages (Home and About) where every section is a scroll-driven scene, built with anime.js v4.

## Run it

- `dist/` is ready to deploy. Open `dist/index.html`, or serve it: `python3 -m http.server -d dist 8000`.
- Deploy by uploading `dist/` to any static host (GitHub Pages, Netlify, Cloudflare Pages, Azure Static Web Apps).

## Edit it

| What | Where |
| --- | --- |
| Text, links, email, project cards | `src/markup.html` |
| Colours, type, layout | `src/styles.css` (tokens at the top) |
| Motion, one function per scene | `src/main.js` |

Rebuild after editing: `npm install`, then `npm run build`.

Placeholders to replace: `karthik@example.com`, the GitHub and LinkedIn links, the three project cards, and the About story.

## Why it stays smooth

- Pinned scenes are plain `position: sticky`; anime.js `onScroll` scrubs each scene's timeline.
- Only `transform` and `opacity` animate. The dot field and the tile grid are two canvases that redraw only while something moves.
- Section colours are fixed full-screen layers that wipe or fade, so a colour change never repaints the page.
- Below-the-fold scenes are built in idle time after the intro starts; layout is measured once per resize.
- `prefers-reduced-motion` gets a static, fully readable version with nothing pinned.
- Weight: about 34 KB of gzipped JS (anime.js included) and 9 KB of gzipped HTML and CSS, plus two Google Fonts.
