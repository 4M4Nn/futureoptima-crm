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
  body('userId').notEmpty(),
  body('month').isInt({ min: 1, max: 12 }),
  body('year').isInt({ min: 2020 }),
  body('basicSalary').isFloat({ min: 0 }),
  body('netSalary').isFloat({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { userId, month, year, basicSalary, bonus = 0, deductions = 0, netSalary, paymentStatus, paymentDate, paymentMethod, notes } = req.body;
    const record = await prisma.salaryRecord.create({
      data: {
        userId,
        month: parseInt(month),
        year: parseInt(year),
        basicSalary: parseFloat(basicSalary),
        bonus: parseFloat(bonus),
        deductions: parseFloat(deductions),
        netSalary: parseFloat(netSalary),
        paymentStatus: paymentStatus || 'PENDING',
        paymentDate: paymentDate ? new Date(paymentDate) : null,
        paymentMethod,
        notes,
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

    res.json({ data: records, totalPayroll: total._sum.netSalary || 0 });
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

    const filename = `slip_${record.userId}_${record.year}_${String(record.month).padStart(2,'0')}.pdf`;
    const filePath = path.join(slipsDir, filename);

    await generateSalarySlipPDF(record, filePath);

    await prisma.salaryRecord.update({ where: { id: record.id }, data: { slipGenerated: true } });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="salary-slip-${record.user.name.replace(/\s+/g,'-')}-${MONTH_NAMES[record.month-1]}-${record.year}.pdf"`);
    res.sendFile(path.resolve(filePath));
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

async function generateSalarySlipPDF(record, filePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const W = doc.page.width;

    // Header
    doc.rect(0, 0, W, 100).fill('#1B2B6B');
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
      .text(process.env.INSTITUTE_NAME || 'Future Optima IT Solutions', 40, 18, { align: 'center' });
    doc.fontSize(10).font('Helvetica')
      .text(process.env.INSTITUTE_ADDRESS || 'Kakkanad, Kochi, Kerala - 682030', 40, 44, { align: 'center' });
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#F59E0B')
      .text('SALARY SLIP', 40, 66, { align: 'center' });

    // Month/Year
    doc.fillColor('#1B2B6B').fontSize(13).font('Helvetica-Bold')
      .text(`${MONTH_NAMES[record.month - 1]} ${record.year}`, 40, 116, { align: 'center' });

    doc.moveTo(40, 136).lineTo(W - 40, 136).strokeColor('#E5E7EB').lineWidth(1).stroke();

    // Employee details
    let y = 148;
    doc.fillColor('#1B2B6B').fontSize(10).font('Helvetica-Bold').text('EMPLOYEE DETAILS', 40, y); y += 16;

    const empDetails = [
      ['Employee Name', record.user.name],
      ['Email', record.user.email],
      ['Role', record.user.role?.replace('_', ' ')],
      ['Phone', record.user.phone || '—'],
    ];
    for (const [l, v] of empDetails) {
      doc.fillColor('#374151').fontSize(9);
      doc.font('Helvetica-Bold').text(l + ':', 40, y, { width: 130 });
      doc.font('Helvetica').text(v, 175, y);
      y += 14;
    }

    y += 8;
    doc.moveTo(40, y).lineTo(W - 40, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke(); y += 12;

    // Salary table
    doc.fillColor('#1B2B6B').fontSize(10).font('Helvetica-Bold').text('SALARY DETAILS', 40, y); y += 14;

    // Table header
    doc.rect(40, y, W - 80, 18).fill('#1B2B6B');
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
      .text('Component', 48, y + 4)
      .text('Amount (₹)', W - 150, y + 4, { width: 100, align: 'right' });
    y += 18;

    const rows = [
      ['Basic Salary', record.basicSalary],
      ['Bonus / Incentive', record.bonus],
      ['Deductions', -record.deductions],
    ];
    let rowIdx = 0;
    for (const [label, amount] of rows) {
      doc.rect(40, y, W - 80, 15).fill(rowIdx % 2 === 0 ? '#F9FAFB' : '#FFFFFF');
      doc.fillColor(amount < 0 ? '#DC2626' : '#374151').fontSize(9).font('Helvetica');
      doc.text(label, 48, y + 3);
      doc.text(Math.abs(amount).toLocaleString('en-IN'), W - 150, y + 3, { width: 100, align: 'right' });
      y += 15; rowIdx++;
    }

    // Net salary row
    doc.rect(40, y, W - 80, 20).fill('#1B2B6B');
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
      .text('NET SALARY', 48, y + 5)
      .text(`₹${record.netSalary.toLocaleString('en-IN')}`, W - 150, y + 5, { width: 100, align: 'right' });
    y += 28;

    // Payment info
    doc.fillColor('#374151').fontSize(9);
    doc.font('Helvetica-Bold').text('Payment Status:', 40, y).font('Helvetica').text(record.paymentStatus, 155, y); y += 14;
    if (record.paymentDate) {
      doc.font('Helvetica-Bold').text('Payment Date:', 40, y).font('Helvetica').text(new Date(record.paymentDate).toLocaleDateString('en-IN'), 155, y); y += 14;
    }
    if (record.paymentMethod) {
      doc.font('Helvetica-Bold').text('Payment Method:', 40, y).font('Helvetica').text(record.paymentMethod, 155, y); y += 14;
    }
    if (record.notes) {
      doc.font('Helvetica-Bold').text('Notes:', 40, y).font('Helvetica').text(record.notes, 155, y, { width: W - 200 }); y += 14;
    }

    y += 16;
    doc.moveTo(40, y).lineTo(W - 40, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke(); y += 12;
    doc.fillColor('#9CA3AF').fontSize(7)
      .text('This is a computer-generated salary slip and does not require a physical signature.', 40, y, { align: 'center', width: W - 80 });

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

export default router;
