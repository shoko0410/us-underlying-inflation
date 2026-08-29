/**
 * The Dallas Fed's trimmed mean arithmetic, kept separate from the data plumbing so it
 * can be tested against the Fed's own published component detail without touching BEA.
 *
 * Source of truth: "Trimmed Mean PCE Inflation", Dallas Fed Working Paper 0506, and the
 * Matlab file the Bank publishes alongside the series:
 * https://www.dallasfed.org/~/media/documents/research/pce/tmrates.txt
 */

/** Half-open [lo, hi) in annualised percent. Anything below 0 is "prices fell". */
export const BUCKETS = [
  { key: 'fell', lo: -Infinity, hi: 0 },
  { key: 'b0_2', lo: 0, hi: 2 },
  { key: 'b2_3', lo: 2, hi: 3 },
  { key: 'b3_5', lo: 3, hi: 5 },
  { key: 'b5_10', lo: 5, hi: 10 },
  { key: 'b10', lo: 10, hi: Infinity },
];

/** The three buckets the site's headline number adds up. */
export const ABOVE_3 = ['b3_5', 'b5_10', 'b10'];

export const TRIM_LOWER = 24; // percent of weight cut from the bottom tail
export const TRIM_UPPER = 31; // percent of weight cut from the top tail

/** A one-month price change <-> the annual rate it implies if it repeated. */
export const annualise = (monthly) => (Math.pow(1 + monthly, 12) - 1) * 100;
export const deannualise = (annual) => Math.pow(1 + annual / 100, 1 / 12) - 1;

/**
 * Weighted trimmed mean of x, cutting `lt`% of the weight from the bottom of the
 * distribution and `ut`% from the top.
 *
 * A direct port of mytrim from tmrates.txt. The partial weights on the two cut-point
 * components matter: a trim point almost never lands exactly on a component boundary,
 * and owner-occupied housing alone is 11% of PCE, so rounding a straddling component
 * in or out would move the answer materially.
 */
export function trimmedMean(x, prob, lt = TRIM_LOWER, ut = TRIM_UPPER) {
  const order = x.map((_, i) => i).sort((a, b) => x[a] - x[b]);
  const xs = order.map((i) => x[i]);
  const ps = order.map((i) => prob[i]);
  const K = xs.length;

  const c = new Array(K);
  let acc = 0;
  for (let i = 0; i < K; i++) { acc += ps[i]; c[i] = acc; }

  const lo = lt / 100;
  const hi = ut / 100;

  let t1 = c.findIndex((v) => v >= lo);
  if (t1 < 0) t1 = K - 1;
  let t2 = c.findIndex((v) => v >= 1 - hi);
  if (t2 < 0) t2 = K - 1;

  if (t2 - t1 === 0) return xs[t1];
  const cPrev = (i) => (i - 1 >= 0 ? c[i - 1] : 0);
  if (t2 - t1 === 1) {
    return ((c[t1] - lo) * xs[t1] + (1 - hi - cPrev(t2)) * xs[t2]) / (1 - lo - hi);
  }
  let m = (c[t1] - lo) * xs[t1] + (1 - hi - cPrev(t2)) * xs[t2];
  for (let i = t1 + 1; i <= t2 - 1; i++) m += ps[i] * xs[i];
  return m / (1 - lo - hi);
}

/**
 * Share of total weight in each bucket, as percentages.
 * `rates` are annualised percents; `weights` need not be normalised.
 */
export function bucketShares(rates, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  const out = {};
  for (const b of BUCKETS) out[b.key] = 0;
  for (let i = 0; i < rates.length; i++) {
    for (const b of BUCKETS) {
      if (rates[i] >= b.lo && rates[i] < b.hi) { out[b.key] += (weights[i] / total) * 100; break; }
    }
  }
  return out;
}

export const aboveThree = (shares) => ABOVE_3.reduce((a, k) => a + shares[k], 0);

/**
 * The 50/50 average of two expenditure shares that the trimmed mean weights by: current
 * quantity at last month's prices, and last month's quantity at last month's prices.
 * With Q = N/P the second term is just last month's nominal spending.
 * Returns null when the month has no usable components.
 */
export function fisherWeights(pPrev, pNow, nPrev, nNow) {
  const idx = [];
  const dp = [];
  const raw = [];
  let s1 = 0, s2 = 0;
  for (let i = 0; i < pNow.length; i++) {
    const p1 = pPrev[i], p0 = pNow[i], n1 = nPrev[i], n0 = nNow[i];
    if (!(p1 > 0) || !(p0 > 0) || n0 == null || n1 == null) continue;
    const a = (n0 / p0) * p1;
    s1 += a;
    s2 += n1;
    idx.push(i);
    dp.push((p0 - p1) / p1);
    raw.push([a, n1]);
  }
  if (!raw.length || s1 <= 0 || s2 <= 0) return null;
  let sum = 0;
  const w = raw.map(([a, b]) => {
    const x = 0.5 * (a / s1) + 0.5 * (b / s2);
    sum += x;
    return x;
  });
  for (let i = 0; i < w.length; i++) w[i] /= sum;
  return { idx, dp, w };
}

/** Cumulate monthly trimmed rates into an index, then read 12-month inflation off it. */
export function trimmedYoY(monthly) {
  const idx = [100];
  for (const d of monthly) idx.push(idx[idx.length - 1] * (1 + d));
  // idx[k+1] corresponds to monthly[k]; a 12-month rate needs 12 steps back.
  return monthly.map((_, k) =>
    (k < 11 ? null : Math.round((idx[k + 1] / idx[k + 1 - 12] - 1) * 10000) / 100));
}
