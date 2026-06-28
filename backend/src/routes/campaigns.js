import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
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
router.delete('/:id', authorize('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (campaign.sentAt) return res.status(400).json({ error: 'Cannot delete a campaign that has already been sent' });
    await prisma.whatsAppMessage.deleteMany({ where: { campaignId: req.params.id } });
    await prisma.campaign.delete({ where: { id: req.params.id } });
    res.json({ message: 'Campaign deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
export default router;
