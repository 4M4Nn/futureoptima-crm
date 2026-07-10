import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

async function groqGenerate(prompt, system, maxTokens = 600) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: system || 'You are a helpful CRM assistant.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

const COURSE_NAMES = {
  AI_ENGINEERING: 'Professional AI Engineering & Automation Programme',
  DATA_SCIENCE_AI: 'Data Science with AI',
  AI_CYBERSECURITY: 'AI-Powered Cybersecurity',
  PYTHON_FULLSTACK: 'Python Full Stack with AI',
  MERN_STACK: 'Mearn Stack Development',
  DATA_ANALYTICS: 'Data Analytics with AI',
  BUSINESS_ANALYTICS: 'Business Analytics',
};

export async function scoreLeadWithOllama(leadId) {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { notes: { take: 5, orderBy: { createdAt: 'desc' } }, calls: { take: 3, orderBy: { calledAt: 'desc' } } },
    });
    if (!lead) return;

    const prompt = `You are an expert admissions counselor at Future Optima IT Solutions, a top IT training institute in Kerala, India.

Analyze this lead and respond ONLY with valid JSON:

Lead:
- Name: ${lead.name}
- City: ${lead.city || 'Unknown'}
- Course Interest: ${lead.interestedCourse ? COURSE_NAMES[lead.interestedCourse] : 'Not specified'}
- Budget: ${lead.budget ? `₹${lead.budget}` : 'Unknown'}
- Source: ${lead.source}
- Status: ${lead.status}
- Expected Join: ${lead.expectedJoinDate || 'Unknown'}
- Notes: ${lead.notes.map(n => n.content).join('. ') || 'None'}
- Call Outcomes: ${lead.calls.map(c => c.outcome).join(', ') || 'None'}
- Days since created: ${Math.floor((Date.now() - new Date(lead.createdAt)) / 86400000)}

Respond ONLY with this JSON (no markdown, no extra text):
{"score":75,"grade":"WARM","summary":"Brief 2-sentence summary","nextAction":"Specific next step","reasoning":"Why this score"}

Scoring: HOT=70-100 (ready to join), WARM=40-69 (interested, needs nurturing), COLD=20-39 (low engagement), UNQUALIFIED=0-19 (not a fit)`;

    const raw = await groqGenerate(prompt, 'You only respond with valid JSON objects.');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    const result = JSON.parse(match[0]);

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        aiScore: Math.max(0, Math.min(100, parseInt(result.score) || 50)),
        aiGrade: ['HOT', 'WARM', 'COLD', 'UNQUALIFIED'].includes(result.grade) ? result.grade : 'COLD',
        aiSummary: result.summary,
        aiNextAction: result.nextAction,
      },
    });
    await prisma.aISession.create({ data: { leadId, prompt, response: raw, model: GROQ_MODEL } });
    logger.info(`Groq scored lead ${leadId}: ${result.grade} (${result.score})`);
    return result;
  } catch (err) {
    logger.error(`Groq scoring failed for ${leadId}: ${err.message}`);
  }
}

export async function suggestReply(leadId, context = '') {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { notes: { take: 3, orderBy: { createdAt: 'desc' } } },
  });
  if (!lead) throw new Error('Lead not found');

  const prompt = `You are a friendly admissions counselor at Future Optima IT Solutions, Kerala.
Write a warm WhatsApp follow-up message for ${lead.name}.
Course interest: ${lead.interestedCourse ? COURSE_NAMES[lead.interestedCourse] : 'general inquiry'}
Status: ${lead.status}
Context: ${context || 'General follow-up'}
Previous notes: ${lead.notes.map(n => n.content).join('. ') || 'None'}

Write ONLY the WhatsApp message. Max 120 words. Be warm and genuine, not salesy.`;

  return await groqGenerate(prompt, 'You are a professional admissions counselor who writes natural, friendly messages.');
}

export async function askCRMAssistant(question, userId) {
  const system = `You are Nexora AI, the intelligent CRM assistant for Future Optima IT Solutions.
You help counselors with lead qualification, course recommendations, follow-up strategies, and admission guidance.
Courses: Professional AI Engineering & Automation, Data Science with AI, AI-Powered Cybersecurity, Python Full Stack with AI, Vibe Coding & SaaS Development, Data Analytics, Business Analytics.
Be concise, helpful, and professional. Focus on Kerala IT market context.`;

  const response = await groqGenerate(question, system);
  await prisma.aISession.create({ data: { userId, prompt: question, response, model: GROQ_MODEL } });
  return response;
}

export async function batchScoreLeads(limit = 50) {
  const leads = await prisma.lead.findMany({
    where: { aiScore: null, status: { notIn: ['WON', 'LOST'] } },
    take: limit,
    select: { id: true },
  });
  logger.info(`Batch scoring ${leads.length} leads with Groq...`);
  for (const lead of leads) {
    await scoreLeadWithOllama(lead.id);
    await new Promise(r => setTimeout(r, 200));
  }
  logger.info(`Batch scoring complete`);
}

export async function checkOllamaHealth() {
  if (!process.env.GROQ_API_KEY) {
    return { running: false, provider: 'Groq', error: 'GROQ_API_KEY not set in environment' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
    });
    logger.info(`Groq health check status: ${response.status}`);
    if (response.status === 200) {
      return { running: true, activeModel: GROQ_MODEL, provider: 'Groq', models: [GROQ_MODEL, 'llama3-8b-8192'] };
    }
    const err = await response.json().catch(() => ({}));
    return { running: false, provider: 'Groq', error: err?.error?.message || `HTTP ${response.status}` };
  } catch (err) {
    logger.error(`Groq health check failed: ${err.message}`);
    return { running: false, provider: 'Groq', error: err.name === 'AbortError' ? 'Connection timeout (10s)' : err.message };
  } finally {
    clearTimeout(timeout);
  }
}
