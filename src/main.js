import {
  animate, createTimeline, onScroll, stagger, splitText, utils,
  createScope, createAnimatable, svg, scrambleText,
} from 'animejs';

/* ============================================================
   Karthik — scroll-driven site
   Rules: animate only transform + opacity (and canvas pixels),
   pin with position:sticky, measure once per resize.
   ============================================================ */

const d = document;
const root = d.documentElement;
const $ = (s, r = d) => r.querySelector(s);
const $$ = (s, r = d) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
const mqFine = matchMedia('(hover: hover) and (pointer: fine)');
let REDUCE = mqReduce.matches;
// automated capture (thumbnails, crawlers): show the settled first frame, skip the intro
const INSTANT = navigator.webdriver === true;
const T0 = performance.now();
const SYNC = 0.82; // scroll smoothing: 1 = locked to the scrollbar
const INK = { light: '#e8e2d9', dark: '#1e1c1b' };
const PALETTE = ['#5536d0', '#2b63b6', '#ffd23f', '#ff6a3d'];

const views = { home: $('#view-home'), about: $('#view-about') };
const contactEl = $('.contact');
let current = null;

const seeded = (seed) => {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

/** A 1000-unit timeline whose playhead follows the scroll through a sticky track. */
function scrub(track, { onUpdate, enter = 'top top', leave = 'bottom bottom' } = {}) {
  const tl = createTimeline({
    defaults: { ease: 'linear' },
    autoplay: onScroll({ target: track, enter, leave, sync: SYNC }),
    onUpdate,
  });
  tl.add({ duration: 1000 }, 0);
  return tl;
}

/** Run fn once when el scrolls into view. */
function whenVisible(el, fn, margin = '0px 0px -18% 0px') {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { io.disconnect(); fn(); }
  }, { rootMargin: margin });
  io.observe(el);
  return () => io.disconnect();
}

const scramble = (el, text, extra = {}) =>
  animate(el, { innerHTML: scrambleText({ text, cursor: '_', settleDuration: 260, ...extra }), ease: 'linear' });

/* ============================================================
   Background colour + pipeline scrubber (one passive scroll loop)
   ============================================================ */
const Chrome = (() => {
  const host = $('.bg');
  const nav = $('.nav');
  const pipe = $('.pipe');
  const labels = $('.pipe__labels');
  const fill = $('.pipe__fill');
  const sq = $('.nav__sq');
  let stops = [];
  let layers = [];
  let groups = [];
  let raf = 0;
  let H = innerHeight;
  let ink = '';
  let active = -1;

  function build(view) {
    const scope = [view, contactEl];
    stops = scope.flatMap((el) => $$('.bg-stop', el)).map((el) => ({
      el, color: el.dataset.bg, ink: el.dataset.ink || 'light', wipe: el.dataset.fx !== 'fade', y: 0,
    }));
    // stage groups for the scrubber
    groups = [];
    for (const el of [...$$('[data-stage]', view), contactEl]) {
      const name = el.dataset.stage;
      const last = groups[groups.length - 1];
      if (last && last.name === name) last.els.push(el);
      else groups.push({ name, els: [el], start: 0, end: 0 });
    }
    labels.textContent = '';
    groups.forEach((g, i) => {
      const b = d.createElement('button');
      b.type = 'button';
      b.textContent = g.name;
      b.addEventListener('click', () => {
        const y = g.start + (i === 0 ? 0 : 2);
        scrollTo({ top: y, behavior: REDUCE ? 'auto' : 'smooth' });
      });
      g.btn = b;
      labels.append(b);
    });
    active = -1;
    measure();
  }

  function measure() {
    H = innerHeight;
    const sy = scrollY;
    for (const s of stops) s.y = s.el.getBoundingClientRect().top + sy;
    stops.sort((a, b) => a.y - b.y);
    host.textContent = '';
    layers = stops.map((s, i) => {
      const layer = d.createElement('i');
      layer.style.background = s.color;
      layer._v = i ? 0 : 1;
      if (s.wipe && i) layer.style.transform = 'scaleY(0)';
      else layer.style.opacity = layer._v;
      host.append(layer);
      return layer;
    });
    for (const g of groups) {
      g.start = g.els[0].getBoundingClientRect().top + sy;
      const lastEl = g.els[g.els.length - 1];
      g.end = lastEl.getBoundingClientRect().bottom + sy;
      g.btn.style.setProperty('--w', Math.max(1, Math.round((g.end - g.start) / 100)));
    }
    update();
  }

  function update() {
    raf = 0;
    const sy = scrollY;
    const y = sy + H * 0.5;
    const F = H * 0.34;
    // wipes: the new colour's top edge rides the section's top edge (1:1 with scroll)
    // fades: a crossfade centred on the viewport middle
    let navInk = stops[0] ? stops[0].ink : 'light';
    let pipeInk = navInk;
    for (let i = 1; i < stops.length; i++) {
      const s = stops[i]; const layer = layers[i];
      let v;
      if (s.wipe) {
        v = Math.round(clamp((sy + H - s.y) / H, 0, 1) * 1000) / 1000;
        if (v !== layer._v) { layer.style.transform = `scaleY(${v})`; layer._v = v; }
        if (v > 0.96) navInk = s.ink;
        if (v > 0.03) pipeInk = s.ink;
      } else {
        v = Math.round(clamp((y - s.y + F * 0.5) / F, 0, 1) * 100) / 100;
        if (v !== layer._v) { layer.style.opacity = v; layer._v = v; }
        if (v > 0.5) { navInk = s.ink; pipeInk = s.ink; }
      }
    }
    if (navInk !== ink) { ink = navInk; nav.dataset.ink = ink; }
    if (pipeInk !== pipe._ink) { pipe._ink = pipeInk; pipe.dataset.ink = pipeInk; }
    const max = root.scrollHeight - H;
    fill.style.transform = `scaleX(${max > 0 ? clamp(sy / max, 0, 1) : 0})`;
    sq.style.transform = `rotate(${(sy * 0.3) % 360}deg)`;
    let a = 0;
    for (let i = 0; i < groups.length; i++) if (y >= groups[i].start) a = i;
    if (a !== active) {
      if (groups[active]) groups[active].btn.classList.remove('is-on');
      active = a;
      if (groups[a]) groups[a].btn.classList.add('is-on');
    }
  }

  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  return { build, measure, update };
})();

/* ============================================================
   Home · restore — the name, a reactive dot field, and a scroll-out
   ============================================================ */
function sceneHero(view) {
  const track = $('.track--hero', view);
  const stage = $('.hero', track);
  const L = $$('.L', stage);
  const inner = L.map((l) => l.firstElementChild);
  const canvas = $('.field', stage);
  const field = createField(canvas, stage);
  const mid = (L.length - 1) / 2;
  fitName(stage, L);

  if (!REDUCE) {
    scrub(track)
      .add(L, {
        y: (_, i) => -innerHeight * (0.34 + Math.abs(i - mid) * 0.07),
        rotate: (_, i) => (i - mid) * 7,
        duration: 1000, ease: 'in(2)',
      }, 0)
      .add(L, { opacity: [1, 0], duration: 360, ease: 'in(2)' }, 640)
      .add($('.hero__foot', stage), { y: [0, -80], opacity: [1, 0], duration: 520, ease: 'in(2)' }, 0)
      .add($('.hero__top', stage), { y: [0, -40], opacity: [1, 0], duration: 400 }, 0)
      .add(canvas, { opacity: [1, 0], scale: [1, 1.18], duration: 1000 }, 0);
  }

  // letters stretch toward the pointer (after the intro)
  let offHover = () => {};
  if (mqFine.matches && !REDUCE) {
    const anims = inner.map((el) => createAnimatable(el, { scaleY: 500, ease: 'out(3)' }));
    const name = $('.hero__name', stage);
    const move = (e) => {
      if (stage.classList.contains('pre')) return;
      L.forEach((l, i) => {
        const r = l.getBoundingClientRect();
        const dx = Math.abs(e.clientX - (r.left + r.width / 2)) / r.width;
        const k = Math.max(0, 1 - dx / 1.6);
        anims[i].scaleY(1 + k * 0.16);
      });
    };
    const leave = () => anims.forEach((a) => a.scaleY(1));
    name.addEventListener('pointermove', move);
    name.addEventListener('pointerleave', leave);
    offHover = () => { name.removeEventListener('pointermove', move); name.removeEventListener('pointerleave', leave); };
  }

  return () => { field.destroy(); offHover(); };
}

/** Scale the name so it spans the stage width, capped by the stage height. */
function fitName(stage, L) {
  const name = $('.hero__name', stage);
  name.style.fontSize = '';
  const size = parseFloat(getComputedStyle(name).fontSize);
  const pad = parseFloat(getComputedStyle(stage).paddingLeft) * 2;
  const avail = stage.clientWidth - pad;
  const first = L[0]; const last = L[L.length - 1];
  const w = last.offsetLeft + last.offsetWidth - first.offsetLeft;
  const cap = (stage.clientHeight * (innerWidth < 760 ? 0.34 : 0.56)) / 0.8;
  name.style.fontSize = `${Math.min((size * avail) / w, cap).toFixed(1)}px`;
}

function introHero(view) {
  const stage = $('.hero', view);
  const inner = $$('.L > span', stage);
  const field = stage._field;
  if (REDUCE || INSTANT) { stage.classList.remove('pre'); return; }
  const mid = (inner.length - 1) / 2;
  const fades = $$('.hero__eyebrow, .hero__cue, .hero__lead, .hero__log', stage);
  // explicit start state: staggered tweens don't paint until they begin
  utils.set(inner, { y: '135%', rotate: (_, i) => (i - mid) * 9 });
  utils.set(fades, { opacity: 0 });
  stage.classList.remove('pre');
  createTimeline({ defaults: { ease: 'out(4)' } })
    .add(inner, { y: '0%', rotate: 0, duration: 1150 }, stagger(55, { from: 'center' }))
    .add($$('.hero__eyebrow, .hero__cue', stage), { opacity: 1, duration: 600 }, 250)
    .add($('.hero__lead', stage), { opacity: 1, y: { from: 26, to: 0 }, duration: 900 }, 380)
    .add($('.hero__log', stage), { opacity: 1, duration: 300 }, 520)
    .call(() => {
      $$('.hero__top .scr, .hero__log .scr', stage).forEach((el, i) =>
        scramble(el, el.textContent, { delay: i * 120 }));
      field && field.ripple();
    }, 260);
}

/** Canvas dot field: ripples on load and follows the pointer. Idle = zero work. */
function createField(canvas, host) {
  const ctx = canvas.getContext('2d');
  let W = 0; let H = 0; let dpr = 1; let pitch = 28; let cols = 0; let rows = 0; let ox = 0; let oy = 0;
  let raf = 0; let mx = -1e4; let my = -1e4; let energy = 0; let rip = null; let visible = true;
  const bone = '#e8e2d9';

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    pitch = W < 760 ? 22 : 28;
    cols = Math.floor(W / pitch); rows = Math.floor(H / pitch);
    ox = (W - (cols - 1) * pitch) / 2; oy = (H - (rows - 1) * pitch) / 2;
    draw(performance.now());
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const r = rip ? (t - rip.t) * 1.1 : -1;
    const fade = rip ? 1 - r / rip.max : 0;
    for (let j = 0; j < rows; j++) {
      const y = oy + j * pitch;
      for (let i = 0; i < cols; i++) {
        const x = ox + i * pitch;
        let s = 2; let a = 0.17; let c = 0;
        if (energy > 0) {
          const dx = x - mx; const dy = y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 190) { const k = (1 - dist / 190) ** 2 * energy; s += k * 7; a += k * 0.8; if (k > 0.28) c = 1 + ((i + j) & 3); }
        }
        if (rip) {
          const dx = x - rip.x; const dy = y - rip.y;
          const w = Math.abs(Math.sqrt(dx * dx + dy * dy) - r);
          if (w < 70) { const k = (1 - w / 70) * fade; s += k * 5; a += k * 0.6; if (k > 0.55) c = 1 + ((i * 3 + j) & 3); }
        }
        ctx.globalAlpha = a > 1 ? 1 : a;
        ctx.fillStyle = c ? PALETTE[c - 1] : bone;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
    if (rip && r > rip.max) rip = null;
  }

  function loop(t) {
    raf = 0;
    energy = Math.max(0, energy - 0.018);
    draw(t);
    if (visible && (energy > 0 || rip)) raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(loop); };

  const onMove = (e) => {
    const b = canvas.getBoundingClientRect();
    mx = e.clientX - b.left; my = e.clientY - b.top; energy = 1; kick();
  };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); });
  io.observe(canvas);
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  if (!REDUCE) host.addEventListener('pointermove', onMove, { passive: true });
  resize();

  const api = {
    ripple() {
      if (REDUCE) return;
      rip = { x: W / 2, y: H * 0.62, t: performance.now(), max: Math.hypot(W, H) * 0.75 };
      kick();
    },
    destroy() {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      host.removeEventListener('pointermove', onMove);
      delete host._field;
    },
  };
  host._field = api;
  return api;
}

/* ============================================================
   Home · restore — the statement fills in word by word
   ============================================================ */
function sceneStatement(view) {
  const track = $('.track--statement', view);
  const text = $('.statement__text', track);
  if (REDUCE) return;
  splitText(text, { words: true }).addEffect(({ words }) => {
    const gap = 820 / words.length;
    utils.set(words, { opacity: 0.14 });
    return scrub(track).add(words, { opacity: { from: 0.14, to: 1 }, duration: 90 }, stagger(gap, { start: 60 }));
  });
}

/* ============================================================
   Home · build — C# tokens travel into their Python positions
   ============================================================ */
const CS = [
  [['var', 'kw', 'v'], ' ', ['active', 'id', 'active'], ' ', ['=', 'op', 'eq'], ' ', ['users', 'id', 'users']],
  ['    ', ['.Where', 'fn', 'wh'], ['(', 'p', 'p1'], ['u', 'id', 'u1'], ' ', ['=>', 'op', 'ar1'], ' ', ['u', 'id', 'u2'], ['.', 'p', 'd1'], ['IsActive', 'pr', 'act'], [')', 'p', 'c1']],
  ['    ', ['.Select', 'fn', 'se'], ['(', 'p', 'p2'], ['u', 'id', 'u3'], ' ', ['=>', 'op', 'ar2'], ' ', ['u', 'id', 'u4'], ['.', 'p', 'd2'], ['Name', 'pr', 'nm'], [')', 'p', 'c2']],
  ['    ', ['.ToList', 'fn', 'tl'], ['()', 'p', 'tp'], [';', 'p', 'sc']],
];
const PY = [
  [['active', 'id', 'active'], ' ', ['=', 'op', 'eq'], ' ', ['[', 'p', 'bo']],
  ['    ', ['u', 'id', 'u4'], ['.', 'p', 'd2'], ['name', 'pr', 'nm']],
  ['    ', ['for', 'kw', 'for'], ' ', ['u', 'id', 'u1'], ' ', ['in', 'kw', 'in'], ' ', ['users', 'id', 'users']],
  ['    ', ['if', 'kw', 'if'], ' ', ['u', 'id', 'u2'], ['.', 'p', 'd1'], ['is_active', 'pr', 'act']],
  [[']', 'p', 'bc']],
];

function sceneCode(view) {
  const track = $('.track--code', view);
  const box = $('.code__box', track);
  const fname = $('.code__fname', track);
  const langs = $$('.code__lang', track);
  const bar = $('.code__bar i', track);
  box.textContent = '';
  box.classList.remove('is-static');
  box.removeAttribute('style');

  const makePre = (lines) => {
    const pre = d.createElement('pre');
    pre.className = 'code__m';
    lines.forEach((line) => {
      line.forEach((t) => {
        if (typeof t === 'string') { pre.append(t); return; }
        const s = d.createElement('span');
        s.textContent = t[0]; s.className = `t-${t[1]}`; s.dataset.k = t[2];
        pre.append(s);
      });
      pre.append('\n');
    });
    box.append(pre);
    return pre;
  };
  const preA = makePre(CS);
  const preB = makePre(PY);
  if (REDUCE) { box.classList.add('is-static'); return; }

  const read = (pre) => {
    const m = new Map();
    for (const s of pre.querySelectorAll('span')) m.set(s.dataset.k, { x: s.offsetLeft, y: s.offsetTop, text: s.textContent, cls: s.className });
    return m;
  };
  const A = read(preA);
  const B = read(preB);
  box.style.width = `${Math.max(preA.offsetWidth, preB.offsetWidth)}px`;
  box.style.height = `${Math.max(preA.offsetHeight, preB.offsetHeight)}px`;
  preA.remove(); preB.remove();

  const gone = []; const born = []; const move = []; const swapA = []; const swapB = [];
  const keys = [...A.keys(), ...[...B.keys()].filter((k) => !A.has(k))];
  for (const k of keys) {
    const a = A.get(k); const b = B.get(k); const p = a || b;
    const el = d.createElement('span');
    el.className = `tok ${p.cls}`;
    el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
    if (a && b && a.text !== b.text) {
      const ta = d.createElement('span'); ta.textContent = a.text;
      const tb = d.createElement('span'); tb.className = 'tb'; tb.textContent = b.text;
      el.append(ta, tb); swapA.push(ta); swapB.push(tb);
    } else el.textContent = p.text;
    box.append(el);
    if (a && b) move.push({ el, dx: b.x - a.x, dy: b.y - a.y });
    else if (a) gone.push(el);
    else born.push(el);
  }
  utils.set([...born, ...swapB], { opacity: 0 });

  let py = false;
  const tl = scrub(track, {
    onUpdate: (self) => {
      const now = self.progress > 0.52;
      if (now === py) return;
      py = now;
      langs[0].classList.toggle('is-on', !py);
      langs[1].classList.toggle('is-on', py);
      scramble(fname, py ? 'users.py' : 'Users.cs', { settleDuration: 200 });
    },
  });
  tl.add(gone, { opacity: [1, 0], y: [0, -18], rotate: [0, -6], duration: 200, ease: 'in(2)' }, stagger(14, { start: 150 }));
  move.forEach((m, i) => tl.add(m.el, { x: [0, m.dx], y: [0, m.dy], duration: 340, ease: 'inOut(3)' }, 250 + i * 16));
  tl.add(swapA, { opacity: [1, 0], duration: 120 }, 440)
    .add(swapB, { opacity: [0, 1], duration: 120 }, 440)
    .add(born, { opacity: [0, 1], y: [22, 0], duration: 220, ease: 'out(3)' }, stagger(34, { start: 590 }))
    .add(bar, { scaleX: [0, 1], duration: 640 }, 160);
}

/* ============================================================
   Home · test — 140 tiles: chaos (work), a grid (right), streaks (fast)
   ============================================================ */
function sceneGrid(view) {
  const track = $('.track--grid', view);
  const stage = $('.grid', track);
  const cv = $('.tiles', stage);
  const lines = $$('.grid__lines li', stage);
  const ctx = cv.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = cv.clientWidth; const H = cv.clientHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const mobile = W < 760;
  const area = mobile
    ? { x: W * 0.06, y: H * 0.13, w: W * 0.88, h: H * 0.34 }
    : { x: W * 0.47, y: H * 0.17, w: W * 0.47, h: H * 0.64 };
  const cols = mobile ? 10 : 14; const rows = mobile ? 6 : 10;
  const cw = area.w / cols; const ch = area.h / rows;
  const size = Math.min(cw, ch) * 0.64;
  const R = seeded(11);
  const tiles = [];
  const cx = (cols - 1) / 2; const cy = (rows - 1) / 2;
  const DA = 250; const SA = 20; const DB = 230; const SB = 14;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const c = R() < 0.18 ? PALETTE[Math.floor(R() * 4)] : '#e8e2d9';
      tiles.push({
        // work: scattered
        x0: area.x + (R() * 1.2 - 0.1) * area.w, y0: area.y + (R() * 1.3 - 0.15) * area.h,
        w0: size * (0.35 + R() * 1.1), h0: size * (0.35 + R() * 1.1), r0: (R() - 0.5) * 2.2, a0: 0.25 + R() * 0.55,
        // right: on the grid
        x1: area.x + (i + 0.5) * cw, y1: area.y + (j + 0.5) * ch,
        // fast: streaks
        x2: area.x + (i + 0.5) * cw + (j % 2 ? cw * 0.5 : 0) + Math.sin(j * 1.7) * cw * 0.6,
        a2: c === '#e8e2d9' ? 0.75 : 1,
        c,
        da: Math.hypot(i - cx, j - cy) * SA, // stagger from the centre
        db: i * SB, // stagger left to right
      });
    }
  }
  const spanA = DA + Math.max(...tiles.map((t) => t.da));
  const spanB = DB + Math.max(...tiles.map((t) => t.db));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
  const ph = { a: 0, b: 0 };
  const sw = cw * 1.9; const sh = Math.max(2, size * 0.16);

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const ta = ph.a * spanA; const tb = ph.b * spanB;
    for (const t of tiles) {
      const a = ease(clamp((ta - t.da) / DA, 0, 1));
      const b = ease(clamp((tb - t.db) / DB, 0, 1));
      let x = t.x0 + (t.x1 - t.x0) * a;
      const y = t.y0 + (t.y1 - t.y0) * a;
      let w = t.w0 + (size - t.w0) * a;
      let h = t.h0 + (size - t.h0) * a;
      const r = t.r0 * (1 - a);
      let al = t.a0 + (0.92 - t.a0) * a;
      if (b > 0) { x += (t.x2 - t.x1) * b; w += (sw - size) * b; h += (sh - size) * b; al += (t.a2 - 0.92) * b; }
      ctx.globalAlpha = al;
      ctx.fillStyle = t.c;
      if (r > 0.002 || r < -0.002) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(r);
        ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
      } else ctx.fillRect(x - w / 2, y - h / 2, w, h);
    }
  };

  if (REDUCE) { ph.a = 1; draw(); return; }

  utils.set(lines.slice(1), { opacity: 0.2 });
  scrub(track, { onUpdate: draw })
    .add(ph, { a: [0, 1], duration: spanA }, 90)
    .add(ph, { b: [0, 1], duration: spanB }, 560)
    .add(lines[0], { opacity: [1, 0.2], duration: 60 }, 300)
    .add(lines[1], { opacity: [0.2, 1], duration: 60 }, 300)
    .add(lines[1], { opacity: [1, 0.2], duration: 60 }, 640)
    .add(lines[2], { opacity: [0.2, 1], duration: 60 }, 640)
    .add(lines, { x: [0, (_, i) => (i === 2 ? 18 : 0)], duration: 200, ease: 'out(3)' }, 690);
  draw();
}

/* ============================================================
   Home · publish — vertical scroll drives a 3D card rail
   ============================================================ */
function sceneWork(view) {
  const track = $('.track--work', view);
  const stage = $('.work', track);
  const rail = $('.work__rail', stage);
  const cards = $$('.card', rail);
  const counter = $('.work__i', stage);
  $$('.bg-stop.is-card', track).forEach((e) => e.remove());
  if (REDUCE) { track.style.removeProperty('height'); return; }

  const vw = stage.clientWidth; const vh = innerHeight;
  const dist = Math.max(0, rail.scrollWidth - vw);
  const trackH = Math.round(dist * 1.05 + vh * 1.6);
  track.style.height = `${trackH}px`;
  const scrollable = trackH - vh;
  const geo = cards.map((c) => ({ c, cx: c.offsetLeft + c.offsetWidth / 2, art: $('.card__art', c) }));
  const RAIL_START = 150; const RAIL_LEN = 700;

  // one background stop per project card, timed to when it reaches the centre
  geo.forEach(({ c, cx }) => {
    if (!c.dataset.deep) return;
    const p = clamp((cx - vw / 2) / (dist || 1), 0, 1);
    const tp = (RAIL_START + p * RAIL_LEN) / 1000;
    const s = d.createElement('span');
    s.className = 'bg-stop is-card';
    s.dataset.bg = c.dataset.deep; s.dataset.ink = 'light'; s.dataset.fx = 'fade';
    s.style.top = `${Math.max(0, tp * scrollable + vh * 0.5 - vh * 0.22)}px`;
    track.append(s);
  });

  const st = { x: 0 };
  let idx = -1;
  const maxRot = vw < 760 ? 16 : 26;
  const render = () => {
    rail.style.transform = `translate3d(${st.x.toFixed(2)}px,0,0)`;
    let best = 0; let bestD = 1e9;
    geo.forEach((g, i) => {
      const n = (g.cx + st.x - vw / 2) / vw;
      const ry = clamp(n * -maxRot * 1.4, -maxRot, maxRot);
      const sc = 1 - Math.min(Math.abs(n) * 0.16, 0.22);
      g.c.style.transform = `perspective(1600px) rotateY(${ry.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
      if (g.art) g.art.style.transform = `translate3d(${clamp(n * -60, -40, 40).toFixed(1)}px,0,0) rotate(${clamp(n * 10, -8, 8).toFixed(2)}deg)`;
      if (Math.abs(n) < bestD) { bestD = Math.abs(n); best = i; }
    });
    if (best !== idx) {
      idx = best;
      geo.forEach((g, i) => { g.c.style.zIndex = String(10 - Math.abs(i - best)); });
      if (cards[best].dataset.deep) counter.textContent = String(best + 1).padStart(2, '0');
    }
  };
  scrub(track, { onUpdate: render }).add(st, { x: [0, -dist], duration: RAIL_LEN }, RAIL_START);
  render();
  return () => { track.style.removeProperty('height'); rail.style.removeProperty('transform'); cards.forEach((c) => { c.style.removeProperty('transform'); c.style.removeProperty('z-index'); }); };
}

/* ============================================================
   Contact · publish — shared by both pages
   ============================================================ */
function sceneContact() {
  const big = $('.contact__big', contactEl);
  const copy = $('.copy', contactEl);
  const label = $('.copy__label', contactEl);
  const addr = $('.copy__addr', contactEl);
  const logLines = $$('.contact__log span', contactEl);
  const elapsed = $('.elapsed', contactEl);
  const offs = [];

  const chars = [];
  $$('.cline', big).forEach((line) => {
    if (!line._split) {
      const text = line.textContent;
      line.textContent = '';
      for (const ch of text) {
        const s = d.createElement('span');
        s.className = 'ch';
        s.textContent = ch === ' ' ? ' ' : ch;
        line.append(s);
      }
      line._split = true;
    }
    chars.push(...$$('.ch', line));
  });

  const stamp = () => {
    const ms = performance.now() - T0;
    const h = Math.floor(ms / 3.6e6); const m = Math.floor(ms / 6e4) % 60; const s = (ms / 1000) % 60;
    return `Time Elapsed ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
  };

  if (!REDUCE) {
    utils.set(chars, { y: '105%' });
    offs.push(whenVisible(contactEl, () => {
      animate(chars, { y: ['105%', '0%'], duration: 1000, ease: 'out(4)', delay: stagger(26) });
      logLines.forEach((el, i) => {
        const text = el === elapsed ? stamp() : el.textContent;
        scramble(el, text, { delay: 500 + i * 160 });
      });
    }, '0px 0px -30% 0px'));
  } else {
    elapsed.textContent = stamp();
  }

  // hover: letters hop as the pointer passes
  if (mqFine.matches && !REDUCE) {
    const hop = (e) => {
      const el = e.target.closest('.ch');
      if (!el || el._hop) return;
      el._hop = true;
      animate(el, { y: [{ to: '-12%', duration: 180, ease: 'out(3)' }, { to: '0%', duration: 700, ease: 'outElastic(1, .45)' }], onComplete: () => { el._hop = false; } });
    };
    big.addEventListener('pointerover', hop);
    offs.push(() => big.removeEventListener('pointerover', hop));

    // magnetic copy button
    const mag = createAnimatable(copy, { x: 500, y: 500, ease: 'out(3)' });
    const move = (e) => {
      const r = copy.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2); const dy = e.clientY - (r.top + r.height / 2);
      const near = Math.hypot(dx, dy) < Math.max(r.width, 160);
      mag.x(near ? dx * 0.22 : 0); mag.y(near ? dy * 0.3 : 0);
    };
    const reset = () => { mag.x(0); mag.y(0); };
    contactEl.addEventListener('pointermove', move, { passive: true });
    contactEl.addEventListener('pointerleave', reset);
    offs.push(() => { contactEl.removeEventListener('pointermove', move); contactEl.removeEventListener('pointerleave', reset); });
  }

  const onCopy = () => {
    const text = copy.dataset.copy;
    const done = (msg) => scramble(label, msg, { settleDuration: 180 });
    const select = () => {
      const range = d.createRange(); range.selectNodeContents(addr);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      done('Selected');
    };
    try {
      navigator.clipboard.writeText(text).then(() => done('Copied'), select);
    } catch (err) { select(); }
    clearTimeout(copy._t);
    copy._t = setTimeout(() => done('Copy'), 2200);
  };
  copy.addEventListener('click', onCopy);
  offs.push(() => copy.removeEventListener('click', onCopy));
  return () => offs.forEach((f) => f());
}

/* ============================================================
   About · whoami — braces morph into a colon and four spaces
   ============================================================ */
function sceneAboutHero(view) {
  const track = $('.track--ahero', view);
  const stage = $('.ahero', track);
  const a = $('.glyph__a', stage); const b = $('.glyph__b', stage);
  const dots = $$('.glyph__indent rect', stage);
  const capA = $('.cap__a', stage); const capB = $('.cap__b', stage);
  const title = $('.ahero__title', stage);

  if (!title._split) {
    const words = title.textContent.split(' ');
    title.setAttribute('aria-label', title.textContent);
    title.textContent = '';
    words.forEach((w, wi) => {
      const lw = d.createElement('span'); lw.className = 'lw'; lw.setAttribute('aria-hidden', 'true');
      for (const ch of w) { const s = d.createElement('span'); s.className = 'ch'; s.textContent = ch; lw.append(s); }
      title.append(lw);
      if (wi < words.length - 1) title.append(' ');
    });
    title._split = true;
  }

  if (REDUCE) { utils.set(dots, { opacity: 0 }); utils.set(capB, { opacity: 0.35 }); return; }
  utils.set(dots, { scale: 0, opacity: 0 });
  utils.set(capB, { opacity: 0.3 });
  scrub(track)
    .add(a, { d: svg.morphTo($('.glyph__t1', stage), 0.6), duration: 420, ease: 'inOut(3)' }, 180)
    .add(b, { d: svg.morphTo($('.glyph__t2', stage), 0.6), duration: 420, ease: 'inOut(3)' }, 230)
    .add(dots, { scale: [0, 1], opacity: [0, 1], duration: 160, ease: 'outBack(2)' }, stagger(45, { start: 640 }))
    .add(capA, { opacity: [1, 0.3], duration: 120 }, 470)
    .add(capB, { opacity: [0.3, 1], duration: 120 }, 470);
}

function introAbout(view) {
  const stage = $('.ahero', view);
  const chars = $$('.ahero__title .ch', stage);
  const paths = $$('.glyph__a, .glyph__b', stage);
  if (REDUCE || INSTANT) { stage.classList.remove('pre'); return; }
  const lead = $('.ahero__lead', stage);
  utils.set(paths, { strokeDasharray: '1 1', strokeDashoffset: 1 });
  utils.set(chars, { y: '120%', rotate: 8 });
  utils.set(lead, { opacity: 0 });
  stage.classList.remove('pre');
  createTimeline({ defaults: { ease: 'out(4)' } })
    .add(chars, { y: '0%', rotate: 0, duration: 1000 }, stagger(32))
    .add(lead, { opacity: 1, y: { from: 24, to: 0 }, duration: 900 }, 420)
    .add(paths, { strokeDashoffset: 0, duration: 1300, ease: 'inOut(3)' }, stagger(140, { start: 200 }))
    .call(() => {
      utils.set(paths, { strokeDasharray: 'none' });
      const eb = $('.ahero__eyebrow .scr', stage);
      scramble(eb, eb.textContent);
    }, 1500);
}

/* ============================================================
   About · story — lines rise as each paragraph arrives
   ============================================================ */
function sceneStory(view) {
  const ps = $$('.story__p', view);
  if (REDUCE) return;
  const offs = [];
  ps.forEach((p, i) => {
    let shown = false;
    const split = splitText(p, { lines: { class: 'ln', wrap: 'clip' } });
    split.addEffect(({ lines }) => {
      if (shown) return;
      utils.set(lines, { y: '105%' });
    });
    offs.push(whenVisible(p, () => {
      shown = true;
      animate(split.lines, { y: ['105%', '0%'], duration: 1000, ease: 'out(4)', delay: stagger(90, { start: i * 120 }) });
    }));
  });
  // gentle depth: columns drift at different speeds while the section passes
  const story = $('.story', view);
  createTimeline({ defaults: { ease: 'linear' }, autoplay: onScroll({ target: story, enter: 'bottom top', leave: 'top bottom', sync: SYNC }) })
    .add(ps, { y: (_, i) => [60 + i * 50, -(60 + i * 50)], duration: 1000 }, 0);
  return () => offs.forEach((f) => f());
}

/* ============================================================
   About · translate — split-flap rows flip from C# to Python
   ============================================================ */
function sceneRosetta(view) {
  const track = $('.track--rosetta', view);
  const rows = $$('.ro__in', track);
  const count = $('.rc', track);
  if (REDUCE) { count.textContent = rows.length; return; }
  const START = 120; const STEP = 88; const DUR = 150;
  let n = -1;
  scrub(track, {
    onUpdate: (self) => {
      const t = self.progress * 1000;
      const k = clamp(Math.floor((t - START - DUR / 2) / STEP) + 1, 0, rows.length);
      if (k !== n) { n = k; count.textContent = k; }
    },
  }).add(rows, { rotateX: [0, 180], duration: DUR, ease: 'inOut(3)' }, stagger(STEP, { start: START }));
}

/* ============================================================
   Views, routing and the curtain transition
   ============================================================ */
let scopes = [];
let buildToken = 0;
const whenIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 150 }) : setTimeout(fn, 16));

/** Build the first scene now (so the intro starts at once), the rest in idle time. */
function build(name) {
  const view = views[name];
  const scenes = name === 'home'
    ? [sceneHero, sceneStatement, sceneCode, sceneGrid, sceneWork]
    : [sceneAboutHero, sceneStory, sceneRosetta];
  const jobs = [...scenes.map((f) => () => f(view)), () => sceneContact()];
  const token = ++buildToken;
  const run = (job) => scopes.push(createScope().add(() => job()));
  run(jobs[0]);
  Chrome.build(view);
  let i = 1;
  const next = () => {
    if (token !== buildToken) return;
    run(jobs[i++]);
    if (i < jobs.length) whenIdle(next);
    else Chrome.measure();
  };
  whenIdle(next);
}

function teardown() {
  buildToken++;
  scopes.forEach((s) => s.revert());
  scopes = [];
}

function setNav(name) {
  const links = $$('.nav__links a');
  const pill = $('.nav__pill');
  links.forEach((a) => {
    if (a.dataset.route === name) {
      a.setAttribute('aria-current', 'page');
      pill.style.width = `${a.offsetWidth}px`;
      pill.style.transform = `translateX(${a.offsetLeft}px)`;
    } else a.removeAttribute('aria-current');
  });
}

function intro(name) {
  if (name === 'home') introHero(views.home);
  else introAbout(views.about);
}

function swap(name) {
  teardown();
  current = name;
  root.dataset.view = name;
  scrollTo(0, 0);
  setNav(name);
  build(name);
  intro(name);
}

const curtain = $('.curtain');
const cols = $$('.curtain i', curtain);
const cmd = $('.curtain__cmd', curtain);
let busy = false;
let pending = null;

async function go(name, push = true) {
  if (busy) { pending = name; return; }
  if (name === current) return;
  busy = true;
  if (push) {
    try { history.pushState(null, '', name === 'about' ? '#about' : '#home'); } catch (err) { /* sandboxed frame */ }
  }
  if (REDUCE) { swap(name); busy = false; return; }
  curtain.classList.add('is-busy');
  cmd.textContent = name === 'about' ? '$ cd about' : '$ cd ~';
  utils.set(cols, { transformOrigin: '50% 100%' });
  await createTimeline({ defaults: { ease: 'inOut(4)' } })
    .add(cols, { scaleY: [0, 1], duration: 480 }, stagger(45))
    .add(cmd, { opacity: [0, 1], scale: [0.9, 1], duration: 240, ease: 'out(3)' }, 320)
    .then();
  swap(name);
  utils.set(cols, { transformOrigin: '50% 0%' });
  await createTimeline({ defaults: { ease: 'inOut(4)' } })
    .add(cmd, { opacity: 0, duration: 140 }, 40)
    .add(cols, { scaleY: [1, 0], duration: 540 }, stagger(45, { start: 90 }))
    .then();
  curtain.classList.remove('is-busy');
  busy = false;
  if (pending && pending !== current) { const next = pending; pending = null; go(next, false); } else pending = null;
}

const routeFromLocation = () => (location.hash === '#about' ? 'about' : 'home');

function wireRoutes() {
  d.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-route]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (a.dataset.route === current) scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' });
    else go(a.dataset.route);
  });
  addEventListener('popstate', () => go(routeFromLocation(), false));
  addEventListener('hashchange', () => go(routeFromLocation(), false));
}

function rebuild() {
  if (!current) return;
  teardown();
  build(current);
  const stage = $('.pre', views[current]);
  if (stage) stage.classList.remove('pre');
}

async function boot() {
  root.classList.add('js');
  root.classList.toggle('rm', REDUCE);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  let fontsDone = false;
  const fonts = d.fonts ? d.fonts.ready.then(() => { fontsDone = true; }) : Promise.resolve();
  await Promise.race([fonts, new Promise((r) => setTimeout(r, 700))]);
  window.__booted = true;
  wireRoutes();
  swap(routeFromLocation());
  if (!fontsDone) fonts.then(() => rebuild());

  let w = innerWidth;
  let t = 0;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (innerWidth !== w) { w = innerWidth; rebuild(); setNav(current); } else Chrome.measure();
    }, 200);
  });
  mqReduce.addEventListener('change', (e) => {
    REDUCE = e.matches;
    root.classList.toggle('rm', REDUCE);
    rebuild();
  });
}

boot();
