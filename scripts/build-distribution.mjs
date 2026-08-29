/**
 * Reconstructs the Dallas Fed's component-price distribution from BEA source data.
 *
 * WHY THIS EXISTS
 * The Dallas Fed publishes the distribution behind the trimmed mean — what share of
 * PCE, by expenditure weight, rose 0-2%, 2-3%, 3-5%, 5-10%, or faster than 10% in a
 * given month — but only as a rolling 13-month window in one spreadsheet
 * (pcedata.xlsx). There is no historical file, and the Wayback Machine has never
 * captured that spreadsheet, so older windows cannot be recovered. To show the share
 * above 3% over the full history it has to be recomputed from the same inputs.
 *
 * METHOD (Dallas Fed WP 0506; the published tmrates.txt Matlab file is the spec)
 * The arithmetic lives in lib/trimmed-mean.mjs and is verified independently of this
 * script by `npm run selftest`, which reproduces the Bank's own published figures from
 * its own component detail. What THIS script adds is the part that cannot be checked
 * that way: pulling ~180 monthly component price and spending series out of BEA and
 * lining them up with the Dallas Fed's roster.
 *
 * So when the numbers below disagree with the published ones and the self-test passes,
 * the fault is in the mapping, not the maths.
 *
 * VALIDATION LADDER (--verify prints all three)
 *   1. per component, this month's weight and price change vs the Dallas Fed's own
 *      underlying-detail workbook — exact, and it names any component that is wrong
 *   2. buckets vs the 13 months the Dallas Fed publishes
 *   3. trimmed mean vs FRED PCETRIM12M159SFRBDAL over the whole history
 *
 * Flags: --fresh (ignore cache) · --verify (report only, write nothing) · --strict
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUCKETS, ABOVE_3, TRIM_LOWER, TRIM_UPPER,
  trimmedMean, annualise, fisherWeights, trimmedYoY,
} from '../lib/trimmed-mean.mjs';
import { makeCache, fetchDetail, fetchWindow, normalize, withRetry } from '../lib/dallasfed.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRESH = process.argv.includes('--fresh');
const VERIFY = process.argv.includes('--verify');
const STRICT = process.argv.includes('--strict');

const PRICE_TABLE = 'U20404'; // BEA 2.4.4U — price indexes by type of product
const NOMINAL_TABLE = 'U20405'; // BEA 2.4.5U — expenditures by type of product
const START_YEAR = 1977; // the finest disaggregation the Dallas Fed uses starts here
const END_YEAR = new Date().getUTCFullYear();

/**
 * The breadth chart asks a different question from the distribution above it: not "how
 * were this month's price changes spread out" but "how much of the basket has been
 * running hot for a year". So it is a 12-month change, not an annualised 1-month one,
 * and it is reported two ways — by count of components and by their share of spending.
 * The gap between those two lines is the interesting part: weighted above unweighted
 * means the big-ticket components are the hot ones.
 */
const BREADTH_THRESHOLD = 3; // percent, year over year

const log = (...a) => console.log(...a);
const cached = makeCache(path.join(ROOT, 'data', '.cache'), { fresh: FRESH, log });
const round2 = (x) => Math.round(x * 100) / 100;
const pad = (s, n) => String(s).slice(0, n).padEnd(n);

// ---------------------------------------------------------------- utilities

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

const STOP = new Set(['and', 'the', 'for', 'other', 'of', 'to', 'excluding']);
const tokens = (s) => new Set(normalize(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w)));

function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  return (2 * hit) / (A.size + B.size);
}

const deviation = (pairs) => {
  if (!pairs.length) return null;
  const abs = pairs.map(([a, b]) => Math.abs(a - b));
  return {
    n: pairs.length,
    mean: round2(abs.reduce((a, b) => a + b, 0) / abs.length),
    max: round2(Math.max(...abs)),
  };
};

// ---------------------------------------------------------------- BEA

/**
 * BEA caps a single response, and monthly underlying detail is ~180 lines x 12 months
 * per year, so this asks a decade at a time. The Year parameter takes a comma list.
 */
async function fetchBEA(table, apiKey) {
  const byLine = new Map(); // LineNumber -> { desc, values: Map<"YYYY-MM", number> }

  for (let y0 = START_YEAR; y0 <= END_YEAR; y0 += 10) {
    const years = [];
    for (let y = y0; y <= Math.min(y0 + 9, END_YEAR); y++) years.push(y);

    const json = await cached(`bea_${table}_${years[0]}_${years[years.length - 1]}`, () =>
      withRetry(`BEA ${table} ${years[0]}-${years[years.length - 1]}`, async () => {
        const url = 'https://apps.bea.gov/api/data/?' + new URLSearchParams({
          UserID: apiKey,
          method: 'GetData',
          datasetname: 'NIUnderlyingDetail',
          TableName: table,
          Frequency: 'M',
          Year: years.join(','),
          ResultFormat: 'JSON',
        });
        const res = await fetch(url);
        const j = await res.json();
        const err = j?.BEAAPI?.Results?.Error ?? j?.BEAAPI?.Error;
        if (err) {
          const e = new Error(`BEA ${table}: ${err.APIErrorDescription ?? JSON.stringify(err)}`);
          // An unregistered or unactivated key will never start working mid-run.
          e.fatal = /not active|Invalid API UserId/i.test(e.message);
          throw e;
        }
        return j;
      }, 3, log));

    for (const row of json?.BEAAPI?.Results?.Data ?? []) {
      const m = String(row.TimePeriod).match(/^(\d{4})M(\d{2})$/);
      if (!m) continue;
      const value = Number(String(row.DataValue).replace(/,/g, ''));
      if (!Number.isFinite(value)) continue;
      const line = Number(row.LineNumber);
      if (!byLine.has(line)) {
        byLine.set(line, { desc: String(row.LineDescription).trim(), values: new Map() });
      }
      byLine.get(line).values.set(`${m[1]}-${m[2]}`, value);
    }
  }
  return byLine;
}

// ---------------------------------------------------------------- mapping

/**
 * Resolve the Dallas Fed roster onto BEA line numbers.
 *
 * BEA's underlying-detail tables interleave aggregates with the leaf lines the trimmed
 * mean uses, and BEA renumbers lines at comprehensive revisions, so the mapping is
 * resolved by name every run rather than hard-coded. lib/bea-mapping.json, if present,
 * overrides the automatic result for named components — the escape hatch for anything
 * the matcher gets wrong, reported separately so an override never hides silently.
 */
async function mapComponents(roster, priceLines, nominalLines) {
  const overridePath = path.join(ROOT, 'lib', 'bea-mapping.json');
  const overrides = existsSync(overridePath)
    ? (JSON.parse(await readFile(overridePath, 'utf8')).byName ?? {})
    : {};

  // Only lines present in BOTH tables can produce a weight, so that is the pool. Same
  // line number, same concept — the two tables are parallel by construction.
  const candidates = [];
  for (const [line, p] of priceLines) {
    if (nominalLines.has(line)) candidates.push({ line, desc: p.desc });
  }

  const byNorm = new Map();
  for (const c of candidates) {
    const k = normalize(c.desc);
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k).push(c);
  }

  const used = new Set();
  const resolved = [];
  const unmatched = [];
  const fuzzy = [];
  const overridden = [];

  for (const comp of roster) {
    if (overrides[comp.name] != null) {
      const line = Number(overrides[comp.name]);
      const c = candidates.find((x) => x.line === line);
      if (c) {
        resolved.push({ ...comp, line, beaDesc: c.desc });
        used.add(line);
        overridden.push(`${comp.name} -> line ${line} (${c.desc})`);
        continue;
      }
      log(`  ! override for "${comp.name}" names line ${line}, absent from one of the tables`);
    }

    const exact = (byNorm.get(normalize(comp.name)) ?? []).filter((c) => !used.has(c.line));
    if (exact.length) {
      resolved.push({ ...comp, line: exact[0].line, beaDesc: exact[0].desc });
      used.add(exact[0].line);
      continue;
    }

    let best = null;
    for (const c of candidates) {
      if (used.has(c.line)) continue;
      const score = similarity(comp.name, c.desc);
      if (!best || score > best.score) best = { c, score };
    }
    // Below this the "match" is coincidental token overlap, not the same concept.
    if (best && best.score >= 0.6) {
      resolved.push({ ...comp, line: best.c.line, beaDesc: best.c.desc });
      used.add(best.c.line);
      fuzzy.push({ name: comp.name, desc: best.c.desc, score: best.score, line: best.c.line });
    } else {
      unmatched.push({ comp, best });
    }
  }

  return { resolved, unmatched, fuzzy, overridden, candidateCount: candidates.length };
}

// ---------------------------------------------------------------- the calculation

function computeMonthly(months, P, N) {
  const out = { months: [], bands: {}, above3: [], trimMonthly: [], panels: new Map() };
  for (const b of BUCKETS) out.bands[b.key] = [];

  for (let t = 1; t < months.length; t++) {
    const panel = fisherWeights(P[t - 1], P[t], N[t - 1], N[t]);
    if (!panel || panel.idx.length < 50) continue; // an incomplete month

    const shares = {};
    for (const b of BUCKETS) shares[b.key] = 0;
    for (let k = 0; k < panel.dp.length; k++) {
      const ann = annualise(panel.dp[k]);
      for (const b of BUCKETS) {
        if (ann >= b.lo && ann < b.hi) { shares[b.key] += panel.w[k] * 100; break; }
      }
    }

    out.months.push(months[t]);
    for (const b of BUCKETS) out.bands[b.key].push(round2(shares[b.key]));
    out.above3.push(round2(ABOVE_3.reduce((a, k) => a + shares[k], 0)));
    out.trimMonthly.push(trimmedMean(panel.dp, panel.w, TRIM_LOWER, TRIM_UPPER));
    out.panels.set(months[t], panel);
  }
  return out;
}

/**
 * Share of components whose 12-month price change exceeds the threshold, counted two
 * ways. The weighted line uses each component's current-month nominal spending, which
 * is the plain "share of what people actually spend" reading; the unweighted line
 * treats every component as one vote regardless of size.
 */
function computeBreadth(months, P, N, targetMonths) {
  const idx = new Map(months.map((m, i) => [m, i]));
  const weighted = [];
  const unweighted = [];
  for (const m of targetMonths) {
    const t = idx.get(m);
    const back = t == null ? -1 : t - 12;
    if (back < 0) { weighted.push(null); unweighted.push(null); continue; }
    let wAbove = 0, wTotal = 0, nAbove = 0, nTotal = 0;
    for (let i = 0; i < P[t].length; i++) {
      const p0 = P[t][i], p1 = P[back][i], spend = N[t][i];
      if (!(p0 > 0) || !(p1 > 0) || spend == null) continue;
      const yoy = (p0 / p1 - 1) * 100;
      nTotal++;
      wTotal += spend;
      if (yoy > BREADTH_THRESHOLD) { nAbove++; wAbove += spend; }
    }
    if (nTotal < 50 || wTotal <= 0) { weighted.push(null); unweighted.push(null); continue; }
    weighted.push(round2((wAbove / wTotal) * 100));
    unweighted.push(round2((nAbove / nTotal) * 100));
  }
  return { weighted, unweighted };
}

async function fetchFredTrimmed(apiKey) {
  const json = await cached('fred_PCETRIM12M159SFRBDAL', () =>
    withRetry('FRED trimmed mean', async () => {
      const res = await fetch('https://api.stlouisfed.org/fred/series/observations' +
        `?series_id=PCETRIM12M159SFRBDAL&api_key=${apiKey}&file_type=json`);
      const j = await res.json();
      if (j.error_message) throw Object.assign(new Error(j.error_message), { fatal: true });
      return j;
    }, 3, log));
  const out = new Map();
  for (const o of json.observations ?? []) {
    if (o.value === '.') continue;
    out.set(o.date.slice(0, 7), Number(o.value));
  }
  return out;
}

// ---------------------------------------------------------------- main

async function main() {
  const env = { ...(await loadEnv()), ...process.env };
  const beaKey = env.BEA_API_KEY;
  if (!beaKey) {
    throw new Error(
      'BEA_API_KEY is not set. Get a free key at https://apps.bea.gov/API/signup/, click the ' +
      'activation link in the confirmation mail, and put the key in .env.');
  }

  log('Dallas Fed reference data:');
  let roster;
  let rosterSource = 'Dallas Fed underlying-detail workbook (live)';
  try {
    roster = await fetchDetail(cached);
    log(`  roster        ${roster.length} components, weights sum to ` +
        `${roster.reduce((a, c) => a + c.weight, 0).toFixed(2)}%`);
  } catch (err) {
    log(`  ! live roster unavailable (${err.message}); falling back to tech.pdf`);
    roster = JSON.parse(await readFile(
      path.join(ROOT, 'lib', 'dallasfed-components.json'), 'utf8')).components
      .map((c) => ({ name: c.name, weight: c.weight, rate: null }));
    rosterSource = 'tech.pdf (2009 revision) — fallback';
  }

  const published = await fetchWindow(cached, normalize);
  const publishedLast = published.months[published.months.length - 1];
  log(`  published     ${published.months[0]} … ${publishedLast} (${published.months.length} months)`);

  log('');
  log(`BEA underlying detail — ${PRICE_TABLE} (prices) and ${NOMINAL_TABLE} (expenditures):`);
  const priceLines = await fetchBEA(PRICE_TABLE, beaKey);
  const nominalLines = await fetchBEA(NOMINAL_TABLE, beaKey);
  log(`  lines         ${priceLines.size} priced · ${nominalLines.size} nominal`);

  const map = await mapComponents(roster, priceLines, nominalLines);
  log('');
  log(`mapping       ${map.resolved.length}/${roster.length} components resolved ` +
      `from ${map.candidateCount} shared BEA lines`);
  for (const o of map.overridden) log(`  override    ${o}`);
  if (map.fuzzy.length) {
    log(`  fuzzy       ${map.fuzzy.length} matched on token overlap — check these:`);
    for (const f of map.fuzzy) {
      log(`    ${pad(f.name, 44)} ~= ${pad(f.desc, 44)} ${f.score.toFixed(2)} (line ${f.line})`);
    }
  }
  if (map.unmatched.length) {
    log(`  UNMATCHED   ${map.unmatched.length}:`);
    for (const u of map.unmatched) {
      log(`    ${pad(u.comp.name, 50)}` +
          (u.best ? ` closest: ${pad(u.best.c.desc, 44)} ${u.best.score.toFixed(2)}` : ''));
    }
  }

  // --- monthly matrices, in roster order
  const monthSet = new Set();
  for (const c of map.resolved) for (const m of priceLines.get(c.line).values.keys()) monthSet.add(m);
  const months = [...monthSet].sort();
  const P = months.map(() => []);
  const N = months.map(() => []);
  for (const c of map.resolved) {
    const p = priceLines.get(c.line).values;
    const n = nominalLines.get(c.line).values;
    months.forEach((m, t) => {
      P[t].push(p.get(m) ?? null);
      N[t].push(n.get(m) ?? null);
    });
  }

  const computed = computeMonthly(months, P, N);
  if (!computed.months.length) throw new Error('no months could be computed from the BEA data');
  log('');
  log(`computed      ${computed.months.length} months, ` +
      `${computed.months[0]} … ${computed.months[computed.months.length - 1]}`);

  const breadth = computeBreadth(months, P, N, computed.months);
  const lastB = breadth.weighted.length - 1;
  log(`breadth       ${BREADTH_THRESHOLD}% YoY — weighted ${breadth.weighted[lastB]}%` +
      ` · unweighted ${breadth.unweighted[lastB]}%`);

  // --- check 1: per-component weight and price change, against the published month
  let compDev = null;
  const panel = computed.panels.get(publishedLast);
  if (panel && roster[0]?.rate != null) {
    const wPairs = [];
    const rPairs = [];
    const rows = [];
    for (let k = 0; k < panel.idx.length; k++) {
      const comp = map.resolved[panel.idx[k]];
      const mineW = panel.w[k] * 100;
      const mineR = annualise(panel.dp[k]);
      wPairs.push([mineW, comp.weight]);
      rPairs.push([mineR, comp.rate]);
      rows.push({ name: comp.name, bea: comp.beaDesc, dw: mineW - comp.weight, dr: mineR - comp.rate });
    }
    compDev = { weight: deviation(wPairs), rate: deviation(rPairs) };
    log('');
    log(`check 1       per component, ${publishedLast}, vs the Dallas Fed's own detail file`);
    log(`  weight      mean |dev| ${compDev.weight.mean}pp · max ${compDev.weight.max}pp` +
        ` over ${compDev.weight.n} components`);
    log(`  price chg   mean |dev| ${compDev.rate.mean}pp · max ${compDev.rate.max}pp`);
    rows.sort((a, b) => Math.abs(b.dr) - Math.abs(a.dr));
    const bad = rows.filter((x) => Math.abs(x.dr) > 1).slice(0, 15);
    if (bad.length) {
      log(`  ${bad.length} component(s) off by more than 1pp — the usual sign of a bad match:`);
      for (const b of bad) {
        log(`    ${pad(b.name, 42)} dRate ${b.dr.toFixed(2).padStart(9)}` +
            ` dWeight ${b.dw.toFixed(3).padStart(8)}  BEA: ${b.bea}`);
      }
    }
  } else {
    log('');
    log('check 1       skipped — no live roster with per-component values');
  }

  // --- check 2: the published window
  const byMonth = new Map(computed.months.map((m, i) => [m, i]));
  const pairs = [];
  for (let k = 0; k < published.months.length; k++) {
    const i = byMonth.get(published.months[k]);
    if (i != null) pairs.push([computed.above3[i], published.above3[k]]);
  }
  const bucketDev = deviation(pairs);
  log('');
  log('check 2       above-3% share vs the published window');
  if (bucketDev) {
    log(`  deviation   mean ${bucketDev.mean}pp · max ${bucketDev.max}pp over ${bucketDev.n} months`);
    for (let k = 0; k < published.months.length; k++) {
      const i = byMonth.get(published.months[k]);
      if (i == null) continue;
      log(`    ${published.months[k]}   published ${published.above3[k].toFixed(1).padStart(5)}` +
          `   rebuilt ${computed.above3[i].toFixed(1).padStart(5)}`);
    }
  } else {
    log('  ! no overlap between the rebuilt months and the published window');
  }

  // --- check 3: the trimmed mean itself
  let trimDev = null;
  const mine = trimmedYoY(computed.trimMonthly);
  if (env.FRED_API_KEY) {
    try {
      const fred = await fetchFredTrimmed(env.FRED_API_KEY);
      const tp = [];
      computed.months.forEach((m, i) => {
        const a = mine[i], b = fred.get(m);
        if (a != null && b != null) tp.push([a, b]);
      });
      trimDev = deviation(tp);
      log('');
      log('check 3       rebuilt trimmed mean vs FRED PCETRIM12M159SFRBDAL');
      log(`  deviation   mean ${trimDev.mean}pp · max ${trimDev.max}pp over ${trimDev.n} months`);
      const tail = computed.months.length - 1;
      log(`  latest      rebuilt ${mine[tail]}%  ·  published ${fred.get(computed.months[tail])}%`);
    } catch (err) {
      log(`  ! trimmed-mean cross-check skipped: ${err.message}`);
    }
  }

  // --- gates
  const problems = [];
  if (map.unmatched.length) {
    problems.push(`${map.unmatched.length} components could not be mapped to a BEA line`);
  }
  if (STRICT) {
    if (!bucketDev) problems.push('the published window could not be compared against');
    else if (bucketDev.mean > 2) {
      problems.push(`above-3% mean deviation ${bucketDev.mean}pp exceeds the 2pp tolerance`);
    }
    if (trimDev && trimDev.mean > 0.5) {
      problems.push(`trimmed-mean mean deviation ${trimDev.mean}pp exceeds the 0.5pp tolerance`);
    }
    if (compDev && compDev.weight.max > 0.5) {
      problems.push(`a component weight is off by ${compDev.weight.max}pp — check the mapping`);
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
    months: computed.months,
    bands: Object.fromEntries(BUCKETS.map((b) => [b.key, computed.bands[b.key]])),
    above3: computed.above3,
    breadth: {
      threshold: BREADTH_THRESHOLD,
      basis: 'yoy',
      weighted: breadth.weighted,
      unweighted: breadth.unweighted,
    },
    source: {
      prices: { source: 'BEA', dataset: 'NIUnderlyingDetail', table: PRICE_TABLE, alias: '2.4.4U' },
      nominal: { source: 'BEA', dataset: 'NIUnderlyingDetail', table: NOMINAL_TABLE, alias: '2.4.5U' },
      roster: rosterSource,
      method: 'Federal Reserve Bank of Dallas WP 0506 / tmrates.txt',
      publishedWindow: { first: published.months[0], last: publishedLast },
    },
    method: {
      components: map.resolved.length,
      trimLower: TRIM_LOWER,
      trimUpper: TRIM_UPPER,
      buckets: BUCKETS.map((b) => b.key),
    },
    validation: {
      componentsMatched: map.resolved.length,
      componentsExpected: roster.length,
      fuzzyMatches: map.fuzzy.length,
      componentWeightMaxDev: compDev?.weight.max ?? null,
      componentRateMaxDev: compDev?.rate.max ?? null,
      meanAbsDev: bucketDev?.mean ?? null,
      maxAbsDev: bucketDev?.max ?? null,
      trimMeanAbsDev: trimDev?.mean ?? null,
      trimMaxAbsDev: trimDev?.max ?? null,
    },
  };

  await mkdir(path.join(ROOT, 'data'), { recursive: true });
  await writeFile(path.join(ROOT, 'data', 'distribution.json'), JSON.stringify(payload, null, 2));
  log('');
  log(`written       data/distribution.json (${computed.months.length} months)`);
  log(`latest        above 3% = ${computed.above3[computed.above3.length - 1]}%`);
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
