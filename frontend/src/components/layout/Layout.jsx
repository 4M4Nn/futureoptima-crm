import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const TITLES = {
  '/dashboard': 'Dashboard', '/leads': 'Lead Management', '/students': 'Students',
  '/payments': 'Payments & Fees', '/analytics': 'Analytics', '/ai': 'AI Assistant',
  '/tasks': 'Tasks', '/campaigns': 'WhatsApp Campaigns', '/whatsapp': 'WhatsApp Messages',
  '/courses': 'Courses', '/users': 'Users', '/settings': 'Settings',
};

export default function Layout() {
  const { pathname } = useLocation();
  const title = Object.entries(TITLES).find(([k]) => pathname.startsWith(k))?.[1] || 'Nexora CRM';
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
