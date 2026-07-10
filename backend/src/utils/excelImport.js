import ExcelJS from 'exceljs';

// Header text -> normalized field name. Matched case-insensitively, either exact
// or as a substring, so real-world sheets with inconsistent column naming
// ("Particulars", "Paid To", "Txn Date"...) still get picked up.
//
// Text-ish columns (particulars/description/vendor/details/remarks/name) all map
// into the *same* `name` field but are concatenated rather than overwriting each
// other — bank-statement-style sheets often have both a "Particulars" AND a
// "Remarks" column on the same row, and losing one to the other silently drops
// real data (e.g. a name that's only in Remarks).
//
// Credit and Debit are kept as separate fields from a plain "Amount" column,
// since bank-statement exports have both and only one is populated per row
// (money in vs money out) — the caller picks whichever side it cares about.
const TEXT_FIELD_ALIASES = ['name', 'student', 'student name', 'particulars', 'description', 'vendor', 'paid to', 'details', 'remarks', 'narration'];
const HEADER_ALIASES = {
  date: ['date', 'txn date', 'transaction date', 'payment date', 'paid on', 'value date'],
  name: TEXT_FIELD_ALIASES,
  phone: ['phone', 'mobile', 'contact', 'phone number', 'mobile number'],
  credit: ['credit', 'credit amount', 'deposit'],
  debit: ['debit', 'debit amount', 'withdrawal'],
  amount: ['amount', 'amt', 'fee', 'fees', 'paid amount', 'total'],
  balance: ['balance', 'running balance', 'closing balance'],
  category: ['category', 'type', 'expense type', 'head'],
  method: ['method', 'payment method', 'mode', 'payment mode'],
  bankAccount: ['bank', 'account', 'bank account', 'received in'],
  course: ['course', 'programme', 'program'],
};

// Longer/more specific aliases must win over shorter ones that could also match
// (e.g. "credit amount" should map to `credit`, not the generic `amount`).
const FIELD_ORDER = Object.entries(HEADER_ALIASES).sort((a, b) => {
  const maxLen = (arr) => Math.max(...arr.map(s => s.length));
  return maxLen(b[1]) - maxLen(a[1]);
});

function normalizeHeader(text) {
  const t = String(text ?? '').trim().toLowerCase();
  if (!t) return null;
  for (const [field, aliases] of FIELD_ORDER) {
    if (aliases.some(a => t === a || t.includes(a))) return field;
  }
  return null;
}

// Scans the first sheet for a header row (first row with >=2 recognizable columns,
// checked within the first 10 rows to tolerate title rows above the real header),
// then returns every following non-empty row as a plain object keyed by the
// normalized field names above. Multiple columns mapping to `name` are joined
// with " | " instead of overwriting each other.
export async function parseWorkbookRows(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  let headerRowIdx = null;
  let colMap = {};
  for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
    const row = sheet.getRow(r);
    const map = {};
    const seenFields = new Set();
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const field = normalizeHeader(cell.value);
      if (field && !(field !== 'name' && seenFields.has(field))) { map[colNumber] = field; seenFields.add(field); }
    });
    if (new Set(Object.values(map)).size >= 2) { headerRowIdx = r; colMap = map; break; }
  }
  if (!headerRowIdx) return [];

  const rows = [];
  for (let r = headerRowIdx + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (row.cellCount === 0) continue;
    const obj = {};
    let hasData = false;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const field = colMap[colNumber];
      if (!field) return;
      let value = cell.value;
      if (value && typeof value === 'object' && 'result' in value) value = value.result; // formula cell
      if (value === null || value === undefined || value === '') return;
      hasData = true;
      if (field === 'name' && obj.name) {
        obj.name = `${obj.name} | ${value}`;
      } else {
        obj[field] = value;
      }
    });
    if (hasData) rows.push(obj);
  }
  return rows;
}

export function toAmount(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    // Excel serial date (days since 1899-12-30)
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
