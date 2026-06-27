import express from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// GET /api/courses
router.get('/', async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      where: { isActive: true },
      include: { _count: { select: { enrollments: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(courses);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/courses - Admin only
router.post('/', authorize('SUPER_ADMIN', 'ADMIN'), [
  body('courseId').notEmpty().isIn(['AI_ENGINEERING','DATA_SCIENCE_AI','AI_CYBERSECURITY','PYTHON_FULLSTACK','VIBE_CODING_SAAS','DATA_ANALYTICS','BUSINESS_ANALYTICS']),
  body('name').notEmpty(),
  body('shortName').notEmpty(),
  body('duration').notEmpty(),
  body('totalHours').isInt({ min: 1 }),
  body('fees').isFloat({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { courseId, name, shortName, description, duration, totalHours, fees, emiAvailable = true, maxInstallments = 6, highlights = [] } = req.body;
    const course = await prisma.course.upsert({
      where: { courseId },
      update: { name, shortName, description, duration, totalHours: parseInt(totalHours), fees: parseFloat(fees), emiAvailable, maxInstallments: parseInt(maxInstallments), highlights, isActive: true },
      create: { courseId, name, shortName, description, duration, totalHours: parseInt(totalHours), fees: parseFloat(fees), emiAvailable, maxInstallments: parseInt(maxInstallments), highlights },
    });
    res.status(201).json(course);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/courses/:id - Admin only
router.patch('/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { name, shortName, description, duration, totalHours, fees, emiAvailable, maxInstallments, highlights, isActive } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (shortName !== undefined) data.shortName = shortName;
    if (description !== undefined) data.description = description;
    if (duration !== undefined) data.duration = duration;
    if (totalHours !== undefined) data.totalHours = parseInt(totalHours);
    if (fees !== undefined) data.fees = parseFloat(fees);
    if (emiAvailable !== undefined) data.emiAvailable = emiAvailable;
    if (maxInstallments !== undefined) data.maxInstallments = parseInt(maxInstallments);
    if (highlights !== undefined) data.highlights = highlights;
    if (isActive !== undefined) data.isActive = isActive;
    const course = await prisma.course.update({ where: { id: req.params.id }, data });
    res.json(course);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/courses/batches - All batches
router.get('/batches', async (req, res) => {
  try {
    const { courseId, isActive } = req.query;
    const where = {};
    if (courseId) where.courseId = courseId;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    const batches = await prisma.batch.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: {
        course: { select: { name: true, shortName: true } },
        _count: { select: { enrollments: true } },
      },
    });
    res.json(batches);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/courses/batches - Create batch
router.post('/batches', authorize('SUPER_ADMIN', 'ADMIN'), [
  body('courseId').notEmpty(),
  body('batchName').notEmpty(),
  body('mode').isIn(['ONLINE', 'OFFLINE', 'HYBRID']),
  body('startDate').isISO8601(),
  body('timings').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { courseId, batchName, mode, startDate, endDate, timings, capacity = 30, venue, facultyName } = req.body;
    const batch = await prisma.batch.create({
      data: {
        courseId,
        batchName,
        mode,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        timings,
        capacity: parseInt(capacity),
        venue,
        facultyName,
      },
      include: { course: { select: { name: true, shortName: true } } },
    });
    res.status(201).json(batch);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/courses/:id/batches - Batches for a specific course
router.get('/:id/batches', async (req, res) => {
  try {
    const batches = await prisma.batch.findMany({
      where: { courseId: req.params.id, isActive: true },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { enrollments: true } } },
    });
    res.json(batches);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/courses/batches/:id - Update batch
router.patch('/batches/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { batchName, mode, startDate, endDate, timings, capacity, venue, facultyName, isActive } = req.body;
    const data = {};
    if (batchName !== undefined) data.batchName = batchName;
    if (mode !== undefined) data.mode = mode;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (timings !== undefined) data.timings = timings;
    if (capacity !== undefined) data.capacity = parseInt(capacity);
    if (venue !== undefined) data.venue = venue;
    if (facultyName !== undefined) data.facultyName = facultyName;
    if (isActive !== undefined) data.isActive = isActive;
    const batch = await prisma.batch.update({
      where: { id: req.params.id },
      data,
      include: { course: { select: { name: true, shortName: true } } },
    });
    res.json(batch);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
