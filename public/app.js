/* Trimmed Mean PCE viewer — hand-rolled SVG so the mark specs (2px lines, hairline
   solid grid, 2px surface rings and gaps, selective end labels) are exact. */
(function () {
  'use strict';

  const D = window.PCE_DATA;
  const root = document.documentElement;

  if (!D) {
    document.body.innerHTML =
      '<p style="padding:48px;font-family:system-ui">' +
      ((window.I18N && window.I18N.ko.ui.noData) || 'data.js is missing') + '</p>';
    return;
  }

  /* Language: an explicit ?lang= wins so a link can pin one, then the last choice, then
     Korean. Switching reloads with the URL updated rather than re-rendering in place —
     every string on the page is built once at startup, and a reload keeps that simple
     while giving each language a shareable address. */
  const LANGS = ['ko', 'ja'];
  const lang = (() => {
    const q = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(q)) return q;
    try {
      const saved = localStorage.getItem('pce-lang');
      if (LANGS.includes(saved)) return saved;
    } catch { /* storage can throw in a private window; fall through to the default */ }
    return 'ko';
  })();
  const T = (window.I18N && window.I18N[lang]) || window.I18N.ko;
  const U = T.ui;

  document.documentElement.lang = T.htmlLang;
  document.title = T.doc.title;
  document.getElementById('meta-desc')?.setAttribute('content', T.doc.desc);
  // Values under T.html are authored in i18n.js, never derived from the data files.
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const v = T.html[el.dataset.i18n];
    if (v != null) el.innerHTML = v;
  }
  for (const el of document.querySelectorAll('[data-aria]')) {
    const v = T.aria[el.dataset.aria];
    if (v != null) el.setAttribute('aria-label', v);
  }

  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) {
    const next = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length];
    langBtn.textContent = U.langButton;
    langBtn.setAttribute('aria-label', T.aria.langSwitch);
    langBtn.addEventListener('click', () => {
      try { localStorage.setItem('pce-lang', next); } catch { /* ignore */ }
      const url = new URL(location.href);
      url.searchParams.set('lang', next);
      location.replace(url);
    });
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  };
  const div = (cls) => {
    const n = document.createElement('div');
    if (cls) n.className = cls;
    return n;
  };
  const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();

  const pct = (v, dp) => (v == null ? '—' : v.toFixed(dp == null ? 1 : dp) + '%');
  const monthLabel = (m) => {
    const [y, mo] = m.split('-');
    return T.month(y, mo);
  };

  /* Color follows the entity: each series owns a categorical slot, resolved fresh on
     every render so a theme change repaints without reassigning identity. Slots are
     assigned in the documented fixed order and never cycled — hiding a series never
     recolors the survivors. */
  const withYoy = (defs) =>
    defs.filter((s) => D.series[s.key]).map((s) => ({ ...s, values: D.series[s.key].yoy }));

  /* One chart, eleven series, so the palette runs to eleven slots. That is more than
     the documented eight; the three extra hues and the whole order were run through the
     validator until the adjacent gates cleared in both modes (see styles.css). Slots are
     assigned in this fixed order and never cycled — hiding a series never recolours the
     survivors. Families are kept together so the legend reads in blocks: PCE, then CPI,
     then the Atlanta Fed reweightings. */
  const YOY_SERIES = withYoy([
    { key: 'trimmedMean', name: U.series.trimmedMean, varName: '--cat-1' },
    { key: 'corePce', name: U.series.corePce, varName: '--cat-2' },
    { key: 'headlinePce', name: U.series.headlinePce, varName: '--cat-3' },
    { key: 'coreExShelter', name: U.series.coreExShelter, varName: '--cat-4' },
    { key: 'coreCpi', name: U.series.coreCpi, varName: '--cat-5' },
    { key: 'headlineCpi', name: U.series.headlineCpi, varName: '--cat-6' },
    { key: 'shelter', name: U.series.shelter, varName: '--cat-7' },
    { key: 'coreSticky', name: U.series.coreSticky, varName: '--cat-8' },
    { key: 'stickyAll', name: U.series.stickyAll, varName: '--cat-9' },
    { key: 'stickyExShelter', name: U.series.stickyExShelter, varName: '--cat-10' },
    { key: 'flexCpi', name: U.series.flexCpi, varName: '--cat-11' },
  ]);

  const MOM_SERIES = [
    { key: 'tmAnn1m', name: U.mom.tmAnn1m, varName: '--cat-1',
      values: D.series.trimmedMean.ann1m },
    { key: 'tmAnn6m', name: U.mom.tmAnn6m, varName: '--cat-2',
      values: D.series.trimmedMean.ann6m },
    { key: 'coreAnn3m', name: U.mom.coreAnn3m, varName: '--cat-3',
      values: D.series.corePce.ann3m },
    { key: 'coreAnn6m', name: U.mom.coreAnn6m, varName: '--cat-4',
      values: D.series.corePce.ann6m },
    D.series.stickyExShelter && {
      key: 'stickyAnn3m', name: U.mom.stickyAnn3m, varName: '--cat-5',
      values: D.series.stickyExShelter.ann3m,
    },
  ].filter(Boolean);

  /* Distribution bands, ordered low -> high so the stack reads as one diverging ramp
     from "prices fell" up through "rose faster than 10%". */
  /* Legend for the distribution card: the six bands are filled marks, the two overlays
     are lines, so each key mirrors its own mark. */
  const BANDS = [
    { key: 'fell', name: U.bands.fell, varName: '--band-fell' },
    { key: 'b0_2', name: U.bands.b0_2, varName: '--band-0-2' },
    { key: 'b2_3', name: U.bands.b2_3, varName: '--band-2-3' },
    { key: 'b3_5', name: U.bands.b3_5, varName: '--band-3-5' },
    { key: 'b5_10', name: U.bands.b5_10, varName: '--band-5-10' },
    { key: 'b10', name: U.bands.b10, varName: '--band-10' },
  ];

  const DIST_KEY = BANDS.concat([
    { name: U.above3Raw, varName: '--text-primary', line: true, faint: true },
    { name: U.above3Smooth, varName: '--text-primary', line: true },
  ]);

  const RANGES = [
    { id: 'all', label: U.ranges['all'], months: null },
    { id: '40y', label: U.ranges['40y'], months: 480 },
    { id: '20y', label: U.ranges['20y'], months: 240 },
    { id: '10y', label: U.ranges['10y'], months: 120 },
    { id: '5y', label: U.ranges['5y'], months: 60 },
    { id: '3y', label: U.ranges['3y'], months: 36 },
  ];

  const missingSet = new Set(D.missing || []);

  /* The CPI block is comparison material, not the subject — it starts hidden so the
     default view is the three PCE measures rather than eight lines at once. */
  const state = {
    range: 'all',
    hidden: {
      // Five at once is readable; the other six are one click away.
      yoy: new Set(['coreCpi', 'headlineCpi', 'shelter', 'stickyAll',
        'stickyExShelter', 'flexCpi']),
      mom: new Set(['coreAnn3m', 'stickyAnn3m']),
      breadth: new Set(),
    },
    tableOpen: false,
  };

  /* The first month where the star series has a value — earlier months are an axis
     with nothing on it. */
  const firstIdx = (() => {
    const v = D.series.coreExShelter.yoy;
    for (let i = 0; i < v.length; i++) if (v[i] != null) return i;
    return 0;
  })();

  function slice() {
    const end = D.months.length;
    const r = RANGES.find((x) => x.id === state.range);
    const start = r.months == null ? firstIdx : Math.max(firstIdx, end - r.months);
    return { start, end };
  }

  /* Distribution arrives on its own month list; project it onto the shared axis so the
     one range filter drives every chart on the page. */
  const dist = (() => {
    if (!D.distribution || !D.distribution.months?.length) return null;
    const idx = new Map(D.months.map((m, i) => [m, i]));
    const n = D.months.length;
    const bands = {};
    for (const b of BANDS) bands[b.key] = new Array(n).fill(null);
    const above3 = new Array(n).fill(null);
    for (let k = 0; k < D.distribution.months.length; k++) {
      const i = idx.get(D.distribution.months[k]);
      if (i == null) continue;
      for (const b of BANDS) bands[b.key][i] = D.distribution.bands[b.key]?.[k] ?? null;
      above3[i] = D.distribution.above3[k];
    }
    /* Three-month TRAILING mean of the share above 3%.
       A centred window was the first attempt and it read as a laggy signal — not
       because it turned late (centring costs no lead time) but because it needs months
       on the far side, so the line stopped half a year short of the right edge, exactly
       where the eye goes. Trailing draws to the last month and never revises.
       Three rather than twelve: twelve flattens this series to a standard deviation of
       1.0pp and pushes the 2021-22 peak six months out. Three keeps 3.7pp of shape and
       turns with the data, which is the horizon monthly inflation is usually read over
       anyway. The raw monthly line stays underneath it at 10.7pp. */
    const SMOOTH_MONTHS = 3;
    const smooth = new Array(n).fill(null);
    for (let i = SMOOTH_MONTHS - 1; i < n; i++) {
      let sum = 0;
      let got = 0;
      for (let k = i - SMOOTH_MONTHS + 1; k <= i; k++) {
        if (above3[k] == null) { got = -1; break; }
        sum += above3[k];
        got++;
      }
      if (got === SMOOTH_MONTHS) smooth[i] = Math.round((sum / SMOOTH_MONTHS) * 100) / 100;
    }
    // The breadth lines ride the same axis. They are a different measure from the
    // bands above them — 12-month change, not annualised 1-month — so they get their
    // own card rather than being drawn over the distribution.
    let breadth = null;
    if (D.distribution.breadth) {
      const w = new Array(n).fill(null);
      const u = new Array(n).fill(null);
      for (let k = 0; k < D.distribution.months.length; k++) {
        const i = idx.get(D.distribution.months[k]);
        if (i == null) continue;
        w[i] = D.distribution.breadth.weighted[k];
        u[i] = D.distribution.breadth.unweighted[k];
      }
      breadth = { weighted: w, unweighted: u, threshold: D.distribution.breadth.threshold };
    }

    return { bands, above3, smooth, breadth, meta: D.distribution };
  })();

  const BREADTH_SERIES = dist?.breadth ? [
    { key: 'weighted', name: U.breadth.weighted, varName: '--cat-1',
      values: dist.breadth.weighted },
    { key: 'unweighted', name: U.breadth.unweighted, varName: '--cat-2',
      values: dist.breadth.unweighted },
  ] : null;

  // ------------------------------------------------------------ scales

  function niceDomain(lo, hi) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 2.5);
    const span = hi - lo || 1;
    const steps = [0.25, 0.5, 1, 2, 2.5, 5];
    let step = steps[steps.length - 1];
    for (const s of steps) {
      if (span / s <= 6) { step = s; break; }
    }
    const min = Math.floor(lo / step) * step;
    const max = Math.ceil((hi + span * 0.06) / step) * step;
    const ticks = [];
    for (let v = min; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
    return { min, max, ticks };
  }

  function xTicks(start, end) {
    const months = end - start;
    const years = months / 12;
    const out = [];
    if (years <= 4) {
      for (let i = start; i < end; i++) {
        const [, mo] = D.months[i].split('-');
        if (mo === '01' || mo === '07') out.push({ i, label: D.months[i].replace('-', '.') });
      }
    } else {
      const step = years <= 12 ? 2 : years <= 26 ? 5 : 10;
      for (let i = start; i < end; i++) {
        const [y, mo] = D.months[i].split('-');
        if (mo === '01' && Number(y) % step === 0) out.push({ i, label: y });
      }
    }
    return out;
  }

  /* Every chart shares the same frame: geometry, recession bands, gridlines, x axis,
     crosshair plumbing. Only the marks differ, so the differences live in spec.draw. */
  function createChart(host, spec) {
    const tip = div('tip');
    tip.setAttribute('role', 'status');
    host.appendChild(tip);

    let geom = null; // kept for the pointer handler between renders

    /* The shared range filter starts where the page's star series starts, but the
       trimmed mean, the distribution and the breadth lines each begin later. Without
       this every one of those charts would open with a decade of empty plot on the
       left. Computed once — the underlying arrays never change. */
    const ownStart = (() => {
      let first = Infinity;
      for (const ser of spec.series) {
        for (let i = 0; i < ser.values.length; i++) {
          if (ser.values[i] != null) { if (i < first) first = i; break; }
        }
      }
      return Number.isFinite(first) ? first : 0;
    })();

    function render() {
      // The tooltip is absolutely positioned from the previous layout's geometry. Left
      // showing across a resize it would sit at a stale offset and drag a horizontal
      // scrollbar onto the page, so every render starts with it put away.
      tip.dataset.show = 'false';
      tip.style.left = '';
      tip.style.top = '';
      delete host.dataset.idx;

      const sel = slice();
      const end = sel.end;
      const start = Math.max(sel.start, Math.min(ownStart, end - 1));
      const n = end - start;
      const hidden = state.hidden[spec.group];
      const shown = hidden ? spec.series.filter((s) => !hidden.has(s.key)) : spec.series;

      // Use the real container width — a floor above it would make the viewBox scale
      // down and squish the plot on small phones.
      const W = Math.max(host.clientWidth || 640, 240);
      // Height tracks width so the plot keeps its proportions as the window grows,
      // bounded so it never collapses on a phone or overflows a short window.
      const H = Math.round(Math.max(
        spec.minH,
        Math.min(W * spec.ratio, spec.maxH, innerHeight * 0.62)
      ));
      const narrow = W < 560;
      const M = {
        top: 14,
        right: narrow ? 42 : 62, // room for the end labels
        bottom: 28,
        left: narrow ? 36 : 46,
      };
      const iw = W - M.left - M.right;
      const ih = H - M.top - M.bottom;

      const dom = spec.domain
        ? spec.domain()
        : (() => {
          let lo = Infinity, hi = -Infinity;
          for (const s of shown) {
            for (let i = start; i < end; i++) {
              const v = s.values[i];
              if (v == null) continue;
              if (v < lo) lo = v;
              if (v > hi) hi = v;
            }
          }
          if (!Number.isFinite(lo)) { lo = 0; hi = 4; }
          return niceDomain(lo, hi);
        })();

      const X = (i) => M.left + (n <= 1 ? iw / 2 : ((i - start) / (n - 1)) * iw);
      const Y = (v) => M.top + ih * (1 - (v - dom.min) / (dom.max - dom.min));
      geom = { X, Y, start, end, n, M, iw, ih, shown, dom };

      const svg = el('svg', {
        viewBox: `0 0 ${W} ${H}`,
        width: W,
        height: H,
        'aria-hidden': 'true',
      });

      const ink = {
        grid: cssVar('--gridline'),
        base: cssVar('--baseline'),
        muted: cssVar('--text-muted'),
        secondary: cssVar('--text-secondary'),
        primary: cssVar('--text-primary'),
        surface: cssVar('--surface-1'),
        recession: cssVar('--recession-band'),
        gap: cssVar('--gap-band'),
      };

      const clampX = (x) => Math.max(M.left, Math.min(M.left + iw, x));

      // --- recession bands, behind everything
      for (const r of D.recessions || []) {
        const a = D.months.indexOf(r.start);
        const b = D.months.indexOf(r.end);
        if (a < 0 || b < 0 || b < start || a >= end) continue;
        const x1 = clampX(X(Math.max(a, start)));
        const x2 = clampX(X(Math.min(b, end - 1)));
        if (x2 - x1 < 0.5) continue;
        svg.appendChild(el('rect', {
          x: x1, y: M.top, width: x2 - x1, height: ih, fill: ink.recession,
        }));
      }

      // --- unpublished months, so a break in the line is explained rather than mysterious
      if (spec.showGaps) {
        for (const m of missingSet) {
          const i = D.months.indexOf(m);
          if (i < start || i >= end) continue;
          const w = Math.max(2, iw / Math.max(n - 1, 1));
          svg.appendChild(el('rect', {
            x: clampX(X(i) - w / 2), y: M.top, width: w, height: ih, fill: ink.gap,
          }));
        }
      }

      // --- gridlines: hairline, solid, recessive
      for (const t of dom.ticks) {
        const y = Y(t);
        svg.appendChild(el('line', {
          x1: M.left, x2: M.left + iw, y1: y, y2: y,
          stroke: t === 0 ? ink.base : ink.grid, 'stroke-width': 1,
        }));
        const lbl = el('text', {
          x: M.left - 9, y: y + 4, 'text-anchor': 'end',
          fill: ink.muted, 'font-size': 11.5, 'font-family': 'inherit',
          style: 'font-variant-numeric:tabular-nums',
        });
        lbl.textContent = t + '%';
        svg.appendChild(lbl);
      }

      // --- policy target. The rule goes behind the data; its label is added after the
      //     marks so no line runs through the text.
      const hasTarget = spec.target != null && spec.target >= dom.min && spec.target <= dom.max;
      if (hasTarget) {
        svg.appendChild(el('line', {
          x1: M.left, x2: M.left + iw, y1: Y(spec.target), y2: Y(spec.target),
          stroke: ink.base, 'stroke-width': 1.5,
        }));
      }

      // --- x axis
      svg.appendChild(el('line', {
        x1: M.left, x2: M.left + iw, y1: M.top + ih, y2: M.top + ih,
        stroke: ink.base, 'stroke-width': 1,
      }));
      let lastX = -Infinity;
      for (const t of xTicks(start, end)) {
        const x = X(t.i);
        if (x - lastX < 46) continue; // drop labels that would collide
        lastX = x;
        const lbl = el('text', {
          x, y: M.top + ih + 17, 'text-anchor': 'middle',
          fill: ink.muted, 'font-size': 11.5, 'font-family': 'inherit',
          style: 'font-variant-numeric:tabular-nums',
        });
        lbl.textContent = t.label;
        svg.appendChild(lbl);
      }

      spec.draw({ svg, X, Y, start, end, n, M, iw, ih, shown, dom, ink, narrow, el });

      // --- crosshair layer (hidden until pointer/focus)
      const cross = el('g', { opacity: 0 });
      const crossLine = el('line', {
        y1: M.top, y2: M.top + ih, stroke: ink.muted, 'stroke-width': 1,
      });
      cross.appendChild(crossLine);
      const crossDots = el('g');
      cross.appendChild(crossDots);
      svg.appendChild(cross);

      host.querySelectorAll('svg').forEach((s) => s.remove());
      host.insertBefore(svg, tip);

      // The target label sits inside the plot, so it needs a surface chip behind it or
      // the data lines run straight through the text. getBBox needs the node rendered,
      // hence after insertion.
      if (hasTarget && spec.targetLabel) {
        const t = el('text', {
          x: M.left + 8, y: Y(spec.target) - 7, fill: ink.secondary,
          'font-size': 11, 'font-family': 'inherit',
        });
        t.textContent = narrow ? U.targetShort : spec.targetLabel;
        svg.appendChild(t);
        const b = t.getBBox();
        svg.insertBefore(el('rect', {
          x: b.x - 4, y: b.y - 1, width: b.width + 8, height: b.height + 2,
          rx: 3, fill: ink.surface, opacity: 0.95,
        }), t);
      }

      geom.cross = cross;
      geom.crossLine = crossLine;
      geom.crossDots = crossDots;
      geom.ink = ink;
      geom.W = W;
      geom.H = H;
    }

    function showAt(idx) {
      if (!geom) return;
      const { X, M, iw } = geom;
      const i = Math.max(geom.start, Math.min(geom.end - 1, idx));
      const month = D.months[i];
      const x = X(i);

      geom.cross.setAttribute('opacity', '1');
      geom.crossLine.setAttribute('x1', x);
      geom.crossLine.setAttribute('x2', x);
      geom.crossDots.replaceChildren();

      // Untrusted-data rule: every label goes in via textContent, never innerHTML.
      tip.replaceChildren();
      const dateEl = div('tip-date');
      dateEl.textContent = monthLabel(month);
      tip.appendChild(dateEl);

      spec.tip({ i, x, tip, geom, div });

      tip.dataset.show = 'true';
      const tw = tip.offsetWidth || 180;
      const left = x + 16 + tw > M.left + iw + 60 ? x - tw - 16 : x + 16;
      tip.style.left = Math.max(2, left) + 'px';
      tip.style.top = '10px';
      host.dataset.idx = String(i);
    }

    function hide() {
      if (!geom) return;
      geom.cross.setAttribute('opacity', '0');
      tip.dataset.show = 'false';
    }

    function idxFromClientX(clientX) {
      const r = host.getBoundingClientRect();
      const scale = geom.W / r.width;
      const px = (clientX - r.left) * scale;
      const t = (px - geom.M.left) / (geom.iw || 1);
      return geom.start + Math.round(t * (geom.n - 1));
    }

    // The crosshair finds the X — readers aim at a date, not at a 2px line.
    host.addEventListener('pointermove', (e) => geom && showAt(idxFromClientX(e.clientX)));
    host.addEventListener('pointerleave', hide);
    host.addEventListener('focus', () => geom && showAt(Number(host.dataset.idx) || geom.end - 1));
    host.addEventListener('blur', hide);
    host.addEventListener('keydown', (e) => {
      if (!geom) return;
      const cur = Number(host.dataset.idx);
      const i = Number.isFinite(cur) && cur ? cur : geom.end - 1;
      const step = e.shiftKey ? 12 : 1;
      if (e.key === 'ArrowLeft') { showAt(i - step); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { showAt(i + step); e.preventDefault(); }
      else if (e.key === 'Home') { showAt(geom.start); e.preventDefault(); }
      else if (e.key === 'End') { showAt(geom.end - 1); e.preventDefault(); }
      else if (e.key === 'Escape') hide();
    });

    return { render, hide };
  }

  // ------------------------------------------------------------ line marks

  /* Shared by the two line charts: lines broken across nulls rather than interpolated,
     end markers, and direct labels that step apart when they would collide. */
  function drawLines(ctx) {
    const { svg, X, Y, start, end, shown, M, ih, ink } = ctx;
    const endPoints = [];
    for (const s of shown) {
      const color = cssVar(s.varName);
      let d = '';
      let pen = false;
      let lastGood = null;
      for (let i = start; i < end; i++) {
        const v = s.values[i];
        if (v == null) { pen = false; continue; }
        d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' ';
        pen = true;
        lastGood = { i, v };
      }
      if (d) {
        svg.appendChild(el('path', {
          d, fill: 'none', stroke: color, 'stroke-width': 2,
          'stroke-linejoin': 'round', 'stroke-linecap': 'round',
        }));
      }
      if (lastGood) endPoints.push({ s, color, ...lastGood });
    }

    // --- end markers + selective direct labels (value only; the legend carries names)
    const labels = endPoints.map((p) => ({
      p, anchorY: Y(p.v), y: Y(p.v), text: p.v.toFixed(1),
    }));
    labels.sort((a, b) => a.y - b.y);
    const GAP = 15;
    for (let i = 1; i < labels.length; i++) {
      if (labels[i].y - labels[i - 1].y < GAP) labels[i].y = labels[i - 1].y + GAP;
    }
    const overflow = labels.length ? labels[labels.length - 1].y - (M.top + ih) : 0;
    if (overflow > 0) for (const l of labels) l.y -= overflow;
    for (let i = labels.length - 2; i >= 0; i--) {
      if (labels[i + 1].y - labels[i].y < GAP) labels[i].y = labels[i + 1].y - GAP;
    }

    for (const l of labels) {
      const x = X(l.p.i);
      // Leader line only when the label had to leave its point.
      if (Math.abs(l.y - l.anchorY) > 1.5) {
        svg.appendChild(el('path', {
          d: `M${x + 5} ${l.anchorY} L${x + 12} ${l.anchorY} L${x + 16} ${l.y} L${x + 21} ${l.y}`,
          fill: 'none', stroke: l.p.color, 'stroke-width': 1, opacity: 0.55,
        }));
      }
      // 2px surface ring keeps overlapping end dots legible.
      svg.appendChild(el('circle', {
        cx: x, cy: l.anchorY, r: 4.5, fill: l.p.color,
        stroke: ink.surface, 'stroke-width': 2,
      }));
      const t = el('text', {
        x: x + 24, y: l.y + 4, fill: ink.primary, 'font-size': 12,
        'font-weight': 600, 'font-family': 'inherit',
        style: 'font-variant-numeric:tabular-nums',
      });
      t.textContent = l.text;
      svg.appendChild(t);
    }
  }

  function lineTip(ctx) {
    const { i, x, tip, geom, div: mkDiv } = ctx;
    let any = false;
    for (const s of geom.shown) {
      const v = s.values[i];
      const row = mkDiv('tip-row');
      const key = mkDiv('tip-key');
      key.style.background = cssVar(s.varName);
      const val = mkDiv('tip-val');
      val.textContent = pct(v);
      const name = mkDiv('tip-name');
      name.textContent = s.name;
      row.append(key, val, name);
      tip.appendChild(row);
      if (v != null) {
        any = true;
        geom.crossDots.appendChild(el('circle', {
          cx: x, cy: geom.Y(v), r: 4, fill: cssVar(s.varName),
          stroke: geom.ink.surface, 'stroke-width': 2,
        }));
      }
    }
    if (missingSet.has(D.months[i])) {
      // PCE and sticky still report this month, so blame BLS specifically rather than
      // implying every number here is absent.
      const note = mkDiv('tip-missing');
      note.textContent = U.tipMissing;
      tip.appendChild(note);
    } else if (!any) {
      const note = mkDiv('tip-missing');
      note.textContent = U.tipNone;
      tip.appendChild(note);
    }
  }

  // ------------------------------------------------------------ legend

  function buildLegend(container, series, group, onChange) {
    container.replaceChildren();
    for (const s of series) {
      const b = document.createElement('button');
      b.type = 'button';
      const on = !state.hidden[group].has(s.key);
      b.setAttribute('aria-pressed', String(on));
      const key = div('legend-key');
      key.style.background = cssVar(s.varName);
      const label = document.createElement('span');
      label.textContent = s.name;
      b.append(key, label);
      b.addEventListener('click', () => {
        const set = state.hidden[group];
        if (set.has(s.key)) set.delete(s.key);
        else if (series.length - set.size > 1) set.add(s.key); // never hide the last one
        buildLegend(container, series, group, onChange);
        onChange();
      });
      container.appendChild(b);
    }
  }

  /* The distribution bands are one ordered scale, not independent series, so their key
     is a read-only legend rather than a set of toggles. */
  function buildStaticLegend(container, items) {
    container.replaceChildren();
    for (const s of items) {
      const b = document.createElement('span');
      const key = div('legend-key' + (s.line ? '' : ' fill'));
      key.style.background = cssVar(s.varName);
      if (s.faint) key.style.opacity = '0.4';
      const label = document.createElement('span');
      label.textContent = s.name;
      b.append(key, label);
      container.appendChild(b);
    }
  }

  // ------------------------------------------------------------ header stats

  function lastValue(arr, upTo) {
    for (let i = upTo; i >= 0; i--) if (arr?.[i] != null) return { v: arr[i], i };
    return { v: null, i: -1 };
  }

  function renderStats() {
    const last = D.months.length - 1;
    const hero = D.series.coreExShelter;
    const cur = lastValue(hero.yoy, last);
    const prev = cur.i > 0 ? lastValue(hero.yoy, cur.i - 1) : { v: null };

    document.getElementById('hero-value').textContent = pct(cur.v);
    const dEl = document.getElementById('hero-delta');
    if (cur.v != null && prev.v != null) {
      const d = cur.v - prev.v;
      dEl.textContent = (d > 0 ? '▲ +' : d < 0 ? '▼ ' : '– ') + d.toFixed(2) + 'p';
      dEl.className = 'delta ' + (d > 0.005 ? 'up' : d < -0.005 ? 'down' : 'flat');
      dEl.title = U.deltaTitle;
    }
    document.getElementById('hero-meta').textContent =
      `${monthLabel(D.months[cur.i])}${U.sep}${U.heroMeta}`;

    // The hero carries the CPI measure, so the tiles carry the PCE story the page is
    // named after — starting with the trimmed mean itself.
    const tiles = [
      { k: 'trimmedMean', ...lastValue(D.series.trimmedMean.yoy, last) },
      { k: 'corePce', ...lastValue(D.series.corePce.yoy, last) },
      { k: 'headlinePce', ...lastValue(D.series.headlinePce.yoy, last) },
      D.series.coreSticky && { k: 'coreSticky', ...lastValue(D.series.coreSticky.yoy, last) },
      dist && { k: 'above3m1', ...lastValue(dist.above3, last) },
      dist?.breadth && { k: 'above3yoy', ...lastValue(dist.breadth.weighted, last) },
    ].filter(Boolean);
    const host = document.getElementById('tiles');
    host.replaceChildren();
    for (const t of tiles) {
      const [label, note] = U.tiles[t.k];
      const c = div('tile');
      const l = div('tile-label'); l.textContent = label;
      const v = div('tile-value'); v.textContent = pct(t.v);
      const nEl = div('tile-note');
      nEl.textContent = t.i >= 0 ? `${T.monthShort(D.months[t.i])}${U.sep}${note}` : note;
      c.append(l, v, nEl);
      host.appendChild(c);
    }
  }

  // ------------------------------------------------------------ table view

  function renderTable() {
    const wrap = document.getElementById('table-wrap');
    if (!state.tableOpen) return;
    const { start, end } = slice();
    const sticky = D.series.stickyExShelter;
    const C = U.table.cols;
    const cols = [
      { h: C.trimmedMean, get: (i) => D.series.trimmedMean.yoy[i] },
      { h: C.corePce, get: (i) => D.series.corePce.yoy[i] },
      { h: C.headlinePce, get: (i) => D.series.headlinePce.yoy[i] },
      { h: C.coreExShelter, get: (i) => D.series.coreExShelter.yoy[i] },
      { h: C.coreCpi, get: (i) => D.series.coreCpi.yoy[i] },
      { h: C.headlineCpi, get: (i) => D.series.headlineCpi.yoy[i] },
      { h: C.shelter, get: (i) => D.series.shelter.yoy[i] },
      sticky && { h: C.stickyExShelter, get: (i) => sticky.yoy[i] },
      D.series.coreSticky && { h: C.coreSticky, get: (i) => D.series.coreSticky.yoy[i] },
      D.series.stickyAll && { h: C.stickyAll, get: (i) => D.series.stickyAll.yoy[i] },
      D.series.flexCpi && { h: C.flexCpi, get: (i) => D.series.flexCpi.yoy[i] },
      { h: C.tmAnn1m, ann: true, get: (i) => D.series.trimmedMean.ann1m[i] },
      { h: C.tmAnn6m, ann: true, get: (i) => D.series.trimmedMean.ann6m[i] },
      { h: C.coreAnn6m, ann: true, get: (i) => D.series.corePce.ann6m[i] },
      dist && { h: C.above3m1, ann: true, get: (i) => dist.above3[i] },
      dist?.breadth && { h: C.bWeighted, ann: true, get: (i) => dist.breadth.weighted[i] },
      dist?.breadth && { h: C.bUnweighted, ann: true, get: (i) => dist.breadth.unweighted[i] },
    ].filter(Boolean);
    const yoyCols = cols.filter((c) => !c.ann).length;

    const table = document.createElement('table');
    const cap = document.createElement('caption');
    cap.textContent = U.table.caption(
      T.monthShort(D.months[start]), T.monthShort(D.months[end - 1]), yoyCols);

    table.appendChild(cap);

    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    for (const h of [U.table.month, ...cols.map((c) => c.h)]) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = h;
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let i = end - 1; i >= start; i--) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.style.textAlign = 'left';
      th.style.fontWeight = '400';
      th.textContent = D.months[i];
      tr.appendChild(th);
      for (const c of cols) {
        const td = document.createElement('td');
        const v = c.get(i);
        td.textContent = v == null ? '—' : v.toFixed(2);
        if (v == null) td.className = 'na';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.replaceChildren(table);
  }

  // ------------------------------------------------------------ wiring

  const charts = [];

  charts.push(createChart(document.getElementById('chart-yoy'), {
    group: 'yoy', series: YOY_SERIES, ratio: 0.34, minH: 270, maxH: 580,
    target: 2, targetLabel: U.target, showGaps: true,
    draw: drawLines, tip: lineTip,
  }));

  charts.push(createChart(document.getElementById('chart-mom'), {
    group: 'mom', series: MOM_SERIES, ratio: 0.27, minH: 230, maxH: 440,
    target: 2, targetLabel: U.target, showGaps: true,
    draw: drawLines, tip: lineTip,
  }));

  if (dist) {
    document.getElementById('card-dist').hidden = false;
    buildStaticLegend(document.getElementById('legend-dist'),
      DIST_KEY);

    charts.push(createChart(document.getElementById('chart-dist'), {
      group: 'dist', series: BANDS.map((b) => ({ ...b, values: dist.bands[b.key] })),
      ratio: 0.3, minH: 240, maxH: 460,
      // A share-of-total axis is always 0-100; letting it autoscale would make two
      // range selections silently incomparable.
      domain: () => ({ min: 0, max: 100, ticks: [0, 25, 50, 75, 100] }),
      draw: drawStack, tip: stackTip,
    }));
  }

  if (BREADTH_SERIES) {
    document.getElementById('card-breadth').hidden = false;
    charts.push(createChart(document.getElementById('chart-breadth'), {
      group: 'breadth', series: BREADTH_SERIES, ratio: 0.28, minH: 240, maxH: 440,
      // A share-of-basket axis is always 0-100; letting it autoscale would make two
      // range selections silently incomparable.
      domain: () => ({ min: 0, max: 100, ticks: [0, 25, 50, 75, 100] }),
      draw: drawLines, tip: lineTip,
    }));
  }

  /* Stacked shares. Below ~48 visible months each month gets its own column with a 2px
     surface gap between segments; above that the columns would be sub-pixel, so the
     same stack is drawn as areas with a 1px surface seam doing the separating work. */
  function drawStack(ctx) {
    const { svg, X, Y, start, end, n, ink } = ctx;
    const asBars = n <= 48;
    const colW = Math.max(1, (ctx.iw / Math.max(n, 1)));

    const tops = [];
    for (let i = start; i < end; i++) {
      let acc = 0;
      const col = {};
      for (const b of BANDS) {
        const v = dist.bands[b.key][i];
        col[b.key] = v == null ? null : [acc, acc + v];
        if (v != null) acc += v;
      }
      tops.push(col);
    }

    for (const b of BANDS) {
      const color = cssVar(b.varName);
      if (asBars) {
        for (let i = start; i < end; i++) {
          const seg = tops[i - start][b.key];
          if (!seg || seg[1] - seg[0] <= 0) continue;
          const y0 = Y(seg[1]);
          const y1 = Y(seg[0]);
          const h = Math.max(0.5, y1 - y0 - 2); // 2px surface gap between segments
          svg.appendChild(el('rect', {
            x: X(i) - colW * 0.38, y: y0, width: colW * 0.76, height: h,
            fill: color, rx: Math.min(2, colW * 0.2),
          }));
        }
      } else {
        let up = '', down = '';
        let open = false;
        for (let i = start; i < end; i++) {
          const seg = tops[i - start][b.key];
          if (!seg) { open = false; continue; }
          up += (open ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(seg[1]).toFixed(1) + ' ';
          down = `L${X(i).toFixed(1)} ${Y(seg[0]).toFixed(1)} ` + down;
          open = true;
        }
        if (up) {
          // The 2px surface gap that separates stacked segments needs a segment wide
          // enough to have an edge. Below ~4px per month it stops separating bands and
          // starts dithering them, so it comes off.
          const seam = ctx.iw / Math.max(n, 1) >= 4;
          svg.appendChild(el('path', {
            d: up + down + 'Z', fill: color,
            ...(seam ? { stroke: ink.surface, 'stroke-width': 1, 'stroke-linejoin': 'round' } : {}),
          }));
        }
      }
    }

    // The share above 3% is the reason this card exists, so it is drawn explicitly
    // rather than left for the reader to add up. Month to month it is very noisy — over
    // the full 49 years that noise is all you would see — so the raw series is drawn
    // thin and a 12-month centred average carries the trend on top of it. Both are the
    // same data; neither band is altered.
    const path = (get) => {
      let d = '';
      let pen = false;
      for (let i = start; i < end; i++) {
        const v = get(i);
        if (v == null) { pen = false; continue; }
        d += (pen ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1) + ' ';
        pen = true;
      }
      return d;
    };

    const raw = path((i) => dist.above3[i]);
    if (raw) {
      svg.appendChild(el('path', {
        d: raw, fill: 'none', stroke: ink.primary, 'stroke-width': 1,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: 0.4,
      }));
    }

    const smooth = path((i) => dist.smooth[i]);
    if (smooth) {
      // A surface underlay keeps the line legible wherever it crosses a dark band.
      svg.appendChild(el('path', {
        d: smooth, fill: 'none', stroke: ink.surface, 'stroke-width': 5,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round', opacity: 0.9,
      }));
      svg.appendChild(el('path', {
        d: smooth, fill: 'none', stroke: ink.primary, 'stroke-width': 2,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      }));
    }

    const lastI = (() => {
      for (let i = end - 1; i >= start; i--) if (dist.above3[i] != null) return i;
      return -1;
    })();
    if (lastI >= 0) {
      svg.appendChild(el('circle', {
        cx: X(lastI), cy: Y(dist.above3[lastI]), r: 4.5,
        fill: ink.primary, stroke: ink.surface, 'stroke-width': 2,
      }));
      const t = el('text', {
        x: X(lastI) + 9, y: Y(dist.above3[lastI]) + 4, fill: ink.primary,
        'font-size': 12, 'font-weight': 600, 'font-family': 'inherit',
        style: 'font-variant-numeric:tabular-nums',
      });
      t.textContent = dist.above3[lastI].toFixed(1);
      svg.appendChild(t);
    }
  }

  function stackTip(ctx) {
    const { i, tip, div: mkDiv } = ctx;
    let any = false;
    for (const b of BANDS) {
      const v = dist.bands[b.key][i];
      if (v == null) continue;
      any = true;
      const row = mkDiv('tip-row');
      const key = mkDiv('tip-key');
      key.style.background = cssVar(b.varName);
      const val = mkDiv('tip-val');
      val.textContent = pct(v);
      const name = mkDiv('tip-name');
      name.textContent = b.name;
      row.append(key, val, name);
      tip.appendChild(row);
    }
    if (!any) {
      const note = mkDiv('tip-missing');
      note.textContent = U.tipNoDist;
      tip.appendChild(note);
      return;
    }
    const row = mkDiv('tip-row');
    const key = mkDiv('tip-key');
    key.style.background = cssVar('--text-primary');
    const val = mkDiv('tip-val');
    val.textContent = pct(dist.above3[i]);
    const name = mkDiv('tip-name');
    name.textContent = U.above3Total;
    row.append(key, val, name);
    tip.appendChild(row);
  }

  function renderAll() {
    for (const c of charts) c.render();
    renderTable();
  }

  const seg = document.getElementById('range-seg');
  for (const r of RANGES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = r.label;
    b.setAttribute('aria-pressed', String(state.range === r.id));
    b.addEventListener('click', () => {
      state.range = r.id;
      seg.querySelectorAll('button').forEach((x, k) =>
        x.setAttribute('aria-pressed', String(RANGES[k].id === r.id)));
      renderAll();
    });
    seg.appendChild(b);
  }

  const rebuildLegends = () => {
    buildLegend(document.getElementById('legend-yoy'), YOY_SERIES, 'yoy', renderAll);
    buildLegend(document.getElementById('legend-mom'), MOM_SERIES, 'mom', renderAll);
    if (BREADTH_SERIES) {
      buildLegend(document.getElementById('legend-breadth'), BREADTH_SERIES, 'breadth', renderAll);
    }
    if (dist) {
      buildStaticLegend(document.getElementById('legend-dist'),
        DIST_KEY);
    }
  };
  rebuildLegends();

  const tableBtn = document.getElementById('table-toggle');
  // The inline label is the Korean fallback; set it from the table so a language swap
  // reaches the button before anyone clicks it.
  tableBtn.textContent = U.tableOpen;
  tableBtn.addEventListener('click', () => {
    state.tableOpen = !state.tableOpen;
    document.getElementById('table-wrap').hidden = !state.tableOpen;
    tableBtn.setAttribute('aria-expanded', String(state.tableOpen));
    tableBtn.textContent = state.tableOpen ? U.tableClose : U.tableOpen;
    renderTable();
  });

  const themeBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('pce-theme');
  if (savedTheme) root.dataset.theme = savedTheme;
  else root.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const syncThemeBtn = () => {
    const dark = root.dataset.theme === 'dark';
    themeBtn.textContent = dark ? U.themeLight : U.themeDark;
    themeBtn.setAttribute('aria-label', dark ? T.aria.themeToLight : T.aria.themeToDark);
  };
  themeBtn.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('pce-theme', root.dataset.theme);
    syncThemeBtn();
    rebuildLegends();
    renderAll();
  });
  syncThemeBtn();

  if (dist) {
    document.getElementById('note-dist').append(U.distNote(dist.meta));
  } else {
    document.getElementById('note-dist').append(U.distNoteAbsent);
  }

  document.getElementById('generated-note').textContent = U.generated(
    new Date(D.generatedAt).toLocaleString(T.locale), D.months[firstIdx], D.latestMonth);

  renderStats();
  renderAll();

  let raf = 0;
  const scheduleRender = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(renderAll);
  };

  // Window resize covers both axes — including a height-only drag, which changes the
  // charts because their height is capped against innerHeight.
  addEventListener('resize', scheduleRender);

  // Container-driven width changes the window event misses: a scrollbar appearing,
  // zoom, or the table view widening the page. Guarded on width so the taller SVG this
  // render produces cannot re-trigger the observer.
  let lastW = 0;
  new ResizeObserver((entries) => {
    const w = entries[0].contentRect.width;
    if (Math.abs(w - lastW) < 0.5) return;
    lastW = w;
    scheduleRender();
  }).observe(document.querySelector('.wrap'));
})();
