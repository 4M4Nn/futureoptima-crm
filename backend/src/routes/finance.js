import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const slipsDir = path.join(__dirname, '../../uploads/salary-slips');
if (!fs.existsSync(slipsDir)) fs.mkdirSync(slipsDir, { recursive: true });

const router = express.Router();
router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'));

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// GET /api/finance/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [todayAgg, weekAgg, monthAgg, yearAgg, monthExpenses, pendingFees, recentPayments, pendingInstallments, overdueInstallments] = await Promise.all([
      prisma.payment.aggregate({ where: { paidAt: { gte: today } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: weekStart } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: yearStart } }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { date: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.enrollment.aggregate({ where: { balanceDue: { gt: 0 } }, _sum: { balanceDue: true } }),
      prisma.payment.findMany({
        take: 10,
        orderBy: { paidAt: 'desc' },
        include: {
          enrollment: { include: { lead: { select: { name: true, phone: true } }, course: { select: { shortName: true } } } },
          collectedBy: { select: { name: true } },
        },
      }),
      prisma.installment.count({ where: { status: 'DUE' } }),
      prisma.installment.count({ where: { status: 'OVERDUE' } }),
    ]);

    const monthCollection = monthAgg._sum.amount || 0;
    const monthExpAmt = monthExpenses._sum.amount || 0;

    res.json({
      todayCollection: todayAgg._sum.amount || 0,
      weekCollection: weekAgg._sum.amount || 0,
      monthCollection,
      yearCollection: yearAgg._sum.amount || 0,
      monthExpenses: monthExpAmt,
      netProfit: monthCollection - monthExpAmt,
      pendingFees: pendingFees._sum.balanceDue || 0,
      pendingInstallments,
      overdueInstallments,
      recentTransactions: recentPayments,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/collections
router.get('/collections', async (req, res) => {
  try {
    const { from, to, courseId, counselorId } = req.query;
    const where = {};
    if (from || to) {
      where.paidAt = {};
      if (from) where.paidAt.gte = new Date(from);
      if (to) where.paidAt.lte = new Date(to + 'T23:59:59');
    }
    if (counselorId) where.collectedById = counselorId;
    if (courseId) {
      where.enrollment = { courseId };
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        include: {
          enrollment: {
            include: {
              lead: { select: { name: true, phone: true } },
              course: { select: { shortName: true, name: true } },
            },
          },
          collectedBy: { select: { name: true } },
        },
      }),
      prisma.payment.aggregate({ where, _sum: { amount: true }, _count: { id: true } }),
    ]);

    res.json({
      data: payments,
      totalAmount: total._sum.amount || 0,
      totalCount: total._count.id || 0,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/finance/expenses
router.post('/expenses', [
  body('category').notEmpty(),
  body('amount').isFloat({ min: 0.01 }),
  body('date').isISO8601(),
  body('paymentMethod').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { category, amount, date, paymentMethod, vendor, notes } = req.body;
    const expense = await prisma.expense.create({
      data: { category, amount: parseFloat(amount), date: new Date(date), paymentMethod, vendor, notes, addedById: req.user.id },
      include: { addedBy: { select: { name: true } } },
    });
    res.status(201).json(expense);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/expenses
router.get('/expenses', async (req, res) => {
  try {
    const { from, to, category } = req.query;
    const where = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to + 'T23:59:59');
    }
    if (category) where.category = category;

    const [expenses, byCategory, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        include: { addedBy: { select: { name: true } } },
      }),
      prisma.expense.groupBy({ by: ['category'], where, _sum: { amount: true }, _count: { id: true } }),
      prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    res.json({ data: expenses, byCategory, totalAmount: total._sum.amount || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/finance/salary
router.post('/salary', [
  body('employeeName').notEmpty().withMessage('employeeName is required'),
  body('month').isInt({ min: 1, max: 12 }),
  body('year').isInt({ min: 2020 }),
  body('basicSalary').isFloat({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { userId, employeeName, designation, department, isExternalEmployee, month, year, basicSalary, bonus = 0, deductions = 0, paymentStatus, paymentDate, paymentMethod, notes } = req.body;

    const basic = parseFloat(basicSalary);
    const bonusAmt = parseFloat(bonus) || 0;
    const deductAmt = parseFloat(deductions) || 0;
    const netSalary = basic + bonusAmt - deductAmt;

    const record = await prisma.salaryRecord.create({
      data: {
        userId: isExternalEmployee ? null : (userId || null),
        employeeName,
        designation: designation || null,
        department: department || null,
        isExternalEmployee: Boolean(isExternalEmployee),
        month: parseInt(month),
        year: parseInt(year),
        basicSalary: basic,
        bonus: bonusAmt,
        deductions: deductAmt,
        netSalary,
        paymentStatus: paymentStatus || 'PENDING',
        paymentDate: paymentDate ? new Date(paymentDate) : null,
        paymentMethod: paymentMethod || null,
        notes: notes || null,
      },
      include: { user: { select: { name: true, email: true, role: true } } },
    });
    res.status(201).json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/salary
router.get('/salary', async (req, res) => {
  try {
    const { month, year, userId } = req.query;
    const where = {};
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);
    if (userId) where.userId = userId;

    const [records, total] = await Promise.all([
      prisma.salaryRecord.findMany({
        where,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        include: { user: { select: { name: true, email: true, role: true, phone: true } } },
      }),
      prisma.salaryRecord.aggregate({ where, _sum: { netSalary: true } }),
    ]);

    const data = records.map(r => ({
      ...r,
      employeeName: r.employeeName,
      designation: r.designation,
      department: r.department,
      isExternalEmployee: r.isExternalEmployee,
    }));

    res.json({ data, totalPayroll: total._sum.netSalary || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/salary/:id/slip
router.get('/salary/:id/slip', async (req, res) => {
  try {
    const record = await prisma.salaryRecord.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { name: true, email: true, role: true, phone: true } } },
    });
    if (!record) return res.status(404).json({ error: 'Salary record not found' });

    const filename = `slip_${record.id}.pdf`;
    const filePath = path.join(slipsDir, filename);

    if (!fs.existsSync(filePath)) {
      await generateSalarySlipPDF(record, filePath);
    }

    await prisma.salaryRecord.update({ where: { id: record.id }, data: { slipGenerated: true } });

    const safeName = record.employeeName.replace(/\s+/g, '-');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SalarySlip_${safeName}_${MONTH_NAMES[record.month-1]}_${record.year}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/reports/pl
router.get('/reports/pl', async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.paidAt = {};
      where.date = {};
      if (from) { where.paidAt.gte = new Date(from); where.date.gte = new Date(from); }
      if (to) { where.paidAt.lte = new Date(to + 'T23:59:59'); where.date.lte = new Date(to + 'T23:59:59'); }
    }

    const [incomeAgg, expenseAgg, expenseByCategory, monthlyIncome] = await Promise.all([
      prisma.payment.aggregate({ where: from || to ? { paidAt: where.paidAt } : {}, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: from || to ? { date: where.date } : {}, _sum: { amount: true } }),
      prisma.expense.groupBy({ by: ['category'], where: from || to ? { date: where.date } : {}, _sum: { amount: true } }),
      prisma.payment.groupBy({
        by: [],
        where: from || to ? { paidAt: where.paidAt } : {},
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = incomeAgg._sum.amount || 0;
    const totalExpenses = expenseAgg._sum.amount || 0;

    res.json({
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      expenseBreakdown: expenseByCategory,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/reports/pending-fees
router.get('/reports/pending-fees', async (req, res) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { balanceDue: { gt: 0 } },
      orderBy: { balanceDue: 'desc' },
      include: {
        lead: { select: { name: true, phone: true } },
        course: { select: { shortName: true } },
      },
    });

    const data = enrollments.map(e => ({
      id: e.id,
      name: e.lead.name,
      phone: e.lead.phone,
      course: e.course.shortName,
      enrolledAt: e.enrolledAt,
      totalFee: e.netFee,
      paid: e.paidAmount,
      balance: e.balanceDue,
      paymentStatus: e.paymentStatus,
    }));

    const total = data.reduce((s, r) => s + r.balance, 0);
    res.json({ data, totalPending: total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/ai-insights
router.get('/ai-insights', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [monthCollection, monthExpenses, pendingFees, overdueCount, topExpenses] = await Promise.all([
      prisma.payment.aggregate({ where: { paidAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { date: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.enrollment.aggregate({ where: { balanceDue: { gt: 0 } }, _sum: { balanceDue: true }, _count: { id: true } }),
      prisma.installment.count({ where: { status: 'OVERDUE' } }),
      prisma.expense.groupBy({ by: ['category'], where: { date: { gte: monthStart } }, _sum: { amount: true }, orderBy: { _sum: { amount: 'desc' } }, take: 5 }),
    ]);

    const summary = {
      monthlyCollection: monthCollection._sum.amount || 0,
      monthlyExpenses: monthExpenses._sum.amount || 0,
      netProfit: (monthCollection._sum.amount || 0) - (monthExpenses._sum.amount || 0),
      pendingFeesTotal: pendingFees._sum.balanceDue || 0,
      studentsWithBalance: pendingFees._count.id || 0,
      overdueInstallments: overdueCount,
      topExpenseCategories: topExpenses,
    };

    const prompt = `You are a financial analyst for Future Optima IT Solutions, an IT training institute in Kerala, India.

Here is the financial summary for the current month:
- Monthly Collection: ₹${summary.monthlyCollection.toLocaleString('en-IN')}
- Monthly Expenses: ₹${summary.monthlyExpenses.toLocaleString('en-IN')}
- Net Profit: ₹${summary.netProfit.toLocaleString('en-IN')}
- Pending Fee Receivables: ₹${summary.pendingFeesTotal.toLocaleString('en-IN')} from ${summary.studentsWithBalance} students
- Overdue EMI Installments: ${summary.overdueInstallments}
- Top Expense Categories: ${summary.topExpenseCategories.map(e => `${e.category} (₹${(e._sum?.amount||0).toLocaleString('en-IN')})`).join(', ')}

Provide 3-5 actionable financial insights and recommendations for the institute director. Focus on:
1. Revenue collection health
2. Fee defaulter management
3. Expense optimization
4. Profitability improvement

Keep it concise and practical.`;

    if (!process.env.GROQ_API_KEY) {
      return res.json({ insights: 'AI insights unavailable — GROQ_API_KEY not configured.', summary });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.4,
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    res.json({ insights: data.choices[0].message.content.trim(), summary });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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

async function generateSalarySlipPDF(record, filePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = doc.page.width;
    const employeeName = record.employeeName;
    const designation = record.designation || '—';
    const department = record.department || '—';

    // HEADER: navy blue background
    doc.rect(0, 0, W, 110).fill('#1B2B6B');
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text(process.env.INSTITUTE_NAME || 'Future Optima IT Solutions', 50, 16, { align: 'center', width: W - 100 });
    doc.fontSize(9).font('Helvetica')
      .text(process.env.INSTITUTE_ADDRESS || 'Kakkanad, Kochi, Kerala - 682030', 50, 44, { align: 'center', width: W - 100 });
    doc.fontSize(8)
      .text(`Phone: ${process.env.INSTITUTE_PHONE || '+91-8891129333'}  |  Email: ${process.env.INSTITUTE_EMAIL || 'info@futureoptimaitsolutions.com'}`, 50, 58, { align: 'center', width: W - 100 });
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#F59E0B')
      .text('SALARY SLIP', 50, 76, { align: 'center', width: W - 100 });
    doc.fontSize(9).font('Helvetica').fillColor('white')
      .text(`For the month of: ${MONTH_NAMES[record.month - 1]} ${record.year}`, 50, 96, { align: 'center', width: W - 100 });

    let y = 128;

    // EMPLOYEE DETAILS BOX
    doc.rect(50, y, W - 100, 1).fill('#E5E7EB');
    y += 8;
    doc.fillColor('#1B2B6B').fontSize(10).font('Helvetica-Bold').text('EMPLOYEE DETAILS', 50, y); y += 16;

    const leftX = 50, rightX = W / 2 + 10;
    doc.fillColor('#374151').fontSize(9);
    const leftDetails = [['Employee Name', employeeName], ['Designation', designation], ['Department', department]];
    const rightDetails = [
      [`Salary Slip No`, `SS-${record.year}-${record.id.slice(-6).toUpperCase()}`],
      ['Payment Date', record.paymentDate ? new Date(record.paymentDate).toLocaleDateString('en-IN') : '—'],
      ['Payment Mode', record.paymentMethod || '—'],
    ];
    const startY = y;
    for (const [l, v] of leftDetails) {
      doc.font('Helvetica-Bold').text(l + ':', leftX, y, { width: 110 });
      doc.font('Helvetica').text(v, leftX + 115, y, { width: W / 2 - 130 });
      y += 15;
    }
    y = startY;
    for (const [l, v] of rightDetails) {
      doc.font('Helvetica-Bold').text(l + ':', rightX, y, { width: 100 });
      doc.font('Helvetica').text(v, rightX + 105, y, { width: W / 2 - 115 });
      y += 15;
    }
    y = startY + leftDetails.length * 15 + 12;

    doc.rect(50, y, W - 100, 0.5).fill('#E5E7EB'); y += 14;

    // EARNINGS TABLE
    doc.fillColor('#1B2B6B').fontSize(10).font('Helvetica-Bold').text('EARNINGS', 50, y); y += 14;
    doc.rect(50, y, W - 100, 18).fill('#1B2B6B');
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
      .text('Description', 58, y + 5)
      .text('Amount (₹)', W - 160, y + 5, { width: 100, align: 'right' });
    y += 18;

    const grossEarnings = record.basicSalary + record.bonus;
    const earningsRows = [['Basic Salary', record.basicSalary], ['Bonus / Incentive', record.bonus], ['Gross Earnings', grossEarnings]];
    earningsRows.forEach(([label, amount], i) => {
      const isBold = i === earningsRows.length - 1;
      doc.rect(50, y, W - 100, 15).fill(i % 2 === 0 ? '#F9FAFB' : '#FFFFFF');
      doc.fillColor('#374151').fontSize(9).font(isBold ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(label, 58, y + 3);
      doc.text(amount.toLocaleString('en-IN'), W - 160, y + 3, { width: 100, align: 'right' });
      y += 15;
    });
    y += 10;

    // DEDUCTIONS TABLE
    doc.fillColor('#1B2B6B').fontSize(10).font('Helvetica-Bold').text('DEDUCTIONS', 50, y); y += 14;
    doc.rect(50, y, W - 100, 18).fill('#1B2B6B');
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
      .text('Description', 58, y + 5)
      .text('Amount (₹)', W - 160, y + 5, { width: 100, align: 'right' });
    y += 18;

    const deductRows = [['Deductions', record.deductions], ['Total Deductions', record.deductions]];
    deductRows.forEach(([label, amount], i) => {
      const isBold = i === deductRows.length - 1;
      doc.rect(50, y, W - 100, 15).fill(i % 2 === 0 ? '#F9FAFB' : '#FFFFFF');
      doc.fillColor('#374151').fontSize(9).font(isBold ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(label, 58, y + 3);
      doc.text(amount.toLocaleString('en-IN'), W - 160, y + 3, { width: 100, align: 'right' });
      y += 15;
    });
    y += 14;

    // NET SALARY BOX
    doc.rect(50, y, W - 100, 50).fill('#1B2B6B');
    doc.fillColor('white').fontSize(16).font('Helvetica-Bold')
      .text(`NET SALARY: ₹${record.netSalary.toLocaleString('en-IN')}`, 50, y + 10, { align: 'center', width: W - 100 });
    doc.fontSize(9).font('Helvetica')
      .text(`Amount in Words: ${numToWords(record.netSalary)} Rupees Only`, 50, y + 32, { align: 'center', width: W - 100 });
    y += 64;

    // NOTES
    if (record.notes) {
      doc.fillColor('#374151').fontSize(9).font('Helvetica-Bold').text('Notes:', 50, y);
      doc.font('Helvetica').text(record.notes, 50, y + 14, { width: W - 100 });
      y += 30;
    }

    // FOOTER
    y += 20;
    doc.moveTo(50, y).lineTo(W - 50, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke(); y += 12;
    doc.fillColor('#374151').fontSize(9).font('Helvetica')
      .text('Authorized Signature', W - 200, y, { width: 150, align: 'right' });
    y += 30;
    doc.moveTo(W - 200, y).lineTo(W - 50, y).strokeColor('#374151').lineWidth(0.5).stroke(); y += 8;
    doc.fillColor('#9CA3AF').fontSize(7)
      .text('This is a computer generated salary slip', 50, y, { align: 'center', width: W - 100 }); y += 10;
    doc.text(process.env.INSTITUTE_NAME || 'Future Optima IT Solutions', 50, y, { align: 'center', width: W - 100 });

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

export default router;
