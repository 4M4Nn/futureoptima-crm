import { useState, useRef, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Bot, Send, X, ExternalLink, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import api from '../../utils/api';
import { fmt, fmtDate } from '../../utils/constants';

const TITLES = {
  '/dashboard': 'Dashboard', '/leads': 'Lead Management', '/students': 'Students',
  '/payments': 'Payments & Fees', '/analytics': 'Analytics', '/ai': 'AI Assistant',
  '/tasks': 'Tasks', '/campaigns': 'WhatsApp Campaigns', '/whatsapp': 'WhatsApp Messages',
  '/courses': 'Courses', '/users': 'Users', '/settings': 'Settings',
  '/finance': 'Finance Dashboard', '/finance/expenses': 'Expenses',
  '/finance/salary': 'Salary Management', '/finance/reports': 'Finance Reports',
  '/certificates': 'Certificates', '/chatbot': 'AI Command Center',
  '/followups': 'Follow-ups', '/reports': 'Reports', '/meta': 'Meta Ads',
};

function FloatingChat({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendCommand = async (command) => {
    if (!command.trim()) return;
    setMessages(m => [...m, { id: Date.now(), role: 'user', content: command }]);
    setInput('');
    setIsTyping(true);
    try {
      const { data } = await api.post('/aicommand/execute', { command });
      setMessages(m => [...m, { id: Date.now() + 1, role: 'ai', data }]);
    } catch (err) {
      setMessages(m => [...m, { id: Date.now() + 1, role: 'ai', data: { error: err?.error || 'Command failed' } }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="fixed bottom-20 right-4 w-96 h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-white" />
              <span className="text-white font-semibold text-sm">AI Assistant</span>
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </div>
            <div className="flex items-center gap-1">
              <Link to="/chatbot" onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <ExternalLink className="w-4 h-4 text-white/80" />
              </Link>
              <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-xs text-gray-400">Try: "Water expense 30 cash" or "Today's follow ups"</p>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id}>
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-primary-600 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-xs">{msg.content}</div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3 h-3 text-purple-600" />
                    </div>
                    <div className={`max-w-[80%] rounded-2xl rounded-tl-sm px-3 py-2 text-xs ${msg.data?.error ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
                      {msg.data?.error ? msg.data.error : (
                        <div>
                          <div className="font-medium text-gray-800 mb-0.5">{msg.data?.action?.replace(/_/g, ' ')}</div>
                          <div className="text-gray-500">{msg.data?.message || 'Done!'}</div>
                          {msg.data?.action === 'GET_FINANCE_SUMMARY' && msg.data?.data && (
                            <div className="mt-1 grid grid-cols-2 gap-1">
                              <div className="bg-green-50 rounded p-1"><div className="text-xs text-green-600 font-bold">{fmt(msg.data.data.monthlyCollection)}</div><div className="text-[10px] text-gray-400">Collection</div></div>
                              <div className="bg-red-50 rounded p-1"><div className="text-xs text-red-600 font-bold">{fmt(msg.data.data.monthlyExpenses)}</div><div className="text-[10px] text-gray-400">Expenses</div></div>
                            </div>
                          )}
                          {msg.data?.action === 'ADD_EXPENSE' && msg.data?.data?.expense && (
                            <div className="mt-1 bg-green-50 rounded p-1">
                              <span className="text-green-700 font-bold">{fmt(msg.data.data.expense.amount)}</span>
                              <span className="text-gray-400 ml-1">{msg.data.data.expense.category}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-2">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                  <Bot className="w-3 h-3 text-purple-600" />
                </div>
                <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); sendCommand(input); }} className="flex-shrink-0 p-3 border-t border-gray-100">
            <div className="flex gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a command..."
                className="flex-1 text-xs bg-transparent outline-none text-gray-900 placeholder-gray-400"
                disabled={isTyping}
              />
              <button type="submit" disabled={isTyping || !input.trim()} className="w-7 h-7 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-lg flex items-center justify-center">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const [chatOpen, setChatOpen] = useState(false);
  const title = Object.entries(TITLES).find(([k]) => pathname.startsWith(k))?.[1] || 'Nexora CRM';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Floating Chatbot */}
      {pathname !== '/chatbot' && (
        <>
          <FloatingChat open={chatOpen} onClose={() => setChatOpen(false)} />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setChatOpen(o => !o)}
            className="fixed bottom-4 right-4 w-14 h-14 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center z-40 hover:shadow-xl transition-shadow"
          >
            {chatOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
          </motion.button>
        </>
      )}
    </div>
  );
}
