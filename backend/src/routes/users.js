import express from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = express.Router();
router.use(authenticate);
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true }, orderBy: { name: 'asc' } });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/', authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    const passwordHash = await bcrypt.hash(password || 'Password@123', 12);
    const user = await prisma.user.create({ data: { name, email, phone, passwordHash, role: role || 'COUNSELOR' }, select: { id: true, name: true, email: true, role: true } });
    res.status(201).json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.patch('/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const data = { ...rest };
    if (password) data.passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.update({ where: { id: req.params.id }, data, select: { id: true, name: true, email: true, role: true, isActive: true } });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
export default router;
