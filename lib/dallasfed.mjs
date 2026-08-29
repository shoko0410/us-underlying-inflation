/**
 * The two Dallas Fed workbooks behind the trimmed mean, and the small cache both the
 * build and the self-test share.
 *
 *   detail   — republished every month: the live component roster plus, for the latest
 *              published month, each component's annualised price change and
 *              expenditure weight. This is the roster of record; tech.pdf's 178-item
 *              list is from the 2009 revision and is now out of date (177 today, two
 *              housing lines merged, 17 renamed).
 *   pcedata  — the rolling 13-month bucket distribution the Bank charts on its site.
 *              The only place these shares are published, and only ever 13 months of
 *              them, which is the whole reason the history has to be recomputed.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { readSheet, serialToMonth } from './xlsx.mjs';
import { ABOVE_3 } from './trimmed-mean.mjs';

const BASE = 'https://www.dallasfed.org';
const CHART_URL = `${BASE}/-/media/documents/research/pce/pcedata.xlsx`;
const DETAIL_URL = `${BASE}/~/media/documents/research/pce/detail`;
const CHART_SHEET = 'Web - Chart Data';
const DETAIL_SHEET = 'Web - Underlying detail';

/** Transient network/5xx failures shouldn't fail a scheduled run. */
export async function withRetry(label, fn, attempts = 3, log = console.log) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err.fatal || i === attempts) break;
      const wait = 3000 * i;
      log(`  retry ${i}/${attempts - 1} ${label} in ${wait}ms — ${err.message}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

export function makeCache(cacheDir, { fresh = false, log = console.log } = {}) {
  return async function cached(key, producer, { json = true } = {}) {
    await mkdir(cacheDir, { recursive: true });
    const file = path.join(cacheDir, json ? `${key}.json` : key);
    if (!fresh && existsSync(file)) {
      log(`  cache hit  ${key}`);
      return json ? JSON.parse(await readFile(file, 'utf8')) : readFile(file);
    }
    const value = await producer();
    await writeFile(file, json ? JSON.stringify(value) : value);
    log(`  fetched    ${key}`);
    return value;
  };
}

const getXlsx = (cached, key, url) => cached(key, () =>
  withRetry(url, async () => {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }), { json: false });

/**
 * Live component roster with the latest month's annualised price change and weight.
 * Rows are identified by shape — name plus three numbers — rather than by position,
 * because the sheet has a title block above the data whose height has changed before.
 */
export async function fetchDetail(cached) {
  const rows = readSheet(await getXlsx(cached, 'dallas_detail.xlsx', DETAIL_URL), DETAIL_SHEET);
  const components = [];
  for (const r of rows) {
    if (typeof r[0] === 'string' && typeof r[1] === 'number' &&
        typeof r[2] === 'number' && typeof r[3] === 'number') {
      components.push({ name: r[0].trim(), rate: r[1], weight: r[2] });
    }
  }
  if (components.length < 100) {
    throw new Error(`underlying-detail workbook yielded only ${components.length} components`);
  }
  const total = components.reduce((a, c) => a + c.weight, 0);
  if (Math.abs(total - 100) > 0.5) {
    throw new Error(`underlying-detail weights sum to ${total.toFixed(2)}, not 100`);
  }
  return components;
}

/** The published rolling window of bucket shares. */
export async function fetchWindow(cached, normalize) {
  const rows = readSheet(await getXlsx(cached, 'dallas_pcedata.xlsx', CHART_URL), CHART_SHEET);
  // Locate the header by shape, not position: the one row that is mostly date serials.
  const dateRow = rows.find(
    (r) => r.filter((c) => typeof c === 'number' && c > 20000 && c < 80000).length > 6);
  if (!dateRow) throw new Error('no date row found in the Dallas Fed chart data');
  const cols = dateRow.map((c, i) => [i, c]).filter(([, c]) => typeof c === 'number');
  const months = cols.map(([, c]) => serialToMonth(c));

  const labelled = (needle) => {
    const r = rows.find((row) => typeof row[0] === 'string' && normalize(row[0]).includes(needle));
    return r ? cols.map(([i]) => (typeof r[i] === 'number' ? r[i] : null)) : null;
  };
  const bands = {
    b0_2: labelled('rose at 0 2'),
    b2_3: labelled('rose at 2 3'),
    b3_5: labelled('rose at 3 5'),
    b5_10: labelled('rose at 5 10'),
    b10: labelled('rose faster than 10'),
  };
  for (const [k, v] of Object.entries(bands)) {
    if (!v) throw new Error(`Dallas Fed chart data is missing the "${k}" row`);
  }
  // The five published bars only cover components whose prices ROSE — they sum to about
  // 70-80%, not 100. Everything else fell, which is where the sixth band comes from.
  bands.fell = months.map((_, i) =>
    100 - Object.values(bands).reduce((a, arr) => a + (arr[i] ?? 0), 0));
  const above3 = months.map((_, i) => ABOVE_3.reduce((a, k) => a + (bands[k][i] ?? 0), 0));
  return { months, bands, above3 };
}

/**
 * The Dallas Fed and BEA write the same concept differently ("&" vs "and",
 * parenthesised qualifiers, abbreviations). Reducing both to lowercase alphanumeric
 * tokens makes most match exactly; the rest fall through to token-overlap scoring.
 */
export function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/\(\d+\)/g, ' ') // BEA footnote markers
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bexcept\b|\bexcluding\b|\bex\b/g, 'excluding')
    .replace(/\bprods\b/g, 'products')
    .replace(/\binfo\b/g, 'information')
    .replace(/\bnonelectric\b/g, 'non electric')
    .trim()
    .replace(/\s+/g, ' ');
}
