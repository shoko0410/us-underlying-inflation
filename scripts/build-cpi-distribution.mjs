/**
 * Rebuilds the CPI-side component-price distribution from BLS source data.
 *
 * WHY THIS EXISTS
 * The distribution card on this site is built on PCE, from BEA underlying detail. CPI is
 * the other price measure people quote, and it is not a relabelling of the same thing:
 * different weights, different coverage, and a shelter share about twice as large. So the
 * spread of price changes across the basket can look quite different depending on which
 * one you ask, and the only way to see that is to build both.
 *
 * The Cleveland Fed occupies the same position on the CPI side that the Dallas Fed does
 * on the PCE side: it publishes measures read off the distribution — a weighted median
 * and a 16% trimmed mean — but not the distribution itself, and only a single month of
 * component detail. So this reconstructs the history from what the Bank uses: BLS
 * item-level CPI and BLS relative importance. See lib/cleveland.mjs for the component
 * set and the two places this cannot match the Bank exactly.
 *
 * VALIDATION LADDER (--verify prints all three)
 *   1. per component, the latest month against the Bank's own component table
 *   2. weighted median against the published series
 *   3. 16% trimmed mean against the published series
 *
 * Checks 2 and 3 are harsher here than the trimmed mean was on the PCE side. With 45
 * components a weighted median is a step function — it returns one component's rate — so
 * a small error in ordering moves the answer by a whole step. Treat them as evidence the
 * inputs are right, not as a claim of identity; the bucket shares this script actually
 * writes are far less sensitive than either.
 *
 * Flags: --fresh (ignore cache) · --verify (report only, write nothing) · --strict
 *        --if-changed (stop early when the Bank's latest month is already covered)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUCKETS, ABOVE_3 } from '../lib/trimmed-mean.mjs';
import { makeCache, withRetry } from '../lib/dallasfed.mjs';
import {
  COMPONENT_TABLE_URL, MEDIAN_URL, TRIM_URL, SOURCE_PAGE,
  ITEM_URL, SERIES_URL, BLS_UA, WEIGHT_START_YEAR,
  parseComponentTable, parsePublishedSeries, parseItems, parseSeriesIds,
  mapComponents, parseWeightsText, parseWeightsXlsx, weightsForYear, oerSharesFrom,
  weightedMedian, symmetricTrimmedMean,
} from '../lib/cleveland.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRESH = process.argv.includes('--fresh');
const VERIFY = process.argv.includes('--verify');
const STRICT = process.argv.includes('--strict');
const IF_CHANGED = process.argv.includes('--if-changed');

const END_YEAR = new Date().getUTCFullYear();
const RI_ARCHIVES = [['2000-2009', 2000, 2009], ['2010-2019', 2010, 2019]];
const RI_TEXT_ONLY = [[1997, 1999]]; // inside the 1990-1999 archive

const log = (...a) => console.log(...a);
const cached = makeCache(path.join(ROOT, 'data', '.cache'), { fresh: FRESH, log });
const round2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const pad = (s, n) => String(s).slice(0, n).padEnd(n);

const getText = (key, url, headers = {}) => cached(key, () =>
  withRetry(url, async () => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }, 3, log), { json: false });

// ---------------------------------------------------------------- BLS series

/**
 * v1 takes 25 series and 10 years per request; a key lifts that to 20 years and moves
 * the quota off the shared runner IP. Either way this is the expensive part of the run,
 * which is what --if-changed exists to avoid on a quiet day.
 */
async function fetchSeries(ids, startYear, apiKey) {
  const version = apiKey ? 'v2' : 'v1';
  const span = apiKey ? 20 : 10;
  const url = `https://api.bls.gov/publicAPI/${version}/timeseries/data/`;
  const out = new Map(ids.map((id) => [id, new Map()]));

  const spans = [];
  for (let y = startYear; y <= END_YEAR; y += span) spans.push([y, Math.min(y + span - 1, END_YEAR)]);
  const batches = [];
  for (let i = 0; i < ids.length; i += 25) batches.push(ids.slice(i, i + 25));
  log(`BLS (${version}) — ${ids.length} series, ${batches.length} batches x ${spans.length} spans`);

  for (const [bi, batch] of batches.entries()) {
    for (const [sy, ey] of spans) {
      const json = await cached(`bls_cpi_${version}_${bi}_${sy}_${ey}`, () =>
        withRetry(`BLS ${sy}-${ey} batch ${bi + 1}`, async () => {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              seriesid: batch,
              startyear: String(sy),
              endyear: String(ey),
              ...(apiKey ? { registrationkey: apiKey } : {}),
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const j = await res.json();
          if (j.status !== 'REQUEST_SUCCEEDED') {
            const e = new Error(`${j.status} ${JSON.stringify(j.message)}`);
            // A daily-threshold refusal will not clear by retrying.
            e.fatal = /threshold|daily/i.test(JSON.stringify(j.message ?? ''));
            throw e;
          }
          return j;
        }, 3, log));

      for (const s of json.Results?.series ?? []) {
        const target = out.get(s.seriesID);
        if (!target) continue;
        for (const d of s.data) {
          if (!/^M(0[1-9]|1[0-2])$/.test(d.period)) continue;
          if (d.value === '-' || d.value === '') continue;
          const v = Number(d.value);
          if (Number.isFinite(v)) target.set(`${d.year}-${d.period.slice(1)}`, v);
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- weights

async function loadWeights() {
  const byYear = new Map();

  // 1997-1999 live in the 1990s archive; 2000-2019 in their own decade archives.
  const zips = [['1990-1999', ...RI_TEXT_ONLY[0]], ...RI_ARCHIVES];
  for (const [name, from, to] of zips) {
    const buf = await getText(`ri_${name}.zip`,
      `https://www.bls.gov/cpi/tables/relative-importance/ri-archive-${name}.zip`, { 'User-Agent': BLS_UA });
    const { unzip } = await import('../lib/xlsx.mjs');
    const files = unzip(buf);
    for (let y = from; y <= to; y++) {
      const hit = [...files.keys()].find((k) => k.toLowerCase().endsWith(`${y}.txt`));
      if (hit) byYear.set(y, parseWeightsText(files.get(hit).toString('utf8')));
    }
  }

  for (let y = 2020; y <= END_YEAR; y++) {
    try {
      const buf = await getText(`ri_${y}.xlsx`,
        `https://www.bls.gov/cpi/tables/relative-importance/${y}.xlsx`, { 'User-Agent': BLS_UA });
      byYear.set(y, parseWeightsXlsx(buf));
    } catch (err) {
      // The current year's table appears partway through the year; until then the
      // previous year's weights are the ones in force anyway.
      log(`  ! ${y} weights unavailable (${err.message})`);
    }
  }
  return byYear;
}

/**
 * BLS restates relative importance each December for the following year, so the weights
 * in force during a month are the ones published for that month's year. Before the first
 * table, and after the last, the nearest one carries.
 */
function weightsFor(byYear, year) {
  if (byYear.has(year)) return byYear.get(year);
  const years = [...byYear.keys()].sort((a, b) => a - b);
  if (!years.length) return null;
  if (year < years[0]) return byYear.get(years[0]);
  return byYear.get(years[years.length - 1]);
}

// ---------------------------------------------------------------- main

async function main() {
  const env = { ...(await loadEnv()), ...process.env };

  log('Cleveland Fed reference data:');
  const components = parseComponentTable(
    (await getText('cle_component_table.csv', COMPONENT_TABLE_URL)).toString('utf8'));
  const pubMedian = parsePublishedSeries((await getText('cle_mcpi.csv', MEDIAN_URL)).toString('utf8'));
  const pubTrim = parsePublishedSeries((await getText('cle_trim.csv', TRIM_URL)).toString('utf8'));
  const pubMonths = [...pubMedian.keys()].sort();
  const pubLast = pubMonths[pubMonths.length - 1];
  log(`  components    ${components.length}, weights sum ${components.reduce((t, c) => t + c.weight, 0).toFixed(1)}%`);
  log(`  published     ${pubMonths[0]} … ${pubLast} (median & 16% trim)`);

  const outPath = path.join(ROOT, 'data', 'cpi-distribution.json');
  if (IF_CHANGED && existsSync(outPath)) {
    try {
      const prev = JSON.parse(await readFile(outPath, 'utf8'));
      if (prev.source?.publishedLast === pubLast && prev.months?.length) {
        log('');
        log(`--if-changed: the Bank still ends at ${pubLast} and data/cpi-distribution.json` +
            ' already covers it — skipping the BLS rebuild.');
        return;
      }
      log(`  the published window moved past ${prev.source?.publishedLast ?? '?'}; rebuilding`);
    } catch {
      log('  previous build unreadable; rebuilding');
    }
  }

  log('');
  log('BLS reference:');
  const items = parseItems((await getText('bls_cu.item', ITEM_URL, { 'User-Agent': BLS_UA })).toString('utf8'));
  const seriesIds = parseSeriesIds(
    (await getText('bls_cu.series', SERIES_URL, { 'User-Agent': BLS_UA })).toString('utf8'));
  const { resolved, unmapped } = mapComponents(components, items, seriesIds);
  log(`  mapping       ${resolved.length}/${components.length} components`);
  if (unmapped.length) for (const u of unmapped) log(`    UNMAPPED  ${u}`);
  const unadjusted = resolved.filter((c) => !c.adjusted);
  log(`  unadjusted    ${unadjusted.length} (BLS publishes no seasonally adjusted series):`);
  for (const c of unadjusted) log(`    ${pad(c.name, 48)} ${c.seriesId}`);

  log('');
  const raw = await fetchSeries(resolved.map((c) => c.seriesId), WEIGHT_START_YEAR, env.BLS_API_KEY);

  log('');
  log('BLS relative importance:');
  const weightsByYear = await loadWeights();
  log(`  years         ${[...weightsByYear.keys()].sort((a, b) => a - b).join(', ')}`);
  const oerShares = oerSharesFrom(components);
  log(`  OER split     ` + Object.entries(oerShares)
    .map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`).join(' · '));

  // --- monthly axis and per-month annualised rates
  const monthSet = new Set();
  for (const m of raw.values()) for (const k of m.keys()) monthSet.add(k);
  const months = [...monthSet].sort();
  const prevOf = new Map(months.map((m, i) => [m, months[i - 1]]));

  const annualised = new Map(); // month -> [{name, x, w}]
  // Gaps are tracked per weight-year, not as one pile: an early table that never named a
  // component tells you nothing about whether today's does, and those months simply drop
  // out. What would matter is a gap in the year currently in force.
  const weightGaps = new Map();
  for (const m of months) {
    const back = prevOf.get(m);
    if (!back) continue;
    const ri = weightsFor(weightsByYear, Number(m.slice(0, 4)));
    if (!ri) continue;
    const year = Number(m.slice(0, 4));
    const { weights, missing } = weightsForYear(resolved, ri, oerShares);
    if (missing.length) weightGaps.set(year, missing);
    if (!weights) continue;
    const pairs = [];
    for (const c of resolved) {
      const v = raw.get(c.seriesId);
      const a = v?.get(m);
      const b = v?.get(back);
      const w = weights.get(c.name);
      if (a == null || b == null || w == null || !(b > 0)) continue;
      pairs.push({ name: c.name, x: (Math.pow(a / b, 12) - 1) * 100, w });
    }
    if (pairs.length >= 40) annualised.set(m, pairs);
  }
  const covered = [...annualised.keys()].sort();
  log('');
  log(`computed      ${covered.length} months, ${covered[0]} … ${covered[covered.length - 1]}`);
  for (const [year, miss] of [...weightGaps].sort((a, b) => a[0] - b[0])) {
    log(`  ! ${year} weights name no line for: ${miss.join(', ')}`);
  }
  const latestYear = Number(covered[covered.length - 1].slice(0, 4));
  const latestGaps = weightGaps.get(latestYear) ?? [];

  // --- check 1: the Bank's own component table, latest month
  let compDev = null;
  {
    // The component table carries no date; it is the Bank's latest published month,
    // which is the last month of the median series. Comparing it against our own last
    // month would pit July's published figures against August's BLS data.
    const target = annualised.has(pubLast) ? pubLast : covered[covered.length - 1];
    const mine = new Map(annualised.get(target).map((p) => [p.name, p.x]));
    const rows = [];
    for (const c of components) {
      const v = mine.get(c.name);
      if (v != null) rows.push({ name: c.name, pub: c.rate, mine: v, d: v - c.rate });
    }
    const abs = rows.map((r) => Math.abs(r.d));
    compDev = {
      n: rows.length,
      mean: round2(abs.reduce((a, b) => a + b, 0) / abs.length),
      max: round2(Math.max(...abs)),
      month: target,
    };
    log('');
    log(`check 1       per component, ${target}, vs the Bank's own table`);
    log(`  deviation   mean ${compDev.mean}pp · max ${compDev.max}pp over ${compDev.n} components`);
    rows.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
    for (const r of rows.slice(0, 5)) {
      log(`    ${pad(r.name, 46)} 공표 ${r.pub.toFixed(2).padStart(8)}  계산 ${r.mine.toFixed(2).padStart(8)}  ${r.d.toFixed(2).padStart(7)}`);
    }
  }

  // --- checks 2 and 3: the published median and trimmed mean
  const compare = (published, fn, label) => {
    const pairs = [];
    for (const m of covered) {
      const p = published.get(m);
      if (p == null) continue;
      const mine = fn(annualised.get(m));
      if (mine == null) continue;
      pairs.push(Math.abs(mine - p));
    }
    if (!pairs.length) return null;
    const dev = {
      n: pairs.length,
      mean: round2(pairs.reduce((a, b) => a + b, 0) / pairs.length),
      max: round2(Math.max(...pairs)),
    };
    log('');
    log(`${label}  mean |dev| ${dev.mean}pp · max ${dev.max}pp over ${dev.n} months`);
    return dev;
  };
  const medDev = compare(pubMedian, weightedMedian, 'check 2       median vs published:     ');
  const trimDev = compare(pubTrim, (p) => symmetricTrimmedMean(p, 16), 'check 3       16% trim vs published:  ');

  // --- the distribution itself
  const bands = {};
  for (const b of BUCKETS) bands[b.key] = [];
  const above3 = [];
  for (const m of covered) {
    const shares = {};
    for (const b of BUCKETS) shares[b.key] = 0;
    const total = annualised.get(m).reduce((t, p) => t + p.w, 0);
    for (const p of annualised.get(m)) {
      for (const b of BUCKETS) {
        if (p.x >= b.lo && p.x < b.hi) { shares[b.key] += (p.w / total) * 100; break; }
      }
    }
    for (const b of BUCKETS) bands[b.key].push(round2(shares[b.key]));
    above3.push(round2(ABOVE_3.reduce((a, k) => a + shares[k], 0)));
  }

  // --- gates
  const problems = [];
  if (unmapped.length) problems.push(`${unmapped.length} components could not be mapped`);
  if (!covered.length) problems.push('no months could be computed');
  if (STRICT) {
    if (latestGaps.length) {
      problems.push(`${latestYear} weights name no line for: ${latestGaps.join(', ')}`);
    }
    if (!compDev || compDev.mean > 0.5) {
      problems.push(`component deviation ${compDev?.mean ?? '?'}pp exceeds the 0.5pp tolerance`);
    }
    if (!medDev || medDev.mean > 0.6) {
      problems.push(`median deviation ${medDev?.mean ?? '?'}pp exceeds the 0.6pp tolerance`);
    }
  }
  if (problems.length) {
    throw new Error('refusing to write a distribution that failed its checks\n  - ' +
      problems.join('\n  - '));
  }

  if (VERIFY) {
    log('');
    log('--verify: checks only, nothing written.');
    return;
  }

  const payload = {
    months: covered,
    bands,
    above3,
    source: {
      components: { source: 'Cleveland Fed', url: SOURCE_PAGE, count: resolved.length },
      prices: { source: 'BLS', dataset: 'CPI-U item level', adjusted: resolved.length - unadjusted.length },
      weights: { source: 'BLS', dataset: 'relative importance', from: WEIGHT_START_YEAR },
      firstMonth: covered[0],
      publishedLast: pubLast,
      oerShares,
    },
    method: {
      buckets: BUCKETS.map((b) => b.key),
      unadjustedComponents: unadjusted.map((c) => c.name),
    },
    validation: {
      componentsMatched: resolved.length,
      componentMeanDev: compDev?.mean ?? null,
      componentMaxDev: compDev?.max ?? null,
      medianMeanDev: medDev?.mean ?? null,
      medianMaxDev: medDev?.max ?? null,
      trimMeanDev: trimDev?.mean ?? null,
      trimMaxDev: trimDev?.max ?? null,
    },
  };

  await mkdir(path.join(ROOT, 'data'), { recursive: true });
  await writeFile(outPath, JSON.stringify(payload, null, 2));
  log('');
  log(`written       data/cpi-distribution.json (${covered.length} months)`);
  log(`latest        above 3% = ${above3[above3.length - 1]}%`);
}

async function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of (await readFile(file, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
