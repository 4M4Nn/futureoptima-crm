import ExcelJS from 'exceljs';

// Header text -> normalized field name. Matched case-insensitively, either exact
// or as a substring, so real-world sheets with inconsistent column naming
// ("Particulars", "Paid To", "Txn Date"...) still get picked up.
const HEADER_ALIASES = {
  date: ['date', 'txn date', 'transaction date', 'payment date', 'paid on'],
  name: ['name', 'student', 'student name', 'particulars', 'description', 'vendor', 'paid to', 'details', 'remarks'],
  phone: ['phone', 'mobile', 'contact', 'phone number', 'mobile number'],
  amount: ['amount', 'amt', 'fee', 'fees', 'paid amount', 'total'],
  category: ['category', 'type', 'expense type', 'head'],
  method: ['method', 'payment method', 'mode', 'payment mode'],
  bankAccount: ['bank', 'account', 'bank account', 'received in'],
  course: ['course', 'programme', 'program'],
};

function normalizeHeader(text) {
  const t = String(text ?? '').trim().toLowerCase();
  if (!t) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some(a => t === a || t.includes(a))) return field;
  }
  return null;
}

// Scans the first sheet for a header row (first row with >=2 recognizable columns,
// checked within the first 10 rows to tolerate title rows above the real header),
// then returns every following non-empty row as a plain object keyed by the
// normalized field names above.
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
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const field = normalizeHeader(cell.value);
      if (field && !Object.values(map).includes(field)) map[colNumber] = field;
    });
    if (Object.keys(map).length >= 2) { headerRowIdx = r; colMap = map; break; }
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
      if (value !== null && value !== undefined && value !== '') hasData = true;
      obj[field] = value;
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
