import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Send, Loader2, Zap, RefreshCw, Wifi, WifiOff, Sparkles, Users, CreditCard, TrendingUp, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const QUICK_PROMPTS = [
  { icon: '🔥', text: 'Which leads should I prioritize today?', label: 'Priority Leads' },
  { icon: '📊', text: 'Give me tips to improve lead conversion rate for IT courses in Kerala', label: 'Conversion Tips' },
  { icon: '💬', text: 'Write a WhatsApp follow-up message for a lead interested in AI Engineering', label: 'WhatsApp Script' },
  { icon: '🎯', text: 'What objections do students typically have about fees and how to handle them?', label: 'Handle Objections' },
  { icon: '📚', text: 'Compare our courses and suggest which one suits a fresher with no tech background', label: 'Course Guide' },
  { icon: '📅', text: 'How should I structure my daily follow-up routine as a counselor?', label: 'Daily Routine' },
];

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${isUser ? 'bg-primary-600 text-white' : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'}`}>
        {isUser ? '👤' : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm'}`}>
        {msg.text.split('\n').map((line, i) => <span key={i}>{line}{i < msg.text.split('\n').length - 1 && <br />}</span>)}
        {msg.timestamp && <div className={`text-xs mt-1 ${isUser ? 'text-blue-200' : 'text-gray-400'}`}>{new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>}
      </div>
    </motion.div>
  );
}

export default function AIAssistantPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hi! I'm Nexora AI, your intelligent CRM assistant for Future Optima IT Solutions. I can help you with lead strategies, course recommendations, follow-up scripts, and more. What can I help you with today?", timestamp: new Date() }
  ]);
  const [loading, setLoading] = useState(false);
  const [batchScoring, setBatchScoring] = useState(false);
  const endRef = useRef(null);

  const { data: health, refetch: refetchHealth } = useQuery({
    queryKey: ['ollama-health'], queryFn: () => api.get('/ai/health').then(r => r.data), refetchInterval: 30000
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (text = input) => {
    const q = text.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: q, timestamp: new Date() }]);
    setLoading(true);
    try {
      const { data } = await api.post('/ai/chat', { question: q });
      setMessages(m => [...m, { role: 'ai', text: data.response, timestamp: new Date() }]);
    } catch {
      setMessages(m => [...m, { role: 'ai', text: "⚠️ I'm having trouble connecting to the AI engine. Please make sure Ollama is running (`ollama serve`) and try again.", timestamp: new Date() }]);
    } finally { setLoading(false); }
  };

  const batchScore = async () => {
    setBatchScoring(true);
    try {
      await api.post('/ai/batch-score', { limit: 100 });
      toast.success('AI is scoring all leads in background!');
      setMessages(m => [...m, { role: 'ai', text: '✅ Batch scoring started! I\'m analyzing all unscored leads and assigning HOT/WARM/COLD grades. This may take a few minutes. Refresh the Leads page to see updated scores.', timestamp: new Date() }]);
    } catch { toast.error('Failed to start batch scoring'); } finally { setBatchScoring(false); }
  };

  return (
    <div className="h-full flex flex-col gap-5 animate-fade-in" style={{ height: 'calc(100vh - 11rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center ai-glow">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="page-title">Nexora AI Assistant</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {health?.running ? (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><Wifi className="w-3 h-3" />Connected • {health.activeModel}</span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><WifiOff className="w-3 h-3" />Ollama offline — run `ollama serve`</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={batchScore} disabled={batchScoring || !health?.running} className="btn-secondary text-sm">
            {batchScoring ? <><Loader2 className="w-4 h-4 animate-spin" />Scoring...</> : <><Sparkles className="w-4 h-4" />Score All Leads</>}
          </button>
          <button onClick={() => refetchHealth()} className="btn-secondary text-sm p-2"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* Chat */}
        <div className="flex-1 card flex flex-col min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <AnimatePresence>{messages.map((m, i) => <Message key={i} msg={m} />)}</AnimatePresence>
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center"><Bot className="w-4 h-4 text-white" /></div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Nexora AI is thinking...</div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-100 flex gap-3">
            <input
              className="input flex-1"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask about leads, courses, scripts, strategies..."
              disabled={loading}
            />
            <button onClick={() => send()} disabled={loading || !input.trim()} className="btn-primary px-4 disabled:opacity-50">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick prompts + agents */}
        <div className="w-72 flex flex-col gap-4">
          <div className="card flex-1">
            <div className="card-header"><h3 className="text-sm font-semibold text-gray-700">Quick Prompts</h3></div>
            <div className="p-3 space-y-2">
              {QUICK_PROMPTS.map((p, i) => (
                <button key={i} onClick={() => send(p.text)} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group border border-gray-100 hover:border-primary-200">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{p.icon}</span>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-primary-700">{p.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* AI Agents */}
          <div className="card">
            <div className="card-header"><h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1"><Zap className="w-3.5 h-3.5" />AI Agents</h3></div>
            <div className="p-3 space-y-2">
              {[
                { icon: Users, label: 'Lead Scoring Agent', desc: 'Scores all leads HOT/WARM/COLD', onClick: batchScore },
                { icon: MessageSquare, label: 'Reply Suggester', desc: 'Generate WhatsApp scripts', onClick: () => send('Write me 3 different WhatsApp follow-up messages for leads interested in our AI Engineering course') },
                { icon: TrendingUp, label: 'Analytics Agent', desc: 'Conversion insights', onClick: () => send('Analyze our current conversion funnel and suggest improvements') },
              ].map(({ icon: Icon, label, desc, onClick }) => (
                <button key={label} onClick={onClick} disabled={!health?.running} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-purple-50 transition-colors group border border-transparent hover:border-purple-200 disabled:opacity-40">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <Icon className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-gray-800">{label}</div>
                    <div className="text-xs text-gray-400">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
