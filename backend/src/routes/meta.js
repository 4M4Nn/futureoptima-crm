import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { scoreLeadWithOllama } from '../services/ollamaService.js';
import { logActivity } from '../utils/activityLogger.js';

const router = express.Router();

const COURSE_MAP = {
  'ai engineering': 'AI_ENGINEERING',
  'ai engineering & automation': 'AI_ENGINEERING',
  'artificial intelligence': 'AI_ENGINEERING',
  'ai automation': 'AI_ENGINEERING',
  'ai': 'AI_ENGINEERING',
  'data science': 'DATA_SCIENCE_AI',
  'data science with ai': 'DATA_SCIENCE_AI',
  'cybersecurity': 'AI_CYBERSECURITY',
  'ai cybersecurity': 'AI_CYBERSECURITY',
  'ai-powered cybersecurity': 'AI_CYBERSECURITY',
  'cyber security': 'AI_CYBERSECURITY',
  'python': 'PYTHON_FULLSTACK',
  'python full stack': 'PYTHON_FULLSTACK',
  'python full stack with ai': 'PYTHON_FULLSTACK',
  'python fullstack': 'PYTHON_FULLSTACK',
  'fullstack': 'PYTHON_FULLSTACK',
  'vibe coding': 'VIBE_CODING_SAAS',
  'vibe coding & saas': 'VIBE_CODING_SAAS',
  'vibe coding & saas development': 'VIBE_CODING_SAAS',
  'saas': 'VIBE_CODING_SAAS',
  'vibe': 'VIBE_CODING_SAAS',
  'data analytics': 'DATA_ANALYTICS',
  'analytics': 'DATA_ANALYTICS',
  'business analytics': 'BUSINESS_ANALYTICS',
  'business': 'BUSINESS_ANALYTICS',
};

function detectCourse(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes('data science')) return 'DATA_SCIENCE_AI';
  if (lower.includes('ai') || lower.includes('artificial')) return 'AI_ENGINEERING';
  if (lower.includes('cyber')) return 'AI_CYBERSECURITY';
  if (lower.includes('python')) return 'PYTHON_FULLSTACK';
  if (lower.includes('vibe') || lower.includes('saas')) return 'VIBE_CODING_SAAS';
  if (lower.includes('analytics')) return 'DATA_ANALYTICS';
  if (lower.includes('business')) return 'BUSINESS_ANALYTICS';
  if (lower.includes('data')) return 'DATA_ANALYTICS';
  return null;
}

function cleanPhone(rawPhone) {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits.slice(-10);
}

function mapCourse(courseStr) {
  if (!courseStr) return null;
  const lower = courseStr.toLowerCase().trim();
  // Sort longest keys first so specific phrases match before generic ones (e.g. "python full stack" before "ai")
  const sorted = Object.entries(COURSE_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [key, val] of sorted) {
    if (lower.includes(key)) return val;
  }
  return null;
}

async function fetchLeadFromGraph(leadgenId) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error('META_ACCESS_TOKEN not set in .env');
  const url = `https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Graph API ${res.status}: ${errBody}`);
  }
  return res.json();
}

// GET /api/meta/webhook — Facebook webhook verification
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.status(403).send('Verification failed');
});

// POST /api/meta/webhook — receive Facebook & Instagram lead ads
router.post('/webhook', async (req, res) => {
  // Respond 200 immediately — Meta requires fast response
  res.status(200).json({ status: 'ok' });

  try {
    const { entry = [] } = req.body;
    for (const e of entry) {
      for (const change of e.changes || []) {
        if (change.field !== 'leadgen') continue;
        const value = change.value || {};
        const leadgenId = value.leadgen_id;
        if (!leadgenId) continue;

        const source = value.ad_id ? 'FACEBOOK_ADS' : 'INSTAGRAM';

        let fields = {};
        try {
          const graphData = await fetchLeadFromGraph(leadgenId);
          for (const f of graphData.field_data || []) {
            fields[f.name] = f.values?.[0] || '';
          }
        } catch (err) {
          console.error('[Meta] Graph API failed, using webhook body:', err.message);
          for (const f of value.field_data || []) {
            fields[f.name] = f.values?.[0] || '';
          }
        }

        const firstName = fields.first_name || '';
        const lastName = fields.last_name || '';
        const name = fields.full_name || fields.name ||
          (firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Unknown Lead');
        const rawPhone = fields.phone_number || fields.phone || '';
        const phone = rawPhone.replace(/\D/g, '').slice(-10);
        const email = fields.email || fields.email_address || null;
        const courseStr = fields.course_interest ||
          fields.which_course_are_you_interested_in_ ||
          fields.which_course_are_you_interested_in ||
          fields.interested_course ||
          fields.course || null;

        if (!phone || phone.length < 10) {
          console.error('[Meta] Invalid phone:', { name, rawPhone, leadgenId });
          continue;
        }

        const existing = await prisma.lead.findUnique({ where: { phone } });
        if (existing) {
          console.log(`[Meta] Lead already exists: ${phone}`);
          continue;
        }

        const lead = await prisma.lead.create({
          data: {
            name,
            phone,
            email: email || undefined,
            source,
            interestedCourse: mapCourse(courseStr) || undefined,
            status: 'NEW',
          },
        });

        console.log(`[Meta] ✅ Lead created: ${lead.name} (${lead.phone}) source=${source}`);
        scoreLeadWithOllama(lead.id).catch(err =>
          console.error('[Meta] AI scoring error:', err.message)
        );
      }
    }
  } catch (err) {
    console.error('[Meta] Webhook processing error:', err.message);
  }
});

// POST /api/meta/whatsapp-lead — manually add lead from WhatsApp conversation
router.post('/whatsapp-lead', authenticate, async (req, res) => {
  try {
    const { name, phone, message, source, interestedCourse } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });

    const existing = await prisma.lead.findUnique({ where: { phone: phone.trim() } });
    if (existing) return res.status(409).json({ error: 'Lead already exists', leadId: existing.id });

    const lead = await prisma.lead.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        source: source === 'INSTAGRAM' ? 'INSTAGRAM' : 'FACEBOOK_ADS',
        interestedCourse: interestedCourse || null,
        status: 'NEW',
        assignedToId: req.user.id,
      },
    });

    scoreLeadWithOllama(lead.id).catch(console.error);
    await logActivity(lead.id, req.user.id, 'LEAD_CREATED', { source: lead.source, message });

    res.status(201).json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meta/wa-webhook — WhatsApp webhook verification
router.get('/wa-webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.status(403).send('Verification failed');
});

// POST /api/meta/wa-webhook — auto-capture leads from Click-to-WhatsApp ads
router.post('/wa-webhook', async (req, res) => {
  // Respond 200 immediately — WhatsApp requires fast response
  res.status(200).json({ status: 'ok' });

  try {
    const { entry = [] } = req.body;
    for (const e of entry) {
      for (const change of e.changes || []) {
        if (change.field !== 'messages') continue;
        const value = change.value || {};
        const messages = value.messages || [];
        const contacts = value.contacts || [];

        for (const msg of messages) {
          if (msg.type !== 'text') continue;

          const rawPhone = msg.from || '';
          const phone = cleanPhone(rawPhone);
          const messageText = msg.text?.body || '';
          const contact = contacts.find(c => c.wa_id === msg.from);
          const name = contact?.profile?.name || 'WhatsApp Lead';

          if (!phone || phone.length < 10) {
            console.log('[WA] Invalid phone:', rawPhone);
            continue;
          }

          const existing = await prisma.lead.findUnique({ where: { phone } });

          if (existing) {
            await prisma.lead.update({
              where: { id: existing.id },
              data: { lastContactAt: new Date() },
            });
            await logActivity(existing.id, null, 'WHATSAPP_MESSAGE', { message: messageText, from: name });
            console.log(`[WA] Message logged for existing lead: ${existing.name} (${phone})`);
            continue;
          }

          const interestedCourse = detectCourse(messageText);
          const lead = await prisma.lead.create({
            data: {
              name,
              phone,
              source: 'FACEBOOK_ADS',
              status: 'NEW',
              interestedCourse: interestedCourse || undefined,
              lastContactAt: new Date(),
            },
          });

          await logActivity(lead.id, null, 'LEAD_CREATED', { source: 'WHATSAPP_AD', message: messageText });
          scoreLeadWithOllama(lead.id).catch(err =>
            console.error('[WA] AI scoring error:', err.message)
          );
          console.log(`[WA] ✅ Lead created: ${lead.name} (${phone}) course=${interestedCourse || 'none'}`);
        }
      }
    }
  } catch (err) {
    console.error('[WA] Webhook processing error:', err.message);
  }
});

// GET /api/meta/live-wa — last 24h Meta leads with their WhatsApp message
router.get('/live-wa', authenticate, async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const leads = await prisma.lead.findMany({
      where: {
        source: { in: ['FACEBOOK_ADS', 'INSTAGRAM'] },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        name: true,
        phone: true,
        interestedCourse: true,
        source: true,
        aiGrade: true,
        aiScore: true,
        createdAt: true,
        activities: {
          where: { action: 'LEAD_CREATED' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { details: true },
        },
      },
    });

    const result = leads.map(l => ({
      id: l.id,
      name: l.name,
      phone: l.phone,
      interestedCourse: l.interestedCourse,
      source: l.source,
      aiGrade: l.aiGrade,
      aiScore: l.aiScore,
      createdAt: l.createdAt,
      message: l.activities[0]?.details?.message || null,
    }));

    res.json({ leads: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meta/stats — full stats with daily breakdown for chart
router.get('/stats', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7); weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [fbToday, fbWeek, fbMonth, igToday, igWeek, igMonth, total, thisMonthLeads] = await Promise.all([
      prisma.lead.count({ where: { source: 'FACEBOOK_ADS', createdAt: { gte: todayStart } } }),
      prisma.lead.count({ where: { source: 'FACEBOOK_ADS', createdAt: { gte: weekStart } } }),
      prisma.lead.count({ where: { source: 'FACEBOOK_ADS', createdAt: { gte: monthStart } } }),
      prisma.lead.count({ where: { source: 'INSTAGRAM', createdAt: { gte: todayStart } } }),
      prisma.lead.count({ where: { source: 'INSTAGRAM', createdAt: { gte: weekStart } } }),
      prisma.lead.count({ where: { source: 'INSTAGRAM', createdAt: { gte: monthStart } } }),
      prisma.lead.count({ where: { source: { in: ['FACEBOOK_ADS', 'INSTAGRAM'] } } }),
      prisma.lead.findMany({
        where: {
          source: { in: ['FACEBOOK_ADS', 'INSTAGRAM'] },
          createdAt: { gte: monthStart },
        },
        select: { source: true, createdAt: true },
      }),
    ]);

    // Build daily breakdown
    const dailyMap = {};
    for (const lead of thisMonthLeads) {
      const day = lead.createdAt.toISOString().slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { facebook: 0, instagram: 0 };
      if (lead.source === 'FACEBOOK_ADS') dailyMap[day].facebook++;
      else dailyMap[day].instagram++;
    }

    const dailyFacebook = Object.entries(dailyMap)
      .map(([day, v]) => ({ day, count: v.facebook }))
      .sort((a, b) => a.day.localeCompare(b.day));
    const dailyInstagram = Object.entries(dailyMap)
      .map(([day, v]) => ({ day, count: v.instagram }))
      .sort((a, b) => a.day.localeCompare(b.day));

    res.json({
      facebook_today: fbToday,
      facebook_week: fbWeek,
      facebook_month: fbMonth,
      instagram_today: igToday,
      instagram_week: igWeek,
      instagram_month: igMonth,
      total,
      dailyFacebook,
      dailyInstagram,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meta/leads — last 50 Meta leads (protected)
router.get('/leads', authenticate, async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { source: { in: ['FACEBOOK_ADS', 'INSTAGRAM'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        interestedCourse: true,
        source: true,
        createdAt: true,
        status: true,
        aiGrade: true,
        aiScore: true,
      },
    });
    res.json({ leads });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
