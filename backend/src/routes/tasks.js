// routes/tasks.js
import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
const router = express.Router();
router.use(authenticate);
router.get('/', async (req, res) => {
  try {
    const { status, priority, assignedTo } = req.query;
    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    where.assignedToId = req.user.role === 'COUNSELOR' ? req.user.id : (assignedTo || undefined);
    const tasks = await prisma.task.findMany({ where, orderBy: { dueAt: 'asc' }, include: { lead: { select: { name: true, phone: true } }, assignedTo: { select: { name: true } } } });
    res.json(tasks);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/', async (req, res) => {
  try {
    const task = await prisma.task.create({ data: { ...req.body, assignedToId: req.body.assignedToId || req.user.id } });
    res.status(201).json(task);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.patch('/:id', async (req, res) => {
  try {
    const task = await prisma.task.update({ where: { id: req.params.id }, data: { ...req.body, ...(req.body.status === 'DONE' ? { completedAt: new Date() } : {}) } });
    res.json(task);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ message: 'Task deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
export default router;
