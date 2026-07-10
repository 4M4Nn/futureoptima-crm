import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, Receipt, Users, AlertTriangle, Bot, RefreshCw, ArrowLeftRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { fmt, fmtDate } from '../../utils/constants';
import { LoadingState, StatCard, Modal, Input, Select } from '../../components/ui/index';

const COLORS = ['#4f46e5', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#F97316'];

const METHOD_LABELS = { CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque', CARD: 'Card', EMI: 'EMI' };
const ACCOUNT_LABELS = { CASH: '💵 Cash', ICICI: '🏦 ICICI', IDFC: '🏦 IDFC', HDFC: '🏦 HDFC' };
const ACCOUNT_OPTIONS = [
  { value: 'CASH', label: 'Cash' }, { value: 'ICICI', label: 'ICICI Bank' },
  { value: 'IDFC', label: 'IDFC Bank' }, { value: 'HDFC', label: 'HDFC Bank' },
];

function RecordTransferModal({ open, onClose }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ fromAccount: 'ICICI', toAccount: 'HDFC', amount: '', transferDate: today, reason: '' });

  const mutation = useMutation({
    mutationFn: () => api.post('/finance/transfers', form).then(r => r.data),
    onSuccess: () => {
      toast.success('Transfer recorded!');
      qc.invalidateQueries({ queryKey: ['finance-accounts'] });
      qc.invalidateQueries({ queryKey: ['finance-transfers'] });
      setForm({ fromAccount: 'ICICI', toAccount: 'HDFC', amount: '', transferDate: today, reason: '' });
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Failed to record transfer'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.fromAccount === form.toAccount) { toast.error('From and To accounts must be different'); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    mutation.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Record Fund Transfer" size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3">
          For moving money between the institute's own accounts (e.g. replenishing HDFC). Not counted as income or expense.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Select label="From Account *" value={form.fromAccount} onChange={v => setForm(f => ({ ...f, fromAccount: v }))} options={ACCOUNT_OPTIONS} />
          <Select label="To Account *" value={form.toAccount} onChange={v => setForm(f => ({ ...f, toAccount: v }))} options={ACCOUNT_OPTIONS} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Amount (₹) *" type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="20000" />
          <Input label="Date *" type="date" value={form.transferDate} onChange={e => setForm(f => ({ ...f, transferDate: e.target.value }))} />
        </div>
        <Input label="Reason" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Replenish after direct HDFC expense" />
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? 'Recording...' : <><ArrowLeftRight className="w-4 h-4" />Record Transfer</>}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function FinanceDashboard() {
  const [insightsVisible, setInsightsVisible] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ['finance-accounts'],
    queryFn: () => api.get('/finance/accounts').then(r => r.data),
  });

  const { data: transfers } = useQuery({
    queryKey: ['finance-transfers'],
    queryFn: () => api.get('/finance/transfers?limit=8').then(r => r.data),
  });

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

      {/* Bank-wise Collection */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Bank-wise Collection This Month</h3>
        <div className="space-y-3">
          {[
            { label: '💵 Cash', value: d.bankWiseCollection?.cash || 0, border: 'border-green-500', text: 'text-green-600' },
            { label: '🏦 ICICI', value: d.bankWiseCollection?.icici || 0, border: 'border-orange-500', text: 'text-orange-600' },
            { label: '🏦 IDFC', value: d.bankWiseCollection?.idfc || 0, border: 'border-blue-500', text: 'text-blue-600' },
            { label: '🏦 HDFC', value: d.bankWiseCollection?.hdfc || 0, border: 'border-purple-500', text: 'text-purple-600' },
          ].map(row => (
            <div key={row.label} className={`flex items-center justify-between pl-4 py-2 border-l-4 ${row.border}`}>
              <span className="text-sm font-medium text-gray-700">{row.label}</span>
              <span className={`text-lg font-bold ${row.text}`}>{fmt(row.value)}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">Total</span>
            <span className="text-xl font-bold text-primary-900">{fmt(d.bankWiseCollection?.total || 0)}</span>
          </div>
        </div>
      </div>

      {/* Bank Account Balances & Transfers */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Bank Account Balances</h3>
            <p className="text-xs text-gray-400">All-time income minus expenses, adjusted for transfers between accounts</p>
          </div>
          <button onClick={() => setShowTransferModal(true)} className="btn-secondary text-sm">
            <ArrowLeftRight className="w-4 h-4" />Record Transfer
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {(accounts?.data || []).map(a => (
            <div key={a.account} className="bg-gray-50 rounded-xl p-3">
              <div className="text-xs text-gray-500">{ACCOUNT_LABELS[a.account] || a.account}</div>
              <div className={`text-lg font-bold ${a.netBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{fmt(a.netBalance)}</div>
            </div>
          ))}
        </div>
        {transfers?.data?.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-2">Recent Transfers</div>
            <div className="space-y-1.5">
              {transfers.data.map(t => (
                <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 text-gray-700">
                    <span>{ACCOUNT_LABELS[t.fromAccount] || t.fromAccount}</span>
                    <ArrowLeftRight className="w-3 h-3 text-gray-300" />
                    <span>{ACCOUNT_LABELS[t.toAccount] || t.toAccount}</span>
                    {t.reason && <span className="text-xs text-gray-400">— {t.reason}</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-semibold text-gray-900">{fmt(t.amount)}</span>
                    <span className="text-xs text-gray-400">{fmtDate(t.transferDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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

      <RecordTransferModal open={showTransferModal} onClose={() => setShowTransferModal(false)} />
    </div>
  );
}
