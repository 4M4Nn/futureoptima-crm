import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, TrendingUp, CreditCard, AlertTriangle, Calendar, Flame, GraduationCap, Bot, ArrowUpRight, PhoneCall, Link2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import api from '../utils/api';
import { fmt, fmtNum, fmtDate, timeAgo } from '../utils/constants';
import { StatCard, LoadingState, GradeBadge } from '../components/ui/index';
import QuickCallModal from '../components/QuickCallModal';
import { useAuthStore } from '../store/authStore';
import { Link } from 'react-router-dom';

const COLORS = ['#4f46e5', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899'];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: analytics, isLoading } = useQuery({ queryKey: ['analytics'], queryFn: () => api.get('/analytics/dashboard').then(r => r.data) });
  const { data: payStats } = useQuery({ queryKey: ['payment-stats'], queryFn: () => api.get('/payments/stats').then(r => r.data) });
  const { data: hotLeads } = useQuery({ queryKey: ['hot-leads'], queryFn: () => api.get('/leads?grade=HOT&limit=5').then(r => r.data) });
  const { data: metaStats } = useQuery({ queryKey: ['meta-stats-dash'], queryFn: () => api.get('/meta/stats').then(r => r.data), refetchInterval: 30000 });
  const { data: metaLeadsData } = useQuery({ queryKey: ['meta-leads-dash'], queryFn: () => api.get('/meta/leads?limit=5').then(r => r.data), refetchInterval: 30000 });
  const { data: overdueFollowups } = useQuery({ queryKey: ['followups', 'overdue'], queryFn: () => api.get('/leads/followups?period=overdue').then(r => r.data), refetchInterval: 60000 });
  const { data: todayFollowups } = useQuery({ queryKey: ['followups', 'today'], queryFn: () => api.get('/leads/followups?period=today').then(r => r.data), refetchInterval: 60000 });
  const { data: combinedBatches } = useQuery({ queryKey: ['combined-batches-dash'], queryFn: () => api.get('/courses/batches?isCombined=true&isActive=true').then(r => r.data) });

  const [quickCallLead, setQuickCallLead] = useState(null);

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

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const activeCombinedBatches = (combinedBatches || []).filter(b => !b.splitDate || new Date(b.splitDate) >= today);

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

      {/* Overdue Alert — only shown when there are overdue follow-ups */}
      {(overdueFollowups?.count ?? 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="font-bold text-red-700">
                ⚠️ You have {overdueFollowups.count} overdue follow-up{overdueFollowups.count !== 1 ? 's' : ''}!
              </span>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {(overdueFollowups.leads || []).slice(0, 3).map(lead => (
                  <Link key={lead.id} to={`/leads/${lead.id}`} className="text-sm text-red-700 hover:text-red-800 font-medium">
                    {lead.name} — {lead.phone}
                  </Link>
                ))}
              </div>
            </div>
            <Link
              to="/followups"
              className="flex-shrink-0 text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              View all overdue →
            </Link>
          </div>
        </div>
      )}

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

      {/* Active Combined Batches — only shown when combined batches exist */}
      {activeCombinedBatches.length > 0 && (
        <div className="card overflow-hidden">
          <div className="card-header flex items-center gap-2">
            <Link2 className="w-4 h-4 text-purple-600" />
            <h3 className="section-title">Active Combined Batches</h3>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">{activeCombinedBatches.length}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {activeCombinedBatches.map(b => {
              const courseNames = [b.course?.shortName, ...(b.combinedCourseDetails || []).map(c => c.shortName || c.name)].filter(Boolean).join(' + ');
              const daysUntilSplit = b.splitDate ? Math.ceil((new Date(b.splitDate) - today) / 86400000) : null;
              return (
                <Link key={b.id} to={`/students?batchId=${b.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{b.batchName}</div>
                    <div className="text-xs text-gray-500 truncate">{courseNames}</div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-sm font-bold text-gray-900">{b._count?.enrollments || 0}</div>
                      <div className="text-[10px] text-gray-400">students</div>
                    </div>
                    <div className="text-center">
                      <div className={`text-sm font-bold ${daysUntilSplit != null && daysUntilSplit <= 7 ? 'text-orange-600' : 'text-gray-900'}`}>
                        {daysUntilSplit != null ? Math.max(0, daysUntilSplit) : '—'}
                      </div>
                      <div className="text-[10px] text-gray-400">days to split</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Today's Call List */}
      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-orange-600" />
            <h3 className="section-title">📞 Today's Follow-ups</h3>
            {(todayFollowups?.count ?? 0) > 0 && (
              <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold">{todayFollowups.count}</span>
            )}
          </div>
          <Link to="/followups" className="text-sm text-primary-600 hover:underline">View all →</Link>
        </div>
        {!(todayFollowups?.leads?.length) ? (
          <div className="p-8 text-center text-gray-400">
            <PhoneCall className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No follow-ups scheduled for today</p>
            <p className="text-xs mt-1">Great — or add some calls to stay on top of your leads!</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Name', 'Phone', 'Course', 'AI Grade', 'Action'].map(h => (
                      <th key={h} className="px-4 py-3 text-left table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(todayFollowups.leads || []).slice(0, 5).map(lead => (
                    <tr key={lead.id} className="table-row">
                      <td className="px-4 py-3">
                        <Link to={`/leads/${lead.id}`} className="font-medium text-gray-900 hover:text-primary-600 text-sm">
                          {lead.aiGrade === 'HOT' && '🔥 '}{lead.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`tel:+91${lead.phone?.replace(/\D/g, '')}`} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                          {lead.phone}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{lead.interestedCourse?.replace(/_/g, ' ') || '—'}</td>
                      <td className="px-4 py-3"><GradeBadge grade={lead.aiGrade} score={lead.aiScore} /></td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setQuickCallLead(lead)}
                          className="text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-2.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1"
                        >
                          <PhoneCall className="w-3 h-3" /> Mark Called
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(todayFollowups?.count ?? 0) > 5 && (
              <div className="px-4 py-2.5 border-t border-gray-50 text-right">
                <Link to="/followups" className="text-xs text-primary-600 hover:underline font-medium">
                  View all {todayFollowups.count} follow-ups →
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* Meta Ads Live Dashboard */}
      <div className="card overflow-hidden">
        {/* Header */}
        <div
          className="px-5 py-4 text-white flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #1877F2 0%, #E1306C 100%)' }}
        >
          <div>
            <div className="font-bold text-base leading-tight">Meta Ads</div>
            <div className="text-white/80 text-sm">Facebook & Instagram</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm font-semibold">Live</span>
            </div>
            <Link to="/meta" className="text-sm text-white/90 hover:text-white font-semibold flex items-center gap-0.5">
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Stats */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: '#1877F2' }}>f</span>
              <span className="text-sm text-gray-600 flex-1">Facebook Today</span>
              <span className="text-xl font-bold text-blue-700">{metaStats?.facebook_today ?? 0}</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#fdf2f8' }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E1306C, #833AB4)' }}>IG</span>
              <span className="text-sm text-gray-600 flex-1">Instagram Today</span>
              <span className="text-xl font-bold" style={{ color: '#E1306C' }}>{metaStats?.instagram_today ?? 0}</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-indigo-600" />
              </div>
              <span className="text-sm text-gray-600 flex-1">This Month</span>
              <span className="text-xl font-bold text-indigo-700">{(metaStats?.facebook_month ?? 0) + (metaStats?.instagram_month ?? 0)}</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-sm text-gray-600 flex-1">Conversion Rate</span>
              <span className="text-xl font-bold text-green-700">{ov.conversionRate ?? 0}%</span>
            </div>
          </div>

          {/* Right: Last 5 Meta Leads */}
          <div className="space-y-1">
            {(metaLeadsData?.leads || []).slice(0, 5).length > 0 ? (
              (metaLeadsData?.leads || []).slice(0, 5).map(lead => (
                <div key={lead.id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{lead.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {lead.source === 'FACEBOOK_ADS' ? (
                        <span className="text-xs px-1.5 py-0.5 rounded font-bold text-white leading-none" style={{ background: '#1877F2' }}>FB</span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded font-bold text-white leading-none" style={{ background: 'linear-gradient(135deg, #E1306C, #833AB4)' }}>IG</span>
                      )}
                      <span className="text-xs text-gray-400">{timeAgo(lead.createdAt)}</span>
                    </div>
                  </div>
                  <GradeBadge grade={lead.aiGrade} score={lead.aiScore} />
                  <Link to={`/leads/${lead.id}`} className="text-gray-300 hover:text-primary-600 transition-colors flex-shrink-0">
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                <div className="text-sm font-medium mb-1">No Meta leads yet</div>
                <div className="text-xs max-w-[180px]">Add leads from your WhatsApp conversations in the Meta Ads page</div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {(metaStats?.facebook_month ?? 0) + (metaStats?.instagram_month ?? 0)} leads from Meta this month
          </span>
          <Link
            to="/meta"
            className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #1877F2, #E1306C)' }}
          >
            Add WhatsApp Lead <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
      <QuickCallModal
        lead={quickCallLead}
        open={!!quickCallLead}
        onClose={() => setQuickCallLead(null)}
        onSuccess={() => setQuickCallLead(null)}
      />
    </div>
  );
}
