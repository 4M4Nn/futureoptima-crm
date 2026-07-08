import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Search, RefreshCw, Download, Trash2, FileSpreadsheet, UserPlus, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../utils/api';
import { fmt, fmtDate } from '../../utils/constants';
import { LoadingState, EmptyState, Pagination, StatusBadge, ConfirmDialog, Modal, BankAccountPicker } from '../../components/ui/index';
import { useAuthStore } from '../../store/authStore';
import AssignBatchModal from '../../components/AssignBatchModal';
import toast from 'react-hot-toast';

const PAY_METHOD_OPTS = [
  { value: 'CASH', label: 'Cash' }, { value: 'UPI', label: 'UPI' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' }, { value: 'CHEQUE', label: 'Cheque' },
];

const initialQuickAddForm = {
  name: '', phone: '', email: '', city: '',
  courseId: '', batchId: '', enrollmentDate: new Date().toISOString().slice(0, 10),
  courseFee: '', discountAmount: '0', installments: '1',
  recordPayment: false,
  paymentAmount: '', paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: 'CASH',
  receivedIn: 'CASH', transactionId: '', remarks: 'Opening balance entry',
};

function QuickAddStudentModal({ open, onClose }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialQuickAddForm);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const { data: coursesData } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.get('/courses').then(r => r.data),
    enabled: open,
  });
  const courses = coursesData || [];

  const { data: batches } = useQuery({
    queryKey: ['course-batches', form.courseId],
    queryFn: () => api.get(`/courses/${form.courseId}/batches`).then(r => r.data),
    enabled: open && !!form.courseId,
  });

  const selectedCourse = courses.find(c => c.id === form.courseId);
  const isInternship = selectedCourse?.courseId === 'INTERNSHIP';

  const handleCourseChange = (id) => {
    const selected = courses.find(c => c.id === id);
    setForm(p => ({
      ...p,
      courseId: id,
      batchId: '',
      courseFee: selected ? String(selected.fees) : '',
      installments: selected?.courseId === 'INTERNSHIP' ? '1' : p.installments,
    }));
  };

  const netFee = Math.max(0, (Number(form.courseFee) || 0) - (Number(form.discountAmount) || 0));

  const handleClose = () => {
    if (mutation.isPending) return;
    setStep(1);
    setForm(initialQuickAddForm);
    onClose();
  };

  const mutation = useMutation({
    mutationFn: () => api.post('/enrollments/quick-add', {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      city: form.city.trim() || undefined,
      courseId: form.courseId,
      batchId: form.batchId || undefined,
      enrollmentDate: form.enrollmentDate,
      courseFee: Number(form.courseFee),
      discountAmount: Number(form.discountAmount) || 0,
      installments: Number(form.installments),
      payment: form.recordPayment && Number(form.paymentAmount) > 0 ? {
        amount: Number(form.paymentAmount),
        date: form.paymentDate,
        method: form.paymentMethod,
        receivedIn: form.receivedIn,
        transactionId: form.transactionId || undefined,
        remarks: form.remarks || 'Opening balance entry',
      } : undefined,
    }).then(r => r.data),
    onSuccess: (data) => {
      toast.success('Student added successfully!');
      qc.invalidateQueries(['enrollments']);
      setStep(1);
      setForm(initialQuickAddForm);
      onClose();
      navigate(`/students/${data.enrollmentId}`);
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Failed to add student'),
  });

  const step1Valid = form.name.trim().length >= 2 && (form.phone.trim() === '' || /^\d{10}$/.test(form.phone.trim()));
  const step2Valid = !!form.courseId && Number(form.courseFee) > 0 && Number(form.installments) >= 1;

  return (
    <Modal open={open} onClose={handleClose} title="Add Existing Student" size="lg">
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3].map(n => (
            <div key={n} className={`flex-1 h-1.5 rounded-full ${step >= n ? 'bg-amber-500' : 'bg-gray-100'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Step 1 — Student Details</h3>
            <div>
              <label className="label">Full Name *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Arjun Menon" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Phone Number</label>
                <input className="input" value={form.phone} onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="arjun@email.com" />
              </div>
            </div>
            <div>
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={e => set('city', e.target.value)} placeholder="Kochi" />
            </div>
            <div className="flex justify-end pt-2">
              <button className="btn-gold" disabled={!step1Valid} onClick={() => setStep(2)}>Next</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Step 2 — Course & Enrollment</h3>
            <div>
              <label className="label">Course *</label>
              <select className="input" value={form.courseId} onChange={e => handleCourseChange(e.target.value)}>
                <option value="">Select a course...</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name} — ₹{(c.fees || 0).toLocaleString('en-IN')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Batch</label>
              <select className="input" value={form.batchId} onChange={e => set('batchId', e.target.value)} disabled={!form.courseId}>
                <option value="">{!form.courseId ? 'Select a course first' : (!batches?.length ? 'No active batches' : 'No batch / unassigned')}</option>
                {(batches || []).map(b => <option key={b.id} value={b.id}>{b.batchName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Enrollment Date</label>
                <input className="input" type="date" value={form.enrollmentDate} onChange={e => set('enrollmentDate', e.target.value)} max={new Date().toISOString().slice(0, 10)} />
              </div>
              <div>
                <label className="label">Total Course Fee (₹)</label>
                <input className="input" type="number" value={form.courseFee} onChange={e => set('courseFee', e.target.value)} min="0" />
              </div>
              <div>
                <label className="label">Discount Amount (₹)</label>
                <input className="input" type="number" value={form.discountAmount} onChange={e => set('discountAmount', e.target.value)} min="0" />
              </div>
              <div>
                <label className="label">Number of Installments</label>
                <select className="input" value={form.installments} onChange={e => set('installments', e.target.value)} disabled={isInternship}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n === 1 ? 'Full Payment (1 installment)' : `${n} Installments`}</option>
                  ))}
                </select>
                {isInternship && <p className="text-xs text-gray-400 mt-1">Internship fee is collected as a single payment</p>}
              </div>
            </div>
            {isInternship && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm text-purple-700">
                🎓 Internship Certificate on completion
              </div>
            )}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex justify-between items-center">
              <span className="font-bold text-indigo-900">Net Fee</span>
              <span className="text-xl font-bold text-indigo-900">₹{netFee.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between pt-2">
              <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button className="btn-gold" disabled={!step2Valid} onClick={() => setStep(3)}>Next</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Step 3 — Payment Record</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.recordPayment} onChange={e => set('recordPayment', e.target.checked)} className="w-4 h-4 accent-amber-500" />
              <span className="text-sm font-medium text-gray-700">Record a payment now?</span>
            </label>

            {form.recordPayment && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Amount Paid (₹)</label>
                    <input className="input" type="number" value={form.paymentAmount} onChange={e => set('paymentAmount', e.target.value)} min="0" />
                  </div>
                  <div>
                    <label className="label">Payment Date</label>
                    <input className="input" type="date" value={form.paymentDate} onChange={e => set('paymentDate', e.target.value)} max={new Date().toISOString().slice(0, 10)} />
                  </div>
                </div>
                <div>
                  <label className="label">Payment Method</label>
                  <select className="input" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
                    {PAY_METHOD_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <BankAccountPicker value={form.receivedIn} onChange={v => set('receivedIn', v)} />
                <div>
                  <label className="label">Transaction ID</label>
                  <input className="input" value={form.transactionId} onChange={e => set('transactionId', e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className="label">Remarks</label>
                  <input className="input" value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Opening balance entry" />
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button className="btn-secondary" onClick={() => setStep(2)} disabled={mutation.isPending}>Back</button>
              <button className="btn-gold" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Adding...</> : 'Add Student & Record Payment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

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

export default function StudentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [payStatus, setPayStatus] = useState('');
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const exportExcel = async () => {
    try {
      setExporting(true);
      const response = await api.get('/enrollments/export-excel', { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'FutureOptima_Students.xlsx';
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('Excel downloaded!');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const { data: coursesData } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.get('/courses').then(r => r.data),
  });

  const { data: batchesData } = useQuery({
    queryKey: ['all-batches-filter'],
    queryFn: () => api.get('/courses/batches').then(r => r.data),
  });

  const params = new URLSearchParams({
    page,
    limit: 25,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(payStatus ? { paymentStatus: payStatus } : {}),
    ...(courseId ? { courseId } : {}),
    ...(batchId ? { batchId } : {}),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['enrollments', page, search, status, payStatus, courseId, batchId],
    queryFn: () => api.get(`/enrollments?${params}`).then(r => r.data),
    keepPreviousData: true,
  });

  const reset = () => { setSearch(''); setStatus(''); setPayStatus(''); setCourseId(''); setBatchId(''); setPage(1); };
  const { user } = useAuthStore();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);
  const [deleteEnrollment, setDeleteEnrollment] = useState(null);
  const [forceDeleteTarget, setForceDeleteTarget] = useState(null);
  const [assigningBatchFor, setAssigningBatchFor] = useState(null);
  const qc = useQueryClient();

  const deleteEnrollmentMutation = useMutation({
    mutationFn: ({ id, force }) => api.delete(`/enrollments/${id}${force ? '?confirm=true' : ''}`),
    onSuccess: () => {
      toast.success('Enrollment deleted');
      qc.invalidateQueries(['enrollments']);
      setDeleteEnrollment(null);
      setForceDeleteTarget(null);
    },
    onError: (e, variables) => {
      const data = e?.response?.data;
      if (!variables.force && data?.requiresConfirmation) {
        setForceDeleteTarget({ enrollment: deleteEnrollment, message: data.error });
        setDeleteEnrollment(null);
      } else {
        toast.error(data?.error || 'Delete failed');
        setDeleteEnrollment(null);
        setForceDeleteTarget(null);
      }
    },
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="text-gray-500 text-sm">{data?.pagination?.total || 0} enrolled students</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-900 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Add Existing Student
          </button>
          <button
            disabled={exporting}
            onClick={exportExcel}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" /> {exporting ? 'Downloading...' : 'Export Excel'}
          </button>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name or phone..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          {['ACTIVE', 'COMPLETED', 'DROPPED', 'ON_HOLD', 'DEFERRED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-auto" value={payStatus} onChange={e => { setPayStatus(e.target.value); setPage(1); }}>
          <option value="">All Payment</option>
          {['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input w-auto" value={courseId} onChange={e => { setCourseId(e.target.value); setBatchId(''); setPage(1); }}>
          <option value="">All Courses</option>
          {(coursesData || []).map(c => <option key={c.id} value={c.id}>{c.shortName}</option>)}
        </select>
        <select className="input w-auto" value={batchId} onChange={e => { setBatchId(e.target.value); setPage(1); }}>
          <option value="">All Batches</option>
          {(batchesData || []).filter(b => !courseId || b.courseId === courseId).map(b => (
            <option key={b.id} value={b.id}>{b.batchName} ({b.course?.shortName})</option>
          ))}
        </select>
        <button onClick={reset} className="btn-secondary text-sm"><RefreshCw className="w-4 h-4" />Reset</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Student No.', 'Student', 'Course', 'Batch', 'Total Fee', 'Paid', 'Balance Due', 'Payment Status', 'Enrolled On', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10}><LoadingState /></td></tr>
              ) : !data?.data?.length ? (
                <tr><td colSpan={10}><EmptyState title="No students yet" description="Enroll a lead to see them here" /></td></tr>
              ) : data.data.map((enr, i) => (
                <motion.tr key={enr.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="table-row">
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{enr.studentCode || '—'}</td>
                  <td className="px-4 py-3">
                    <Link to={`/students/${enr.id}`} className="font-semibold text-gray-900 hover:text-primary-600 text-sm">{enr.lead?.name}</Link>
                    <div className="text-xs text-gray-400">{enr.lead?.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">{enr.course?.shortName}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      {enr.batch?.batchName
                        ? <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{enr.batch.batchName}</span>
                        : <span className="text-gray-300">—</span>}
                      <button onClick={() => setAssigningBatchFor(enr)} className="text-primary-600 hover:underline font-medium">
                        {enr.batch?.batchName ? 'Change' : 'Assign'}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{fmt(enr.netFee)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-600">{fmt(enr.paidAmount)}</td>
                  <td className="px-4 py-3 text-sm font-semibold">
                    {enr.balanceDue > 0
                      ? <span className="text-red-600">{fmt(enr.balanceDue)}</span>
                      : <span className="text-green-600">✅ Fully Paid</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={enr.paymentStatus} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(enr.enrolledAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link to={`/students/${enr.id}`} className="text-xs text-primary-600 hover:underline font-medium">View</Link>
                      {isAdmin && (
                        <button onClick={() => setDeleteEnrollment(enr)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Delete enrollment">
                          <Trash2 className="w-3.5 h-3.5" />
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

      <ConfirmDialog
        open={!!deleteEnrollment}
        onClose={() => setDeleteEnrollment(null)}
        onConfirm={() => deleteEnrollmentMutation.mutate({ id: deleteEnrollment?.id, force: false })}
        loading={deleteEnrollmentMutation.isPending}
        danger
        title={`Delete enrollment — ${deleteEnrollment?.lead?.name}?`}
        message={`This will remove the enrollment record and reset the lead status to QUALIFIED.\n\nThis cannot be undone.`}
        confirmLabel="Delete Enrollment"
      />
      <ConfirmDialog
        open={!!forceDeleteTarget}
        onClose={() => setForceDeleteTarget(null)}
        onConfirm={() => deleteEnrollmentMutation.mutate({ id: forceDeleteTarget?.enrollment?.id, force: true })}
        loading={deleteEnrollmentMutation.isPending}
        danger
        title={`Delete anyway — ${forceDeleteTarget?.enrollment?.lead?.name}?`}
        message={`${forceDeleteTarget?.message}\n\nThis cannot be undone.`}
        confirmLabel="Delete Everything"
      />
      <QuickAddStudentModal open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
      <AssignBatchModal open={!!assigningBatchFor} onClose={() => setAssigningBatchFor(null)} enrollment={assigningBatchFor} />
    </div>
  );
}
