import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, FileText, TrendingUp, Users, CreditCard } from 'lucide-react';
import api from '../utils/api';
import { fmt, fmtDate } from '../utils/constants';
import { LoadingState } from '../components/ui/index';
import { useAuthStore } from '../store/authStore';

const COLORS = ['#4f46e5', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899'];

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]).join(',');
  const body = rows.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([headers + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { user } = useAuthStore();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);
  const [tab, setTab] = useState('fee');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const monthFrom = `${month}-01`;
  const monthTo = new Date(month + '-01');
  monthTo.setMonth(monthTo.getMonth() + 1);
  monthTo.setDate(0);
  const monthToStr = monthTo.toISOString().slice(0, 10);

  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['reports', month],
    queryFn: () => api.get(`/analytics/reports?from=${monthFrom}&to=${monthToStr}`).then(r => r.data),
    enabled: tab !== 'source' || true,
  });

  const { data: allReports } = useQuery({
    queryKey: ['reports-all'],
    queryFn: () => api.get('/analytics/reports').then(r => r.data),
  });

  const payments = reportsData?.payments || [];
  const allEnrollments = allReports?.enrollments || [];
  const counselorStats = allReports?.counselorStats || [];

  const totalCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);

  // Daily collection for bar chart
  const dailyMap = {};
  payments.forEach(p => {
    const day = new Date(p.paidAt).getDate();
    dailyMap[day] = (dailyMap[day] || 0) + p.amount;
  });
  const dailyData = Object.entries(dailyMap).map(([day, amount]) => ({ day: `Day ${day}`, amount })).sort((a, b) => parseInt(a.day.split(' ')[1]) - parseInt(b.day.split(' ')[1]));

  // Course enrollment stats
  const courseMap = {};
  allEnrollments.forEach(e => {
    const name = e.course?.shortName || 'Unknown';
    if (!courseMap[name]) courseMap[name] = { name, enrolled: 0, revenue: 0, active: 0, completed: 0, dropped: 0 };
    courseMap[name].enrolled++;
    courseMap[name].revenue += e.payments?.reduce((s, p) => s + p.amount, 0) || 0;
    if (e.status === 'ACTIVE') courseMap[name].active++;
    if (e.status === 'COMPLETED') courseMap[name].completed++;
    if (e.status === 'DROPPED') courseMap[name].dropped++;
  });
  const courseRows = Object.values(courseMap);
  const coursePieData = courseRows.map(c => ({ name: c.name, value: c.enrolled }));

  // Lead source stats
  const sourceStats = allReports?.leadSources || [];

  const TABS = [
    { id: 'fee', label: 'Fee Collection', icon: CreditCard },
    { id: 'course', label: 'Course Enrollment', icon: FileText },
    { id: 'source', label: 'Lead Sources', icon: TrendingUp },
    { id: 'counselor', label: 'Counselor Performance', icon: Users, adminOnly: true },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="text-gray-500 text-sm">Business intelligence and performance analytics</p>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.filter(t => !t.adminOnly || isAdmin).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>

        {isLoading && tab === 'fee' ? <LoadingState /> : (
          <>
            {/* Tab 1: Fee Collection */}
            {tab === 'fee' && (
              <div className="p-5 space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <input type="month" className="input w-auto" value={month} onChange={e => setMonth(e.target.value)} />
                    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                      <span className="text-xs text-gray-500">Total Collected: </span>
                      <span className="font-bold text-green-700 text-lg">{fmt(totalCollected)}</span>
                    </div>
                  </div>
                  <button onClick={() => exportCSV(payments.map(p => ({ 'Student': p.enrollment?.lead?.name, 'Phone': p.enrollment?.lead?.phone, 'Course': p.enrollment?.course?.shortName, 'Amount': p.amount, 'Method': p.method, 'Receipt': p.receiptNumber, 'Date': fmtDate(p.paidAt) })), `fee-collection-${month}.csv`)} className="btn-secondary text-sm">
                    <Download className="w-4 h-4" />Export CSV
                  </button>
                </div>

                {dailyData.length > 0 && (
                  <div className="card p-4">
                    <h3 className="section-title mb-3">Daily Collection — {month}</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={dailyData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={v => [fmt(v), 'Collected']} />
                        <Bar dataKey="amount" fill="#10B981" radius={[4, 4, 0, 0]} name="Amount" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50"><tr>{['Student', 'Course', 'Amount', 'Method', 'Receipt', 'Date'].map(h => <th key={h} className="px-4 py-3 text-left table-header">{h}</th>)}</tr></thead>
                    <tbody>
                      {payments.map((p, i) => (
                        <tr key={p.id} className="table-row">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium">{p.enrollment?.lead?.name}</div>
                            <div className="text-xs text-gray-400">{p.enrollment?.lead?.phone}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">{p.enrollment?.course?.shortName}</td>
                          <td className="px-4 py-3 font-bold text-green-700 text-sm">{fmt(p.amount)}</td>
                          <td className="px-4 py-3"><span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{p.method.replace('_', ' ')}</span></td>
                          <td className="px-4 py-3 text-xs font-mono text-gray-600">{p.receiptNumber}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(p.paidAt)}</td>
                        </tr>
                      ))}
                      {!payments.length && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No payments in {month}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 2: Course Enrollment */}
            {tab === 'course' && (
              <div className="p-5 space-y-5">
                <div className="flex justify-end">
                  <button onClick={() => exportCSV(courseRows.map(c => ({ 'Course': c.name, 'Enrolled': c.enrolled, 'Active': c.active, 'Completed': c.completed, 'Dropped': c.dropped, 'Revenue': c.revenue })), 'course-enrollment.csv')} className="btn-secondary text-sm">
                    <Download className="w-4 h-4" />Export CSV
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <table className="w-full">
                      <thead className="bg-gray-50"><tr>{['Course', 'Total', 'Active', 'Completed', 'Dropped', 'Revenue'].map(h => <th key={h} className="px-3 py-2 text-left table-header text-xs">{h}</th>)}</tr></thead>
                      <tbody>
                        {courseRows.map(c => (
                          <tr key={c.name} className="table-row">
                            <td className="px-3 py-2 text-sm font-medium">{c.name}</td>
                            <td className="px-3 py-2 text-sm font-bold">{c.enrolled}</td>
                            <td className="px-3 py-2 text-xs text-green-600">{c.active}</td>
                            <td className="px-3 py-2 text-xs text-blue-600">{c.completed}</td>
                            <td className="px-3 py-2 text-xs text-red-600">{c.dropped}</td>
                            <td className="px-3 py-2 text-sm font-semibold text-green-700">{fmt(c.revenue)}</td>
                          </tr>
                        ))}
                        {!courseRows.length && <tr><td colSpan={6} className="text-center py-6 text-gray-400">No enrollments yet</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {coursePieData.length > 0 && (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={coursePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {coursePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={v => [v, 'Enrolled']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Lead Sources */}
            {tab === 'source' && (
              <div className="p-5 space-y-5">
                <div className="flex justify-end">
                  <button onClick={() => exportCSV(sourceStats.map(s => ({ 'Source': s.source, 'Total Leads': s._count.id })), 'lead-sources.csv')} className="btn-secondary text-sm">
                    <Download className="w-4 h-4" />Export CSV
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <table className="w-full">
                    <thead className="bg-gray-50"><tr>{['Source', 'Total Leads'].map(h => <th key={h} className="px-4 py-3 text-left table-header">{h}</th>)}</tr></thead>
                    <tbody>
                      {sourceStats.map(s => (
                        <tr key={s.source} className="table-row">
                          <td className="px-4 py-3 text-sm font-medium">{s.source?.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-sm font-bold">{s._count.id}</td>
                        </tr>
                      ))}
                      {!sourceStats.length && <tr><td colSpan={2} className="text-center py-6 text-gray-400">No data yet</td></tr>}
                    </tbody>
                  </table>
                  {sourceStats.length > 0 && (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={sourceStats.map(s => ({ name: s.source?.replace(/_/g, ' ') || 'Other', value: s._count.id }))} margin={{ top: 0, right: 10, left: -15, bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Leads" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: Counselor Performance */}
            {tab === 'counselor' && isAdmin && (
              <div className="p-5 space-y-4">
                <div className="flex justify-end">
                  <button onClick={() => exportCSV(counselorStats.map(c => ({ 'Name': c.name, 'Role': c.role, 'Assigned': c.assigned, 'Contacted': c.contacted, 'Converted': c.converted, 'Rate %': c.rate, 'Revenue': c.revenue })), 'counselor-performance.csv')} className="btn-secondary text-sm">
                    <Download className="w-4 h-4" />Export CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50"><tr>{['Counselor', 'Role', 'Assigned', 'Contacted', 'Converted', 'Rate', 'Revenue'].map(h => <th key={h} className="px-4 py-3 text-left table-header">{h}</th>)}</tr></thead>
                    <tbody>
                      {counselorStats.map(c => (
                        <tr key={c.id} className="table-row">
                          <td className="px-4 py-3 font-medium text-sm">{c.name}</td>
                          <td className="px-4 py-3 text-xs"><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{c.role.replace('_', ' ')}</span></td>
                          <td className="px-4 py-3 text-sm font-bold">{c.assigned}</td>
                          <td className="px-4 py-3 text-sm">{c.contacted}</td>
                          <td className="px-4 py-3 text-sm text-green-600 font-semibold">{c.converted}</td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${Number(c.rate) >= 20 ? 'text-green-600' : Number(c.rate) >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>{c.rate}%</span>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-700">{fmt(c.revenue)}</td>
                        </tr>
                      ))}
                      {!counselorStats.length && <tr><td colSpan={7} className="text-center py-6 text-gray-400">No counselors found</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
