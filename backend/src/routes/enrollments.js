import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { logActivity } from '../utils/activityLogger.js';

const router = express.Router();
router.use(authenticate);

router.post('/', [
  body('leadId').notEmpty(),
  body('courseId').notEmpty(),
  body('courseFee').isFloat({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { leadId, courseId: rawCourseId, batchId, courseFee, discountAmount = 0, discountReason, installments = 1, scholarshipName, scholarshipPct } = req.body;

    // Resolve courseId: accept both Course.id (cuid) and CourseId enum (e.g. AI_ENGINEERING)
    let courseId = rawCourseId;
    if (rawCourseId && /^[A-Z][A-Z0-9_]+$/.test(rawCourseId)) {
      const course = await prisma.course.findFirst({ where: { courseId: rawCourseId } });
      if (!course) return res.status(404).json({ error: `Course '${rawCourseId}' not found` });
      courseId = course.id;
    }

    const existing = await prisma.enrollment.findUnique({ where: { leadId } });
    if (existing) return res.status(409).json({ error: 'Lead already enrolled', enrollmentId: existing.id });

    const netFee = courseFee - discountAmount;
    const receiptNo = `FO-ENR-${Date.now()}`;

    const enrollment = await prisma.$transaction(async (tx) => {
      const enr = await tx.enrollment.create({
        data: { leadId, courseId, batchId: batchId || null, courseFee, discountAmount, discountReason, netFee, paidAmount: 0, balanceDue: netFee, receiptNo, scholarshipName, scholarshipPct, paymentStatus: 'PENDING' },
        include: { course: true, lead: true },
      });
      if (installments > 1) {
        const instAmt = Math.floor(netFee / installments);
        const remainder = netFee - instAmt * installments;
        for (let i = 1; i <= installments; i++) {
          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() + (i - 1));
          await tx.installment.create({
            data: { enrollmentId: enr.id, installmentNo: i, amount: i === 1 ? instAmt + remainder : instAmt, dueDate, status: i === 1 ? 'DUE' : 'UPCOMING' },
          });
        }
      }
      await tx.lead.update({ where: { id: leadId }, data: { status: 'WON', convertedAt: new Date() } });
      return enr;
    });

    await logActivity(leadId, req.user.id, 'ENROLLED', { course: enrollment.course.name });
    res.status(201).json(enrollment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 25, status, courseId, paymentStatus, leadId, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (leadId) where.leadId = leadId;
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (search) where.lead = { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] };
    if (courseId) {
      // Accept both Course.id (cuid) and CourseId enum (e.g. AI_ENGINEERING)
      if (/^[A-Z][A-Z0-9_]+$/.test(courseId)) {
        const course = await prisma.course.findFirst({ where: { courseId } });
        if (course) where.courseId = course.id;
      } else {
        where.courseId = courseId;
      }
    }
    const [data, total] = await Promise.all([
      prisma.enrollment.findMany({
        where, skip, take: parseInt(limit), orderBy: { enrolledAt: 'desc' },
        include: {
          lead: { select: { name: true, phone: true, email: true } },
          course: { select: { name: true, shortName: true } },
          batch: { select: { batchName: true } },
          _count: { select: { payments: true } },
        },
      }),
      prisma.enrollment.count({ where }),
    ]);
    res.json({ data, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: req.params.id },
      include: {
        lead: true, course: true, batch: true,
        payments: { include: { collectedBy: { select: { name: true } } }, orderBy: { paidAt: 'desc' } },
        installments: { orderBy: { installmentNo: 'asc' } },
        documents: true,
      },
    });
    if (!enrollment) return res.status(404).json({ error: 'Not found' });
    res.json(enrollment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const enrollment = await prisma.enrollment.update({ where: { id: req.params.id }, data: req.body });
    res.json(enrollment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
