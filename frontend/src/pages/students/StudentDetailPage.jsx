import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, CreditCard, CheckCircle, GraduationCap, Bot, Loader2, Download } from 'lucide-react';
import api from '../../utils/api';
import { fmt, fmtDate, fmtDatetime } from '../../utils/constants';
import { LoadingState, StatusBadge, Modal, Input, Select } from '../../components/ui/index';
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
  const [form, setForm] = useState({ amount: installment?.amount || '', method: 'UPI', transactionId: '' });
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

export default function StudentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [payInst, setPayInst] = useState(null);
  const [tab, setTab] = useState('installments');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);

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

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="page-title">{enrollment.lead?.name}</h1>
          <p className="text-gray-500 text-sm">{enrollment.lead?.phone} • {enrollment.receiptNo}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <StatusBadge status={enrollment.status} />
          <StatusBadge status={enrollment.paymentStatus} />
        </div>
      </div>

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
        <div className="lg:col-span-2 card">
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
                <div key={p.id} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center"><CheckCircle className="w-4 h-4 text-green-600" /></div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">{p.receiptNumber}</div>
                    <div className="text-xs text-gray-500">{p.method.replace('_', ' ')} {p.transactionId ? `• Ref: ${p.transactionId}` : ''} • {p.collectedBy?.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-700">{fmt(p.amount)}</div>
                    <div className="text-xs text-gray-400">{fmtDate(p.paidAt)}</div>
                  </div>
                  <button onClick={() => downloadReceipt(p.id, p.receiptNumber)} className="btn-secondary text-xs py-1.5 px-2 flex-shrink-0">
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {!enrollment.payments?.length && <div className="text-center py-8 text-gray-400 text-sm">No payments recorded yet</div>}
            </div>
          )}

          {tab === 'info' && (
            <div className="p-4 grid grid-cols-2 gap-4">
              {[
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
                  <div className="text-sm text-gray-800 font-medium mt-0.5">{v || '—'}</div>
                </div>
              ))}
            </div>
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
            <button onClick={() => dueInstallments.length && setPayInst(dueInstallments[0])} disabled={!dueInstallments.length} className="w-full btn-gold text-sm justify-center disabled:opacity-40">
              <CreditCard className="w-4 h-4" />Pay Next Installment
            </button>
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
    </div>
  );
}
