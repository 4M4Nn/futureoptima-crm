import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Share2, Copy, RefreshCw, CheckCircle, ArrowUpRight } from 'lucide-react';
import api from '../utils/api';
import { timeAgo } from '../utils/constants';
import { LoadingState, GradeBadge } from '../components/ui/index';
import toast from 'react-hot-toast';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'https://YOUR_BACKEND_URL';
const WEBHOOK_URL = `${BACKEND_URL}/api/meta/webhook`;
const VERIFY_TOKEN = 'futureoptima_meta_2025';
const APP_ID = '1314736140263066';

function CopyField({ label, value, note }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
      <div className="text-xs text-gray-500 mb-1.5 font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <code className="text-xs text-gray-800 flex-1 break-all font-mono bg-white px-2 py-1.5 rounded-lg border border-gray-100">{value}</code>
        <button onClick={copy} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0" title="Copy">
          {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
        </button>
      </div>
      {note && <p className="text-xs text-amber-600 mt-1.5 leading-relaxed">{note}</p>}
    </div>
  );
}

const FB_STEPS = [
  'Go to business.facebook.com/adsmanager',
  'Click Create → Lead generation campaign',
  'Select Future Optima IT Solutions page',
  'In Instant Form, add these fields:\n  • Full Name\n  • Phone Number\n  • Email Address\n  • Custom question: "Which course are you interested in?"',
  'Add dropdown options:\n  AI Engineering & Automation\n  Data Science with AI\n  AI-Powered Cybersecurity\n  Python Full Stack with AI\n  Vibe Coding & SaaS Development\n  Data Analytics\n  Business Analytics',
  'Go to developers.facebook.com',
  'Open Future Optima CRM app (App ID: 1314736140263066)',
  'Use Cases → Capture & manage ad leads → Webhooks',
  'Click Add Callback URL',
  'Paste the Webhook URL and Verify Token from above',
  'Click Verify and Save',
  'Subscribe to the leadgen field',
  '🎉 Publish your Lead Ad — every new lead appears in CRM within seconds!',
];

const IG_STEPS = [
  'Go to Future Optima Instagram business account',
  'Settings → Account → Switch to Professional Account (if not done)',
  'Connect Instagram to the Future Optima Facebook Page',
  'Go to Meta Ads Manager → Create Campaign → Lead generation',
  'Select Instagram as the placement for your ad',
  'Use the same Instant Form as Facebook (same fields)',
  'The same webhook above automatically receives Instagram leads too',
  '🎉 Instagram leads appear with pink 📸 IG badge in the CRM',
];

export default function MetaAdsPage() {
  const [setupTab, setSetupTab] = useState('facebook');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['meta-stats'],
    queryFn: () => api.get('/meta/stats').then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: leadsData, isLoading: leadsLoading, refetch } = useQuery({
    queryKey: ['meta-leads'],
    queryFn: () => api.get('/meta/leads').then(r => r.data),
    refetchInterval: 30000,
  });

  const leads = leadsData?.leads || [];

  // Build daily chart data from stats
  const dailyChartData = useMemo(() => {
    if (!stats?.dailyFacebook?.length && !stats?.dailyInstagram?.length) return [];
    const days = {};
    (stats.dailyFacebook || []).forEach(d => {
      days[d.day] = { day: d.day.slice(8), facebook: d.count, instagram: 0 };
    });
    (stats.dailyInstagram || []).forEach(d => {
      if (!days[d.day]) days[d.day] = { day: d.day.slice(8), facebook: 0, instagram: 0 };
      days[d.day].instagram = d.count;
    });
    return Object.values(days).sort((a, b) => a.day.localeCompare(b.day));
  }, [stats]);

  const STAT_CARDS = [
    {
      label: 'Facebook Today',
      value: stats?.facebook_today ?? 0,
      icon: '📘',
      color: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-700',
      sub: `${stats?.facebook_week ?? 0} this week`,
    },
    {
      label: 'Instagram Today',
      value: stats?.instagram_today ?? 0,
      icon: '📸',
      color: 'bg-pink-50 border-pink-200',
      textColor: 'text-pink-700',
      sub: `${stats?.instagram_week ?? 0} this week`,
    },
    {
      label: 'Total This Month',
      value: (stats?.facebook_month ?? 0) + (stats?.instagram_month ?? 0),
      icon: '📅',
      color: 'bg-indigo-50 border-indigo-200',
      textColor: 'text-indigo-700',
      sub: 'FB + IG combined',
    },
    {
      label: 'All Time Total',
      value: stats?.total ?? 0,
      icon: '🏆',
      color: 'bg-amber-50 border-amber-200',
      textColor: 'text-amber-700',
      sub: 'all Meta leads',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Meta Ads Integration</h1>
        <p className="text-gray-500 text-sm">Facebook & Instagram lead ads — auto-imported and AI-scored in real time</p>
      </div>

      {/* Section 1: Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ label, value, icon, color, textColor, sub }) => (
          <div key={label} className={`rounded-2xl p-4 border ${color}`}>
            <div className="text-2xl mb-1">{icon}</div>
            <div className={`text-3xl font-bold ${textColor}`}>{statsLoading ? '—' : value}</div>
            <div className={`text-sm font-semibold mt-0.5 ${textColor}`}>{label}</div>
            <div className="text-xs text-gray-500 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* Section 2: Connection Status + Webhook Setup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Meta Integration Status */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
              <Share2 className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="section-title">Meta Integration Status</h3>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-green-600">Connected</span>
            </div>
          </div>
          <div className="space-y-0">
            {[
              ['App ID', APP_ID],
              ['Status', 'Connected ✅'],
              ['Permissions', 'ads_read, leads_retrieval, pages_read_engagement'],
              ['Institute', 'Future Optima IT Solutions'],
              ['Phone', '+91-8891129333'],
              ['Email', 'info@futureoptimaitsolutions.com'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-400 font-medium">{k}</span>
                <span className="text-xs font-medium text-gray-800 text-right max-w-[58%]">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Webhook Configuration */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <Share2 className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="section-title">Webhook Configuration</h3>
          </div>
          <CopyField
            label="Webhook URL — paste in Facebook Developer Console"
            value={WEBHOOK_URL}
            note="Note: Replace YOUR_BACKEND_URL with your Render backend URL after deployment."
          />
          <CopyField label="Verify Token" value={VERIFY_TOKEN} />
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
            <strong>After setup:</strong> Subscribe to the <strong>leadgen</strong> field in your Facebook App → Webhook settings. New leads will appear here within seconds of form submission.
          </div>
        </div>
      </div>

      {/* Section 3: Setup Instructions Tabs */}
      <div className="card overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setSetupTab('facebook')}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${setupTab === 'facebook' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span className="w-5 h-5 bg-blue-600 rounded text-white text-xs flex items-center justify-center font-bold flex-shrink-0">f</span>
            Facebook Lead Ads Setup
          </button>
          <button
            onClick={() => setSetupTab('instagram')}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${setupTab === 'instagram' ? 'border-pink-600 text-pink-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span className="text-base">📸</span>
            Instagram Lead Ads Setup
          </button>
        </div>
        <div className="p-5">
          <ol className="space-y-3">
            {(setupTab === 'facebook' ? FB_STEPS : IG_STEPS).map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5 ${setupTab === 'facebook' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                  {i + 1}
                </span>
                <span className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>

          {/* Course mapping */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Auto Course Mapping</div>
            <div className="grid grid-cols-2 gap-x-6">
              {[
                ['AI Engineering & Automation', 'AI Engineering'],
                ['Data Science with AI', 'Data Science + AI'],
                ['AI-Powered Cybersecurity', 'AI Cybersecurity'],
                ['Python Full Stack with AI', 'Python Full Stack'],
                ['Vibe Coding & SaaS Development', 'Vibe Coding & SaaS'],
                ['Data Analytics', 'Data Analytics'],
                ['Business Analytics', 'Business Analytics'],
              ].map(([from, to]) => (
                <div key={to} className="flex items-center gap-1.5 py-1 border-b border-gray-50 last:border-0 text-xs">
                  <span className="text-gray-400 flex-1 truncate">"{from}"</span>
                  <span className="text-gray-300">→</span>
                  <span className="font-medium text-primary-700 flex-shrink-0">{to}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: Monthly Stats Chart */}
      {dailyChartData.length > 0 && (
        <div className="card p-5">
          <h3 className="section-title mb-4">This Month — Daily Leads</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyChartData} margin={{ top: 0, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="facebook" name="Facebook" fill="#1877F2" radius={[3, 3, 0, 0]} />
              <Bar dataKey="instagram" name="Instagram" fill="#E1306C" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Section 4: Recent Meta Leads Table */}
      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <h3 className="section-title">Recent Leads from Facebook & Instagram</h3>
          <button onClick={() => refetch()} className="btn-secondary text-xs">
            <RefreshCw className="w-3 h-3" />Refresh
          </button>
        </div>
        {leadsLoading ? (
          <LoadingState />
        ) : !leads.length ? (
          <div className="p-10 text-center text-gray-400">
            <Share2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No Meta leads yet.</p>
            <p className="text-xs mt-1 max-w-sm mx-auto">
              Complete the setup above to start receiving leads automatically from your Facebook and Instagram ads.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Name', 'Phone', 'Course Interest', 'Source', 'AI Grade', 'Received', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr key={lead.id} className="table-row">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{lead.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{lead.phone}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {lead.interestedCourse?.replace(/_/g, ' ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${lead.source === 'FACEBOOK_ADS' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                          {lead.source === 'FACEBOOK_ADS' ? '📘 Facebook' : '📸 Instagram'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <GradeBadge grade={lead.aiGrade} score={lead.aiScore} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{timeAgo(lead.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Link to={`/leads/${lead.id}`} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium">
                          View Lead <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-gray-50 text-xs text-gray-400 text-right">
              Last 50 leads · Auto-refreshes every 30s
            </div>
          </>
        )}
      </div>
    </div>
  );
}
