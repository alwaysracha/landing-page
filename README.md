# Karthik Racha — personal site

Two pages where every section is a scroll-driven scene, built with anime.js v4. Home sells what I do (how I build, my home lab, principles, credentials); About holds the detail (story, client timeline, stack).

## Run it

- `dist/` is ready to deploy. Open `dist/index.html`, or serve it: `python3 -m http.server -d dist 8000`.
- Deploy by uploading `dist/` to any static host (GitHub Pages, Netlify, Cloudflare Pages, Azure Static Web Apps).

## Edit it

| What | Where |
| --- | --- |
| Text, links, email, Build keywords, home lab rows, credential and client cards | `src/markup.html` |
| Colours, type, layout | `src/styles.css` (tokens at the top) |
| Motion, one function per scene | `src/main.js` |

Rebuild after editing: `npm install`, then `npm run build`.

Both card rails (credentials on Home, clients on About) use the same markup. Client cards run newest first (`HEAD`, `HEAD~1`, …). To add a card, copy one with the colour you want (its `style` and `data-deep` values go together), then update the rail's `/ 03` or `/ 08` count. Keep art `b` off yellow cards and art `c` off violet and orange ones: each has a shape in that colour.

The Build scene's floating keywords are the `<li>`s in `.arch__kw`; add or remove them freely, since the script places each one clear of the text and the diagram. Home lab rows are the `.up` items in `.lab__list`, and the "N of 8 up" counter counts them for you.

## Why it stays smooth

- Pinned scenes are plain `position: sticky`; anime.js `onScroll` scrubs each scene's timeline.
- Only `transform` and `opacity` animate. The dot field, the architecture diagram and the tile grid are canvases that redraw only while something moves; the diagram's requests stop as soon as it leaves the screen.
- The Build keywords drift on CSS animations, which run on the compositor and pause off screen.
- Section colours are fixed full-screen layers that wipe or fade, so a colour change never repaints the page.
- Below-the-fold scenes are built in idle time after the intro starts; layout is measured once per resize.
- `prefers-reduced-motion` gets a static, fully readable version with nothing pinned.
- Weight: about 36 KB of gzipped JS (anime.js included) and 10 KB of gzipped HTML and CSS, plus two Google Fonts.
