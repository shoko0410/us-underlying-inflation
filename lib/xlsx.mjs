/**
 * Minimal .xlsx reader — just enough to pull a named sheet out of the Dallas Fed's
 * chart-data workbook, with no dependencies.
 *
 * An .xlsx is a ZIP of XML, and Node already ships the hard part: zlib can inflate a
 * raw deflate stream. So this walks the ZIP central directory by hand, inflates the
 * three entries a sheet needs (workbook, rels, sharedStrings, the sheet itself), and
 * parses the handful of XML shapes those files actually use. It deliberately does not
 * try to be a general xlsx library: no styles, no formulas, no ZIP64, no encryption.
 * The workbook it reads is 7 rows by 14 columns.
 */

import { inflateRawSync } from 'node:zlib';

// ---------------------------------------------------------------- ZIP

const SIG_EOCD = 0x06054b50;
const SIG_CDIR = 0x02014b50;

/** Map<name, Buffer> of every entry in the archive. */
export function unzip(buf) {
  // The end-of-central-directory record sits at the tail, after a comment of unknown
  // length, so it has to be found by scanning backwards for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip file: no end-of-central-directory record');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== SIG_CDIR) throw new Error(`corrupt central directory at ${p}`);
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    // The local header repeats the name and extra field, and its extra field length
    // can differ from the central directory's — always read it from the local header.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(start, start + compSize);

    out.set(name, method === 0 ? raw : inflateRawSync(raw));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// ---------------------------------------------------------------- XML

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) =>
  s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (m, e) => {
    if (e[0] === '#') {
      return String.fromCodePoint(e[1] === 'x' || e[1] === 'X'
        ? parseInt(e.slice(2), 16)
        : parseInt(e.slice(1), 10));
    }
    return ENTITIES[e] ?? m;
  });

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? decode(m[1]) : null;
};

/** Shared strings, including the rich-text form where one string is several runs. */
function sharedStrings(files) {
  const xml = files.get('xl/sharedStrings.xml');
  if (!xml) return [];
  const text = xml.toString('utf8');
  const out = [];
  for (const m of text.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let s = '';
    for (const t of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) s += decode(t[1]);
    out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------- sheets

/** "B3" -> {col: 1, row: 2}, both zero-based. */
function cellRef(ref) {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, row: Number(m[2]) - 1 };
}

/**
 * Excel serial -> Date (UTC). Day 1 is 1900-01-01, but Excel also believes 1900 was a
 * leap year, which puts the epoch at 1899-12-30 for every date after February 1900 —
 * everything this reader will ever see.
 */
export const serialToDate = (n) => new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
export const serialToMonth = (n) => {
  const d = serialToDate(n);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/**
 * Read one sheet by its display name into a dense array of rows. Cells hold a string,
 * a number, or null; the caller decides what a number means (a date serial looks like
 * any other number without reading the style table, which this does not do).
 */
export function readSheet(buf, sheetName) {
  const files = unzip(buf);

  const workbook = files.get('xl/workbook.xml')?.toString('utf8');
  if (!workbook) throw new Error('not an xlsx file: xl/workbook.xml is missing');

  let rid = null;
  const names = [];
  for (const m of workbook.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const name = attr(m[0], 'name');
    names.push(name);
    if (name === sheetName) rid = attr(m[0], 'r:id');
  }
  if (!rid) {
    throw new Error(`sheet "${sheetName}" not found — workbook has: ${names.join(', ')}`);
  }

  const rels = files.get('xl/_rels/workbook.xml.rels')?.toString('utf8') ?? '';
  let target = null;
  for (const m of rels.matchAll(/<Relationship\b[^>]*\/?>/g)) {
    if (attr(m[0], 'Id') === rid) target = attr(m[0], 'Target');
  }
  if (!target) throw new Error(`no relationship for ${rid}`);
  const path = target.startsWith('/')
    ? target.slice(1)
    : 'xl/' + target.replace(/^\.\//, '');

  const sheet = files.get(path)?.toString('utf8');
  if (!sheet) throw new Error(`sheet part ${path} is missing from the archive`);

  const strings = sharedStrings(files);
  const rows = [];
  for (const rm of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowIdx = Number(attr('<row ' + rm[1] + '>', 'r') ?? rows.length + 1) - 1;
    const cells = [];
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = '<c ' + cm[1] + '>';
      const ref = attr(tag, 'r');
      const type = attr(tag, 't');
      const body = cm[2] ?? '';
      const at = ref ? cellRef(ref) : null;
      const col = at ? at.col : cells.length;

      let value = null;
      if (type === 'inlineStr') {
        let s = '';
        for (const t of body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) s += decode(t[1]);
        value = s;
      } else {
        const v = body.match(/<v>([\s\S]*?)<\/v>/);
        if (v) {
          const raw = decode(v[1]);
          if (type === 's') value = strings[Number(raw)] ?? null;
          else if (type === 'str' || type === 'e') value = raw;
          else {
            const n = Number(raw);
            value = Number.isFinite(n) ? n : raw;
          }
        }
      }
      cells[col] = value;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = null;
    rows[rowIdx] = cells;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}
