import 'leaflet/dist/leaflet.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import useAuthStore from './store/authStore';

// Layout & Foundation
import AppLayout from './components/layout/AppLayout';

// Pages
import ForceChangePasswordPage from './features/auth/ForceChangePasswordPage';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './features/dashboard/DashboardPage';

// Transactions
import CreateTransactionPage from './features/transactions/CreateTransactionPage';
import EditTransactionPage from './features/transactions/EditTransactionPage';
import PendingTransactionsPage from './features/transactions/PendingTransactionsPage';
import TransactionDetailPage from './features/transactions/TransactionDetailPage';
import TransactionListPage from './features/transactions/TransactionListPage';

// Receiving
import ExternalReceiptDetailPage from './features/receiving/ExternalReceiptDetailPage';
import ExternalReceivingPage from './features/receiving/ExternalReceivingPage';
import InternalReceivingPage from './features/receiving/InternalReceivingPage';
import ReceivingDashboardPage from './features/receiving/ReceivingDashboardPage';

// General features
import ProfilePage from './features/profile/ProfilePage';
import ReportsPage from './features/reports/ReportsPage';
import GlobalSearch from './features/search/GlobalSearch';

// Admin Pages
import CreateEmployeePage from './features/employees/CreateEmployeePage';
import EditEmployeePage from './features/employees/EditEmployeePage';
import EmployeeListPage from './features/employees/EmployeeListPage';
import MastersPage from './features/masters/MastersPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Route Guards
const AuthGuard = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Don't force password change; allow user to proceed

  return children;
};

const AdminGuard = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!['super_admin', 'admin'].includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const GuestGuard = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const ForcePasswordGuard = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Allow access to change-password page for authenticated users (no forced requirement)

  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Guest Routes */}
          <Route
            path="/login"
            element={
              <GuestGuard>
                <LoginPage />
              </GuestGuard>
            }
          />

          {/* First Login Password Change Guard */}
          <Route
            path="/change-password"
            element={
              <ForcePasswordGuard>
                <ForceChangePasswordPage />
              </ForcePasswordGuard>
            }
          />

          {/* Protected Routes inside Layout */}
          <Route
            path="/"
            element={
              <AuthGuard>
                <AppLayout />
              </AuthGuard>
            }
          >
            {/* Core pages */}
            <Route index element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="search" element={<GlobalSearch />} />

            {/* Transactions flow */}
            <Route path="transactions" element={<TransactionListPage />} />
            <Route path="transactions/create" element={<CreateTransactionPage />} />
            <Route path="transactions/:id" element={<TransactionDetailPage />} />
            <Route path="transactions/edit/:id" element={<EditTransactionPage />} />
            <Route path="pending" element={<PendingTransactionsPage />} />

            {/* Receiving flow */}
            <Route path="receiving" element={<ReceivingDashboardPage />} />
            <Route path="receiving/internal" element={<InternalReceivingPage />} />
            <Route path="receiving/external" element={<ExternalReceivingPage />} />
            <Route path="receiving/:id" element={<ExternalReceiptDetailPage />} />

            {/* Admin only pages */}
            <Route
              path="employees"
              element={
                <AdminGuard>
                  <EmployeeListPage />
                </AdminGuard>
              }
            />
            <Route
              path="employees/create"
              element={
                <AdminGuard>
                  <CreateEmployeePage />
                </AdminGuard>
              }
            />
            <Route
              path="employees/edit/:id"
              element={
                <AdminGuard>
                  <EditEmployeePage />
                </AdminGuard>
              }
            />
            <Route
              path="masters"
              element={
                <AdminGuard>
                  <MastersPage />
                </AdminGuard>
              }
            />
          </Route>

          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
