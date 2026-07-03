import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, FileText, TrendingUp, AlertTriangle, Users, Receipt, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { fmt, fmtDate } from '../../utils/constants';
import { LoadingState, EmptyState } from '../../components/ui/index';

// Format using LOCAL date components (not toISOString, which converts to UTC and
// can shift the date by a day for timezones ahead of UTC, e.g. IST).
const formatDate = (d) => {
  const date = new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const now = new Date();
const DEFAULT_FROM = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
const DEFAULT_TO = formatDate(now);
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function exportCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]).join(',');
  const body = rows.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([headers + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const TABS = [
  { id: 'pl', label: 'Profit & Loss', icon: TrendingUp },
  { id: 'collection', label: 'Collection', icon: FileText },
  { id: 'pending', label: 'Pending Fees', icon: AlertTriangle },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'salary', label: 'Salary', icon: Users },
];

export default function FinanceReportsPage() {
  const [tab, setTab] = useState('pl');
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterCat, setFilterCat] = useState('');
  const [exporting, setExporting] = useState(false);

  const exportExcel = async (url, filename) => {
    try {
      setExporting(true);
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('Excel downloaded!');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const { data: plData, isLoading: plLoading } = useQuery({
    queryKey: ['finance-pl', from, to],
    queryFn: () => api.get(`/finance/reports/pl?from=${from}&to=${to}`).then(r => r.data),
    enabled: tab === 'pl',
  });

  const { data: collData, isLoading: collLoading } = useQuery({
    queryKey: ['finance-coll', from, to],
    queryFn: () => api.get(`/finance/collections?from=${from}&to=${to}`).then(r => r.data),
    enabled: tab === 'collection',
  });

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['finance-pending'],
    queryFn: () => api.get('/finance/reports/pending-fees').then(r => r.data),
    enabled: tab === 'pending',
  });

  const { data: expData, isLoading: expLoading } = useQuery({
    queryKey: ['finance-exp-report', from, to, filterCat],
    queryFn: () => api.get(`/finance/expenses?from=${from}&to=${to}${filterCat ? `&category=${filterCat}` : ''}`).then(r => r.data),
    enabled: tab === 'expenses',
  });

  const { data: salData, isLoading: salLoading } = useQuery({
    queryKey: ['salary-report', filterMonth, filterYear],
    queryFn: () => api.get(`/finance/salary?month=${filterMonth}&year=${filterYear}`).then(r => r.data),
    enabled: tab === 'salary',
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finance Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Comprehensive financial reporting and analytics</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Date Range (shared) */}
      {['pl', 'collection', 'expenses'].includes(tab) && (
        <div className="card">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="label text-xs">From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input text-sm py-1.5" />
            </div>
            <div>
              <label className="label text-xs">To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input text-sm py-1.5" />
            </div>
            {tab === 'expenses' && (
              <div>
                <label className="label text-xs">Category</label>
                <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="input text-sm py-1.5">
                  <option value="">All</option>
                  {['Salary','Marketing','Rent','Electricity','Internet','Software','Office','Travel','Miscellaneous'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'salary' && (
        <div className="card">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="label text-xs">Month</label>
              <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))} className="input text-sm py-1.5">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Year</label>
              <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} className="input text-sm py-1.5">
                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* P&L Tab */}
      {tab === 'pl' && (
        plLoading ? <LoadingState text="Calculating P&L..." /> : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                disabled={exporting}
                onClick={() => {
                  const toDate = new Date(to);
                  const filename = `FutureOptima_PL_${MONTHS[toDate.getMonth()]}_${toDate.getFullYear()}.xlsx`;
                  exportExcel(`/finance/reports/pl-excel?from=${from}&to=${to}`, filename);
                }}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-900 transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" /> {exporting ? 'Downloading...' : 'Download Excel (GST)'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="card text-center">
                <div className="text-sm text-gray-500 mb-1">Total Income</div>
                <div className="text-3xl font-bold text-green-600">{fmt(plData?.totalIncome)}</div>
              </div>
              <div className="card text-center">
                <div className="text-sm text-gray-500 mb-1">Total Expenses</div>
                <div className="text-3xl font-bold text-red-600">{fmt(plData?.totalExpenses)}</div>
              </div>
              <div className={`card text-center ${(plData?.netProfit || 0) >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <div className="text-sm text-gray-500 mb-1">Net Profit / Loss</div>
                <div className={`text-3xl font-bold ${(plData?.netProfit || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {fmt(plData?.netProfit)}
                </div>
              </div>
            </div>
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Income vs Expenses</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[{ name: 'This Period', Income: plData?.totalIncome || 0, Expenses: plData?.totalExpenses || 0 }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {(plData?.expenseBreakdown || []).length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Expense Breakdown by Category</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Category</th>
                        <th className="text-right text-xs font-medium text-gray-500 px-4 py-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(plData?.expenseBreakdown || []).map(cat => (
                        <tr key={cat.category}>
                          <td className="px-4 py-2 text-gray-700">{cat.category}</td>
                          <td className="px-4 py-2 text-right font-semibold text-red-600">{fmt(cat._sum?.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* Collection Tab */}
      {tab === 'collection' && (
        collLoading ? <LoadingState text="Loading collections..." /> : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="card inline-flex items-center gap-3 py-3 px-4">
                <span className="text-sm text-gray-500">Total Collection:</span>
                <span className="text-xl font-bold text-green-600">{fmt(collData?.totalAmount)}</span>
                <span className="text-sm text-gray-400">({collData?.totalCount} payments)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportCSV((collData?.data || []).map(p => ({ Date: fmtDate(p.paidAt), Student: p.enrollment?.lead?.name, Course: p.enrollment?.course?.shortName, Amount: p.amount, Method: p.method, CollectedBy: p.collectedBy?.name })), 'collections.csv')}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
                <button
                  disabled={exporting}
                  onClick={() => exportExcel(`/finance/reports/collection-excel?from=${from}&to=${to}`, `FutureOptima_Collection_${from}_to_${to}.xlsx`)}
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-900 transition-colors disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" /> {exporting ? 'Downloading...' : 'Export with Phone Numbers'}
                </button>
              </div>
            </div>
            <div className="card p-0 overflow-hidden">
              {(collData?.data || []).length === 0 ? <EmptyState title="No payments in this period" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Date', 'Student', 'Course', 'Amount', 'Method', 'Collected By'].map(h => (
                          <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(collData?.data || []).map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-600">{fmtDate(p.paidAt)}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-900">{p.enrollment?.lead?.name}</td>
                          <td className="px-4 py-2.5 text-gray-500">{p.enrollment?.course?.shortName}</td>
                          <td className="px-4 py-2.5 font-semibold text-green-600">{fmt(p.amount)}</td>
                          <td className="px-4 py-2.5 text-gray-500">{p.method}</td>
                          <td className="px-4 py-2.5 text-gray-500">{p.collectedBy?.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* Pending Fees Tab */}
      {tab === 'pending' && (
        pendingLoading ? <LoadingState text="Loading pending fees..." /> : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="card inline-flex items-center gap-3 py-3 px-4">
                <span className="text-sm text-gray-500">Total Pending:</span>
                <span className="text-xl font-bold text-red-600">{fmt(pendingData?.totalPending)}</span>
                <span className="text-sm text-gray-400">({(pendingData?.data || []).length} students)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportCSV((pendingData?.data || []).map(s => ({ Name: s.name, Phone: s.phone, Course: s.course, EnrolledAt: fmtDate(s.enrolledAt), TotalFee: s.totalFee, Paid: s.paid, Balance: s.balance })), 'pending-fees.csv')}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
                <button
                  disabled={exporting}
                  onClick={() => exportExcel('/finance/reports/pending-excel', 'FutureOptima_Pending_Fees.xlsx')}
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-900 transition-colors disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" /> {exporting ? 'Downloading...' : 'Export Pending List'}
                </button>
              </div>
            </div>
            <div className="card p-0 overflow-hidden">
              {(pendingData?.data || []).length === 0 ? <EmptyState title="No pending fees" description="All students have cleared their fees!" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Student', 'Phone', 'Course', 'Enrolled', 'Total Fee', 'Paid', 'Balance'].map(h => (
                          <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(pendingData?.data || []).map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-900">{s.name}</td>
                          <td className="px-4 py-2.5 text-gray-500">{s.phone}</td>
                          <td className="px-4 py-2.5 text-gray-500">{s.course}</td>
                          <td className="px-4 py-2.5 text-gray-400">{fmtDate(s.enrolledAt)}</td>
                          <td className="px-4 py-2.5 text-gray-700">{fmt(s.totalFee)}</td>
                          <td className="px-4 py-2.5 text-green-600">{fmt(s.paid)}</td>
                          <td className="px-4 py-2.5 font-bold text-red-600">{fmt(s.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* Expenses Tab */}
      {tab === 'expenses' && (
        expLoading ? <LoadingState text="Loading expenses..." /> : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="card inline-flex items-center gap-3 py-3 px-4">
                <span className="text-sm text-gray-500">Total Expenses:</span>
                <span className="text-xl font-bold text-red-600">{fmt(expData?.totalAmount)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportCSV((expData?.data || []).map(e => ({ Date: fmtDate(e.date), Category: e.category, Vendor: e.vendor || '', Amount: e.amount, Method: e.paymentMethod, AddedBy: e.addedBy?.name })), 'expenses.csv')}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
                <button
                  disabled={exporting}
                  onClick={() => exportExcel(`/finance/reports/expense-excel?from=${from}&to=${to}${filterCat ? `&category=${filterCat}` : ''}`, `FutureOptima_Expenses_${from}_to_${to}.xlsx`)}
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-900 transition-colors disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" /> {exporting ? 'Downloading...' : 'Export Expenses'}
                </button>
              </div>
            </div>
            {(expData?.byCategory || []).length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3">By Category</h3>
                <div className="grid grid-cols-3 gap-3">
                  {(expData?.byCategory || []).map(cat => (
                    <div key={cat.category} className="bg-gray-50 rounded-xl px-4 py-3">
                      <div className="text-xs text-gray-500">{cat.category}</div>
                      <div className="text-lg font-bold text-gray-900">{fmt(cat._sum?.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="card p-0 overflow-hidden">
              {(expData?.data || []).length === 0 ? <EmptyState title="No expenses in this period" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Date', 'Category', 'Vendor', 'Amount', 'Method'].map(h => (
                          <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(expData?.data || []).map(e => (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-600">{fmtDate(e.date)}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-900">{e.category}</td>
                          <td className="px-4 py-2.5 text-gray-500">{e.vendor || '—'}</td>
                          <td className="px-4 py-2.5 font-semibold text-red-600">{fmt(e.amount)}</td>
                          <td className="px-4 py-2.5 text-gray-500">{e.paymentMethod}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* Salary Tab */}
      {tab === 'salary' && (
        salLoading ? <LoadingState text="Loading salary records..." /> : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="card inline-flex items-center gap-3 py-3 px-4">
                <span className="text-sm text-gray-500">Total Payroll:</span>
                <span className="text-xl font-bold text-blue-600">{fmt(salData?.totalPayroll)}</span>
                <span className="text-sm text-gray-400">({(salData?.data || []).length} records)</span>
              </div>
              <button
                disabled={exporting}
                onClick={() => exportExcel(`/finance/reports/salary-excel?month=${filterMonth}&year=${filterYear}`, `FutureOptima_Salary_${MONTHS[filterMonth - 1]}_${filterYear}.xlsx`)}
                className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-900 transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" /> {exporting ? 'Downloading...' : 'Export Salary Sheet'}
              </button>
            </div>
            <div className="card p-0 overflow-hidden">
              {(salData?.data || []).length === 0 ? <EmptyState title="No salary records for this period" /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Employee', 'Month/Year', 'Basic', 'Bonus', 'Deductions', 'Net Salary', 'Status'].map(h => (
                          <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(salData?.data || []).map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-900">{r.user?.name}</td>
                          <td className="px-4 py-2.5 text-gray-500">{MONTHS[r.month - 1]} {r.year}</td>
                          <td className="px-4 py-2.5 text-gray-700">{fmt(r.basicSalary)}</td>
                          <td className="px-4 py-2.5 text-green-600">+{fmt(r.bonus)}</td>
                          <td className="px-4 py-2.5 text-red-600">-{fmt(r.deductions)}</td>
                          <td className="px-4 py-2.5 font-bold text-gray-900">{fmt(r.netSalary)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {r.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
