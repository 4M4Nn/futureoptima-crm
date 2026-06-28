import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle, Clock, AlertTriangle, Bot, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../utils/api';
import { fmtDate } from '../utils/constants';
import { Modal, Input, Select, LoadingState, EmptyState, StatusBadge, ConfirmDialog } from '../components/ui/index';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const PRIORITY_CONFIG = {
  LOW: { color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  MEDIUM: { color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  HIGH: { color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  URGENT: { color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

function AddTaskModal({ open, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueAt: '', status: 'PENDING' });
  const mutation = useMutation({
    mutationFn: (d) => api.post('/tasks', d).then(r => r.data),
    onSuccess: () => { toast.success('Task created!'); qc.invalidateQueries(['tasks']); onClose(); setForm({ title: '', description: '', priority: 'MEDIUM', dueAt: '', status: 'PENDING' }); },
    onError: (e) => toast.error(e.error || 'Failed'),
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <Modal open={open} onClose={onClose} title="Add New Task" size="md">
      <div className="p-6 space-y-4">
        <Input label="Task Title *" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Call HOT lead — Arjun" />
        <Input label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Details..." />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Priority" value={form.priority} onChange={v => set('priority', v)} options={['LOW','MEDIUM','HIGH','URGENT'].map(p => ({ value: p, label: p }))} />
          <Input label="Due Date *" type="datetime-local" value={form.dueAt} onChange={e => set('dueAt', e.target.value)} />
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => mutation.mutate(form)} disabled={!form.title || !form.dueAt || mutation.isPending}>
            {mutation.isPending ? 'Adding...' : '+ Add Task'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function TasksPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [aiSuggestions, setAiSuggestions] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', statusFilter],
    queryFn: () => api.get(`/tasks${statusFilter ? `?status=${statusFilter}` : ''}`).then(r => r.data),
  });

  const markDone = useMutation({
    mutationFn: (id) => api.patch(`/tasks/${id}`, { status: 'DONE' }),
    onSuccess: () => { toast.success('Task completed! ✅'); qc.invalidateQueries(['tasks']); },
  });

  const deleteTask = useMutation({
    mutationFn: (id) => api.delete(`/tasks/${id}`),
    onSuccess: () => { toast.success('Task deleted'); qc.invalidateQueries(['tasks']); },
  });

  const getAISuggestions = async () => {
    setLoadingAI(true);
    try {
      const { data } = await api.post('/ai/chat', {
        question: `I am a counselor at Future Optima IT Solutions. Based on a typical sales day at an IT training institute in Kerala, suggest me 5 specific follow-up tasks I should do today to maximize lead conversion. Be specific and actionable.`
      });
      setAiSuggestions(data.response);
    } catch { toast.error('AI offline'); } finally { setLoadingAI(false); }
  };

  const overdue = tasks?.filter(t => t.status === 'PENDING' && new Date(t.dueAt) < new Date()) || [];
  const pending = tasks?.filter(t => t.status === 'PENDING' && new Date(t.dueAt) >= new Date()) || [];
  const inProgress = tasks?.filter(t => t.status === 'IN_PROGRESS') || [];
  const done = tasks?.filter(t => t.status === 'DONE') || [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="text-gray-500 text-sm">{overdue.length > 0 && <span className="text-red-600 font-semibold">{overdue.length} overdue · </span>}{tasks?.length || 0} total tasks</p>
        </div>
        <div className="flex gap-2">
          <button onClick={getAISuggestions} disabled={loadingAI} className="btn-secondary text-sm">
            {loadingAI ? <><Loader2 className="w-4 h-4 animate-spin" />AI thinking...</> : <><Bot className="w-4 h-4" />AI Suggest Tasks</>}
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" />Add Task</button>
        </div>
      </div>

      {/* AI suggestions panel */}
      {aiSuggestions && (
        <div className="card p-4 border-l-4 border-purple-500 bg-purple-50">
          <div className="flex items-center gap-2 mb-2"><Bot className="w-4 h-4 text-purple-600" /><span className="text-sm font-semibold text-purple-700">AI Task Suggestions</span></div>
          <div className="text-sm text-gray-700 whitespace-pre-line">{aiSuggestions}</div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[['', 'All'], ['PENDING', 'Pending'], ['IN_PROGRESS', 'In Progress'], ['DONE', 'Done']].map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)} className={clsx('px-4 py-2 rounded-xl text-sm font-medium transition-colors', statusFilter === v ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50')}>
            {l}
          </button>
        ))}
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && statusFilter !== 'DONE' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-red-600" /><span className="font-semibold text-red-700 text-sm">{overdue.length} Overdue Task{overdue.length > 1 ? 's' : ''}</span></div>
          <div className="space-y-2">
            {overdue.map(task => <TaskCard key={task.id} task={task} onDone={() => markDone.mutate(task.id)} onDelete={() => setDeleteTaskTarget(task)} overdue />)}
          </div>
        </div>
      )}

      {/* Tasks grid */}
      {isLoading ? <LoadingState /> : (
        <div className="space-y-2">
          {(statusFilter === 'DONE' ? done : statusFilter === 'IN_PROGRESS' ? inProgress : statusFilter === 'PENDING' ? pending : tasks)?.map(task => (
            <TaskCard key={task.id} task={task} onDone={() => markDone.mutate(task.id)} onDelete={() => setDeleteTaskTarget(task)} />
          ))}
          {!tasks?.length && <EmptyState title="No tasks found" description="Add your first task or get AI suggestions" action={<button onClick={() => setShowAdd(true)} className="btn-primary mx-auto">Add Task</button>} />}
        </div>
      )}

      <AddTaskModal open={showAdd} onClose={() => setShowAdd(false)} />
      <ConfirmDialog
        open={!!deleteTaskTarget}
        onClose={() => setDeleteTaskTarget(null)}
        onConfirm={() => { deleteTask.mutate(deleteTaskTarget?.id); setDeleteTaskTarget(null); }}
        loading={deleteTask.isPending}
        danger
        title="Delete task?"
        message={`"${deleteTaskTarget?.title}"\n\nThis task will be permanently deleted.`}
        confirmLabel="Delete Task"
      />
    </div>
  );
}

function TaskCard({ task, onDone, onDelete, overdue = false }) {
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
  const isDone = task.status === 'DONE';
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={clsx('card p-4 flex items-center gap-4', overdue && 'border-red-200', isDone && 'opacity-60')}>
      <button onClick={onDone} disabled={isDone} className={clsx('w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors', isDone ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-500')}>
        {isDone && <CheckCircle className="w-4 h-4 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={clsx('text-sm font-semibold text-gray-900', isDone && 'line-through text-gray-500')}>{task.title}</div>
        {task.description && <div className="text-xs text-gray-500 mt-0.5 truncate">{task.description}</div>}
        {task.lead && <div className="text-xs text-primary-600 mt-0.5">🔗 {task.lead.name} — {task.lead.phone}</div>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1', pc.color)}>
          <span className={clsx('w-1.5 h-1.5 rounded-full', pc.dot)} />{task.priority}
        </span>
        <div className={clsx('flex items-center gap-1 text-xs', overdue ? 'text-red-600 font-semibold' : 'text-gray-400')}>
          <Clock className="w-3 h-3" />{fmtDate(task.dueAt)}
        </div>
        {!isDone && <button onClick={onDelete} className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1">✕</button>}
      </div>
    </motion.div>
  );
}
