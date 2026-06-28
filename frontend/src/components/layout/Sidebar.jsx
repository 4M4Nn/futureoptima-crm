import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, GraduationCap, CreditCard, BarChart3, Bot, CheckSquare, Megaphone, MessageSquare, BookOpen, Settings, UserCog, ChevronLeft, ChevronRight, Zap, FileText, PhoneCall, DollarSign, Receipt, Wallet, FileBarChart, Award, MessageCircle, TrendingUp, X } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import api from '../../utils/api';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/followups', icon: PhoneCall, label: 'Follow-ups', followupBadge: true },
  { to: '/leads', icon: Users, label: 'Leads', badge: 'AI' },
  { to: '/students', icon: GraduationCap, label: 'Students' },
  { to: '/payments', icon: CreditCard, label: 'Payments' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/forecast', icon: TrendingUp, label: 'Forecast & Targets', badge: 'AI' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/ai', icon: Bot, label: 'AI Assistant' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  { to: '/whatsapp', icon: MessageSquare, label: 'WhatsApp' },
  { to: '/courses', icon: BookOpen, label: 'Courses' },
  { to: '/certificates', icon: Award, label: 'Certificates' },
  { to: '/chatbot', icon: MessageCircle, label: 'AI Chatbot', badge: 'New' },
  { to: '/users', icon: UserCog, label: 'Users', adminOnly: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const financeItems = [
  { to: '/finance', icon: DollarSign, label: 'Finance Dashboard' },
  { to: '/finance/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/finance/salary', icon: Wallet, label: 'Salary' },
  { to: '/finance/reports', icon: FileBarChart, label: 'Finance Reports' },
];

export default function Sidebar({ isMobileOpen, onMobileClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuthStore();

  const { data: overdueData } = useQuery({
    queryKey: ['followups', 'overdue'],
    queryFn: () => api.get('/leads/followups?period=overdue').then(r => r.data),
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const { data: todayData } = useQuery({
    queryKey: ['followups', 'today'],
    queryFn: () => api.get('/leads/followups?period=today').then(r => r.data),
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const followupCount = (overdueData?.count || 0) + (todayData?.count || 0);

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-100 flex-shrink-0">
        <div className="w-9 h-9 nexora-gradient rounded-xl flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="font-bold text-nexora text-sm leading-tight truncate">Future Optima CRM</div>
            <div className="text-xs text-gray-400 leading-tight">AI-Powered Institute</div>
          </div>
        )}
        {/* Mobile close button */}
        <button onClick={onMobileClose} className="md:hidden p-1 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0">
          <X className="w-5 h-5" />
        </button>
        {/* Desktop collapse button */}
        <button onClick={() => setCollapsed(!collapsed)} className="hidden md:block ml-auto p-1 rounded-lg hover:bg-gray-100 text-gray-400">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          if (item.adminOnly && !['SUPER_ADMIN', 'ADMIN'].includes(user?.role)) return null;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/finance'}
              onClick={onMobileClose}
              className={({ isActive }) => clsx(isActive ? 'sidebar-link-active' : 'sidebar-link-inactive', 'relative')}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && item.followupBadge && followupCount > 0 && (
                <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center">{followupCount}</span>
              )}
              {!collapsed && item.badge && (
                <span className="text-xs bg-primary-600 text-white px-1.5 py-0.5 rounded-full font-semibold">{item.badge}</span>
              )}
            </NavLink>
          );
        })}

        {/* Finance Section */}
        {['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'].includes(user?.role) && (
          <>
            {!collapsed && <div className="px-3 pt-3 pb-1 text-xs font-bold text-gray-400 uppercase tracking-wider">Finance</div>}
            {collapsed && <div className="border-t border-gray-100 my-1" />}
            {financeItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/finance'}
                onClick={onMobileClose}
                className={({ isActive }) => clsx(isActive ? 'sidebar-link-active' : 'sidebar-link-inactive', 'relative')}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      {!collapsed && (
        <div className="p-3 border-t border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 px-2 py-2 rounded-xl bg-gray-50">
            <div className="w-8 h-8 nexora-gradient rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{user?.name}</div>
              <div className="text-xs text-gray-400 truncate">{user?.role?.replace('_', ' ')}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={clsx(
        'hidden md:flex flex-col h-screen bg-white border-r border-gray-100 transition-all duration-300 z-20 flex-shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}>
        <NavContent />
      </aside>

      {/* Mobile sidebar — fixed overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 flex flex-col md:hidden shadow-xl"
          >
            <NavContent />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
