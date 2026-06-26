import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';
import RecentActivities from './RecentActivities';
import StatsCards from './StatsCards';
import TransactionCharts from './TransactionCharts';

const DashboardPage = () => {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'admin'].includes(user?.role);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState({ daily: [], dept: [], docType: [] });
  const [activities, setActivities] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [statsRes, chartsRes, recentRes, pendingRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/charts'),
        api.get('/dashboard/recent'),
        !isAdmin ? api.get('/dashboard/pending') : Promise.resolve(null)
      ]);

      // Map stats into the UI-friendly shape
      const srvStats = statsRes.data.data?.stats || {};
      setStats({
        totalSent: srvStats.total || 0,
        pendingApproval: srvStats.pending || 0,
        completedMovement: srvStats.completed || 0,
        rejectedMovement: srvStats.rejected || 0,
        internalReceipts: srvStats.internalReceipts || 0,
        externalReceipts: srvStats.externalReceipts || 0,
        activityToday: srvStats.todayCount || 0,
        activityThisMonth: srvStats.monthCount || 0,
      });

      // Transform charts structure from server -> client expected keys
      const chartData = chartsRes.data.data?.charts || {};
      const dailyData = (chartData.dailyTransactions || []).map((d) => ({ date: d._id, count: d.count }));
      const docType = (chartData.docTypeDistribution || []).map((d) => ({ name: d._id, value: d.count }));
      setCharts({ daily: dailyData, docType });

      setActivities(recentRes.data.data || []);
      if (!isAdmin) {
        setPendingApprovals(pendingRes.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Compiling business intelligence dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header Panel */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
            {isAdmin ? 'Analytics Command Center' : 'Dashboard'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin ? 'Overview of company logistics, material transfers, and approval statuses' : 'Overview of your transactions and approvals'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadDashboardData(true)}
          disabled={refreshing}
          icon={RefreshCw}
          className={refreshing ? '[&_svg]:animate-spin' : ''}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Stats Cards Section */}
      <StatsCards stats={stats} />

      {/* Analytics Charts Section */}
      <TransactionCharts
        dailyData={charts.daily}
        activities={activities}
        isAdmin={isAdmin}
        docTypeData={charts.docType}
      />

      {/* Secondary Lists Section - only for non-admin */}
      {!isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            {/* PendingApprovals removed for admin */}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
