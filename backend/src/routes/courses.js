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

// Attach resolved Course details (name/shortName) for each batch's combinedCourseIds enum array
async function attachCombinedCourseDetails(batches) {
  const list = Array.isArray(batches) ? batches : [batches];
  const allIds = [...new Set(list.flatMap(b => b.combinedCourseIds || []))];
  if (!allIds.length) return list.map(b => ({ ...b, combinedCourseDetails: [] }));
  const courseRecords = await prisma.course.findMany({
    where: { courseId: { in: allIds } },
    select: { id: true, courseId: true, name: true, shortName: true },
  });
  const map = Object.fromEntries(courseRecords.map(c => [c.courseId, c]));
  return list.map(b => ({ ...b, combinedCourseDetails: (b.combinedCourseIds || []).map(cid => map[cid]).filter(Boolean) }));
}

function computeSplitDate({ isCombined, splitDate, splitAfterMonths, startDate }) {
  if (!isCombined) return null;
  if (splitDate) return new Date(splitDate);
  if (splitAfterMonths) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + parseInt(splitAfterMonths));
    return d;
  }
  return null;
}

// GET /api/courses/batches - All batches
router.get('/batches', async (req, res) => {
  try {
    const { courseId, isActive, isCombined } = req.query;
    const where = {};
    if (courseId) where.courseId = courseId;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (isCombined !== undefined) where.isCombined = isCombined === 'true';
    const batches = await prisma.batch.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: {
        course: { select: { name: true, shortName: true } },
        _count: { select: { enrollments: true } },
      },
    });
    res.json(await attachCombinedCourseDetails(batches));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/courses/batches - Create batch (supports combined/joint batches)
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
    const {
      courseId, batchName, mode, startDate, endDate, timings, capacity = 30, venue, facultyName,
      isCombined = false, combinedCourseIds = [], splitAfterMonths, splitDate, combinedBatchNote,
    } = req.body;

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
        isCombined: Boolean(isCombined),
        combinedCourseIds: isCombined ? combinedCourseIds : [],
        splitAfterMonths: isCombined && splitAfterMonths ? parseInt(splitAfterMonths) : null,
        splitDate: computeSplitDate({ isCombined, splitDate, splitAfterMonths, startDate }),
        combinedBatchNote: isCombined ? (combinedBatchNote || null) : null,
      },
      include: { course: { select: { name: true, shortName: true } } },
    });

    const [enriched] = await attachCombinedCourseDetails(batch);
    res.status(201).json({ ...enriched, combinedCourses: enriched.combinedCourseDetails });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/courses/batches/:id/combined-courses - Courses combined into this batch
router.get('/batches/:id/combined-courses', async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: req.params.id },
      include: { course: true },
    });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const additionalCourses = batch.combinedCourseIds?.length
      ? await prisma.course.findMany({ where: { courseId: { in: batch.combinedCourseIds } } })
      : [];

    res.json({
      batchId: batch.id,
      batchName: batch.batchName,
      isCombined: batch.isCombined,
      primaryCourse: batch.course,
      additionalCourses,
      allCourses: [batch.course, ...additionalCourses],
      splitAfterMonths: batch.splitAfterMonths,
      splitDate: batch.splitDate,
      combinedBatchNote: batch.combinedBatchNote,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/courses/:id/batches - Batches for a specific course (includes combined batches this course shares in)
router.get('/:id/batches', async (req, res) => {
  try {
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const batches = await prisma.batch.findMany({
      where: {
        isActive: true,
        OR: [
          { courseId: req.params.id },
          { isCombined: true, combinedCourseIds: { has: course.courseId } },
        ],
      },
      orderBy: { startDate: 'desc' },
      include: {
        course: { select: { name: true, shortName: true } },
        _count: { select: { enrollments: true } },
      },
    });
    res.json(await attachCombinedCourseDetails(batches));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/courses/batches/:id - Update batch
router.patch('/batches/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const {
      batchName, mode, startDate, endDate, timings, capacity, venue, facultyName, isActive,
      isCombined, combinedCourseIds, splitAfterMonths, splitDate, combinedBatchNote,
    } = req.body;
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
    if (isCombined !== undefined) data.isCombined = Boolean(isCombined);
    if (combinedCourseIds !== undefined) data.combinedCourseIds = combinedCourseIds;
    if (splitAfterMonths !== undefined) data.splitAfterMonths = splitAfterMonths ? parseInt(splitAfterMonths) : null;
    if (splitDate !== undefined) data.splitDate = splitDate ? new Date(splitDate) : null;
    if (combinedBatchNote !== undefined) data.combinedBatchNote = combinedBatchNote || null;
    const batch = await prisma.batch.update({
      where: { id: req.params.id },
      data,
      include: { course: { select: { name: true, shortName: true } } },
    });
    const [enriched] = await attachCombinedCourseDetails(batch);
    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
