import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { newWorkbook, addTableSheet, addTotalsRow, sendWorkbook, INR_FORMAT } from '../utils/excelExport.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const slipsDir = path.join(__dirname, '../../uploads/salary-slips');
if (!fs.existsSync(slipsDir)) fs.mkdirSync(slipsDir, { recursive: true });

const router = express.Router();
router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'));

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Anchor date-only query params (YYYY-MM-DD) to UTC so filtering doesn't drift
// with the server's local timezone (e.g. IST is UTC+5:30).
const startOfDayUTC = (dateStr) => new Date(dateStr + 'T00:00:00.000Z');
const endOfDayUTC = (dateStr) => new Date(dateStr + 'T23:59:59.999Z');

// GET /api/finance/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [todayAgg, weekAgg, monthAgg, yearAgg, monthExpenses, pendingFees, recentPayments, pendingInstallments, overdueInstallments, bankWiseAgg] = await Promise.all([
      prisma.payment.aggregate({ where: { paidAt: { gte: today } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: weekStart } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: monthStart, lte: now } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: yearStart } }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { date: { gte: monthStart, lte: now } }, _sum: { amount: true } }),
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
      prisma.payment.groupBy({ by: ['bankAccount'], where: { paidAt: { gte: monthStart, lte: now } }, _sum: { amount: true } }),
    ]);

    const monthCollection = monthAgg._sum.amount || 0;
    const monthExpAmt = monthExpenses._sum.amount || 0;

    const bankAmt = (key) => bankWiseAgg.find(b => b.bankAccount === key)?._sum.amount || 0;
    const cash = bankAmt('CASH');
    const icici = bankAmt('ICICI');
    const idfc = bankAmt('IDFC');
    const bankWiseCollection = { cash, icici, idfc, total: cash + icici + idfc };

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
      bankWiseCollection,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/debug - diagnose date/timezone issues in finance data
router.get('/debug', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalExpenses, latestExpenses, totalPayments, latestPayments] = await Promise.all([
      prisma.expense.count(),
      prisma.expense.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { id: true, category: true, amount: true, date: true, createdAt: true },
      }),
      prisma.payment.count(),
      prisma.payment.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' },
        select: { id: true, amount: true, paidAt: true, createdAt: true },
      }),
    ]);

    res.json({
      totalExpenses,
      latestExpenses,
      totalPayments,
      latestPayments,
      serverTime: now.toISOString(),
      serverTimeLocal: now.toString(),
      serverTimezoneOffsetMinutes: now.getTimezoneOffset(),
      monthStart: monthStart.toISOString(),
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
      if (from) where.paidAt.gte = startOfDayUTC(from);
      if (to) where.paidAt.lte = endOfDayUTC(to);
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
    const { category, amount, date, paymentMethod, vendor, notes, bankAccount } = req.body;
    const expense = await prisma.expense.create({
      data: { category, amount: parseFloat(amount), date: new Date(date), paymentMethod, vendor, notes, bankAccount: bankAccount || 'CASH', addedById: req.user.id },
      include: { addedBy: { select: { name: true } } },
    });
    res.status(201).json(expense);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/finance/expenses/:id
router.delete('/expenses/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ message: 'Expense deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/expenses
router.get('/expenses', async (req, res) => {
  try {
    const { from, to, category } = req.query;
    const where = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = startOfDayUTC(from);
      if (to) where.date.lte = endOfDayUTC(to);
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

// GET /api/finance/employees — permanent employee roster
router.get('/employees', async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const where = includeInactive === 'true' ? {} : { isActive: true };
    const employees = await prisma.employee.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { user: { select: { name: true, email: true, role: true } } },
    });
    res.json(employees);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/finance/employees — add an employee to the permanent roster
router.post('/employees', [
  body('name').notEmpty().withMessage('name is required'),
  body('basicSalary').isFloat({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { userId, name, phone, designation, department, isExternalEmployee, basicSalary, bankAccount } = req.body;
    const employee = await prisma.employee.create({
      data: {
        userId: isExternalEmployee ? null : (userId || null),
        name,
        phone: phone || null,
        designation: designation || null,
        department: department || null,
        isExternalEmployee: Boolean(isExternalEmployee),
        basicSalary: parseFloat(basicSalary),
        bankAccount: bankAccount || 'CASH',
      },
      include: { user: { select: { name: true, email: true, role: true } } },
    });
    res.status(201).json(employee);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/finance/employees/:id — edit roster entry or deactivate (isActive: false)
router.patch('/employees/:id', async (req, res) => {
  try {
    const { name, phone, designation, department, basicSalary, bankAccount, isActive } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone || null;
    if (designation !== undefined) data.designation = designation || null;
    if (department !== undefined) data.department = department || null;
    if (basicSalary !== undefined) data.basicSalary = parseFloat(basicSalary);
    if (bankAccount !== undefined) data.bankAccount = bankAccount;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    const employee = await prisma.employee.update({ where: { id: req.params.id }, data });
    res.json(employee);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/salary/status?month=&year= — payroll roster: who's paid / unpaid this month
router.get('/salary/status', async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();

    const employees = await prisma.employee.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    const records = await prisma.salaryRecord.findMany({
      where: { month, year, employeeId: { in: employees.map(e => e.id) } },
    });
    const recordByEmployee = Object.fromEntries(records.map(r => [r.employeeId, r]));

    const data = employees.map(e => ({
      employee: e,
      record: recordByEmployee[e.id] || null,
      status: recordByEmployee[e.id]?.paymentStatus || 'NOT_PAID',
    }));

    res.json({
      month, year, data,
      paidCount: data.filter(d => d.status === 'PAID').length,
      totalCount: employees.length,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/finance/employees/:id/salary — record/update this month's salary payment for one employee
router.post('/employees/:id/salary', [
  body('month').isInt({ min: 1, max: 12 }),
  body('year').isInt({ min: 2020 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const { month, year, basicSalary, bonus = 0, deductions = 0, paymentStatus, paymentDate, paymentMethod, bankAccount, notes } = req.body;
    const basic = parseFloat(basicSalary ?? employee.basicSalary);
    const bonusAmt = parseFloat(bonus) || 0;
    const deductAmt = parseFloat(deductions) || 0;
    const netSalary = basic + bonusAmt - deductAmt;
    const status = paymentStatus || 'PAID';

    const record = await prisma.salaryRecord.upsert({
      where: { employeeId_month_year: { employeeId: employee.id, month: parseInt(month), year: parseInt(year) } },
      update: {
        basicSalary: basic, bonus: bonusAmt, deductions: deductAmt, netSalary,
        paymentStatus: status,
        paymentDate: status === 'PAID' ? new Date(paymentDate || Date.now()) : null,
        paymentMethod: paymentMethod || null,
        bankAccount: bankAccount || employee.bankAccount,
        notes: notes || null,
      },
      create: {
        employeeId: employee.id,
        userId: employee.userId,
        employeeName: employee.name,
        designation: employee.designation,
        department: employee.department,
        isExternalEmployee: employee.isExternalEmployee,
        month: parseInt(month), year: parseInt(year),
        basicSalary: basic, bonus: bonusAmt, deductions: deductAmt, netSalary,
        paymentStatus: status,
        paymentDate: status === 'PAID' ? new Date(paymentDate || Date.now()) : null,
        paymentMethod: paymentMethod || null,
        bankAccount: bankAccount || employee.bankAccount,
        notes: notes || null,
      },
      include: { employee: true },
    });
    res.status(201).json(record);
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
    const { userId, employeeName, designation, department, isExternalEmployee, month, year, basicSalary, bonus = 0, deductions = 0, paymentStatus, paymentDate, paymentMethod, bankAccount, notes } = req.body;

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
        bankAccount: bankAccount || 'CASH',
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
      if (from) { where.paidAt.gte = startOfDayUTC(from); where.date.gte = startOfDayUTC(from); }
      if (to) { where.paidAt.lte = endOfDayUTC(to); where.date.lte = endOfDayUTC(to); }
    }

    const [incomeAgg, expenseAgg, expenseByCategory, bankWiseAgg] = await Promise.all([
      prisma.payment.aggregate({ where: from || to ? { paidAt: where.paidAt } : {}, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: from || to ? { date: where.date } : {}, _sum: { amount: true } }),
      prisma.expense.groupBy({ by: ['category'], where: from || to ? { date: where.date } : {}, _sum: { amount: true } }),
      prisma.payment.groupBy({ by: ['bankAccount'], where: from || to ? { paidAt: where.paidAt } : {}, _sum: { amount: true } }),
    ]);

    const totalIncome = incomeAgg._sum.amount || 0;
    const totalExpenses = expenseAgg._sum.amount || 0;
    const bankAmt = (key) => bankWiseAgg.find(b => b.bankAccount === key)?._sum.amount || 0;
    const bankWiseIncome = { cash: bankAmt('CASH'), icici: bankAmt('ICICI'), idfc: bankAmt('IDFC') };

    res.json({
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      expenseBreakdown: expenseByCategory,
      bankWiseIncome,
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

const EXPENSE_CATEGORY_ORDER = ['Marketing', 'Rent', 'Electricity', 'Internet', 'Salary', 'Software', 'Office', 'Travel', 'Miscellaneous'];

function monthOverlapsRange(year, month, from, to) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  if (from && monthEnd < from) return false;
  if (to && monthStart > to) return false;
  return true;
}

// GET /api/finance/reports/pl-excel
router.get('/reports/pl-excel', async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? startOfDayUTC(from) : null;
    const toDate = to ? endOfDayUTC(to) : null;
    const paidAtWhere = {};
    if (fromDate) paidAtWhere.gte = fromDate;
    if (toDate) paidAtWhere.lte = toDate;
    const dateWhere = {};
    if (fromDate) dateWhere.gte = fromDate;
    if (toDate) dateWhere.lte = toDate;

    const [payments, expenses, expenseByCategory, incomeAgg, expenseAgg, salaryRecords] = await Promise.all([
      prisma.payment.findMany({
        where: (from || to) ? { paidAt: paidAtWhere } : {},
        orderBy: { paidAt: 'asc' },
        include: {
          enrollment: {
            include: {
              lead: { select: { name: true, phone: true } },
              course: { select: { name: true, shortName: true } },
              batch: { select: { batchName: true } },
            },
          },
          collectedBy: { select: { name: true } },
        },
      }),
      prisma.expense.findMany({
        where: (from || to) ? { date: dateWhere } : {},
        orderBy: { date: 'asc' },
        include: { addedBy: { select: { name: true } } },
      }),
      prisma.expense.groupBy({ by: ['category'], where: (from || to) ? { date: dateWhere } : {}, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: (from || to) ? { paidAt: paidAtWhere } : {}, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: (from || to) ? { date: dateWhere } : {}, _sum: { amount: true } }),
      prisma.salaryRecord.findMany({ orderBy: [{ year: 'asc' }, { month: 'asc' }] }),
    ]);

    const totalIncome = incomeAgg._sum.amount || 0;
    const totalExpenses = expenseAgg._sum.amount || 0;
    const netProfit = totalIncome - totalExpenses;

    const catMap = {};
    expenseByCategory.forEach(c => { catMap[c.category] = c._sum.amount || 0; });
    const extraCategories = Object.keys(catMap).filter(c => !EXPENSE_CATEGORY_ORDER.includes(c)).sort();
    const orderedCategories = [...EXPENSE_CATEGORY_ORDER, ...extraCategories];

    const periodSalary = salaryRecords.filter(r => monthOverlapsRange(r.year, r.month, fromDate, toDate));

    const wb = newWorkbook();

    // SHEET 1 - Summary
    const summary = wb.addWorksheet('Summary');
    summary.columns = [{ width: 32 }, { width: 22 }];
    let r = 1;
    summary.mergeCells(`A${r}:B${r}`);
    summary.getCell(`A${r}`).value = 'Future Optima IT Solutions';
    summary.getCell(`A${r}`).font = { bold: true, size: 16, color: { argb: 'FF1B2B6B' } };
    summary.getCell(`A${r}`).alignment = { horizontal: 'center' };
    r++;
    summary.mergeCells(`A${r}:B${r}`);
    summary.getCell(`A${r}`).value = 'Profit & Loss Report';
    summary.getCell(`A${r}`).font = { bold: true, size: 12, color: { argb: 'FFF59E0B' } };
    summary.getCell(`A${r}`).alignment = { horizontal: 'center' };
    r++;
    summary.mergeCells(`A${r}:B${r}`);
    summary.getCell(`A${r}`).value = `Period: From ${from || '—'} To ${to || '—'}`;
    summary.getCell(`A${r}`).alignment = { horizontal: 'center' };
    r++;
    summary.mergeCells(`A${r}:B${r}`);
    summary.getCell(`A${r}`).value = `Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    summary.getCell(`A${r}`).alignment = { horizontal: 'center' };
    r += 2;

    const sectionHeader = (label) => {
      summary.mergeCells(`A${r}:B${r}`);
      const cell = summary.getCell(`A${r}`);
      cell.value = label;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2B6B' } };
      r++;
    };
    const dataRow = (label, amount, bold = false) => {
      summary.getCell(`A${r}`).value = label;
      summary.getCell(`B${r}`).value = amount;
      summary.getCell(`B${r}`).numFmt = INR_FORMAT;
      if (bold) { summary.getCell(`A${r}`).font = { bold: true }; summary.getCell(`B${r}`).font = { bold: true }; }
      r++;
    };

    sectionHeader('INCOME');
    dataRow('Fee Collections', totalIncome);
    dataRow('Total Income', totalIncome, true);
    r++;

    sectionHeader('EXPENSES BY CATEGORY');
    orderedCategories.forEach(cat => dataRow(cat, catMap[cat] || 0));
    dataRow('Total Expenses', totalExpenses, true);
    r++;

    summary.mergeCells(`A${r}:B${r}`);
    const npCell = summary.getCell(`A${r}`);
    npCell.value = `NET PROFIT/LOSS: ₹${netProfit.toLocaleString('en-IN')}`;
    npCell.font = { bold: true, size: 13, color: { argb: netProfit >= 0 ? 'FF15803D' : 'FFB91C1C' } };
    npCell.alignment = { horizontal: 'center' };

    // SHEET 2 - All Payments (Income Detail)
    addTableSheet(wb, 'Payments', [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Receipt No', key: 'receiptNo', width: 20 },
      { header: 'Student Name', key: 'studentName', width: 22 },
      { header: 'Student Phone', key: 'studentPhone', width: 16, text: true },
      { header: 'Course', key: 'course', width: 22 },
      { header: 'Batch', key: 'batch', width: 16 },
      { header: 'Amount', key: 'amount', width: 16, money: true },
      { header: 'Payment Method', key: 'method', width: 16 },
      { header: 'Transaction ID', key: 'txnId', width: 20 },
      { header: 'Collected By', key: 'collectedBy', width: 18 },
      { header: 'Enrollment Date', key: 'enrolledAt', width: 16 },
    ], payments.map(p => ({
      date: p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN') : '',
      receiptNo: p.receiptNumber,
      studentName: p.enrollment?.lead?.name || '',
      studentPhone: p.enrollment?.lead?.phone || '',
      course: p.enrollment?.course?.name || '',
      batch: p.enrollment?.batch?.batchName || '',
      amount: p.amount,
      method: p.method,
      txnId: p.transactionId || '',
      collectedBy: p.collectedBy?.name || '',
      enrolledAt: p.enrollment?.enrolledAt ? new Date(p.enrollment.enrolledAt).toLocaleDateString('en-IN') : '',
    })));

    // SHEET 3 - All Expenses
    addTableSheet(wb, 'Expenses', [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Amount', key: 'amount', width: 16, money: true },
      { header: 'Payment Method', key: 'method', width: 16 },
      { header: 'Notes', key: 'notes', width: 26 },
      { header: 'Added By', key: 'addedBy', width: 18 },
    ], expenses.map(e => ({
      date: e.date ? new Date(e.date).toLocaleDateString('en-IN') : '',
      category: e.category,
      vendor: e.vendor || '',
      amount: e.amount,
      method: e.paymentMethod,
      notes: e.notes || '',
      addedBy: e.addedBy?.name || '',
    })));

    // SHEET 4 - Salary Records
    addTableSheet(wb, 'Salary', [
      { header: 'Employee Name', key: 'employeeName', width: 22 },
      { header: 'Designation', key: 'designation', width: 18 },
      { header: 'Department', key: 'department', width: 18 },
      { header: 'Basic Salary', key: 'basicSalary', width: 16, money: true },
      { header: 'Bonus', key: 'bonus', width: 14, money: true },
      { header: 'Deductions', key: 'deductions', width: 14, money: true },
      { header: 'Net Salary', key: 'netSalary', width: 16, money: true },
      { header: 'Payment Method', key: 'paymentMethod', width: 16 },
      { header: 'Payment Date', key: 'paymentDate', width: 16 },
      { header: 'Status', key: 'status', width: 12 },
    ], periodSalary.map(s => ({
      employeeName: s.employeeName,
      designation: s.designation || '',
      department: s.department || '',
      basicSalary: s.basicSalary,
      bonus: s.bonus,
      deductions: s.deductions,
      netSalary: s.netSalary,
      paymentMethod: s.paymentMethod || '',
      paymentDate: s.paymentDate ? new Date(s.paymentDate).toLocaleDateString('en-IN') : '',
      status: s.paymentStatus,
    })));

    await sendWorkbook(res, wb, 'FutureOptima_PL_Report.xlsx');
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/reports/collection-excel
router.get('/reports/collection-excel', async (req, res) => {
  try {
    const { from, to, courseId, counselorId } = req.query;
    const where = {};
    if (from || to) {
      where.paidAt = {};
      if (from) where.paidAt.gte = startOfDayUTC(from);
      if (to) where.paidAt.lte = endOfDayUTC(to);
    }
    if (courseId) where.enrollment = { courseId };
    if (counselorId) where.enrollment = { ...(where.enrollment || {}), lead: { assignedToId: counselorId } };

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      include: {
        enrollment: {
          include: {
            lead: { select: { name: true, phone: true, email: true, assignedTo: { select: { name: true } } } },
            course: { select: { name: true, shortName: true } },
            batch: { select: { batchName: true } },
          },
        },
        collectedBy: { select: { name: true } },
      },
    });

    const wb = newWorkbook();
    addTableSheet(wb, 'Collections', [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Receipt No', key: 'receiptNo', width: 20 },
      { header: 'Student Name', key: 'studentName', width: 22 },
      { header: 'Student Phone', key: 'studentPhone', width: 16, text: true },
      { header: 'Student Email', key: 'studentEmail', width: 24 },
      { header: 'Course', key: 'course', width: 22 },
      { header: 'Batch', key: 'batch', width: 16 },
      { header: 'Total Fee', key: 'totalFee', width: 16, money: true },
      { header: 'Amount Paid This', key: 'amountPaid', width: 18, money: true },
      { header: 'Total Paid', key: 'totalPaid', width: 16, money: true },
      { header: 'Balance Due', key: 'balanceDue', width: 16, money: true },
      { header: 'Payment Method', key: 'method', width: 16 },
      { header: 'Received In', key: 'receivedIn', width: 14 },
      { header: 'Transaction ID', key: 'txnId', width: 20 },
      { header: 'Collected By', key: 'collectedBy', width: 18 },
      { header: 'Counselor Name', key: 'counselor', width: 18 },
      { header: 'Enrollment Date', key: 'enrolledAt', width: 16 },
    ], payments.map(p => ({
      date: p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN') : '',
      receiptNo: p.receiptNumber,
      studentName: p.enrollment?.lead?.name || '',
      studentPhone: p.enrollment?.lead?.phone || '',
      studentEmail: p.enrollment?.lead?.email || '',
      course: p.enrollment?.course?.name || '',
      batch: p.enrollment?.batch?.batchName || '',
      totalFee: p.enrollment?.netFee || 0,
      amountPaid: p.amount,
      totalPaid: p.enrollment?.paidAmount || 0,
      balanceDue: p.enrollment?.balanceDue || 0,
      method: p.method,
      receivedIn: p.bankAccount || 'CASH',
      txnId: p.transactionId || '',
      collectedBy: p.collectedBy?.name || '',
      counselor: p.enrollment?.lead?.assignedTo?.name || '',
      enrolledAt: p.enrollment?.enrolledAt ? new Date(p.enrollment.enrolledAt).toLocaleDateString('en-IN') : '',
    })));

    await sendWorkbook(res, wb, 'FutureOptima_Collection_Report.xlsx');
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/reports/pending-excel
router.get('/reports/pending-excel', async (req, res) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { balanceDue: { gt: 0 } },
      orderBy: { balanceDue: 'desc' },
      include: {
        lead: { select: { name: true, phone: true, email: true, nextFollowUpAt: true, assignedTo: { select: { name: true } } } },
        course: { select: { name: true, shortName: true } },
        batch: { select: { batchName: true } },
        installments: { where: { status: 'OVERDUE' } },
        payments: { orderBy: { paidAt: 'desc' }, take: 1 },
      },
    });

    const wb = newWorkbook();
    addTableSheet(wb, 'Pending Fees', [
      { header: 'Student Name', key: 'studentName', width: 22 },
      { header: 'Student Phone', key: 'studentPhone', width: 16, text: true },
      { header: 'Student Email', key: 'studentEmail', width: 24 },
      { header: 'Course', key: 'course', width: 22 },
      { header: 'Batch', key: 'batch', width: 16 },
      { header: 'Enrollment Date', key: 'enrolledAt', width: 16 },
      { header: 'Total Fee', key: 'totalFee', width: 16, money: true },
      { header: 'Total Paid', key: 'totalPaid', width: 16, money: true },
      { header: 'Balance Due', key: 'balanceDue', width: 16, money: true },
      { header: 'Overdue Installments', key: 'overdue', width: 18 },
      { header: 'Last Payment Date', key: 'lastPayment', width: 16 },
      { header: 'Counselor', key: 'counselor', width: 18 },
      { header: 'Next Follow Up', key: 'nextFollowUp', width: 16 },
    ], enrollments.map(e => ({
      studentName: e.lead?.name || '',
      studentPhone: e.lead?.phone || '',
      studentEmail: e.lead?.email || '',
      course: e.course?.name || '',
      batch: e.batch?.batchName || '',
      enrolledAt: e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString('en-IN') : '',
      totalFee: e.netFee,
      totalPaid: e.paidAmount,
      balanceDue: e.balanceDue,
      overdue: e.installments.length,
      lastPayment: e.payments[0]?.paidAt ? new Date(e.payments[0].paidAt).toLocaleDateString('en-IN') : '',
      counselor: e.lead?.assignedTo?.name || '',
      nextFollowUp: e.lead?.nextFollowUpAt ? new Date(e.lead.nextFollowUpAt).toLocaleDateString('en-IN') : '',
    })));

    await sendWorkbook(res, wb, 'FutureOptima_Pending_Fees.xlsx');
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/reports/expense-excel
router.get('/reports/expense-excel', async (req, res) => {
  try {
    const { from, to, category } = req.query;
    const where = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = startOfDayUTC(from);
      if (to) where.date.lte = endOfDayUTC(to);
    }
    if (category) where.category = category;

    const [expenses, byCategory] = await Promise.all([
      prisma.expense.findMany({ where, orderBy: { date: 'desc' }, include: { addedBy: { select: { name: true } } } }),
      prisma.expense.groupBy({ by: ['category'], where, _sum: { amount: true }, _count: { id: true } }),
    ]);

    const wb = newWorkbook();
    addTableSheet(wb, 'Expenses', [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Category', key: 'category', width: 16 },
      { header: 'Sub Category', key: 'subCategory', width: 16 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Amount', key: 'amount', width: 16, money: true },
      { header: 'Payment Method', key: 'method', width: 16 },
      { header: 'Notes', key: 'notes', width: 26 },
      { header: 'Added By', key: 'addedBy', width: 18 },
      { header: 'Created At', key: 'createdAt', width: 16 },
    ], expenses.map(e => ({
      date: e.date ? new Date(e.date).toLocaleDateString('en-IN') : '',
      category: e.category,
      subCategory: '',
      vendor: e.vendor || '',
      amount: e.amount,
      method: e.paymentMethod,
      notes: e.notes || '',
      addedBy: e.addedBy?.name || '',
      createdAt: e.createdAt ? new Date(e.createdAt).toLocaleDateString('en-IN') : '',
    })));

    addTableSheet(wb, 'Category Summary', [
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Total Amount', key: 'total', width: 18, money: true },
      { header: 'Transaction Count', key: 'count', width: 18 },
    ], byCategory.map(c => ({
      category: c.category,
      total: c._sum.amount || 0,
      count: c._count.id,
    })));

    await sendWorkbook(res, wb, 'FutureOptima_Expense_Report.xlsx');
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/reports/salary-excel
router.get('/reports/salary-excel', async (req, res) => {
  try {
    const { month, year } = req.query;
    const where = {};
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);

    const records = await prisma.salaryRecord.findMany({ where, orderBy: [{ year: 'desc' }, { month: 'desc' }, { employeeName: 'asc' }] });

    const columns = [
      { header: 'Employee Name', key: 'employeeName', width: 22 },
      { header: 'Designation', key: 'designation', width: 18 },
      { header: 'Department', key: 'department', width: 18 },
      { header: 'Is External', key: 'isExternal', width: 12 },
      { header: 'Basic Salary', key: 'basicSalary', width: 16, money: true },
      { header: 'Bonus', key: 'bonus', width: 14, money: true },
      { header: 'Deductions', key: 'deductions', width: 14, money: true },
      { header: 'Net Salary', key: 'netSalary', width: 16, money: true },
      { header: 'Payment Status', key: 'paymentStatus', width: 14 },
      { header: 'Payment Method', key: 'paymentMethod', width: 16 },
      { header: 'Payment Date', key: 'paymentDate', width: 16 },
      { header: 'Notes', key: 'notes', width: 24 },
    ];

    const wb = newWorkbook();
    const sheet = addTableSheet(wb, 'Salary', columns, records.map(r => ({
      employeeName: r.employeeName,
      designation: r.designation || '',
      department: r.department || '',
      isExternal: r.isExternalEmployee ? 'Yes' : 'No',
      basicSalary: r.basicSalary,
      bonus: r.bonus,
      deductions: r.deductions,
      netSalary: r.netSalary,
      paymentStatus: r.paymentStatus,
      paymentMethod: r.paymentMethod || '',
      paymentDate: r.paymentDate ? new Date(r.paymentDate).toLocaleDateString('en-IN') : '',
      notes: r.notes || '',
    })));

    const totals = {
      employeeName: 'TOTAL',
      designation: '', department: '', isExternal: '',
      basicSalary: records.reduce((s, r) => s + r.basicSalary, 0),
      bonus: records.reduce((s, r) => s + r.bonus, 0),
      deductions: records.reduce((s, r) => s + r.deductions, 0),
      netSalary: records.reduce((s, r) => s + r.netSalary, 0),
      paymentStatus: '', paymentMethod: '', paymentDate: '', notes: '',
    };
    addTotalsRow(sheet, columns, totals);

    await sendWorkbook(res, wb, 'FutureOptima_Salary_Report.xlsx');
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
    const bankLabels = { HDFC: 'HDFC Bank', ICICI: 'ICICI Bank', IDFC: 'IDFC Bank', CASH: 'Cash' };
    const rightDetails = [
      [`Salary Slip No`, `SS-${record.year}-${record.id.slice(-6).toUpperCase()}`],
      ['Payment Date', record.paymentDate ? new Date(record.paymentDate).toLocaleDateString('en-IN') : '—'],
      ['Payment Mode', record.paymentMethod || '—'],
      ['Paid From', bankLabels[record.bankAccount] || 'Cash'],
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
