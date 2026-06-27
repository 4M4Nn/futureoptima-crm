import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LeadsPage from './pages/leads/LeadsPage';
import LeadDetailPage from './pages/leads/LeadDetailPage';
import StudentsPage from './pages/students/StudentsPage';
import StudentDetailPage from './pages/students/StudentDetailPage';
import PaymentsPage from './pages/payments/PaymentsPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import AIAssistantPage from './pages/ai/AIAssistantPage';
import TasksPage from './pages/TasksPage';
import CampaignsPage from './pages/CampaignsPage';
import WhatsAppPage from './pages/WhatsAppPage';
import CoursesPage from './pages/CoursesPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import ReportsPage from './pages/ReportsPage';
import ForecastPage from './pages/ForecastPage';
import FollowUpsPage from './pages/FollowUpsPage';
import FinanceDashboard from './pages/finance/FinanceDashboard';
import ExpensesPage from './pages/finance/ExpensesPage';
import SalaryPage from './pages/finance/SalaryPage';
import FinanceReportsPage from './pages/finance/FinanceReportsPage';
import CertificatesPage from './pages/CertificatesPage';
import AIChatbotPage from './pages/AIChatbotPage';

function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="followups" element={<FollowUpsPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="students/:id" element={<StudentDetailPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="forecast" element={<ForecastPage />} />
          <Route path="ai" element={<AIAssistantPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="whatsapp" element={<WhatsAppPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="finance" element={<FinanceDashboard />} />
          <Route path="finance/expenses" element={<ExpensesPage />} />
          <Route path="finance/salary" element={<SalaryPage />} />
          <Route path="finance/reports" element={<FinanceReportsPage />} />
          <Route path="certificates" element={<CertificatesPage />} />
          <Route path="chatbot" element={<AIChatbotPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
