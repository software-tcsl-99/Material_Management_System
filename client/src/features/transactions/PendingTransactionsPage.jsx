import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, CheckCircle, XCircle, Clock, Eye, AlertTriangle, 
  ArrowRight, Shield, Layers, FileText, CheckSquare, Square
} from 'lucide-react';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';
import useActiveRole from '../../hooks/useActiveRole';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

const PendingTransactionsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const activeRole = useActiveRole();

  const [loading, setLoading] = useState(true);
  const [txns, setTxns] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState(null);
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDueToday, setFilterDueToday] = useState(false);
  const [filterEscalated, setFilterEscalated] = useState(false);
  const [filterCrossDept, setFilterCrossDept] = useState(false);
  const [statusTab, setStatusTab] = useState('pending'); // 'pending' | 'approved' | 'rejected'

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Action state
  const [actionError, setActionError] = useState('');
  const [actionRemarks, setActionRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const res = await api.get('/transactions');
      setTxns(res.data.data || []);
      
      // Select first item by default if available
      const pendingList = (res.data.data || []).filter(t => t.status === 'submitted' || t.status === 'tl_approved');
      if (pendingList.length > 0) {
        setSelectedTxn(pendingList[0]);
      }
    } catch (err) {
      console.error('Error fetching approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [activeRole.role, activeRole.adminType]);

  // Apply filters
  const filteredTxns = txns.filter(t => {
    // 1. Status mapping
    if (statusTab === 'pending') {
      // Pending approvals for Team Lead vs Management
      if (activeRole.role === 'team_lead') {
        if (t.status !== 'submitted') return false;
      } else if (activeRole.role === 'department_admin' && activeRole.adminType === 'management') {
        if (!['submitted', 'tl_approved'].includes(t.status)) return false;
      } else {
        // Fallback: show standard submitted if not a designated approver
        if (!['submitted', 'tl_approved'].includes(t.status)) return false;
      }
    } else if (statusTab === 'approved') {
      if (!['ready_for_dispatch', 'store_accepted', 'handler_assigned', 'dispatched', 'received', 'closed'].includes(t.status)) return false;
    } else if (statusTab === 'rejected') {
      if (t.status !== 'rejected') return false;
    }

    // 2. Search query
    if (search) {
      const q = search.toLowerCase();
      const matchId = t.transactionId.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchSender = t.sender?.fullName?.toLowerCase().includes(q);
      if (!matchId && !matchDesc && !matchSender) return false;
    }

    // 3. Priority filter
    if (filterPriority && t.priority !== filterPriority) return false;

    // 4. Department filter
    if (filterDept && t.sender?.department?.name !== filterDept) return false;

    // 5. Due Today filter
    if (filterDueToday) {
      const today = new Date().toDateString();
      const isDueToday = t.dueDate && new Date(t.dueDate).toDateString() === today;
      if (!isDueToday) return false;
    }

    // 6. Escalated filter
    if (filterEscalated && !t.escalated) return false;

    // 7. Cross Dept filter
    if (filterCrossDept && !t.crossDepartment) return false;

    return true;
  });

  const handleSelectAll = () => {
    if (selectedIds.size === filteredTxns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTxns.map(t => t._id)));
    }
  };

  const handleToggleSelect = (id) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setSelectedIds(updated);
  };

  const handleApproveReject = async (action, txnId = null) => {
    setActionError('');
    setSubmitting(true);
    const idsToProcess = txnId ? [txnId] : Array.from(selectedIds);
    if (idsToProcess.length === 0) {
      setActionError('Select at least one transaction to process.');
      setSubmitting(false);
      return;
    }

    try {
      const promises = idsToProcess.map(id => {
        const endpoint = action === 'approve' ? `/transactions/${id}/accept` : `/transactions/${id}/reject`;
        return api.patch(endpoint, { 
          remarks: actionRemarks,
          rejectionReason: actionRemarks || 'Rejected in bulk action' 
        });
      });

      await Promise.all(promises);
      alert(`${action === 'approve' ? 'Approved' : 'Rejected'} ${idsToProcess.length} requests.`);
      setSelectedIds(new Set());
      setActionRemarks('');
      fetchApprovals();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Approval action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 h-[calc(100vh-7rem)] overflow-hidden">
      {/* Top action header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
            Approvals Command Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">Active Role Profile: <span className="font-bold text-blue-600 dark:text-blue-400">{activeRole.label}</span></p>
        </div>

        {/* Bulk Action Panel */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-xl animate-in slide-in-from-top-2">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 mr-2">{selectedIds.size} Selected</span>
            <Button size="xs" variant="success" onClick={() => handleApproveReject('approve')} disabled={submitting}>
              Bulk Approve
            </Button>
            <Button size="xs" className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => handleApproveReject('reject')} disabled={submitting}>
              Bulk Reject
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 shrink-0">
        <button onClick={() => setStatusTab('pending')} className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${statusTab === 'pending' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>
          Pending Approvals
        </button>
        <button onClick={() => setStatusTab('approved')} className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${statusTab === 'approved' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>
          Approved History
        </button>
        <button onClick={() => setStatusTab('rejected')} className={`pb-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${statusTab === 'rejected' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>
          Rejected List
        </button>
      </div>

      {/* Filters and search block */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4.5 rounded-xl shadow-sm flex flex-col md:flex-row gap-3.5 shrink-0">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="search"
            placeholder="Search request ID, sender..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg px-3 py-1.5 focus:outline-none font-bold"
        >
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>

        {/* Toggle checkboxes */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={filterDueToday} onChange={(e) => setFilterDueToday(e.target.checked)} className="rounded text-indigo-600" />
            <span>Due Today</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={filterEscalated} onChange={(e) => setFilterEscalated(e.target.checked)} className="rounded text-indigo-600" />
            <span>Escalated</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={filterCrossDept} onChange={(e) => setFilterCrossDept(e.target.checked)} className="rounded text-indigo-600" />
            <span>Cross-Dept</span>
          </label>
        </div>
      </div>

      {/* Main split display layout */}
      <div className="flex-1 flex gap-5 overflow-hidden min-h-0">
        {/* Left Side: Cards Queue list */}
        <div className="w-full md:w-[350px] lg:w-[380px] flex flex-col gap-3 overflow-y-auto pr-1">
          {filteredTxns.length === 0 ? (
            <div className="text-center py-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
              <p className="text-sm font-semibold text-slate-500">Queue is empty</p>
            </div>
          ) : (
            <>
              {/* Select All */}
              <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/40 p-2.5 rounded-lg text-xs font-semibold">
                <button onClick={handleSelectAll} className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-300">
                  {selectedIds.size === filteredTxns.length ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                  Select All listed
                </button>
              </div>

              {filteredTxns.map(t => {
                const isSelected = selectedIds.has(t._id);
                const isActive = selectedTxn?._id === t._id;
                return (
                  <div 
                    key={t._id} 
                    onClick={() => setSelectedTxn(t)}
                    className={`p-4 bg-white dark:bg-slate-900 border rounded-xl hover:shadow-md cursor-pointer transition-all relative flex flex-col gap-2
                      ${isActive ? 'border-indigo-500 ring-1 ring-indigo-500/20' : 'border-slate-200/80 dark:border-slate-800'}
                    `}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {/* Checkbox select */}
                        <button onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelect(t._id);
                        }} className="text-slate-400 hover:text-indigo-600">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                        </button>
                        <span className="text-xs font-bold text-slate-500">{t.transactionId}</span>
                      </div>
                      {t.priority === 'high' || t.priority === 'critical' ? (
                        <Badge variant="danger">{t.priority}</Badge>
                      ) : (
                        <Badge>{t.priority}</Badge>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-1">{t.description || 'Logistics Request'}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Sender: <span className="font-semibold">{t.sender?.fullName}</span></p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
                      <span>{t.documentType} No: {t.documentNumber || '-'}</span>
                      <span className="text-slate-700 dark:text-slate-300 font-extrabold">₹{t.grandTotal.toLocaleString()}</span>
                    </div>

                    {t.crossDepartment && (
                      <span className="absolute top-2.5 right-20 text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded">Cross-Dept</span>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Right Side: Selected details preview workspace */}
        <div className="hidden md:flex flex-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex-col">
          {selectedTxn ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Workspace Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">{selectedTxn.transactionId}</span>
                    <Badge variant={selectedTxn.status === 'rejected' ? 'danger' : 'primary'}>{selectedTxn.status}</Badge>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-800 dark:text-white mt-1">{selectedTxn.description || 'Material Logistics Dossier'}</h3>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate(`/transactions/${selectedTxn._id}`)}>
                  Open full transaction view
                </Button>
              </div>

              {/* Workspace Body scroll */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                {/* Basic Stats row */}
                <div className="grid grid-cols-3 gap-4.5 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">SENDER</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedTxn.sender?.fullName}</span>
                    <span className="block text-slate-400 text-[10px]">{selectedTxn.sender?.department?.name || 'Engineering'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">EXPECTED RETURN</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedTxn.expectedReturnDate ? new Date(selectedTxn.expectedReturnDate).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">GRAND TOTAL</span>
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400">₹{selectedTxn.grandTotal?.toLocaleString()}</span>
                  </div>
                </div>

                {/* Materials Table */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Item Breakdown & Barcode Maps</h4>
                  <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-950/40 text-slate-500 font-bold">
                        <tr>
                          <th className="px-4 py-2">Material / Barcode</th>
                          <th className="px-4 py-2">Quantity</th>
                          <th className="px-4 py-2 text-right">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedTxn.materials?.map((mat, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                            <td className="px-4 py-2.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{mat.name}</span>
                              <span className="block text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5 font-semibold font-mono">{mat.barcode}</span>
                            </td>
                            <td className="px-4 py-2.5">{mat.quantity} {mat.unit}</td>
                            <td className="px-4 py-2.5 text-right font-semibold">₹{mat.total?.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Approval Comments Form (only if status is pending) */}
                {statusTab === 'pending' && (
                  <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Decision Comments / Remarks</label>
                      <textarea
                        value={actionRemarks}
                        onChange={(e) => setActionRemarks(e.target.value)}
                        placeholder="Add optional remarks or rejection reason..."
                        rows="3"
                        className="w-full text-sm bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-indigo-500 dark:text-white px-3.5 py-2"
                      />
                    </div>

                    {actionError && <p className="text-xs text-rose-500 font-bold">{actionError}</p>}

                    <div className="flex gap-3 justify-end">
                      <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => handleApproveReject('reject', selectedTxn._id)} disabled={submitting}>
                        Reject
                      </Button>
                      <Button variant="success" onClick={() => handleApproveReject('approve', selectedTxn._id)} disabled={submitting}>
                        Approve & Forward
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
              <Clock className="w-12 h-12 mb-3.5 text-slate-300" />
              <p className="text-sm font-semibold">Select a request card to inspect</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PendingTransactionsPage;
