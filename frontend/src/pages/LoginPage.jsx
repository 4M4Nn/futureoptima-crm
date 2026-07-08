import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.user, data.token);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 nexora-gradient flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <span className="text-white font-bold text-xl">Future Optima CRM</span>
        </div>
        <div>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h1 className="text-5xl font-bold text-white leading-tight mb-6">
              AI-Powered CRM<br />
              <span className="text-yellow-300">for Future Optima</span><br />
              IT Solutions
            </h1>
            <p className="text-blue-200 text-lg mb-8">Manage leads with AI scoring, auto PDF receipts, installment tracking, and real-time analytics.</p>
            <div className="grid grid-cols-3 gap-4">
              {[['1 Lakh+', 'Lead Capacity'], ['7 Courses', 'Managed'], ['Auto PDF', 'Receipts']].map(([v, l]) => (
                <div key={l} className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                  <div className="text-2xl font-bold text-white">{v}</div>
                  <div className="text-blue-200 text-sm">{l}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
        <div className="text-blue-300 text-sm">Built by Nexora AI Solutions • Kerala, India</div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 nexora-gradient rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-nexora text-xl">Future Optima CRM</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Future Optima IT Solutions</h2>
            <p className="text-gray-500 mt-2">AI-Powered Institute Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email Address</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input" placeholder="admin@futureoptima.in" required />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="input pr-11" placeholder="••••••••" required />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary justify-center py-3 text-base">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Signing in...</> : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">Powered by Nexora AI Solutions • Secured with JWT</p>
        </motion.div>
      </div>
    </div>
  );
}
