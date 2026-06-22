import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Phone, Calendar, CheckCircle } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const OUTCOMES = [
  { value: 'INTERESTED', label: '✅ Interested' },
  { value: 'NOT_INTERESTED', label: '❌ Not Interested' },
  { value: 'CALLBACK', label: '🔄 Call Back Later' },
  { value: 'NO_ANSWER', label: '📵 No Answer' },
  { value: 'WRONG_NUMBER', label: '🚫 Wrong Number' },
  { value: 'CONVERTED', label: '🎉 Converted' },
];

function getPresetDate(preset) {
  const d = new Date();
  if (preset === 'tomorrow') d.setDate(d.getDate() + 1);
  else if (preset === '3days') d.setDate(d.getDate() + 3);
  else if (preset === 'week') d.setDate(d.getDate() + 7);
  d.setHours(10, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function QuickCallModal({ lead, open, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/leads/${lead.id}/schedule-followup`, data).then(r => r.data),
    onSuccess: () => {
      toast.success('Call logged successfully!');
      queryClient.invalidateQueries({ queryKey: ['followups'] });
      queryClient.invalidateQueries({ queryKey: ['followup-sidebar-count'] });
      onSuccess?.();
      onClose();
      setOutcome(''); setNotes(''); setNextFollowUpAt('');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to save'),
  });

  if (!open || !lead) return null;

  const presets = [['Today', 'today'], ['Tomorrow', 'tomorrow'], ['3 Days', '3days'], ['Next Week', 'week']];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{lead.name}</h3>
            <a
              href={`tel:+91${lead.phone?.replace(/\D/g, '')}`}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-0.5 w-fit"
            >
              <Phone className="w-3.5 h-3.5" /> {lead.phone}
            </a>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Call Outcome</label>
            <select value={outcome} onChange={e => setOutcome(e.target.value)} className="input mt-1.5 w-full">
              <option value="">Select outcome...</option>
              {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="input mt-1.5 w-full resize-none"
              placeholder="What happened on this call..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Next Follow-up
            </label>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {presets.map(([label, preset]) => {
                const val = getPresetDate(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setNextFollowUpAt(val)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${nextFollowUpAt === val ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-primary-400 hover:text-primary-600'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <input
              type="datetime-local"
              value={nextFollowUpAt}
              onChange={e => setNextFollowUpAt(e.target.value)}
              className="input mt-2 w-full"
            />
          </div>
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => mutation.mutate({ outcome, notes, nextFollowUpAt })}
            disabled={mutation.isPending}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {mutation.isPending ? 'Saving...' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
