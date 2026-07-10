import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Receipt, Filter, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { fmt, fmtDate } from '../../utils/constants';
import { Modal, LoadingState, EmptyState, StatCard, ConfirmDialog } from '../../components/ui/index';

const CATEGORIES = ['Salary', 'Rent', 'Marketing', 'Sales', 'Office Expense', 'Miscellaneous'];
const SUBCATEGORIES = {
  Marketing: ['Meta Ads', 'Google Ads', 'Other Marketing'],
  Sales: ['B2B & Sales Expense', 'Incentive', 'TA/DA'],
  'Office Expense': ['Administrative Cost', 'Stationary', 'Tea & Snacks', 'Team Outing', 'Electricity', 'Internet', 'Software'],
};
const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];
const BANK_ACCOUNTS = [{ value: 'HDFC', label: 'HDFC Bank' }, { value: 'ICICI', label: 'ICICI Bank' }, { value: 'IDFC', label: 'IDFC Bank' }, { value: 'CASH', label: 'Cash' }];

const CAT_COLORS = {
  Salary: 'bg-blue-100 text-blue-700',
  Rent: 'bg-orange-100 text-orange-700',
  Marketing: 'bg-purple-100 text-purple-700',
  Sales: 'bg-cyan-100 text-cyan-700',
  'Office Expense': 'bg-gray-100 text-gray-700',
  Miscellaneous: 'bg-pink-100 text-pink-700',
};

const now = new Date();
const DEFAULT_FROM = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
const DEFAULT_TO = now.toISOString().slice(0, 10);

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [deleteExpense, setDeleteExpense] = useState(null);
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);
  const [filterCat, setFilterCat] = useState('');
  const [form, setForm] = useState({ category: '', subCategory: '', amount: '', date: DEFAULT_TO, paymentMethod: '', bankAccount: 'CASH', vendor: '', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', from, to, filterCat],
    queryFn: () => api.get(`/finance/expenses?from=${from}&to=${to}${filterCat ? `&category=${filterCat}` : ''}`).then(r => r.data),
  });

  const addMutation = useMutation({
    mutationFn: (body) => api.post('/finance/expenses', body),
    onSuccess: () => {
      toast.success('Expense added!');
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      setShowModal(false);
      setForm({ category: '', subCategory: '', amount: '', date: DEFAULT_TO, paymentMethod: '', bankAccount: 'CASH', vendor: '', notes: '' });
    },
    onError: (err) => toast.error(err?.response?.data?.error || err?.error || 'Failed to add expense'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/finance/expenses/${id}`),
    onSuccess: () => {
      toast.success('Expense deleted');
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      setDeleteExpense(null);
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Delete failed'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.category || !form.amount || !form.date || !form.paymentMethod || !form.bankAccount) {
      toast.error('Fill all required fields'); return;
    }
    if (SUBCATEGORIES[form.category] && !form.subCategory) {
      toast.error('Select a sub-category'); return;
    }
    addMutation.mutate({ ...form, amount: parseFloat(form.amount) });
  };

  const expenses = data?.data || [];
  const byCategory = data?.byCategory || [];
  const totalAmount = data?.totalAmount || 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expense Management</h1>
          <p className="text-sm text-gray-500 mt-1">Track and manage institute expenses</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card col-span-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
              <Receipt className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Total This Period</div>
              <div className="text-2xl font-bold text-gray-900">{fmt(totalAmount)}</div>
            </div>
          </div>
        </div>
        {byCategory.slice(0, 2).map(cat => (
          <div key={cat.category} className="card">
            <div className="text-xs text-gray-500 mb-1">{cat.category}</div>
            <div className="text-xl font-bold text-gray-900">{fmt(cat._sum?.amount || 0)}</div>
            <div className="text-xs text-gray-400">{cat._count?.id || 0} records</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
            <Filter className="w-4 h-4" /> Filters:
          </div>
          <div>
            <label className="label text-xs">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input text-sm py-1.5" />
          </div>
          <div>
            <label className="label text-xs">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input text-sm py-1.5" />
          </div>
          <div>
            <label className="label text-xs">Category</label>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="input text-sm py-1.5">
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? <LoadingState text="Loading expenses..." /> : (
        <div className="card p-0 overflow-hidden">
          {expenses.length === 0 ? (
            <EmptyState title="No expenses found" description="Add your first expense to start tracking." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Date', 'Category', 'Vendor', 'Amount', 'Method', 'Account', 'Added By', 'Notes', ''].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expenses.map(exp => (
                    <motion.tr key={exp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{fmtDate(exp.date)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${CAT_COLORS[exp.category] || 'bg-gray-100 text-gray-700'}`}>
                          {exp.category}
                        </span>
                        {exp.subCategory && <div className="text-xs text-gray-400 mt-0.5">{exp.subCategory}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{exp.vendor || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-red-600">{fmt(exp.amount)}</td>
                      <td className="px-4 py-3 text-gray-500">{exp.paymentMethod}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{BANK_ACCOUNTS.find(b => b.value === exp.bankAccount)?.label || exp.bankAccount || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{exp.addedBy?.name}</td>
                      <td className="px-4 py-3 text-gray-400 max-w-[140px] truncate">{exp.notes || '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setDeleteExpense(exp)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Delete expense">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteExpense}
        onClose={() => setDeleteExpense(null)}
        onConfirm={() => deleteMutation.mutate(deleteExpense?.id)}
        loading={deleteMutation.isPending}
        danger
        title={`Delete expense?`}
        message={`${deleteExpense?.category} — ${deleteExpense?.amount ? '₹' + deleteExpense.amount.toLocaleString('en-IN') : ''}\n\nThis will permanently remove the record. This cannot be undone.`}
        confirmLabel="Delete"
      />

      {/* Add Expense Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Expense" size="md">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category *</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, subCategory: '' }))} className="input" required>
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {SUBCATEGORIES[form.category] && (
              <div>
                <label className="label">Sub-Category *</label>
                <select value={form.subCategory} onChange={e => setForm(f => ({ ...f, subCategory: e.target.value }))} className="input" required>
                  <option value="">Select sub-category</option>
                  {SUBCATEGORIES[form.category].map(sc => <option key={sc} value={sc}>{sc}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="label">Amount (₹) *</label>
              <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="input" placeholder="0.00" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input" required />
            </div>
            <div>
              <label className="label">Payment Method *</label>
              <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} className="input" required>
                <option value="">Select method</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Account *</label>
            <select value={form.bankAccount} onChange={e => setForm(f => ({ ...f, bankAccount: e.target.value }))} className="input" required>
              {BANK_ACCOUNTS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Vendor Name</label>
            <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} className="input" placeholder="Optional" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input resize-none" rows={2} placeholder="Optional notes" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="btn-primary">
              {addMutation.isPending ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
