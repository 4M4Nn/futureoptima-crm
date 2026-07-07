import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { Modal } from './ui/index';

export default function AssignBatchModal({ open, onClose, enrollment }) {
  const qc = useQueryClient();
  const [batchId, setBatchId] = useState('');

  useEffect(() => {
    if (open && enrollment) setBatchId(enrollment.batchId || '');
  }, [open, enrollment]);

  const courseId = enrollment?.courseId || enrollment?.course?.id;

  const { data: batches, isLoading } = useQuery({
    queryKey: ['course-batches', courseId],
    queryFn: () => api.get(`/courses/${courseId}/batches`).then(r => r.data),
    enabled: open && !!courseId,
  });

  const mutation = useMutation({
    mutationFn: () => api.patch(`/enrollments/${enrollment.id}`, { batchId }),
    onSuccess: () => {
      toast.success('Batch assigned!');
      qc.invalidateQueries({ queryKey: ['enrollments'] });
      qc.invalidateQueries({ queryKey: ['enrollment', enrollment.id] });
      onClose();
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Failed to assign batch'),
  });

  if (!enrollment) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Assign Batch — ${enrollment.lead?.name || ''}`} size="lg">
      <div className="p-5 space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-gray-400 text-sm flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading batches...</div>
        ) : !batches?.length ? (
          <p className="text-sm text-gray-400 text-center py-8">No active batches for this course yet. Create one from the Courses page.</p>
        ) : (
          <div className="space-y-2">
            {batches.map(b => {
              const remaining = Math.max(0, (b.capacity || 0) - (b._count?.enrollments || 0));
              const selected = batchId === b.id;
              const modeColors = { ONLINE: 'bg-blue-100 text-blue-700', OFFLINE: 'bg-green-100 text-green-700', HYBRID: 'bg-purple-100 text-purple-700' };
              return (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => setBatchId(selected ? '' : b.id)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900">{b.batchName}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${modeColors[b.mode] || 'bg-gray-100 text-gray-700'}`}>{b.mode}</span>
                      {b.isCombined && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">🔗 Combined</span>}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Starts {b.startDate ? new Date(b.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'} · {b.timings}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {remaining > 0 ? `${remaining} seats remaining` : 'Batch full'} · Capacity {b.capacity}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button className="btn-secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</button>
          <button className="btn-gold" onClick={() => mutation.mutate()} disabled={!batchId || mutation.isPending}>
            {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Assigning...</> : <><GraduationCap className="w-4 h-4" />Assign Batch</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}
