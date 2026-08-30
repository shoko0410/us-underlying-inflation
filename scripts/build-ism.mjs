/**
 * Builds the ISM manufacturing PMI series for the local-only chart.
 *
 * WHY THIS IS SEPARATE FROM EVERYTHING ELSE
 * ISM licenses its data. That is why FRED dropped NAPM and why there is no free,
 * current source for it. This script therefore writes to data/ism.json and
 * public/ism.js, both of which are gitignored — the published site never carries the
 * series, and index.html loads it only if the file happens to be sitting there.
 *
 * WHERE THE NUMBERS COME FROM
 *   1948-01 … 2014-08   forecasts.org, which embeds the whole series in its page
 *   1959-01 … 2016-04   St. Louis Fed FRED-MD, vintage 2016-05 — the last vintage that
 *                       still carried NAPM; the June 2016 vintage dropped it. This is
 *                       an official Fed research dataset, published free.
 *   2016-05 …           NOT AVAILABLE for free. See below.
 *
 * The two overlap over 668 months and agree to a mean absolute difference of 0.04
 * points, so FRED-MD is used wherever it exists and forecasts.org only extends the
 * start back to 1948. The check runs on every build and fails loudly if they diverge.
 *
 * THE LAST DECADE
 * Nothing free and accurate was found for 2016-05 onward:
 *   - DBnomics ISM/pmi/pm starts 2020-05 and currently returns impossible values
 *     (PMI 10-11 for late 2025, against an all-time low of 29.4)
 *   - MacroMicro gates export behind a paid plan
 *   - forecasts.org stops in 2014
 * So the script reads an optional data/ism-recent.csv if you have the numbers from
 * somewhere you are entitled to use. Two columns, header row, month first:
 *
 *     month,pmi
 *     2016-05,51.3
 *     2016-06,53.2
 *
 * Anything in that file wins over the two sources above, so it can also correct them.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { unzip } from '../lib/xlsx.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'data', '.cache');
const VINTAGE_ZIP = path.join(CACHE, 'fredmd-vintages.zip');
const VINTAGE = '2016-05.csv'; // the last one carrying NAPM
const RECENT_CSV = path.join(ROOT, 'data', 'ism-recent.csv');
const FORECASTS_HTML = path.join(CACHE, 'forecasts-napm.html');
const FORECASTS_URL = 'https://www.forecasts.org/data/data/NAPM.htm';

const log = (...a) => console.log(...a);

/** FRED-MD dates are m/d/yyyy with a two-digit year in the older vintages. */
function fredMdMonth(cell) {
  const [mm, , yy] = cell.split('/');
  let y = Number(yy);
  if (y < 100) y += y > 50 ? 1900 : 2000;
  return `${y}-${String(Number(mm)).padStart(2, '0')}`;
}

/** Minimal CSV row split — these files have no quoted commas. */
const rows = (text) => text.split(/\r?\n/).map((l) => l.split(',')).filter((r) => r[0]?.trim());

async function fromVintage() {
  if (!existsSync(VINTAGE_ZIP)) {
    throw new Error(
      `${path.relative(ROOT, VINTAGE_ZIP)} is missing.\n` +
      '  Download "Historical Vintages of FRED-MD 2015-01 to 2025-12" from\n' +
      '  https://www.stlouisfed.org/research/economists/mccracken/fred-databases\n' +
      '  and save it there. The site blocks command-line downloads, so fetch it in a browser.');
  }
  const files = unzip(await readFile(VINTAGE_ZIP));
  const csv = files.get(VINTAGE);
  if (!csv) throw new Error(`${VINTAGE} not found inside the vintage archive`);

  const r = rows(csv.toString('utf8'));
  const head = r[0].map((h) => h.trim());
  const iPmi = head.indexOf('NAPM');
  const iPrices = head.indexOf('NAPMPRI');
  if (iPmi < 0) throw new Error(`the ${VINTAGE} vintage has no NAPM column`);

  const out = new Map();
  // Row 1 is the transform codes, not data.
  for (const line of r.slice(2)) {
    if (!line[0].includes('/')) continue;
    const pmi = Number(line[iPmi]);
    const prices = iPrices >= 0 ? Number(line[iPrices]) : NaN;
    if (!Number.isFinite(pmi)) continue;
    out.set(fredMdMonth(line[0]), {
      pmi,
      prices: Number.isFinite(prices) ? prices : null,
    });
  }
  return out;
}

async function fromForecasts() {
  let html;
  if (existsSync(FORECASTS_HTML)) {
    html = await readFile(FORECASTS_HTML, 'utf8');
    log('  cache hit  forecasts.org');
  } else {
    const res = await fetch(FORECASTS_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`forecasts.org HTTP ${res.status}`);
    html = await res.text();
    await mkdir(CACHE, { recursive: true });
    await writeFile(FORECASTS_HTML, html);
    log('  fetched    forecasts.org');
  }
  // The page hands the whole series to Google Charts as a literal array.
  const out = new Map();
  for (const m of html.matchAll(/\['(\d{4})-(\d{2})-\d{2}',\s*([\d.]+)\]/g)) {
    out.set(`${m[1]}-${m[2]}`, Number(m[3]));
  }
  if (out.size < 500) throw new Error(`forecasts.org yielded only ${out.size} months`);
  return out;
}

async function fromRecentCsv() {
  if (!existsSync(RECENT_CSV)) return new Map();
  const out = new Map();
  for (const line of rows(await readFile(RECENT_CSV, 'utf8')).slice(1)) {
    const month = line[0].trim();
    const pmi = Number(line[1]);
    if (/^\d{4}-\d{2}$/.test(month) && Number.isFinite(pmi)) out.set(month, pmi);
  }
  return out;
}

const monthRange = (first, last) => {
  const out = [];
  let [y, m] = first.split('-').map(Number);
  const [ey, em] = last.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m === 12 ? ((m = 1), y++) : m++;
  }
  return out;
};

async function main() {
  log('ISM manufacturing PMI — local only, never committed');
  const vintage = await fromVintage();
  const forecasts = await fromForecasts();
  const recent = await fromRecentCsv();
  log(`  FRED-MD ${VINTAGE}  ${vintage.size} months`);
  log(`  forecasts.org      ${forecasts.size} months`);
  log(`  ism-recent.csv     ${recent.size} months` + (recent.size ? '' : '  (absent)'));

  // --- cross-check the two free sources where they overlap
  const shared = [...vintage.keys()].filter((k) => forecasts.has(k));
  const devs = shared.map((k) => Math.abs(vintage.get(k).pmi - forecasts.get(k)));
  const mean = devs.reduce((a, b) => a + b, 0) / (devs.length || 1);
  const max = devs.length ? Math.max(...devs) : 0;
  log('');
  log(`  overlap            ${shared.length} months, mean |dev| ${mean.toFixed(3)}, max ${max.toFixed(2)}`);
  // Revisions and annual seasonal-factor updates move a handful of months by a point or
  // so; a mean above this would mean the two are not the same series any more.
  if (shared.length && mean > 0.25) {
    throw new Error(`the two sources disagree by ${mean.toFixed(2)} on average — check both`);
  }

  // --- assemble. FRED-MD is the spine; forecasts.org only extends the start; the
  //     local CSV overrides everything, since it is the only current source.
  const months = monthRange(
    [...forecasts.keys(), ...vintage.keys()].sort()[0],
    [...vintage.keys(), ...recent.keys()].sort().at(-1));

  const pmi = [];
  const prices = [];
  const source = [];
  for (const m of months) {
    if (recent.has(m)) {
      pmi.push(recent.get(m)); prices.push(null); source.push('local');
    } else if (vintage.has(m)) {
      const v = vintage.get(m);
      pmi.push(v.pmi); prices.push(v.prices); source.push('fred-md');
    } else if (forecasts.has(m)) {
      pmi.push(forecasts.get(m)); prices.push(null); source.push('forecasts.org');
    } else {
      pmi.push(null); prices.push(null); source.push(null);
    }
  }

  const counts = source.reduce((a, s) => (s ? { ...a, [s]: (a[s] ?? 0) + 1 } : a), {});
  const lastReal = months[pmi.findLastIndex((v) => v != null)];

  const payload = {
    months,
    pmi,
    prices,
    firstMonth: months[0],
    lastMonth: lastReal,
    counts,
    note: 'ISM is licensed; this file is gitignored and never published.',
    sources: {
      'fred-md': `St. Louis Fed FRED-MD, vintage ${VINTAGE} (last carrying NAPM)`,
      'forecasts.org': FORECASTS_URL,
      local: 'data/ism-recent.csv',
    },
    overlapCheck: { months: shared.length, meanAbsDev: Number(mean.toFixed(3)) },
  };

  await mkdir(path.join(ROOT, 'data'), { recursive: true });
  await writeFile(path.join(ROOT, 'data', 'ism.json'), JSON.stringify(payload, null, 2));
  await writeFile(path.join(ROOT, 'public', 'ism.js'), `window.ISM_DATA = ${JSON.stringify(payload)};\n`);

  log('');
  log(`  months             ${months[0]} … ${lastReal}  (${months.length})`);
  log(`  by source          ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  log(`  latest PMI         ${pmi[months.indexOf(lastReal)]}`);
  if (!recent.size) {
    log('');
    log('  ! the series stops in 2016 — no free current source exists.');
    log('    Drop a data/ism-recent.csv (month,pmi) to extend it.');
  }
  log('');
  log('  written            data/ism.json, public/ism.js  (both gitignored)');
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
