import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, Receipt, Users, AlertTriangle, Bot, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import api from '../../utils/api';
import { fmt, fmtDate } from '../../utils/constants';
import { LoadingState, StatCard } from '../../components/ui/index';

const COLORS = ['#4f46e5', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#F97316'];

const METHOD_LABELS = { CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque', CARD: 'Card', EMI: 'EMI' };

export default function FinanceDashboard() {
  const [insightsVisible, setInsightsVisible] = useState(false);

  const { data: dash, isLoading } = useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: () => api.get('/finance/dashboard').then(r => r.data),
  });

  const { data: collections } = useQuery({
    queryKey: ['finance-collections-month'],
    queryFn: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      return api.get(`/finance/collections?from=${from}&to=${to}`).then(r => r.data);
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ['finance-expenses-month'],
    queryFn: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const to = now.toISOString().slice(0, 10);
      return api.get(`/finance/expenses?from=${from}&to=${to}`).then(r => r.data);
    },
  });

  const { data: insightsData, isLoading: insightsLoading, refetch: refetchInsights } = useQuery({
    queryKey: ['finance-ai-insights'],
    queryFn: () => api.get('/finance/ai-insights').then(r => r.data),
    enabled: insightsVisible,
  });

  const { data: pendingFees } = useQuery({
    queryKey: ['finance-pending-fees'],
    queryFn: () => api.get('/finance/reports/pending-fees').then(r => r.data),
  });

  if (isLoading) return <LoadingState text="Loading finance dashboard..." />;

  const d = dash || {};
  const netProfitPositive = (d.netProfit || 0) >= 0;

  // Build daily collection chart from this month's payments
  const dailyMap = {};
  (collections?.data || []).forEach(p => {
    const day = new Date(p.paidAt).getDate();
    dailyMap[day] = (dailyMap[day] || 0) + p.amount;
  });
  const dailyData = Array.from({ length: new Date().getDate() }, (_, i) => ({
    day: i + 1,
    amount: dailyMap[i + 1] || 0,
  }));

  // Expense breakdown by category
  const expenseChart = (expenses?.byCategory || []).map(e => ({
    name: e.category,
    value: e._sum?.amount || 0,
  }));

  // Build monthly trend (last 6 months from collections)
  const monthlyMap = {};
  (collections?.data || []).forEach(p => {
    const key = new Date(p.paidAt).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    monthlyMap[key] = (monthlyMap[key] || 0) + p.amount;
  });
  const monthlyData = Object.entries(monthlyMap).map(([month, amount]) => ({ month, amount })).slice(-6);

  const recentTx = d.recentTransactions || [];
  const pendingInstallmentList = (pendingFees?.data || []).filter(s => s.balance > 0).slice(0, 8);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="nexora-gradient rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Finance Dashboard</h2>
            <p className="text-blue-200 mt-1">Institute financial overview — Future Optima IT Solutions</p>
          </div>
          <div className="hidden md:flex gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 text-center">
              <div className="text-2xl font-bold">{fmt(d.monthCollection)}</div>
              <div className="text-xs text-blue-200">This Month</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={DollarSign} label="Today's Collection" value={fmt(d.todayCollection)} color="green" />
        <StatCard icon={TrendingUp} label="Month Revenue" value={fmt(d.monthCollection)} color="blue" />
        <StatCard icon={Receipt} label="Month Expenses" value={fmt(d.monthExpenses)} color="red" />
        <StatCard
          icon={netProfitPositive ? TrendingUp : TrendingDown}
          label="Net Profit"
          value={fmt(d.netProfit)}
          color={netProfitPositive ? 'green' : 'red'}
        />
        <StatCard icon={AlertTriangle} label="Pending Fees" value={fmt(d.pendingFees)} color="orange" />
        <StatCard icon={Users} label="Overdue EMIs" value={d.overdueInstallments || 0} sub="installments" color="red" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Collections Bar */}
        <div className="card col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Daily Collections (This Month)</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip formatter={v => fmt(v)} />
              <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Collection" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Pie */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
          {expenseChart.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No expenses this month</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={expenseChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                  {expenseChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Monthly Trend Line */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip formatter={v => fmt(v)} />
              <Line type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} name="Revenue" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Transactions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs text-gray-500 font-medium pb-2">Student</th>
                  <th className="text-left text-xs text-gray-500 font-medium pb-2">Course</th>
                  <th className="text-right text-xs text-gray-500 font-medium pb-2">Amount</th>
                  <th className="text-left text-xs text-gray-500 font-medium pb-2 pl-2">Method</th>
                  <th className="text-left text-xs text-gray-500 font-medium pb-2 pl-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentTx.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-gray-400 py-6 text-xs">No transactions yet</td></tr>
                ) : recentTx.map(tx => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-900">{tx.enrollment?.lead?.name}</td>
                    <td className="py-2 text-gray-500">{tx.enrollment?.course?.shortName}</td>
                    <td className="py-2 text-right text-green-600 font-semibold">{fmt(tx.amount)}</td>
                    <td className="py-2 pl-2 text-gray-500">{METHOD_LABELS[tx.method] || tx.method}</td>
                    <td className="py-2 pl-2 text-gray-400">{fmtDate(tx.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Fees */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Pending Fees</h3>
            <span className="text-xs text-gray-400">{pendingInstallmentList.length} students</span>
          </div>
          <div className="space-y-2">
            {pendingInstallmentList.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-6">All fees cleared!</div>
            ) : pendingInstallmentList.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-900">{s.name}</div>
                  <div className="text-xs text-gray-400">{s.course} · {s.phone}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-red-600">{fmt(s.balance)}</div>
                  <div className="text-xs text-gray-400">balance</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="rounded-2xl overflow-hidden border border-purple-100">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-semibold">AI Finance Insights</div>
              <div className="text-purple-200 text-xs">Powered by Groq AI — financial analysis & recommendations</div>
            </div>
          </div>
          <button
            onClick={() => { setInsightsVisible(true); refetchInsights(); }}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {insightsVisible ? 'Refresh' : 'Load'} Insights
          </button>
        </div>
        <div className="p-5 bg-white">
          {!insightsVisible ? (
            <p className="text-sm text-gray-400 text-center py-4">Click "Load Insights" to analyze your financial data with AI.</p>
          ) : insightsLoading ? (
            <div className="flex items-center gap-3 text-gray-500 text-sm py-4">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />
              Analyzing your financial data...
            </div>
          ) : (
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {insightsData?.insights || 'Unable to generate insights. Check your Groq API key.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
