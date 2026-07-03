import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Phone, Mail, MapPin, ArrowLeft, Bot, Send, MessageSquare, CheckSquare, Clock, Plus, Loader2, Sparkles, GraduationCap, CreditCard, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import { COURSES, fmt, fmtDate, fmtDatetime, timeAgo } from '../../utils/constants';
import { GradeBadge, StatusBadge, Modal, Textarea, LoadingState, ConfirmDialog } from '../../components/ui/index';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

function AIPanel({ lead, onScore }) {
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [asking, setAsking] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedReply, setSuggestedReply] = useState('');

  const askAI = async () => {
    if (!chatInput.trim()) return;
    const q = chatInput;
    setChatInput('');
    setChatHistory(h => [...h, { role: 'user', text: q }]);
    setAsking(true);
    try {
      const { data } = await api.post('/ai/chat', { question: `About lead ${lead.name}: ${q}` });
      setChatHistory(h => [...h, { role: 'ai', text: data.response }]);
    } catch (e) { toast.error('AI unavailable'); } finally { setAsking(false); }
  };

  const suggestReply = async () => {
    setSuggesting(true);
    try {
      const { data } = await api.post(`/ai/suggest-reply/${lead.id}`, { context: 'Follow-up call' });
      setSuggestedReply(data.reply);
    } catch { toast.error('AI unavailable'); } finally { setSuggesting(false); }
  };

  return (
    <div className="card h-full flex flex-col">
      <div className="card-header flex items-center gap-2">
        <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center"><Bot className="w-4 h-4 text-purple-600" /></div>
        <span className="section-title">Nexora AI Agent</span>
      </div>
      {/* AI Score */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">AI Score</span>
          <GradeBadge grade={lead.aiGrade} score={lead.aiScore} />
        </div>
        {lead.aiSummary && <p className="text-xs text-gray-600 mb-2">{lead.aiSummary}</p>}
        {lead.aiNextAction && <div className="bg-white rounded-lg p-2 border border-purple-100"><span className="text-xs font-semibold text-purple-700">Next: </span><span className="text-xs text-gray-600">{lead.aiNextAction}</span></div>}
        <button onClick={onScore} className="mt-2 w-full text-xs bg-purple-600 text-white rounded-lg py-1.5 hover:bg-purple-700 transition-colors flex items-center justify-center gap-1"><Sparkles className="w-3 h-3" />Re-score with AI</button>
      </div>
      {/* Chat */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-32 max-h-48">
        {chatHistory.length === 0 && <p className="text-xs text-gray-400 text-center pt-4">Ask AI anything about this lead...</p>}
        {chatHistory.map((m, i) => (
          <div key={i} className={`text-xs rounded-xl p-2.5 ${m.role === 'user' ? 'bg-primary-50 text-primary-900 ml-6' : 'bg-gray-100 text-gray-800 mr-6'}`}>{m.text}</div>
        ))}
        {asking && <div className="bg-gray-100 rounded-xl p-2.5 text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Thinking...</div>}
      </div>
      <div className="p-3 border-t border-gray-100 flex gap-2">
        <input className="input text-xs flex-1 py-2" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAI()} placeholder="Ask about this lead..." />
        <button onClick={askAI} className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Send className="w-3 h-3" /></button>
      </div>
      {/* Suggest reply */}
      <div className="p-3 pt-0">
        <button onClick={suggestReply} disabled={suggesting} className="w-full btn-secondary text-xs py-2 justify-center">
          {suggesting ? <><Loader2 className="w-3 h-3 animate-spin" />Generating...</> : <><MessageSquare className="w-3 h-3" />Suggest WhatsApp Reply</>}
        </button>
        {suggestedReply && (
          <div className="mt-2 bg-green-50 rounded-xl p-3 text-xs text-gray-700 border border-green-100">
            <div className="font-semibold text-green-700 mb-1">Suggested Message:</div>
            {suggestedReply}
          </div>
        )}
      </div>
    </div>
  );
}

function EnrollModal({ open, onClose, leadId, interestedCourse }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [courseFee, setCourseFee] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountReason, setDiscountReason] = useState('');
  const [installments, setInstallments] = useState('1');

  const { data: courses } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.get('/courses').then(r => r.data),
    enabled: open,
  });

  const { data: batches } = useQuery({
    queryKey: ['course-batches', courseId],
    queryFn: () => api.get(`/courses/${courseId}/batches`).then(r => r.data),
    enabled: open && !!courseId,
  });

  useEffect(() => {
    if (!open) return;
    if (courses?.length && interestedCourse) {
      const found = courses.find(c => c.courseId === interestedCourse);
      if (found) {
        setCourseId(found.id);
        setCourseFee(String(found.fees));
        setBatchId('');
        return;
      }
    }
    setCourseId('');
    setCourseFee('');
    setBatchId('');
  }, [open, courses, interestedCourse]);

  const netFee = Math.max(0, (Number(courseFee) || 0) - (Number(discountAmount) || 0));

  const handleCourseChange = (id) => {
    setCourseId(id);
    setBatchId('');
    const selected = courses?.find(c => c.id === id);
    if (selected) setCourseFee(String(selected.fees));
    else setCourseFee('');
  };

  const mutation = useMutation({
    mutationFn: (data) => api.post('/enrollments', data).then(r => r.data),
    onSuccess: (data) => {
      toast.success('Student Enrolled Successfully!');
      qc.invalidateQueries(['lead', leadId]);
      qc.invalidateQueries(['enrollments']);
      onClose();
      navigate(`/students/${data.id}`);
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Enrollment failed'),
  });

  const handleClose = () => {
    if (mutation.isPending) return;
    setCourseId(''); setCourseFee(''); setDiscountAmount('0');
    setDiscountReason(''); setInstallments('1'); setBatchId('');
    onClose();
  };

  const handleSubmit = () => {
    if (!courseId) return toast.error('Please select a course');
    if (!courseFee || Number(courseFee) <= 0) return toast.error('Course fee is required');
    mutation.mutate({
      leadId,
      courseId,
      batchId: batchId || undefined,
      courseFee: Number(courseFee),
      discountAmount: Number(discountAmount) || 0,
      discountReason: discountReason || undefined,
      installments: Number(installments),
      netFee,
    });
  };

  return (
    <Modal open={open} onClose={handleClose} title="Enroll Student" size="lg">
      <div className="p-5 space-y-4">
        <div>
          <label className="label">Course *</label>
          <select className="input" value={courseId} onChange={e => handleCourseChange(e.target.value)}>
            <option value="">Select a course...</option>
            {(courses || []).map(c => (
              <option key={c.id} value={c.id}>{c.name} — ₹{(c.fees || 0).toLocaleString('en-IN')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Batch (optional)</label>
          {!courseId ? (
            <p className="text-sm text-gray-400">Select a course first</p>
          ) : !batches?.length ? (
            <p className="text-sm text-gray-400">No active batches for this course</p>
          ) : (
            <div className="space-y-2">
              {(batches || []).map(b => {
                const remaining = Math.max(0, (b.capacity || 0) - (b._count?.enrollments || 0));
                const selected = batchId === b.id;
                const modeColors = { ONLINE: 'bg-blue-100 text-blue-700', OFFLINE: 'bg-green-100 text-green-700', HYBRID: 'bg-purple-100 text-purple-700' };
                return (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => setBatchId(selected ? '' : b.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900">{b.batchName}</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${modeColors[b.mode] || 'bg-gray-100 text-gray-700'}`}>{b.mode}</span>
                        {b.isCombined && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">🔗 Combined</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Starts {b.startDate ? new Date(b.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} · {b.timings}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {remaining > 0 ? `${remaining} seats remaining` : 'Batch full'} · Capacity {b.capacity}
                    </div>
                    {b.isCombined && (
                      <div className="mt-2 bg-purple-50 border border-purple-100 rounded-lg px-2.5 py-1.5">
                        <div className="text-xs text-purple-700">
                          Shared with: {(b.combinedCourseDetails || []).map(c => c.name).join(', ') || '—'}
                          {b.splitAfterMonths ? ` (first ${b.splitAfterMonths} month${b.splitAfterMonths > 1 ? 's' : ''})` : ''}
                        </div>
                        {b.splitDate && (
                          <div className="text-xs text-purple-600 mt-0.5">Splits into separate batches on {new Date(b.splitDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Course Fee (₹) *</label>
            <input className="input" type="number" value={courseFee} onChange={e => setCourseFee(e.target.value)} placeholder="75000" min="0" />
          </div>
          <div>
            <label className="label">Discount Amount (₹)</label>
            <input className="input" type="number" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} placeholder="0" min="0" />
          </div>
        </div>

        {Number(discountAmount) > 0 && (
          <div>
            <label className="label">Discount Reason</label>
            <input className="input" value={discountReason} onChange={e => setDiscountReason(e.target.value)} placeholder="Scholarship / Referral / Early bird / etc." />
          </div>
        )}

        <div>
          <label className="label">Number of Installments</label>
          <select className="input" value={installments} onChange={e => setInstallments(e.target.value)}>
            <option value="1">Full Payment (1 installment)</option>
            {Array.from({ length: 11 }, (_, i) => i + 2).map(n => (
              <option key={n} value={n}>{n} Installments</option>
            ))}
          </select>
        </div>

        {/* Net fee summary card */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Course Fee</span>
            <span className="font-semibold">₹{(Number(courseFee) || 0).toLocaleString('en-IN')}</span>
          </div>
          {Number(discountAmount) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-red-600">Discount</span>
              <span className="text-red-600 font-medium">− ₹{(Number(discountAmount) || 0).toLocaleString('en-IN')}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-indigo-200">
            <span className="font-bold text-indigo-900">Net Fee</span>
            <span className="text-xl font-bold text-indigo-900">₹{netFee.toLocaleString('en-IN')}</span>
          </div>
          {Number(installments) > 1 && netFee > 0 && (
            <p className="text-xs text-indigo-600 text-right">
              ≈ ₹{Math.ceil(netFee / Number(installments)).toLocaleString('en-IN')} × {installments} installments
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button className="btn-secondary" onClick={handleClose} disabled={mutation.isPending}>Cancel</button>
          <button className="btn-gold" onClick={handleSubmit} disabled={mutation.isPending || !courseId}>
            {mutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" />Enrolling...</>
              : <><GraduationCap className="w-4 h-4" />Confirm Enrollment</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);
  const [noteText, setNoteText] = useState('');
  const [showEnroll, setShowEnroll] = useState(false);
  const [tab, setTab] = useState('timeline');
  const [showDeleteLead, setShowDeleteLead] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState(null);

  const { data: lead, isLoading } = useQuery({ queryKey: ['lead', id], queryFn: () => api.get(`/leads/${id}`).then(r => r.data) });
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => api.get('/courses').then(r => r.data) });

  const addNote = useMutation({
    mutationFn: () => api.post(`/leads/${id}/notes`, { content: noteText }),
    onSuccess: () => { toast.success('Note added'); qc.invalidateQueries(['lead', id]); setNoteText(''); },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: () => api.delete(`/leads/${id}`),
    onSuccess: () => { toast.success('Lead deleted'); navigate('/leads'); },
    onError: (e) => { toast.error(e?.response?.data?.error || 'Delete failed'); setShowDeleteLead(false); },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId) => api.delete(`/leads/${id}/notes/${noteId}`),
    onSuccess: () => { toast.success('Note deleted'); qc.invalidateQueries(['lead', id]); setDeleteNoteId(null); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to delete note'),
  });

  const rescoreAI = useMutation({
    mutationFn: () => api.post(`/ai/score/${id}`),
    onSuccess: () => { toast.success('AI re-scoring complete!'); qc.invalidateQueries(['lead', id]); },
    onError: () => toast.error('AI offline'),
  });

  const sendWhatsApp = useMutation({
    mutationFn: (msg) => api.post('/whatsapp/send', { leadId: id, message: msg }),
    onSuccess: () => { toast.success('WhatsApp message sent!'); qc.invalidateQueries(['lead', id]); },
  });

  const updateStatus = async (status) => {
    await api.patch(`/leads/${id}`, { status });
    qc.invalidateQueries(['lead', id]);
    toast.success(`Status → ${status}`);
  };

  if (isLoading) return <LoadingState />;
  if (!lead) return <div className="text-center py-20 text-gray-500">Lead not found</div>;

  const timeline = [...(lead.notes || []).map(n => ({ ...n, type: 'note', at: n.createdAt })), ...(lead.calls || []).map(c => ({ ...c, type: 'call', at: c.calledAt })), ...(lead.activities || []).map(a => ({ ...a, type: 'activity', at: a.createdAt }))].sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <div className="space-y-5 animate-fade-in max-w-7xl mx-auto">
      {/* Back + header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 mt-1 flex-shrink-0"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="page-title">{lead.name}</h1>
                <StatusBadge status={lead.status} />
                <GradeBadge grade={lead.aiGrade} score={lead.aiScore} />
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-sm text-gray-500"><Phone className="w-4 h-4" />{lead.phone}</span>
                {lead.email && <span className="flex items-center gap-1 text-sm text-gray-500"><Mail className="w-4 h-4" />{lead.email}</span>}
                {lead.city && <span className="flex items-center gap-1 text-sm text-gray-500"><MapPin className="w-4 h-4" />{lead.city}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
              <select className="input w-auto text-sm" value={lead.status} onChange={e => updateStatus(e.target.value)}>
                {['NEW','CONTACTED','QUALIFIED','DEMO_SCHEDULED','PROPOSAL_SENT','NEGOTIATION','NURTURING','WON','LOST'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
              {!lead.enrollment && (
                <button onClick={() => setShowEnroll(true)} className="btn-gold text-sm">
                  <GraduationCap className="w-4 h-4" />Enroll
                </button>
              )}
              {lead.enrollment && (
                <Link to={`/students/${lead.enrollment.id}`} className="btn-primary text-sm">
                  <CreditCard className="w-4 h-4" />View Enrollment
                </Link>
              )}
              {isAdmin && !lead.enrollment && (
                <button onClick={() => setShowDeleteLead(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors">
                  <Trash2 className="w-4 h-4" />Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Info + Timeline */}
        <div className="lg:col-span-2 space-y-5">
          {/* Lead info */}
          <div className="card">
            <div className="card-header"><h3 className="section-title">Lead Details</h3></div>
            <div className="card-body grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                ['Course Interest', lead.interestedCourse ? COURSES[lead.interestedCourse] : '—'],
                ['Lead Source', lead.source?.replace(/_/g, ' ')],
                ['Budget', lead.budget ? fmt(lead.budget) : '—'],
                ['Expected Join', fmtDate(lead.expectedJoinDate)],
                ['Next Follow-up', fmtDate(lead.nextFollowUpAt)],
                ['Assigned To', lead.assignedTo?.name || '—'],
                ['First Contact', fmtDate(lead.firstContactAt)],
                ['Last Contact', fmtDate(lead.lastContactAt)],
                ['Added On', fmtDate(lead.createdAt)],
              ].map(([l, v]) => (
                <div key={l}>
                  <div className="text-xs text-gray-400 font-medium">{l}</div>
                  <div className="text-sm text-gray-800 font-medium mt-0.5">{v || '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="card">
            <div className="border-b border-gray-100">
              <div className="flex">
                {[['timeline', 'Timeline'], ['whatsapp', 'WhatsApp'], ['tasks', 'Tasks']].map(([k, l]) => (
                  <button key={k} onClick={() => setTab(k)} className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === k ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="p-4">
              {tab === 'timeline' && (
                <div className="space-y-3">
                  {/* Add note */}
                  <div className="flex gap-2">
                    <Textarea className="flex-1" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." rows={2} />
                    <button onClick={() => addNote.mutate()} disabled={!noteText || addNote.isPending} className="btn-primary self-start"><Plus className="w-4 h-4" /></button>
                  </div>
                  {/* Timeline */}
                  <div className="space-y-2 mt-3">
                    {timeline.map((item, i) => (
                      <div key={i} className="flex gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${item.type === 'note' ? 'bg-blue-100 text-blue-600' : item.type === 'call' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                          {item.type === 'note' ? '📝' : item.type === 'call' ? '📞' : '⚡'}
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-xl p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm text-gray-800 flex-1">{item.content || item.outcome || item.action?.replace(/_/g, ' ')}</div>
                            {item.type === 'note' && (isAdmin || item.authorId === user?.id) && (
                              <button onClick={() => setDeleteNoteId(item.id)} className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 p-0.5">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{item.author?.name || item.calledBy?.name || 'System'} • {timeAgo(item.at)}</div>
                        </div>
                      </div>
                    ))}
                    {timeline.length === 0 && <p className="text-center text-sm text-gray-400 py-6">No activity yet. Add a note!</p>}
                  </div>
                </div>
              )}
              {tab === 'whatsapp' && (
                <div className="space-y-3">
                  {(lead.whatsappMessages || []).map(msg => (
                    <div key={msg.id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 text-sm">💬</div>
                      <div className="flex-1 bg-gray-50 rounded-xl p-3">
                        <div className="text-sm text-gray-800 whitespace-pre-line">{msg.body}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${msg.status === 'DELIVERED' || msg.status === 'READ' ? 'bg-green-100 text-green-700' : msg.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{msg.status}</span>
                          <span className="text-xs text-gray-400">{timeAgo(msg.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!(lead.whatsappMessages?.length) && <p className="text-center text-sm text-gray-400 py-6">No WhatsApp messages yet</p>}
                </div>
              )}
              {tab === 'tasks' && (
                <div className="space-y-2">
                  {(lead.tasks || []).map(task => (
                    <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className={`w-2 h-2 rounded-full ${task.priority === 'HIGH' || task.priority === 'URGENT' ? 'bg-red-500' : task.priority === 'MEDIUM' ? 'bg-orange-500' : 'bg-gray-400'}`} />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-800">{task.title}</div>
                        <div className="text-xs text-gray-400">Due: {fmtDate(task.dueAt)}</div>
                      </div>
                      <StatusBadge status={task.status} />
                    </div>
                  ))}
                  {!(lead.tasks?.length) && <p className="text-center text-sm text-gray-400 py-6">No tasks for this lead</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: AI Panel */}
        <div className="space-y-5">
          <AIPanel lead={lead} onScore={() => rescoreAI.mutate()} />
          {/* Enrollment summary if exists */}
          {lead.enrollment && (
            <div className="card">
              <div className="card-header"><h3 className="section-title">Enrollment</h3></div>
              <div className="card-body space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Course</span><span className="font-medium">{lead.enrollment.course?.name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Net Fee</span><span className="font-medium">{fmt(lead.enrollment.netFee)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Paid</span><span className="font-semibold text-green-600">{fmt(lead.enrollment.paidAmount)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Balance</span><span className={`font-semibold ${lead.enrollment.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>{lead.enrollment.balanceDue > 0 ? fmt(lead.enrollment.balanceDue) : 'Fully Paid ✅'}</span></div>
                <StatusBadge status={lead.enrollment.paymentStatus} />
              </div>
            </div>
          )}
        </div>
      </div>

      <EnrollModal
        open={showEnroll}
        onClose={() => setShowEnroll(false)}
        leadId={lead.id}
        interestedCourse={lead.interestedCourse}
      />
      <ConfirmDialog
        open={showDeleteLead}
        onClose={() => setShowDeleteLead(false)}
        onConfirm={() => deleteLeadMutation.mutate()}
        loading={deleteLeadMutation.isPending}
        danger
        title={`Delete lead — ${lead.name}?`}
        message={`Phone: ${lead.phone}\n\nThis will permanently delete the lead and all associated notes, tasks, and call logs. This cannot be undone.`}
        confirmLabel="Delete Lead"
      />
      <ConfirmDialog
        open={!!deleteNoteId}
        onClose={() => setDeleteNoteId(null)}
        onConfirm={() => deleteNoteMutation.mutate(deleteNoteId)}
        loading={deleteNoteMutation.isPending}
        danger
        title="Delete note?"
        message="This note will be permanently deleted."
        confirmLabel="Delete Note"
      />
    </div>
  );
}
