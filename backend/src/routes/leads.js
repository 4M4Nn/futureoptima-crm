import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { scoreLeadWithOllama } from '../services/ollamaService.js';
import { logActivity } from '../utils/activityLogger.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 25, search, status, course, grade, assignedTo, source, from, to, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (parseInt(page) - 1) * Math.min(parseInt(limit), 100);
    const take = Math.min(parseInt(limit), 100);
    const where = {};
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
    if (status) where.status = status;
    if (course) where.interestedCourse = course;
    if (grade) where.aiGrade = grade;
    if (source) where.source = source;
    if (assignedTo) where.assignedToId = assignedTo;
    if (from || to) { where.createdAt = {}; if (from) where.createdAt.gte = new Date(from); if (to) where.createdAt.lte = new Date(to); }
    if (req.user.role === 'COUNSELOR') where.assignedToId = req.user.id;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where, skip, take, orderBy: { [sortBy]: sortOrder },
        select: {
          id: true, name: true, phone: true, email: true, city: true, status: true, source: true,
          interestedCourse: true, aiGrade: true, aiScore: true, nextFollowUpAt: true,
          createdAt: true, lastContactAt: true, assignedTo: { select: { id: true, name: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);
    res.json({ data: leads, pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const [total, hot, warm, cold, won, followUpsDue, newToday] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { aiGrade: 'HOT' } }),
      prisma.lead.count({ where: { aiGrade: 'WARM' } }),
      prisma.lead.count({ where: { aiGrade: 'COLD' } }),
      prisma.lead.count({ where: { status: 'WON' } }),
      prisma.lead.count({ where: { nextFollowUpAt: { lte: new Date() }, status: { notIn: ['WON', 'LOST'] } } }),
      prisma.lead.count({ where: { createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
    ]);
    const [statusBreakdown, courseBreakdown, sourceBreakdown] = await Promise.all([
      prisma.lead.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.lead.groupBy({ by: ['interestedCourse'], _count: { id: true }, where: { interestedCourse: { not: null } } }),
      prisma.lead.groupBy({ by: ['source'], _count: { id: true } }),
    ]);
    res.json({ total, hot, warm, cold, won, followUpsDue, newToday, conversionRate: total > 0 ? ((won / total) * 100).toFixed(2) : 0, statusBreakdown, courseBreakdown, sourceBreakdown });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
        tasks: { orderBy: { dueAt: 'asc' } },
        calls: { include: { calledBy: { select: { name: true } } }, orderBy: { calledAt: 'desc' }, take: 20 },
        whatsappMessages: { orderBy: { createdAt: 'desc' }, take: 20 },
        enrollment: { include: { course: true, payments: true, installments: { orderBy: { installmentNo: 'asc' } } } },
        activities: { orderBy: { createdAt: 'desc' }, take: 30 },
        aiSessions: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', [
  body('name').trim().isLength({ min: 2 }),
  body('phone').notEmpty().trim(),
  body('email').optional().isEmail().normalizeEmail(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const existing = await prisma.lead.findUnique({ where: { phone: req.body.phone } });
    if (existing) return res.status(409).json({ error: 'Lead with this phone already exists', leadId: existing.id });
    const lead = await prisma.lead.create({
      data: { ...req.body, assignedToId: req.body.assignedToId || (req.user.role === 'COUNSELOR' ? req.user.id : undefined) },
    });
    await logActivity(lead.id, req.user.id, 'LEAD_CREATED', { source: req.body.source });
    scoreLeadWithOllama(lead.id).catch(console.error);
    res.status(201).json(lead);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const prev = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!prev) return res.status(404).json({ error: 'Lead not found' });
    const lead = await prisma.lead.update({ where: { id: req.params.id }, data: req.body });
    if (req.body.status && req.body.status !== prev.status) {
      await logActivity(lead.id, req.user.id, 'STATUS_CHANGED', { from: prev.status, to: req.body.status });
    }
    res.json(lead);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    await prisma.lead.update({ where: { id: req.params.id }, data: { status: 'LOST' } });
    res.json({ message: 'Lead archived' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/notes', async (req, res) => {
  try {
    const note = await prisma.note.create({
      data: { leadId: req.params.id, authorId: req.user.id, content: req.body.content, isPrivate: req.body.isPrivate || false },
      include: { author: { select: { name: true } } },
    });
    res.status(201).json(note);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/calls', async (req, res) => {
  try {
    const call = await prisma.callLog.create({
      data: { leadId: req.params.id, calledById: req.user.id, duration: req.body.duration, outcome: req.body.outcome, notes: req.body.notes },
    });
    await prisma.lead.update({ where: { id: req.params.id }, data: { lastContactAt: new Date() } });
    await logActivity(req.params.id, req.user.id, 'CALL_LOGGED', { outcome: req.body.outcome });
    res.status(201).json(call);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
