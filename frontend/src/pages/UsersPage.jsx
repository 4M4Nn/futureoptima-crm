import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Shield, Edit2, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../utils/api';
import { fmtDate } from '../utils/constants';
import { Modal, Input, Select, LoadingState, EmptyState } from '../components/ui/index';
import toast from 'react-hot-toast';

const ROLE_COLORS = {
  SUPER_ADMIN: 'bg-red-100 text-red-700', ADMIN: 'bg-orange-100 text-orange-700',
  COUNSELOR: 'bg-blue-100 text-blue-700', FACULTY: 'bg-green-100 text-green-700',
  ACCOUNTANT: 'bg-purple-100 text-purple-700', VIEWER: 'bg-gray-100 text-gray-600',
};
const ROLE_OPTS = ['SUPER_ADMIN','ADMIN','COUNSELOR','FACULTY','ACCOUNTANT','VIEWER'].map(r => ({ value: r, label: r.replace('_',' ') }));

function UserModal({ open, onClose, editUser = null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(editUser ? { name: editUser.name, email: editUser.email, phone: editUser.phone || '', role: editUser.role, password: '' } : { name: '', email: '', phone: '', role: 'COUNSELOR', password: '' });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: (d) => editUser ? api.patch(`/users/${editUser.id}`, d) : api.post('/users', d),
    onSuccess: () => { toast.success(editUser ? 'User updated!' : 'User created!'); qc.invalidateQueries(['users']); onClose(); },
    onError: (e) => toast.error(e.error || 'Failed'),
  });

  return (
    <Modal open={open} onClose={onClose} title={editUser ? 'Edit User' : 'Add New User'} size="md">
      <div className="p-6 space-y-4">
        <Input label="Full Name *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Rahul Menon" />
        <Input label="Email *" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="rahul@futureoptima.in" />
        <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="9876543210" />
        <Select label="Role" value={form.role} onChange={v => set('role', v)} options={ROLE_OPTS} />
        <Input label={editUser ? 'New Password (leave blank to keep)' : 'Password *'} type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 8 characters" />
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => mutation.mutate(form)} disabled={!form.name || !form.email || mutation.isPending}>
            {mutation.isPending ? 'Saving...' : editUser ? 'Update User' : 'Create User'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }) => api.patch(`/users/${id}`, { isActive: !isActive }),
    onSuccess: () => { toast.success('User status updated'); qc.invalidateQueries(['users']); },
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Users & Roles</h1>
          <p className="text-gray-500 text-sm">{users?.length || 0} team members</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><UserPlus className="w-4 h-4" />Add User</button>
      </div>

      {/* Role guide */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3"><Shield className="w-4 h-4 text-gray-500" /><span className="text-sm font-semibold text-gray-700">Role Permissions</span></div>
        <div className="flex flex-wrap gap-2">
          {[['SUPER_ADMIN','Full Access'], ['ADMIN','Manage + Reports'], ['COUNSELOR','Own Leads Only'], ['ACCOUNTANT','Payments Only'], ['FACULTY','View Only'], ['VIEWER','Read Only']].map(([r, d]) => (
            <div key={r} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-1.5">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[r]}`}>{r.replace('_',' ')}</span>
              <span className="text-xs text-gray-500">{d}</span>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? <LoadingState /> : !users?.length ? (
        <EmptyState title="No users" action={<button onClick={() => setShowAdd(true)} className="btn-primary mx-auto">Add User</button>} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['User', 'Role', 'Phone', 'Status', 'Joined', 'Actions'].map(h => <th key={h} className="px-4 py-3 text-left table-header">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 nexora-gradient rounded-full flex items-center justify-center text-white font-bold text-sm">{user.name.charAt(0)}</div>
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ROLE_COLORS[user.role]}`}>{user.role.replace('_',' ')}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{user.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive.mutate({ id: user.id, isActive: user.isActive })} className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {user.isActive ? <CheckCircle className="w-3 h-3" /> : '○'}{user.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditUser(user)} className="text-xs text-primary-600 hover:underline flex items-center gap-1"><Edit2 className="w-3 h-3" />Edit</button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserModal open={showAdd} onClose={() => setShowAdd(false)} />
      {editUser && <UserModal open={!!editUser} onClose={() => setEditUser(null)} editUser={editUser} />}
    </div>
  );
}
