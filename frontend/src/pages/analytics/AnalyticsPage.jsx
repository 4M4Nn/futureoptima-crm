import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, FunnelChart, Funnel, LabelList } from 'recharts';
import { TrendingUp, Users, CreditCard, GraduationCap, Flame, AlertTriangle, Calendar, Bot } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../utils/api';
import { fmt, fmtNum, COURSES } from '../../utils/constants';
import { StatCard, LoadingState } from '../../components/ui/index';

const COLORS = ['#4f46e5','#F59E0B','#10B981','#EF4444','#8B5CF6','#06B6D4','#EC4899','#84CC16'];
const GRADE_COLORS = { HOT: '#EF4444', WARM: '#F97316', COLD: '#3B82F6', UNQUALIFIED: '#9CA3AF' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white shadow-xl rounded-xl p-3 border border-gray-100 text-sm">
      <div className="font-semibold text-gray-800 mb-1">{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: p.color }} className="font-medium">{p.name}: {typeof p.value === 'number' && p.value > 1000 ? fmt(p.value) : p.value}</div>)}
    </div>
  );
};

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics-full'],
    queryFn: () => api.get('/analytics/dashboard').then(r => r.data),
    refetchInterval: 60000,
  });
  const { data: payStats } = useQuery({ queryKey: ['payment-stats'], queryFn: () => api.get('/payments/stats').then(r => r.data) });

  if (isLoading) return <LoadingState text="Loading analytics..." />;
  const ov = analytics?.overview || {};
  const charts = analytics?.charts || {};

  const courseData = (charts.courseBreakdown || []).map(c => ({
    name: COURSES[c.interestedCourse]?.split(' ').slice(0,2).join(' ') || 'Unknown',
    leads: c._count.id,
  }));

  const sourceData = (charts.sourceBreakdown || []).map(s => ({
    name: s.source?.replace(/_/g,' ') || 'Unknown',
    value: s._count.id,
  }));

  const statusData = (charts.statusBreakdown || []).map(s => ({
    name: s.status?.replace(/_/g,' ') || 'Unknown',
    value: s._count.id,
  }));

  const funnelData = [
    { name: 'Total Leads', value: ov.totalLeads || 0, fill: '#4f46e5' },
    { name: 'Hot Leads', value: ov.hotLeads || 0, fill: '#EF4444' },
    { name: 'Conversions', value: ov.conversions || 0, fill: '#10B981' },
  ];

  const methodData = (payStats?.methodBreakdown || []).map(m => ({
    name: m.method?.replace('_',' '),
    amount: m._sum.amount || 0,
    count: m._count.id,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Analytics & Reports</h1>
        <p className="text-gray-500 text-sm">Real-time insights for Future Optima IT Solutions</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Leads" value={fmtNum(ov.totalLeads)} sub={`+${fmtNum(ov.newThisMonth)} this month`} color="nexora" />
        <StatCard icon={Flame} label="Hot Leads" value={fmtNum(ov.hotLeads)} sub="AI graded HOT" color="red" />
        <StatCard icon={GraduationCap} label="Conversions" value={fmtNum(ov.conversions)} sub={`${ov.conversionRate}% rate`} color="green" />
        <StatCard icon={CreditCard} label="Revenue Total" value={fmt(ov.revenueTotal)} sub={`${fmt(ov.revenueMonth)} this month`} color="gold" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Calendar} label="Follow-ups" value={fmtNum(ov.upcomingFollowUps)} sub="Due in 2 days" color="orange" />
        <StatCard icon={AlertTriangle} label="Overdue EMIs" value={fmtNum(ov.overdueInstallments)} sub="Needs attention" color="red" />
        <StatCard icon={TrendingUp} label="Conversion Rate" value={`${ov.conversionRate}%`} sub="Lead to enrollment" color="purple" />
        <StatCard icon={Bot} label="AI Graded" value={fmtNum((ov.hotLeads || 0) + (ov.conversions || 0))} sub="Scored by Ollama" color="nexora" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="section-title">Course Interest Breakdown</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={courseData} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="leads" fill="#4f46e5" radius={[6,6,0,0]} name="Leads">
                  {courseData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="section-title">Lead Sources</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name.split(' ')[0]} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [v, 'Leads']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversion funnel */}
        <div className="card">
          <div className="card-header"><h3 className="section-title">Conversion Funnel</h3></div>
          <div className="card-body space-y-3">
            {funnelData.map((item, i) => {
              const pct = funnelData[0].value > 0 ? (item.value / funnelData[0].value) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 font-medium">{item.name}</span>
                    <span className="font-bold" style={{ color: item.fill }}>{fmtNum(item.value)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-4">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: i * 0.2 }} className="h-4 rounded-full" style={{ backgroundColor: item.fill }} />
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{pct.toFixed(1)}% of total</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status breakdown */}
        <div className="card">
          <div className="card-header"><h3 className="section-title">Lead Status Distribution</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name.split(' ')[0]}: ${value}`} labelLine={true}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment methods */}
        <div className="card">
          <div className="card-header"><h3 className="section-title">Collection by Method</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={methodData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" fill="#10B981" radius={[6,6,0,0]} name="Amount (₹)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary table */}
      <div className="card">
        <div className="card-header"><h3 className="section-title">Financial Summary</h3></div>
        <div className="card-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Revenue', value: fmt(ov.revenueTotal), color: 'text-green-600' },
              { label: 'This Month', value: fmt(ov.revenueMonth), color: 'text-blue-600' },
              { label: 'Overdue Amount', value: fmtNum(ov.overdueInstallments) + ' EMIs', color: 'text-red-600' },
              { label: 'Avg Per Student', value: ov.conversions > 0 ? fmt(ov.revenueTotal / ov.conversions) : '—', color: 'text-purple-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center p-4 bg-gray-50 rounded-xl">
                <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
                <div className={`text-xl font-bold ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
