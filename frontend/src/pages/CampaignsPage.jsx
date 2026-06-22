import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Plus, Send, Bot, Loader2, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../utils/api';
import { fmtDate, COURSES } from '../utils/constants';
import { Modal, Input, Select, LoadingState, EmptyState } from '../components/ui/index';
import toast from 'react-hot-toast';

const GRADE_OPTS = [
  { value: '', label: 'All Grades' },
  { value: 'HOT', label: '🔥 Hot Leads' },
  { value: 'WARM', label: '🌡️ Warm Leads' },
  { value: 'COLD', label: '🧊 Cold Leads' },
];
const COURSE_OPTS = [{ value: '', label: 'All Courses' }, ...Object.entries(COURSES).map(([k, v]) => ({ value: k, label: v }))];

function CreateCampaignModal({ open, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', description: '', targetGrade: '', targetCourse: '', messageTemplate: '' });
  const [generatingMsg, setGeneratingMsg] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const generateMessage = async () => {
    setGeneratingMsg(true);
    try {
      const { data } = await api.post('/ai/chat', {
        question: `Write a professional WhatsApp campaign message for Future Optima IT Solutions targeting ${form.targetGrade || 'all'} leads${form.targetCourse ? ` interested in ${COURSES[form.targetCourse]}` : ''}. The message should be warm, compelling, max 100 words. Use {name} for personalization. Include a clear call to action. No markdown.`
      });
      set('messageTemplate', data.response);
    } catch { toast.error('AI offline'); } finally { setGeneratingMsg(false); }
  };

  const mutation = useMutation({
    mutationFn: (d) => api.post('/campaigns', d).then(r => r.data),
    onSuccess: () => { toast.success('Campaign created!'); qc.invalidateQueries(['campaigns']); onClose(); setForm({ name: '', description: '', targetGrade: '', targetCourse: '', messageTemplate: '' }); },
    onError: (e) => toast.error(e.error || 'Failed'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Create WhatsApp Campaign" size="lg">
      <div className="p-6 space-y-4">
        <Input label="Campaign Name *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="June Admission Drive 2025" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Target Grade" value={form.targetGrade} onChange={v => set('targetGrade', v)} options={GRADE_OPTS} />
          <Select label="Target Course" value={form.targetCourse} onChange={v => set('targetCourse', v)} options={COURSE_OPTS} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Message Template *</label>
            <button onClick={generateMessage} disabled={generatingMsg} className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium">
              {generatingMsg ? <><Loader2 className="w-3 h-3 animate-spin" />Generating...</> : <><Bot className="w-3 h-3" />AI Generate</>}
            </button>
          </div>
          <textarea className="input resize-none" rows={5} value={form.messageTemplate} onChange={e => set('messageTemplate', e.target.value)} placeholder="Hi {name}, great news from Future Optima..." />
          <p className="text-xs text-gray-400 mt-1">Use {'{name}'} for student name, {'{institute}'} for institute name</p>
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => mutation.mutate(form)} disabled={!form.name || !form.messageTemplate || mutation.isPending}>
            {mutation.isPending ? 'Creating...' : <><Megaphone className="w-4 h-4" />Create Campaign</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function CampaignsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then(r => r.data),
  });

  const sendCampaign = useMutation({
    mutationFn: (id) => api.post(`/campaigns/${id}/send`),
    onSuccess: () => toast.success('Campaign sending started! WhatsApp messages queued.'),
    onError: () => toast.error('Send failed'),
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">WhatsApp Campaigns</h1>
          <p className="text-gray-500 text-sm">Bulk messaging with AI-generated content</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" />Create Campaign</button>
      </div>

      {/* How it works */}
      <div className="nexora-gradient rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3"><Megaphone className="w-5 h-5 text-yellow-300" /><span className="font-semibold">WhatsApp Campaign Flow</span></div>
        <div className="grid grid-cols-4 gap-3 text-sm">
          {['1. Create campaign with target', '2. AI generates message', '3. One-click send to all leads', '4. Track delivery stats'].map((s, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="text-blue-200 text-xs">{s}</div>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? <LoadingState /> : !campaigns?.length ? (
        <EmptyState title="No campaigns yet" description="Create your first WhatsApp campaign to engage leads at scale" action={<button onClick={() => setShowCreate(true)} className="btn-primary mx-auto">Create Campaign</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{c.name}</h3>
                  {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                </div>
                {c.sentAt ? (
                  <span className="bg-green-100 text-green-700 text-xs px-2.5 py-0.5 rounded-full font-semibold">Sent</span>
                ) : (
                  <span className="bg-yellow-100 text-yellow-700 text-xs px-2.5 py-0.5 rounded-full font-semibold">Draft</span>
                )}
              </div>

              {/* Targeting */}
              <div className="flex flex-wrap gap-2 mb-3">
                {c.targetGrade && <span className="bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded-full border border-orange-200">{c.targetGrade} leads</span>}
                {c.targetCourse && <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-200">{COURSES[c.targetCourse]?.split(' ').slice(0,2).join(' ')}</span>}
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full flex items-center gap-1"><Users className="w-3 h-3" />{c._count?.leads || 0} leads</span>
              </div>

              {/* Message preview */}
              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                <p className="text-xs text-gray-600 line-clamp-3">{c.messageTemplate}</p>
              </div>

              {/* Stats */}
              {c.sentAt && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[['Sent', c.totalSent], ['Delivered', c.totalDelivered], ['Read', c.totalRead]].map(([l, v]) => (
                    <div key={l} className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-sm font-bold text-gray-900">{v || 0}</div>
                      <div className="text-xs text-gray-400">{l}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">By {c.createdBy?.name} · {fmtDate(c.createdAt)}</span>
                {!c.sentAt && (
                  <button onClick={() => sendCampaign.mutate(c.id)} disabled={sendCampaign.isPending} className="btn-primary text-xs py-1.5 px-3">
                    {sendCampaign.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" />Send Now</>}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <CreateCampaignModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
