import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Target, Zap, Loader2, CheckCircle, AlertTriangle, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { fmt } from '../utils/constants';
import { LoadingState } from '../components/ui/index';

const now = new Date();
const nextMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
const curMonth = now.getMonth() + 1;
const curYear = now.getFullYear();

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ProgressBar({ value, max, color = 'bg-primary-500' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
        <span>{fmt(value)}</span>
        <span>{pct}% of {fmt(max)}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className={`h-2.5 rounded-full ${color}`} />
      </div>
    </div>
  );
}

export default function ForecastPage() {
  const qc = useQueryClient();
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);

  const [targetForm, setTargetForm] = useState({ collection: '', admissions: '', revenue: '' });

  const { data: forecast, isLoading: forecastLoading } = useQuery({
    queryKey: ['forecast-next-month'],
    queryFn: () => api.get('/forecast/next-month').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: performance, isLoading: perfLoading } = useQuery({
    queryKey: ['forecast-performance', curMonth, curYear],
    queryFn: () => api.get(`/forecast/performance?month=${curMonth}&year=${curYear}`).then(r => r.data),
  });

  const { data: savedTargets } = useQuery({
    queryKey: ['forecast-targets', nextMonth, nextYear],
    queryFn: () => api.get(`/forecast/targets?month=${nextMonth}&year=${nextYear}`).then(r => r.data),
    onSuccess: (d) => {
      if (d) setTargetForm({ collection: String(d.collectionTarget || ''), admissions: String(d.admissionTarget || ''), revenue: String(d.revenueTarget || '') });
    },
  });

  const saveTargets = useMutation({
    mutationFn: () => api.post('/forecast/targets', {
      month: nextMonth, year: nextYear,
      collectionTarget: Number(targetForm.collection),
      admissionTarget: Number(targetForm.admissions),
      revenueTarget: Number(targetForm.revenue),
    }),
    onSuccess: () => { toast.success('Targets saved!'); qc.invalidateQueries(['forecast-targets']); qc.invalidateQueries(['forecast-performance']); },
    onError: () => toast.error('Failed to save targets'),
  });

  const getAIAnalysis = async () => {
    setLoadingAI(true);
    try {
      const { data } = await api.post('/forecast/ai-analysis', { forecastData: forecast, performanceData: performance });
      setAiAnalysis(data.analysis);
    } catch { toast.error('AI analysis failed'); } finally { setLoadingAI(false); }
  };

  if (forecastLoading) return <LoadingState text="Calculating forecasts..." />;

  const chartData = forecast?.admissions?.last6MonthsChart || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">📈 Forecast & Targets</h1>
          <p className="text-gray-500 text-sm">Next month predictions and target management</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          <span>Forecasting for <strong>{forecast?.nextMonth || `${MONTH_NAMES[nextMonth]} ${nextYear}`}</strong></span>
        </div>
      </div>

      {/* SECTION 1 — Collection Forecast */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5">
          <h2 className="text-lg font-bold text-white">Expected Collection — {forecast?.nextMonth}</h2>
          <p className="text-blue-100 text-sm mt-0.5">Based on pending dues, overdue installments, and expected new admissions</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Pessimistic', sub: '50% collection rate', value: forecast?.collection?.pessimistic, bg: 'bg-red-50 border-red-200', val: 'text-red-700', dot: 'bg-red-500' },
              { label: 'Realistic', sub: '75% collection rate', value: forecast?.collection?.realistic, bg: 'bg-amber-50 border-amber-200', val: 'text-amber-700', dot: 'bg-amber-500' },
              { label: 'Optimistic', sub: '100% collection rate', value: forecast?.collection?.optimistic, bg: 'bg-green-50 border-green-200', val: 'text-green-700', dot: 'bg-green-500' },
            ].map(s => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl p-5 border-2 ${s.bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <span className="text-sm font-semibold text-gray-700">{s.label}</span>
                </div>
                <div className={`text-2xl font-bold ${s.val}`}>{fmt(s.value)}</div>
                <div className="text-xs text-gray-500 mt-1">{s.sub}</div>
              </motion.div>
            ))}
          </div>

          <div className="bg-gray-50 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Source</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Count</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Amount</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { source: 'Pending Installments Due', count: forecast?.collection?.breakdown?.pendingInstallments?.count, amount: forecast?.collection?.breakdown?.pendingInstallments?.amount },
                  { source: 'Overdue (likely to collect)', count: forecast?.collection?.breakdown?.overdueExpected?.count, amount: forecast?.collection?.breakdown?.overdueExpected?.amount },
                  { source: 'Expected New Admissions (40%)', count: forecast?.collection?.breakdown?.newAdmissionRevenue?.count, amount: forecast?.collection?.breakdown?.newAdmissionRevenue?.amount },
                ].map(r => (
                  <tr key={r.source} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{r.source}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{r.count || 0}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(r.amount || 0)}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50">
                  <td className="px-4 py-3 font-bold text-blue-900">Total Expected (Realistic)</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right font-bold text-blue-900 text-base">{fmt(forecast?.collection?.realistic)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-gray-400 text-right">3-month avg collection: {fmt(forecast?.collection?.avgLast3Months)}</div>
        </div>
      </div>

      {/* SECTION 2 — Admission Forecast */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-5">
          <h2 className="text-lg font-bold text-white">Expected Admissions — {forecast?.nextMonth}</h2>
          <p className="text-green-100 text-sm mt-0.5">Based on lead pipeline and historical admission trends</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="text-center bg-green-50 rounded-2xl p-5">
                <div className="text-5xl font-bold text-green-700">{forecast?.admissions?.expected}</div>
                <div className="text-sm text-gray-500 mt-1">Expected Admissions</div>
                <div className="text-sm font-semibold text-green-600 mt-1">Revenue if achieved: {fmt(forecast?.admissions?.revenueIfAchieved)}</div>
              </div>

              <div className="space-y-3">
                {[
                  { label: `HOT Leads (70% conversion)`, count: forecast?.admissions?.hotLeads?.count, admissions: forecast?.admissions?.hotLeads?.expectedAdmissions, revenue: forecast?.admissions?.hotLeads?.revenue, color: 'text-red-600', bg: 'bg-red-50' },
                  { label: `WARM Leads (30% conversion)`, count: forecast?.admissions?.warmLeads?.count, admissions: forecast?.admissions?.warmLeads?.expectedAdmissions, revenue: forecast?.admissions?.warmLeads?.revenue, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: `Historical Average`, count: null, admissions: forecast?.admissions?.avgMonthly, revenue: null, color: 'text-blue-600', bg: 'bg-blue-50' },
                ].map(s => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-3`}>
                    <div className="text-xs font-semibold text-gray-600 mb-1">{s.label}</div>
                    <div className="flex items-center gap-3 text-sm">
                      {s.count !== null && <span className="text-gray-500">{s.count} leads</span>}
                      {s.count !== null && <span className="text-gray-300">→</span>}
                      <span className={`font-bold ${s.color}`}>{s.admissions} admissions</span>
                      {s.revenue && <span className="text-gray-500">→ {fmt(s.revenue)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold text-gray-700 mb-3">Admissions Trend (Last 6 Months + Forecast)</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barSize={28}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Admissions']} />
                  <Bar dataKey="admissions" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.forecast ? '#f59e0b' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-indigo-500" />Historical</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-500" />Forecast</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3 — Set Targets */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-5">
          <h2 className="text-lg font-bold text-white">Set Monthly Targets — {MONTH_NAMES[nextMonth]} {nextYear}</h2>
          <p className="text-amber-100 text-sm mt-0.5">Define goals to track performance</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { key: 'collection', label: 'Collection Target (₹)', hint: forecast?.suggestedTargets?.collection, icon: '💰' },
              { key: 'admissions', label: 'Admission Target', hint: forecast?.suggestedTargets?.admissions, icon: '🎓' },
              { key: 'revenue', label: 'Revenue Target (₹)', hint: forecast?.suggestedTargets?.revenue, icon: '📈' },
            ].map(f => (
              <div key={f.key} className="space-y-2">
                <label className="label">{f.icon} {f.label}</label>
                <input
                  type="number"
                  className="input"
                  value={targetForm[f.key]}
                  onChange={e => setTargetForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={`e.g. ${f.hint?.toLocaleString('en-IN') || '0'}`}
                />
                {f.hint && (
                  <p className="text-xs text-gray-400">AI suggests: <span className="font-semibold text-amber-600">{f.key === 'admissions' ? f.hint : fmt(f.hint)}</span> based on growth trend</p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-4">
            <button onClick={() => {
              setTargetForm({
                collection: String(forecast?.suggestedTargets?.collection || ''),
                admissions: String(forecast?.suggestedTargets?.admissions || ''),
                revenue: String(forecast?.suggestedTargets?.revenue || ''),
              });
            }} className="btn-secondary text-sm">Use AI Suggestions</button>
            <button onClick={() => saveTargets.mutate()} disabled={saveTargets.isPending} className="btn-gold text-sm">
              {saveTargets.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Target className="w-4 h-4" />Save Targets</>}
            </button>
            {saveTargets.isSuccess && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Saved!</span>}
          </div>
        </div>
      </div>

      {/* SECTION 4 — Current Month Performance */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-slate-700 to-slate-900 p-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Current Month Performance</h2>
            <p className="text-slate-300 text-sm mt-0.5">{MONTH_NAMES[curMonth]} {curYear} — actual vs target</p>
          </div>
          {performance && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${performance.onTrack ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
              {performance.onTrack ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {performance.onTrack ? 'On Track' : 'Needs Attention'}
            </div>
          )}
        </div>
        <div className="p-5">
          {perfLoading ? <LoadingState /> : !performance?.targets ? (
            <div className="text-center py-8 text-gray-400">
              <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Set targets above to track performance</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-700">Collection</div>
                  <ProgressBar value={performance.actualCollection} max={performance.targets?.collectionTarget || 1} color={performance.collectionPct >= 75 ? 'bg-green-500' : performance.collectionPct >= 50 ? 'bg-amber-500' : 'bg-red-500'} />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-gray-700">Admissions</div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>{performance.actualAdmissions} admissions</span>
                      <span>{performance.admissionPct}% of {performance.targets?.admissionTarget}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, performance.admissionPct || 0)}%` }} transition={{ duration: 0.8 }}
                        className={`h-2.5 rounded-full ${performance.admissionPct >= 75 ? 'bg-green-500' : performance.admissionPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Days Remaining', value: performance.daysRemaining, unit: 'days' },
                  { label: 'Daily Avg (actual)', value: fmt(performance.dailyAvg), unit: '/day' },
                  { label: 'Daily Needed (target)', value: fmt(performance.dailyNeeded), unit: '/day' },
                  { label: 'Gap', value: fmt(Math.max(0, (performance.targets?.collectionTarget || 0) - performance.actualCollection)), unit: 'remaining' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="text-xs text-gray-400">{s.label}</div>
                    <div className="font-bold text-gray-900 text-sm mt-0.5">{s.value}</div>
                    <div className="text-xs text-gray-400">{s.unit}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 5 — AI Forecast Analysis */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 p-5">
          <h2 className="text-lg font-bold text-white">🤖 AI Forecast Analysis</h2>
          <p className="text-purple-100 text-sm mt-0.5">Groq AI recommendations based on your forecast data</p>
        </div>
        <div className="p-5">
          {!aiAnalysis ? (
            <div className="text-center py-6 space-y-4">
              <Zap className="w-10 h-10 mx-auto text-purple-300" />
              <p className="text-gray-500 text-sm">Get AI-powered recommendations to hit your targets</p>
              <button onClick={getAIAnalysis} disabled={loadingAI} className="btn-primary bg-purple-600 hover:bg-purple-700 mx-auto">
                {loadingAI ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing...</> : <><Zap className="w-4 h-4" />Get AI Forecast Analysis</>}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">{aiAnalysis}</div>
              </div>
              <button onClick={getAIAnalysis} disabled={loadingAI} className="btn-secondary text-sm">
                {loadingAI ? <><Loader2 className="w-4 h-4 animate-spin" />Refreshing...</> : 'Refresh Analysis'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
