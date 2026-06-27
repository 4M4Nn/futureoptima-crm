import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Download, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { fmt, fmtDate } from '../../utils/constants';
import { Modal, LoadingState, EmptyState } from '../../components/ui/index';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];

const now = new Date();
const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
};

export default function SalaryPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [form, setForm] = useState({
    userId: '', month: now.getMonth() + 1, year: now.getFullYear(),
    basicSalary: '', bonus: '0', deductions: '0', netSalary: '',
    paymentStatus: 'PENDING', paymentDate: '', paymentMethod: '', notes: '',
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['salary-records', filterMonth, filterYear],
    queryFn: () => api.get(`/finance/salary?month=${filterMonth}&year=${filterYear}`).then(r => r.data),
  });

  useEffect(() => {
    const basic = parseFloat(form.basicSalary) || 0;
    const bonus = parseFloat(form.bonus) || 0;
    const deductions = parseFloat(form.deductions) || 0;
    setForm(f => ({ ...f, netSalary: String(basic + bonus - deductions) }));
  }, [form.basicSalary, form.bonus, form.deductions]);

  const addMutation = useMutation({
    mutationFn: (body) => api.post('/finance/salary', body),
    onSuccess: () => {
      toast.success('Salary record added!');
      qc.invalidateQueries({ queryKey: ['salary-records'] });
      setShowModal(false);
      setForm({ userId: '', month: now.getMonth() + 1, year: now.getFullYear(), basicSalary: '', bonus: '0', deductions: '0', netSalary: '', paymentStatus: 'PENDING', paymentDate: '', paymentMethod: '', notes: '' });
    },
    onError: (err) => toast.error(err?.error || 'Failed to save record'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.userId || !form.basicSalary) { toast.error('Fill all required fields'); return; }
    addMutation.mutate({ ...form });
  };

  const downloadSlip = (id, name, month, year) => {
    window.open(`${import.meta.env.VITE_API_URL || ''}/api/finance/salary/${id}/slip`, '_blank');
  };

  const records = data?.data || [];
  const totalPayroll = data?.totalPayroll || 0;
  const users = usersData?.data || usersData || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage employee salaries and generate salary slips</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Salary Record
        </button>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-sm text-gray-500">Total Payroll</div>
            <div className="text-2xl font-bold text-gray-900">{fmt(totalPayroll)}</div>
            <div className="text-xs text-gray-400">{MONTHS[filterMonth - 1]} {filterYear}</div>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <div className="text-sm text-gray-500">Paid</div>
            <div className="text-2xl font-bold text-gray-900">
              {fmt(records.filter(r => r.paymentStatus === 'PAID').reduce((s, r) => s + r.netSalary, 0))}
            </div>
            <div className="text-xs text-gray-400">{records.filter(r => r.paymentStatus === 'PAID').length} employees</div>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <div className="text-sm text-gray-500">Pending</div>
            <div className="text-2xl font-bold text-gray-900">
              {fmt(records.filter(r => r.paymentStatus === 'PENDING').reduce((s, r) => s + r.netSalary, 0))}
            </div>
            <div className="text-xs text-gray-400">{records.filter(r => r.paymentStatus === 'PENDING').length} employees</div>
          </div>
        </div>
      </div>

      {/* Filter */}
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

      {/* Table */}
      {isLoading ? <LoadingState text="Loading salary records..." /> : (
        <div className="card p-0 overflow-hidden">
          {records.length === 0 ? (
            <EmptyState title="No salary records" description="Add salary records for this month." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Employee', 'Month/Year', 'Basic', 'Bonus', 'Deductions', 'Net Salary', 'Status', 'Method', 'Action'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {records.map(rec => (
                    <motion.tr key={rec.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{rec.user?.name}</div>
                        <div className="text-xs text-gray-400">{rec.user?.role?.replace('_', ' ')}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{MONTHS[rec.month - 1]} {rec.year}</td>
                      <td className="px-4 py-3 text-gray-700">{fmt(rec.basicSalary)}</td>
                      <td className="px-4 py-3 text-green-600">+{fmt(rec.bonus)}</td>
                      <td className="px-4 py-3 text-red-600">-{fmt(rec.deductions)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{fmt(rec.netSalary)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[rec.paymentStatus] || 'bg-gray-100 text-gray-700'}`}>
                          {rec.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{rec.paymentMethod || '—'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => downloadSlip(rec.id, rec.user?.name, rec.month, rec.year)}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          <Download className="w-3.5 h-3.5" /> Slip
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

      {/* Add Salary Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Salary Record" size="lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Employee *</label>
              <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} className="input" required>
                <option value="">Select employee</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role?.replace('_', ' ')})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Month *</label>
              <select value={form.month} onChange={e => setForm(f => ({ ...f, month: parseInt(e.target.value) }))} className="input">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Year *</label>
              <select value={form.year} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) }))} className="input">
                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Basic Salary (₹) *</label>
              <input type="number" min="0" value={form.basicSalary} onChange={e => setForm(f => ({ ...f, basicSalary: e.target.value }))} className="input" required />
            </div>
            <div>
              <label className="label">Bonus (₹)</label>
              <input type="number" min="0" value={form.bonus} onChange={e => setForm(f => ({ ...f, bonus: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Deductions (₹)</label>
              <input type="number" min="0" value={form.deductions} onChange={e => setForm(f => ({ ...f, deductions: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Net Salary (₹)</label>
              <input type="number" value={form.netSalary} readOnly className="input bg-gray-50 text-green-700 font-bold" />
            </div>
            <div>
              <label className="label">Payment Status</label>
              <select value={form.paymentStatus} onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value }))} className="input">
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            <div>
              <label className="label">Payment Date</label>
              <input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} className="input">
                <option value="">Select method</option>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input resize-none" rows={2} placeholder="Optional" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="btn-primary">
              {addMutation.isPending ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
