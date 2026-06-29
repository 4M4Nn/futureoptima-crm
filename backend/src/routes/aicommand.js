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
MARK_CALLED: data: { phone, outcome ("INTERESTED"|"NOT_INTERESTED"|"CALLBACK"|"NO_ANSWER"), notes? }
ADD_NOTE: data: { phone, note }
RECORD_PAYMENT: data: { phone, amount (number), method ("CASH"|"UPI"|"BANK_TRANSFER"|"CHEQUE"|"CARD"), transactionId?, bankAccount? ("HDFC"|"ICICI"|"IDFC"|"CASH", default "CASH") }
ADD_EXPENSE: data: { category, amount (number), date (ISO today default), paymentMethod ("Cash"|"UPI"|"Bank Transfer"|"Cheque"), bankAccount? ("HDFC"|"ICICI"|"IDFC"|"CASH", default "CASH"), vendor?, notes? }
DELETE_EXPENSE: data: { category?, amount? (number), vendor?, date? (ISO) }
ADD_SALARY: data: { employeeName, month (1-12), year, basicSalary (number), bonus? (number default 0), deductions? (number default 0), paymentMethod? ("Cash"|"UPI"|"Bank Transfer"|"Cheque"), bankAccount? ("HDFC"|"ICICI"|"IDFC"|"CASH", default "CASH"), notes? }
SEARCH_LEAD: data: { query }
GET_FOLLOWUPS: data: { period: "today"|"tomorrow"|"overdue"|"week" }
GET_STATS: data: { type: "hot_leads"|"today_collection"|"pending_fees"|"overview" }
GET_EXPENSES: data: { period: "today"|"week"|"month" }
GET_FINANCE_SUMMARY: data: {}
UNKNOWN: data: {}

bankAccount mapping:
hdfc|hdfc bank -> HDFC
icici|icici bank -> ICICI
idfc|idfc bank -> IDFC
cash|hand|physical -> CASH
default -> CASH

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

Payment method (for RECORD_PAYMENT use enum values, for ADD_EXPENSE use label):
cash|hand|physical -> CASH (enum) / Cash (label)
upi|gpay|phonepe|paytm|googlepay -> UPI (enum) / UPI (label)
bank|transfer|neft|rtgs|imps -> BANK_TRANSFER (enum) / Bank Transfer (label)
cheque|check -> CHEQUE (enum) / Cheque (label)
card|credit|debit -> CARD (enum)
default -> CASH / Cash

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
lost|not interested|rejected -> LOST
nurturing|follow up -> NURTURING

MARK_CALLED outcome mapping:
interested|wants to join|very interested -> INTERESTED
not interested|rejected|no -> NOT_INTERESTED
callback|call back|call later|follow up|busy -> CALLBACK
no answer|not picking|switched off|no response -> NO_ANSWER

Always return:
{ "action": "ACTION_NAME", "data": { ... }, "message": "human friendly description of what you understood" }

Today's date is ${new Date().toISOString().slice(0, 10)}.`;

async function callGroq(command) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');
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
  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  return JSON.parse(result.choices[0].message.content.trim());
}

const READ_ACTIONS = new Set(['SEARCH_LEAD', 'GET_FOLLOWUPS', 'GET_STATS', 'GET_EXPENSES', 'GET_FINANCE_SUMMARY']);

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const BANK_LABELS = { HDFC: 'HDFC Bank', ICICI: 'ICICI Bank', IDFC: 'IDFC Bank', CASH: 'Cash' };

function fmtAmt(n) { return '₹' + (Number(n) || 0).toLocaleString('en-IN'); }

// Execute read-only actions — no DB writes
async function executeReadAction(action, data) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);

  switch (action) {
    case 'SEARCH_LEAD': {
      const leads = await prisma.lead.findMany({
        where: { OR: [{ name: { contains: data.query, mode: 'insensitive' } }, { phone: { contains: data.query } }, { email: { contains: data.query, mode: 'insensitive' } }] },
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
      else where = { nextFollowUpAt: { gte: today, lt: weekEnd } };
      const leads = await prisma.lead.findMany({ where, take: 10, orderBy: { nextFollowUpAt: 'asc' }, include: { enrollment: { include: { course: { select: { shortName: true } } } } } });
      return { leads, count: leads.length, period: data.period || 'week' };
    }

    case 'GET_STATS': {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
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
          prisma.payment.aggregate({ where: { paidAt: { gte: monthStart } }, _sum: { amount: true } }),
        ]);
        return { totalLeads: leads, totalEnrollments: enrollments, todayCollection: todayPay._sum.amount || 0, monthCollection: monthPay._sum.amount || 0 };
      }
    }

    case 'GET_EXPENSES': {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      let from = monthStart;
      if (data.period === 'today') from = today;
      else if (data.period === 'week') { from = new Date(today); from.setDate(today.getDate() - 7); }
      const expenses = await prisma.expense.findMany({ where: { date: { gte: from } }, orderBy: { date: 'desc' }, take: 20, include: { addedBy: { select: { name: true } } } });
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
      return {};
  }
}

// Resolve write action: look up IDs and build confirm text — NO DB writes
async function resolveWriteAction(action, data) {
  const bank = data.bankAccount || 'CASH';

  switch (action) {
    case 'CREATE_LEAD': {
      const followUpLabel = data.followUpDate ? ` · follow-up ${data.followUpDate}` : '';
      const courseLabel = data.interestedCourse ? ` · ${data.interestedCourse.replace(/_/g, ' ')}` : '';
      const sourceLabel = data.source ? ` · ${data.source.replace(/_/g, ' ')}` : '';
      return {
        resolvedData: data,
        confirmText: `Add lead **${data.name}** (${data.phone})${courseLabel}${sourceLabel}${followUpLabel}?`,
      };
    }

    case 'UPDATE_LEAD_STATUS': {
      const lead = await prisma.lead.findFirst({ where: { phone: data.phone } });
      if (!lead) return { error: `No lead found with phone ${data.phone}` };
      return {
        resolvedData: { ...data, leadId: lead.id, leadName: lead.name },
        confirmText: `Update **${lead.name}**'s status to **${data.status}**?`,
      };
    }

    case 'SCHEDULE_FOLLOWUP': {
      const lead = await prisma.lead.findFirst({ where: { phone: data.phone } });
      if (!lead) return { error: `No lead found with phone ${data.phone}` };
      return {
        resolvedData: { ...data, leadId: lead.id, leadName: lead.name },
        confirmText: `Set follow-up for **${lead.name}** to **${data.date}**?`,
      };
    }

    case 'ADD_NOTE': {
      const lead = await prisma.lead.findFirst({ where: { phone: data.phone } });
      if (!lead) return { error: `No lead found with phone ${data.phone}` };
      return {
        resolvedData: { ...data, leadId: lead.id, leadName: lead.name },
        confirmText: `Add note for **${lead.name}**: "${data.note}"?`,
      };
    }

    case 'MARK_CALLED': {
      const lead = await prisma.lead.findFirst({ where: { phone: data.phone } });
      if (!lead) return { error: `No lead found with phone ${data.phone}` };
      const outcomeLabel = (data.outcome || '').replace(/_/g, ' ');
      const notesLabel = data.notes ? ` · "${data.notes}"` : '';
      return {
        resolvedData: { ...data, leadId: lead.id, leadName: lead.name },
        confirmText: `Log call with **${lead.name}** — outcome: **${outcomeLabel}**${notesLabel}?`,
      };
    }

    case 'RECORD_PAYMENT': {
      const amount = Number(data.amount);
      if (!data.amount || amount <= 0) {
        return { error: `How much is the payment? Include the amount — e.g. "record payment 5000 UPI HDFC for 9876543210"` };
      }
      const lead = await prisma.lead.findFirst({ where: { phone: data.phone }, include: { enrollment: true } });
      if (!lead) return { error: `No lead found with phone ${data.phone}` };
      if (!lead.enrollment) return { error: `${lead.name} has no active enrollment` };
      const methodLabel = (data.method || 'CASH').replace(/_/g, ' ');
      return {
        resolvedData: { ...data, leadId: lead.id, leadName: lead.name, enrollmentId: lead.enrollment.id, balanceDue: lead.enrollment.balanceDue },
        confirmText: `Record **${fmtAmt(amount)}** from **${lead.name}** via ${methodLabel} into **${BANK_LABELS[bank]}**? (Balance due: ${fmtAmt(lead.enrollment.balanceDue)})`,
      };
    }

    case 'ADD_EXPENSE': {
      const amount = Number(data.amount);
      if (!data.amount || amount <= 0) {
        return { error: `How much was this expense? Include the amount — e.g. "water expense 500 IDFC"` };
      }
      const dateLabel = data.date || new Date().toISOString().slice(0, 10);
      const vendorLabel = data.vendor ? ` · ${data.vendor}` : '';
      return {
        resolvedData: { ...data, amount },
        confirmText: `Add expense **${data.category || 'Miscellaneous'} ${fmtAmt(amount)}** · ${data.paymentMethod || 'Cash'} · **${BANK_LABELS[bank]}** · ${dateLabel}${vendorLabel}?`,
      };
    }

    case 'DELETE_EXPENSE': {
      const where = {};
      if (data.category) where.category = data.category;
      if (data.amount) where.amount = Number(data.amount);
      if (data.vendor) where.vendor = { contains: data.vendor, mode: 'insensitive' };
      if (data.date) where.date = { gte: new Date(data.date), lte: new Date(data.date + 'T23:59:59') };

      const matches = await prisma.expense.findMany({ where, orderBy: { date: 'desc' }, take: 5 });
      if (matches.length === 0) return { error: 'No matching expense found. Try adding the amount or date to narrow it down.' };
      if (matches.length > 1) return { error: `Found ${matches.length} matching expenses. Please be more specific (add amount or date).` };

      const exp = matches[0];
      const dateStr = new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const vendorPart = exp.vendor ? ` (${exp.vendor})` : '';
      return {
        resolvedData: { expenseId: exp.id, category: exp.category, amount: exp.amount, date: exp.date, vendor: exp.vendor },
        confirmText: `⚠️ Permanently delete **${exp.category} ${fmtAmt(exp.amount)}**${vendorPart} · ${dateStr}? This cannot be undone.`,
        isDangerous: true,
      };
    }

    case 'ADD_SALARY': {
      const basicSalary = Number(data.basicSalary);
      if (!data.basicSalary || basicSalary <= 0) {
        return { error: `What is the basic salary amount? Include it — e.g. "add salary for Aman 25000 HDFC June 2026"` };
      }
      const net = basicSalary + (parseFloat(data.bonus) || 0) - (parseFloat(data.deductions) || 0);
      const bonusLabel = data.bonus && Number(data.bonus) > 0 ? ` + bonus ${fmtAmt(data.bonus)}` : '';
      const deductLabel = data.deductions && Number(data.deductions) > 0 ? ` - deductions ${fmtAmt(data.deductions)}` : '';
      const monthName = MONTH_NAMES[(data.month || 1) - 1];
      return {
        resolvedData: { ...data, basicSalary },
        confirmText: `Add salary for **${data.employeeName}** — basic ${fmtAmt(basicSalary)}${bonusLabel}${deductLabel} = **net ${fmtAmt(net)}** · ${monthName} ${data.year} · paid from **${BANK_LABELS[bank]}**?`,
      };
    }

    default:
      return { resolvedData: data, confirmText: 'Confirm this action?' };
  }
}

// POST /api/aicommand/execute — parse intent and resolve IDs, never write to DB
router.post('/execute', async (req, res) => {
  const { command } = req.body;
  if (!command?.trim()) return res.status(400).json({ error: 'Command required' });

  try {
    const parsed = await callGroq(command);

    await prisma.aICommand.create({
      data: { userId: req.user.id, command, action: parsed.action, result: parsed.message || '', success: true },
    }).catch(() => {});

    if (READ_ACTIONS.has(parsed.action)) {
      const data = await executeReadAction(parsed.action, parsed.data || {});
      return res.json({ action: parsed.action, data, message: parsed.message, requiresConfirmation: false });
    }

    if (parsed.action === 'UNKNOWN') {
      return res.json({ action: 'UNKNOWN', data: {}, message: parsed.message || "I didn't understand that. Try: 'Add lead Rahul 9876543210' or 'Electricity expense 500 HDFC'", requiresConfirmation: false });
    }

    const resolved = await resolveWriteAction(parsed.action, parsed.data || {});

    if (resolved.error) {
      return res.json({ action: parsed.action, data: {}, message: resolved.error, requiresConfirmation: false, isError: true });
    }

    return res.json({
      action: parsed.action,
      data: resolved.resolvedData,
      message: parsed.message,
      confirmText: resolved.confirmText,
      requiresConfirmation: true,
      isDangerous: resolved.isDangerous || false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
