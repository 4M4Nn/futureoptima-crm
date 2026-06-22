import { X, Loader2, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// Modal
export function Modal({ open, onClose, title, children, size = 'md' }) {
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' };
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={clsx('relative bg-white rounded-2xl shadow-2xl w-full z-10', sizes[size])}>
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Spinner
export function Spinner({ size = 'md' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return <Loader2 className={clsx('animate-spin text-primary-600', s[size])} />;
}

// Loading state
export function LoadingState({ text = 'Loading...' }) {
  return <div className="flex items-center justify-center py-20 gap-3 text-gray-500"><Spinner /><span>{text}</span></div>;
}

// Empty state
export function EmptyState({ title, description, action }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Inbox className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {action}
    </div>
  );
}

// Status badge
export function StatusBadge({ status }) {
  const colors = {
    NEW: 'bg-blue-50 text-blue-700', CONTACTED: 'bg-indigo-50 text-indigo-700',
    QUALIFIED: 'bg-purple-50 text-purple-700', DEMO_SCHEDULED: 'bg-yellow-50 text-yellow-700',
    PROPOSAL_SENT: 'bg-orange-50 text-orange-700', NEGOTIATION: 'bg-pink-50 text-pink-700',
    WON: 'bg-green-50 text-green-700', LOST: 'bg-red-50 text-red-700', NURTURING: 'bg-teal-50 text-teal-700',
    ACTIVE: 'bg-green-50 text-green-700', COMPLETED: 'bg-blue-50 text-blue-700',
    DROPPED: 'bg-red-50 text-red-700', PENDING: 'bg-yellow-50 text-yellow-700',
    PARTIAL: 'bg-orange-50 text-orange-700', PAID: 'bg-green-50 text-green-700',
    OVERDUE: 'bg-red-50 text-red-700',
  };
  return <span className={clsx('inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold', colors[status] || 'bg-gray-50 text-gray-700')}>{status?.replace(/_/g, ' ')}</span>;
}

// Grade badge
export function GradeBadge({ grade, score }) {
  const cfg = {
    HOT: { cls: 'bg-red-50 text-red-700 border border-red-200', icon: '🔥' },
    WARM: { cls: 'bg-orange-50 text-orange-700 border border-orange-200', icon: '🌡️' },
    COLD: { cls: 'bg-blue-50 text-blue-700 border border-blue-200', icon: '🧊' },
    UNQUALIFIED: { cls: 'bg-gray-50 text-gray-600 border border-gray-200', icon: '⚪' },
  };
  if (!grade) return <span className="text-gray-400 text-xs">Not scored</span>;
  const c = cfg[grade] || cfg.COLD;
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold', c.cls)}>
      {c.icon} {grade} {score != null && <span className="opacity-70">({score})</span>}
    </span>
  );
}

// Pagination
export function Pagination({ page, pages, total, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-sm text-gray-500">{total} records</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
        {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
          const p = i + 1;
          return <button key={p} onClick={() => onPage(p)} className={clsx('w-8 h-8 rounded-lg text-sm font-medium', p === page ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 text-gray-600')}>{p}</button>;
        })}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// Stat card
export function StatCard({ icon: Icon, label, value, sub, color = 'blue', trend }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', orange: 'bg-orange-50 text-orange-600', red: 'bg-red-50 text-red-600', purple: 'bg-purple-50 text-purple-600', gold: 'bg-yellow-50 text-yellow-600', nexora: 'bg-indigo-50 text-indigo-600' };
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
      <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0', colors[color])}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-500 font-medium">{label}</div>
        <div className="text-2xl font-bold text-gray-900 mt-0.5">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </motion.div>
  );
}

// Select
export function Select({ label, value, onChange, options, placeholder = 'Select...', className = '' }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)} className="input">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// Input
export function Input({ label, error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <input className={clsx('input', error && 'border-red-400 focus:ring-red-400')} {...props} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// Textarea
export function Textarea({ label, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <textarea className="input resize-none" {...props} />
    </div>
  );
}

// Confirm dialog
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="p-6">
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}
