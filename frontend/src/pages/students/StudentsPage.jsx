import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { GraduationCap, Search, RefreshCw, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../../utils/api';
import { fmt, fmtDate } from '../../utils/constants';
import { LoadingState, EmptyState, Pagination, StatusBadge } from '../../components/ui/index';
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

export default function StudentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [payStatus, setPayStatus] = useState('');
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');

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

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="text-gray-500 text-sm">{data?.pagination?.total || 0} enrolled students</p>
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
                {['Student', 'Course', 'Batch', 'Total Fee', 'Paid', 'Balance Due', 'Payment Status', 'Enrolled On', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9}><LoadingState /></td></tr>
              ) : !data?.data?.length ? (
                <tr><td colSpan={9}><EmptyState title="No students yet" description="Enroll a lead to see them here" /></td></tr>
              ) : data.data.map((enr, i) => (
                <motion.tr key={enr.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="table-row">
                  <td className="px-4 py-3">
                    <Link to={`/students/${enr.id}`} className="font-semibold text-gray-900 hover:text-primary-600 text-sm">{enr.lead?.name}</Link>
                    <div className="text-xs text-gray-400">{enr.lead?.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">{enr.course?.shortName}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {enr.batch?.batchName
                      ? <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">{enr.batch.batchName}</span>
                      : <span className="text-gray-300">—</span>}
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
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.pagination && <div className="px-4 pb-4"><Pagination page={data.pagination.page} pages={data.pagination.pages} total={data.pagination.total} onPage={setPage} /></div>}
      </div>
    </div>
  );
}
