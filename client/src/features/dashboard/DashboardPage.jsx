import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, Package, ArrowRight, Shield, Store, Wallet, UserCheck, 
  Users, Clock, AlertTriangle, CheckCircle, FileText, Send, Reply, 
  MapPin, Plus, Split, Search, AlertCircle
} from 'lucide-react';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';
import useActiveRole from '../../hooks/useActiveRole';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import StatsCards from './StatsCards';
import TransactionCharts from './TransactionCharts';
import TransferFormModal from '../transactions/TransferFormModal';
import ReturnFormModal from '../transactions/ReturnFormModal';
import SplitLotModal from '../transactions/SplitLotModal';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

const DashboardPage = () => {
  const navigate = useNavigate();
  const activeRole = useActiveRole();
  const { user } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState({ daily: [], docType: [] });
  const [activities, setActivities] = useState([]);
  
  const [barcodes, setBarcodes] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  
  // Modal states
  const [activeBarcodeAction, setActiveBarcodeAction] = useState(null); // { barcode, type: 'transfer'|'return'|'split' }
  const [employees, setEmployees] = useState([]);

  const fetchDashboardData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [statsRes, chartsRes, recentRes, txnRes, bcRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/charts'),
        api.get('/dashboard/recent'),
        api.get('/transactions'),
        api.get('/barcodes')
      ]);

      let txnsList = txnRes.data.data || [];
      let bcList = bcRes.data.data || [];

      const isCentralRole = user?.role === 'super_admin' || 
        (user?.role === 'department_admin' && ['store', 'management', 'accounts'].includes(user?.departmentAdminType));

      if (!isCentralRole) {
        txnsList = txnsList.filter(t => {
          const reqId = (t.requester?._id || t.requester)?.toString();
          const hdlId = (t.handler?._id || t.handler)?.toString();
          const tlId = (t.teamLead?._id || t.teamLead)?.toString();
          const mgtId = (t.managementApprover?._id || t.managementApprover)?.toString();
          const storeId = (t.store?._id || t.store)?.toString();
          const deptId = (t.department?._id || t.department)?.toString();
          
          const curUserId = user?._id?.toString();
          const curUserDeptId = (user?.department?._id || user?.department)?.toString();
          
          if ((user?.role === 'team_lead' || user?.role === 'department_admin') && deptId === curUserDeptId) {
            return true;
          }
          
          return reqId === curUserId || hdlId === curUserId || tlId === curUserId || mgtId === curUserId || storeId === curUserId;
        });

        bcList = bcList.filter(b => {
          const curUserId = user?._id?.toString();
          const ownerId = (b.owner?._id || b.owner)?.toString();
          const inHistory = b.history?.some(h => (h.user?._id || h.user)?.toString() === curUserId);
          const inOwnership = b.ownershipHistory?.some(oh => (oh.user?._id || oh.user)?.toString() === curUserId);
          
          return ownerId === curUserId || inHistory || inOwnership;
        });
      }

      setTransactions(txnsList);
      setBarcodes(bcList);
      setActivities(recentRes.data.data || []);

      // Derive counts for StatsCards matching mockup layout
      const activeItemsCount = bcList.filter(b => b.status === 'Active').length;
      const pendingCount = txnsList.filter(t => ['submitted', 'tl_approved', 'store_accepted', 'handler_assigned'].includes(t.status)).length;
      const returnedCount = bcList.filter(b => b.status === 'Returned').length;
      const closedCount = txnsList.filter(t => ['completed', 'rejected'].includes(t.status)).length;

      setStats({
        activeItems: activeItemsCount,
        pending: pendingCount,
        returned: returnedCount,
        closed: closedCount
      });

      const chartData = chartsRes.data.data?.charts || {};
      const dailyData = (chartData.dailyTransactions || []).map((d) => ({ date: d._id, count: d.count }));
      const docType = (chartData.docTypeDistribution || []).map((d) => ({ name: d._id, value: d.count }));
      setCharts({ daily: dailyData, docType });

      // Filter approvals
      const pendingList = txnsList.filter(t => {
        if (activeRole.role === 'team_lead') {
          return t.status === 'submitted';
        }
        if (activeRole.role === 'department_admin' && activeRole.adminType === 'management') {
          return ['submitted', 'tl_approved'].includes(t.status);
        }
        return false;
      });
      setPendingApprovals(pendingList);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    api.get('/employees').then(res => {
      setEmployees((res.data.data || []).map(e => ({ value: e._id, label: `${e.fullName} (${e.employeeId})` })));
    }).catch(err => console.error(err));
  }, [activeRole.role, activeRole.adminType]);

  if (loading) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Retrieving secure executive dashboards...
        </p>
      </div>
    );
  }

  // Render Modals Helper
  const renderModals = () => {
    if (!activeBarcodeAction) return null;
    if (activeBarcodeAction.type === 'transfer') {
      return (
        <TransferFormModal
          isOpen={true}
          onClose={() => setActiveBarcodeAction(null)}
          barcode={activeBarcodeAction.barcode}
          onSuccess={() => {
            setActiveBarcodeAction(null);
            fetchDashboardData(true);
          }}
        />
      );
    }
    if (activeBarcodeAction.type === 'return') {
      return (
        <ReturnFormModal
          isOpen={true}
          onClose={() => setActiveBarcodeAction(null)}
          barcode={activeBarcodeAction.barcode}
          onSuccess={() => {
            setActiveBarcodeAction(null);
            fetchDashboardData(true);
          }}
        />
      );
    }
    if (activeBarcodeAction.type === 'split') {
      return (
        <SplitLotModal
          isOpen={true}
          onClose={() => setActiveBarcodeAction(null)}
          barcode={activeBarcodeAction.barcode}
          onSuccess={() => {
            setActiveBarcodeAction(null);
            fetchDashboardData(true);
          }}
        />
      );
    }
    return null;
  };

  // Unified Premium Dashboard rendering for all users
  const totalItemsCount = (stats?.activeItems || 0) + (stats?.pending || 0) + (stats?.returned || 0) + (stats?.closed || 0);
  const pieData = [
    { name: 'Active', value: stats?.activeItems || 0, color: '#10b981' },
    { name: 'Pending', value: stats?.pending || 0, color: '#f59e0b' },
    { name: 'Returned', value: stats?.returned || 0, color: '#34d399' },
    { name: 'Closed', value: stats?.closed || 0, color: '#94a3b8' }
  ];

  const getProgressPercentage = (status) => {
    switch (status?.toLowerCase()) {
      case 'submitted': return 20;
      case 'tl_approved': return 40;
      case 'mgt_approved': return 55;
      case 'store_accepted':
      case 'handler_assigned': return 70;
      case 'dispatched': return 85;
      case 'received':
      case 'active':
      case 'partially_returned': return 90;
      case 'closed':
      case 'completed': return 100;
      case 'rejected': return 100;
      default: return 0;
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white m-0">
            Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Real-time logistics analytics and loop management overview</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchDashboardData(true)} disabled={refreshing} icon={RefreshCw}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Active Items</span>
          <span className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5">{stats?.activeItems ?? 0}</span>
          <span className="text-[10px] text-slate-400 font-semibold mt-1">In circulation</span>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Pending</span>
          <span className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5">{stats?.pending ?? 0}</span>
          <span className="text-[10px] text-slate-400 font-semibold mt-1">Awaiting action</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Returned</span>
          <span className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5">{stats?.returned ?? 0}</span>
          <span className="text-[10px] text-slate-400 font-semibold mt-1">Returned to store</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Closed</span>
          <span className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5">{stats?.closed ?? 0}</span>
          <span className="text-[10px] text-slate-400 font-semibold mt-1">Completed</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Items by Status Donut Chart */}
        <Card title="Items by Status" className="flex flex-col justify-between">
          <div className="h-64 w-full flex items-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#ffffff'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Total count in the center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-5px]">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
              <span className="text-2xl font-black text-slate-800 dark:text-white leading-none mt-0.5">{totalItemsCount}</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 mt-4 px-3">
            {pieData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-650 dark:text-slate-400 capitalize">{item.name}</span>
                </div>
                <span className="text-slate-800 dark:text-slate-200">
                  {item.value} ({totalItemsCount > 0 ? Math.round((item.value / totalItemsCount) * 100) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Right: Requests Over Time Line/Area Chart */}
        <div className="lg:col-span-2">
          <Card title="Requests Over Time (This Month)">
            <div className="h-[310px] w-full mt-2">
              {charts.daily.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400">No trend data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts.daily} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.08)" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="transparent" />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="transparent" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                        border: '1px solid rgba(255, 255, 255, 0.1)', 
                        borderRadius: '8px',
                        fontSize: '11px',
                        color: '#ffffff'
                      }} 
                    />
                    <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Transactions Table Card */}
      <Card title="Recent Transactions">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Requester</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-200">
              {transactions.slice(0, 5).map((t) => {
                const progressPct = getProgressPercentage(t.status);
                const dateStr = new Date(t.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });
                return (
                  <tr key={t._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <span 
                        onClick={() => navigate(`/transactions/${t._id}`)}
                        className="font-extrabold text-blue-650 hover:underline cursor-pointer tracking-wider"
                      >
                        {t.transactionId}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">{t.requester?.fullName || 'System User'}</td>
                    <td className="py-3.5 px-4 text-slate-500">{dateStr}</td>
                    <td className="py-3.5 px-4">
                      {t.status === 'closed' || t.status === 'completed' ? (
                        <Badge variant="success">Completed</Badge>
                      ) : t.status === 'rejected' ? (
                        <Badge variant="danger">Closed</Badge>
                      ) : ['submitted', 'tl_approved', 'mgt_approved'].includes(t.status) ? (
                        <Badge variant="warning">Pending</Badge>
                      ) : (
                        <Badge variant="info">In Progress</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden shrink-0">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              t.status === 'rejected' ? 'bg-slate-400' : 'bg-emerald-500'
                            }`} 
                            style={{ width: `${progressPct}%` }} 
                          />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 tracking-wider">{progressPct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-10 text-center text-slate-400 italic">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {renderModals()}
    </div>
  );
};

export default DashboardPage;
