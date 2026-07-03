import ExcelJS from 'exceljs';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2B6B' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };
const ROW_FILL_EVEN = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
const ROW_FILL_ODD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
const THIN_BORDER = { style: 'thin', color: { argb: 'FFD1D5DB' } };
const CELL_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
const INR_FORMAT = '₹#,##0.00';

export function newWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Future Optima IT Solutions';
  wb.created = new Date();
  return wb;
}

/**
 * Adds a tabular sheet with bold headers, borders on every cell, alternating
 * row colors, auto-fit-ish column widths, and per-column number formats.
 *
 * columns: [{ header, key, width?, money?: bool, text?: bool }]
 * rows: array of plain objects keyed by column.key
 */
export function addTableSheet(workbook, sheetName, columns, rows) {
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

  sheet.columns = columns.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(12, c.header.length + 4),
  }));

  const headerRow = sheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = CELL_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  headerRow.height = 20;

  rows.forEach((rowData, i) => {
    const row = sheet.addRow(rowData);
    row.eachCell((cell, colNumber) => {
      cell.border = CELL_BORDER;
      cell.fill = i % 2 === 0 ? ROW_FILL_ODD : ROW_FILL_EVEN;
      const col = columns[colNumber - 1];
      if (col?.money) cell.numFmt = INR_FORMAT;
      if (col?.text) cell.numFmt = '@';
    });
  });

  return sheet;
}

export function addTotalsRow(sheet, columns, totals) {
  const row = sheet.addRow(totals);
  row.eachCell((cell, colNumber) => {
    cell.border = CELL_BORDER;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    const col = columns[colNumber - 1];
    if (col?.money) cell.numFmt = INR_FORMAT;
  });
  return row;
}

export function toTextCell(value) {
  return value === null || value === undefined || value === '' ? '' : String(value);
}

export function sendWorkbook(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return workbook.xlsx.write(res).then(() => res.end());
}

export { INR_FORMAT };
