import express from 'express';
import multer from 'multer';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logActivity } from '../utils/activityLogger.js';
import { newWorkbook, addTableSheet, sendWorkbook } from '../utils/excelExport.js';
import { nextStudentCode, releaseStudentCode, getFYCode } from '../utils/studentCode.js';
import { parseWorkbookRows, toAmount, toDate } from '../utils/excelImport.js';
import { matchCourse } from '../utils/courseMatcher.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();
router.use(authenticate);

// GET /api/enrollments/export-excel
router.get('/export-excel', async (req, res) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      orderBy: { enrolledAt: 'desc' },
      include: {
        lead: { select: { name: true, phone: true, email: true, assignedTo: { select: { name: true } } } },
        course: { select: { name: true, shortName: true } },
        batch: { select: { batchName: true, mode: true } },
      },
    });

    const wb = newWorkbook();
    addTableSheet(wb, 'Students', [
      { header: 'Student No.', key: 'studentCode', width: 16, text: true },
      { header: 'Student Name', key: 'studentName', width: 22 },
      { header: 'Phone', key: 'phone', width: 16, text: true },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Course', key: 'course', width: 22 },
      { header: 'Batch', key: 'batch', width: 16 },
      { header: 'Mode', key: 'mode', width: 12 },
      { header: 'Enrollment Date', key: 'enrolledAt', width: 16 },
      { header: 'Total Fee', key: 'totalFee', width: 16, money: true },
      { header: 'Discount', key: 'discount', width: 14, money: true },
      { header: 'Net Fee', key: 'netFee', width: 16, money: true },
      { header: 'Total Paid', key: 'totalPaid', width: 16, money: true },
      { header: 'Balance Due', key: 'balanceDue', width: 16, money: true },
      { header: 'Payment Status', key: 'paymentStatus', width: 14 },
      { header: 'Enrollment Status', key: 'status', width: 16 },
      { header: 'Counselor', key: 'counselor', width: 18 },
      { header: 'Receipt No', key: 'receiptNo', width: 20 },
      { header: 'Certificate Generated', key: 'certGenerated', width: 18 },
    ], enrollments.map(e => ({
      studentCode: e.studentCode || '',
      studentName: e.lead?.name || '',
      phone: e.lead?.phone || '',
      email: e.lead?.email || '',
      course: e.course?.name || '',
      batch: e.batch?.batchName || '',
      mode: e.batch?.mode || '',
      enrolledAt: e.enrolledAt ? new Date(e.enrolledAt).toLocaleDateString('en-IN') : '',
      totalFee: e.courseFee,
      discount: e.discountAmount,
      netFee: e.netFee,
      totalPaid: e.paidAmount,
      balanceDue: e.balanceDue,
      paymentStatus: e.paymentStatus,
      status: e.status,
      counselor: e.lead?.assignedTo?.name || '',
      receiptNo: e.receiptNo,
      certGenerated: e.certificateNo ? 'Yes' : 'No',
    })));

    await sendWorkbook(res, wb, 'FutureOptima_Students.xlsx');
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/enrollments/import/preview — bulk-register students from a spreadsheet
// (e.g. "everyone who paid ₹500 and registered from April 1st"). Matches each row's
// Course text against real courses and flags students who already have an
// enrollment (by phone) as duplicates, WITHOUT saving anything yet.
router.post('/import/preview', authorize('SUPER_ADMIN', 'ADMIN'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const rawRows = await parseWorkbookRows(req.file.buffer);
    if (!rawRows.length) {
      return res.status(400).json({ error: 'No recognizable rows found. Make sure the sheet has a Date column, a Name (or Phone) column, and ideally a Course column.' });
    }

    const courses = await prisma.course.findMany({ where: { isActive: true }, select: { id: true, name: true, shortName: true, fees: true } });

    const preview = [];
    for (const row of rawRows) {
      const date = toDate(row.date);
      const name = row.name ? String(row.name).trim() : '';
      if (!date || !name) continue;

      const phoneDigits = row.phone ? String(row.phone).replace(/\D/g, '').slice(-10) : '';
      const amount = toAmount(row.credit ?? row.amount) || 500;
      const course = await matchCourse(row.course || row.category);

      let duplicate = false;
      if (phoneDigits.length === 10) {
        const lead = await prisma.lead.findUnique({ where: { phone: phoneDigits }, include: { enrollment: true } });
        duplicate = !!lead?.enrollment;
      }

      preview.push({
        date: date.toISOString(), name, phone: phoneDigits, amount,
        courseId: course?.id || null, courseName: course?.name || null,
        duplicate,
        include: !duplicate && !!course,
      });
    }

    res.json({
      rows: preview,
      total: preview.length,
      courseMatchedCount: preview.filter(r => r.courseId).length,
      duplicateCount: preview.filter(r => r.duplicate).length,
      skipped: rawRows.length - preview.length,
      courses: courses.map(c => ({ id: c.id, name: c.name, fees: c.fees })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/enrollments/import/commit
router.post('/import/commit', authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'No rows to import' });

    let created = 0, skipped = 0, seq = 0;
    for (const row of rows) {
      if (!row.include || !row.courseId) { skipped++; continue; }
      const date = new Date(row.date);
      const amount = Number(row.amount) || 0;
      if (Number.isNaN(date.getTime()) || !row.name) { skipped++; continue; }

      const courseRecord = await prisma.course.findUnique({ where: { id: row.courseId } });
      if (!courseRecord) { skipped++; continue; }

      const phoneDigits = row.phone ? String(row.phone).replace(/\D/g, '').slice(-10) : '';
      let existingLead = null;
      if (phoneDigits.length === 10) {
        existingLead = await prisma.lead.findUnique({ where: { phone: phoneDigits }, include: { enrollment: true } });
        if (existingLead?.enrollment) { skipped++; continue; }
      }

      const netFee = courseRecord.fees;
      seq += 1;
      const receiptNo = `FO-ENR-${Date.now()}-${seq}`;

      await prisma.$transaction(async (tx) => {
        const leadRecord = existingLead
          ? await tx.lead.update({ where: { id: existingLead.id }, data: { status: 'WON', convertedAt: date } })
          : await tx.lead.create({
              data: {
                name: row.name, phone: phoneDigits || null, status: 'WON', source: 'OTHER',
                interestedCourse: courseRecord.courseId, convertedAt: date,
              },
            });

        const studentCode = await nextStudentCode(tx, date, courseRecord.courseId === 'INTERNSHIP');
        const enr = await tx.enrollment.create({
          data: {
            studentCode, leadId: leadRecord.id, courseId: courseRecord.id,
            courseFee: netFee, discountAmount: 0, netFee,
            paidAmount: 0, balanceDue: netFee, receiptNo, paymentStatus: 'PENDING', enrolledAt: date,
          },
        });

        if (amount > 0) {
          const receiptNumber = `FO-${date.getFullYear()}-${Date.now().toString().slice(-6)}-${seq}`;
          await tx.payment.create({
            data: {
              enrollmentId: enr.id, amount, method: 'CASH', receiptNumber,
              remarks: 'Registration fee - imported', bankAccount: 'CASH',
              collectedById: req.user.id, paidAt: date,
            },
          });
          const newBalance = netFee - amount;
          await tx.enrollment.update({
            where: { id: enr.id },
            data: { paidAmount: amount, balanceDue: newBalance, paymentStatus: newBalance <= 0 ? 'PAID' : 'PARTIAL' },
          });
        }
      });
      created++;
    }

    res.json({ message: 'Import complete', created, skipped });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/enrollments/quick-add — add an existing/walk-in student with enrollment + optional opening payment in one step
router.post('/quick-add', [
  body('name').trim().isLength({ min: 2 }),
  body('phone').optional({ checkFalsy: true }).trim(),
  body('courseId').notEmpty(),
  body('courseFee').isFloat({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const {
      name, phone, email, city,
      courseId: rawCourseId, batchId, enrollmentDate,
      courseFee, discountAmount = 0, installments = 1,
      payment,
    } = req.body;
    const phoneTrimmed = phone ? phone.trim() : null;

    const courseRecord = /^[A-Z][A-Z0-9_]+$/.test(rawCourseId)
      ? await prisma.course.findFirst({ where: { courseId: rawCourseId } })
      : await prisma.course.findUnique({ where: { id: rawCourseId } });
    if (!courseRecord) return res.status(404).json({ error: `Course '${rawCourseId}' not found` });

    const existingLead = phoneTrimmed
      ? await prisma.lead.findUnique({ where: { phone: phoneTrimmed }, include: { enrollment: true } })
      : null;
    if (existingLead?.enrollment) {
      return res.status(409).json({ error: `${existingLead.name} is already enrolled`, enrollmentId: existingLead.enrollment.id });
    }

    const netFee = Math.max(0, Number(courseFee) - (Number(discountAmount) || 0));
    const receiptNo = `FO-ENR-${Date.now()}`;
    const numInstallments = Math.min(12, Math.max(1, Number(installments) || 1));
    const enrolledAt = enrollmentDate ? new Date(enrollmentDate) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      const leadRecord = existingLead
        ? await tx.lead.update({ where: { id: existingLead.id }, data: { status: 'WON', convertedAt: new Date() } })
        : await tx.lead.create({
            data: {
              name: name.trim(), phone: phoneTrimmed, email: email || null, city: city || null,
              status: 'WON', source: 'OTHER', interestedCourse: courseRecord.courseId, convertedAt: new Date(),
            },
          });

      const studentCode = await nextStudentCode(tx, enrolledAt, courseRecord.courseId === 'INTERNSHIP');
      const enr = await tx.enrollment.create({
        data: {
          studentCode,
          leadId: leadRecord.id,
          courseId: courseRecord.id,
          batchId: batchId || null,
          courseFee: Number(courseFee),
          discountAmount: Number(discountAmount) || 0,
          netFee,
          paidAmount: 0,
          balanceDue: netFee,
          receiptNo,
          paymentStatus: 'PENDING',
          enrolledAt,
        },
      });

      if (numInstallments > 1) {
        const instAmt = Math.floor(netFee / numInstallments);
        const remainder = netFee - instAmt * numInstallments;
        for (let i = 1; i <= numInstallments; i++) {
          const dueDate = new Date(enrolledAt);
          dueDate.setMonth(dueDate.getMonth() + (i - 1));
          await tx.installment.create({
            data: { enrollmentId: enr.id, installmentNo: i, amount: i === 1 ? instAmt + remainder : instAmt, dueDate, status: i === 1 ? 'DUE' : 'UPCOMING' },
          });
        }
      }

      let paymentRecord = null;
      if (payment && Number(payment.amount) > 0) {
        const paidAmount = Number(payment.amount);
        const receiptNumber = `FO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
        paymentRecord = await tx.payment.create({
          data: {
            enrollmentId: enr.id,
            amount: paidAmount,
            method: payment.method || 'CASH',
            transactionId: payment.transactionId || null,
            receiptNumber,
            remarks: payment.remarks || 'Opening balance entry',
            bankAccount: payment.receivedIn || 'CASH',
            paidAt: payment.date ? new Date(payment.date) : new Date(),
            collectedById: req.user.id,
          },
        });
        const newBalance = netFee - paidAmount;
        await tx.enrollment.update({
          where: { id: enr.id },
          data: { paidAmount, balanceDue: newBalance, paymentStatus: newBalance <= 0 ? 'PAID' : 'PARTIAL' },
        });
      }

      return { enrollment: enr, payment: paymentRecord, lead: leadRecord };
    });

    await logActivity(result.lead.id, req.user.id, 'ENROLLED', { course: courseRecord.name, quickAdd: true });
    res.status(201).json({ enrollmentId: result.enrollment.id, message: 'Student added successfully!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', [
  body('leadId').notEmpty(),
  body('courseId').notEmpty(),
  body('courseFee').isFloat({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { leadId, courseId: rawCourseId, batchId, courseFee, discountAmount = 0, discountReason, installments = 1, scholarshipName, scholarshipPct, payment } = req.body;

    // Resolve courseId: accept both Course.id (cuid) and CourseId enum (e.g. AI_ENGINEERING)
    const courseRecord = /^[A-Z][A-Z0-9_]+$/.test(rawCourseId)
      ? await prisma.course.findFirst({ where: { courseId: rawCourseId } })
      : await prisma.course.findUnique({ where: { id: rawCourseId } });
    if (!courseRecord) return res.status(404).json({ error: `Course '${rawCourseId}' not found` });
    const courseId = courseRecord.id;

    const existing = await prisma.enrollment.findUnique({ where: { leadId } });
    if (existing) return res.status(409).json({ error: 'Lead already enrolled', enrollmentId: existing.id });

    const netFee = courseFee - discountAmount;
    const receiptNo = `FO-ENR-${Date.now()}`;

    const enrollment = await prisma.$transaction(async (tx) => {
      const studentCode = await nextStudentCode(tx, new Date(), courseRecord.courseId === 'INTERNSHIP');
      const enr = await tx.enrollment.create({
        data: { studentCode, leadId, courseId, batchId: batchId || null, courseFee, discountAmount, discountReason, netFee, paidAmount: 0, balanceDue: netFee, receiptNo, scholarshipName, scholarshipPct, paymentStatus: 'PENDING' },
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

      let enrWithPayment = enr;
      if (payment && Number(payment.amount) > 0) {
        const regAmount = Number(payment.amount);
        const receiptNumber = `FO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
        await tx.payment.create({
          data: {
            enrollmentId: enr.id,
            amount: regAmount,
            method: payment.method || 'CASH',
            transactionId: payment.transactionId || null,
            receiptNumber,
            remarks: payment.remarks || 'Registration fee - admission confirmed',
            bankAccount: payment.receivedIn || 'CASH',
            collectedById: req.user.id,
          },
        });
        const newBalance = netFee - regAmount;
        enrWithPayment = await tx.enrollment.update({
          where: { id: enr.id },
          data: { paidAmount: regAmount, balanceDue: newBalance, paymentStatus: newBalance <= 0 ? 'PAID' : 'PARTIAL' },
          include: { course: true, lead: true },
        });
        if (installments > 1) {
          const firstInstallment = await tx.installment.findFirst({ where: { enrollmentId: enr.id, installmentNo: 1 } });
          if (firstInstallment && regAmount >= firstInstallment.amount) {
            await tx.installment.update({ where: { id: firstInstallment.id }, data: { status: 'PAID', paidAt: new Date() } });
          }
        }
      }

      await tx.lead.update({ where: { id: leadId }, data: { status: 'WON', convertedAt: new Date() } });
      return enrWithPayment;
    });

    await logActivity(leadId, req.user.id, 'ENROLLED', { course: enrollment.course.name });
    res.status(201).json(enrollment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 25, status, courseId, paymentStatus, leadId, search, batchId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    if (leadId) where.leadId = leadId;
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (batchId) where.batchId = batchId;
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
          course: { select: { courseId: true, name: true, shortName: true } },
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

// PATCH /api/enrollments/:id/enrolled-date — correct a mistaken enrollment date
// (common after bulk Excel imports). If the corrected date falls in a different
// financial year than the one the student's number was issued under, the student
// code is re-issued for the correct FY bucket instead of silently going stale —
// otherwise "fixing" the date would leave a student numbered under the wrong year.
router.patch('/:id/enrolled-date', authorize('SUPER_ADMIN', 'ADMIN'), [
  body('enrolledAt').isISO8601(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { id } = req.params;
    const newDate = new Date(req.body.enrolledAt);

    const enrollment = await prisma.enrollment.findUnique({ where: { id }, include: { course: true, lead: { select: { id: true, name: true } } } });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

    const isInternship = enrollment.course.courseId === 'INTERNSHIP';
    const fyChanged = getFYCode(enrollment.enrolledAt) !== getFYCode(newDate);

    const updated = await prisma.$transaction(async (tx) => {
      let studentCode = enrollment.studentCode;
      if (fyChanged) {
        await releaseStudentCode(tx, enrollment.studentCode);
        studentCode = await nextStudentCode(tx, newDate, isInternship);
      }
      return tx.enrollment.update({ where: { id }, data: { enrolledAt: newDate, studentCode } });
    });

    await logActivity(enrollment.lead.id, req.user.id, 'ENROLLMENT_DATE_CORRECTED', {
      studentName: enrollment.lead.name,
      oldDate: enrollment.enrolledAt, newDate,
      oldCode: enrollment.studentCode, newCode: updated.studentCode,
    });

    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/enrollments/:id/refund — money paid back to a student (e.g. registered,
// paid, then didn't join). Reduces the enrollment's paid/balance figures and logs
// the outflow as an Expense (category: Refund) so it shows in the financial reports,
// same as any other money leaving the institute.
router.post('/:id/refund', authorize('SUPER_ADMIN', 'ADMIN'), [
  body('amount').isFloat({ min: 0.01 }),
  body('reason').trim().notEmpty(),
  body('bankAccount').isIn(['HDFC', 'ICICI', 'IDFC', 'CASH']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { id } = req.params;
    const { amount, reason, bankAccount, method, markDropped, date } = req.body;
    const refundAmount = Number(amount);

    const enrollment = await prisma.enrollment.findUnique({
      where: { id },
      include: { lead: { select: { id: true, name: true } } },
    });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });
    if (refundAmount > enrollment.paidAmount + 1) {
      return res.status(400).json({ error: `Refund amount (₹${refundAmount}) exceeds what this student has paid (₹${enrollment.paidAmount})` });
    }

    const refundDate = date ? new Date(date) : new Date();
    const newPaid = Math.max(0, enrollment.paidAmount - refundAmount);
    const newBalance = enrollment.netFee - newPaid;
    const newStatus = newPaid <= 0 ? 'PENDING' : newBalance <= 0 ? 'PAID' : 'PARTIAL';

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.enrollment.update({
        where: { id },
        data: {
          paidAmount: newPaid, balanceDue: newBalance, paymentStatus: newStatus,
          ...(markDropped ? { status: 'DROPPED' } : {}),
        },
      });
      const expense = await tx.expense.create({
        data: {
          category: 'Refund', amount: refundAmount, date: refundDate,
          paymentMethod: method || 'Cash', vendor: enrollment.lead.name,
          notes: `Refund to ${enrollment.lead.name} (${enrollment.receiptNo}) — ${reason}`,
          bankAccount, addedById: req.user.id,
        },
      });
      return { updated, expense };
    });

    await logActivity(enrollment.lead.id, req.user.id, 'REFUND_ISSUED', {
      amount: refundAmount, reason, markDropped: !!markDropped,
    });

    res.json({ message: 'Refund processed', enrollment: result.updated, expense: result.expense });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const enrollment = await prisma.enrollment.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true } },
        _count: { select: { payments: true, certificates: true } },
      },
    });
    if (!enrollment) return res.status(404).json({ error: 'Enrollment not found' });

    const hasPayments = enrollment._count.payments > 0;
    if (hasPayments && req.query.confirm !== 'true') {
      return res.status(409).json({
        error: `This student has ${enrollment._count.payments} recorded payment(s) totalling ₹${enrollment.paidAmount}. Deleting will permanently remove that payment history too.`,
        requiresConfirmation: true,
        paymentsCount: enrollment._count.payments,
        totalPaid: enrollment.paidAmount,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupPaymentStudent.deleteMany({ where: { enrollmentId: id } });
      await tx.payment.deleteMany({ where: { enrollmentId: id } });
      await tx.certificate.deleteMany({ where: { enrollmentId: id } });
      await tx.installment.deleteMany({ where: { enrollmentId: id } });
      await tx.document.deleteMany({ where: { enrollmentId: id } });
      await tx.enrollment.delete({ where: { id } });
      await tx.lead.update({ where: { id: enrollment.lead.id }, data: { status: 'QUALIFIED', convertedAt: null } });
      await releaseStudentCode(tx, enrollment.studentCode);
    });

    await logActivity(enrollment.lead.id, req.user.id, 'ENROLLMENT_DELETED', {
      studentName: enrollment.lead.name, paymentsDeleted: enrollment._count.payments, totalPaid: enrollment.paidAmount,
    });
    res.json({ message: 'Enrollment deleted' });
  } catch (err) { console.error('Delete enrollment error:', err); res.status(500).json({ error: err.message }); }
});

export default router;
