/**
 * Checks the trimmed-mean arithmetic against the Dallas Fed's own published figures,
 * using only the Bank's two workbooks and FRED. No BEA key needed.
 *
 * This isolates the two things that can go wrong in the reconstruction. If this passes
 * but scripts/build-distribution.mjs disagrees with the published numbers, the fault is
 * in the BEA component mapping, not in the maths — which is a much smaller place to
 * look.
 *
 * The Bank's "underlying detail" workbook publishes, for the latest month, every
 * component's annualised price change and its expenditure weight. That is exactly the
 * input the bucket shares and the trimmed mean are computed from, so both can be
 * reproduced and compared against what the Bank itself reports for that month.
 */

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  BUCKETS, TRIM_LOWER, TRIM_UPPER,
  trimmedMean, bucketShares, aboveThree, annualise, deannualise,
} from '../lib/trimmed-mean.mjs';
import { makeCache, fetchDetail, fetchWindow, normalize, withRetry } from '../lib/dallasfed.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRESH = process.argv.includes('--fresh');
const cached = makeCache(path.join(ROOT, 'data', '.cache'), { fresh: FRESH });

const log = (...a) => console.log(...a);
const fmt = (x, w = 6, d = 2) => x.toFixed(d).padStart(w);

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

async function fredLatest(seriesId, apiKey) {
  const json = await cached(`fred_${seriesId}`, () =>
    withRetry(`FRED ${seriesId}`, async () => {
      const res = await fetch('https://api.stlouisfed.org/fred/series/observations' +
        `?series_id=${seriesId}&api_key=${apiKey}&file_type=json`);
      const j = await res.json();
      if (j.error_message) throw Object.assign(new Error(j.error_message), { fatal: true });
      return j;
    }));
  const obs = (json.observations ?? []).filter((o) => o.value !== '.');
  const last = obs[obs.length - 1];
  return { month: last.date.slice(0, 7), value: Number(last.value) };
}

async function main() {
  const env = { ...(await loadEnv()), ...process.env };
  const failures = [];

  log('Dallas Fed workbooks:');
  const detail = await fetchDetail(cached);
  const window = await fetchWindow(cached, normalize);
  const last = window.months[window.months.length - 1];
  log(`  roster        ${detail.length} components, weights sum to ` +
      `${detail.reduce((a, c) => a + c.weight, 0).toFixed(3)}%`);
  log(`  window        ${window.months[0]} … ${last}`);
  log('');

  const rates = detail.map((c) => c.rate);
  const weights = detail.map((c) => c.weight);

  // ---- 1. bucket edges
  log(`1. bucket shares for ${last}, recomputed from the component detail`);
  const mine = bucketShares(rates, weights);
  let worst = 0;
  for (const b of BUCKETS) {
    const pub = window.bands[b.key][window.months.length - 1];
    const dev = Math.abs(mine[b.key] - pub);
    worst = Math.max(worst, dev);
    log(`   ${b.key.padEnd(6)} computed ${fmt(mine[b.key])}   published ${fmt(pub)}` +
        `   dev ${fmt(dev, 5)}`);
  }
  const a3 = aboveThree(mine);
  const a3pub = window.above3[window.months.length - 1];
  log(`   above 3%  computed ${fmt(a3)}   published ${fmt(a3pub)}` +
      `   dev ${fmt(Math.abs(a3 - a3pub), 5)}`);
  // The published bars are rounded before they reach the spreadsheet, so a few
  // hundredths of a point is expected; anything approaching a full point is not.
  if (worst > 0.5) failures.push(`bucket share deviates by ${worst.toFixed(2)}pp`);
  log(`   -> ${worst <= 0.5 ? 'PASS' : 'FAIL'} (worst band ${worst.toFixed(2)}pp)`);
  log('');

  // ---- 2. the trim itself
  log(`2. trimmed mean for ${last}, ${TRIM_LOWER}% off the bottom / ${TRIM_UPPER}% off the top`);
  // The workbook reports annualised changes; the trim runs on the monthly changes those
  // imply, and the result is annualised back for comparison.
  const monthly = rates.map(deannualise);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const probs = weights.map((w) => w / totalW);
  const trimmedAnn = annualise(trimmedMean(monthly, probs, TRIM_LOWER, TRIM_UPPER));

  if (env.FRED_API_KEY) {
    const pub = await fredLatest('PCETRIM1M158SFRBDAL', env.FRED_API_KEY);
    const dev = Math.abs(trimmedAnn - pub.value);
    log(`   computed ${fmt(trimmedAnn)}   published ${fmt(pub.value)} (${pub.month})` +
        `   dev ${fmt(dev, 5)}`);
    if (pub.month !== last) {
      log(`   ! the detail workbook is for ${last} but FRED's latest is ${pub.month}`);
    }
    // The Bank rounds the component detail it publishes, so the inputs here are not
    // quite the ones it trimmed; a few hundredths is the expected residue.
    if (dev > 0.15) failures.push(`trimmed mean deviates by ${dev.toFixed(3)}pp`);
    log(`   -> ${dev <= 0.15 ? 'PASS' : 'FAIL'}`);
  } else {
    log(`   computed ${fmt(trimmedAnn)}   (set FRED_API_KEY to compare against the published value)`);
  }
  log('');

  // ---- 3. the trim points land where the Bank says they do
  log('3. trim points');
  const order = rates.map((_, i) => i).sort((a, b) => rates[a] - rates[b]);
  let acc = 0;
  let lowCut = null, highCut = null;
  for (const i of order) {
    acc += probs[i] * 100;
    if (lowCut === null && acc >= TRIM_LOWER) lowCut = { name: detail[i].name, rate: rates[i], acc };
    if (highCut === null && acc >= 100 - TRIM_UPPER) {
      highCut = { name: detail[i].name, rate: rates[i], acc };
    }
  }
  log(`   bottom ${TRIM_LOWER}% ends at  ${lowCut.name} (${lowCut.rate.toFixed(2)}%, cum ${lowCut.acc.toFixed(2)}%)`);
  log(`   top ${TRIM_UPPER}% starts at  ${highCut.name} (${highCut.rate.toFixed(2)}%, cum ${highCut.acc.toFixed(2)}%)`);
  log(`   the trimmed mean must sit between those two rates: ` +
      `${lowCut.rate.toFixed(2)} <= ${trimmedAnn.toFixed(2)} <= ${highCut.rate.toFixed(2)}`);
  const bracketed = trimmedAnn >= lowCut.rate && trimmedAnn <= highCut.rate;
  if (!bracketed) failures.push('the trimmed mean falls outside its own trim points');
  log(`   -> ${bracketed ? 'PASS' : 'FAIL'}`);
  log('');

  if (failures.length) {
    console.error('FAILED:\n  - ' + failures.join('\n  - '));
    process.exit(1);
  }
  log('all checks passed — the arithmetic reproduces the Dallas Fed\'s published figures.');
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
