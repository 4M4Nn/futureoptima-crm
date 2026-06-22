import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sendCampaign } from '../services/whatsappService.js';
const router = express.Router();
router.use(authenticate);
router.get('/', async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: 'desc' }, include: { createdBy: { select: { name: true } }, _count: { select: { messages: true, leads: true } } } });
    res.json(campaigns);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/', async (req, res) => {
  try {
    const campaign = await prisma.campaign.create({ data: { ...req.body, createdById: req.user.id } });
    res.status(201).json(campaign);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/:id/send', async (req, res) => {
  try {
    sendCampaign(req.params.id).catch(console.error);
    res.json({ message: 'Campaign sending started' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
export default router;
