/**
 * The Cleveland Fed's median-CPI apparatus, and the BLS pieces needed to rebuild it.
 *
 * WHAT THE BANK PUBLISHES
 *   - median CPI and 16% trimmed-mean CPI, monthly, back to 1983
 *   - a component table: for the LATEST month only, each of its 45 components with that
 *     month's annualised price change and its normalised weight
 *
 * What it does not publish is the distribution behind those numbers over time — the same
 * gap the Dallas Fed leaves on the PCE side. So the history is rebuilt here from the two
 * public inputs the Bank itself uses: BLS item-level CPI, and BLS relative importance.
 *
 * THE COMPONENT SET
 * 45 components, notable for splitting owners' equivalent rent into four census regions.
 * That split is not decoration: OER is about a quarter of the basket, and in a given
 * month the regions can sit in different buckets (July 2026: South 2.1%, West 4.7%), so
 * treating it as one line would drop a quarter of the weight into a single bucket and
 * misstate the spread.
 *
 * TWO PLACES THIS CANNOT MATCH THE BANK EXACTLY
 *   1. Regional OER is published unadjusted only — BLS seasonally adjusts the national
 *      series but not the regional ones, and the Bank adjusts them itself. Using the
 *      unadjusted series costs about 0.15-0.56pp on those four components.
 *   2. Relative importance is published for the U.S. city average, so the regional OER
 *      weights are split out of the national OER weight using the proportions the Bank's
 *      own current table implies, held fixed.
 * Both are reported by the build rather than hidden; check 2 and 3 measure what they cost.
 */

import { readSheet } from './xlsx.mjs';

const CLE = 'https://www.clevelandfed.org/-/media/files/webcharts/mediancpi';
export const COMPONENT_TABLE_URL = `${CLE}/mediancpi_component_table.csv?sc_lang=en`;
export const MEDIAN_URL = `${CLE}/mcpi_revised.csv?sc_lang=en`;
export const TRIM_URL = `${CLE}/trim_revised.csv?sc_lang=en`;
export const SOURCE_PAGE = 'https://www.clevelandfed.org/indicators-and-data/median-cpi';

const BLS_DL = 'https://download.bls.gov/pub/time.series/cu';
export const ITEM_URL = `${BLS_DL}/cu.item`;
export const SERIES_URL = `${BLS_DL}/cu.series`;
/** BLS asks that automated downloads identify themselves with a contact address. */
export const BLS_UA = 'us-underlying-inflation/1.0 (bluespring410@gmail.com)';

/**
 * Weights before 1997 use the item codes of the pre-1998 CPI structure, which would need
 * a crosswalk this build does not carry; 1997 onward is one consistent naming scheme.
 */
export const WEIGHT_START_YEAR = 1997;

/** Component names the Bank writes differently from BLS. */
const ITEM_OVERRIDE = {
  'Misc Personal services': 'SEGD',
  'Household furnishings and operation': 'SAH3',
  'Water, sewer, and trash collection services': 'SEHG',
  'Misc personal goods': 'SEGE',
  'Non-alcoholic beverages and beverage materials': 'SAF114',
  'Watches and jewelry': 'SEAG',
};
const REGION_AREA = { Northeast: '0100', Midwest: '0200', South: '0300', West: '0400' };

/**
 * Relative-importance tables have renamed lines over the years, so a component is looked
 * up under each name it has gone by, newest first. Owners' equivalent rent was published
 * as "...of primary residence" until the 2009 table added the broader "...of residences"
 * above it, and "Energy services" only appears as its own line from 2009 — before that
 * the same concept is the "Gas (piped) and electricity" line.
 */
const WEIGHT_ALIASES = {
  SEHC: ["Owners' equivalent rent of residences", "Owners' equivalent rent of primary residence"],
  SEHF: ['Energy services', 'Gas (piped) and electricity'],
};

export const normName = (s) => String(s)
  .toLowerCase()
  .replace(/\(.*?\)/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/** Minimal CSV line split that honours quoted fields. */
export function splitCsv(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** The Bank's component table: the latest month's rate and weight per component. */
export function parseComponentTable(text) {
  const rows = text.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim()).slice(1);
  const out = rows.map((l) => {
    const c = splitCsv(l);
    return { name: c[0].trim(), rate: Number(c[1]), weight: Number(c[2]) };
  }).filter((r) => r.name && Number.isFinite(r.rate));
  const total = out.reduce((t, r) => t + r.weight, 0);
  if (out.length < 40 || Math.abs(total - 100) > 1) {
    throw new Error(`component table looks wrong: ${out.length} rows, weights sum ${total.toFixed(2)}`);
  }
  return out;
}

/** "1/1/1983,0.0040858,5" -> Map<"1983-01", 5>, reading the annualised column. */
export function parsePublishedSeries(text) {
  const out = new Map();
  for (const raw of text.split('\n').slice(1)) {
    const c = raw.replace(/\r$/, '').split(',');
    if (c.length < 3) continue;
    const [mo, , yr] = c[0].trim().split('/');
    const v = Number(c[2]);
    if (yr && Number.isFinite(v)) out.set(`${yr}-${String(mo).padStart(2, '0')}`, v);
  }
  return out;
}

/** BLS cu.item -> Map<item_code, item_name>. */
export function parseItems(text) {
  const out = new Map();
  for (const line of text.split('\n').slice(1)) {
    const p = line.replace(/\r$/, '').split('\t');
    if (p.length >= 2 && p[0].trim()) out.set(p[0].trim(), p[1].trim());
  }
  return out;
}

/** The set of series ids BLS actually publishes, so a guess can be rejected. */
export function parseSeriesIds(text) {
  const out = new Set();
  for (const line of text.split('\n').slice(1)) {
    const id = line.split('\t')[0].trim();
    if (id) out.add(id);
  }
  return out;
}

/**
 * Resolve each component to a BLS series. Seasonally adjusted where BLS publishes it —
 * which is everything except the regional detail and a few small national items.
 */
export function mapComponents(components, items, seriesIds) {
  const byName = new Map([...items].map(([code, name]) => [normName(name), code]));
  const resolved = [];
  const unmapped = [];
  for (const c of components) {
    const region = Object.keys(REGION_AREA).find((k) => new RegExp(`^${k}\\s*:?`, 'i').test(c.name));
    const base = region ? c.name.replace(/^[A-Za-z]+\s*:?\s*/, '').trim() : c.name;
    const item = ITEM_OVERRIDE[c.name] ?? byName.get(normName(base)) ?? null;
    if (!item) { unmapped.push(c.name); continue; }
    const area = region ? REGION_AREA[region] : '0000';
    const sa = `CUSR${area}${item}`;
    const nsa = `CUUR${area}${item}`;
    const seriesId = seriesIds.has(sa) ? sa : seriesIds.has(nsa) ? nsa : null;
    if (!seriesId) { unmapped.push(`${c.name} (no series for ${item})`); continue; }
    const itemName = items.get(item) ?? base;
    resolved.push({
      ...c,
      item,
      area,
      region: region ?? null,
      seriesId,
      adjusted: seriesId.startsWith('CUSR'),
      itemName,
      weightNames: [...(WEIGHT_ALIASES[item] ?? [itemName]), itemName, base],
    });
  }
  return { resolved, unmapped };
}

/**
 * Relative importance, December of `year`, as Map<normalised item name, percent>.
 *
 * Two published shapes. 1997-2019 is fixed-width text with dot leaders:
 *     Energy services..................    3.588      4.179
 * 2020 onward is a spreadsheet with an indent level, the name, then CPI-U and CPI-W.
 * Both give the CPI-U column, which is the one that matches the Bank's weights.
 */
export function parseWeightsText(text) {
  const out = new Map();
  for (const raw of text.split('\n')) {
    const m = raw.replace(/\r$/, '').match(/^\s*(\S.*?)\.{2,}\s*([\d.]+)\s+([\d.]+)\s*$/);
    if (!m) continue;
    const v = Number(m[2]);
    if (Number.isFinite(v)) out.set(normName(m[1]), v);
  }
  return out;
}

export function parseWeightsXlsx(buf) {
  const rows = readSheet(buf, 'Table 1');
  const out = new Map();
  for (const r of rows) {
    // indent | name | CPI-U | CPI-W — the only rows with a name and two numbers.
    const name = typeof r[1] === 'string' ? r[1].trim() : null;
    const v = typeof r[2] === 'number' ? r[2] : null;
    if (name && v != null) out.set(normName(name), v);
  }
  return out;
}

/**
 * Weight for each component in a given year, normalised to sum to 100 over the set.
 *
 * The national OER weight is divided among the four regions in the proportions the
 * Bank's current table implies. BLS publishes relative importance for the U.S. city
 * average only, so there is no regional figure to use instead; the proportions move
 * slowly, and check 2 measures what the approximation costs.
 */
export function weightsForYear(resolved, ri, oerShares) {
  const raw = [];
  const missing = [];
  for (const c of resolved) {
    let w = null;
    for (const n of c.weightNames) {
      w = ri.get(normName(n));
      if (w != null) break;
    }
    if (w == null) { missing.push(c.name); raw.push({ c, w: null }); continue; }
    if (c.region) w *= oerShares[c.region];
    raw.push({ c, w });
  }
  const total = raw.reduce((t, x) => t + (x.w ?? 0), 0);
  if (!(total > 0)) return { weights: null, missing };
  const weights = new Map(raw.map((x) => [x.c.name, x.w == null ? null : (x.w / total) * 100]));
  return { weights, missing };
}

/** Regional OER proportions implied by the Bank's own current table. */
export function oerSharesFrom(components) {
  const parts = {};
  let total = 0;
  for (const c of components) {
    const region = Object.keys(REGION_AREA).find((k) => new RegExp(`^${k}\\s*:?`, 'i').test(c.name));
    if (!region) continue;
    parts[region] = c.weight;
    total += c.weight;
  }
  if (!(total > 0) || Object.keys(parts).length !== 4) {
    throw new Error('could not read the four regional OER weights from the component table');
  }
  for (const k of Object.keys(parts)) parts[k] /= total;
  return parts;
}

// ---------------------------------------------------------------- statistics

/** Weighted median: the rate at which cumulative weight crosses half. */
export function weightedMedian(pairs) {
  const s = [...pairs].sort((a, b) => a.x - b.x);
  const total = s.reduce((t, p) => t + p.w, 0);
  let acc = 0;
  for (const p of s) {
    acc += p.w;
    if (acc >= total / 2) return p.x;
  }
  return s[s.length - 1]?.x ?? null;
}

/**
 * Symmetric trimmed mean, cutting `pct`% of the weight from each tail. Components that
 * straddle a cut point contribute the part of their weight that survives, which is what
 * keeps the result smooth when one large component sits on the boundary.
 */
export function symmetricTrimmedMean(pairs, pct) {
  const s = [...pairs].sort((a, b) => a.x - b.x);
  const total = s.reduce((t, p) => t + p.w, 0);
  const lo = (pct / 100) * total;
  const hi = total - lo;
  let acc = 0;
  let num = 0;
  let den = 0;
  for (const p of s) {
    const start = acc;
    const end = acc + p.w;
    acc = end;
    const kept = Math.max(0, Math.min(end, hi) - Math.max(start, lo));
    if (kept > 0) { num += kept * p.x; den += kept; }
  }
  return den > 0 ? num / den : null;
}
