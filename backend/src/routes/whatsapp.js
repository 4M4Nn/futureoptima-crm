import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

router.get('/messages', async (req, res) => {
  try {
    const { leadId, page = 1, limit = 25 } = req.query;
    const where = leadId ? { leadId } : {};
    const [data, total] = await Promise.all([
      prisma.whatsAppMessage.findMany({
        where,
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { lead: { select: { name: true, phone: true } } },
      }),
      prisma.whatsAppMessage.count({ where }),
    ]);
    res.json({ data, pagination: { page: parseInt(page), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/send', async (req, res) => {
  try {
    const { leadId, message } = req.body;
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const msg = await prisma.whatsAppMessage.create({
      data: { leadId, to: lead.phone, body: message, status: 'QUEUED' },
    });
    res.json({ success: true, message: 'Message queued. Send manually via WhatsApp.', id: msg.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
