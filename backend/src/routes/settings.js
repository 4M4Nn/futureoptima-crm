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
router.post('/clear-data', authorize('SUPER_ADMIN'), async (req, res) => {
  try {
    const { confirmation } = req.body;
    if (confirmation !== 'DELETE ALL') {
      return res.status(400).json({ error: 'Invalid confirmation. Type "DELETE ALL" to confirm.' });
    }
    await prisma.aICommand.deleteMany();
    await prisma.aISession.deleteMany();
    await prisma.activityLog.deleteMany();
    await prisma.whatsAppMessage.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.certificate.deleteMany();
    await prisma.document.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.installment.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.callLog.deleteMany();
    await prisma.note.deleteMany();
    await prisma.task.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.salaryRecord.deleteMany();
    res.json({ message: 'All data cleared successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
export default router;
