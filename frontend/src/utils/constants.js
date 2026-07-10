export const COURSES = {
  AI_ENGINEERING: 'AI Engineering & Automation',
  DATA_SCIENCE_AI: 'Data Science with AI',
  AI_CYBERSECURITY: 'AI-Powered Cybersecurity',
  PYTHON_FULLSTACK: 'Python Full Stack with AI',
  MERN_STACK: 'Mearn Stack Development',
  DATA_ANALYTICS: 'Data Analytics with AI',
  BUSINESS_ANALYTICS: 'Business Analytics',
  INTERNSHIP: 'Internship Programme (15 days - 1 month)',
};

export const LEAD_STATUSES = ['NEW','CONTACTED','QUALIFIED','DEMO_SCHEDULED','PROPOSAL_SENT','NEGOTIATION','WON','LOST','NURTURING'];
export const LEAD_SOURCES = ['FACEBOOK_ADS','GOOGLE_ADS','INSTAGRAM','WHATSAPP','REFERRAL','WALK_IN','WEBSITE','YOUTUBE','PHONE_CALL','EMAIL','OTHER'];
export const PAYMENT_METHODS = ['CASH','UPI','BANK_TRANSFER','CHEQUE','CARD','EMI'];

export const STATUS_COLORS = {
  NEW: 'bg-blue-100 text-blue-700', CONTACTED: 'bg-indigo-100 text-indigo-700',
  QUALIFIED: 'bg-purple-100 text-purple-700', DEMO_SCHEDULED: 'bg-yellow-100 text-yellow-700',
  PROPOSAL_SENT: 'bg-orange-100 text-orange-700', NEGOTIATION: 'bg-pink-100 text-pink-700',
  WON: 'bg-green-100 text-green-700', LOST: 'bg-red-100 text-red-700',
  NURTURING: 'bg-teal-100 text-teal-700',
};

export const GRADE_CONFIG = {
  HOT: { color: 'badge-hot', dot: 'bg-red-500', label: '🔥 Hot' },
  WARM: { color: 'badge-warm', dot: 'bg-orange-500', label: '🌡️ Warm' },
  COLD: { color: 'badge-cold', dot: 'bg-blue-500', label: '🧊 Cold' },
  UNQUALIFIED: { color: 'badge-unqualified', dot: 'bg-gray-400', label: '⚪ Unqualified' },
};

export const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
export const fmtNum = (n) => new Intl.NumberFormat('en-IN').format(n || 0);
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const fmtDatetime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const timeAgo = (d) => {
  const diff = Date.now() - new Date(d);
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), days = Math.floor(h / 24);
  if (days > 0) return `${days}d ago`; if (h > 0) return `${h}h ago`; if (m > 0) return `${m}m ago`; return 'Just now';
};
