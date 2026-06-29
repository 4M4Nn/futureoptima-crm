import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `You are an AI assistant for Future Optima IT Solutions CRM and ERP system in Kerala, India.
Convert natural language commands to JSON actions. Respond ONLY with valid JSON. No markdown, no explanation.

Supported actions:
CREATE_LEAD: data: { name, phone, email?, source, interestedCourse?, city?, followUpDate? (ISO date, defaults to tomorrow if not mentioned) }
UPDATE_LEAD_STATUS: data: { phone, status }
SCHEDULE_FOLLOWUP: data: { phone, date (ISO), notes? }
ADD_NOTE: data: { phone, note }
RECORD_PAYMENT: data: { phone, amount (number), method, transactionId? }
SEARCH_LEAD: data: { query }
GET_FOLLOWUPS: data: { period: "today"|"tomorrow"|"overdue"|"week" }
GET_STATS: data: { type: "hot_leads"|"today_collection"|"pending_fees"|"overview" }
ADD_EXPENSE: data: { category, amount (number), date (ISO today default), paymentMethod, vendor?, notes? }
GET_EXPENSES: data: { period: "today"|"week"|"month" }
GET_FINANCE_SUMMARY: data: {}
UNKNOWN: data: {}

Category mapping for expenses:
water|food|tea|coffee|snacks|lunch|refreshment -> Miscellaneous
electricity|current|EB|power|bill -> Electricity
rent|office rent -> Rent
internet|wifi|broadband -> Internet
facebook|google|marketing|ads|promotion|advertisement -> Marketing
salary|wages|staff -> Salary
software|subscription|zoom|canva|tools -> Software
office|stationery|supplies|printing -> Office
travel|transport|uber|fuel|petrol|auto|cab|rickshaw -> Travel
default -> Miscellaneous

Payment method:
cash|hand|physical|nakit -> Cash
upi|gpay|phonepe|paytm|googlepay -> UPI
bank|transfer|neft|rtgs|imps -> Bank Transfer
cheque|check -> Cheque
default -> Cash

Course mapping:
AI|artificial intelligence|automation|ai engineering -> AI_ENGINEERING
data science|ml|machine learning -> DATA_SCIENCE_AI
cyber|security|hacking|cybersecurity -> AI_CYBERSECURITY
python|fullstack|full stack|web development -> PYTHON_FULLSTACK
vibe|saas|no code|vibe coding -> VIBE_CODING_SAAS
data analytics|analytics|excel|power bi -> DATA_ANALYTICS
business|mba|business analytics -> BUSINESS_ANALYTICS

Lead source:
facebook|fb -> FACEBOOK_ADS
instagram|ig|insta -> INSTAGRAM
walk in|walkin|direct|came in person -> WALK_IN
referral|reference|referred by -> REFERRAL
google -> GOOGLE_ADS
whatsapp -> WHATSAPP
default -> OTHER

Lead status:
contacted|called -> CONTACTED
qualified|interested -> QUALIFIED
demo|scheduled -> DEMO_SCHEDULED
won|joined|enrolled|admitted -> WON
lost|not interested|rejected|deny -> LOST
nurturing|follow up -> NURTURING

Always return:
{ "action": "ACTION_NAME", "data": { ... }, "message": "human friendly description of what you understood" }

Today's date is ${new Date().toISOString().slice(0, 10)}.`;

async function callGroq(command) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: command },
      ],
      max_tokens: 400,
      temperature: 0.1,
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return JSON.parse(data.choices[0].message.content.trim());
}

async function executeAction(action, data, userId) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);

  switch (action) {
    case 'CREATE_LEAD': {
      const existing = await prisma.lead.findFirst({ where: { phone: data.phone } });
      if (existing) return { lead: existing, created: false, message: 'Lead already exists' };
      const followUpAt = data.followUpDate ? new Date(data.followUpDate) : tomorrow;
      const lead = await prisma.lead.create({
        data: {
          name: data.name,
          phone: data.phone,
          email: data.email,
          source: data.source || 'OTHER',
          interestedCourse: data.interestedCourse,
          city: data.city,
          assignedToId: userId,
          nextFollowUpAt: followUpAt,
        },
      });
      // Background AI scoring
      import('../services/ollamaService.js').then(({ scoreLeadWithOllama }) => scoreLeadWithOllama(lead.id).catch(() => {}));
      return { lead, created: true };
    }

    case 'UPDATE_LEAD_STATUS': {
      const lead = await prisma.lead.findFirst({ where: { phone: data.phone } });
      if (!lead) return { error: `Lead with phone ${data.phone} not found` };
      const updated = await prisma.lead.update({ where: { id: lead.id }, data: { status: data.status } });
      return { lead: updated };
    }

    case 'SCHEDULE_FOLLOWUP': {
      const lead = await prisma.lead.findFirst({ where: { phone: data.phone } });
      if (!lead) return { error: `Lead with phone ${data.phone} not found` };
      await prisma.lead.update({ where: { id: lead.id }, data: { nextFollowUpAt: new Date(data.date) } });
      if (data.notes) {
        await prisma.note.create({ data: { leadId: lead.id, authorId: userId, content: `Follow-up scheduled: ${data.notes}` } });
      }
      return { lead: { id: lead.id, name: lead.name, nextFollowUpAt: data.date } };
    }

    case 'ADD_NOTE': {
      const lead = await prisma.lead.findFirst({ where: { phone: data.phone } });
      if (!lead) return { error: `Lead with phone ${data.phone} not found` };
      const note = await prisma.note.create({ data: { leadId: lead.id, authorId: userId, content: data.note } });
      return { note, leadName: lead.name };
    }

    case 'RECORD_PAYMENT': {
      const lead = await prisma.lead.findFirst({ where: { phone: data.phone }, include: { enrollment: true } });
      if (!lead) return { error: `Lead with phone ${data.phone} not found` };
      if (!lead.enrollment) return { error: `${lead.name} has no active enrollment` };
      const enrollment = lead.enrollment;
      const receiptNumber = `FO-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      const payment = await prisma.$transaction(async (tx) => {
        const p = await tx.payment.create({
          data: {
            enrollmentId: enrollment.id,
            amount: data.amount,
            method: data.method?.toUpperCase().replace(' ', '_') || 'CASH',
            transactionId: data.transactionId,
            receiptNumber,
            collectedById: userId,
          },
        });
        const newPaid = enrollment.paidAmount + data.amount;
        const newBalance = enrollment.netFee - newPaid;
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: { paidAmount: newPaid, balanceDue: newBalance, paymentStatus: newBalance <= 0 ? 'PAID' : 'PARTIAL' },
        });
        return p;
      });
      return { payment, studentName: lead.name, receiptNumber, balanceRemaining: enrollment.netFee - enrollment.paidAmount - data.amount };
    }

    case 'SEARCH_LEAD': {
      const leads = await prisma.lead.findMany({
        where: {
          OR: [
            { name: { contains: data.query, mode: 'insensitive' } },
            { phone: { contains: data.query } },
            { email: { contains: data.query, mode: 'insensitive' } },
          ],
        },
        take: 8,
        include: { enrollment: { include: { course: { select: { shortName: true } } } } },
      });
      return { leads, count: leads.length };
    }

    case 'GET_FOLLOWUPS': {
      let where = {};
      if (data.period === 'today') where = { nextFollowUpAt: { gte: today, lt: tomorrow } };
      else if (data.period === 'tomorrow') where = { nextFollowUpAt: { gte: tomorrow, lt: new Date(tomorrow.getTime() + 86400000) } };
      else if (data.period === 'overdue') where = { nextFollowUpAt: { lt: today } };
      else if (data.period === 'week') where = { nextFollowUpAt: { gte: today, lt: weekEnd } };
      const leads = await prisma.lead.findMany({ where, take: 10, orderBy: { nextFollowUpAt: 'asc' }, include: { enrollment: { include: { course: { select: { shortName: true } } } } } });
      return { leads, count: leads.length, period: data.period };
    }

    case 'GET_STATS': {
      if (data.type === 'hot_leads') {
        const count = await prisma.lead.count({ where: { aiGrade: 'HOT' } });
        const leads = await prisma.lead.findMany({ where: { aiGrade: 'HOT' }, take: 5, orderBy: { aiScore: 'desc' } });
        return { count, leads };
      } else if (data.type === 'today_collection') {
        const agg = await prisma.payment.aggregate({ where: { paidAt: { gte: today } }, _sum: { amount: true }, _count: { id: true } });
        return { amount: agg._sum.amount || 0, count: agg._count.id };
      } else if (data.type === 'pending_fees') {
        const agg = await prisma.enrollment.aggregate({ where: { balanceDue: { gt: 0 } }, _sum: { balanceDue: true }, _count: { id: true } });
        return { totalPending: agg._sum.balanceDue || 0, studentCount: agg._count.id };
      } else {
        const [leads, enrollments, todayPay, monthPay] = await Promise.all([
          prisma.lead.count(),
          prisma.enrollment.count(),
          prisma.payment.aggregate({ where: { paidAt: { gte: today } }, _sum: { amount: true } }),
          prisma.payment.aggregate({ where: { paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }, _sum: { amount: true } }),
        ]);
        return { totalLeads: leads, totalEnrollments: enrollments, todayCollection: todayPay._sum.amount || 0, monthCollection: monthPay._sum.amount || 0 };
      }
    }

    case 'ADD_EXPENSE': {
      const expense = await prisma.expense.create({
        data: {
          category: data.category || 'Miscellaneous',
          amount: data.amount,
          date: new Date(data.date || new Date().toISOString().slice(0, 10)),
          paymentMethod: data.paymentMethod || 'Cash',
          vendor: data.vendor,
          notes: data.notes,
          addedById: userId,
        },
        include: { addedBy: { select: { name: true } } },
      });
      return { expense };
    }

    case 'GET_EXPENSES': {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      let from = monthStart;
      if (data.period === 'today') from = today;
      else if (data.period === 'week') { from = new Date(today); from.setDate(today.getDate() - 7); }
      const expenses = await prisma.expense.findMany({ where: { date: { gte: from } }, orderBy: { date: 'desc' }, take: 20 });
      const total = expenses.reduce((s, e) => s + e.amount, 0);
      return { expenses, total, period: data.period };
    }

    case 'GET_FINANCE_SUMMARY': {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const [monthColl, monthExp, pending, overdue] = await Promise.all([
        prisma.payment.aggregate({ where: { paidAt: { gte: monthStart } }, _sum: { amount: true } }),
        prisma.expense.aggregate({ where: { date: { gte: monthStart } }, _sum: { amount: true } }),
        prisma.enrollment.aggregate({ where: { balanceDue: { gt: 0 } }, _sum: { balanceDue: true }, _count: { id: true } }),
        prisma.installment.count({ where: { status: 'OVERDUE' } }),
      ]);
      return {
        monthlyCollection: monthColl._sum.amount || 0,
        monthlyExpenses: monthExp._sum.amount || 0,
        netProfit: (monthColl._sum.amount || 0) - (monthExp._sum.amount || 0),
        pendingFees: pending._sum.balanceDue || 0,
        studentsWithBalance: pending._count.id || 0,
        overdueInstallments: overdue,
      };
    }

    default:
      return { message: 'Command not understood. Please try rephrasing.' };
  }
}

// POST /api/aicommand/execute
router.post('/execute', async (req, res) => {
  const { command } = req.body;
  if (!command?.trim()) return res.status(400).json({ error: 'Command required' });

  let parsedAction = null;
  let success = false;
  let resultData = null;

  try {
    parsedAction = await callGroq(command);
    resultData = await executeAction(parsedAction.action, parsedAction.data || {}, req.user.id);
    success = !resultData?.error;

    await prisma.aICommand.create({
      data: {
        userId: req.user.id,
        command,
        action: parsedAction.action,
        result: JSON.stringify(resultData).slice(0, 2000),
        success,
      },
    }).catch(() => {});

    res.json({
      success,
      action: parsedAction.action,
      message: parsedAction.message || '',
      data: resultData,
    });
  } catch (err) {
    await prisma.aICommand.create({
      data: {
        userId: req.user.id,
        command,
        action: parsedAction?.action || 'ERROR',
        result: err.message,
        success: false,
      },
    }).catch(() => {});

    res.status(500).json({ success: false, error: err.message, action: 'ERROR' });
  }
});

// GET /api/aicommand/history
router.get('/history', async (req, res) => {
  try {
    const history = await prisma.aICommand.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(history);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
