import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Settings, Bot, Building, Save, Wifi, WifiOff, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import api from '../utils/api';
import { Input } from '../components/ui/index';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => api.get('/settings').then(r => r.data) });
  const { data: health, refetch: refetchHealth } = useQuery({ queryKey: ['health'], queryFn: () => api.get('/ai/health').then(r => r.data) });

  const [form, setForm] = useState({ institute_name: '', whatsapp_enabled: 'true', ai_scoring_enabled: 'true', crm_name: '' });
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', phone: '', currentPassword: '', newPassword: '' });
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');

  useEffect(() => { if (settings) setForm(f => ({ ...f, ...settings })); }, [settings]);

  const saveSettings = useMutation({
    mutationFn: (d) => api.put('/settings', d),
    onSuccess: () => toast.success('Settings saved!'),
    onError: () => toast.error('Failed to save'),
  });

  const changePassword = useMutation({
    mutationFn: (d) => api.post('/auth/change-password', d),
    onSuccess: () => { toast.success('Password changed!'); setProfileForm(p => ({ ...p, currentPassword: '', newPassword: '' })); },
    onError: (e) => toast.error(e.error || 'Failed'),
  });

  const clearDataMutation = useMutation({
    mutationFn: () => api.post('/settings/clear-data', { confirmation: 'DELETE ALL' }),
    onSuccess: () => {
      toast.success('All data cleared successfully');
      setShowClearModal(false);
      setClearConfirmText('');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to clear data'),
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-gray-500 text-sm">System configuration and preferences</p>
      </div>

      {/* Groq AI status */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center"><Bot className="w-5 h-5 text-purple-600" /></div>
          <h3 className="section-title">AI Engine (Groq)</h3>
          <div className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${health?.running ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {health?.running ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {health?.running ? 'Connected' : 'Offline'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div><div className="text-xs text-gray-500">Model</div><div className="font-semibold text-gray-900 mt-0.5">llama-3.1-8b-instant</div></div>
          <div><div className="text-xs text-gray-500">Provider</div><div className="font-semibold text-gray-900 mt-0.5">Groq Cloud ⚡</div></div>
          <div><div className="text-xs text-gray-500">Status</div><div className={`font-semibold mt-0.5 ${health?.running ? 'text-green-700' : 'text-red-700'}`}>{health?.running ? 'Connected' : 'Offline'}</div></div>
          <div><div className="text-xs text-gray-500">Speed</div><div className="font-semibold text-gray-900 mt-0.5">Ultra fast inference</div></div>
        </div>
        {!health?.running && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <div className="font-semibold mb-1">Groq AI is offline</div>
            <div className="text-xs">Check that GROQ_API_KEY is set correctly in your Render environment variables.</div>
          </div>
        )}
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">Powered by Groq — ultra fast AI inference</span>
          <button onClick={() => refetchHealth()} className="btn-secondary text-sm">Check Connection</button>
        </div>
      </div>

      {/* Institute settings */}
      {isAdmin && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-nexora/10 rounded-xl flex items-center justify-center"><Building className="w-5 h-5 text-nexora" /></div>
            <h3 className="section-title">Institute Settings</h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Input label="CRM Name" value={form.crm_name} onChange={e => set('crm_name', e.target.value)} />
            <Input label="Institute Name" value={form.institute_name} onChange={e => set('institute_name', e.target.value)} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">WhatsApp Receipts</label>
                <select className="input" value={form.whatsapp_enabled} onChange={e => set('whatsapp_enabled', e.target.value)}>
                  <option value="true">Enabled ✅</option>
                  <option value="false">Disabled</option>
                </select>
              </div>
              <div>
                <label className="label">AI Auto-Scoring</label>
                <select className="input" value={form.ai_scoring_enabled} onChange={e => set('ai_scoring_enabled', e.target.value)}>
                  <option value="true">Enabled ✅</option>
                  <option value="false">Disabled</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={() => saveSettings.mutate(form)} disabled={saveSettings.isPending} className="btn-primary">
              {saveSettings.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save Settings</>}
            </button>
          </div>
        </div>
      )}

      {/* Profile / password */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center"><Settings className="w-5 h-5 text-blue-600" /></div>
          <h3 className="section-title">My Profile</h3>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><div className="text-xs text-gray-500">Name</div><div className="font-semibold text-gray-900 mt-0.5">{user?.name}</div></div>
            <div><div className="text-xs text-gray-500">Email</div><div className="font-semibold text-gray-900 mt-0.5">{user?.email}</div></div>
            <div><div className="text-xs text-gray-500">Role</div><div className="font-semibold text-gray-900 mt-0.5">{user?.role?.replace('_',' ')}</div></div>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">Change Password</div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Current Password" type="password" value={profileForm.currentPassword} onChange={e => setProfileForm(p => ({ ...p, currentPassword: e.target.value }))} />
              <Input label="New Password" type="password" value={profileForm.newPassword} onChange={e => setProfileForm(p => ({ ...p, newPassword: e.target.value }))} />
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={() => changePassword.mutate({ currentPassword: profileForm.currentPassword, newPassword: profileForm.newPassword })} disabled={!profileForm.currentPassword || !profileForm.newPassword || changePassword.isPending} className="btn-primary text-sm">
                {changePassword.isPending ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Deployment info */}
      <div className="card p-5">
        <h3 className="section-title mb-4">Deployment Info</h3>
        <div className="space-y-2 text-sm">
          {[
            ['CRM Version', 'v1.0.0'],
            ['Backend', 'Node.js + Express + Prisma'],
            ['Database', 'PostgreSQL (Neon)'],
            ['Frontend', 'React 18 + Vite + Tailwind'],
            ['AI Engine', 'Groq Cloud (llama-3.1-8b-instant) ⚡'],
            ['Built by', 'Nexora AI Solutions'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-gray-500">{k}</span>
              <span className="font-medium text-gray-900">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone — SUPER_ADMIN only */}
      {user?.role === 'SUPER_ADMIN' && (
        <div className="border-2 border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-base font-bold text-red-700">Data Management — Danger Zone</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            <strong>Clear All Data — Fresh Start.</strong> This will permanently delete ALL leads, students, payments, expenses and salary records. This cannot be undone.
          </p>
          <button
            onClick={() => setShowClearModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Clear All Data
          </button>
        </div>
      )}

      {/* Clear Data Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-red-700">Confirm Data Deletion</h2>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              This will permanently delete <strong>ALL leads, students, payments, expenses and salary records</strong>.
              Users, courses, batches and settings will be kept intact.
              <br /><br />
              This action <strong>cannot be undone</strong>.
            </p>
            <div className="mb-4">
              <label className="label text-sm">Type <strong>DELETE ALL</strong> to confirm</label>
              <input
                type="text"
                value={clearConfirmText}
                onChange={e => setClearConfirmText(e.target.value)}
                className="input"
                placeholder="DELETE ALL"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowClearModal(false); setClearConfirmText(''); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => clearDataMutation.mutate()}
                disabled={clearConfirmText !== 'DELETE ALL' || clearDataMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {clearDataMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {clearDataMutation.isPending ? 'Clearing...' : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
