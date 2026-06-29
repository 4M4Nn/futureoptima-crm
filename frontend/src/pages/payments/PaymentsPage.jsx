import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, CheckCircle, RefreshCw, Download, X } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../utils/api';
import { fmt, fmtDatetime, PAYMENT_METHODS } from '../../utils/constants';
import { StatCard, LoadingState, EmptyState, Pagination, Modal, Input, Select, StatusBadge, ConfirmDialog } from '../../components/ui/index';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

async function downloadReceipt(paymentId, receiptNumber) {
  try {
    const response = await api.get(`/payments/${paymentId}/receipt`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${receiptNumber || paymentId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch {
    toast.error('Receipt download failed');
  }
}

function AddPaymentModal({ open, onClose }) {
  const qc = useQueryClient();
  const BANK_ACCOUNTS = [{ value: 'HDFC', label: 'HDFC Bank' }, { value: 'ICICI', label: 'ICICI Bank' }, { value: 'IDFC', label: 'IDFC Bank' }, { value: 'CASH', label: 'Cash' }];
  const [form, setForm] = useState({ enrollmentId: '', amount: '', method: 'UPI', transactionId: '', remarks: '', installmentId: '', bankAccount: 'CASH' });
  const [searchPhone, setSearchPhone] = useState('');
  const [enrollment, setEnrollment] = useState(null);
  const [searching, setSearching] = useState(false);
  const [lastPayment, setLastPayment] = useState(null);

  const searchEnrollment = async () => {
    if (!searchPhone.trim()) return;
    setSearching(true);
    setEnrollment(null);
    setLastPayment(null);
    try {
      const { data: leadData } = await api.get(`/leads?search=${searchPhone.trim()}&limit=1`);
      const lead = leadData.data?.[0];
      if (!lead) { toast.error('No student found with this phone number'); return; }
      const { data: enrList } = await api.get(`/enrollments?leadId=${lead.id}&limit=1`);
      const enrSummary = enrList.data?.[0];
      if (!enrSummary) { toast.error(`${lead.name} has no enrollment yet`); return; }
      const { data: enr } = await api.get(`/enrollments/${enrSummary.id}`);
      setEnrollment(enr);
      setForm(p => ({ ...p, enrollmentId: enr.id, amount: '', installmentId: '' }));
    } catch { toast.error('Search failed'); } finally { setSearching(false); }
  };

  const mutation = useMutation({
    mutationFn: (d) => api.post('/payments', { ...d, amount: Number(d.amount) }).then(r => r.data),
    onSuccess: (data) => {
      toast.success('Payment recorded successfully!');
      qc.invalidateQueries(['payments']);
      qc.invalidateQueries(['payment-stats']);
      qc.invalidateQueries(['enrollments']);
      setLastPayment(data);
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Payment failed'),
  });

  const handleClose = () => {
    setEnrollment(null);
    setSearchPhone('');
    setLastPayment(null);
    setForm({ enrollmentId: '', amount: '', method: 'UPI', transactionId: '', remarks: '', installmentId: '', bankAccount: 'CASH' });
    onClose();
  };

  const METHOD_OPTS = PAYMENT_METHODS.map(m => ({ value: m, label: m.replace(/_/g, ' ') }));
  const dueInstallments = enrollment?.installments?.filter(i => i.status !== 'PAID') || [];

  return (
    <Modal open={open} onClose={handleClose} title="Record Payment" size="lg">
      <div className="p-6 space-y-4">
        {lastPayment ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Payment Recorded!</h3>
              <p className="text-gray-500 text-sm">Receipt No: {lastPayment.receiptNumber}</p>
            </div>
            <button
              onClick={() => downloadReceipt(lastPayment.id, lastPayment.receiptNumber)}
              className="btn-primary mx-auto bg-green-600 hover:bg-green-700"
            >
              <Download className="w-4 h-4" />Download Receipt PDF
            </button>
            <button onClick={handleClose} className="btn-secondary mx-auto">Close</button>
          </div>
        ) : (
          <>
            <div>
              <label className="label">Search Student by Phone</label>
              <div className="flex gap-2">
                <input className="input flex-1" value={searchPhone} onChange={e => setSearchPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchEnrollment()} placeholder="9876543210" />
                <button onClick={searchEnrollment} disabled={searching} className="btn-secondary">{searching ? 'Searching...' : 'Search'}</button>
              </div>
            </div>

            {enrollment && (
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <div className="font-semibold text-green-800">{enrollment.lead?.name}</div>
                <div className="text-sm text-green-700">{enrollment.course?.name}</div>
                <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                  <div><div className="text-xs text-gray-500">Total Fee</div><div className="font-semibold">{fmt(enrollment.netFee)}</div></div>
                  <div><div className="text-xs text-gray-500">Paid</div><div className="font-semibold text-green-600">{fmt(enrollment.paidAmount)}</div></div>
                  <div><div className="text-xs text-gray-500">Balance</div><div className={`font-semibold ${enrollment.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(enrollment.balanceDue)}</div></div>
                </div>
                {dueInstallments.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-1">Select Installment to Pay:</div>
                    <div className="space-y-1">
                      {dueInstallments.slice(0, 4).map(inst => (
                        <div key={inst.id} className={`flex justify-between items-center rounded-lg p-2 cursor-pointer border transition-colors ${form.installmentId === inst.id ? 'bg-primary-50 border-primary-300' : 'bg-white border-gray-200 hover:border-primary-200'}`} onClick={() => setForm(p => ({ ...p, installmentId: inst.id, amount: String(inst.amount) }))}>
                          <span className="text-xs">Installment #{inst.installmentNo}</span>
                          <span className="text-xs font-semibold text-primary-700">{fmt(inst.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Amount (₹) *" type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="15000" />
              <Select label="Payment Method *" value={form.method} onChange={v => setForm(p => ({ ...p, method: v }))} options={METHOD_OPTS} />
              <Input label="Transaction / Ref ID" value={form.transactionId} onChange={e => setForm(p => ({ ...p, transactionId: e.target.value }))} placeholder="UPI ref / cheque no" />
              <Input label="Remarks" value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <label className="label">Received Into (Account) *</label>
              <select className="input" value={form.bankAccount} onChange={e => setForm(p => ({ ...p, bankAccount: e.target.value }))}>
                {BANK_ACCOUNTS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn-primary" onClick={() => mutation.mutate(form)} disabled={!form.enrollmentId || !form.amount || mutation.isPending}>
                {mutation.isPending ? 'Recording...' : <><CreditCard className="w-4 h-4" />Record Payment</>}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [cancelPayment, setCancelPayment] = useState(null);
  const { user } = useAuthStore();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);
  const qc = useQueryClient();

  const { data: stats } = useQuery({ queryKey: ['payment-stats'], queryFn: () => api.get('/payments/stats').then(r => r.data) });
  const { data, isLoading } = useQuery({ queryKey: ['payments', page], queryFn: () => api.get(`/payments?page=${page}&limit=25`).then(r => r.data) });

  const cancelPaymentMutation = useMutation({
    mutationFn: (id) => api.patch(`/payments/${id}/cancel`, { reason: 'Cancelled by admin' }),
    onSuccess: () => { toast.success('Payment cancelled'); qc.invalidateQueries(['payments']); qc.invalidateQueries(['payment-stats']); setCancelPayment(null); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Cancel failed'),
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Payments & Fees</h1>
          <p className="text-gray-500 text-sm">PDF receipts auto-generated on every payment</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex-shrink-0"><Plus className="w-4 h-4" />Record Payment</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CreditCard} label="Collected Today" value={fmt(stats?.todayCollected)} color="green" />
        <StatCard icon={CreditCard} label="This Month" value={fmt(stats?.monthCollected)} color="blue" />
        <StatCard icon={CheckCircle} label="Total Collected" value={fmt(stats?.totalCollected)} color="nexora" />
        <StatCard icon={RefreshCw} label="Overdue EMIs" value={stats?.overdueInstallments || 0} color="red" sub="Need follow-up" />
      </div>

      {stats?.methodBreakdown && (
        <div className="card p-4">
          <h3 className="section-title mb-3">Collection by Method</h3>
          <div className="flex flex-wrap gap-3">
            {stats.methodBreakdown.map(m => (
              <div key={m.method} className="bg-gray-50 rounded-xl px-4 py-2.5 text-center">
                <div className="text-sm font-bold text-gray-900">{fmt(m._sum.amount)}</div>
                <div className="text-xs text-gray-500">{m.method.replace('_', ' ')} ({m._count.id})</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Receipt No', 'Student', 'Course', 'Amount', 'Method', 'Date', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7}><LoadingState /></td></tr>
              ) : !data?.data?.length ? (
                <tr><td colSpan={7}><EmptyState title="No payments yet" description="Record your first payment" action={<button onClick={() => setShowAdd(true)} className="btn-primary mx-auto">Record Payment</button>} /></td></tr>
              ) : data.data.map((p, i) => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className={`table-row ${p.isCancelled ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 text-xs font-mono text-gray-700">
                    {p.receiptNumber}
                    {p.isCancelled && <span className="ml-1 text-red-500 text-xs">(cancelled)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{p.enrollment?.lead?.name}</div>
                    <div className="text-xs text-gray-400">{p.enrollment?.lead?.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{p.enrollment?.course?.shortName}</td>
                  <td className={`px-4 py-3 text-sm font-bold ${p.isCancelled ? 'text-red-400 line-through' : 'text-green-700'}`}>{fmt(p.amount)}</td>
                  <td className="px-4 py-3"><span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{p.method.replace('_', ' ')}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDatetime(p.paidAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!p.isCancelled && (
                        <button onClick={() => downloadReceipt(p.id, p.receiptNumber)} className="text-xs text-green-600 hover:underline flex items-center gap-1">
                          <Download className="w-3 h-3" />Receipt
                        </button>
                      )}
                      {isAdmin && !p.isCancelled && (
                        <button onClick={() => setCancelPayment(p)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Cancel payment">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.pagination && <div className="px-4 pb-4"><Pagination page={data.pagination.page} pages={data.pagination.pages} total={data.pagination.total} onPage={setPage} /></div>}
      </div>

      <AddPaymentModal open={showAdd} onClose={() => setShowAdd(false)} />
      <ConfirmDialog
        open={!!cancelPayment}
        onClose={() => setCancelPayment(null)}
        onConfirm={() => cancelPaymentMutation.mutate(cancelPayment?.id)}
        loading={cancelPaymentMutation.isPending}
        danger
        title={`Cancel payment — ${cancelPayment?.receiptNumber}?`}
        message={`Amount: ${fmt(cancelPayment?.amount)}\nStudent: ${cancelPayment?.enrollment?.lead?.name}\n\nThe payment record will be kept for audit purposes. The student's balance will be reversed.`}
        confirmLabel="Cancel Payment"
      />
    </div>
  );
}
