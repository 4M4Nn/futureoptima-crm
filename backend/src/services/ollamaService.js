import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

async function ollamaGenerate(prompt, system = '') {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, system, stream: false, options: { temperature: 0.3, num_predict: 600 } }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${res.statusText}`);
  const data = await res.json();
  return data.response?.trim() || '';
}

const COURSE_NAMES = {
  AI_ENGINEERING: 'Professional AI Engineering & Automation Programme',
  DATA_SCIENCE_AI: 'Data Science with AI',
  AI_CYBERSECURITY: 'AI-Powered Cybersecurity',
  PYTHON_FULLSTACK: 'Python Full Stack with AI',
  VIBE_CODING_SAAS: 'Vibe Coding & SaaS Development',
  DATA_ANALYTICS: 'Data Analytics',
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

    const raw = await ollamaGenerate(prompt, 'You only respond with valid JSON objects.');
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
    await prisma.aISession.create({ data: { leadId, prompt, response: raw, model: MODEL } });
    logger.info(`AI scored lead ${leadId}: ${result.grade} (${result.score})`);
    return result;
  } catch (err) {
    logger.error(`Ollama scoring failed for ${leadId}: ${err.message}`);
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

  return await ollamaGenerate(prompt, 'You are a professional admissions counselor who writes natural, friendly messages.');
}

export async function askCRMAssistant(question, userId) {
  const system = `You are Nexora AI, the intelligent CRM assistant for Future Optima IT Solutions.
You help counselors with lead qualification, course recommendations, follow-up strategies, and admission guidance.
Courses: Professional AI Engineering & Automation, Data Science with AI, AI-Powered Cybersecurity, Python Full Stack with AI, Vibe Coding & SaaS Development, Data Analytics, Business Analytics.
Be concise, helpful, and professional. Focus on Kerala IT market context.`;

  const response = await ollamaGenerate(question, system);
  await prisma.aISession.create({ data: { userId, prompt: question, response, model: MODEL } });
  return response;
}

export async function batchScoreLeads(limit = 50) {
  const leads = await prisma.lead.findMany({
    where: { aiScore: null, status: { notIn: ['WON', 'LOST'] } },
    take: limit,
    select: { id: true },
  });
  logger.info(`Batch scoring ${leads.length} leads...`);
  for (const lead of leads) {
    await scoreLeadWithOllama(lead.id);
    await new Promise(r => setTimeout(r, 300));
  }
  logger.info(`Batch scoring complete`);
}

export async function checkOllamaHealth() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await res.json();
    return { running: true, models: data.models?.map(m => m.name) || [], activeModel: MODEL };
  } catch {
    return { running: false, models: [], activeModel: MODEL };
  }
}
