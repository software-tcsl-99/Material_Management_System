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

      const txnsList = txnRes.data.data || [];
      const bcList = bcRes.data.data || [];

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

  // 1. Store Admin Dashboard
  if (activeRole.role === 'department_admin' && activeRole.adminType === 'store') {
    const storePending = transactions.filter(t => ['tl_approved', 'mgt_approved', 'ready_for_dispatch'].includes(t.status));
    const storeActiveBarcodes = barcodes.filter(b => b.status === 'Active');
    const storeReturnedBarcodes = barcodes.filter(b => b.status === 'Returned');

    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Store className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white m-0">
                Store Operations Command
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">Material picking list, handler assignment, and return verifications</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchDashboardData(true)} disabled={refreshing} icon={RefreshCw}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <StatsCards stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Awaiting Material Sourcing / Handler Assignment">
            {storePending.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No transactions require store dispatch.</p>
            ) : (
              <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
                {storePending.map(t => (
                  <div key={t._id} className="p-4 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-slate-500">{t.transactionId}</span>
                      <p className="text-sm font-bold truncate text-slate-800 dark:text-slate-200">{t.description || 'Logistics Request'}</p>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Priority: {t.priority}</p>
                    </div>
                    <Button size="sm" onClick={() => navigate(`/transactions/${t._id}`)}>
                      Open Action Drawer
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Awaiting Return Handover Checks">
            {barcodes.filter(b => b.status === 'Return Requested').length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">No return handovers currently requested.</p>
            ) : (
              <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
                {barcodes.filter(b => b.status === 'Return Requested').map(b => (
                  <div key={b.barcode} className="p-4 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{b.barcode}</span>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{b.materialName}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Owner: {b.owner?.fullName}</p>
                    </div>
                    <Button size="sm" variant="success" onClick={async () => {
                      if (confirm(`Confirm receipt and verify return of barcode ${b.barcode}?`)) {
                        try {
                          await api.post(`/barcodes/${b.barcode}/confirm-return`, {
                            remarks: 'Returned and physically verified at Store stock shelves.',
                            gps: { lat: 18.5204, lng: 73.8567, address: 'MIDC Store Depot' }
                          });
                          alert('Return confirmed.');
                          fetchDashboardData(true);
                        } catch (err) {
                          alert(err.response?.data?.message || 'Error confirming return');
                        }
                      }
                    }}>
                      Verify Return
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // 2. Accounts Admin Dashboard
  if (activeRole.role === 'department_admin' && activeRole.adminType === 'accounts') {
    const rdcTransactions = transactions.filter(t => t.documentType === 'RDC');
    const matchedRDCs = rdcTransactions.filter(t => t.invoiceMatchStatus === 'matched');
    const discrepantRDCs = rdcTransactions.filter(t => t.invoiceMatchStatus === 'discrepant');
    const pendingRDCs = rdcTransactions.filter(t => t.status === 'received' && t.invoiceMatchStatus === 'pending');

    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white m-0">
                Financial Matching Command
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">3-way matching, invoice checking, and RDC discrepancy holds</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchDashboardData(true)} disabled={refreshing} icon={RefreshCw}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <StatsCards stats={stats} />

        {/* Action queue */}
        <Card title="Awaiting Invoice 3-Way Match Verification">
          {pendingRDCs.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No received returnable documents awaiting invoice matches.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {pendingRDCs.map(t => (
                <div key={t._id} className="p-4 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-500">{t.transactionId}</span>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.description || 'Replenishment Order'}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Value to match: <span className="font-bold text-slate-700 dark:text-slate-300">₹{t.grandTotal.toLocaleString()}</span></p>
                  </div>
                  <Button size="sm" onClick={() => navigate(`/transactions/${t._id}`)}>
                    Match Invoice Now
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  // 3. Management / Team Lead Dashboard
  const isTL = activeRole.role === 'team_lead';
  const isMgt = activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'management');
  
  if (isTL || isMgt) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in duration-200">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {isTL ? <UserCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" /> : <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white m-0">
                {isTL ? 'Team Approvals Commander' : 'Executive Governance Console'}
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">{isTL ? 'Verify member requests and authorize transfers' : 'Department analytics, escalations queue, and audits'}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchDashboardData(true)} disabled={refreshing} icon={RefreshCw}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <StatsCards stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title={isTL ? "Team Approvals Queue" : "Executive Approvals Center"}>
            {pendingApprovals.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2.5" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Approval queue clear.</p>
                <p className="text-xs text-slate-500 mt-0.5">You are up to date on all requests.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pendingApprovals.map(t => (
                  <div key={t._id} className="p-4 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">{t.transactionId}</span>
                        {t.priority === 'high' || t.priority === 'critical' ? <Badge variant="danger">{t.priority}</Badge> : null}
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">{t.description || 'Material Transfer'}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Value: ₹{t.grandTotal?.toLocaleString()}</p>
                    </div>
                    <Button size="sm" onClick={() => navigate('/pending')}>
                      Action Center
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Department Logistics Activity">
            <TransactionCharts dailyData={charts.daily} docTypeData={charts.docType} activities={activities} isAdmin={true} />
          </Card>
        </div>
      </div>
    );
  }

  // 4. Employee / Default Dashboard
  const myActiveBarcodes = barcodes.filter(b => b.owner?._id === user?._id || b.owner === user?._id);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white m-0">
            Welcome, {user?.fullName}
          </h1>
          <p className="text-xs text-slate-500 mt-1">Manage your active materials, transfers, and loops</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchDashboardData(true)} disabled={refreshing} icon={RefreshCw}>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <StatsCards stats={stats} />

      {/* Barcode-level Inventory Loop */}
      <Card title="My Barcode Inventory (Recursive Loops)">
        {myActiveBarcodes.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500 font-semibold">You do not currently own any active materials.</p>
            <p className="text-xs text-slate-400 mt-0.5">Create a Request or scan incoming items to start.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myActiveBarcodes.map(b => (
              <div key={b.barcode} className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:shadow-md transition-shadow relative flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded uppercase tracking-wider font-mono">{b.barcode}</span>
                    <Badge variant={b.status === 'Active' ? 'success' : 'secondary'}>{b.status}</Badge>
                  </div>
                  <h4 className="text-base font-bold mt-2.5 text-slate-800 dark:text-slate-100">{b.materialName}</h4>
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {b.gps?.address || 'No Location registered'}</p>
                </div>
                
                {/* Operations */}
                <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  <Button variant="outline" size="xs" icon={Send} className="flex-1 text-[11px]" onClick={() => setActiveBarcodeAction({ barcode: b, type: 'transfer' })}>
                    Transfer
                  </Button>
                  <Button variant="outline" size="xs" icon={Reply} className="flex-1 text-[11px]" onClick={() => setActiveBarcodeAction({ barcode: b, type: 'return' })}>
                    Return
                  </Button>
                  <Button variant="outline" size="xs" icon={Split} className="flex-1 text-[11px]" onClick={() => setActiveBarcodeAction({ barcode: b, type: 'split' })}>
                    Split Lot
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {renderModals()}
    </div>
  );
};

export default DashboardPage;
