import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  File,
  FileSpreadsheet,
  Inbox,
  Layers,
  Lock,
  RotateCcw,
  Send,
  Shield,
  Store,
  UserCheck,
  X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import useActiveRole from '../../hooks/useActiveRole';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';

// Import sub modals
import ReturnFormModal from './ReturnFormModal';
import SplitLotModal from './SplitLotModal';
import TransferFormModal from './TransferFormModal';

const TransactionDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const activeRole = useActiveRole();

  const [loading, setLoading] = useState(true);
  const [txn, setTxn] = useState(null);
  const [barcodes, setBarcodes] = useState([]);
  const [error, setError] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState('materials'); // 'materials' | 'timeline' | 'transfers' | 'returns' | 'documents' | 'chat' | 'audit'

  // Side Panel / Drawer states
  const [selectedBarcode, setSelectedBarcode] = useState(null); // Full Barcode Object
  const [barcodeTimeline, setBarcodeTimeline] = useState([]); // Barcode logs
  const [barcodeChatText, setBarcodeChatText] = useState('');
  const [barcodeChatMessages, setBarcodeChatMessages] = useState([]);
  const [loadingBarcodeTimeline, setLoadingBarcodeTimeline] = useState(false);

  // Modals / Action Forms
  const [barcodeAction, setBarcodeAction] = useState(null); // 'transfer' | 'return' | 'split'
  const [employees, setEmployees] = useState([]);
  const [managementUsers, setManagementUsers] = useState([]);
  const [selectedMgtId, setSelectedMgtId] = useState('');
  const [assigningMgt, setAssigningMgt] = useState(false);

  // Store action modal
  const [storeModal, setStoreModal] = useState(false);
  const [storeActionType, setStoreActionType] = useState('assign_handler');
  const [handlerId, setHandlerId] = useState('');
  const [storeRemarks, setStoreRemarks] = useState('');
  const [handlers, setHandlers] = useState([]);

  // Receiving state
  const [receiveModal, setReceiveModal] = useState(false);
  const [receiveCondition, setReceiveCondition] = useState('Good');
  const [receiveRemarks, setReceiveRemarks] = useState('');
  const [receivePhoto, setReceivePhoto] = useState('');
  const [receiveCoords, setReceiveCoords] = useState({ lat: 18.5204, lng: 73.8567, address: 'MIDC Pune, India' });
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [receivingSubmitting, setReceivingSubmitting] = useState(false);

  // Reject Modal
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // Reject Receipt Modal
  const [rejectReceiptModal, setRejectReceiptModal] = useState(false);
  const [rejectReceiptReason, setRejectReceiptReason] = useState('');
  const [rejectReceiptSubmitting, setRejectReceiptSubmitting] = useState(false);

  // Invoice Match Form
  const [matchFormData, setMatchFormData] = useState({ invoiceNumber: '', invoiceDate: '', invoiceTotal: '' });
  const [matchingSubmitting, setMatchingSubmitting] = useState(false);
  const [matchingError, setMatchingError] = useState('');

  // Conversion state
  const [convertModal, setConvertModal] = useState(false);
  const [convertType, setConvertType] = useState('DC');
  const [convertDocNumber, setConvertDocNumber] = useState('');
  const [convertRemarks, setConvertRemarks] = useState('');
  const [convertSubmitting, setConvertSubmitting] = useState(false);

  const chatEndRef = useRef(null);
  
  // Transaction-wide Chat states & handlers
  const [txnChatModal, setTxnChatModal] = useState(false);
  const [txnChatMessages, setTxnChatMessages] = useState([]);
  const [txnChatText, setTxnChatText] = useState('');
  const [loadingTxnChat, setLoadingTxnChat] = useState(false);
  const txnChatEndRef = useRef(null);

  const fetchTxnChat = async (txnId) => {
    const targetTxnId = txnId || txn?.transactionId;
    if (!targetTxnId) return;
    setLoadingTxnChat(true);
    try {
      const chatRes = await api.get(`/chat/${targetTxnId}/messages`);
      setTxnChatMessages(chatRes.data.messages || []);
      setTimeout(() => {
        if (txnChatEndRef.current) {
          txnChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (err) {
      console.error('Error fetching transaction chat messages:', err);
    } finally {
      setLoadingTxnChat(false);
    }
  };

  const handleOpenTxnChat = () => {
    setTxnChatModal(true);
    fetchTxnChat();
  };

  const handleSendTxnMessage = async (e) => {
    e.preventDefault();
    if (!txnChatText.trim() || !txn?.transactionId) return;
    try {
      const res = await api.post(`/chat/${txn.transactionId}/messages`, {
        message: txnChatText
      });
      setTxnChatMessages(prev => [...prev, res.data.chatMessage]);
      setTxnChatText('');
      setTimeout(() => {
        if (txnChatEndRef.current) {
          txnChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit chat message.');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const txnRes = await api.get(`/transactions/${id}`);
      const txnData = txnRes.data.transaction;
      setTxn(txnData);
      fetchTxnChat(txnData.transactionId);

      // Fetch barcodes matching this transaction
      const bcRes = await api.get(`/barcodes/transaction/${txnData.transactionId}`);
      setBarcodes(bcRes.data.barcodes || []);

      // Seed matching form if exists
      setMatchFormData({
        invoiceNumber: txnData.invoiceNumber || '',
        invoiceDate: txnData.invoiceDate ? txnData.invoiceDate.split('T')[0] : '',
        invoiceTotal: txnData.invoiceTotal || ''
      });

    } catch (err) {
      console.error(err);
      setError('Failed to load transaction details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Fetch employees for selectors
    api.get('/employees?limit=1000&allDepartments=true').then(res => {
      const empList = res.data.employees || res.data.data || [];
      setEmployees(empList.map(e => ({ value: e._id, label: `${e.fullName} (${e.employeeId})` })));
      const handlerList = empList;
      setHandlers(handlerList.map(h => ({ value: h._id, label: `${h.fullName} (${h.employeeId})` })));
      
      const mgtList = empList.filter(e => e.role === 'department_admin' && e.departmentAdminType === 'management');
      setManagementUsers(mgtList.map(m => ({ value: m._id, label: `${m.fullName} (${m.employeeId})` })));
    }).catch(err => console.error(err));
  }, [id]);

  // Navigate directly to barcode details page instead of opening slide drawer
  const handleBarcodeClick = (barcodeStr) => {
    navigate(`/barcodes/${barcodeStr}`);
  };

  // Submit Barcode chat comment
  const handleBarcodeChatSubmit = async (e) => {
    e.preventDefault();
    if (!barcodeChatText.trim() || !selectedBarcode) return;
    try {
      const res = await api.post(`/chat/${txn.transactionId}/messages`, {
        message: barcodeChatText
      });
      setBarcodeChatMessages([...barcodeChatMessages, res.data.chatMessage]);
      setBarcodeChatText('');
    } catch (err) {
      alert('Failed to submit comment.');
    }
  };

  // TL & Management Approvals
  const handleApprovalAction = async (statusType) => {
    if (statusType === 'reject') {
      setRejectModal(true);
      return;
    }
    if (confirm(`Are you sure you want to approve this transaction?`)) {
      try {
        await api.put(`/transactions/${id}/approve`, {
          remarks: 'Approved by Approver Authority'
        });
        alert('Transaction approved successfully.');
        fetchData();
      } catch (err) {
        alert(err.response?.data?.message || 'Approval action failed.');
      }
    }
  };

  const submitRejection = async (e) => {
    e.preventDefault();
    setRejectSubmitting(true);
    try {
      await api.put(`/transactions/${id}/reject`, {
        reason: rejectionReason
      });
      alert('Transaction rejected successfully.');
      setRejectModal(false);
      setRejectionReason('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Rejection action failed.');
    } finally {
      setRejectSubmitting(false);
    }
  };

  // Store accept ready action handler
  const handleStoreAcceptReady = async () => {
    if (confirm('Mark this request as Ready (Accepted by Store)?')) {
      try {
        await api.put(`/transactions/${id}/store-accept`);
        alert('Transaction accepted by store successfully.');
        fetchData();
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to accept transaction.');
      }
    }
  };

  // Assign Management Approver action handler
  const handleAssignManagement = async () => {
    if (!selectedMgtId) {
      alert('Please select a management user.');
      return;
    }
    setAssigningMgt(true);
    try {
      await api.put(`/transactions/${id}/assign-management`, {
        managementId: selectedMgtId
      });
      alert('Management approver assigned successfully.');
      setSelectedMgtId('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign management approver.');
    } finally {
      setAssigningMgt(false);
    }
  };

  // Reject Receipt action handler
  const handleRejectReceipt = async (e) => {
    e.preventDefault();
    if (!rejectReceiptReason.trim()) {
      alert('Please specify a rejection reason.');
      return;
    }
    setRejectReceiptSubmitting(true);
    try {
      await api.patch(`/transactions/${id}/reject-receipt`, {
        reason: rejectReceiptReason
      });
      alert('Receipt rejected and transaction closed.');
      setRejectReceiptModal(false);
      setRejectReceiptReason('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject receipt.');
    } finally {
      setRejectReceiptSubmitting(false);
    }
  };

  // Store dispatch action handler (assign handler)
  const handleStoreAction = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/transactions/${id}/assign-handler`, {
        handlerId,
        remarks: storeRemarks
      });
      alert('Sourcing handler assigned successfully.');
      setStoreModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Store action failed.');
    }
  };

  // Direct dispatch (bypass handler)
  const handleDirectDispatch = async () => {
    if (confirm('Directly dispatch materials to requester bypassing handler?')) {
      try {
        await api.patch(`/transactions/${id}/store-action`, {
          actionType: 'direct_dispatch',
          remarks: 'Direct dispatch bypassed handler'
        });
        alert('Direct dispatch completed.');
        fetchData();
      } catch (err) {
        alert(err.response?.data?.message || 'Direct dispatch failed.');
      }
    }
  };

  // Handler confirm transit
  const handleConfirmDispatch = async () => {
    try {
      await api.patch(`/transactions/${id}/handler-action`, {
        actionType: 'dispatch',
        remarks: 'Handler confirmed pick up, in transit.'
      });
      alert('In transit status logged.');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Confirm dispatch failed.');
    }
  };

  // Handler collect from store
  const handleCollectFromStore = async () => {
    try {
      await api.patch(`/transactions/${id}/handler-action`, {
        actionType: 'collect',
        remarks: 'Handler collected materials from store.'
      });
      alert('Materials collected. Status updated to handler assigned.');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Collection failed.');
    }
  };

  // Physical Acceptance
  const simulatePhotoCapture = () => {
    setCapturingPhoto(true);
    setTimeout(() => {
      setReceivePhoto('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80');
      const lat = (18.5204 + (Math.random() - 0.5) * 0.01).toFixed(4);
      const lng = (73.8567 + (Math.random() - 0.5) * 0.01).toFixed(4);
      setReceiveCoords({
        lat,
        lng,
        address: `Received Dock Area, Pune Plant (${lat}° N, ${lng}° E)`
      });
      setCapturingPhoto(false);
    }, 1200);
  };

  const handleReceiveSubmit = async (e) => {
    e.preventDefault();
    if (!receivePhoto) {
      alert('Please capture a photo to confirm physical receiving check.');
      return;
    }
    setReceivingSubmitting(true);
    try {
      await api.patch(`/transactions/${id}/receive`, {
        receiverGeo: receiveCoords,
        materialCondition: receiveCondition,
        remarks: receiveRemarks,
        photo: receivePhoto
      });
      alert('Materials accepted. Barcodes distributed to inventory.');
      setReceiveModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error receiving materials.');
    } finally {
      setReceivingSubmitting(false);
    }
  };

  // Invoice Match submit
  const handleInvoiceMatchSubmit = async (e) => {
    e.preventDefault();
    setMatchingError('');
    setMatchingSubmitting(true);
    try {
      const res = await api.post(`/transactions/${id}/invoice-match`, matchFormData);
      alert(res.data.message || 'Invoice matched successfully.');
      fetchData();
    } catch (err) {
      setMatchingError(err.response?.data?.message || 'Invoice matching failed.');
    } finally {
      setMatchingSubmitting(false);
    }
  };

  // Convert Document Type submit
  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    if (!convertDocNumber.trim()) {
      alert('Please enter a document number.');
      return;
    }
    setConvertSubmitting(true);
    try {
      await api.put(`/transactions/${id}`, {
        documentType: convertType,
        documentNumber: convertDocNumber,
        remarks: convertRemarks || `Converted to ${convertType}`
      });
      alert(`Successfully converted transaction to ${convertType}.`);
      setConvertModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to convert document.');
    } finally {
      setConvertSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Retrieving secure movement dossier...
        </p>
      </div>
    );
  }

  if (error || !txn) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 font-semibold text-center">
        {error || 'Transaction dossier not found.'}
      </div>
    );
  }

  // Permissions & Actions checks
  const isSender = txn.requester?._id === user?._id || txn.requester === user?._id;
  const isReceiver = txn.receiver?._id === user?._id || txn.receiver === user?._id;
  const isHandler = txn.handler?._id === user?._id || txn.handler === user?._id;
  const showMatchTab = txn.documentType === 'RDC' && (activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'accounts'));
  const canApprove = (activeRole.role === 'team_lead' && txn.status === 'submitted') ||
    (activeRole.role === 'department_admin' && activeRole.adminType === 'management' && ['submitted', 'tl_approved'].includes(txn.status));
  const isAdmin = activeRole.role === 'super_admin';
  const isStore = activeRole.role === 'department_admin' && activeRole.adminType === 'store';
  // Helper to find dates from timeline
  const getTimelineDate = (actionName) => {
    const entry = txn.timeline?.find(t => t.action === actionName || t.action?.toLowerCase()?.includes(actionName.toLowerCase()));
    if (entry && entry.timestamp) {
      return new Date(entry.timestamp).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
    const appEntry = txn.approvalChain?.find(a => a.role?.toLowerCase()?.includes(actionName.toLowerCase()) || a.action?.toLowerCase()?.includes(actionName.toLowerCase()));
    if (appEntry && appEntry.timestamp) {
      return new Date(appEntry.timestamp).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
    return null;
  };
  // Visual Timeline Definition matching Mockup Panel 3
  const flowStages = [
    { label: 'Request Created', done: true, sub: getTimelineDate('Request Created') || new Date(txn.createdAt).toLocaleString(), originalIndex: 0 },
    { label: 'Team Lead Approved', done: ['tl_approved', 'mgt_approved', 'store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active'].includes(txn.status), sub: getTimelineDate('Team Lead Approved'), originalIndex: 1 },
    { label: 'Management Approved', done: ['mgt_approved', 'store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active'].includes(txn.status), sub: getTimelineDate('Management Approved'), originalIndex: 2 },
    { label: 'Store Accepted', done: ['store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active'].includes(txn.status), sub: getTimelineDate('Store Accepted'), originalIndex: 3 },
    { label: 'Handler Assigned', done: ['handler_assigned', 'dispatched', 'received', 'completed', 'active'].includes(txn.status), sub: getTimelineDate('Handler Assigned'), originalIndex: 4 },
    { label: 'Delivered to Requester', done: ['dispatched', 'received', 'completed', 'active'].includes(txn.status), sub: getTimelineDate('Dispatched'), originalIndex: 5 },
    { label: 'Active / Distributed', done: ['received', 'completed', 'active'].includes(txn.status), sub: getTimelineDate('Received'), originalIndex: 6 },
    { label: 'Returns in Progress', done: barcodes.some(b => ['Return Requested', 'Returned'].includes(b.status)), sub: getTimelineDate('Return'), originalIndex: 7 },
    { label: 'All Items Returned', done: barcodes.length > 0 && barcodes.every(b => b.status === 'Returned'), sub: getTimelineDate('All Returned'), originalIndex: 8 },
    { 
      label: txn.status === 'rejected' ? 'Request Rejected' : 'Transaction Closed', 
      done: ['closed', 'completed', 'rejected'].includes(txn.status), 
      sub: txn.status === 'rejected' ? (getTimelineDate('Rejected') || getTimelineDate('Reject')) : getTimelineDate('Closed'), 
      originalIndex: 9 
    }
  ];

  const doneStages = flowStages.filter(stage => stage.done);
  const visibleStages = doneStages.slice(-3);

  // Helper to extract unique owners for overall owner label
  const activeBarcodes = barcodes.filter(b => b.status === 'Active');
  const uniqueOwners = Array.from(new Set(activeBarcodes.map(b => b.owner?.fullName).filter(Boolean)));
  const overallOwnerText = uniqueOwners.length > 1
    ? 'Multiple Owners'
    : uniqueOwners.length === 1
      ? uniqueOwners[0]
      : 'Main Store';

  // Construct unified transaction timeline events from approvals, transactions logs, and barcode histories
  const unifiedTimeline = [];
  
  if (txn.createdAt) {
    unifiedTimeline.push({
      timestamp: new Date(txn.createdAt),
      action: 'Request Created',
      by: txn.requester?.fullName || 'Requester',
      badgeChar: 'R'
    });
  }

  txn.approvalChain?.forEach(app => {
    const ts = app.timestamp || app.createdAt;
    if (ts) {
      unifiedTimeline.push({
        timestamp: new Date(ts),
        action: app.role === 'team_lead' ? 'Team Lead Approved' : 'Management Approved',
        by: app.approver?.fullName || app.user?.fullName || 'Approver',
        remarks: app.remarks,
        badgeChar: app.role === 'team_lead' ? 'T' : 'M'
      });
    }
  });

  txn.timeline?.forEach(t => {
    if (['Request Created', 'Team Lead Approved', 'Management Approved'].includes(t.action)) {
      return; // Skip duplicates
    }
    const ts = t.timestamp || t.createdAt;
    if (ts) {
      let badgeChar = 'S';
      if (t.action.toLowerCase().includes('handler')) badgeChar = 'H';
      else if (t.action.toLowerCase().includes('dispatch')) badgeChar = 'D';
      else if (t.action.toLowerCase().includes('receive')) badgeChar = 'R';
      else if (t.action.toLowerCase().includes('close')) badgeChar = 'C';
      else if (t.action.toLowerCase().includes('accept')) badgeChar = 'A';
      
      unifiedTimeline.push({
        timestamp: new Date(ts),
        action: t.action,
        by: t.user?.fullName || 'System',
        remarks: t.remarks,
        badgeChar
      });
    }
  });

  barcodes.forEach(bc => {
    bc.history?.forEach(h => {
      if (h.action === 'Created') return;
      const ts = h.timestamp || h.createdAt;
      if (ts) {
        let badgeChar = 'B';
        if (h.action.toLowerCase().includes('return')) badgeChar = 'R';
        else if (h.action.toLowerCase().includes('accept')) badgeChar = 'A';
        else if (h.action.toLowerCase().includes('close')) badgeChar = 'C';
        else if (h.action.toLowerCase().includes('transfer')) badgeChar = 'T';
        
        unifiedTimeline.push({
          timestamp: new Date(ts),
          action: `${h.action} for ${bc.barcode}`,
          by: h.user?.fullName || 'Operator',
          remarks: h.remarks,
          badgeChar
        });
      }
    });
  });

  // Sort chronologically ascending
  unifiedTimeline.sort((a, b) => a.timestamp - b.timestamp);

  const formatTimelineTime = (dateVal) => {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16 relative">
      {/* Top Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-1">
            <span>Transactions</span>
            <ChevronRight className="w-3 h-3" />
            <span>My Transactions</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-500 font-bold">{txn.transactionId}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')} className="p-1 -ml-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none m-0">
              {txn.transactionId}
            </h1>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">
            {txn.documentType} CHALLAN • Created {new Date(txn.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Dynamic Context Actions & Status */}
        <div className="flex items-center gap-3 self-start sm:self-center flex-wrap">
          <Badge variant={txn.status === 'rejected' ? 'danger' : txn.status === 'completed' ? 'success' : 'primary'}>
            {txn.status.toUpperCase()}
          </Badge>

          <div className="flex items-center gap-2">
            {/* TL / Management Approvals */}
            {canApprove && (
              <>
                <Button size="sm" variant="danger" onClick={() => handleApprovalAction('reject')}>
                  Reject Request
                </Button>
                <Button size="sm" onClick={() => handleApprovalAction('approve')}>
                  Approve Request
                </Button>
              </>
            )}

            {/* Edit request for requester before team lead approval or when rejected */}
            {(txn.status === 'submitted' || txn.status === 'rejected') && isSender && (
              <Button size="sm" variant="outline" onClick={() => navigate(`/transactions/${id}/edit`)}>
                Edit Request
              </Button>
            )}

            {/* Assign Management Approver for requester when TL approved */}
            {txn.status === 'tl_approved' && isSender && !txn.managementApprover && (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl">
                <span className="text-xs font-bold text-slate-500">Choose Management Approver:</span>
                <select
                  value={selectedMgtId}
                  onChange={(e) => setSelectedMgtId(e.target.value)}
                  className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5 focus:outline-none font-bold"
                >
                  <option value="">Select...</option>
                  {managementUsers.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
                <Button size="xs" onClick={handleAssignManagement} disabled={assigningMgt}>
                  Submit to Management
                </Button>
              </div>
            )}

            {/* Store dispatch action */}
            {activeRole.role === 'department_admin' && activeRole.adminType === 'store' && (
              <>
                {['submitted', 'tl_approved', 'mgt_approved', 'ready_for_dispatch'].includes(txn.status) && (
                  <Button size="sm" onClick={handleStoreAcceptReady}>
                    Ready (Store Accept)
                  </Button>
                )}
                {txn.status === 'store_accepted' && (
                  <>
                    <Button size="sm" variant="outline" onClick={handleDirectDispatch}>
                      Direct Dispatch (Bypass Handler)
                    </Button>
                    <Button size="sm" onClick={() => setStoreModal(true)}>
                      Sourcing / Assign Handler
                    </Button>
                  </>
                )}
              </>
            )}

            {/* Handler action */}
            {txn.status === 'store_accepted' && isHandler && (
              <Button size="sm" onClick={handleCollectFromStore}>
                Accept (Collect from Store)
              </Button>
            )}

            {txn.status === 'handler_assigned' && isHandler && (
              <>
                <Button size="sm" variant="outline" onClick={() => setStoreModal(true)}>
                  Transfer Handler Role
                </Button>
                <Button size="sm" onClick={handleConfirmDispatch}>
                  Send to Requester
                </Button>
              </>
            )}

            {/* Physical Receiving */}
            {txn.status === 'dispatched' && isSender && (
              <>
                <Button size="sm" variant="danger" onClick={() => setRejectReceiptModal(true)}>
                  Reject Material Receipt
                </Button>
                <Button size="sm" variant="success" onClick={() => setReceiveModal(true)}>
                  Accept Material Receipt
                </Button>
              </>
            )}

            {/* Convert Document Type (only shown after requester collects/receives material from store) */}
            {['received', 'active', 'partially_returned', 'completed'].includes(txn.status) && (isSender || isAdmin) && (
              <Button size="sm" variant="outline" onClick={() => {
                setConvertType(txn.documentType === 'RDC' ? 'DC' : 'Invoice');
                setConvertDocNumber(txn.documentNumber || '');
                setConvertModal(true);
              }}>
                Convert Document
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Rejection Notice Banner */}
      {txn.status === 'rejected' && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-3xl p-5 flex flex-col gap-2 shadow-xs">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-extrabold text-sm uppercase">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-450 animate-bounce" /> Request Rejected
          </div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Reason: <span className="font-semibold text-slate-600 dark:text-slate-400">{txn.rejectionReason || 'No reason specified.'}</span>
          </p>
          {(() => {
            const rejectEntry = txn.timeline?.find(t => t.action === 'Rejected' || t.action === 'Reject');
            if (rejectEntry) {
              return (
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mt-1">
                  Rejected by: {rejectEntry.description?.split(' ')[2] || 'Approver'} on {new Date(rejectEntry.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} at {new Date(rejectEntry.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </p>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* Main Split Grid (Mockup Panel 3 Details Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column Details: spans 2 columns */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">{txn.transactionId}</h2>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                Created on {new Date(txn.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}, {new Date(txn.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </p>
            </div>
            {['mgt_approved', 'store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active', 'closed'].includes(txn.status) && (
              <Button variant="outline" size="sm" onClick={handleOpenTxnChat} className="flex items-center gap-1.5 font-extrabold text-xs uppercase text-blue-600 border-blue-200 hover:bg-blue-50">
                <Send className="w-3.5 h-3.5 animate-pulse" /> Chat
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Requester Row */}
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded-xl shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Requester</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                  {txn.requester?.fullName || 'Requester User'}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  {txn.requester?.department?.name || txn.department?.name || 'Department'}
                </p>
              </div>
            </div>

            {/* Team Lead Row */}
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded-xl shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Team Lead</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                  {txn.teamLead?.fullName || 'Approving Authority'}
                </p>
                <p className="text-[10px] text-slate-500 font-medium italic">
                  {(() => {
                    const tlApp = txn.approvalChain?.find(a => a.role === 'team_lead');
                    if (tlApp?.action === 'rejected') {
                      return `Rejected on ${new Date(tlApp.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`;
                    }
                    return getTimelineDate('Team Lead Approved') ? `Approved on ${getTimelineDate('Team Lead Approved')}` : 'Awaiting Approval';
                  })()}
                </p>
              </div>
            </div>

            {/* Management Approver Row */}
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded-xl shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Management Approver</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                  {txn.managementApprover?.fullName || txn.approvalChain?.find(a => a.role === 'management')?.user?.fullName || 'Not Assigned Yet'}
                </p>
                <p className="text-[10px] text-slate-500 font-medium italic">
                  {(() => {
                    const mgtApp = txn.approvalChain?.find(a => a.role === 'management');
                    if (mgtApp?.action === 'rejected') {
                      return `Rejected on ${new Date(mgtApp.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`;
                    }
                    return getTimelineDate('Management Approved') ? `Approved on ${getTimelineDate('Management Approved')}` : 'Awaiting Assignment/Approval';
                  })()}
                </p>
              </div>
            </div>

            {/* Store Row */}
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded-xl shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Store</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                  {txn.store?.fullName || 'Main Store'}
                </p>
                <p className="text-[10px] text-slate-500 font-medium italic">
                  {getTimelineDate('Store Accepted') ? `Accepted on ${getTimelineDate('Store Accepted')}` : 'Sourcing in Progress'}
                </p>
              </div>
            </div>

            {/* Current Owner Row */}
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded-xl shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Current Owner (Overall)</span>
                <p className="font-bold text-slate-800 dark:text-white text-xs truncate">
                  {overallOwnerText}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Progress Summary timeline */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <h3 className="font-black text-sm text-slate-800 dark:text-white">Progress Summary</h3>
            <ChevronDown className="w-4 h-4 text-slate-400 transform rotate-180" />
          </div>

          <div className="relative flex flex-col gap-6 pl-6 border-l-2 border-slate-200 dark:border-slate-800 ml-3 py-2">
            {visibleStages.map((stage, idx) => (
              <div key={idx} className="relative">
                <span className={`absolute -left-[37px] top-[1px] w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-black transition-all
                  ${stage.done
                    ? 'bg-green-600 border-green-600 text-white shadow-sm shadow-green-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-350 dark:border-slate-800 text-slate-400'
                  }
                `}>
                  {stage.done ? '✓' : stage.originalIndex + 1}
                </span>
                <div>
                  <h4 className={`text-[11px] font-extrabold uppercase tracking-wide ${stage.done ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>
                    {stage.label}
                  </h4>
                  {stage.sub && <p className="text-[9px] text-slate-400 mt-0.5">{stage.sub}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Stats Cards Block (5 Cards side-by-side) */}
      {(() => {
        const totalItemsCount = txn.materials?.reduce((sum, m) => sum + (m.quantity || 0), 0) || 0;
        const activeCount = txn.status === 'cancelled' || txn.status === 'rejected' 
          ? 0 
          : (barcodes.length > 0 ? barcodes.filter(b => b.status === 'Active').length : (txn.activeItems || totalItemsCount));
        
        return (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'Total Items', val: txn.totalItems || totalItemsCount, icon: Inbox, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20' },
              { label: 'Active', val: activeCount, icon: ArrowRightLeft, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20' },
              { label: 'Returned', val: barcodes.filter(b => b.status === 'Returned').length, icon: RotateCcw, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20' },
              { label: 'Closed', val: barcodes.filter(b => b.status === 'Closed').length, icon: Lock, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/20' },
              { label: 'Cancelled', val: txn.status === 'cancelled' ? (txn.totalItems || totalItemsCount) : 0, icon: AlertTriangle, color: 'text-slate-650 bg-slate-50 dark:bg-slate-950/20' }
            ].map((kpi, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
                <div className={`p-2 rounded-xl shrink-0 self-start ${kpi.color}`}>
                  <kpi.icon className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-405 font-extrabold uppercase tracking-wider block mb-0.5">{kpi.label}</span>
                  <p className="text-xl font-black text-slate-900 dark:text-white leading-none">{kpi.val}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Main Tabs Navigation Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 overflow-x-auto select-none no-scrollbar">
        {[
          { id: 'materials', label: 'Materials' },
          { id: 'timeline', label: 'Timeline' },
          { id: 'transfers', label: 'Transfers' },
          { id: 'returns', label: 'Returns' },
          { id: 'documents', label: 'Documents' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2.5 text-[10px] font-extrabold uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap
              ${activeTab === tab.id
                ? 'border-blue-600 text-blue-600 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="w-full">
        {/* TAB 1: Materials (Individual Barcode Listing Table) */}
        {/* TAB 1: Materials (Individual Barcode Listing Grouped by Material) */}
        {activeTab === 'materials' && (
          <Card title="Material & Barcode Details">
            <div className="flex flex-col gap-6">
              {txn.materials && txn.materials.map((mat, mIdx) => (
                <div key={mIdx} className="border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 bg-slate-50/30 dark:bg-slate-900/10">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                    <div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-150">{mat.name}</h4>
                      {mat.description && <p className="text-xs text-slate-400 mt-0.5">{mat.description}</p>}
                    </div>
                    <Badge variant="info">{mat.quantity} {mat.unit || 'pcs'}</Badge>
                  </div>
                  
                  {(!mat.barcodes || mat.barcodes.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">No barcodes assigned to this material yet (Pending dispatch).</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {mat.barcodes.map((bc, bIdx) => {
                        const bcStr = bc.barcode || bc;
                        const bcDetail = barcodes.find(b => b.barcode === bcStr);
                        const status = bcDetail?.status || bc.status || 'Active';
                        const ownerName = bcDetail?.owner?.fullName || bc.owner?.fullName || txn.requester?.fullName || 'Requester';
                        
                        return (
                          <div key={bIdx} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-3.5 rounded-xl flex items-center justify-between shadow-2xs">
                            <div className="min-w-0 pr-2">
                              <span 
                                onClick={() => handleBarcodeClick(bcStr)}
                                className="text-xs font-mono font-black text-blue-655 hover:underline cursor-pointer tracking-wider"
                              >
                                {bcStr}
                              </span>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 truncate">Owner: {ownerName}</p>
                            </div>
                            <Badge variant={status === 'Returned' ? 'secondary' : status === 'Active' ? 'success' : 'primary'}>
                              {status.toUpperCase()}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {(!txn.materials || txn.materials.length === 0) && (
                <p className="text-sm text-slate-400 italic text-center py-6">No materials listed for this transaction.</p>
              )}
            </div>
          </Card>
        )}
        {/* TAB 2: Timeline */}
        {activeTab === 'timeline' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Timeline Stepper Container */}
            <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h3 className="text-sm font-black text-slate-855 dark:text-white mb-6">Timeline (Full Transaction)</h3>
              <div className="relative flex flex-col gap-6 pl-8 border-l-2 border-emerald-600 ml-4 py-2">
                {unifiedTimeline.map((item, idx) => (
                  <div key={idx} className="relative">
                    <span className="absolute -left-[45px] top-[2px] w-8 h-8 rounded-full bg-emerald-600 border-2 border-white dark:border-slate-900 text-white flex items-center justify-center text-xs font-black shadow-sm select-none">
                      {item.badgeChar}
                    </span>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block mb-0.5">
                        {formatTimelineTime(item.timestamp)}
                      </span>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 font-sans">
                        {item.action}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium italic mt-0.5">
                        By: {item.by} {item.remarks ? `— ${item.remarks}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right-Side Floating Status Summary Panel */}
            <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm self-start flex flex-col gap-4">
              <div className="flex justify-between items-center py-1 border-b border-slate-105 dark:border-slate-800/60">
                <span className="text-xs text-slate-400 font-semibold">Total Items</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">{barcodes.length}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-105 dark:border-slate-800/60">
                <span className="text-xs text-slate-400 font-semibold">Active</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                  {barcodes.filter(b => b.status === 'Active').length}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-105 dark:border-slate-800/60">
                <span className="text-xs text-slate-400 font-semibold">Returned</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                  {barcodes.filter(b => b.status === 'Returned').length}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-105 dark:border-slate-800/60">
                <span className="text-xs text-slate-400 font-semibold">Closed</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                  {barcodes.filter(b => b.status === 'Closed').length}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-slate-400 font-semibold">Cancelled</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                  {txn.status === 'cancelled' ? barcodes.length : 0}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Transfers */}
        {activeTab === 'transfers' && (
          <Card title="Internal Transfers Log">
            <div className="flex flex-col gap-3">
              {barcodes.filter(b => b.history.some(h => h.action.includes('Transfer'))).length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No internal barcode transfers have occurred in this challan.</p>
              ) : (
                barcodes.map(bc => (
                  <div key={bc.barcode} className="p-4 border border-slate-105 bg-white dark:bg-slate-950 rounded-xl">
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{bc.barcode}</span>
                    <div className="mt-2 pl-3 border-l border-slate-200 dark:border-slate-800 flex flex-col gap-2.5">
                      {bc.history.filter(h => h.action.includes('Transfer') || h.action.includes('Created')).map((h, i) => (
                        <div key={i} className="text-[11px] text-slate-600 dark:text-slate-405">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{h.action}</span> - {h.remarks}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* TAB 4: Returns */}
        {activeTab === 'returns' && (
          <Card title="Returns Log">
            <div className="flex flex-col gap-3">
              {barcodes.filter(b => b.status === 'Returned' || b.status === 'Return Requested').length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No returns initiated yet.</p>
              ) : (
                barcodes.filter(b => b.status === 'Returned' || b.status === 'Return Requested').map(bc => (
                  <div key={bc.barcode} className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{bc.barcode}</span>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{bc.materialName}</h4>
                    </div>
                    <Badge variant={bc.status === 'Returned' ? 'secondary' : 'warning'}>
                      {bc.status.toUpperCase()}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* TAB 5: Documents */}
        {activeTab === 'documents' && (
          <Card title="Supporting Challan Documents">
            <div className="flex flex-col gap-3.5">
              <div className="p-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <File className="w-8 h-8 text-blue-650 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Delivery Challan PDF</h4>
                    <p className="text-[10px] text-slate-400">Generated on {new Date(txn.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <a
                  href={`/api/transactions/${id}/export/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Download PDF
                </a>
              </div>
              <div className="p-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Delivery Challan Excel Sheets</h4>
                    <p className="text-[10px] text-slate-400">Generated on {new Date(txn.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <a
                  href={`/api/transactions/${id}/export`}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Download Excel
                </a>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Invoice Matching Card for Accounts */}
      {showMatchTab && (
        <Card title="Invoice Match verification Form" className="mt-6">
          <form onSubmit={handleInvoiceMatchSubmit} className="flex flex-col gap-4 text-xs">
            <div>
              <label className="block text-slate-550 font-bold uppercase tracking-wider mb-1">Invoice Number *</label>
              <input
                type="text"
                value={matchFormData.invoiceNumber}
                onChange={(e) => setMatchFormData({ ...matchFormData, invoiceNumber: e.target.value })}
                required
                placeholder="e.g. INV-99002"
                className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
              />
            </div>
            <div>
              <label className="block text-slate-550 font-bold uppercase tracking-wider mb-1">Invoice Date *</label>
              <input
                type="date"
                value={matchFormData.invoiceDate}
                onChange={(e) => setMatchFormData({ ...matchFormData, invoiceDate: e.target.value })}
                required
                className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
              />
            </div>
            <div>
              <label className="block text-slate-550 font-bold uppercase tracking-wider mb-1">Invoice Total Value (₹) *</label>
              <input
                type="number"
                value={matchFormData.invoiceTotal}
                onChange={(e) => setMatchFormData({ ...matchFormData, invoiceTotal: e.target.value })}
                required
                placeholder="Enter final invoiced amount"
                className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
              />
            </div>

            {matchingError && <p className="text-red-500 font-bold text-xs">{matchingError}</p>}

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="primary" type="submit" disabled={matchingSubmitting}>
                {matchingSubmitting ? 'Matching...' : 'Perform 3-Way Match Check'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Transaction Chat Modal */}
      {txnChatModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl w-full max-w-lg h-[600px] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded-xl">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Transaction Chat: {txn.transactionId}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Discussion context for this challan
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setTxnChatModal(false)} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Body: scrollable container */}
            <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-3.5 custom-scrollbar min-h-0">
              {loadingTxnChat ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                </div>
              ) : txnChatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-405 gap-1.5">
                  <Send className="w-8 h-8 text-slate-300" />
                  <p className="text-xs font-semibold uppercase tracking-wider">No comments posted yet.</p>
                  <p className="text-[10px] text-slate-400">Start the conversation below!</p>
                </div>
              ) : (
                txnChatMessages.map((msg, i) => {
                  const isMe = msg.sender?._id === user?._id || msg.sender === user?._id;
                  const msgDate = new Date(msg.createdAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  });
                  return (
                    <div key={i} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                      <span className="text-[9px] font-extrabold text-slate-400 mb-0.5 px-1">
                        {msg.sender?.fullName} ({msg.sender?.role?.replace('_', ' ')?.toUpperCase()})
                      </span>
                      <div className={`px-4 py-2.5 rounded-2xl text-xs font-semibold leading-relaxed shadow-xs
                        ${isMe 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-105 rounded-tl-none border border-slate-100 dark:border-slate-800'}
                      `}>
                        {msg.message}
                      </div>
                      <span className="text-[8px] text-slate-400 mt-1 px-1 font-bold">
                        {msgDate}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={txnChatEndRef} />
            </div>

            {/* Modal Input Form Footer */}
            {txn.status !== 'closed' && txn.status !== 'completed' && txn.status !== 'rejected' && !txn.chatLocked ? (
              <form onSubmit={handleSendTxnMessage} className="pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0 flex gap-2">
                <input
                  type="text"
                  placeholder="Type your message here..."
                  value={txnChatText}
                  onChange={(e) => setTxnChatText(e.target.value)}
                  required
                  className="flex-1 text-xs bg-slate-550 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
                <button 
                  type="submit" 
                  className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-extrabold text-xs uppercase transition shrink-0 flex items-center justify-center"
                >
                  Send
                </button>
              </form>
            ) : (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-xs font-black text-slate-400 py-3">
                Chat is locked for this closed transaction.
              </div>
            )}
          </div>
        </div>
      )}



      {/* Rejection Remarks Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              Reject Movement Request
            </h3>
            <p className="text-xs text-slate-500 mt-1">Submit remarks justifying your rejection. This cancels transit.</p>
            <form onSubmit={submitRejection} className="mt-4 flex flex-col gap-4 text-xs">
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Remarks / Reason *</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                  placeholder="Justification for rejection..."
                  rows="3"
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                />
              </div>
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" type="button" onClick={() => setRejectModal(false)}>Cancel</Button>
                <Button variant="danger" type="submit" disabled={rejectSubmitting}>
                  {rejectSubmitting ? 'Rejecting...' : 'Reject & Close'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Receipt Modal */}
      {rejectReceiptModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              Reject Material Receipt
            </h3>
            <p className="text-xs text-slate-500 mt-1">Submit remarks explaining why you are rejecting the material receipt. This will close the transaction.</p>
            <form onSubmit={handleRejectReceipt} className="mt-4 flex flex-col gap-4 text-xs">
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Remarks / Reason *</label>
                <textarea
                  value={rejectReceiptReason}
                  onChange={(e) => setRejectReceiptReason(e.target.value)}
                  required
                  placeholder="Reason for rejection (e.g. damaged goods)..."
                  rows="3"
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                />
              </div>
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" type="button" onClick={() => setRejectReceiptModal(false)}>Cancel</Button>
                <Button variant="danger" type="submit" disabled={rejectReceiptSubmitting}>
                  {rejectReceiptSubmitting ? 'Rejecting...' : 'Reject & Close'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Store dispatch handler modal */}
      {storeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Store dispatch / Sourcing Manager
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Assign handler or complete DC sourcing check.</p>

            <form onSubmit={handleStoreAction} className="mt-4 flex flex-col gap-4 text-xs">
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Action Mode *</label>
                <select
                  value={storeActionType}
                  onChange={(e) => setStoreActionType(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                >
                  <option value="accept">Mark Sourced (Ready to dispatch)</option>
                  <option value="assign_handler">Assign Sourcing Handler</option>
                </select>
              </div>

              {storeActionType === 'assign_handler' && (
                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Select Handler *</label>
                  <select
                    value={handlerId}
                    onChange={(e) => setHandlerId(e.target.value)}
                    required
                    className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                  >
                    <option value="">Select Handler employee</option>
                    {handlers.map(h => (
                      <option key={h.value} value={h.value}>{h.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Remarks / Sourcing notes</label>
                <textarea
                  value={storeRemarks}
                  onChange={(e) => setStoreRemarks(e.target.value)}
                  placeholder="e.g. Sourced from Shelf Bay 4..."
                  rows="2"
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" type="button" onClick={() => setStoreModal(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Submit Sourcing Status</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Physical Receiving Form Modal (Panel 12) */}
      {receiveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Verify Materials Receipt
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Physical check & Geo-Tag confirmation</p>
              </div>
              <button onClick={() => setReceiveModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-655">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReceiveSubmit} className="mt-4 flex flex-col gap-4 text-xs">
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Material Condition *</label>
                <select
                  value={receiveCondition}
                  onChange={(e) => setReceiveCondition(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                >
                  <option value="Good">Good condition</option>
                  <option value="Minor Damage">Minor packaging damage</option>
                  <option value="Damaged">Damaged / Reject receipt</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Remarks / Discrepancy checks</label>
                <textarea
                  value={receiveRemarks}
                  onChange={(e) => setReceiveRemarks(e.target.value)}
                  placeholder="Tallied all items against challan details..."
                  rows="2"
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                />
              </div>

              {/* Camera Photo capture */}
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Geo-Tagged Receipt Photo *</label>
                {receivePhoto ? (
                  <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 h-36">
                    <img src={receivePhoto} alt="Challan check" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-slate-950/80 p-2 text-[9px] text-white flex flex-col leading-tight">
                      <span className="font-extrabold">Coordinates: {receiveCoords.lat}, {receiveCoords.lng}</span>
                      <span className="truncate">{receiveCoords.address}</span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={simulatePhotoCapture}
                    disabled={capturingPhoto}
                    className="w-full h-32 border-2 border-dashed border-slate-200 dark:border-slate-800 dark:hover:border-blue-500 hover:border-blue-500 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50/50 cursor-pointer text-slate-500 font-semibold"
                  >
                    {capturingPhoto ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Retrieving Satellite GPS...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-6 h-6 text-slate-400" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">Take Verification Picture</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" type="button" onClick={() => setReceiveModal(false)}>Cancel</Button>
                <Button variant="success" type="submit" disabled={receivingSubmitting || capturingPhoto}>
                  {receivingSubmitting ? 'Confirming...' : 'Accept and Distribute'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert Document Type Modal */}
      {convertModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Convert Document Type
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Challan type migration event</p>
              </div>
              <button onClick={() => setConvertModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConvertSubmit} className="mt-4 flex flex-col gap-4 text-xs">
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Target Document Type *</label>
                <select
                  value={convertType}
                  onChange={(e) => setConvertType(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                >
                  <option value="DC">Delivery Challan (DC)</option>
                  <option value="RDC">Returnable DC (RDC)</option>
                  <option value="Invoice">Invoice</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">New Document Number *</label>
                <input
                  type="text"
                  value={convertDocNumber}
                  onChange={(e) => setConvertDocNumber(e.target.value)}
                  required
                  placeholder="e.g. DC-10092"
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Remarks / Reason *</label>
                <textarea
                  value={convertRemarks}
                  onChange={(e) => setConvertRemarks(e.target.value)}
                  required
                  placeholder="Conversion reason for audit trails..."
                  rows="2.5"
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" type="button" onClick={() => setConvertModal(false)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={convertSubmitting}>
                  {convertSubmitting ? 'Converting...' : 'Convert Document'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden sub modals handler triggers */}
      {barcodeAction === 'transfer' && selectedBarcode && (
        <TransferFormModal
          isOpen={true}
          onClose={() => setBarcodeAction(null)}
          barcode={selectedBarcode}
          onSuccess={() => {
            setBarcodeAction(null);
            setSelectedBarcode(null);
            fetchData();
          }}
        />
      )}
      {barcodeAction === 'return' && selectedBarcode && (
        <ReturnFormModal
          isOpen={true}
          onClose={() => setBarcodeAction(null)}
          barcode={selectedBarcode}
          onSuccess={() => {
            setBarcodeAction(null);
            setSelectedBarcode(null);
            fetchData();
          }}
        />
      )}
      {barcodeAction === 'split' && selectedBarcode && (
        <SplitLotModal
          isOpen={true}
          onClose={() => setBarcodeAction(null)}
          barcode={selectedBarcode}
          onSuccess={() => {
            setBarcodeAction(null);
            setSelectedBarcode(null);
            fetchData();
          }}
        />
      )}

    </div>
  );
};

export default TransactionDetailPage;