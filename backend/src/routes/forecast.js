import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

async function groqForecast(prompt) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 800, temperature: 0.4 }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content.trim();
  } finally { clearTimeout(timeout); }
}

// GET /api/forecast/next-month
router.get('/next-month', async (req, res) => {
  try {
    const now = new Date();
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);

    // Last 3 months collection averages
    const last3Months = [];
    for (let i = 1; i <= 3; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const agg = await prisma.payment.aggregate({ where: { paidAt: { gte: start, lte: end } }, _sum: { amount: true } });
      last3Months.push(agg._sum.amount || 0);
    }
    const avgMonthlyCollection = last3Months.reduce((a, b) => a + b, 0) / 3;

    // Pending installments due next month
    const pendingNextMonth = await prisma.installment.findMany({
      where: { status: { not: 'PAID' }, dueDate: { gte: nextMonthStart, lte: nextMonthEnd } },
      select: { amount: true },
    });
    const pendingNextMonthTotal = pendingNextMonth.reduce((a, i) => a + i.amount, 0);
    const pendingNextMonthCount = pendingNextMonth.length;

    // Overdue installments (likely to collect at 60%)
    const overdue = await prisma.installment.findMany({
      where: { status: 'OVERDUE' },
      select: { amount: true },
    });
    const overdueTotal = overdue.reduce((a, i) => a + i.amount, 0);
    const overdueCount = overdue.length;
    const overdueExpected = overdueTotal * 0.6;

    // Last 3 months enrollment averages
    const last3MonthsEnrolls = [];
    for (let i = 1; i <= 3; i++) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const count = await prisma.enrollment.count({ where: { enrolledAt: { gte: start, lte: end } } });
      last3MonthsEnrolls.push(count);
    }
    const avgMonthlyEnrolls = last3MonthsEnrolls.reduce((a, b) => a + b, 0) / 3;

    // Lead pipeline
    const [hotLeads, warmLeads] = await Promise.all([
      prisma.lead.findMany({ where: { aiGrade: 'HOT', status: { notIn: ['WON', 'LOST'] } }, select: { budget: true } }),
      prisma.lead.findMany({ where: { aiGrade: 'WARM', status: { notIn: ['WON', 'LOST'] } }, select: { budget: true } }),
    ]);

    const avgCourseFee = await prisma.enrollment.aggregate({ _avg: { netFee: true } });
    const avgFee = avgCourseFee._avg.netFee || 60000;

    const hotExpectedAdmissions = Math.round(hotLeads.length * 0.7);
    const warmExpectedAdmissions = Math.round(warmLeads.length * 0.3);
    const totalExpectedAdmissions = Math.round(avgMonthlyEnrolls + hotExpectedAdmissions + warmExpectedAdmissions);
    const admissionRevenue = totalExpectedAdmissions * avgFee;

    const expectedCollectionBase = pendingNextMonthTotal + overdueExpected + admissionRevenue * 0.4;

    // Lead pipeline by status
    const leadsByStatus = await prisma.lead.groupBy({
      by: ['status'],
      where: { status: { notIn: ['WON', 'LOST'] } },
      _count: { id: true },
    });

    // Course-wise pipeline (enrolled leads by course interest)
    const courseWise = await prisma.lead.groupBy({
      by: ['interestedCourse'],
      where: { status: { notIn: ['WON', 'LOST'] }, interestedCourse: { not: null } },
      _count: { id: true },
    });

    // Last month collection for target suggestions
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const lastMonthAgg = await prisma.payment.aggregate({ where: { paidAt: { gte: lastMonthStart, lte: lastMonthEnd } }, _sum: { amount: true } });
    const lastMonthCollection = lastMonthAgg._sum.amount || 0;

    // Last 6 months admissions for chart
    const last6MonthsChart = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const label = start.toLocaleString('default', { month: 'short' });
      const count = await prisma.enrollment.count({ where: { enrolledAt: { gte: start, lte: end } } });
      last6MonthsChart.push({ month: label, admissions: count });
    }
    last6MonthsChart.push({
      month: nextMonthStart.toLocaleString('default', { month: 'short' }) + ' (F)',
      admissions: totalExpectedAdmissions,
      forecast: true,
    });

    res.json({
      collection: {
        pessimistic: Math.round(expectedCollectionBase * 0.5),
        realistic: Math.round(expectedCollectionBase * 0.75),
        optimistic: Math.round(expectedCollectionBase),
        breakdown: {
          pendingInstallments: { count: pendingNextMonthCount, amount: Math.round(pendingNextMonthTotal) },
          overdueExpected: { count: overdueCount, amount: Math.round(overdueExpected) },
          newAdmissionRevenue: { count: totalExpectedAdmissions, amount: Math.round(admissionRevenue * 0.4) },
        },
        avgLast3Months: Math.round(avgMonthlyCollection),
      },
      admissions: {
        expected: totalExpectedAdmissions,
        revenueIfAchieved: Math.round(admissionRevenue),
        avgMonthly: Math.round(avgMonthlyEnrolls * 10) / 10,
        hotLeads: { count: hotLeads.length, expectedAdmissions: hotExpectedAdmissions, revenue: Math.round(hotExpectedAdmissions * avgFee) },
        warmLeads: { count: warmLeads.length, expectedAdmissions: warmExpectedAdmissions, revenue: Math.round(warmExpectedAdmissions * avgFee) },
        last6MonthsChart,
      },
      pipeline: {
        byStatus: leadsByStatus,
        byCourse: courseWise,
        totalActive: leadsByStatus.reduce((a, s) => a + s._count.id, 0),
      },
      suggestedTargets: {
        collection: Math.round(lastMonthCollection * 1.1),
        admissions: Math.round(avgMonthlyEnrolls * 1.2),
        revenue: Math.round(lastMonthCollection * 1.15),
      },
      nextMonth: nextMonthStart.toLocaleString('default', { month: 'long', year: 'numeric' }),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/forecast/targets
router.post('/targets', async (req, res) => {
  try {
    const { month, year, collectionTarget, admissionTarget, revenueTarget } = req.body;
    const key = `targets_${year}_${String(month).padStart(2, '0')}`;
    await prisma.systemSettings.upsert({
      where: { key },
      update: { value: JSON.stringify({ collectionTarget, admissionTarget, revenueTarget }) },
      create: { key, value: JSON.stringify({ collectionTarget, admissionTarget, revenueTarget }) },
    });
    res.json({ message: 'Targets saved', key });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/forecast/targets?month=X&year=Y
router.get('/targets', async (req, res) => {
  try {
    const { month, year } = req.query;
    const key = `targets_${year}_${String(month).padStart(2, '0')}`;
    const setting = await prisma.systemSettings.findUnique({ where: { key } });
    if (!setting) return res.json(null);
    res.json(JSON.parse(setting.value));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/forecast/performance?month=X&year=Y
router.get('/performance', async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);
    const isCurrentMonth = now.getMonth() + 1 === month && now.getFullYear() === year;
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth;
    const daysRemaining = isCurrentMonth ? daysInMonth - now.getDate() : 0;

    const [collectionAgg, actualAdmissions] = await Promise.all([
      prisma.payment.aggregate({ where: { paidAt: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }),
      prisma.enrollment.count({ where: { enrolledAt: { gte: monthStart, lte: monthEnd } } }),
    ]);
    const actualCollection = collectionAgg._sum.amount || 0;

    const key = `targets_${year}_${String(month).padStart(2, '0')}`;
    const setting = await prisma.systemSettings.findUnique({ where: { key } });
    const targets = setting ? JSON.parse(setting.value) : null;

    const collectionPct = targets?.collectionTarget ? Math.round((actualCollection / targets.collectionTarget) * 100) : null;
    const admissionPct = targets?.admissionTarget ? Math.round((actualAdmissions / targets.admissionTarget) * 100) : null;
    const dailyAvg = daysElapsed > 0 ? Math.round(actualCollection / daysElapsed) : 0;
    const dailyNeeded = (targets?.collectionTarget && daysRemaining > 0)
      ? Math.round((targets.collectionTarget - actualCollection) / daysRemaining)
      : 0;
    const onTrack = dailyNeeded <= dailyAvg;

    res.json({
      month, year, daysRemaining, daysElapsed, daysInMonth,
      actualCollection, actualAdmissions,
      targets,
      collectionPct,
      admissionPct,
      dailyAvg,
      dailyNeeded,
      onTrack,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/forecast/ai-analysis
router.post('/ai-analysis', async (req, res) => {
  try {
    const { forecastData, performanceData } = req.body;
    const prompt = `You are a business analyst for Future Optima IT Solutions, an IT training institute in Kerala, India.

Next month forecast:
- Expected Collection (Realistic): ₹${forecastData?.collection?.realistic?.toLocaleString('en-IN') || 'N/A'}
- Expected Admissions: ${forecastData?.admissions?.expected || 'N/A'}
- HOT Leads: ${forecastData?.admissions?.hotLeads?.count || 0}, WARM Leads: ${forecastData?.admissions?.warmLeads?.count || 0}
- 3-Month Average Collection: ₹${forecastData?.collection?.avgLast3Months?.toLocaleString('en-IN') || 'N/A'}
- Pending Installments Due: ₹${forecastData?.collection?.breakdown?.pendingInstallments?.amount?.toLocaleString('en-IN') || 0}
- Overdue Amount: ₹${forecastData?.collection?.breakdown?.overdueExpected?.amount?.toLocaleString('en-IN') || 0}

Current month performance:
- Collection: ₹${performanceData?.actualCollection?.toLocaleString('en-IN') || 0} (${performanceData?.collectionPct || 0}% of target)
- Admissions: ${performanceData?.actualAdmissions || 0} (${performanceData?.admissionPct || 0}% of target)
- Daily Avg: ₹${performanceData?.dailyAvg?.toLocaleString('en-IN') || 0} | Needed: ₹${performanceData?.dailyNeeded?.toLocaleString('en-IN') || 0}/day
- Days Remaining: ${performanceData?.daysRemaining || 0}

Provide 4-5 specific, actionable recommendations to improve next month's collection and admissions. Focus on Kerala IT training market context. Be concise and practical.`;

    const analysis = await groqForecast(prompt);
    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: err.name === 'AbortError' ? 'AI response timeout' : err.message });
  }
});

export default router;
