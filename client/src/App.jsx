import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import useAuthStore from './store/authStore';

// Layout
import Layout from './components/layout/Layout';

// Pages
import AuditLogPage from './features/audit/AuditLogPage';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './features/dashboard/DashboardPage';
import EmployeeListPage from './features/employees/EmployeeListPage';
import ProfilePage from './features/profile/ProfilePage';
import ReportsPage from './features/reports/ReportsPage';
import CreateTransactionPage from './features/transactions/CreateTransactionPage';
import TransactionDetailPage from './features/transactions/TransactionDetailPage';
import TransactionListPage from './features/transactions/TransactionListPage';
import TransferListPage from './features/transactions/TransferListPage';
import ReturnListPage from './features/transactions/ReturnListPage';
import PendingTransactionsPage from './features/transactions/PendingTransactionsPage';
import EditTransactionPage from './features/transactions/EditTransactionPage';

// Sub Pages
import BarcodeDetail from './pages/BarcodeDetail';
import HandlerAssignmentPage from './pages/HandlerAssignmentPage';
import MaterialsTree from './pages/MaterialsTree';
import NotificationsPage from './pages/NotificationsPage';
import ReceivingForm from './pages/ReceivingForm';
import ReturnMaterial from './pages/ReturnMaterial';
import SplitMaterial from './pages/SplitMaterial';
import StoreDashboard from './pages/StoreDashboard';
import TransferMaterial from './pages/TransferMaterial';


// Route guards
function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return !isAuthenticated ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth route */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Protected Workspace Layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionListPage />} />
          <Route path="transactions/create" element={<CreateTransactionPage />} />
          <Route path="transactions/:id" element={<TransactionDetailPage />} />
          <Route path="transactions/:id/edit" element={<EditTransactionPage />} />
          <Route path="transactions/:id/receive" element={<ReceivingForm />} />
          <Route path="transactions/:id/assign-handler" element={<HandlerAssignmentPage />} />
          <Route path="barcodes/:barcode" element={<BarcodeDetail />} />
          <Route path="barcodes/:barcode/split" element={<SplitMaterial />} />
          <Route path="barcodes/:barcode/transfer" element={<TransferMaterial />} />
          <Route path="barcodes/:barcode/return" element={<ReturnMaterial />} />
          <Route path="materials" element={<MaterialsTree />} />
          <Route path="store" element={<StoreDashboard />} />
          <Route path="transfers" element={<TransferListPage />} />
          <Route path="returns" element={<ReturnListPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="audit-logs" element={<AuditLogPage />} />
          <Route path="users" element={<EmployeeListPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="pending" element={<PendingTransactionsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
