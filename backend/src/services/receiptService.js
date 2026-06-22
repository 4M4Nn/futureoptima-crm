import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const receiptsDir = path.join(__dirname, '../../uploads/receipts');
if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });

function numToWords(n) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function h(x) {
    if (x < 20) return ones[x];
    if (x < 100) return tens[Math.floor(x/10)] + (x%10 ? ' '+ones[x%10] : '');
    if (x < 1000) return ones[Math.floor(x/100)] + ' Hundred' + (x%100 ? ' '+h(x%100) : '');
    if (x < 100000) return h(Math.floor(x/1000)) + ' Thousand' + (x%1000 ? ' '+h(x%1000) : '');
    if (x < 10000000) return h(Math.floor(x/100000)) + ' Lakh' + (x%100000 ? ' '+h(x%100000) : '');
    return h(Math.floor(x/10000000)) + ' Crore' + (x%10000000 ? ' '+h(x%10000000) : '');
  }
  return h(Math.floor(n));
}

export async function generateReceiptPDF(data) {
  const { receiptNumber, studentName, phone, courseName, amount, method, transactionId, paidAt, netFee, paidTotal, balance, collectedBy } = data;
  const filename = `receipt_${receiptNumber.replace(/[^a-z0-9]/gi, '_')}.pdf`;
  const filePath = path.join(receiptsDir, filename);

  const qrBuf = Buffer.from((await QRCode.toDataURL(JSON.stringify({ rcpt: receiptNumber, amt: amount, student: studentName }))).split(',')[1], 'base64');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 30 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.rect(0, 0, doc.page.width, 90).fill('#1B2B6B');
    doc.fillColor('white').fontSize(14).font('Helvetica-Bold').text(process.env.INSTITUTE_NAME || 'Future Optima IT Solutions', 30, 14, { align: 'center' });
    doc.fontSize(8).font('Helvetica').text(process.env.INSTITUTE_ADDRESS || 'Kakkanad, Kochi, Kerala - 682030', 30, 34, { align: 'center' });
    doc.text(`${process.env.INSTITUTE_PHONE || '+91-8891129333'}  |  ${process.env.INSTITUTE_EMAIL || 'info@futureoptimaitsolutions.com'}`, 30, 48, { align: 'center' });
    doc.fillColor('#93C5FD').fontSize(7).text(process.env.INSTITUTE_WEBSITE || 'https://futureoptima.in', 30, 63, { align: 'center' });

    // Title
    doc.fillColor('#1B2B6B').fontSize(13).font('Helvetica-Bold').text('FEE RECEIPT', 30, 105, { align: 'center' });
    doc.moveTo(30, 124).lineTo(doc.page.width - 30, 124).strokeColor('#F59E0B').lineWidth(2).stroke();

    let y = 134;
    const col1 = 30, col2 = doc.page.width / 2 + 5;

    // Meta
    doc.fillColor('#374151').fontSize(9);
    doc.font('Helvetica-Bold').text('Receipt No:', col1, y).font('Helvetica').text(receiptNumber, col1 + 72, y);
    doc.font('Helvetica-Bold').text('Date:', col2, y).font('Helvetica').text(new Date(paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), col2 + 35, y);
    y += 20;

    doc.moveTo(30, y).lineTo(doc.page.width - 30, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke(); y += 8;

    // Student
    doc.fillColor('#1B2B6B').fontSize(9.5).font('Helvetica-Bold').text('STUDENT DETAILS', col1, y); y += 14;
    for (const [l, v] of [['Name', studentName], ['Phone', phone], ['Course', courseName]]) {
      doc.fillColor('#374151').fontSize(8.5).font('Helvetica-Bold').text(`${l}:`, col1, y, { width: 60 });
      doc.font('Helvetica').text(v, col1 + 65, y, { width: doc.page.width - 120 }); y += 14;
    }

    y += 4;
    doc.moveTo(30, y).lineTo(doc.page.width - 30, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke(); y += 8;

    // Payment table
    doc.fillColor('#1B2B6B').fontSize(9.5).font('Helvetica-Bold').text('PAYMENT DETAILS', col1, y); y += 14;
    doc.rect(col1, y, doc.page.width - 60, 14).fill('#1B2B6B');
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold').text('Description', col1 + 4, y + 3).text('Amount (₹)', doc.page.width - 110, y + 3, { width: 75, align: 'right' }); y += 14;

    const rows = [['Total Course Fee', netFee], ['Paid This Transaction', amount], ['Total Paid to Date', paidTotal], ['Balance Due', balance]];
    for (let i = 0; i < rows.length; i++) {
      doc.rect(col1, y, doc.page.width - 60, 13).fill(i % 2 === 0 ? '#F9FAFB' : '#FFFFFF');
      const isBalance = i === 3;
      doc.fillColor(isBalance && balance > 0 ? '#DC2626' : '#374151').fontSize(8).font(i >= 1 ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(rows[i][0], col1 + 4, y + 3).text(rows[i][1].toLocaleString('en-IN'), doc.page.width - 110, y + 3, { width: 75, align: 'right' }); y += 13;
    }
    y += 8;

    doc.fillColor('#374151').fontSize(8);
    doc.font('Helvetica-Bold').text('Payment Mode:', col1, y).font('Helvetica').text(method.replace('_', ' '), col1 + 82, y);
    if (transactionId) { doc.font('Helvetica-Bold').text('Ref:', col2, y).font('Helvetica').text(transactionId, col2 + 25, y); }
    y += 14;
    doc.font('Helvetica-Bold').text('Received By:', col1, y).font('Helvetica').text(collectedBy, col1 + 75, y);

    // QR
    doc.image(qrBuf, doc.page.width - 85, y - 45, { width: 55 });
    doc.fillColor('#9CA3AF').fontSize(6).text('Scan to verify', doc.page.width - 85, y + 12, { width: 55, align: 'center' }); y += 28;

    doc.moveTo(30, y).lineTo(doc.page.width - 30, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke(); y += 6;
    doc.fillColor('#374151').fontSize(8).font('Helvetica-Bold').text('Amount in Words: ', col1, y, { continued: true }).font('Helvetica').text(`${numToWords(amount)} Rupees Only`);
    y += 14;
    doc.fillColor('#9CA3AF').fontSize(7).text('This is a computer-generated receipt and does not require a signature.', 30, y, { align: 'center', width: doc.page.width - 60 });
    y += 11;
    doc.fillColor('#F59E0B').fontSize(8).font('Helvetica-Bold').text('Thank you for choosing Future Optima IT Solutions! 🎓', 30, y, { align: 'center', width: doc.page.width - 60 });

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}
