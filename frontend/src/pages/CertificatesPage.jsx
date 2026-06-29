import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Search, Download, GraduationCap, Briefcase, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { fmt, fmtDate } from '../utils/constants';
import { LoadingState, EmptyState } from '../components/ui/index';

const TYPE_CONFIG = {
  COMPLETION: { label: 'Course Completion', icon: GraduationCap, color: 'bg-blue-100 text-blue-700', btnClass: 'btn-gold' },
  INTERNSHIP: { label: 'Internship', icon: Briefcase, color: 'bg-purple-100 text-purple-700', btnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-xl text-sm flex items-center gap-2 transition-colors' },
};

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useRef(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timerRef.current);
  }, [value, delay]);
  return debounced;
}

function EligibilityBadge({ enrollment }) {
  if (enrollment.paymentStatus === 'PAID' || enrollment.balanceDue === 0) {
    return <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full"><CheckCircle className="w-3 h-3" />Eligible for Certificate</span>;
  }
  if (enrollment.paymentStatus === 'PARTIAL') {
    return <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full"><AlertTriangle className="w-3 h-3" />Partial Payment — {fmt(enrollment.balanceDue)} remaining</span>;
  }
  return <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full"><XCircle className="w-3 h-3" />No Payment Made</span>;
}

function EnrollmentCard({ enrollment }) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState('');
  const [certResult, setCertResult] = useState(null);
  const isPending = enrollment.paymentStatus === 'PENDING';

  const generate = async (type) => {
    setGenerating(type);
    try {
      const { data } = await api.post('/certificates/generate', { enrollmentId: enrollment.id, type });
      setCertResult(data);
      toast.success(`${type === 'COMPLETION' ? 'Course Completion' : 'Internship'} Certificate generated!`);
      qc.invalidateQueries({ queryKey: ['certificates'] });
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Certificate generation failed');
    } finally {
      setGenerating('');
    }
  };

  const downloadCert = async () => {
    if (!certResult) return;
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
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card border border-gray-100 hover:border-primary-200 transition-colors"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="text-base font-bold text-gray-900">{enrollment.lead?.name}</div>
          <div className="text-sm text-gray-400">{enrollment.lead?.phone}</div>
        </div>
        <EligibilityBadge enrollment={enrollment} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
        <div>
          <div className="text-xs text-gray-400">Course</div>
          <div className="font-medium text-gray-800 text-xs mt-0.5">{enrollment.course?.name}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Enrolled</div>
          <div className="font-medium text-gray-700 text-xs mt-0.5">{fmtDate(enrollment.enrolledAt)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Paid</div>
          <div className="font-semibold text-green-600 text-xs mt-0.5">{fmt(enrollment.paidAmount)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Balance</div>
          <div className={`font-semibold text-xs mt-0.5 ${enrollment.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {enrollment.balanceDue > 0 ? fmt(enrollment.balanceDue) : '✅ Fully Paid'}
          </div>
        </div>
      </div>

      {enrollment.paymentStatus === 'PARTIAL' && (
        <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ Student has pending balance. Proceed at admin discretion.
        </div>
      )}

      {certResult ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-green-800 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" />Certificate Generated!</div>
            <div className="text-xs text-green-600 mt-0.5 font-mono">{certResult.certificateNo}</div>
          </div>
          <button onClick={downloadCert}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors">
            <Download className="w-3.5 h-3.5" />Download
          </button>
        </div>
      ) : (
        <div className={`flex gap-2 ${isPending ? 'opacity-40 pointer-events-none' : ''}`}>
          <button onClick={() => generate('COMPLETION')} disabled={!!generating}
            className="btn-gold text-xs py-2 px-3 flex-1 justify-center">
            {generating === 'COMPLETION' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GraduationCap className="w-3.5 h-3.5" />}
            Completion Certificate
          </button>
          <button onClick={() => generate('INTERNSHIP')} disabled={!!generating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-3 rounded-xl flex-1 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-60">
            {generating === 'INTERNSHIP' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Briefcase className="w-3.5 h-3.5" />}
            Internship Certificate
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function CertificatesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('generate');
  const [search, setSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('');
  const [bulkCourseId, setBulkCourseId] = useState('');
  const [bulkType, setBulkType] = useState('COMPLETION');

  const debouncedSearch = useDebounce(search, 350);
  const isSearchActive = debouncedSearch.length >= 2;

  // Search enrollments directly
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['enrollment-search', debouncedSearch],
    queryFn: () => api.get(`/enrollments?search=${encodeURIComponent(debouncedSearch)}&limit=10`).then(r => r.data),
    enabled: isSearchActive,
  });

  const { data: certs, isLoading: certsLoading } = useQuery({
    queryKey: ['certificates', historyTypeFilter],
    queryFn: () => api.get(`/certificates${historyTypeFilter ? `?type=${historyTypeFilter}` : ''}`).then(r => r.data),
    enabled: tab === 'history',
  });

  const { data: coursesData } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.get('/courses').then(r => r.data),
  });

  const handleDownload = async (certId, certNo) => {
    try {
      const res = await api.get(`/certificates/${certId}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download certificate');
    }
  };

  const enrollments = searchData?.data || [];
  const filteredCerts = (certs || []).filter(c =>
    !historySearch ||
    c.enrollment?.lead?.name?.toLowerCase().includes(historySearch.toLowerCase()) ||
    c.certificateNo?.includes(historySearch)
  );
  const courses = coursesData?.data || coursesData || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
          <Award className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Certificate Management</h1>
          <p className="text-sm text-gray-500">Generate and manage student certificates</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[{ id: 'generate', label: 'Generate Certificate' }, { id: 'history', label: 'Certificate History' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Generate Tab */}
      {tab === 'generate' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="card">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-semibold text-gray-900">Search Student</h3>
              <span className="text-xs text-gray-400">Type name or phone number (min 2 chars)</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-10"
                placeholder="Search enrolled student by name or phone..."
                autoFocus
              />
            </div>
          </div>

          {/* Search Results */}
          <AnimatePresence mode="wait">
            {isSearchActive && (
              <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {searchLoading ? (
                  <div className="text-sm text-gray-400 text-center py-8 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />Searching enrollments...
                  </div>
                ) : enrollments.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No enrolled students found for "{debouncedSearch}"</p>
                    <p className="text-xs mt-1 text-gray-300">Only enrolled students appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-xs text-gray-400 font-medium">{enrollments.length} enrollment{enrollments.length !== 1 ? 's' : ''} found</div>
                    {enrollments.map(enr => (
                      <EnrollmentCard key={enr.id} enrollment={enr} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!isSearchActive && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Award className="w-16 h-16 text-gray-200 mb-4" />
              <p className="text-gray-400 text-sm">Search for an enrolled student to generate their certificate</p>
              <p className="text-gray-300 text-xs mt-1">Green badge = fully paid & eligible • Orange = partial payment • Red = no payment</p>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} className="input pl-10" placeholder="Search by name or cert no..." />
            </div>
            <select value={historyTypeFilter} onChange={e => setHistoryTypeFilter(e.target.value)} className="input w-48">
              <option value="">All Types</option>
              <option value="COMPLETION">Course Completion</option>
              <option value="INTERNSHIP">Internship</option>
            </select>
          </div>

          {certsLoading ? <LoadingState text="Loading certificates..." /> : (
            <div className="card p-0 overflow-hidden">
              {filteredCerts.length === 0 ? (
                <EmptyState title="No certificates found" description="Generate your first certificate from the Generate tab." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Cert No', 'Student', 'Course', 'Type', 'Issued', 'Generated By', 'Downloads', ''].map(h => (
                          <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredCerts.map(cert => (
                        <motion.tr key={cert.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">{cert.certificateNo}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{cert.enrollment?.lead?.name}</td>
                          <td className="px-4 py-3 text-gray-500">{cert.enrollment?.course?.shortName}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_CONFIG[cert.type]?.color || 'bg-gray-100 text-gray-700'}`}>
                              {TYPE_CONFIG[cert.type]?.label || cert.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{fmtDate(cert.issuedAt)}</td>
                          <td className="px-4 py-3 text-gray-500">{cert.generatedBy?.name}</td>
                          <td className="px-4 py-3 text-center text-gray-500">{cert.downloadCount}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleDownload(cert.id, cert.certificateNo)} className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                              <Download className="w-3.5 h-3.5" /> Download
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
        </div>
      )}

      {/* Bulk Generation */}
      <div className="card border border-dashed border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-1">Bulk Certificate Generation</h3>
        <p className="text-sm text-gray-500 mb-4">Generate certificates for all completed enrollments in a course.</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label text-xs">Course</label>
            <select value={bulkCourseId} onChange={e => setBulkCourseId(e.target.value)} className="input text-sm py-1.5 w-64">
              <option value="">Select course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Type</label>
            <select value={bulkType} onChange={e => setBulkType(e.target.value)} className="input text-sm py-1.5">
              <option value="COMPLETION">Course Completion</option>
              <option value="INTERNSHIP">Internship</option>
            </select>
          </div>
          <button
            onClick={async () => {
              if (!bulkCourseId) { toast.error('Select a course'); return; }
              try {
                const enrollments = await api.get(`/enrollments?courseId=${bulkCourseId}&status=COMPLETED`).then(r => r.data);
                const ids = (enrollments?.data || []).map(e => e.id);
                if (!ids.length) { toast.error('No completed enrollments found'); return; }
                const result = await api.post('/certificates/bulk', { enrollmentIds: ids, type: bulkType });
                toast.success(`Generated ${result.data?.length || ids.length} certificates!`);
                qc.invalidateQueries({ queryKey: ['certificates'] });
              } catch (err) {
                toast.error(err?.response?.data?.error || 'Bulk generation failed');
              }
            }}
            className="btn-primary"
          >
            Generate All
          </button>
        </div>
      </div>
    </div>
  );
}
