import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, User, CheckCircle, XCircle, CreditCard, Receipt, Users, TrendingUp, AlertTriangle, PhoneCall, Search, Mic, Trash2, Banknote, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { fmt, fmtDate } from '../utils/constants';

const EXAMPLES = [
  { label: 'Add lead Rahul Kumar 9876543210 AI Engineering Facebook', category: 'CRM' },
  { label: "Today's follow ups", category: 'CRM' },
  { label: 'Search lead Priya', category: 'CRM' },
  { label: 'Show HOT leads stats', category: 'Finance' },
  { label: 'Water expense 30 cash HDFC today', category: 'Finance' },
  { label: 'Finance summary', category: 'Finance' },
  { label: "Today's expenses", category: 'Finance' },
  { label: 'Pending fees', category: 'Finance' },
];

const BANK_LABELS = { HDFC: 'HDFC Bank', ICICI: 'ICICI Bank', IDFC: 'IDFC Bank', CASH: 'Cash' };

// Render **bold** markdown safely (no dangerouslySetInnerHTML)
function BoldText({ text }) {
  if (!text) return null;
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return <>{parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)}</>;
}

function ConfirmCard({ confirmText, isDangerous, onConfirm, onCancel, isConfirming }) {
  return (
    <div className={`rounded-2xl rounded-tl-sm px-4 py-3 border text-sm ${isDangerous ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Please confirm</div>
      <p className="text-gray-800 leading-relaxed mb-3"><BoldText text={confirmText} /></p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          disabled={isConfirming}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 ${isDangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'}`}
        >
          {isConfirming ? 'Processing...' : 'Confirm'}
        </button>
        <button
          onClick={onCancel}
          disabled={isConfirming}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AIResponseCard({ action, data, message, isError }) {
  const base = 'rounded-2xl rounded-tl-sm px-4 py-3 text-sm';

  if (isError || !action || action === 'UNKNOWN') {
    return (
      <div className={`${base} bg-gray-50 border border-gray-100`}>
        <p className="text-gray-600">{message || "I didn't understand that. Try: 'Add lead Rahul 9876543210' or 'Electricity expense 500 HDFC'"}</p>
      </div>
    );
  }

  if (action === 'CREATE_LEAD') {
    const lead = data?.lead || data;
    return (
      <div className={`${base} ${data?.created !== false ? 'bg-green-50 border border-green-100' : 'bg-yellow-50 border border-yellow-100'}`}>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="font-semibold text-green-800">{data?.created !== false ? 'Lead Created!' : 'Lead Already Exists'}</span>
        </div>
        {lead?.name && (
          <div className="space-y-1 text-xs text-gray-700">
            <div><span className="text-gray-400">Name: </span>{lead.name}</div>
            <div><span className="text-gray-400">Phone: </span>{lead.phone}</div>
            {lead.interestedCourse && <div><span className="text-gray-400">Course: </span>{lead.interestedCourse.replace(/_/g, ' ')}</div>}
            {lead.id && <Link to={`/leads/${lead.id}`} className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline mt-1">View Lead →</Link>}
          </div>
        )}
      </div>
    );
  }

  if (action === 'RECORD_PAYMENT') {
    return (
      <div className={`${base} bg-blue-50 border border-blue-100`}>
        <div className="flex items-center gap-2 mb-2"><CreditCard className="w-4 h-4 text-blue-500" /><span className="font-semibold text-blue-800">Payment Recorded!</span></div>
        <div className="space-y-1 text-xs text-gray-700">
          <div><span className="text-gray-400">Student: </span>{data?.studentName || data?.leadName}</div>
          <div className="text-lg font-bold text-blue-600">{fmt(data?.payment?.amount || data?.amount)}</div>
          {data?.receiptNumber && <div><span className="text-gray-400">Receipt: </span><span className="font-mono">{data.receiptNumber}</span></div>}
          {data?.bankAccount && <div><span className="text-gray-400">Account: </span>{BANK_LABELS[data.bankAccount] || data.bankAccount}</div>}
          {data?.balanceRemaining > 0 && <div className="text-orange-600">Balance remaining: {fmt(data.balanceRemaining)}</div>}
        </div>
      </div>
    );
  }

  if (action === 'ADD_EXPENSE') {
    const exp = data?.expense || data;
    return (
      <div className={`${base} bg-green-50 border border-green-100`}>
        <div className="flex items-center gap-2 mb-2"><Receipt className="w-4 h-4 text-green-500" /><span className="font-semibold text-green-800">Expense Added!</span></div>
        {exp?.category && (
          <div className="space-y-1 text-xs text-gray-700">
            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">{exp.category}</span>
            <div className="text-xl font-bold text-green-600">{fmt(exp.amount)}</div>
            <div><span className="text-gray-400">Method: </span>{exp.paymentMethod}</div>
            {exp.bankAccount && <div><span className="text-gray-400">Account: </span>{BANK_LABELS[exp.bankAccount] || exp.bankAccount}</div>}
            {exp.vendor && <div><span className="text-gray-400">Vendor: </span>{exp.vendor}</div>}
            <div><span className="text-gray-400">Date: </span>{fmtDate(exp.date)}</div>
          </div>
        )}
        <Link to="/finance/expenses" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline mt-2">View Expenses →</Link>
      </div>
    );
  }

  if (action === 'DELETE_EXPENSE') {
    return (
      <div className={`${base} bg-red-50 border border-red-100`}>
        <div className="flex items-center gap-2 mb-1"><Trash2 className="w-4 h-4 text-red-500" /><span className="font-semibold text-red-800">Expense Deleted</span></div>
        <p className="text-xs text-gray-600">{data?.category} {fmt(data?.amount)} has been removed.</p>
      </div>
    );
  }

  if (action === 'ADD_SALARY') {
    const sal = data?.salary || data;
    return (
      <div className={`${base} bg-blue-50 border border-blue-100`}>
        <div className="flex items-center gap-2 mb-2"><Banknote className="w-4 h-4 text-blue-500" /><span className="font-semibold text-blue-800">Salary Record Added!</span></div>
        {sal?.employeeName && (
          <div className="space-y-1 text-xs text-gray-700">
            <div><span className="text-gray-400">Employee: </span>{sal.employeeName}</div>
            <div className="text-xl font-bold text-blue-600">{fmt(sal.netSalary)}</div>
            {sal.bankAccount && <div><span className="text-gray-400">Paid from: </span>{BANK_LABELS[sal.bankAccount] || sal.bankAccount}</div>}
          </div>
        )}
        <Link to="/finance/salary" className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline mt-2">View Salary →</Link>
      </div>
    );
  }

  if (action === 'GET_FOLLOWUPS') {
    const leads = data?.leads || [];
    return (
      <div className={`${base} bg-white border border-gray-100`}>
        <div className="flex items-center gap-2 mb-3"><PhoneCall className="w-4 h-4 text-orange-500" /><span className="font-semibold text-gray-800">{(data?.period || 'Week').charAt(0).toUpperCase() + (data?.period || 'week').slice(1)} Follow-ups ({data?.count || 0})</span></div>
        {leads.length === 0 ? <p className="text-sm text-gray-400">No follow-ups for this period.</p> : (
          <div className="space-y-2">
            {leads.map(l => (
              <div key={l.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-xs font-medium text-gray-900">{l.name}</div>
                  <div className="text-xs text-gray-400">{l.phone}{l.nextFollowUpAt ? ` · ${new Date(l.nextFollowUpAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}</div>
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
      <div className={`${base} bg-white border border-gray-100`}>
        <div className="flex items-center gap-2 mb-3"><Search className="w-4 h-4 text-blue-500" /><span className="font-semibold text-gray-800">Search Results ({data?.count || 0})</span></div>
        {leads.length === 0 ? <p className="text-sm text-gray-400">No leads found.</p> : (
          <div className="space-y-2">
            {leads.map(l => (
              <div key={l.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-xs font-medium text-gray-900">{l.name}</div>
                  <div className="text-xs text-gray-400">{l.phone} · {l.status}</div>
                  {l.enrollment?.course && <div className="text-xs text-gray-400">{l.enrollment.course.shortName}</div>}
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
      <div className={`${base} bg-white border border-gray-100`}>
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
      <div className={`${base} bg-white border border-gray-100`}>
        <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-green-500" /><span className="font-semibold text-gray-800">Finance Summary</span></div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Month Collection', value: data?.monthlyCollection, color: 'text-green-600' },
            { label: 'Month Expenses', value: data?.monthlyExpenses, color: 'text-red-600' },
            { label: 'Net Profit', value: data?.netProfit, color: (data?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600' },
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
      <div className={`${base} bg-white border border-gray-100`}>
        <div className="flex items-center gap-2 mb-2"><Receipt className="w-4 h-4 text-red-500" /><span className="font-semibold text-gray-800">Expenses ({data?.period}) — Total: {fmt(data?.total)}</span></div>
        {expenses.length === 0 ? <p className="text-sm text-gray-400">No expenses found.</p> : (
          <div className="space-y-1">
            {expenses.slice(0, 6).map(e => (
              <div key={e.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                <span className="text-gray-600">{e.category}{e.vendor ? ` · ${e.vendor}` : ''}</span>
                <span className="font-semibold text-red-600">{fmt(e.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Generic success for SCHEDULE_FOLLOWUP, ADD_NOTE, UPDATE_LEAD_STATUS, MARK_CALLED
  return (
    <div className={`${base} bg-green-50 border border-green-100`}>
      <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /><span className="font-semibold text-green-800">Done!</span></div>
      <p className="text-sm text-gray-600 mt-1">{message || 'Action completed successfully.'}</p>
    </div>
  );
}

function MessageBubble({ msg, onConfirm, onCancel, isConfirming }) {
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

  return (
    <div className="flex gap-3 mb-3">
      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
        <Bot className="w-4 h-4 text-purple-600" />
      </div>
      <div className="max-w-[82%]">
        {msg.type === 'confirm' ? (
          <ConfirmCard
            confirmText={msg.confirmText}
            isDangerous={msg.isDangerous}
            onConfirm={onConfirm}
            onCancel={onCancel}
            isConfirming={isConfirming}
          />
        ) : msg.type === 'cancelled' ? (
          <div className="rounded-2xl rounded-tl-sm px-4 py-2.5 bg-gray-50 border border-gray-100 text-sm text-gray-400 italic">Cancelled.</div>
        ) : msg.error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl rounded-tl-sm px-4 py-3">
            <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1"><XCircle className="w-4 h-4" />Error</div>
            <p className="text-sm text-red-600">{msg.error}</p>
          </div>
        ) : (
          <AIResponseCard action={msg.action} data={msg.data} message={msg.message} isError={msg.isError} />
        )}
        <div className="text-xs text-gray-400 mt-1">{new Date(msg.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>
  );
}

export default function AIChatbotPage() {
  const qc = useQueryClient();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pendingConfirmId, setPendingConfirmId] = useState(null); // message id of active confirm card
  const [pendingAction, setPendingAction] = useState(null);       // { action, data }
  const [isConfirming, setIsConfirming] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addMsg = (msg) => {
    setMessages(m => [...m, { id: Date.now() + Math.random(), ts: new Date(), ...msg }]);
  };

  const cancelPending = () => {
    if (pendingConfirmId) {
      setMessages(m => m.map(msg => msg.id === pendingConfirmId ? { ...msg, type: 'cancelled' } : msg));
      setPendingConfirmId(null);
      setPendingAction(null);
    }
  };

  const sendCommand = async (command) => {
    if (!command.trim() || isTyping || isConfirming) return;

    // Cancel any pending confirm before processing new command
    cancelPending();

    addMsg({ role: 'user', content: command });
    setInput('');
    setIsTyping(true);

    try {
      const { data: res } = await api.post('/aicommand/execute', { command });

      if (res.requiresConfirmation) {
        const msgId = Date.now() + 1;
        setMessages(m => [...m, {
          id: msgId, ts: new Date(), role: 'ai', type: 'confirm',
          confirmText: res.confirmText, isDangerous: res.isDangerous,
        }]);
        setPendingConfirmId(msgId);
        setPendingAction({ action: res.action, data: res.data });
      } else {
        addMsg({ role: 'ai', type: 'result', action: res.action, data: res.data, message: res.message, isError: res.isError });
      }
    } catch (err) {
      addMsg({ role: 'ai', error: err?.error || err?.message || 'Command failed. Please try again.' });
    } finally {
      setIsTyping(false);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction) return;
    setIsConfirming(true);
    const { action, data } = pendingAction;

    try {
      let resultData;
      let resultAction = action;

      switch (action) {
        case 'CREATE_LEAD': {
          const today = new Date(); today.setDate(today.getDate() + 1);
          const res = await api.post('/leads', {
            name: data.name,
            phone: data.phone,
            email: data.email || undefined,
            source: data.source || 'OTHER',
            interestedCourse: data.interestedCourse || undefined,
            city: data.city || undefined,
            nextFollowUpAt: data.followUpDate ? new Date(data.followUpDate).toISOString() : today.toISOString(),
          });
          resultData = { lead: res.data, created: true };
          qc.invalidateQueries({ queryKey: ['leads'] });
          break;
        }

        case 'UPDATE_LEAD_STATUS': {
          const res = await api.patch(`/leads/${data.leadId}`, { status: data.status });
          resultData = res.data;
          qc.invalidateQueries({ queryKey: ['leads'] });
          break;
        }

        case 'SCHEDULE_FOLLOWUP': {
          const res = await api.post(`/leads/${data.leadId}/schedule-followup`, {
            nextFollowUpAt: data.date,
            notes: data.notes || undefined,
          });
          resultData = res.data;
          qc.invalidateQueries({ queryKey: ['leads'] });
          break;
        }

        case 'ADD_NOTE': {
          const res = await api.post(`/leads/${data.leadId}/notes`, { content: data.note });
          resultData = res.data;
          qc.invalidateQueries({ queryKey: ['leads'] });
          break;
        }

        case 'MARK_CALLED': {
          const res = await api.post(`/leads/${data.leadId}/calls`, {
            outcome: data.outcome,
            notes: data.notes || undefined,
          });
          resultData = res.data;
          qc.invalidateQueries({ queryKey: ['leads'] });
          break;
        }

        case 'RECORD_PAYMENT': {
          const res = await api.post('/payments', {
            enrollmentId: data.enrollmentId,
            amount: Number(data.amount),
            method: (data.method || 'CASH').toUpperCase().replace(/[\s-]/g, '_'),
            transactionId: data.transactionId || undefined,
            bankAccount: data.bankAccount || 'CASH',
          });
          resultData = { ...res.data, leadName: data.leadName, bankAccount: data.bankAccount || 'CASH' };
          qc.invalidateQueries({ queryKey: ['payments'] });
          qc.invalidateQueries({ queryKey: ['payment-stats'] });
          qc.invalidateQueries({ queryKey: ['enrollments'] });
          break;
        }

        case 'ADD_EXPENSE': {
          const res = await api.post('/finance/expenses', {
            category: data.category || 'Miscellaneous',
            amount: Number(data.amount),
            date: data.date || new Date().toISOString().slice(0, 10),
            paymentMethod: data.paymentMethod || 'Cash',
            bankAccount: data.bankAccount || 'CASH',
            vendor: data.vendor || undefined,
            notes: data.notes || undefined,
          });
          resultData = { expense: res.data };
          qc.invalidateQueries({ queryKey: ['expenses'] });
          qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
          break;
        }

        case 'DELETE_EXPENSE': {
          await api.delete(`/finance/expenses/${data.expenseId}`);
          resultData = { deleted: true, category: data.category, amount: data.amount };
          qc.invalidateQueries({ queryKey: ['expenses'] });
          qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
          break;
        }

        case 'ADD_SALARY': {
          const res = await api.post('/finance/salary', {
            employeeName: data.employeeName,
            isExternalEmployee: true,
            month: Number(data.month),
            year: Number(data.year),
            basicSalary: Number(data.basicSalary),
            bonus: Number(data.bonus) || 0,
            deductions: Number(data.deductions) || 0,
            paymentMethod: data.paymentMethod || undefined,
            bankAccount: data.bankAccount || 'CASH',
            paymentStatus: 'PENDING',
            notes: data.notes || undefined,
          });
          resultData = { salary: res.data };
          qc.invalidateQueries({ queryKey: ['salary-records'] });
          break;
        }

        default:
          break;
      }

      // Replace confirm message with result
      setMessages(m => m.map(msg =>
        msg.id === pendingConfirmId
          ? { ...msg, type: 'result', action: resultAction, data: resultData, message: 'Done!' }
          : msg
      ));
    } catch (err) {
      // axios interceptor rejects with err.response.data directly, so err IS the response body
      const errMsg = err?.errors?.[0]?.msg || err?.error || err?.message || 'Action failed. Please try again.';
      setMessages(m => m.map(msg =>
        msg.id === pendingConfirmId
          ? { ...msg, type: 'failed', error: errMsg }
          : msg
      ));
    } finally {
      setPendingConfirmId(null);
      setPendingAction(null);
      setIsConfirming(false);
    }
  };

  const cancelAction = () => {
    setMessages(m => m.map(msg =>
      msg.id === pendingConfirmId ? { ...msg, type: 'cancelled' } : msg
    ));
    setPendingConfirmId(null);
    setPendingAction(null);
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
              <p className="text-blue-200 text-sm">Type commands to manage leads, payments, expenses and more</p>
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
              Type commands to add leads, record payments, log expenses, and view follow-ups. Write actions ask for your confirmation before executing.
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
                  <MessageBubble
                    msg={msg}
                    onConfirm={msg.id === pendingConfirmId ? confirmAction : undefined}
                    onCancel={msg.id === pendingConfirmId ? cancelAction : undefined}
                    isConfirming={msg.id === pendingConfirmId && isConfirming}
                  />
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
            placeholder="e.g. 'Electricity expense 1200 HDFC' or 'Today follow ups' or 'Record payment 5000 UPI ICICI for 9876543210'"
            disabled={isTyping || isConfirming}
          />
          <button
            type="submit"
            disabled={isTyping || isConfirming || !input.trim()}
            className="w-9 h-9 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
