import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, Bot, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../utils/api';
import { fmtDatetime } from '../utils/constants';
import { LoadingState, EmptyState, Pagination, Modal, Input } from '../components/ui/index';
import toast from 'react-hot-toast';

function SendMessageModal({ open, onClose }) {
  const qc = useQueryClient();
  const [phone, setPhone] = useState('');
  const [leadId, setLeadId] = useState('');
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundLead, setFoundLead] = useState(null);
  const [generating, setGenerating] = useState(false);

  const searchLead = async () => {
    setSearching(true);
    try {
      const { data } = await api.get(`/leads?search=${phone}&limit=1`);
      if (data.data[0]) { setFoundLead(data.data[0]); setLeadId(data.data[0].id); }
      else toast.error('No lead found');
    } catch { } finally { setSearching(false); }
  };

  const generateMessage = async () => {
    if (!foundLead) return;
    setGenerating(true);
    try {
      const { data } = await api.post(`/ai/suggest-reply/${foundLead.id}`, { context: 'General follow-up' });
      setMessage(data.reply);
    } catch { toast.error('AI offline'); } finally { setGenerating(false); }
  };

  const mutation = useMutation({
    mutationFn: () => api.post('/whatsapp/send', { leadId, message }).then(r => r.data),
    onSuccess: () => { toast.success('WhatsApp message sent!'); qc.invalidateQueries(['whatsapp-messages']); onClose(); setPhone(''); setLeadId(''); setMessage(''); setFoundLead(null); },
    onError: (e) => toast.error(e.error || 'Send failed'),
  });

  return (
    <Modal open={open} onClose={onClose} title="Send WhatsApp Message" size="md">
      <div className="p-6 space-y-4">
        <div>
          <label className="label">Search Lead by Phone</label>
          <div className="flex gap-2">
            <input className="input flex-1" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchLead()} placeholder="9876543210" />
            <button onClick={searchLead} disabled={searching} className="btn-secondary">{searching ? '...' : 'Search'}</button>
          </div>
        </div>
        {foundLead && (
          <div className="bg-green-50 rounded-xl p-3 border border-green-200">
            <div className="font-semibold text-green-800 text-sm">{foundLead.name}</div>
            <div className="text-xs text-green-600">{foundLead.phone} · {foundLead.interestedCourse?.replace(/_/g,' ')}</div>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Message</label>
            {foundLead && (
              <button onClick={generateMessage} disabled={generating} className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium">
                {generating ? <><Loader2 className="w-3 h-3 animate-spin" />AI...</> : <><Bot className="w-3 h-3" />AI Generate</>}
              </button>
            )}
          </div>
          <textarea className="input resize-none" rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your message..." />
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!leadId || !message || mutation.isPending} className="btn-primary">
            {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : <><Send className="w-4 h-4" />Send</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const STATUS_COLOR = { SENT: 'bg-blue-100 text-blue-700', DELIVERED: 'bg-green-100 text-green-700', READ: 'bg-purple-100 text-purple-700', FAILED: 'bg-red-100 text-red-700', QUEUED: 'bg-gray-100 text-gray-600' };

export default function WhatsAppPage() {
  const [page, setPage] = useState(1);
  const [showSend, setShowSend] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-messages', page],
    queryFn: () => api.get(`/whatsapp/messages?page=${page}&limit=25`).then(r => r.data),
  });

  const stats = {
    total: data?.pagination?.total || 0,
    sent: data?.data?.filter(m => m.status !== 'FAILED').length || 0,
    failed: data?.data?.filter(m => m.status === 'FAILED').length || 0,
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">WhatsApp Messages</h1>
          <p className="text-gray-500 text-sm">All sent messages and receipts</p>
        </div>
        <button onClick={() => setShowSend(true)} className="btn-primary text-sm"><Send className="w-4 h-4" />Send Message</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Sent', value: data?.pagination?.total || 0, color: 'bg-blue-50 text-blue-700' },
          { label: 'Delivered', value: data?.data?.filter(m => m.status === 'DELIVERED' || m.status === 'READ').length || 0, color: 'bg-green-50 text-green-700' },
          { label: 'Failed', value: data?.data?.filter(m => m.status === 'FAILED').length || 0, color: 'bg-red-50 text-red-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-2xl p-4 ${color}`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Messages list */}
      <div className="card overflow-hidden">
        {isLoading ? <LoadingState /> : !data?.data?.length ? (
          <EmptyState title="No messages sent" description="Send your first WhatsApp message" action={<button onClick={() => setShowSend(true)} className="btn-primary mx-auto"><Send className="w-4 h-4" />Send Message</button>} />
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {data.data.map((msg, i) => (
                <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }} className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 text-lg">💬</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-gray-900">{msg.lead?.name || msg.to}</span>
                      <span className="text-xs text-gray-400">{msg.to}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ml-auto ${STATUS_COLOR[msg.status] || 'bg-gray-100 text-gray-600'}`}>{msg.status}</span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{msg.body}</p>
                    {msg.mediaUrl && <div className="text-xs text-blue-600 mt-1">📎 PDF Receipt attached</div>}
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0">{fmtDatetime(msg.createdAt)}</div>
                </motion.div>
              ))}
            </div>
            <div className="px-4 pb-4"><Pagination page={data.pagination.page} pages={data.pagination.pages} total={data.pagination.total} onPage={setPage} /></div>
          </>
        )}
      </div>

      <SendMessageModal open={showSend} onClose={() => setShowSend(false)} />
    </div>
  );
}
