import { useState, useEffect, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Users, Clock, DollarSign, Plus, Edit2, Calendar, MapPin, UserCheck, ToggleLeft, ToggleRight, Link2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { fmt, fmtDate } from '../utils/constants';
import { LoadingState, EmptyState, Modal, ConfirmDialog } from '../components/ui/index';
import { useAuthStore } from '../store/authStore';

const COURSE_ICONS = { AI_ENGINEERING: '🤖', DATA_SCIENCE_AI: '📊', AI_CYBERSECURITY: '🔐', PYTHON_FULLSTACK: '🐍', VIBE_CODING_SAAS: '🚀', DATA_ANALYTICS: '📈', BUSINESS_ANALYTICS: '💼' };
const COURSE_COLORS = ['from-indigo-500 to-purple-600', 'from-blue-500 to-cyan-600', 'from-red-500 to-orange-600', 'from-green-500 to-teal-600', 'from-pink-500 to-rose-600', 'from-yellow-500 to-amber-600', 'from-slate-500 to-gray-600'];
const COURSE_IDS = ['AI_ENGINEERING', 'DATA_SCIENCE_AI', 'AI_CYBERSECURITY', 'PYTHON_FULLSTACK', 'VIBE_CODING_SAAS', 'DATA_ANALYTICS', 'BUSINESS_ANALYTICS'];
const COURSE_ID_LABELS = {
  AI_ENGINEERING: 'AI Engineering & Automation',
  DATA_SCIENCE_AI: 'Data Science with AI',
  AI_CYBERSECURITY: 'AI-Powered Cybersecurity',
  PYTHON_FULLSTACK: 'Python Full Stack with AI',
  VIBE_CODING_SAAS: 'Vibe Coding & SaaS Dev',
  DATA_ANALYTICS: 'Data Analytics',
  BUSINESS_ANALYTICS: 'Business Analytics',
};
const MODES = ['ONLINE', 'OFFLINE', 'HYBRID'];
const MODE_COLORS = { ONLINE: 'bg-blue-100 text-blue-700', OFFLINE: 'bg-green-100 text-green-700', HYBRID: 'bg-purple-100 text-purple-700' };

const EMPTY_COURSE = { courseId: '', name: '', shortName: '', duration: '', totalHours: '', fees: '', emiAvailable: true, maxInstallments: 6, highlights: [] };
const EMPTY_BATCH = {
  courseId: '', batchName: '', mode: 'OFFLINE', startDate: '', endDate: '', timings: '', capacity: '30', venue: '', facultyName: '',
  isCombined: false, combinedCourseIds: [], splitAfterMonths: '', splitDate: '', combinedBatchNote: '',
};

export default function CoursesPage() {
  const { user } = useAuthStore();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);
  const qc = useQueryClient();
  const [tab, setTab] = useState('courses');
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editBatch, setEditBatch] = useState(null);
  const [courseForm, setCourseForm] = useState(EMPTY_COURSE);
  const [batchForm, setBatchForm] = useState(EMPTY_BATCH);
  const [highlightInput, setHighlightInput] = useState('');
  const [batchNameTouched, setBatchNameTouched] = useState(false);
  const [splitDateTouched, setSplitDateTouched] = useState(false);
  const [batchTypeFilter, setBatchTypeFilter] = useState('all');
  const [expandedBatchId, setExpandedBatchId] = useState(null);

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses-full'],
    queryFn: () => api.get('/courses').then(r => r.data),
  });

  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ['all-batches'],
    queryFn: () => api.get('/courses/batches').then(r => r.data),
    enabled: tab === 'batches',
  });

  const courseMutation = useMutation({
    mutationFn: (body) => api.post('/courses', body),
    onSuccess: () => {
      toast.success('Course saved!');
      qc.invalidateQueries({ queryKey: ['courses-full'] });
      qc.invalidateQueries({ queryKey: ['courses'] });
      setShowCourseModal(false);
      setCourseForm(EMPTY_COURSE);
    },
    onError: (err) => toast.error(err?.errors?.[0]?.msg || err?.error || 'Failed to save course'),
  });

  const batchMutation = useMutation({
    mutationFn: (body) => editBatch
      ? api.patch(`/courses/batches/${editBatch.id}`, body)
      : api.post('/courses/batches', body),
    onSuccess: () => {
      toast.success(editBatch ? 'Batch updated!' : 'Batch created!');
      qc.invalidateQueries({ queryKey: ['all-batches'] });
      setShowBatchModal(false);
      setEditBatch(null);
      setBatchForm(EMPTY_BATCH);
    },
    onError: (err) => toast.error(err?.errors?.[0]?.msg || err?.error || 'Failed to save batch'),
  });

  const [deleteBatch, setDeleteBatch] = useState(null);
  const deleteBatchMutation = useMutation({
    mutationFn: (id) => api.delete(`/courses/batches/${id}`),
    onSuccess: () => {
      toast.success('Batch deleted');
      qc.invalidateQueries({ queryKey: ['all-batches'] });
      setDeleteBatch(null);
    },
    onError: (err) => { toast.error(err?.response?.data?.error || 'Failed to delete batch'); setDeleteBatch(null); },
  });

  const toggleBatchActive = async (batch) => {
    try {
      await api.patch(`/courses/batches/${batch.id}`, { isActive: !batch.isActive });
      toast.success(batch.isActive ? 'Batch deactivated' : 'Batch activated');
      qc.invalidateQueries({ queryKey: ['all-batches'] });
    } catch { toast.error('Failed to update batch'); }
  };

  const openEditBatch = (batch) => {
    setEditBatch(batch);
    setBatchForm({
      courseId: batch.courseId,
      batchName: batch.batchName,
      mode: batch.mode,
      startDate: batch.startDate?.slice(0, 10) || '',
      endDate: batch.endDate?.slice(0, 10) || '',
      timings: batch.timings,
      capacity: String(batch.capacity),
      venue: batch.venue || '',
      facultyName: batch.facultyName || '',
      isCombined: !!batch.isCombined,
      combinedCourseIds: batch.combinedCourseIds || [],
      splitAfterMonths: batch.splitAfterMonths != null ? String(batch.splitAfterMonths) : '',
      splitDate: batch.splitDate?.slice(0, 10) || '',
      combinedBatchNote: batch.combinedBatchNote || '',
    });
    setBatchNameTouched(true);
    setSplitDateTouched(true);
    setShowBatchModal(true);
  };

  const toggleAdditionalCourse = (courseEnumId) => {
    setBatchForm(f => ({
      ...f,
      combinedCourseIds: f.combinedCourseIds.includes(courseEnumId)
        ? f.combinedCourseIds.filter(c => c !== courseEnumId)
        : [...f.combinedCourseIds, courseEnumId],
    }));
  };

  const setBatchType = (isCombined) => {
    setBatchForm(f => ({ ...EMPTY_BATCH, batchName: '', mode: f.mode }));
    setBatchNameTouched(false);
    setSplitDateTouched(false);
    setBatchForm(f => ({ ...f, isCombined }));
  };

  // Auto-suggest batch name from selected course(s), unless the user has typed their own
  useEffect(() => {
    if (batchNameTouched) return;
    const primary = (courses || []).find(c => c.id === batchForm.courseId);
    if (!primary) return;
    if (!batchForm.isCombined) {
      const count = (batches || []).filter(b => b.courseId === batchForm.courseId).length + 1;
      setBatchForm(f => ({ ...f, batchName: `${primary.shortName} Batch ${count}` }));
    } else {
      if (!batchForm.combinedCourseIds.length) return;
      const additionalNames = batchForm.combinedCourseIds
        .map(cid => (courses || []).find(c => c.courseId === cid)?.shortName)
        .filter(Boolean);
      const count = (batches || []).filter(b => b.isCombined && b.courseId === batchForm.courseId).length + 1;
      setBatchForm(f => ({ ...f, batchName: `${[primary.shortName, ...additionalNames].join(' + ')} Combined Batch ${count}` }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchForm.courseId, batchForm.combinedCourseIds, batchForm.isCombined, batchNameTouched, courses, batches]);

  // Auto-calculate split date from start date + combined months, unless manually overridden
  useEffect(() => {
    if (!batchForm.isCombined || splitDateTouched) return;
    if (!batchForm.startDate || !batchForm.splitAfterMonths) return;
    const d = new Date(batchForm.startDate);
    d.setMonth(d.getMonth() + parseInt(batchForm.splitAfterMonths));
    setBatchForm(f => ({ ...f, splitDate: d.toISOString().slice(0, 10) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchForm.startDate, batchForm.splitAfterMonths, batchForm.isCombined, splitDateTouched]);

  const addHighlight = () => {
    if (!highlightInput.trim()) return;
    setCourseForm(f => ({ ...f, highlights: [...f.highlights, highlightInput.trim()] }));
    setHighlightInput('');
  };

  const submitCourse = (e) => {
    e.preventDefault();
    if (!courseForm.courseId || !courseForm.name || !courseForm.fees) { toast.error('Fill all required fields'); return; }
    courseMutation.mutate({ ...courseForm, totalHours: parseInt(courseForm.totalHours), fees: parseFloat(courseForm.fees), maxInstallments: parseInt(courseForm.maxInstallments) });
  };

  const submitBatch = (e) => {
    e.preventDefault();
    if (!batchForm.courseId || !batchForm.batchName || !batchForm.startDate || !batchForm.timings) {
      toast.error('Fill all required fields'); return;
    }
    if (batchForm.isCombined && !batchForm.combinedCourseIds.length) {
      toast.error('Select at least one additional course for a combined batch'); return;
    }
    batchMutation.mutate({
      ...batchForm,
      capacity: parseInt(batchForm.capacity) || 30,
      splitAfterMonths: batchForm.isCombined && batchForm.splitAfterMonths ? parseInt(batchForm.splitAfterMonths) : undefined,
      splitDate: batchForm.isCombined && batchForm.splitDate ? batchForm.splitDate : undefined,
      combinedCourseIds: batchForm.isCombined ? batchForm.combinedCourseIds : [],
    });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Courses & Batches</h1>
          <p className="text-gray-500 text-sm">Manage courses and batch schedules</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => tab === 'courses' ? setShowCourseModal(true) : (setBatchForm(EMPTY_BATCH), setEditBatch(null), setBatchNameTouched(false), setSplitDateTouched(false), setShowBatchModal(true))}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {tab === 'courses' ? 'Add Course' : 'Add Batch'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[{ id: 'courses', label: 'Courses', count: courses?.length }, { id: 'batches', label: 'Batches', count: batches?.length }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label} {t.count !== undefined && <span className="ml-1 text-xs opacity-60">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Courses Tab */}
      {tab === 'courses' && (
        coursesLoading ? <LoadingState /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {(courses || []).map((course, i) => (
              <motion.div key={course.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="card overflow-hidden">
                <div className={`bg-gradient-to-br ${COURSE_COLORS[i % COURSE_COLORS.length]} p-5`}>
                  <div className="text-4xl mb-2">{COURSE_ICONS[course.courseId] || '📚'}</div>
                  <h3 className="font-bold text-white text-base leading-tight">{course.name}</h3>
                  <div className="text-white/80 text-sm mt-1">{course.shortName}</div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>{course.duration}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <BookOpen className="w-4 h-4 text-gray-400" />
                      <span>{course.totalHours}h</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-green-600">
                      <span>{fmt(course.fees)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>{course._count?.enrollments || 0} enrolled</span>
                    </div>
                  </div>
                  {course.highlights?.length > 0 && (
                    <div className="space-y-1">
                      {course.highlights.map((h, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs text-gray-600">
                          <span className="text-green-500">✓</span>{h}
                        </div>
                      ))}
                    </div>
                  )}
                  {course.emiAvailable && (
                    <div className="bg-blue-50 rounded-lg px-3 py-1.5 text-xs text-blue-700 font-medium">
                      💳 EMI available — up to {course.maxInstallments} installments
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* Batches Tab */}
      {tab === 'batches' && (
        batchesLoading ? <LoadingState text="Loading batches..." /> : (
          <div className="space-y-3">
            {/* Type filter */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
              {[{ id: 'all', label: 'Show All' }, { id: 'single', label: 'Single Only' }, { id: 'combined', label: 'Combined Only' }].map(f => (
                <button key={f.id} onClick={() => setBatchTypeFilter(f.id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${batchTypeFilter === f.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  {f.label}
                </button>
              ))}
            </div>

            <div className="card p-0 overflow-hidden">
              {(() => {
                const filteredBatches = (batches || []).filter(b => batchTypeFilter === 'all' ? true : batchTypeFilter === 'combined' ? b.isCombined : !b.isCombined);
                if (!filteredBatches.length) {
                  return <EmptyState title="No batches found" description="Create a batch or adjust the filter above." />;
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {['Batch Name', 'Course', 'Type', 'Mode', 'Start Date', 'Timings', 'Capacity', 'Faculty', 'Students', 'Status', 'Actions'].map(h => (
                            <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredBatches.map(batch => {
                          const combinedCount = 1 + (batch.combinedCourseIds?.length || 0);
                          const isExpanded = expandedBatchId === batch.id;
                          return (
                            <Fragment key={batch.id}>
                              <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-semibold text-gray-900">{batch.batchName}</td>
                                <td className="px-4 py-3 text-gray-600">{batch.course?.shortName}</td>
                                <td className="px-4 py-3">
                                  {batch.isCombined ? (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                                      title="Click to see combined course details"
                                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                                    >
                                      <Link2 className="w-3 h-3" /> Combined ({combinedCount}) {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </button>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">Single</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${MODE_COLORS[batch.mode] || 'bg-gray-100 text-gray-700'}`}>{batch.mode}</span>
                                </td>
                                <td className="px-4 py-3 text-gray-600">{fmtDate(batch.startDate)}</td>
                                <td className="px-4 py-3 text-gray-600">{batch.timings}</td>
                                <td className="px-4 py-3 text-gray-600">{batch.capacity}</td>
                                <td className="px-4 py-3 text-gray-500">{batch.facultyName || '—'}</td>
                                <td className="px-4 py-3 text-gray-600">
                                  <Link to={`/students?batchId=${batch.id}`} className="text-primary-600 hover:underline text-xs font-medium">
                                    {batch._count?.enrollments || 0} students
                                  </Link>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${batch.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                    {batch.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {isAdmin && (
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => openEditBatch(batch)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700" title="Edit">
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => toggleBatchActive(batch)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="Toggle Active">
                                        {batch.isActive ? <ToggleRight className="w-3.5 h-3.5 text-green-600" /> : <ToggleLeft className="w-3.5 h-3.5 text-gray-400" />}
                                      </button>
                                      <button onClick={() => setDeleteBatch(batch)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-500 transition-colors" title="Delete batch">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </motion.tr>
                              {batch.isCombined && isExpanded && (
                                <tr key={`${batch.id}-expand`}>
                                  <td colSpan={11} className="px-4 py-4 bg-purple-50/60 border-b border-purple-100">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                      <div>
                                        <div className="font-semibold text-gray-700 mb-1">Primary Course</div>
                                        <div className="text-gray-600">✅ {batch.course?.name || batch.course?.shortName}</div>
                                      </div>
                                      <div>
                                        <div className="font-semibold text-gray-700 mb-1">Additional Courses</div>
                                        {(batch.combinedCourseDetails || []).map(c => (
                                          <div key={c.courseId} className="text-gray-600">✅ {c.name}</div>
                                        ))}
                                        {!(batch.combinedCourseDetails || []).length && <div className="text-gray-400">—</div>}
                                      </div>
                                      <div>
                                        <div className="font-semibold text-gray-700 mb-1">Split Date</div>
                                        <div className="text-gray-600">{batch.splitDate ? fmtDate(batch.splitDate) : '—'} {batch.splitAfterMonths ? `(after ${batch.splitAfterMonths} months)` : ''}</div>
                                      </div>
                                      <div>
                                        <div className="font-semibold text-gray-700 mb-1">Combined Note</div>
                                        <div className="text-gray-600 whitespace-pre-line">{batch.combinedBatchNote || '—'}</div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )
      )}

      {/* Add Course Modal */}
      <Modal open={showCourseModal} onClose={() => { setShowCourseModal(false); setCourseForm(EMPTY_COURSE); }} title="Add / Update Course" size="lg">
        <form onSubmit={submitCourse} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Course ID *</label>
              <select value={courseForm.courseId} onChange={e => {
                const id = e.target.value;
                setCourseForm(f => ({ ...f, courseId: id, name: COURSE_ID_LABELS[id] || f.name }));
              }} className="input" required>
                <option value="">Select Course ID</option>
                {COURSE_IDS.map(id => <option key={id} value={id}>{id.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Course Name *</label>
              <input value={courseForm.name} onChange={e => setCourseForm(f => ({ ...f, name: e.target.value }))} className="input" required placeholder="Full course name" />
            </div>
            <div>
              <label className="label">Short Name *</label>
              <input value={courseForm.shortName} onChange={e => setCourseForm(f => ({ ...f, shortName: e.target.value }))} className="input" required placeholder="e.g. AI Eng" />
            </div>
            <div>
              <label className="label">Duration *</label>
              <input value={courseForm.duration} onChange={e => setCourseForm(f => ({ ...f, duration: e.target.value }))} className="input" required placeholder="e.g. 6 months" />
            </div>
            <div>
              <label className="label">Total Hours</label>
              <input type="number" min="1" value={courseForm.totalHours} onChange={e => setCourseForm(f => ({ ...f, totalHours: e.target.value }))} className="input" placeholder="360" />
            </div>
            <div>
              <label className="label">Fees (₹) *</label>
              <input type="number" min="0" value={courseForm.fees} onChange={e => setCourseForm(f => ({ ...f, fees: e.target.value }))} className="input" required placeholder="75000" />
            </div>
            <div>
              <label className="label">Max Installments</label>
              <input type="number" min="1" max="12" value={courseForm.maxInstallments} onChange={e => setCourseForm(f => ({ ...f, maxInstallments: e.target.value }))} className="input" />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <label className="text-sm font-medium text-gray-700">EMI Available</label>
              <button type="button" onClick={() => setCourseForm(f => ({ ...f, emiAvailable: !f.emiAvailable }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${courseForm.emiAvailable ? 'bg-primary-600' : 'bg-gray-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${courseForm.emiAvailable ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          <div>
            <label className="label">Highlights</label>
            <div className="flex gap-2">
              <input value={highlightInput} onChange={e => setHighlightInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHighlight(); } }} className="input flex-1" placeholder="Add highlight and press Enter" />
              <button type="button" onClick={addHighlight} className="btn-secondary px-3">Add</button>
            </div>
            {courseForm.highlights.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {courseForm.highlights.map((h, i) => (
                  <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-medium">
                    ✓ {h}
                    <button type="button" onClick={() => setCourseForm(f => ({ ...f, highlights: f.highlights.filter((_, j) => j !== i) }))} className="ml-1 text-green-500 hover:text-red-500">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => { setShowCourseModal(false); setCourseForm(EMPTY_COURSE); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={courseMutation.isPending} className="btn-primary">{courseMutation.isPending ? 'Saving...' : 'Save Course'}</button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Batch Modal */}
      <Modal open={showBatchModal} onClose={() => { setShowBatchModal(false); setEditBatch(null); setBatchForm(EMPTY_BATCH); setBatchNameTouched(false); setSplitDateTouched(false); }} title={editBatch ? 'Edit Batch' : 'Add New Batch'} size="xl">
        <form onSubmit={submitBatch} className="p-5 space-y-5">
          {/* STEP 1 - Batch Type Selection */}
          <div>
            <label className="label">Batch Type *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBatchType(false)}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${!batchForm.isCombined ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="text-2xl mb-1">📚</div>
                <div className="font-semibold text-gray-900 text-sm">Single Course Batch</div>
                <div className="text-xs text-gray-500 mt-0.5">One course, standard batch</div>
              </button>
              <button
                type="button"
                onClick={() => setBatchType(true)}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${batchForm.isCombined ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="text-2xl mb-1">🔗</div>
                <div className="font-semibold text-gray-900 text-sm">Combined Course Batch</div>
                <div className="text-xs text-gray-500 mt-0.5">Multiple courses sharing same classes — perfect for joint modules</div>
              </button>
            </div>
          </div>

          {/* STEP 2 - Single course */}
          {!batchForm.isCombined && (
            <div>
              <label className="label">Course *</label>
              <select value={batchForm.courseId} onChange={e => setBatchForm(f => ({ ...f, courseId: e.target.value }))} className="input" required>
                <option value="">Select course</option>
                {(courses || []).map(c => <option key={c.id} value={c.id}>{c.shortName} — {c.name}</option>)}
              </select>
            </div>
          )}

          {/* STEP 2 - Combined course */}
          {batchForm.isCombined && (
            <div className="space-y-4 bg-purple-50/50 border border-purple-100 rounded-2xl p-4">
              <div>
                <label className="label">Primary Course *</label>
                <select
                  value={batchForm.courseId}
                  onChange={e => setBatchForm(f => ({ ...f, courseId: e.target.value, combinedCourseIds: f.combinedCourseIds.filter(cid => cid !== (courses || []).find(c => c.id === e.target.value)?.courseId) }))}
                  className="input"
                  required
                >
                  <option value="">Select main course</option>
                  {(courses || []).map(c => <option key={c.id} value={c.id}>{c.shortName} — {c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Additional Courses (sharing this batch) *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(courses || []).filter(c => c.id !== batchForm.courseId).map(c => (
                    <label key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm transition-colors ${batchForm.combinedCourseIds.includes(c.courseId) ? 'border-purple-400 bg-white text-purple-800 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <input
                        type="checkbox"
                        checked={batchForm.combinedCourseIds.includes(c.courseId)}
                        onChange={() => toggleAdditionalCourse(c.courseId)}
                        disabled={!batchForm.courseId}
                        className="accent-purple-600"
                      />
                      {batchForm.combinedCourseIds.includes(c.courseId) ? '✅' : ''} {c.name}
                    </label>
                  ))}
                </div>
                {!batchForm.courseId && <p className="text-xs text-gray-400 mt-1">Select a primary course first</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Combined for (months) *</label>
                  <input
                    type="number" min="1" max="24"
                    value={batchForm.splitAfterMonths}
                    onChange={e => setBatchForm(f => ({ ...f, splitAfterMonths: e.target.value }))}
                    className="input" placeholder="e.g. 2"
                  />
                  <p className="text-xs text-gray-500 mt-1">How many months will they study together?</p>
                </div>
                <div>
                  <label className="label">Split Date</label>
                  <input
                    type="date"
                    value={batchForm.splitDate}
                    onChange={e => { setBatchForm(f => ({ ...f, splitDate: e.target.value })); setSplitDateTouched(true); }}
                    className="input"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-calculated from start date, or set manually</p>
                </div>
              </div>

              <div>
                <label className="label">Note about combination</label>
                <textarea
                  value={batchForm.combinedBatchNote}
                  onChange={e => setBatchForm(f => ({ ...f, combinedBatchNote: e.target.value }))}
                  className="input min-h-20"
                  placeholder="Describe what they study together, e.g. First 2 months: Python basics, Data fundamentals shared. Month 3 onwards: separate tracks."
                />
              </div>
            </div>
          )}

          {/* STEP 3 - Common Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Batch Name *</label>
              <input value={batchForm.batchName} onChange={e => { setBatchForm(f => ({ ...f, batchName: e.target.value })); setBatchNameTouched(true); }} className="input" required placeholder="e.g. AI Batch 12" />
            </div>
          </div>

          {/* Mode toggle */}
          <div>
            <label className="label">Mode *</label>
            <div className="flex gap-2">
              {MODES.map(m => (
                <button type="button" key={m} onClick={() => setBatchForm(f => ({ ...f, mode: m }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all ${batchForm.mode === m ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {m === 'ONLINE' ? '🌐' : m === 'OFFLINE' ? '🏢' : '🔀'} {m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date *</label>
              <input type="date" value={batchForm.startDate} onChange={e => setBatchForm(f => ({ ...f, startDate: e.target.value }))} className="input" required />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" value={batchForm.endDate} onChange={e => setBatchForm(f => ({ ...f, endDate: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Timings *</label>
              <input value={batchForm.timings} onChange={e => setBatchForm(f => ({ ...f, timings: e.target.value }))} className="input" required placeholder="e.g. 9AM - 12PM" />
            </div>
            <div>
              <label className="label">Capacity</label>
              <input type="number" min="1" value={batchForm.capacity} onChange={e => setBatchForm(f => ({ ...f, capacity: e.target.value }))} className="input" />
            </div>
            {batchForm.mode !== 'ONLINE' && (
              <div>
                <label className="label">Venue</label>
                <input value={batchForm.venue} onChange={e => setBatchForm(f => ({ ...f, venue: e.target.value }))} className="input" placeholder="e.g. Kakkanad Branch" />
              </div>
            )}
            <div>
              <label className="label">Faculty Name</label>
              <input value={batchForm.facultyName} onChange={e => setBatchForm(f => ({ ...f, facultyName: e.target.value }))} className="input" placeholder="Trainer name" />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => { setShowBatchModal(false); setEditBatch(null); setBatchForm(EMPTY_BATCH); setBatchNameTouched(false); setSplitDateTouched(false); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={batchMutation.isPending} className="btn-primary">{batchMutation.isPending ? 'Saving...' : editBatch ? 'Update Batch' : 'Create Batch'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteBatch}
        onClose={() => setDeleteBatch(null)}
        onConfirm={() => deleteBatchMutation.mutate(deleteBatch?.id)}
        loading={deleteBatchMutation.isPending}
        danger
        title={`Delete batch — ${deleteBatch?.batchName}?`}
        message={`${deleteBatch?._count?.enrollments || 0} enrolled student${deleteBatch?._count?.enrollments === 1 ? '' : 's'} will keep their enrollment but lose this batch assignment. This cannot be undone.`}
        confirmLabel="Delete Batch"
      />
    </div>
  );
}
