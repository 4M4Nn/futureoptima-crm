import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, CheckCircle, RefreshCw, Download, X, Users, Upload, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../utils/api';
import { fmt, fmtDate, fmtDatetime, PAYMENT_METHODS } from '../../utils/constants';
import { StatCard, LoadingState, EmptyState, Pagination, Modal, Input, Select, StatusBadge, ConfirmDialog, BankAccountPicker, BankAccountBadge } from '../../components/ui/index';
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
            <BankAccountPicker value={form.bankAccount} onChange={v => setForm(p => ({ ...p, bankAccount: v }))} />

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

const initialGroupForm = {
  courseId: '', search: '',
  coordinatorName: '', groupName: '', totalAmount: '', method: 'CASH', bankAccount: 'CASH',
  transactionId: '', paidAt: new Date().toISOString().slice(0, 10), remarks: '',
  isAllocated: true,
};

function GroupPaymentModal({ open, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(initialGroupForm);
  const [selected, setSelected] = useState({}); // enrollmentId -> { name, phone, balanceDue, amount }
  const [lastResult, setLastResult] = useState(null);

  const { data: coursesData } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.get('/courses').then(r => r.data),
    enabled: open,
  });
  const courses = coursesData || [];

  const { data: enrollData, isFetching: searching } = useQuery({
    queryKey: ['group-payment-candidates', form.courseId, form.search],
    queryFn: () => api.get(`/enrollments?courseId=${form.courseId}&search=${encodeURIComponent(form.search)}&limit=100`).then(r => r.data),
    enabled: open && !!form.courseId,
  });
  const candidates = (enrollData?.data || []).filter(e => e.balanceDue > 0);

  const toggleStudent = (enr) => {
    setSelected(p => {
      const next = { ...p };
      if (next[enr.id]) { delete next[enr.id]; }
      else next[enr.id] = { name: enr.lead?.name, phone: enr.lead?.phone, balanceDue: enr.balanceDue, amount: '' };
      return next;
    });
  };
  const setAmount = (id, v) => setSelected(p => ({ ...p, [id]: { ...p[id], amount: v.replace(/[^\d.]/g, '') } }));

  const selectedIds = Object.keys(selected);
  const allocatedSum = selectedIds.reduce((s, id) => s + (Number(selected[id].amount) || 0), 0);
  const total = Number(form.totalAmount) || 0;
  const amountsMatch = !form.isAllocated || (selectedIds.length > 0 && Math.abs(allocatedSum - total) < 1);

  const canSubmit = form.coordinatorName.trim() && total > 0 && selectedIds.length > 0
    && (!form.isAllocated || (amountsMatch && selectedIds.every(id => Number(selected[id].amount) > 0)));

  const handleClose = () => {
    if (mutation.isPending) return;
    setForm(initialGroupForm);
    setSelected({});
    setLastResult(null);
    onClose();
  };

  const mutation = useMutation({
    mutationFn: () => api.post('/payments/group', {
      coordinatorName: form.coordinatorName.trim(),
      groupName: form.groupName.trim() || undefined,
      totalAmount: total,
      method: form.method,
      bankAccount: form.bankAccount,
      transactionId: form.transactionId || undefined,
      paidAt: form.paidAt,
      remarks: form.remarks || undefined,
      isAllocated: form.isAllocated,
      allocations: selectedIds.map(id => ({ enrollmentId: id, amount: form.isAllocated ? Number(selected[id].amount) : undefined })),
    }).then(r => r.data),
    onSuccess: (data) => {
      toast.success('Group payment recorded!');
      qc.invalidateQueries(['group-payments']);
      qc.invalidateQueries(['payments']);
      qc.invalidateQueries(['payment-stats']);
      qc.invalidateQueries(['enrollments']);
      setLastResult(data);
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Failed to record group payment'),
  });

  const METHOD_OPTS = PAYMENT_METHODS.map(m => ({ value: m, label: m.replace(/_/g, ' ') }));
  const courseOpts = courses.map(c => ({ value: c.id, label: c.name }));

  return (
    <Modal open={open} onClose={handleClose} title="Record Group Payment" size="lg">
      <div className="p-6 space-y-4">
        {lastResult ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Group Payment Recorded!</h3>
              <p className="text-gray-500 text-sm">Receipt No: {lastResult.receiptNumber} · {lastResult.studentsCount} student(s)</p>
            </div>
            <button onClick={handleClose} className="btn-secondary mx-auto">Close</button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3">
              Use this when one coordinator pays a lump sum covering several students at once (e.g. an internship batch from a college).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Coordinator Name *" value={form.coordinatorName} onChange={e => setForm(p => ({ ...p, coordinatorName: e.target.value }))} placeholder="e.g. Prof. Rajan" />
              <Input label="College / Group Name" value={form.groupName} onChange={e => setForm(p => ({ ...p, groupName: e.target.value }))} placeholder="e.g. XYZ Engineering College" />
              <Input label="Total Amount Received (₹) *" type="number" value={form.totalAmount} onChange={e => setForm(p => ({ ...p, totalAmount: e.target.value }))} placeholder="150000" />
              <Select label="Payment Method *" value={form.method} onChange={v => setForm(p => ({ ...p, method: v }))} options={METHOD_OPTS} />
              <Input label="Transaction / Ref ID" value={form.transactionId} onChange={e => setForm(p => ({ ...p, transactionId: e.target.value }))} placeholder="UPI ref / cheque no" />
              <Input label="Date" type="date" value={form.paidAt} onChange={e => setForm(p => ({ ...p, paidAt: e.target.value }))} />
            </div>
            <BankAccountPicker value={form.bankAccount} onChange={v => setForm(p => ({ ...p, bankAccount: v }))} />
            <Input label="Remarks" value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Optional" />

            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 border border-gray-200">
              <input type="checkbox" id="isAllocated" checked={form.isAllocated} onChange={e => setForm(p => ({ ...p, isAllocated: e.target.checked }))} className="w-4 h-4" />
              <label htmlFor="isAllocated" className="text-sm text-gray-700 cursor-pointer">
                I know each student's exact share <span className="text-gray-400">(uncheck if you only know the total — students will be marked as covered without updating their individual balance)</span>
              </label>
            </div>

            <div>
              <label className="label">Select Students</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                <Select value={form.courseId} onChange={v => setForm(p => ({ ...p, courseId: v }))} options={courseOpts} placeholder="Select course..." />
                <input className="input" value={form.search} onChange={e => setForm(p => ({ ...p, search: e.target.value }))} placeholder="Search by name or phone..." disabled={!form.courseId} />
              </div>
              {!form.courseId ? (
                <p className="text-xs text-gray-400 py-4 text-center">Select a course to list students with a balance due.</p>
              ) : searching ? (
                <p className="text-xs text-gray-400 py-4 text-center">Loading students...</p>
              ) : !candidates.length ? (
                <p className="text-xs text-gray-400 py-4 text-center">No students with a pending balance found.</p>
              ) : (
                <div className="border border-gray-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-gray-100">
                  {candidates.map(enr => {
                    const isSel = !!selected[enr.id];
                    return (
                      <div key={enr.id} className={`flex items-center gap-3 p-2.5 ${isSel ? 'bg-primary-50' : ''}`}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleStudent(enr)} className="w-4 h-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleStudent(enr)}>
                          <div className="text-sm font-medium text-gray-900 truncate">{enr.lead?.name}</div>
                          <div className="text-xs text-gray-400">{enr.lead?.phone || 'No phone'} · Balance {fmt(enr.balanceDue)}</div>
                        </div>
                        {isSel && form.isAllocated && (
                          <input
                            className="input w-28 text-sm flex-shrink-0"
                            value={selected[enr.id].amount}
                            onChange={e => setAmount(enr.id, e.target.value)}
                            placeholder="Amount"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedIds.length > 0 && (
              <div className={`rounded-xl p-3 text-sm border ${form.isAllocated && !amountsMatch ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                {selectedIds.length} student(s) selected
                {form.isAllocated && <> · Allocated {fmt(allocatedSum)} of {fmt(total)} total{!amountsMatch && ' — amounts must add up to the total'}</>}
                {!form.isAllocated && <> · Amount recorded as one lump sum ({fmt(total)}), not split per student</>}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn-primary" onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
                {mutation.isPending ? 'Recording...' : <><Users className="w-4 h-4" />Record Group Payment</>}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function GroupPaymentsSection() {
  const [page, setPage] = useState(1);
  const [viewId, setViewId] = useState(null);
  const { data, isLoading } = useQuery({ queryKey: ['group-payments', page], queryFn: () => api.get(`/payments/group?page=${page}&limit=10`).then(r => r.data) });
  const { data: detail } = useQuery({
    queryKey: ['group-payment', viewId],
    queryFn: () => api.get(`/payments/group/${viewId}`).then(r => r.data),
    enabled: !!viewId,
  });

  if (!isLoading && !data?.data?.length) return null;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="section-title">Group Payments</h3>
        <p className="text-xs text-gray-400">Lump-sum collections from coordinators covering multiple students</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Coordinator', 'Group', 'Amount', 'Students', 'Split', 'Date', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left table-header">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7}><LoadingState /></td></tr>
            ) : data.data.map(g => (
              <tr key={g.id} className="table-row">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{g.coordinatorName}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{g.groupName || '—'}</td>
                <td className="px-4 py-3 text-sm font-bold text-green-700">{fmt(g.totalAmount)}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{g._count?.students ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${g.isAllocated ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {g.isAllocated ? 'Per-student' : 'Unallocated'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(g.paidAt)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => setViewId(g.id)} className="text-xs text-primary-600 hover:underline">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.pagination && <div className="px-4 pb-4"><Pagination page={data.pagination.page} pages={data.pagination.pages} total={data.pagination.total} onPage={setPage} /></div>}

      <Modal open={!!viewId} onClose={() => setViewId(null)} title="Group Payment Details" size="lg">
        {detail && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-gray-400">Coordinator</div><div className="font-medium">{detail.coordinatorName}</div></div>
              <div><div className="text-xs text-gray-400">College / Group</div><div className="font-medium">{detail.groupName || '—'}</div></div>
              <div><div className="text-xs text-gray-400">Total Amount</div><div className="font-medium">{fmt(detail.totalAmount)}</div></div>
              <div><div className="text-xs text-gray-400">Collected By</div><div className="font-medium">{detail.collectedBy?.name}</div></div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Covered Students ({detail.students.length})</div>
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {detail.students.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 text-sm">
                    <div>
                      <div className="font-medium text-gray-900">{s.enrollment?.lead?.name}</div>
                      <div className="text-xs text-gray-400">{s.enrollment?.lead?.phone || 'No phone'} · {s.enrollment?.course?.shortName}</div>
                    </div>
                    <div className="text-sm font-semibold">{s.allocatedAmount != null ? fmt(s.allocatedAmount) : <span className="text-amber-600 text-xs">Unallocated</span>}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ImportPaymentsModal({ open, onClose }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);

  const previewMutation = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post('/payments/import/preview', fd).then(r => r.data);
    },
    onSuccess: (data) => { setRows(data.rows); setSummary(data); },
    onError: (e) => toast.error(e?.response?.data?.error || e?.error || 'Failed to read file'),
  });

  const commitMutation = useMutation({
    mutationFn: () => api.post('/payments/import/commit', { rows }).then(r => r.data),
    onSuccess: (data) => {
      toast.success(`Imported ${data.created} payment(s)${data.skipped ? `, skipped ${data.skipped}` : ''}!`);
      qc.invalidateQueries(['payments']);
      qc.invalidateQueries(['payment-stats']);
      qc.invalidateQueries(['enrollments']);
      handleClose();
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.error || 'Import failed'),
  });

  const handleClose = () => {
    if (previewMutation.isPending || commitMutation.isPending) return;
    setRows(null);
    setSummary(null);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  const includedCount = rows?.filter(r => r.include).length || 0;

  return (
    <Modal open={open} onClose={handleClose} title="Import Payments from Excel" size="xl">
      <div className="p-6 space-y-4">
        {!rows ? (
          <>
            <p className="text-sm text-gray-500">
              Upload a spreadsheet of historical student payments (Name/Phone, Amount, Date). Only rows that match an
              existing student's enrollment can be imported — add the student first if they're not in the system yet.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={e => e.target.files[0] && previewMutation.mutate(e.target.files[0])}
              className="input"
              disabled={previewMutation.isPending}
            />
            {previewMutation.isPending && <p className="text-sm text-primary-600">Reading and matching rows...</p>}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm bg-blue-50 border border-blue-100 rounded-lg p-3">
              <span>{summary.total} row(s) found — {summary.matchedCount} matched to existing students{summary.skipped > 0 && `, ${summary.skipped} skipped (missing date/amount)`}</span>
              <button onClick={() => { setRows(null); setSummary(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-primary-600 hover:underline flex-shrink-0">Choose different file</button>
            </div>
            <div className="border border-gray-200 rounded-xl max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['', 'Date', 'Name / Phone', 'Amount', 'Status'].map(h => <th key={h} className="text-left text-xs font-medium text-gray-500 px-3 py-2">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((r, i) => (
                    <tr key={i} className={!r.matched ? 'opacity-50' : !r.include ? 'opacity-40' : ''}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={r.include} disabled={!r.matched} onChange={e => setRows(rs => rs.map((row, idx) => idx === i ? { ...row, include: e.target.checked } : row))} />
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-3 py-2 text-gray-700 max-w-[220px] truncate" title={r.name}>{r.name || '—'}{r.phone && <div className="text-xs text-gray-400">{r.phone}</div>}</td>
                      <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{fmt(r.amount)}</td>
                      <td className="px-3 py-2">
                        {r.matched
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">Matched — {r.matchedStudentName}</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600">No student found</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn-primary" onClick={() => commitMutation.mutate()} disabled={!includedCount || commitMutation.isPending}>
                {commitMutation.isPending ? 'Importing...' : <><Sparkles className="w-4 h-4" />Import {includedCount} Row(s)</>}
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
  const [showGroupAdd, setShowGroupAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
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
        <div className="flex gap-2 flex-shrink-0">
          {isAdmin && <button onClick={() => setShowImport(true)} className="btn-secondary"><Upload className="w-4 h-4" />Import Excel</button>}
          <button onClick={() => setShowGroupAdd(true)} className="btn-secondary"><Users className="w-4 h-4" />Group Payment</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" />Record Payment</button>
        </div>
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
                {['Receipt No', 'Student', 'Course', 'Amount', 'Method', 'Received In', 'Date', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8}><LoadingState /></td></tr>
              ) : !data?.data?.length ? (
                <tr><td colSpan={8}><EmptyState title="No payments yet" description="Record your first payment" action={<button onClick={() => setShowAdd(true)} className="btn-primary mx-auto">Record Payment</button>} /></td></tr>
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
                  <td className="px-4 py-3"><BankAccountBadge bankAccount={p.bankAccount} /></td>
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

      <GroupPaymentsSection />

      <AddPaymentModal open={showAdd} onClose={() => setShowAdd(false)} />
      <GroupPaymentModal open={showGroupAdd} onClose={() => setShowGroupAdd(false)} />
      <ImportPaymentsModal open={showImport} onClose={() => setShowImport(false)} />
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
