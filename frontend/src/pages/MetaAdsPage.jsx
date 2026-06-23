import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, ArrowUpRight, Loader2, Plus, MessageCircle, Wifi, CheckCircle } from 'lucide-react';
import api from '../utils/api';
import { timeAgo } from '../utils/constants';
import { GradeBadge, LoadingState } from '../components/ui/index';
import toast from 'react-hot-toast';

const COURSES = [
  { value: 'AI_ENGINEERING', label: 'AI Engineering & Automation' },
  { value: 'DATA_SCIENCE_AI', label: 'Data Science with AI' },
  { value: 'AI_CYBERSECURITY', label: 'AI-Powered Cybersecurity' },
  { value: 'PYTHON_FULLSTACK', label: 'Python Full Stack with AI' },
  { value: 'VIBE_CODING_SAAS', label: 'Vibe Coding & SaaS Dev' },
  { value: 'DATA_ANALYTICS', label: 'Data Analytics' },
  { value: 'BUSINESS_ANALYTICS', label: 'Business Analytics' },
];

const INITIAL_FORM = { name: '', phone: '', source: 'FACEBOOK_ADS', interestedCourse: '', message: '' };

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(0);
  const frameRef = useRef(null);
  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const start = startRef.current;
    const end = Number(value) || 0;
    const duration = 800;
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
      else startRef.current = end;
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value]);
  return <>{display}</>;
}

export default function MetaAdsPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [successLead, setSuccessLead] = useState(null);
  const [duplicateLeadId, setDuplicateLeadId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [countdown, setCountdown] = useState(30);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const formRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['meta-stats', refreshKey],
    queryFn: () => api.get('/meta/stats').then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: leadsData, isLoading: leadsLoading, isFetching: leadsFetching, dataUpdatedAt } = useQuery({
    queryKey: ['meta-leads', refreshKey],
    queryFn: () => api.get('/meta/leads').then(r => r.data),
    refetchInterval: 30000,
  });

  const leads = leadsData?.leads || [];

  useEffect(() => {
    if (dataUpdatedAt) setLastUpdated(dataUpdatedAt);
  }, [dataUpdatedAt]);

  useEffect(() => {
    if (!lastUpdated) return;
    setCountdown(30);
    const t = setInterval(() => setCountdown(c => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [lastUpdated]);

  useEffect(() => {
    if (!lastUpdated) return;
    const t = setInterval(() => setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000)), 1000);
    return () => clearInterval(t);
  }, [lastUpdated]);

  const addLead = useMutation({
    mutationFn: (data) => api.post('/meta/whatsapp-lead', data).then(r => r.data),
    onSuccess: (lead) => {
      setSuccessLead(lead);
      setDuplicateLeadId(null);
      queryClient.invalidateQueries({ queryKey: ['meta-leads'] });
      queryClient.invalidateQueries({ queryKey: ['meta-stats'] });
      queryClient.invalidateQueries({ queryKey: ['meta-stats-dash'] });
      setTimeout(() => {
        setSuccessLead(null);
        setForm(INITIAL_FORM);
      }, 5000);
    },
    onError: (err) => {
      if (err.response?.status === 409) {
        setDuplicateLeadId(err.response.data.leadId);
      } else {
        toast.error(err.response?.data?.error || 'Failed to add lead');
      }
    },
  });

  const setField = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setSuccessLead(null);
    setDuplicateLeadId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Name and phone number are required');
      return;
    }
    addLead.mutate(form);
  };

  const STAT_CARDS = [
    {
      label: 'Facebook Leads Today',
      value: stats?.facebook_today ?? 0,
      icon: <span className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-white font-bold text-xl">f</span>,
      gradient: 'from-[#1877F2] to-[#166FE5]',
    },
    {
      label: 'Instagram Leads Today',
      value: stats?.instagram_today ?? 0,
      icon: <span className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg">📸</span>,
      gradient: 'from-[#E1306C] to-[#833AB4]',
    },
    {
      label: 'Total This Month',
      value: (stats?.facebook_month ?? 0) + (stats?.instagram_month ?? 0),
      icon: <span className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg">📅</span>,
      gradient: 'from-indigo-600 to-purple-600',
    },
    {
      label: 'All Time Total',
      value: stats?.total ?? 0,
      icon: <span className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg">🏆</span>,
      gradient: 'from-amber-500 to-yellow-400',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">Meta Ads — Facebook & Instagram</h1>
        <p className="text-gray-500 text-sm mt-1">Click-to-WhatsApp Campaign Lead Management</p>
        <div className="mt-2">
          <span className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-green-700">Live — receiving leads in real time</span>
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ label, value, icon, gradient }) => (
          <div key={label} className={`rounded-2xl p-5 bg-gradient-to-br ${gradient} text-white shadow-lg`}>
            <div className="flex items-center mb-2">{icon}</div>
            <div className="text-4xl font-bold mt-1">
              {statsLoading ? '—' : <AnimatedNumber value={value} />}
            </div>
            <div className="text-sm font-semibold mt-1 text-white/90">{label}</div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Add Lead form (60%) */}
        <div className="lg:col-span-3" ref={formRef}>
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-5 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Someone messaged from your ad?</h3>
                  <p className="text-green-100 text-sm">Add them to CRM instantly</p>
                </div>
              </div>
            </div>

            <div className="p-5">
              {successLead && (
                <div className="mb-5 bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-bold text-green-700">✅ Lead Added Successfully!</span>
                  </div>
                  <p className="text-sm text-green-700 mb-1">{successLead.name} has been added to CRM</p>
                  <p className="text-xs text-green-600 mb-3">🤖 AI is scoring this lead now...</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSuccessLead(null); setForm(INITIAL_FORM); }}
                      className="btn-secondary text-xs flex-1"
                    >
                      Add Another Lead
                    </button>
                    <Link
                      to={`/leads/${successLead.id}`}
                      className="btn-primary text-xs flex-1 flex items-center justify-center gap-1"
                    >
                      View Lead <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}

              {duplicateLeadId && (
                <div className="mb-5 bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <p className="font-bold text-orange-700 mb-2">⚠️ This number already exists in CRM</p>
                  <Link
                    to={`/leads/${duplicateLeadId}`}
                    className="text-sm text-orange-700 hover:text-orange-800 font-medium flex items-center gap-1 w-fit"
                  >
                    View existing lead <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Full Name *</label>
                    <input
                      className="input w-full"
                      value={form.name}
                      onChange={e => setField('name', e.target.value)}
                      placeholder="Customer's name"
                      required
                    />
                  </div>
                  <div>
                    <label className="label">WhatsApp Number *</label>
                    <input
                      className="input w-full"
                      value={form.phone}
                      onChange={e => setField('phone', e.target.value)}
                      placeholder="9876543210"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Ad Source</label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setField('source', 'FACEBOOK_ADS')}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                        form.source === 'FACEBOOK_ADS'
                          ? 'bg-[#1877F2] border-[#1877F2] text-white'
                          : 'border-gray-200 text-gray-600 hover:border-blue-300'
                      }`}
                    >
                      <span className="font-bold text-base">f</span> Facebook Ad
                    </button>
                    <button
                      type="button"
                      onClick={() => setField('source', 'INSTAGRAM')}
                      className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                        form.source === 'INSTAGRAM'
                          ? 'border-transparent text-white'
                          : 'border-gray-200 text-gray-600 hover:border-pink-300'
                      }`}
                      style={form.source === 'INSTAGRAM' ? { background: 'linear-gradient(135deg, #E1306C, #833AB4)' } : {}}
                    >
                      📸 Instagram Ad
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Course Interest</label>
                  <select
                    className="input w-full"
                    value={form.interestedCourse}
                    onChange={e => setField('interestedCourse', e.target.value)}
                  >
                    <option value="">Not specified</option>
                    {COURSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Their Message</label>
                  <textarea
                    className="input w-full resize-none"
                    rows={3}
                    value={form.message}
                    onChange={e => setField('message', e.target.value)}
                    placeholder="What did they say on WhatsApp? e.g. 'Hi I saw your ad, interested in AI course'"
                  />
                </div>

                <button
                  type="submit"
                  disabled={addLead.isPending}
                  className="w-full py-3 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
                >
                  {addLead.isPending
                    ? <><Loader2 className="w-5 h-5 animate-spin" />Adding...</>
                    : <>➕ Add to CRM</>
                  }
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right: Info cards (40%) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <h3 className="section-title mb-4">How it works</h3>
            <div className="space-y-3">
              {[
                { icon: '📱', step: 'Run Facebook/Instagram ad' },
                { icon: '💬', step: 'Customer messages on WhatsApp' },
                { icon: '➕', step: 'Add them here immediately' },
                { icon: '🤖', step: 'AI scores the lead automatically' },
                { icon: '📞', step: 'Follow up from CRM' },
              ].map(({ icon, step }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center text-base flex-shrink-0">{icon}</div>
                  <div>
                    <span className="text-xs font-semibold text-gray-400 mr-1.5">Step {i + 1}</span>
                    <span className="text-sm text-gray-700">{step}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="section-title mb-4">Connection Status</h3>
            <div className="space-y-0">
              {[
                ['Meta App', 'Connected ✅'],
                ['App ID', '1314736140263066'],
                ['Facebook', 'Connected'],
                ['Instagram', 'Connected'],
                ['Webhook', 'Active (for Lead Form ads)'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-400 font-medium">{k}</span>
                  <span className="text-xs font-medium text-gray-800">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-green-500" />
              <span className="text-xs text-green-600 font-semibold">Meta webhook active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Meta Leads */}
      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <h3 className="section-title">Recent Facebook & Instagram Leads</h3>
          <div className="flex items-center gap-3">
            {lastUpdated && !leadsFetching && (
              <span className="text-xs text-gray-400">Updated {secondsAgo}s ago</span>
            )}
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              disabled={leadsFetching}
              className="btn-secondary text-xs disabled:opacity-60 flex items-center gap-1.5"
            >
              {leadsFetching
                ? <><Loader2 className="w-3 h-3 animate-spin" />Refreshing...</>
                : <><RefreshCw className="w-3 h-3" />Refresh</>
              }
            </button>
          </div>
        </div>

        {leadsLoading ? (
          <LoadingState />
        ) : !leads.length ? (
          <div className="p-10 text-center text-gray-400">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No Meta leads yet.</p>
            <p className="text-xs mt-1">When someone messages from your ad, add them using the form above!</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Name', 'Phone', 'Course', 'Source', 'AI Grade', 'Added', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr key={lead.id} className="table-row">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{lead.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{lead.phone}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {lead.interestedCourse?.replace(/_/g, ' ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {lead.source === 'FACEBOOK_ADS' ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">📘 Facebook</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-pink-100 text-pink-700">📸 Instagram</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <GradeBadge grade={lead.aiGrade} score={lead.aiScore} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{timeAgo(lead.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/leads/${lead.id}`}
                          className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
                        >
                          View <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-400">Last 50 leads</span>
              <span className="text-xs text-gray-400">
                Auto-refreshes every 30 seconds · Next in {countdown}s
              </span>
            </div>
          </>
        )}
      </div>

      {/* Pro Tips */}
      <div className="card p-5">
        <h3 className="section-title mb-4">💡 Pro Tips for WhatsApp Lead Capture</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            'Add leads immediately while the conversation is fresh',
            'Note the course they mentioned in the message field',
            'AI will automatically score the lead within seconds',
            'Set a follow-up date right after adding the lead',
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
              <span className="w-6 h-6 bg-amber-500 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="text-sm text-amber-800">{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Quick Add button */}
      <button
        onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center hover:scale-110 transition-transform z-40"
        style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
        title="Quick Add Lead"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
