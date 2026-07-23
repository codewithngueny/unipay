import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthPage } from '@/pages/AuthPage';
import { CustomerDashboard } from '@/pages/CustomerDashboard';
import { AccountantDashboard } from '@/pages/AccountantDashboard';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { PageLoader } from '@/components/ui';

function AppRoutes() {
  const { session, profile, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!session) return <AuthPage />;
  if (!profile) return <PageLoader />;

  if (profile.role === 'admin') return <AdminDashboard />;
  if (profile.role === 'accountant') return <AccountantDashboard />;
  return <CustomerDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
