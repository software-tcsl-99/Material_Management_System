import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, CheckCircle, XCircle, Clock, Eye, AlertTriangle, 
  ArrowRight, Shield, Layers, FileText, CheckSquare, Square,
  ArrowRightLeft, Send, UserCheck, Inbox
} from 'lucide-react';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';
import useActiveRole from '../../hooks/useActiveRole';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';

const PendingTransactionsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const activeRole = useActiveRole();

  const [loading, setLoading] = useState(true);
  const [txns, setTxns] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null); // Can be a transaction OR a barcode transfer
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDueToday, setFilterDueToday] = useState(false);
  const [filterEscalated, setFilterEscalated] = useState(false);
  const [filterCrossDept, setFilterCrossDept] = useState(false);
  const [statusTab, setStatusTab] = useState('pending'); // 'pending' | 'approved' | 'rejected'

  // Selection for bulk actions (transactions only)
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Action state
  const [actionError, setActionError] = useState('');
  const [actionRemarks, setActionRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [transferPhoto, setTransferPhoto] = useState('/images/mock-transfer.jpg');
  const [pendingSplits, setPendingSplits] = useState([]);
  const [approveNewBarcode, setApproveNewBarcode] = useState('');
  const [approveMaterialName, setApproveMaterialName] = useState('');
  const [pendingReturns, setPendingReturns] = useState([]);
  
  // Dispatch Modal States
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchTxn, setDispatchTxn] = useState(null);
  const [dispatchReceiverId, setDispatchReceiverId] = useState('');
  const [dispatchDocType, setDispatchDocType] = useState('RDC');
  const [dispatchDocNumber, setDispatchDocNumber] = useState('');
  const [dispatchCostCenter, setDispatchCostCenter] = useState('');
  const [dispatchPriority, setDispatchPriority] = useState('medium');
  const [dispatchReturnDate, setDispatchReturnDate] = useState('');
  const [dispatchBarcodes, setDispatchBarcodes] = useState([]);
  const [dispatchHandlerId, setDispatchHandlerId] = useState('');
  const [dispatchDcType, setDispatchDcType] = useState('DC-Internal');
  const [employeesList, setEmployeesList] = useState([]);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const isStore = activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'store');
      
      const [txnRes, transferRes, splitRes, returnRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/barcodes/pending/transfers'),
        isStore ? api.get('/barcodes/split-requests/pending') : Promise.resolve({ data: { data: [] } }),
        isStore ? api.get('/barcodes/returns/pending') : Promise.resolve({ data: { data: [] } })
      ]);
      
      const allTxns = txnRes.data.data || [];
      const allTransfers = transferRes.data.transfers || [];
      const allSplits = splitRes.data.data || [];
      const allReturns = returnRes.data.data || [];
      
      setTxns(allTxns);
      setPendingTransfers(allTransfers);
      setPendingSplits(allSplits);
      setPendingReturns(allReturns);
      
      // Determine default list based on user role to auto-select first item
      let defaultList = [];
      if (activeRole.role === 'employee') {
        defaultList = allTxns.filter(t => 
          (t.requester?._id === user?._id && ['submitted', 'tl_approved'].includes(t.status)) ||
          (t.handler?._id === user?._id && ['store_accepted', 'handler_assigned'].includes(t.status))
        );
      } else if (activeRole.role === 'team_lead') {
        defaultList = allTxns.filter(t => t.status === 'submitted');
      } else if (activeRole.role === 'department_admin') {
        if (activeRole.adminType === 'management') {
          defaultList = allTxns.filter(t => t.status === 'tl_approved' || (t.status === 'submitted' && t.crossDepartment));
        } else if (activeRole.adminType === 'store') {
          defaultList = allTxns.filter(t => ['submitted', 'tl_approved', 'mgt_approved', 'ready_for_dispatch', 'store_accepted'].includes(t.status));
        }
      } else if (activeRole.role === 'super_admin') {
        defaultList = allTxns.filter(t => ['submitted', 'tl_approved', 'mgt_approved'].includes(t.status));
      }

      if (defaultList.length > 0) {
        setSelectedItem(defaultList[0]);
      } else if (allTransfers.length > 0) {
        setSelectedItem(allTransfers[0]);
      } else if (allSplits.length > 0) {
        setSelectedItem(allSplits[0]);
      } else if (allReturns.length > 0) {
        setSelectedItem(allReturns[0]);
      } else {
        setSelectedItem(null);
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

  // Apply filters to transactions
  const filteredTxns = txns.filter(t => {
    // 1. Status mapping based on tab
    if (statusTab === 'pending') {
      if (activeRole.role === 'employee') {
        const isRequesterPending = t.requester?._id === user?._id && ['submitted', 'tl_approved'].includes(t.status);
        const isHandlerPending = t.handler?._id === user?._id && ['store_accepted', 'handler_assigned'].includes(t.status);
        if (!isRequesterPending && !isHandlerPending) return false;
      } else if (activeRole.role === 'team_lead') {
        // Team Lead sees department's submitted requests
        if (t.status !== 'submitted') return false;
      } else if (activeRole.role === 'department_admin') {
        if (activeRole.adminType === 'management') {
          // Management sees tl_approved or cross-department submitted requests
          if (!['tl_approved', 'submitted'].includes(t.status)) return false;
          if (t.status === 'submitted' && !t.crossDepartment) return false;
        } else if (activeRole.adminType === 'store') {
          // Store sees management approved requests ready for acceptance or handler assignment
          if (!['submitted', 'tl_approved', 'mgt_approved', 'ready_for_dispatch', 'store_accepted'].includes(t.status)) return false;
        } else {
          return false;
        }
      }
    } else if (statusTab === 'approved') {
      if (!['ready_for_dispatch', 'store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active', 'closed'].includes(t.status)) return false;
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

    // 7. Cross-Dept filter
    if (filterCrossDept && !t.crossDepartment) return false;

    return true;
  });

  // Filter pending transfers
  const filteredTransfers = pendingTransfers.filter(tr => {
    if (statusTab !== 'pending') return false; // Transfers are only shown in pending tab

    if (search) {
      const q = search.toLowerCase();
      const matchBarcode = tr.barcode.toLowerCase().includes(q);
      const matchFrom = tr.fromUser?.fullName?.toLowerCase().includes(q);
      if (!matchBarcode && !matchFrom) return false;
    }

    return true;
  });

  const handleToggleSelect = (id) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setSelectedIds(updated);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredTxns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTxns.map(t => t._id)));
    }
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
        if (action === 'approve') {
          return api.put(`/transactions/${id}/approve`, { 
            remarks: actionRemarks || 'Approved'
          });
        } else {
          return api.put(`/transactions/${id}/reject`, { 
            reason: actionRemarks || 'Rejected'
          });
        }
      });

      await Promise.all(promises);
      alert(`${action === 'approve' ? 'Approved' : 'Rejected'} ${idsToProcess.length} requests successfully.`);
      setSelectedIds(new Set());
      setActionRemarks('');
      fetchApprovals();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Approval action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferAction = async (transferId, action) => {
    setActionError('');
    setSubmitting(true);
    try {
      const payload = {
        transferId,
        action,
        reason: actionRemarks || `Transfer request ${action}ed`,
        gps: { lat: 18.5204, lng: 73.8567, address: 'MIDC Pune, India' }
      };
      if (action === 'accept') {
        payload.photos = [{ url: transferPhoto, capturedAt: new Date().toISOString() }];
      }
      await api.post('/barcodes/handle-transfer', payload);
      alert(`Transfer request ${action}ed successfully.`);
      setActionRemarks('');
      fetchApprovals();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update barcode transfer.');
    } finally {
      setSubmitting(false);
    }
  };
  const handleApproveSplitRequest = async () => {
    if (!approveNewBarcode.trim()) {
      alert('Please specify the new barcode ID.');
      return;
    }
    if (!approveMaterialName.trim()) {
      alert('Please specify the Material Name.');
      return;
    }
    setActionError('');
    setSubmitting(true);
    try {
      await api.post('/barcodes/approve-split', {
        requestId: selectedItem._id,
        newBarcode: approveNewBarcode.trim(),
        materialName: approveMaterialName.trim() || selectedItem.materialName
      });
      alert('Split request approved and new material created!');
      setApproveNewBarcode('');
      setApproveMaterialName('');
      setSelectedItem(null);
      fetchApprovals();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to approve split request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSplitRequest = async () => {
    setActionError('');
    setSubmitting(true);
    try {
      await api.post('/barcodes/approve-split', {
        requestId: selectedItem._id,
        action: 'reject',
        reason: actionRemarks || 'Rejected'
      });
      alert('Split request rejected.');
      setActionRemarks('');
      setSelectedItem(null);
      fetchApprovals();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to reject split request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptReturnRequest = async () => {
    setActionError('');
    setSubmitting(true);
    try {
      await api.put(`/barcodes/return/${selectedItem._id}/accept`);
      alert('Return request accepted successfully!');
      setSelectedItem(null);
      fetchApprovals();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to accept return request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDispatchModal = async (txn) => {
    setDispatchTxn(txn);
    setDispatchReceiverId(txn.requester?._id || '');
    setDispatchDocType(txn.documentType || 'RDC');
    setDispatchDocNumber('');
    setDispatchCostCenter(txn.costCenter || '');
    setDispatchPriority(txn.priority || 'medium');
    setDispatchReturnDate(txn.dueDate ? new Date(txn.dueDate).toISOString().split('T')[0] : '');
    
    // Initialize barcodes dictionary matching quantity for each material
    const barcodeMap = {};
    txn.materials?.forEach((mat, idx) => {
      barcodeMap[idx] = Array(mat.quantity || 1).fill('');
    });
    setDispatchBarcodes(barcodeMap);
    setDispatchHandlerId('');
    setDispatchDcType('DC-Internal');

    try {
      const response = await api.get('/employees?limit=1000&allDepartments=true');
      setEmployeesList(response.data.employees || response.data.data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
    setDispatchModalOpen(true);
  };

  const handleStoreDispatch = async (dispatchMethod) => {
    if (!dispatchDocNumber.trim()) {
      alert('Please specify the Document / Gate Pass Reference Number.');
      return;
    }
    if (dispatchMethod === 'handler' && !dispatchHandlerId) {
      alert('Please select a Handler to assign.');
      return;
    }

    // Validate barcodes are filled for all materials
    const reqMaterials = [];
    for (let matIdx = 0; matIdx < dispatchTxn.materials.length; matIdx++) {
      const mat = dispatchTxn.materials[matIdx];
      const barcodesForMat = dispatchBarcodes[matIdx] || [];
      
      for (let bcIdx = 0; bcIdx < barcodesForMat.length; bcIdx++) {
        if (!barcodesForMat[bcIdx] || !barcodesForMat[bcIdx].trim()) {
          alert(`Please fill barcode #${bcIdx + 1} for material "${mat.name}".`);
          return;
        }
      }
      
      reqMaterials.push({
        name: mat.name,
        description: mat.description || '',
        quantity: mat.quantity,
        unit: mat.unit || 'pcs',
        barcodes: barcodesForMat
      });
    }

    setSubmitting(true);
    try {
      await api.post(`/transactions/${dispatchTxn.transactionId}/store-dispatch`, {
        receiver: dispatchReceiverId,
        documentType: dispatchDocType,
        documentNumber: dispatchDocNumber,
        expectedReturnDate: dispatchReturnDate,
        priority: dispatchPriority,
        costCenter: dispatchCostCenter,
        dcType: dispatchDcType,
        materials: reqMaterials,
        dispatchMethod,
        handlerId: dispatchMethod === 'handler' ? dispatchHandlerId : undefined
      });
      
      alert('Transaction request successfully registered and dispatched!');
      setDispatchModalOpen(false);
      setSelectedItem(null);
      fetchApprovals();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to dispatch transaction request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 h-[calc(100vh-7rem)] overflow-hidden">
      {/* Top Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white m-0">
            Approvals Command Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">Active Role Profile: <span className="font-extrabold text-blue-650 dark:text-blue-400">{activeRole.label}</span></p>
        </div>

        {/* Bulk Action Panel (Transactions only) */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3.5 py-1.5 rounded-xl animate-in slide-in-from-top-2">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 mr-2">{selectedIds.size} Selected</span>
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
        <button onClick={() => setStatusTab('pending')} className={`pb-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${statusTab === 'pending' ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-slate-400'}`}>
          Pending Requests
        </button>
        {(activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'store')) && (
          <>
            <button onClick={() => setStatusTab('split_requests')} className={`pb-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${statusTab === 'split_requests' ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-slate-400'}`}>
              Split Requests ({pendingSplits.length})
            </button>
            <button onClick={() => setStatusTab('return_requests')} className={`pb-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${statusTab === 'return_requests' ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-slate-400'}`}>
              Return Requests ({pendingReturns.length})
            </button>
          </>
        )}
        <button onClick={() => setStatusTab('approved')} className={`pb-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${statusTab === 'approved' ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-slate-400'}`}>
          Approved History
        </button>
        <button onClick={() => setStatusTab('rejected')} className={`pb-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${statusTab === 'rejected' ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-slate-400'}`}>
          Rejected List
        </button>
      </div>

      {/* Filters and search block */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4.5 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3.5 shrink-0">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="search"
            placeholder="Search ID, barcode, sender..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg focus:outline-none focus:border-blue-500"
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
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-650 dark:text-slate-400">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={filterDueToday} onChange={(e) => setFilterDueToday(e.target.checked)} className="rounded text-blue-600" />
            <span>Due Today</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={filterEscalated} onChange={(e) => setFilterEscalated(e.target.checked)} className="rounded text-blue-600" />
            <span>Escalated</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={filterCrossDept} onChange={(e) => setFilterCrossDept(e.target.checked)} className="rounded text-blue-600" />
            <span>Cross-Dept</span>
          </label>
        </div>
      </div>

      {/* Main split display layout */}
      <div className="flex-1 flex gap-5 overflow-hidden min-h-0">
        
        {/* Left Side: Cards Queue list */}
        <div className="w-full md:w-[350px] lg:w-[380px] flex flex-col gap-3 overflow-y-auto pr-1">
          {((statusTab === 'pending' && filteredTxns.length === 0 && filteredTransfers.length === 0) ||
            (statusTab === 'split_requests' && pendingSplits.length === 0) ||
            (statusTab === 'return_requests' && pendingReturns.length === 0) ||
            ((statusTab === 'approved' || statusTab === 'rejected') && filteredTxns.length === 0)) ? (
            <div className="text-center py-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <Clock className="w-10 h-10 text-slate-355 mx-auto mb-2.5 animate-pulse" />
              <p className="text-sm font-bold text-slate-500">Queue is empty</p>
            </div>
          ) : (
            <>
              {/* Split Requests List */}
              {statusTab === 'split_requests' && pendingSplits.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1 mb-1 block">Split Requests</span>
                  {pendingSplits.map(s => {
                    const isActive = selectedItem?._id === s._id && s.barcode && !s.fromUser;
                    return (
                      <div 
                        key={s._id} 
                        onClick={() => {
                          setSelectedItem(s);
                          setApproveMaterialName(s.materialName);
                        }}
                        className={`p-4 bg-white dark:bg-slate-900 border rounded-xl hover:shadow-md cursor-pointer transition-all relative flex flex-col gap-2
                          ${isActive ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-200/80 dark:border-slate-800'}
                        `}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400 font-mono">{s.transactionId}</span>
                          <Badge variant="primary">PENDING</Badge>
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">{s.materialName}</h4>
                          <p className="text-[10px] text-slate-550 font-semibold mt-0.5">Parent: <span className="font-extrabold text-blue-600">{s.barcode}</span></p>
                          <p className="text-[10px] text-slate-550 font-semibold">Requester: <span className="font-extrabold">{s.requester?.fullName}</span></p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Return Requests List */}
              {statusTab === 'return_requests' && pendingReturns.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1 mb-1 block">Return Requests</span>
                  {pendingReturns.map(r => {
                    const isActive = selectedItem?._id === r._id && r.barcode && r.condition;
                    return (
                      <div 
                        key={r._id} 
                        onClick={() => setSelectedItem(r)}
                        className={`p-4 bg-white dark:bg-slate-900 border rounded-xl hover:shadow-md cursor-pointer transition-all relative flex flex-col gap-2
                          ${isActive ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-200/80 dark:border-slate-800'}
                        `}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400 font-mono">{r.transactionId}</span>
                          <Badge variant="warning">PENDING RETURN</Badge>
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Barcode: <span className="font-mono text-blue-650 font-black">{r.barcode}</span></p>
                          <p className="text-[10px] text-slate-550 font-semibold mt-0.5">From: <span className="font-extrabold">{r.fromUser?.fullName}</span></p>
                          <p className="text-[10px] text-slate-550 font-semibold">Condition: <span className="font-extrabold text-amber-700 uppercase">{r.condition}</span></p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Transactions List */}
              {statusTab !== 'split_requests' && filteredTxns.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1 mb-1 block">Material Requests</span>
                  
                  {/* Select All */}
                  <div className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/40 p-2.5 rounded-lg text-xs font-bold mb-1 select-none">
                    <button onClick={handleSelectAll} className="flex items-center gap-2 cursor-pointer text-slate-655 dark:text-slate-300">
                      {selectedIds.size === filteredTxns.length ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                      Select All listed
                    </button>
                  </div>

                  {filteredTxns.map(t => {
                    const isSelected = selectedIds.has(t._id);
                    const isActive = selectedItem?._id === t._id && !selectedItem.barcode;
                    return (
                      <div 
                        key={t._id} 
                        onClick={() => setSelectedItem(t)}
                        className={`p-4 bg-white dark:bg-slate-900 border rounded-xl hover:shadow-md cursor-pointer transition-all relative flex flex-col gap-2
                          ${isActive ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-200/80 dark:border-slate-800'}
                        `}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            {/* Checkbox select */}
                            <button onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSelect(t._id);
                            }} className="text-slate-400 hover:text-blue-600">
                              {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                            </button>
                            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400 font-mono">{t.transactionId}</span>
                          </div>
                          <Badge variant={t.priority === 'critical' || t.priority === 'high' ? 'danger' : 'primary'}>
                            {t.priority}
                          </Badge>
                        </div>

                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 line-clamp-1 leading-snug">{t.description || 'Material Logistics Dossier'}</h4>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Sender: <span className="font-extrabold">{t.sender?.fullName || t.requester?.fullName}</span></p>
                        </div>

                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-extrabold uppercase mt-1">
                          <span>{t.documentType} Challan</span>
                          <span className="text-slate-700 dark:text-slate-300 font-black">₹{t.grandTotal?.toLocaleString() || '0'}</span>
                        </div>

                        {t.crossDepartment && (
                          <span className="absolute top-2 right-14 text-[9px] font-extrabold text-amber-700 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded">Cross-Dept</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Barcode Transfers List */}
              {filteredTransfers.length > 0 && (
                <div className="flex flex-col gap-2 mt-4">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1 mb-1 block">Barcode Transfers</span>
                  {filteredTransfers.map(tr => {
                    const isActive = selectedItem?._id === tr._id && !!selectedItem.barcode;
                    return (
                      <div 
                        key={tr._id} 
                        onClick={() => setSelectedItem(tr)}
                        className={`p-4 bg-white dark:bg-slate-900 border rounded-xl hover:shadow-md cursor-pointer transition-all relative flex flex-col gap-2
                          ${isActive ? 'border-indigo-500 ring-1 ring-indigo-500/20' : 'border-slate-200/80 dark:border-slate-800'}
                        `}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-xs font-extrabold text-indigo-650 dark:text-indigo-400 font-mono">{tr.barcode}</span>
                          <Badge variant="warning">TRANSFER</Badge>
                        </div>

                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 leading-snug">Barcode Transfer Sourcing</h4>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Sender: <span className="font-extrabold">{tr.fromUser?.fullName}</span></p>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Recipient: <span className="font-extrabold">{tr.toUser?.fullName}</span></p>
                        </div>

                        <div className="text-[9px] text-slate-400 font-extrabold uppercase mt-1">
                          Type: {tr.type?.toUpperCase()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Side: Selected details preview workspace */}
        <div className="hidden md:flex flex-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex-col">
          {selectedItem ? (
            selectedItem.condition ? (
              /* RETURN REQUEST PREVIEW */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">Return Request</span>
                      <Badge variant="warning">PENDING STORE CONFIRMATION</Badge>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-855 mt-1">Return of {selectedItem.barcode}</h3>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 text-xs font-semibold text-slate-600">
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-0.5">FROM OWNER</span>
                      <span className="font-bold text-slate-855 dark:text-slate-150">{selectedItem.fromUser?.fullName}</span>
                      <span className="block text-[9px] text-slate-400 mt-0.5 font-bold">ID: {selectedItem.fromUser?.employeeId}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-0.5">ITEM CONDITION</span>
                      <span className="font-bold text-amber-700 uppercase font-mono">{selectedItem.condition}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] text-slate-400 font-extrabold uppercase mb-1.5">Reason for Return</h4>
                    <div className="p-3.5 bg-slate-50/50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-350 font-bold italic">
                      "{selectedItem.reason || 'No reason provided.'}"
                    </div>
                  </div>

                  {selectedItem.remarks && (
                    <div>
                      <h4 className="text-[10px] text-slate-400 font-extrabold uppercase mb-1.5">Remarks</h4>
                      <div className="p-3.5 bg-slate-50/50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-350 font-bold">
                        {selectedItem.remarks}
                      </div>
                    </div>
                  )}

                  {selectedItem.photos && selectedItem.photos.length > 0 && (
                    <div>
                      <h4 className="text-[10px] text-slate-400 font-extrabold uppercase mb-1.5">Captured Photo</h4>
                      <div className="flex gap-2 flex-wrap mt-1">
                        {selectedItem.photos.map((ph, index) => (
                          <img key={index} src={ph.url} alt="Return Capture" className="w-20 h-20 object-cover rounded-lg border border-slate-200" />
                        ))}
                      </div>
                    </div>
                  )}

                  {actionError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-xs font-bold">
                      {actionError}
                    </div>
                  )}

                  <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex justify-end gap-3 shrink-0">
                    <Button variant="outline" onClick={() => setSelectedItem(null)}>
                      Cancel
                    </Button>
                    <Button variant="success" onClick={handleAcceptReturnRequest} disabled={submitting}>
                      Confirm Receipt (Accept Return)
                    </Button>
                  </div>
                </div>
              </div>
            ) : selectedItem.reason ? (
              /* SPLIT REQUEST PREVIEW */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">Split Request</span>
                      <Badge variant="warning">PENDING STORE APPROVAL</Badge>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-855 mt-1">{selectedItem.materialName}</h3>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 text-xs font-semibold text-slate-600">
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-0.5">PARENT BARCODE</span>
                      <span className="font-bold text-blue-600 font-mono text-sm">{selectedItem.barcode}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-0.5">REQUESTED BY</span>
                      <span className="font-bold text-slate-800 dark:text-slate-150">{selectedItem.requester?.fullName}</span>
                      <span className="block text-[9px] text-slate-400 mt-0.5 font-bold uppercase">ID: {selectedItem.requester?.employeeId}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] text-slate-400 font-extrabold uppercase mb-1.5">Reason for Split</h4>
                    <div className="p-3.5 bg-slate-50/50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-350 font-bold italic">
                      "{selectedItem.reason}"
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Register New Material Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">New Barcode ID *</label>
                        <input
                          type="text"
                          value={approveNewBarcode}
                          onChange={(e) => setApproveNewBarcode(e.target.value)}
                          placeholder="e.g. DG300002"
                          className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2 font-semibold font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Material Name *</label>
                        <input
                          type="text"
                          value={approveMaterialName}
                          onChange={(e) => setApproveMaterialName(e.target.value)}
                          placeholder="Material Name"
                          required
                          className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  {actionError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-xs font-bold">
                      {actionError}
                    </div>
                  )}

                  <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex justify-end gap-3 shrink-0">
                    <Button variant="outline" className="text-rose-600 border-rose-250 hover:bg-rose-50" onClick={handleRejectSplitRequest} disabled={submitting}>
                      Reject Request
                    </Button>
                    <Button variant="success" onClick={handleApproveSplitRequest} disabled={submitting}>
                      Approve & Create Material
                    </Button>
                  </div>
                </div>
              </div>
            ) : selectedItem.barcode ? (
              /* BARCODE TRANSFER PREVIEW */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">Barcode Transfer</span>
                      <Badge variant="warning">{selectedItem.status.toUpperCase()}</Badge>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-855 mt-1">Transfer of {selectedItem.barcode}</h3>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/barcodes/${selectedItem.barcode}`)}>
                    Open barcode details
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 text-xs font-semibold text-slate-600">
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-0.5">FROM OWNER</span>
                      <span className="font-bold text-slate-800 dark:text-slate-150">{selectedItem.fromUser?.fullName}</span>
                      <span className="block text-[9px] text-slate-400 mt-0.5 font-bold uppercase">{selectedItem.fromDepartment?.name}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-0.5">TO RECIPIENT</span>
                      <span className="font-bold text-slate-800 dark:text-slate-150">{selectedItem.toUser?.fullName}</span>
                      <span className="block text-[9px] text-slate-400 mt-0.5 font-bold uppercase">{selectedItem.toDepartment?.name}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] text-slate-400 font-extrabold uppercase mb-1.5">Remarks / Reason</h4>
                    <div className="p-3.5 bg-slate-50/50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 font-bold">
                      {selectedItem.remarks || 'No remarks provided.'}
                    </div>
                  </div>

                  <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col gap-4">
                    {selectedItem.barcode && (
                      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Transfer Verification Photo *</label>
                        <div className="flex items-center gap-3">
                          <img src={transferPhoto} alt="Verification" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                          <div className="flex flex-col gap-1.5">
                            <input
                              type="text"
                              value={transferPhoto}
                              onChange={(e) => setTransferPhoto(e.target.value)}
                              className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none w-52 font-semibold"
                              placeholder="Photo URL..."
                            />
                            <Button size="xs" variant="outline" type="button" onClick={() => setTransferPhoto(`/images/transfer-${Date.now()}.jpg`)}>
                              Regenerate Capture
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Remarks on action</label>
                      <textarea
                        value={actionRemarks}
                        onChange={(e) => setActionRemarks(e.target.value)}
                        placeholder="Add decision remarks..."
                        rows="2"
                        className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-indigo-500 dark:text-white px-3 py-2 font-semibold"
                      />
                    </div>

                    {actionError && <p className="text-xs text-rose-500 font-bold">{actionError}</p>}

                    <div className="flex gap-3 justify-end">
                      <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => handleTransferAction(selectedItem._id, 'reject')} disabled={submitting}>
                        Reject Transfer
                      </Button>
                      <Button variant="success" onClick={() => handleTransferAction(selectedItem._id, 'accept')} disabled={submitting}>
                        Accept Transfer
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* MATERIAL TRANSACTION PREVIEW */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Workspace Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">{selectedItem.transactionId}</span>
                      <Badge variant={selectedItem.status === 'rejected' ? 'danger' : 'primary'}>{selectedItem.status}</Badge>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-800 dark:text-white mt-1">{selectedItem.description || 'Material Logistics Dossier'}</h3>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/transactions/${selectedItem._id}`)}>
                    Open full transaction view
                  </Button>
                </div>

                {/* Workspace Body scroll */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                  {/* Basic Stats row */}
                  <div className="grid grid-cols-3 gap-4.5 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">SENDER</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedItem.sender?.fullName || selectedItem.requester?.fullName}</span>
                      <span className="block text-slate-400 text-[10px]">{selectedItem.sender?.department?.name || selectedItem.department?.name || 'Engineering'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">EXPECTED RETURN</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{selectedItem.expectedReturnDate ? new Date(selectedItem.expectedReturnDate).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">GRAND TOTAL</span>
                      <span className="font-extrabold text-blue-650 dark:text-blue-400">₹{selectedItem.grandTotal?.toLocaleString() || '0'}</span>
                    </div>
                  </div>

                  {/* Materials Table */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Item Breakdown & Barcode Maps</h4>
                    <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-950/40 text-slate-550 font-bold">
                          <tr>
                            <th className="px-4 py-2">Material</th>
                            <th className="px-4 py-2">Quantity</th>
                            <th className="px-4 py-2 text-right">Unit Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedItem.materials?.map((mat, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                              <td className="px-4 py-2.5">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{mat.name}</span>
                                {mat.description && <span className="block text-[10px] text-slate-400 mt-0.5 font-medium">{mat.description}</span>}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-300">{mat.quantity} {mat.unit || 'pcs'}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-slate-800 dark:text-slate-200">₹{mat.price?.toLocaleString() || '0'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Approval Comments Form (only if status is pending) */}
                  {statusTab === 'pending' && activeRole.role !== 'employee' && (
                    <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Decision Comments / Remarks</label>
                        <textarea
                          value={actionRemarks}
                          onChange={(e) => setActionRemarks(e.target.value)}
                          placeholder="Add optional remarks or rejection reason..."
                          rows="3"
                          className="w-full text-sm bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3.5 py-2 font-semibold"
                        />
                      </div>

                      {actionError && <p className="text-xs text-rose-500 font-bold">{actionError}</p>}

                      <div className="flex gap-3 justify-end">
                        <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => handleApproveReject('reject', selectedItem._id)} disabled={submitting}>
                          Reject Request
                        </Button>
                        <Button 
                          variant="success" 
                          onClick={() => {
                            const isStore = activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'store');
                            const isSimplified = selectedItem.materials?.every(m => !m.barcodes || m.barcodes.length === 0);
                            if (isStore && isSimplified) {
                              handleOpenDispatchModal(selectedItem);
                            } else {
                              handleApproveReject('approve', selectedItem._id);
                            }
                          }} 
                          disabled={submitting}
                        >
                          Approve & Forward
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
              <Clock className="w-12 h-12 mb-3.5 text-slate-300" />
              <p className="text-sm font-semibold">Select a request card to inspect</p>
            </div>
          )}
        </div>
      </div>

      {/* Dispatch Sourcing Request Modal */}
      {dispatchModalOpen && dispatchTxn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <h3 className="text-base font-black text-slate-800 dark:text-white mb-3">Register & Dispatch Sourcing Request ({dispatchTxn.transactionId})</h3>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs font-semibold">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  id="dispatchReceiver"
                  label="Receiver Employee *"
                  placeholder="Select employee..."
                  options={employeesList.map(emp => ({ value: emp._id, label: `${emp.fullName} (${emp.employeeId})` }))}
                  value={dispatchReceiverId}
                  onChange={(e) => setDispatchReceiverId(e.target.value)}
                  required
                />

                <Select
                  id="dispatchDocType"
                  label="Document Type *"
                  options={[
                    { label: 'Returnable DC (RDC)', value: 'RDC' },
                    { label: 'Delivery Challan (DC)', value: 'DC' },
                    { label: 'Invoice', value: 'Invoice' },
                    { label: 'Emergency Send', value: 'Emergency Send' }
                  ]}
                  value={dispatchDocType}
                  onChange={(e) => setDispatchDocType(e.target.value)}
                  required
                />

                {dispatchDocType === 'DC' && (
                  <Select
                    id="dispatchDcType"
                    label="Challan Sub-Type *"
                    options={[
                      { label: 'DC-Internal', value: 'DC-Internal' },
                      { label: 'DC-FOC (Free of Charge)', value: 'DC-FOC' }
                    ]}
                    value={dispatchDcType}
                    onChange={(e) => setDispatchDcType(e.target.value)}
                    required
                  />
                )}

                <Input
                  id="dispatchDocNumber"
                  label="Document / Gate Pass Reference Number *"
                  placeholder="e.g. DC-10293"
                  value={dispatchDocNumber}
                  onChange={(e) => setDispatchDocNumber(e.target.value)}
                  required
                />

                <Input
                  id="dispatchReturnDate"
                  label="Expected Return Date *"
                  type="date"
                  value={dispatchReturnDate}
                  onChange={(e) => setDispatchReturnDate(e.target.value)}
                  required
                />

                <Select
                  id="dispatchPriority"
                  label="Transaction Priority *"
                  options={[
                    { label: 'Low', value: 'low' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'High', value: 'high' },
                    { label: 'Critical', value: 'critical' }
                  ]}
                  value={dispatchPriority}
                  onChange={(e) => setDispatchPriority(e.target.value)}
                  required
                />

                <Input
                  id="dispatchCostCenter"
                  label="Cost Center / Project Reference"
                  placeholder="e.g. DEPT-ENG-2026"
                  value={dispatchCostCenter}
                  onChange={(e) => setDispatchCostCenter(e.target.value)}
                />

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Purpose / Description</label>
                  <textarea
                    value={dispatchTxn.description}
                    disabled
                    rows="2"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400 px-3 py-2 font-semibold"
                  />
                </div>
              </div>

              {/* Barcode scan layout matching materials quantity */}
              <div className="space-y-4">
                <span className="text-xs font-black text-blue-650 dark:text-blue-400 uppercase tracking-wider block">Assign Barcodes for Requested Materials</span>
                {dispatchTxn.materials && dispatchTxn.materials.map((mat, matIdx) => (
                  <div key={matIdx} className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-4">
                    <div className="grid grid-cols-2 gap-4 mb-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">MATERIAL NAME</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{mat.name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block mb-0.5">REQUESTED QTY</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">{mat.quantity} {mat.unit || 'pcs'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-200/50">
                      {(dispatchBarcodes[matIdx] || []).map((bcVal, bcIdx) => (
                        <div key={bcIdx} className="flex flex-col gap-1">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase">Barcode #{bcIdx + 1} *</label>
                          <input
                            type="text"
                            placeholder={`Scan/Type Barcode #${bcIdx + 1}`}
                            value={bcVal}
                            onChange={(e) => {
                              const updated = { ...dispatchBarcodes };
                              updated[matIdx] = [...(updated[matIdx] || [])];
                              updated[matIdx][bcIdx] = e.target.value;
                              setDispatchBarcodes(updated);
                            }}
                            required
                            className="w-full text-xs bg-white border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none dark:bg-slate-900 dark:border-slate-800 dark:text-white px-3 py-2 font-mono font-bold"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Handler Assignment Select */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-3">
                <span className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-wider block">Logistics Delivery Option</span>
                <Select
                  id="dispatchHandler"
                  label="Select Handler (Leave empty to send directly to requester) *"
                  placeholder="Select Handler Employee..."
                  options={employeesList.filter(emp => emp._id !== user?._id).map(emp => ({ value: emp._id, label: `${emp.fullName} (${emp.employeeId})` }))}
                  value={dispatchHandlerId}
                  onChange={(e) => setDispatchHandlerId(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <Button variant="ghost" onClick={() => setDispatchModalOpen(false)}>Cancel</Button>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => handleStoreDispatch('direct')} disabled={submitting}>
                  Send Direct to Requester
                </Button>
                <Button variant="success" onClick={() => handleStoreDispatch('handler')} disabled={submitting}>
                  Assign Handler & Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingTransactionsPage;
