import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PhoneCall, Calendar, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import api from '../utils/api';
import { STATUS_COLORS } from '../utils/constants';
import { GradeBadge, LoadingState } from '../components/ui/index';
import toast from 'react-hot-toast';

const OUTCOMES = [
  { value: 'INTERESTED', label: '✅ Interested' },
  { value: 'NOT_INTERESTED', label: '❌ Not Interested' },
  { value: 'CALLBACK', label: '🔄 Call Back Later' },
  { value: 'NO_ANSWER', label: '📵 No Answer' },
  { value: 'WRONG_NUMBER', label: '🚫 Wrong Number' },
  { value: 'CONVERTED', label: '🎉 Converted' },
];

const COURSE_COLORS = {
  AI_ENGINEERING: 'bg-violet-100 text-violet-700',
  DATA_SCIENCE_AI: 'bg-blue-100 text-blue-700',
  AI_CYBERSECURITY: 'bg-red-100 text-red-700',
  PYTHON_FULLSTACK: 'bg-green-100 text-green-700',
  MERN_STACK: 'bg-pink-100 text-pink-700',
  DATA_ANALYTICS: 'bg-orange-100 text-orange-700',
  BUSINESS_ANALYTICS: 'bg-teal-100 text-teal-700',
};

function getPresetDate(preset) {
  const d = new Date();
  if (preset === 'tomorrow') d.setDate(d.getDate() + 1);
  else if (preset === '3days') d.setDate(d.getDate() + 3);
  else if (preset === 'week') d.setDate(d.getDate() + 7);
  d.setHours(10, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

function daysOverdue(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function EmptyState({ period }) {
  const config = {
    overdue: { emoji: '🎉', text: 'Great job! No overdue follow-ups', sub: "You're all caught up!", cls: 'bg-green-50 border-green-200 text-green-700' },
    today: { emoji: '📋', text: 'No follow-ups scheduled for today', sub: 'Plan your calls for the day', cls: 'bg-blue-50 border-blue-200 text-blue-700' },
    tomorrow: { emoji: '📅', text: 'Nothing scheduled for tomorrow', sub: 'Plan your calls in advance!', cls: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
    week: { emoji: '📆', text: 'No follow-ups this week', sub: 'Schedule some calls to stay on track', cls: 'bg-purple-50 border-purple-200 text-purple-700' },
  }[period] || {};
  return (
    <div className={`rounded-xl p-10 text-center border ${config.cls}`}>
      <div className="text-5xl mb-3">{config.emoji}</div>
      <div className="font-bold text-lg">{config.text}</div>
      <div className="text-sm mt-1 opacity-75">{config.sub}</div>
    </div>
  );
}

function LeadCard({ lead, period, expanded, onToggle, formState, onFormChange, onSave, onReschedule, isSaving }) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');

  const handleToggleCalled = () => {
    setRescheduleOpen(false);
    onToggle();
  };
  const handleToggleReschedule = () => {
    if (expanded) onToggle();
    setRescheduleOpen(r => !r);
  };

  const isOverdue = period === 'overdue';
  const borderCls = {
    overdue: 'border-l-red-500 bg-red-50/40',
    today: 'border-l-orange-500 bg-orange-50/30',
    tomorrow: 'border-l-blue-500 bg-blue-50/30',
    week: 'border-l-green-500 bg-green-50/20',
  }[period] || 'border-l-gray-300';

  const courseColor = COURSE_COLORS[lead.interestedCourse] || 'bg-gray-100 text-gray-700';
  const days = isOverdue && lead.nextFollowUpAt ? daysOverdue(lead.nextFollowUpAt) : 0;
  const followUpDateLabel = lead.nextFollowUpAt
    ? new Date(lead.nextFollowUpAt).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const presetShort = [['Today', 'today'], ['Tomorrow', 'tomorrow'], ['+3d', '3days'], ['+1w', 'week']];
  const presetsLong = [['Today', 'today'], ['Tomorrow', 'tomorrow'], ['In 3 Days', '3days'], ['Next Week', 'week']];

  return (
    <div className={`rounded-xl border border-gray-200 border-l-4 ${borderCls} overflow-hidden transition-shadow hover:shadow-md`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Left: Lead info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {lead.aiGrade === 'HOT' && <span className="text-base">🔥</span>}
              <span className="font-bold text-gray-900 text-base leading-tight">{lead.name}</span>
              {lead.city && <span className="text-xs text-gray-400">📍 {lead.city}</span>}
            </div>
            <a
              href={`tel:+91${lead.phone?.replace(/\D/g, '')}`}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mt-1 w-fit"
            >
              <PhoneCall className="w-3.5 h-3.5" /> {lead.phone}
            </a>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {lead.interestedCourse && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${courseColor}`}>
                  {lead.interestedCourse.replace(/_/g, ' ')}
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-700'}`}>
                {lead.status}
              </span>
              {isOverdue && days > 0 && (
                <span className="text-xs text-red-600 font-semibold flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /> {days}d overdue
                </span>
              )}
              {followUpDateLabel && (
                <span className="text-xs text-gray-500 flex items-center gap-0.5">
                  <Calendar className="w-3 h-3" /> {followUpDateLabel}
                </span>
              )}
            </div>
          </div>

          {/* Middle: Grade */}
          <div className="flex-shrink-0 pt-0.5">
            <GradeBadge grade={lead.aiGrade} score={lead.aiScore} />
          </div>

          {/* Right: Action buttons */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button
              onClick={handleToggleCalled}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                expanded ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {expanded ? 'Close' : 'Mark Called'}
            </button>
            <button
              onClick={handleToggleReschedule}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                rescheduleOpen ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Reschedule
            </button>
            <Link
              to={`/leads/${lead.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Lead
            </Link>
          </div>
        </div>
      </div>

      {/* Mark Called inline form */}
      {expanded && (
        <div className="border-t border-gray-100 bg-white p-4 space-y-3">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Log Call Result</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Outcome</label>
              <select value={formState.outcome || ''} onChange={e => onFormChange('outcome', e.target.value)} className="input w-full text-sm">
                <option value="">Select outcome...</option>
                {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Next Follow-up</label>
              <div className="flex gap-1 flex-wrap mb-1.5">
                {presetShort.map(([lbl, preset]) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onFormChange('nextFollowUpAt', getPresetDate(preset))}
                    className="text-xs px-2 py-1 rounded-lg border border-gray-200 hover:border-primary-400 hover:text-primary-600 text-gray-600 transition-colors"
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <input
                type="datetime-local"
                value={formState.nextFollowUpAt || ''}
                onChange={e => onFormChange('nextFollowUpAt', e.target.value)}
                className="input w-full text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Notes</label>
            <textarea
              value={formState.notes || ''}
              onChange={e => onFormChange('notes', e.target.value)}
              rows={2}
              className="input w-full text-sm resize-none"
              placeholder="What happened on this call..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={handleToggleCalled} className="btn-secondary text-xs">Cancel</button>
            <button onClick={onSave} disabled={isSaving} className="btn-primary text-xs flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save & Close'}
            </button>
          </div>
        </div>
      )}

      {/* Quick Reschedule inline form */}
      {rescheduleOpen && (
        <div className="border-t border-gray-100 bg-blue-50/50 p-4 space-y-3">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Quick Reschedule</div>
          <div className="flex gap-2 flex-wrap">
            {presetsLong.map(([lbl, preset]) => (
              <button
                key={preset}
                type="button"
                onClick={() => { onReschedule(getPresetDate(preset)); setRescheduleOpen(false); }}
                className="text-xs px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 font-medium hover:bg-blue-100 transition-colors"
              >
                {lbl}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={rescheduleDate}
              onChange={e => setRescheduleDate(e.target.value)}
              className="input flex-1 text-sm"
            />
            <button
              onClick={() => { if (rescheduleDate) { onReschedule(rescheduleDate); setRescheduleOpen(false); } }}
              className="btn-primary text-xs px-4"
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FollowUpsPage() {
  const [activeTab, setActiveTab] = useState('overdue');
  const [expandedId, setExpandedId] = useState(null);
  const [formState, setFormState] = useState({});
  const queryClient = useQueryClient();

  const { data: overdueData, isLoading: overdueLoading } = useQuery({
    queryKey: ['followups', 'overdue'],
    queryFn: () => api.get('/leads/followups?period=overdue').then(r => r.data),
    refetchInterval: 60000,
  });
  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ['followups', 'today'],
    queryFn: () => api.get('/leads/followups?period=today').then(r => r.data),
    refetchInterval: 60000,
  });
  const { data: tomorrowData, isLoading: tomorrowLoading } = useQuery({
    queryKey: ['followups', 'tomorrow'],
    queryFn: () => api.get('/leads/followups?period=tomorrow').then(r => r.data),
    refetchInterval: 60000,
  });
  const { data: weekData, isLoading: weekLoading } = useQuery({
    queryKey: ['followups', 'week'],
    queryFn: () => api.get('/leads/followups?period=week').then(r => r.data),
    refetchInterval: 60000,
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ id, data }) => api.post(`/leads/${id}/schedule-followup`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      toast.success('Follow-up logged!');
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      queryClient.invalidateQueries({ queryKey: ['followup-sidebar-count'] });
      setExpandedId(null);
      setFormState(prev => { const n = { ...prev }; delete n[id]; return n; });
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed to save'),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, nextFollowUpAt }) => api.post(`/leads/${id}/schedule-followup`, { nextFollowUpAt }).then(r => r.data),
    onSuccess: () => {
      toast.success('Rescheduled!');
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      queryClient.invalidateQueries({ queryKey: ['followup-sidebar-count'] });
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed to reschedule'),
  });

  const TABS = [
    { key: 'overdue', label: '🔴 Overdue', count: overdueData?.count ?? 0, data: overdueData?.leads, loading: overdueLoading, badgeCls: 'bg-red-500 text-white' },
    { key: 'today', label: '📞 Today', count: todayData?.count ?? 0, data: todayData?.leads, loading: todayLoading, badgeCls: 'bg-orange-500 text-white' },
    { key: 'tomorrow', label: '📅 Tomorrow', count: tomorrowData?.count ?? 0, data: tomorrowData?.leads, loading: tomorrowLoading, badgeCls: 'bg-blue-500 text-white' },
    { key: 'week', label: '📆 This Week', count: weekData?.count ?? 0, data: weekData?.leads, loading: weekLoading, badgeCls: 'bg-green-500 text-white' },
  ];

  const STAT_CARDS = [
    { label: 'Overdue Follow-ups', count: overdueData?.count ?? 0, sub: 'Needs immediate attention', gradient: 'from-red-500 to-rose-600', icon: '⚠️' },
    { label: 'Call Today', count: todayData?.count ?? 0, sub: 'Scheduled for today', gradient: 'from-orange-500 to-amber-500', icon: '📞' },
    { label: "Tomorrow's List", count: tomorrowData?.count ?? 0, sub: 'Prepare in advance', gradient: 'from-blue-500 to-indigo-600', icon: '📅' },
    { label: 'This Week', count: weekData?.count ?? 0, sub: 'Upcoming follow-ups', gradient: 'from-green-500 to-emerald-600', icon: '📆' },
  ];

  const activeTabData = TABS.find(t => t.key === activeTab);

  function handleFormChange(id, field, value) {
    setFormState(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  }

  function handleSave(lead) {
    scheduleMutation.mutate({ id: lead.id, data: formState[lead.id] || {} });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2">
          <PhoneCall className="w-6 h-6 text-primary-600" />
          <h1 className="page-title">Follow-up Management</h1>
        </div>
        <p className="text-gray-500 text-sm mt-1">Track and manage all your lead follow-ups — never miss a call</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ label, count, sub, gradient, icon }) => (
          <button
            key={label}
            onClick={() => setActiveTab(TABS[STAT_CARDS.indexOf(STAT_CARDS.find(c => c.label === label))].key)}
            className={`rounded-2xl p-5 bg-gradient-to-br ${gradient} text-white shadow-lg text-left hover:shadow-xl transition-shadow cursor-pointer`}
          >
            <div className="text-2xl mb-2">{icon}</div>
            <div className="text-4xl font-bold">{count}</div>
            <div className="text-sm font-semibold mt-1 text-white/90">{label}</div>
            <div className="text-xs text-white/70 mt-1">{sub}</div>
          </button>
        ))}
      </div>

      {/* Tabs + Lead Cards */}
      <div className="card overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-700 bg-primary-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === tab.key ? tab.badgeCls : 'bg-gray-100 text-gray-600'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3 min-h-[200px]">
          {activeTabData?.loading ? (
            <LoadingState />
          ) : !activeTabData?.data?.length ? (
            <EmptyState period={activeTab} />
          ) : (
            activeTabData.data.map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                period={activeTab}
                expanded={expandedId === lead.id}
                onToggle={() => setExpandedId(expandedId === lead.id ? null : lead.id)}
                formState={formState[lead.id] || {}}
                onFormChange={(field, value) => handleFormChange(lead.id, field, value)}
                onSave={() => handleSave(lead)}
                onReschedule={(nextFollowUpAt) => rescheduleMutation.mutate({ id: lead.id, nextFollowUpAt })}
                isSaving={scheduleMutation.isPending && scheduleMutation.variables?.id === lead.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
