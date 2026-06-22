import express from 'express';
import { prisma } from '../utils/prisma.js';
import { authenticate } from '../middleware/auth.js';
const router = express.Router();
router.use(authenticate);
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const [totalLeads, newThisMonth, hotLeads, conversions, revenueMonth, revenueTotal, overdue, followUps, sourceBreakdown, courseBreakdown, statusBreakdown] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.lead.count({ where: { aiGrade: 'HOT' } }),
      prisma.lead.count({ where: { status: 'WON' } }),
      prisma.payment.aggregate({ where: { paidAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.installment.count({ where: { status: 'OVERDUE' } }),
      prisma.lead.count({ where: { nextFollowUpAt: { gte: today, lte: new Date(today.getTime() + 86400000 * 2) }, status: { notIn: ['WON', 'LOST'] } } }),
      prisma.lead.groupBy({ by: ['source'], _count: { id: true } }),
      prisma.lead.groupBy({ by: ['interestedCourse'], _count: { id: true }, where: { interestedCourse: { not: null } } }),
      prisma.lead.groupBy({ by: ['status'], _count: { id: true } }),
    ]);
    res.json({
      overview: { totalLeads, newThisMonth, hotLeads, conversions, conversionRate: totalLeads > 0 ? ((conversions / totalLeads) * 100).toFixed(1) : 0, revenueMonth: revenueMonth._sum.amount || 0, revenueTotal: revenueTotal._sum.amount || 0, overdueInstallments: overdue, upcomingFollowUps: followUps },
      charts: { sourceBreakdown, courseBreakdown, statusBreakdown },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/reports', async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const dateWhere = Object.keys(dateFilter).length ? { paidAt: dateFilter } : {};

    const users = await prisma.user.findMany({
      where: { role: { in: ['COUNSELOR', 'ADMIN', 'SUPER_ADMIN'] }, isActive: true },
      select: { id: true, name: true, role: true },
    });

    const [payments, enrollments, leadSources] = await Promise.all([
      prisma.payment.findMany({
        where: dateWhere,
        include: {
          enrollment: {
            include: {
              lead: { select: { name: true, phone: true } },
              course: { select: { name: true, shortName: true } },
            },
          },
        },
        orderBy: { paidAt: 'desc' },
      }),
      prisma.enrollment.findMany({
        include: {
          course: { select: { name: true, shortName: true } },
          lead: { select: { name: true, status: true } },
          payments: { select: { amount: true } },
        },
        orderBy: { enrolledAt: 'desc' },
      }),
      prisma.lead.groupBy({ by: ['source'], _count: { id: true } }),
    ]);

    const counselorStats = await Promise.all(
      users.map(async (user) => {
        const [assigned, converted, contacted] = await Promise.all([
          prisma.lead.count({ where: { assignedToId: user.id } }),
          prisma.lead.count({ where: { assignedToId: user.id, status: 'WON' } }),
          prisma.lead.count({ where: { assignedToId: user.id, status: { not: 'NEW' } } }),
        ]);
        const revenue = assigned > 0 ? await prisma.payment.aggregate({
          where: { enrollment: { lead: { assignedToId: user.id } } },
          _sum: { amount: true },
        }) : { _sum: { amount: 0 } };
        return {
          ...user,
          assigned,
          converted,
          contacted,
          rate: assigned > 0 ? ((converted / assigned) * 100).toFixed(1) : '0.0',
          revenue: revenue._sum.amount || 0,
        };
      })
    );

    res.json({ payments, enrollments, leadSources, counselorStats });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
