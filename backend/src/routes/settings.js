import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
const router = express.Router();
router.use(authenticate);
router.get('/', async (req, res) => {
  try {
    const settings = await prisma.systemSettings.findMany();
    const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
    res.json(map);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.put('/', authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const updates = Object.entries(req.body);
    for (const [key, value] of updates) {
      await prisma.systemSettings.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
    }
    res.json({ message: 'Settings updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
export default router;
