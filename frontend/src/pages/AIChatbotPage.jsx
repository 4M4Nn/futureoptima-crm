import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, User, CheckCircle, XCircle, CreditCard, Receipt, Users, TrendingUp, AlertTriangle, PhoneCall, Search, Mic } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { fmt, fmtDate } from '../utils/constants';

const EXAMPLES = [
  { label: 'Add lead Rahul Kumar 9876543210 AI Engineering Facebook', category: 'CRM' },
  { label: "Today's follow ups", category: 'CRM' },
  { label: 'Search lead Priya', category: 'CRM' },
  { label: 'Show HOT leads stats', category: 'CRM' },
  { label: 'Water expense 30 cash today', category: 'Finance' },
  { label: 'Finance summary', category: 'Finance' },
  { label: "Today's expenses", category: 'Finance' },
  { label: 'Pending fees', category: 'Finance' },
];

function MessageBubble({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[75%]">
          <div className="bg-primary-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">{msg.content}</div>
          <div className="text-xs text-gray-400 text-right mt-1">{new Date(msg.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    );
  }

  const { action, data, message, error, success } = msg.data || {};

  return (
    <div className="flex gap-3 mb-3">
      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
        <Bot className="w-4 h-4 text-purple-600" />
      </div>
      <div className="max-w-[80%]">
        {error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl rounded-tl-sm px-4 py-3">
            <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1"><XCircle className="w-4 h-4" /> Error</div>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <AIResponseCard action={action} data={data} message={message} success={success} />
        )}
        <div className="text-xs text-gray-400 mt-1">{new Date(msg.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>
  );
}

function AIResponseCard({ action, data, message, success }) {
  const baseClass = 'rounded-2xl rounded-tl-sm px-4 py-3 text-sm';

  if (action === 'CREATE_LEAD') {
    const lead = data?.lead;
    return (
      <div className={`${baseClass} ${data?.created ? 'bg-green-50 border border-green-100' : 'bg-yellow-50 border border-yellow-100'}`}>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="font-semibold text-green-800">{data?.created ? 'Lead Created!' : 'Lead Already Exists'}</span>
        </div>
        {lead && (
          <div className="space-y-1 text-xs text-gray-700">
            <div><span className="text-gray-400">Name: </span>{lead.name}</div>
            <div><span className="text-gray-400">Phone: </span>{lead.phone}</div>
            {lead.interestedCourse && <div><span className="text-gray-400">Course: </span>{lead.interestedCourse.replace(/_/g, ' ')}</div>}
            <div><span className="text-gray-400">Source: </span>{lead.source}</div>
            <div className="text-xs text-amber-600 mt-1">AI scoring in progress...</div>
          </div>
        )}
        {lead && <Link to={`/leads/${lead.id}`} className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline mt-2">View Lead →</Link>}
      </div>
    );
  }

  if (action === 'RECORD_PAYMENT') {
    return (
      <div className={`${baseClass} bg-blue-50 border border-blue-100`}>
        <div className="flex items-center gap-2 mb-2"><CreditCard className="w-4 h-4 text-blue-500" /><span className="font-semibold text-blue-800">Payment Recorded!</span></div>
        <div className="space-y-1 text-xs text-gray-700">
          <div><span className="text-gray-400">Student: </span>{data?.studentName}</div>
          <div className="text-lg font-bold text-blue-600">{fmt(data?.payment?.amount)}</div>
          <div><span className="text-gray-400">Receipt: </span><span className="font-mono">{data?.receiptNumber}</span></div>
          {data?.balanceRemaining > 0 && <div className="text-orange-600">Balance remaining: {fmt(data?.balanceRemaining)}</div>}
        </div>
      </div>
    );
  }

  if (action === 'ADD_EXPENSE') {
    const exp = data?.expense;
    return (
      <div className={`${baseClass} bg-green-50 border border-green-100`}>
        <div className="flex items-center gap-2 mb-2"><Receipt className="w-4 h-4 text-green-500" /><span className="font-semibold text-green-800">Expense Added!</span></div>
        {exp && (
          <div className="space-y-1 text-xs text-gray-700">
            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">{exp.category}</span>
            <div className="text-xl font-bold text-green-600">{fmt(exp.amount)}</div>
            <div><span className="text-gray-400">Method: </span>{exp.paymentMethod}</div>
            {exp.vendor && <div><span className="text-gray-400">Vendor: </span>{exp.vendor}</div>}
            <div><span className="text-gray-400">Date: </span>{fmtDate(exp.date)}</div>
          </div>
        )}
        <Link to="/finance/expenses" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline mt-2">View Expenses →</Link>
      </div>
    );
  }

  if (action === 'GET_FOLLOWUPS') {
    const leads = data?.leads || [];
    return (
      <div className={`${baseClass} bg-white border border-gray-100`}>
        <div className="flex items-center gap-2 mb-3"><PhoneCall className="w-4 h-4 text-orange-500" /><span className="font-semibold text-gray-800">{data?.period?.charAt(0).toUpperCase() + data?.period?.slice(1)} Follow-ups ({data?.count})</span></div>
        {leads.length === 0 ? <p className="text-sm text-gray-400">No follow-ups for this period.</p> : (
          <div className="space-y-2">
            {leads.map(l => (
              <div key={l.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-xs font-medium text-gray-900">{l.name}</div>
                  <div className="text-xs text-gray-400">{l.phone} · {l.interestedCourse?.replace(/_/g, ' ')}</div>
                </div>
                <div className="flex gap-1">
                  <a href={`tel:${l.phone}`} className="p-1.5 bg-green-100 rounded-lg hover:bg-green-200"><PhoneCall className="w-3 h-3 text-green-600" /></a>
                  <Link to={`/leads/${l.id}`} className="p-1.5 bg-blue-100 rounded-lg hover:bg-blue-200"><Search className="w-3 h-3 text-blue-600" /></Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (action === 'SEARCH_LEAD') {
    const leads = data?.leads || [];
    return (
      <div className={`${baseClass} bg-white border border-gray-100`}>
        <div className="flex items-center gap-2 mb-3"><Search className="w-4 h-4 text-blue-500" /><span className="font-semibold text-gray-800">Search Results ({data?.count})</span></div>
        {leads.length === 0 ? <p className="text-sm text-gray-400">No leads found.</p> : (
          <div className="space-y-2">
            {leads.map(l => (
              <div key={l.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-xs font-medium text-gray-900">{l.name}</div>
                  <div className="text-xs text-gray-400">{l.phone} · {l.status}</div>
                </div>
                <Link to={`/leads/${l.id}`} className="text-xs text-primary-600 hover:underline">View →</Link>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (action === 'GET_STATS') {
    return (
      <div className={`${baseClass} bg-white border border-gray-100`}>
        <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-purple-500" /><span className="font-semibold text-gray-800">Statistics</span></div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(data || {}).filter(([k]) => !['leads', 'error'].includes(k)).map(([k, v]) => (
            <div key={k} className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-400 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</div>
              <div className="text-sm font-bold text-gray-900">{typeof v === 'number' && v > 1000 ? fmt(v) : v}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (action === 'GET_FINANCE_SUMMARY') {
    return (
      <div className={`${baseClass} bg-white border border-gray-100`}>
        <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-green-500" /><span className="font-semibold text-gray-800">Finance Summary</span></div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Month Collection', value: data?.monthlyCollection, color: 'text-green-600' },
            { label: 'Month Expenses', value: data?.monthlyExpenses, color: 'text-red-600' },
            { label: 'Net Profit', value: data?.netProfit, color: data?.netProfit >= 0 ? 'text-green-600' : 'text-red-600' },
            { label: 'Pending Fees', value: data?.pendingFees, color: 'text-orange-600' },
          ].map(item => (
            <div key={item.label} className="bg-gray-50 rounded-lg p-2">
              <div className="text-xs text-gray-400">{item.label}</div>
              <div className={`text-sm font-bold ${item.color}`}>{fmt(item.value)}</div>
            </div>
          ))}
        </div>
        {data?.overdueInstallments > 0 && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-red-50 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs text-red-600">{data.overdueInstallments} overdue installments</span>
          </div>
        )}
      </div>
    );
  }

  if (action === 'GET_EXPENSES') {
    const expenses = data?.expenses || [];
    return (
      <div className={`${baseClass} bg-white border border-gray-100`}>
        <div className="flex items-center gap-2 mb-2"><Receipt className="w-4 h-4 text-red-500" /><span className="font-semibold text-gray-800">Expenses ({data?.period}) — Total: {fmt(data?.total)}</span></div>
        {expenses.length === 0 ? <p className="text-sm text-gray-400">No expenses found.</p> : (
          <div className="space-y-1">
            {expenses.slice(0, 6).map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                <span className="text-gray-600">{e.category} {e.vendor ? `· ${e.vendor}` : ''}</span>
                <span className="font-semibold text-red-600">{fmt(e.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (action === 'ADD_NOTE' || action === 'SCHEDULE_FOLLOWUP' || action === 'UPDATE_LEAD_STATUS') {
    return (
      <div className={`${baseClass} bg-green-50 border border-green-100`}>
        <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /><span className="font-semibold text-green-800">Done!</span></div>
        <p className="text-sm text-gray-600 mt-1">{message || 'Action completed successfully.'}</p>
      </div>
    );
  }

  // Fallback
  return (
    <div className={`${baseClass} bg-white border border-gray-100`}>
      <p className="text-sm text-gray-600">{message || JSON.stringify(data, null, 2)}</p>
    </div>
  );
}

export default function AIChatbotPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendCommand = async (command) => {
    if (!command.trim()) return;
    const userMsg = { id: Date.now(), role: 'user', content: command, ts: new Date() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const { data } = await api.post('/aicommand/execute', { command });
      setMessages(m => [...m, { id: Date.now() + 1, role: 'ai', data, ts: new Date() }]);
    } catch (err) {
      setMessages(m => [...m, { id: Date.now() + 1, role: 'ai', data: { error: err?.error || 'Command failed. Please try again.' }, ts: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendCommand(input);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] animate-fade-in">
      {/* Header */}
      <div className="nexora-gradient rounded-2xl p-5 text-white mb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">AI Command Center</h2>
              <p className="text-blue-200 text-sm">Control your CRM & Finance with natural language</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5 text-sm">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            AI Ready
          </div>
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 overflow-y-auto px-1 pb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="w-20 h-20 bg-purple-100 rounded-3xl flex items-center justify-center mb-6">
              <Bot className="w-10 h-10 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">What can I help you with?</h3>
            <p className="text-sm text-gray-400 mb-8 text-center max-w-md">
              Type natural language commands to manage leads, record payments, add expenses, and more.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {EXAMPLES.map((ex, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => sendCommand(ex.label)}
                  className="text-left p-3 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50 transition-colors"
                >
                  <div className="text-xs text-primary-500 font-semibold mb-0.5">{ex.category}</div>
                  <div className="text-sm text-gray-700 leading-tight">{ex.label}</div>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-1 py-2">
            <AnimatePresence>
              {messages.map(msg => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <MessageBubble msg={msg} />
                </motion.div>
              ))}
            </AnimatePresence>
            {isTyping && (
              <div className="flex gap-3 mb-3">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-purple-600" />
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Quick Commands */}
      <div className="flex-shrink-0 mb-3 overflow-x-auto">
        <div className="flex gap-2 pb-1">
          {EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => sendCommand(ex.label)} className="whitespace-nowrap text-xs px-3 py-1.5 rounded-full bg-gray-100 hover:bg-primary-100 hover:text-primary-700 text-gray-600 transition-colors flex-shrink-0">
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex-shrink-0">
        <div className="flex gap-3 bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
          <Mic className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            className="flex-1 text-sm outline-none text-gray-900 placeholder-gray-400"
            placeholder="Type a command... e.g. 'Water expense 30 cash' or 'Today follow ups'"
            disabled={isTyping}
          />
          <button
            type="submit"
            disabled={isTyping || !input.trim()}
            className="w-9 h-9 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
