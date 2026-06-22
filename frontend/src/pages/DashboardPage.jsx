import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, TrendingUp, CreditCard, AlertTriangle, Calendar, Flame, GraduationCap, Bot } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import api from '../utils/api';
import { fmt, fmtNum, fmtDate } from '../utils/constants';
import { StatCard, LoadingState, GradeBadge } from '../components/ui/index';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';

const COLORS = ['#4f46e5', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899'];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: analytics, isLoading } = useQuery({ queryKey: ['analytics'], queryFn: () => api.get('/analytics/dashboard').then(r => r.data) });
  const { data: payStats } = useQuery({ queryKey: ['payment-stats'], queryFn: () => api.get('/payments/stats').then(r => r.data) });
  const { data: hotLeads } = useQuery({ queryKey: ['hot-leads'], queryFn: () => api.get('/leads?grade=HOT&limit=5').then(r => r.data) });

  if (isLoading) return <LoadingState text="Loading dashboard..." />;
  const ov = analytics?.overview || {};
  const charts = analytics?.charts || {};

  const courseData = (charts.courseBreakdown || []).map(c => ({
    name: c.interestedCourse?.replace('_', ' ')?.replace('_', ' ') || 'Unknown',
    value: c._count.id,
  }));
  const sourceData = (charts.sourceBreakdown || []).map(s => ({
    name: s.source?.replace('_', ' ') || 'Other',
    value: s._count.id,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="nexora-gradient rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0]}! 👋</h2>
            <p className="text-blue-200 mt-1">Welcome to Future Optima CRM — here's what's happening today.</p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <div className="text-2xl font-bold">{fmtNum(ov.newThisMonth)}</div>
              <div className="text-xs text-blue-200">Leads This Month</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <div className="text-2xl font-bold">{fmt(ov.revenueMonth)}</div>
              <div className="text-xs text-blue-200">Revenue This Month</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Leads" value={fmtNum(ov.totalLeads)} sub={`${ov.newThisMonth} this month`} color="nexora" />
        <StatCard icon={Flame} label="Hot Leads" value={fmtNum(ov.hotLeads)} sub="AI scored HOT" color="red" />
        <StatCard icon={GraduationCap} label="Conversions" value={fmtNum(ov.conversions)} sub={`${ov.conversionRate}% rate`} color="green" />
        <StatCard icon={CreditCard} label="Revenue (Month)" value={fmt(ov.revenueMonth)} sub={`Total: ${fmt(ov.revenueTotal)}`} color="gold" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Calendar} label="Follow-ups Due" value={fmtNum(ov.upcomingFollowUps)} sub="In next 2 days" color="orange" />
        <StatCard icon={AlertTriangle} label="Overdue EMIs" value={fmtNum(ov.overdueInstallments)} sub="Needs attention" color="red" />
        <StatCard icon={TrendingUp} label="Today Collected" value={fmt(payStats?.todayCollected)} sub="Payments received" color="green" />
        <StatCard icon={Bot} label="AI Scored" value={`${fmtNum(ov.hotLeads + (ov.conversions || 0))}`} sub="Leads graded by AI" color="purple" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Course Interest */}
        <div className="card">
          <div className="card-header"><h3 className="section-title">Course Interest Distribution</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={courseData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {courseData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [v, 'Leads']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Sources */}
        <div className="card">
          <div className="card-header"><h3 className="section-title">Lead Sources</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sourceData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Hot Leads & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hot leads table */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="section-title">🔥 Hot Leads</h3>
            <Link to="/leads?grade=HOT" className="text-sm text-primary-600 hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gray-50"><th className="px-4 py-3 text-left table-header">Name</th><th className="px-4 py-3 text-left table-header">Course</th><th className="px-4 py-3 text-left table-header">Score</th></tr></thead>
              <tbody>
                {(hotLeads?.data || []).map(lead => (
                  <tr key={lead.id} className="table-row">
                    <td className="px-4 py-3">
                      <Link to={`/leads/${lead.id}`} className="font-medium text-gray-900 hover:text-primary-600 text-sm">{lead.name}</Link>
                      <div className="text-xs text-gray-400">{lead.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{lead.interestedCourse?.replace(/_/g, ' ') || '—'}</td>
                    <td className="px-4 py-3"><GradeBadge grade={lead.aiGrade} score={lead.aiScore} /></td>
                  </tr>
                ))}
                {!hotLeads?.data?.length && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">No hot leads yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status breakdown */}
        <div className="card">
          <div className="card-header"><h3 className="section-title">Lead Pipeline</h3></div>
          <div className="card-body space-y-3">
            {(charts.statusBreakdown || []).map(s => {
              const pct = ov.totalLeads > 0 ? (s._count.id / ov.totalLeads) * 100 : 0;
              const colors = { NEW: 'bg-blue-500', CONTACTED: 'bg-indigo-500', QUALIFIED: 'bg-purple-500', WON: 'bg-green-500', LOST: 'bg-red-500', NURTURING: 'bg-teal-500', DEMO_SCHEDULED: 'bg-yellow-500' };
              return (
                <div key={s.status} className="flex items-center gap-3">
                  <div className="w-24 text-xs font-medium text-gray-600 truncate">{s.status}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${colors[s.status] || 'bg-gray-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-8 text-xs text-gray-500 text-right">{s._count.id}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
