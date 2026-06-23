import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { askCRMAssistant, suggestReply, scoreLeadWithOllama, checkOllamaHealth, batchScoreLeads } from '../services/ollamaService.js';

const router = express.Router();

// PUBLIC - no auth needed
router.get('/health', async (req, res) => {
  try {
    console.log('Groq API Key exists:', !!process.env.GROQ_API_KEY);
    console.log('Groq API Key starts with:', process.env.GROQ_API_KEY?.substring(0, 10));
    const health = await checkOllamaHealth();
    res.json(health);
  } catch (err) {
    res.json({ running: false, error: err.message });
  }
});

// PROTECTED - auth required
router.use(authenticate);

router.post('/chat', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question required' });
    const response = await askCRMAssistant(question, req.user.id);
    res.json({ response });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/score/:leadId', async (req, res) => {
  try { res.json(await scoreLeadWithOllama(req.params.leadId) || { message: 'Scoring complete' }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/suggest-reply/:leadId', async (req, res) => {
  try { res.json({ reply: await suggestReply(req.params.leadId, req.body.context) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batch-score', async (req, res) => {
  batchScoreLeads(req.body.limit || 50).catch(console.error);
  res.json({ message: 'Batch scoring started' });
});

export default router;
