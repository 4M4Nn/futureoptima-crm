import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Award, Search, Download, GraduationCap, Briefcase, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { fmt, fmtDate } from '../utils/constants';
import { LoadingState, EmptyState } from '../components/ui/index';

const TYPE_CONFIG = {
  COMPLETION: { label: 'Course Completion', icon: GraduationCap, color: 'bg-blue-100 text-blue-700' },
  INTERNSHIP: { label: 'Internship', icon: Briefcase, color: 'bg-purple-100 text-purple-700' },
};

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  const timer = useCallback(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  useState(timer);
  return debounced;
}

export default function CertificatesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('generate');
  const [search, setSearch] = useState('');
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [certType, setCertType] = useState('COMPLETION');
  const [generatedCert, setGeneratedCert] = useState(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('');
  const [bulkCourseId, setBulkCourseId] = useState('');
  const [bulkType, setBulkType] = useState('COMPLETION');

  const debouncedSearch = search.length >= 2 ? search : '';

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['lead-search', debouncedSearch],
    queryFn: () => api.get(`/leads?search=${debouncedSearch}&limit=10`).then(r => r.data),
    enabled: debouncedSearch.length >= 2,
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

  const generateMutation = useMutation({
    mutationFn: (body) => api.post('/certificates/generate', body),
    onSuccess: (data) => {
      toast.success('Certificate generated!');
      setGeneratedCert(data.data);
      qc.invalidateQueries({ queryKey: ['certificates'] });
    },
    onError: (err) => toast.error(err?.error || 'Failed to generate certificate'),
  });

  const handleGenerate = () => {
    if (!selectedEnrollment) { toast.error('Select a student enrollment'); return; }
    generateMutation.mutate({ enrollmentId: selectedEnrollment.id, type: certType });
  };

  const handleDownload = (certId, certNo) => {
    window.open(`${import.meta.env.VITE_API_URL || ''}/api/certificates/${certId}/download`, '_blank');
  };

  const leads = searchResults?.data || [];
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Search and Select */}
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Search Student</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setSelectedEnrollment(null); setGeneratedCert(null); }}
                  className="input pl-10"
                  placeholder="Search by name or phone..."
                />
              </div>

              {search.length >= 2 && (
                <div className="mt-3 space-y-2">
                  {searchLoading ? (
                    <div className="text-sm text-gray-400 text-center py-4">Searching...</div>
                  ) : leads.length === 0 ? (
                    <div className="text-sm text-gray-400 text-center py-4">No students found</div>
                  ) : leads.map(lead => (
                    <motion.button
                      key={lead.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        if (lead.enrollment) { setSelectedEnrollment(lead.enrollment); setSearch(lead.name); }
                        else toast.error(`${lead.name} has no enrollment`);
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedEnrollment?.id === lead.enrollment?.id ? 'border-primary-400 bg-primary-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{lead.name}</div>
                          <div className="text-xs text-gray-400">{lead.phone}</div>
                        </div>
                        <div className="text-right">
                          {lead.enrollment ? (
                            <>
                              <div className="text-xs font-medium text-gray-600">{lead.enrollment?.course?.shortName}</div>
                              <div className={`text-xs ${lead.enrollment?.status === 'COMPLETED' ? 'text-green-600' : 'text-blue-600'}`}>{lead.enrollment?.status}</div>
                            </>
                          ) : (
                            <div className="text-xs text-red-400">Not enrolled</div>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Certificate Type */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Certificate Type</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                  <button
                    key={type}
                    onClick={() => setCertType(type)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${certType === type ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <cfg.icon className={`w-8 h-8 ${certType === type ? 'text-primary-600' : 'text-gray-400'}`} />
                    <span className={`text-sm font-medium ${certType === type ? 'text-primary-700' : 'text-gray-600'}`}>{cfg.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Preview and Generate */}
          <div className="space-y-4">
            {selectedEnrollment ? (
              <div className="card border-2 border-primary-100">
                <h3 className="font-semibold text-gray-900 mb-4">Enrollment Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Student</span>
                    <span className="font-medium text-gray-900">{selectedEnrollment?.lead?.name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Course</span>
                    <span className="font-medium text-gray-900">{selectedEnrollment?.course?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Enrolled</span>
                    <span className="text-gray-600">{fmtDate(selectedEnrollment?.enrolledAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className={`font-semibold ${selectedEnrollment?.status === 'COMPLETED' ? 'text-green-600' : 'text-blue-600'}`}>{selectedEnrollment?.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Receipt No</span>
                    <span className="text-gray-600 font-mono text-xs">{selectedEnrollment?.receiptNo}</span>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="text-xs text-amber-700 font-medium">Certificate to Generate</div>
                  <div className="text-sm font-bold text-amber-900 mt-0.5">{TYPE_CONFIG[certType]?.label} Certificate</div>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
                >
                  {generateMutation.isPending ? 'Generating...' : 'Generate Certificate'}
                </button>
              </div>
            ) : (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <Award className="w-16 h-16 text-gray-200 mb-4" />
                <p className="text-gray-400 text-sm">Search and select a student to generate their certificate</p>
              </div>
            )}

            {/* Generated Certificate */}
            {generatedCert && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card border-2 border-green-200 bg-green-50">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <div>
                    <div className="font-bold text-green-800">Certificate Generated!</div>
                    <div className="text-sm text-green-600">Certificate No: {generatedCert.certificateNo}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(generatedCert.id, generatedCert.certificateNo)}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
                >
                  <Download className="w-4 h-4" /> Download Certificate
                </button>
              </motion.div>
            )}
          </div>
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
        <h3 className="font-semibold text-gray-900 mb-4">Bulk Certificate Generation</h3>
        <p className="text-sm text-gray-500 mb-4">Generate certificates for all completed enrollments in a course batch.</p>
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
                toast.success(`Generated ${result.data?.length || 0} certificates!`);
                qc.invalidateQueries({ queryKey: ['certificates'] });
              } catch (err) {
                toast.error(err?.error || 'Bulk generation failed');
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
