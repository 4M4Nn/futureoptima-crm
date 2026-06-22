import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      where: { isActive: true },
      include: { _count: { select: { enrollments: true } } },
    });
    res.json(courses);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/batches', async (req, res) => {
  try {
    const batches = await prisma.batch.findMany({
      where: { courseId: req.params.id, isActive: true },
      include: { _count: { select: { enrollments: true } } },
    });
    res.json(batches);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batches', async (req, res) => {
  try {
    const batch = await prisma.batch.create({ data: req.body });
    res.status(201).json(batch);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
