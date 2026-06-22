import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { generateReceiptPDF } from '../services/receiptService.js';
import { logActivity } from '../utils/activityLogger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const receiptsDir = path.join(__dirname, '../../uploads/receipts');

const router = express.Router();
router.use(authenticate);

router.post('/', [
  body('enrollmentId').notEmpty(),
  body('amount').isFloat({ min: 1 }),
  body('method').isIn(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'EMI']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { enrollmentId, amount, method, transactionId, installmentId, remarks } = req.body;
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { lead: true, course: true },
    });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    if (amount > enrollment.balanceDue + 1) {
      return res.status(400).json({ error: `Amount exceeds balance due ₹${enrollment.balanceDue}` });
    }

    const receiptNumber = `FO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const newPaid = enrollment.paidAmount + amount;
    const newBalance = enrollment.netFee - newPaid;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          enrollmentId,
          installmentId: installmentId || null,
          amount,
          method,
          transactionId,
          receiptNumber,
          remarks,
          collectedById: req.user.id,
        },
      });
      await tx.enrollment.update({
        where: { id: enrollmentId },
        data: {
          paidAmount: newPaid,
          balanceDue: newBalance,
          paymentStatus: newBalance <= 0 ? 'PAID' : 'PARTIAL',
        },
      });
      if (installmentId) {
        await tx.installment.update({ where: { id: installmentId }, data: { status: 'PAID', paidAt: new Date() } });
      }
      return payment;
    });

    await logActivity(enrollment.leadId, req.user.id, 'PAYMENT_RECORDED', { amount, method, receiptNumber });

    // Generate PDF receipt asynchronously
    generateReceiptPDF({
      receiptNumber,
      studentName: enrollment.lead.name,
      phone: enrollment.lead.phone,
      courseName: enrollment.course.name,
      amount,
      method,
      transactionId,
      paidAt: result.paidAt || new Date(),
      netFee: enrollment.netFee,
      paidTotal: newPaid,
      balance: newBalance,
      collectedBy: req.user.name,
    }).catch(console.error);

    res.status(201).json({ ...result, message: 'Payment recorded successfully!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [todayAgg, monthAgg, totalAgg, overdue, methodBreakdown] = await Promise.all([
      prisma.payment.aggregate({ where: { paidAt: { gte: today } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.installment.count({ where: { status: 'OVERDUE' } }),
      prisma.payment.groupBy({ by: ['method'], _sum: { amount: true }, _count: { id: true } }),
    ]);
    res.json({
      todayCollected: todayAgg._sum.amount || 0,
      monthCollected: monthAgg._sum.amount || 0,
      totalCollected: totalAgg._sum.amount || 0,
      overdueInstallments: overdue,
      methodBreakdown,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/receipt', async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        enrollment: { include: { lead: true, course: true } },
        collectedBy: { select: { name: true } },
      },
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    const filename = `receipt_${payment.receiptNumber.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    const filePath = path.join(receiptsDir, filename);

    if (!fs.existsSync(filePath)) {
      await generateReceiptPDF({
        receiptNumber: payment.receiptNumber,
        studentName: payment.enrollment.lead.name,
        phone: payment.enrollment.lead.phone,
        courseName: payment.enrollment.course.name,
        amount: payment.amount,
        method: payment.method,
        transactionId: payment.transactionId,
        paidAt: payment.paidAt,
        netFee: payment.enrollment.netFee,
        paidTotal: payment.enrollment.paidAmount,
        balance: payment.enrollment.balanceDue,
        collectedBy: payment.collectedBy.name,
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${payment.receiptNumber}.pdf"`);
    res.sendFile(path.resolve(filePath));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/resend-receipt', async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: {
        enrollment: { include: { lead: true, course: true } },
        collectedBy: { select: { name: true } },
      },
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    const pdfPath = await generateReceiptPDF({
      receiptNumber: payment.receiptNumber,
      studentName: payment.enrollment.lead.name,
      phone: payment.enrollment.lead.phone,
      courseName: payment.enrollment.course.name,
      amount: payment.amount,
      method: payment.method,
      transactionId: payment.transactionId,
      paidAt: payment.paidAt,
      netFee: payment.enrollment.netFee,
      paidTotal: payment.enrollment.paidAmount,
      balance: payment.enrollment.balanceDue,
      collectedBy: payment.collectedBy.name,
    });

    res.json({ message: 'Receipt PDF regenerated', path: pdfPath });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 25, enrollmentId, from, to, method } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (enrollmentId) where.enrollmentId = enrollmentId;
    if (method) where.method = method;
    if (from || to) {
      where.paidAt = {};
      if (from) where.paidAt.gte = new Date(from);
      if (to) where.paidAt.lte = new Date(to);
    }
    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { paidAt: 'desc' },
        include: {
          enrollment: {
            include: {
              lead: { select: { name: true, phone: true } },
              course: { select: { shortName: true } },
            },
          },
          collectedBy: { select: { name: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);
    res.json({ data, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
