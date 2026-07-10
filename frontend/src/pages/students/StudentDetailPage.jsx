import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CreditCard, CheckCircle, GraduationCap, Bot, Loader2, Download, Award, Banknote, X, Trash2, Ban, RotateCcw } from 'lucide-react';
import api from '../../utils/api';
import { fmt, fmtDate, fmtDatetime } from '../../utils/constants';
import { LoadingState, StatusBadge, Modal, Input, Select, ConfirmDialog, BankAccountPicker, BankAccountBadge } from '../../components/ui/index';
import { useAuthStore } from '../../store/authStore';
import AssignBatchModal from '../../components/AssignBatchModal';
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

function PayInstallmentModal({ open, onClose, installment, enrollmentId }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ amount: installment?.amount || '', method: 'UPI', transactionId: '', bankAccount: 'CASH' });
  const [lastPayment, setLastPayment] = useState(null);

  const mutation = useMutation({
    mutationFn: (d) => api.post('/payments', { ...d, amount: Number(d.amount), enrollmentId, installmentId: installment?.id }).then(r => r.data),
    onSuccess: (data) => {
      toast.success('Payment recorded!');
      qc.invalidateQueries(['enrollment', enrollmentId]);
      setLastPayment(data);
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Payment failed'),
  });

  const OPTS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'EMI'].map(m => ({ value: m, label: m.replace('_', ' ') }));
  const handleClose = () => { setLastPayment(null); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title={`Pay Installment #${installment?.installmentNo}`} size="md">
      <div className="p-6 space-y-4">
        {lastPayment ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Payment Recorded!</h3>
              <p className="text-gray-500 text-sm">{lastPayment.receiptNumber}</p>
            </div>
            <button onClick={() => downloadReceipt(lastPayment.id, lastPayment.receiptNumber)} className="btn-primary mx-auto bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4" />Download Receipt PDF
            </button>
            <button onClick={handleClose} className="btn-secondary mx-auto">Close</button>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-sm text-blue-700">Due Amount: <span className="font-bold text-lg">{fmt(installment?.amount)}</span></div>
              <div className="text-xs text-blue-500 mt-0.5">Due Date: {fmtDate(installment?.dueDate)}</div>
            </div>
            <Input label="Amount (₹)" type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
            <Select label="Payment Method" value={form.method} onChange={v => setForm(p => ({ ...p, method: v }))} options={OPTS} />
            <Input label="Transaction / Ref ID" value={form.transactionId} onChange={e => setForm(p => ({ ...p, transactionId: e.target.value }))} placeholder="UPI ref / cheque no" />
            <BankAccountPicker value={form.bankAccount} onChange={v => setForm(p => ({ ...p, bankAccount: v }))} />
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn-gold" onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
                {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : <><CreditCard className="w-4 h-4" />Record Payment</>}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function PayFullModal({ open, onClose, enrollment }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState('UPI');
  const [transactionId, setTransactionId] = useState('');
  const [bankAccount, setBankAccount] = useState('CASH');
  const [done, setDone] = useState(null);

  const pendingCount = enrollment?.installments?.filter(i => i.status !== 'PAID').length || 0;
  const OPTS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD'].map(m => ({ value: m, label: m.replace('_', ' ') }));

  const mutation = useMutation({
    mutationFn: () => api.post('/payments/full-settlement', { enrollmentId: enrollment.id, method, transactionId, bankAccount }).then(r => r.data),
    onSuccess: (data) => {
      toast.success('Full settlement complete!');
      qc.invalidateQueries(['enrollment', enrollment.id]);
      setDone(data);
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Settlement failed'),
  });

  const handleClose = () => { setDone(null); setMethod('UPI'); setTransactionId(''); setBankAccount('CASH'); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title="Pay Full Settlement" size="md">
      <div className="p-6 space-y-4">
        {done ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Full Settlement Complete!</h3>
            <p className="text-gray-500 text-sm">All installments have been cleared. Receipt: {done.receiptNumber}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => downloadReceipt(done.id, done.receiptNumber)} className="btn-primary bg-green-600 hover:bg-green-700">
                <Download className="w-4 h-4" />Download Receipt
              </button>
              <button onClick={handleClose} className="btn-secondary">Close</button>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Remaining Balance</span>
                <span className="text-2xl font-bold text-amber-700">{fmt(enrollment?.balanceDue)}</span>
              </div>
              {pendingCount > 0 && (
                <p className="text-xs text-amber-600">This will clear {pendingCount} pending installment{pendingCount > 1 ? 's' : ''}</p>
              )}
            </div>
            <Select label="Payment Method" value={method} onChange={setMethod} options={OPTS} />
            <Input label="Transaction / Ref ID (optional)" value={transactionId} onChange={e => setTransactionId(e.target.value)} placeholder="UPI ref / cheque no / bank ref" />
            <BankAccountPicker value={bankAccount} onChange={setBankAccount} />
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
              ⚠️ This will mark all pending installments as PAID and update enrollment status to PAID.
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn-gold" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</> : <><Banknote className="w-4 h-4" />Settle Full Balance {fmt(enrollment?.balanceDue)}</>}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function RefundModal({ open, onClose, enrollment }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const initialForm = { amount: '', reason: '', bankAccount: 'CASH', date: today, markDropped: false };
  const [form, setForm] = useState(initialForm);
  const [done, setDone] = useState(null);

  const mutation = useMutation({
    mutationFn: () => api.post(`/enrollments/${enrollment.id}/refund`, form).then(r => r.data),
    onSuccess: (data) => {
      toast.success('Refund processed!');
      qc.invalidateQueries(['enrollment', enrollment.id]);
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      setDone(data);
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Refund failed'),
  });

  const handleClose = () => {
    if (mutation.isPending) return;
    setForm(initialForm);
    setDone(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Process Refund" size="md">
      <div className="p-6 space-y-4">
        {done ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Refund Processed</h3>
            <p className="text-gray-500 text-sm">{fmt(Number(form.amount))} refunded and logged as a Refund expense.</p>
            <button onClick={handleClose} className="btn-secondary mx-auto">Close</button>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700">
              Student has paid {fmt(enrollment?.paidAmount)} so far. This records money paid back to them and logs it as a
              Refund expense so it shows in your financial reports.
            </div>
            <Input label="Refund Amount (₹) *" type="number" min="0.01" max={enrollment?.paidAmount} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="500" />
            <Input label="Reason *" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Did not join after registration" />
            <Input label="Date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <BankAccountPicker label="Refunded From" value={form.bankAccount} onChange={v => setForm(f => ({ ...f, bankAccount: v }))} />
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.markDropped} onChange={e => setForm(f => ({ ...f, markDropped: e.target.checked }))} />
              Mark this student as withdrawn / dropped
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={handleClose}>Cancel</button>
              <button
                className="btn-primary bg-red-600 hover:bg-red-700"
                onClick={() => mutation.mutate()}
                disabled={!form.amount || !form.reason.trim() || Number(form.amount) > (enrollment?.paidAmount || 0) || mutation.isPending}
              >
                {mutation.isPending ? 'Processing...' : <><RotateCcw className="w-4 h-4" />Process Refund</>}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function CertificateSection({ enrollment }) {
  const [certResult, setCertResult] = useState(null);
  const [loading, setLoading] = useState('');

  const generate = async (type) => {
    setLoading(type);
    try {
      const { data } = await api.post('/certificates/generate', { enrollmentId: enrollment.id, type });
      setCertResult(data);
      toast.success(`${type === 'COMPLETION' ? 'Course Completion' : 'Internship'} Certificate generated!`);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Certificate generation failed');
    } finally {
      setLoading('');
    }
  };

  const downloadCert = async () => {
    try {
      const res = await api.get(`/certificates/${certResult.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certResult.certificateNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download certificate');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-lg">🎓 Course Complete! Generate Certificate</h3>
          <p className="text-green-100 text-sm">All fees paid — {enrollment.lead?.name} is eligible for certification</p>
        </div>
      </div>

      {certResult ? (
        <div className="bg-white/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-white" />
            <span className="font-semibold">Certificate Generated!</span>
          </div>
          <div className="text-sm text-green-100">Certificate No: <span className="font-bold text-white">{certResult.certificateNo}</span></div>
          <div className="flex gap-3">
            <button onClick={downloadCert}
              className="flex items-center gap-2 bg-white text-green-700 hover:bg-green-50 px-4 py-2 rounded-xl font-semibold text-sm transition-colors">
              <Download className="w-4 h-4" />Download Certificate
            </button>
            <button onClick={() => setCertResult(null)} className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl font-medium text-sm transition-colors">
              Generate Another
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => generate('COMPLETION')} disabled={!!loading}
            className="flex items-center gap-2 bg-white text-green-700 hover:bg-green-50 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-70">
            {loading === 'COMPLETION' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
            Generate Course Completion Certificate
          </button>
          <button onClick={() => generate('INTERNSHIP')} disabled={!!loading}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-70">
            {loading === 'INTERNSHIP' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
            Generate Internship Certificate
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function StudentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);
  const [payInst, setPayInst] = useState(null);
  const [showPayFull, setShowPayFull] = useState(false);
  const [tab, setTab] = useState('installments');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [showDeleteEnrollment, setShowDeleteEnrollment] = useState(false);
  const [forceDeleteWarning, setForceDeleteWarning] = useState(null);
  const [cancelPayment, setCancelPayment] = useState(null);
  const [showAssignBatch, setShowAssignBatch] = useState(false);
  const [showRefund, setShowRefund] = useState(false);

  const deleteEnrollmentMutation = useMutation({
    mutationFn: (force) => api.delete(`/enrollments/${id}${force ? '?confirm=true' : ''}`),
    onSuccess: () => { toast.success('Enrollment deleted'); navigate('/students'); },
    onError: (e, force) => {
      const data = e?.response?.data;
      setShowDeleteEnrollment(false);
      if (!force && data?.requiresConfirmation) {
        setForceDeleteWarning(data.error);
      } else {
        toast.error(data?.error || 'Delete failed');
        setForceDeleteWarning(null);
      }
    },
  });

  const cancelPaymentMutation = useMutation({
    mutationFn: ({ paymentId, reason }) => api.patch(`/payments/${paymentId}/cancel`, { reason }),
    onSuccess: () => { toast.success('Payment cancelled'); qc.invalidateQueries(['enrollment', id]); setCancelPayment(null); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Cancel failed'),
  });

  const { data: enrollment, isLoading } = useQuery({
    queryKey: ['enrollment', id],
    queryFn: () => api.get(`/enrollments/${id}`).then(r => r.data),
  });

  const getAIReminder = async () => {
    if (!enrollment) return;
    setLoadingAI(true);
    try {
      const { data } = await api.post(`/ai/suggest-reply/${enrollment.leadId}`, {
        context: `Student ${enrollment.lead?.name} has a balance due of ${fmt(enrollment.balanceDue)}. Please generate a polite payment reminder message.`,
      });
      setAiSuggestion(data.reply);
    } catch { toast.error('AI offline'); } finally { setLoadingAI(false); }
  };

  if (isLoading) return <LoadingState />;
  if (!enrollment) return <div className="text-center py-20 text-gray-500">Enrollment not found</div>;

  const dueInstallments = enrollment.installments?.filter(i => i.status !== 'PAID') || [];
  const paidPct = enrollment.netFee > 0 ? (enrollment.paidAmount / enrollment.netFee) * 100 : 0;
  const isFullyPaid = enrollment.balanceDue === 0 || enrollment.paymentStatus === 'PAID';

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 flex-shrink-0 mt-0.5"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <h1 className="page-title truncate">{enrollment.lead?.name}</h1>
          <p className="text-gray-500 text-sm">
            {enrollment.studentCode && <span className="font-mono font-semibold text-gray-700">{enrollment.studentCode}</span>}
            {enrollment.studentCode && ' • '}
            {enrollment.lead?.phone || 'No phone'} • {enrollment.receiptNo}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 flex-shrink-0">
          <div className="flex gap-1.5">
            <StatusBadge status={enrollment.status} />
            <StatusBadge status={enrollment.paymentStatus} />
          </div>
          {isAdmin && enrollment.paidAmount > 0 && (
            <button onClick={() => setShowRefund(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-xl transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />Refund
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowDeleteEnrollment(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors">
              <Trash2 className="w-3.5 h-3.5" />Delete
            </button>
          )}
        </div>
      </div>

      {/* Assign batch banner — shown when the student hasn't been scheduled to a batch yet */}
      {!enrollment.batchId && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">📚 Batch Not Assigned Yet</h3>
              <p className="text-gray-500 text-sm">Schedule {enrollment.lead?.name} into a batch</p>
            </div>
          </div>
          <button onClick={() => setShowAssignBatch(true)} className="btn-gold text-sm">
            <GraduationCap className="w-4 h-4" />Assign Batch
          </button>
        </motion.div>
      )}

      {/* Certificate banner — shown when fully paid */}
      <AnimatePresence>
        {isFullyPaid && <CertificateSection enrollment={enrollment} />}
      </AnimatePresence>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Course Fee', value: fmt(enrollment.courseFee), color: 'bg-gray-50 border-gray-200' },
          { label: 'Net After Discount', value: fmt(enrollment.netFee), color: 'bg-blue-50 border-blue-200' },
          { label: 'Total Paid', value: fmt(enrollment.paidAmount), color: 'bg-green-50 border-green-200' },
          { label: 'Balance Due', value: enrollment.balanceDue > 0 ? fmt(enrollment.balanceDue) : '✅ Paid', color: enrollment.balanceDue > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-2xl p-4 border ${color}`}>
            <div className="text-xs text-gray-500 font-medium">{label}</div>
            <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium text-gray-700">Payment Progress</span>
          <span className="text-primary-600 font-semibold">{paidPct.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <motion.div initial={{ width: 0 }} animate={{ width: `${paidPct}%` }} transition={{ duration: 1, ease: 'easeOut' }} className="h-3 rounded-full bg-gradient-to-r from-primary-500 to-green-500" />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1.5">
          <span>{fmt(enrollment.paidAmount)} paid</span>
          <span>{fmt(enrollment.netFee)} total</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="border-b border-gray-100">
              <div className="flex">
                {[['installments', 'Installments'], ['payments', 'Payment History'], ['info', 'Course Info']].map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === k ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>
                ))}
              </div>
            </div>

            {tab === 'installments' && (
              <div className="p-4 space-y-2">
                {enrollment.installments?.map(inst => (
                  <div key={inst.id} className={`flex items-center gap-4 p-4 rounded-xl border ${inst.status === 'PAID' ? 'bg-green-50 border-green-200' : inst.status === 'OVERDUE' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${inst.status === 'PAID' ? 'bg-green-500 text-white' : inst.status === 'OVERDUE' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {inst.status === 'PAID' ? '✓' : inst.installmentNo}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">Installment #{inst.installmentNo}</span>
                        <StatusBadge status={inst.status} />
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {inst.status === 'PAID' ? `Paid on ${fmtDate(inst.paidAt)}` : `Due: ${fmtDate(inst.dueDate)}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-gray-900">{fmt(inst.amount)}</div>
                      {inst.status !== 'PAID' && (
                        <button onClick={() => setPayInst(inst)} className="btn-gold text-xs mt-1 py-1">Pay Now</button>
                      )}
                    </div>
                  </div>
                ))}
                {!enrollment.installments?.length && <div className="text-center py-8 text-gray-400 text-sm">No installment plan created</div>}
              </div>
            )}

            {tab === 'payments' && (
              <div className="p-4 space-y-2">
                {enrollment.payments?.map(p => (
                  <div key={p.id} className={`flex items-center gap-4 p-3 rounded-xl border ${p.isCancelled ? 'border-red-100 bg-red-50 opacity-70' : 'border-gray-100 bg-gray-50'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${p.isCancelled ? 'bg-red-100' : 'bg-green-100'}`}>
                      {p.isCancelled ? <Ban className="w-4 h-4 text-red-500" /> : <CheckCircle className="w-4 h-4 text-green-600" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 flex-wrap">{p.receiptNumber} <BankAccountBadge bankAccount={p.bankAccount} /> {p.isCancelled && <span className="text-xs text-red-500 font-normal ml-1">CANCELLED</span>}</div>
                      <div className="text-xs text-gray-500">{p.method.replace('_', ' ')} {p.transactionId ? `• Ref: ${p.transactionId}` : ''} • {p.collectedBy?.name}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${p.isCancelled ? 'text-red-400 line-through' : 'text-green-700'}`}>{fmt(p.amount)}</div>
                      <div className="text-xs text-gray-400">{fmtDate(p.paidAt)}</div>
                    </div>
                    {!p.isCancelled && (
                      <button onClick={() => downloadReceipt(p.id, p.receiptNumber)} className="btn-secondary text-xs py-1.5 px-2 flex-shrink-0">
                        <Download className="w-3 h-3" />
                      </button>
                    )}
                    {isAdmin && !p.isCancelled && (
                      <button onClick={() => setCancelPayment(p)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0" title="Cancel payment">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {!enrollment.payments?.length && <div className="text-center py-8 text-gray-400 text-sm">No payments recorded yet</div>}
              </div>
            )}

            {tab === 'info' && (
              <div className="p-4 grid grid-cols-2 gap-4">
                {[
                  ['Student No.', enrollment.studentCode || '—'],
                  ['Course', enrollment.course?.name],
                  ['Batch', enrollment.batch?.batchName || '—'],
                  ['Mode', enrollment.batch?.mode || '—'],
                  ['Start Date', fmtDate(enrollment.batch?.startDate)],
                  ['Faculty', enrollment.batch?.facultyName || '—'],
                  ['Timings', enrollment.batch?.timings || '—'],
                  ['Enrolled On', fmtDate(enrollment.enrolledAt)],
                  ['Receipt No', enrollment.receiptNo],
                  ['Discount', enrollment.discountAmount > 0 ? `${fmt(enrollment.discountAmount)} — ${enrollment.discountReason}` : 'None'],
                  ['Scholarship', enrollment.scholarshipName ? `${enrollment.scholarshipName} (${enrollment.scholarshipPct}%)` : 'None'],
                ].map(([l, v]) => (
                  <div key={l}>
                    <div className="text-xs text-gray-400 font-medium">{l}</div>
                    <div className="text-sm text-gray-800 font-medium mt-0.5 flex items-center gap-2">
                      {v || '—'}
                      {l === 'Batch' && (
                        <button onClick={() => setShowAssignBatch(true)} className="text-xs text-primary-600 hover:underline font-medium">
                          {enrollment.batchId ? 'Change' : 'Assign'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Full Settlement Card — shown when balance > 0 */}
          {!isFullyPaid && enrollment.balanceDue > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-5 border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Banknote className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">💰 Pay Full Settlement</h3>
                    <p className="text-gray-500 text-sm">Clear all remaining balance in one payment</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500 font-medium">Remaining Balance</div>
                  <div className="text-3xl font-bold text-amber-700 mt-0.5">{fmt(enrollment.balanceDue)}</div>
                  {dueInstallments.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">{dueInstallments.length} pending installment{dueInstallments.length > 1 ? 's' : ''}</div>
                  )}
                </div>
                <button onClick={() => setShowPayFull(true)} className="btn-gold text-sm px-6 py-3">
                  <Banknote className="w-4 h-4" />Pay Full Balance Now
                </button>
              </div>
            </motion.div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center"><Bot className="w-4 h-4 text-purple-600" /></div>
              <span className="text-sm font-semibold text-gray-900">AI Reminder Agent</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-purple-50 rounded-xl p-3 text-xs text-purple-700">
                Balance Due: <span className="font-bold">{fmt(enrollment.balanceDue)}</span>
                {dueInstallments.length > 0 && (
                  <div className="mt-1">
                    Next: Installment #{dueInstallments[0]?.installmentNo} — {fmt(dueInstallments[0]?.amount)} on {fmtDate(dueInstallments[0]?.dueDate)}
                  </div>
                )}
              </div>
              <button onClick={getAIReminder} disabled={loadingAI} className="w-full btn-secondary text-sm justify-center">
                {loadingAI ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Bot className="w-4 h-4" />Generate AI Reminder</>}
              </button>
              {aiSuggestion && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <div className="text-xs font-semibold text-green-700 mb-1">AI Draft:</div>
                  <div className="text-xs text-gray-700 whitespace-pre-line">{aiSuggestion}</div>
                  <p className="text-xs text-gray-400 mt-2">Copy this message and send via WhatsApp manually.</p>
                </div>
              )}
            </div>
          </div>

          <div className="card p-4 space-y-2">
            <div className="text-sm font-semibold text-gray-700 mb-2">Quick Actions</div>
            {!isFullyPaid ? (
              <>
                <button onClick={() => dueInstallments.length && setPayInst(dueInstallments[0])} disabled={!dueInstallments.length} className="w-full btn-gold text-sm justify-center disabled:opacity-40">
                  <CreditCard className="w-4 h-4" />Pay Next Installment
                </button>
                <button onClick={() => setShowPayFull(true)} className="w-full btn-secondary text-sm justify-center border-amber-300 text-amber-700 hover:bg-amber-50">
                  <Banknote className="w-4 h-4" />Pay Full Balance
                </button>
              </>
            ) : (
              <div className="text-center py-2 text-sm text-green-600 font-medium">✅ Fully Paid</div>
            )}
            {enrollment.payments?.[0] && (
              <button onClick={() => downloadReceipt(enrollment.payments[0].id, enrollment.payments[0].receiptNumber)} className="w-full btn-secondary text-sm justify-center">
                <Download className="w-4 h-4" />Download Last Receipt
              </button>
            )}
          </div>
        </div>
      </div>

      {payInst && (
        <PayInstallmentModal open={!!payInst} onClose={() => setPayInst(null)} installment={payInst} enrollmentId={enrollment.id} />
      )}
      {showPayFull && (
        <PayFullModal open={showPayFull} onClose={() => setShowPayFull(false)} enrollment={enrollment} />
      )}
      {showRefund && (
        <RefundModal open={showRefund} onClose={() => setShowRefund(false)} enrollment={enrollment} />
      )}
      <ConfirmDialog
        open={showDeleteEnrollment}
        onClose={() => setShowDeleteEnrollment(false)}
        onConfirm={() => deleteEnrollmentMutation.mutate(false)}
        loading={deleteEnrollmentMutation.isPending}
        danger
        title={`Delete enrollment — ${enrollment.lead?.name}?`}
        message={`This will remove the enrollment record and reset the lead status to QUALIFIED.\n\nThis cannot be undone.`}
        confirmLabel="Delete Enrollment"
      />
      <ConfirmDialog
        open={!!forceDeleteWarning}
        onClose={() => setForceDeleteWarning(null)}
        onConfirm={() => deleteEnrollmentMutation.mutate(true)}
        loading={deleteEnrollmentMutation.isPending}
        danger
        title={`Delete anyway — ${enrollment.lead?.name}?`}
        message={`${forceDeleteWarning}\n\nThis cannot be undone.`}
        confirmLabel="Delete Everything"
      />
      <ConfirmDialog
        open={!!cancelPayment}
        onClose={() => setCancelPayment(null)}
        onConfirm={() => cancelPaymentMutation.mutate({ paymentId: cancelPayment?.id, reason: 'Cancelled by admin' })}
        loading={cancelPaymentMutation.isPending}
        danger
        title={`Cancel payment — ${cancelPayment?.receiptNumber}?`}
        message={`Amount: ${fmt(cancelPayment?.amount)}\n\nThis will mark the payment as cancelled and reverse the student's balance. The payment record will be kept for audit purposes.`}
        confirmLabel="Cancel Payment"
      />
      <AssignBatchModal open={showAssignBatch} onClose={() => setShowAssignBatch(false)} enrollment={enrollment} />
    </div>
  );
}
