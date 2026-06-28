import { Bell, LogOut, Wifi, WifiOff, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function Topbar({ title, onMenuClick }) {
  const { logout, user } = useAuthStore();
  const navigate = useNavigate();
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/ai/health').then(r => r.data),
    refetchInterval: 60000,
  });

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <header className="h-14 md:h-16 bg-white border-b border-gray-100 flex items-center px-3 md:px-6 gap-3 flex-shrink-0">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-500 flex-shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="text-base md:text-lg font-semibold text-gray-900 flex-1 truncate">{title}</h1>

      {/* AI status */}
      <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${health?.running ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
        {health?.running ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
        <span className="hidden sm:inline">{health?.running ? 'AI: Groq ⚡' : 'AI Offline'}</span>
        <span className="sm:hidden">{health?.running ? '⚡' : '✗'}</span>
      </div>

      <button className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 relative flex-shrink-0">
        <Bell className="w-5 h-5" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
      </button>

      <button
        onClick={handleLogout}
        className="flex items-center gap-2 px-2 md:px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex-shrink-0 min-h-[44px]"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:block">Logout</span>
      </button>
    </header>
  );
}
