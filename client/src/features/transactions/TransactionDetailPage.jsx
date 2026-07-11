import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Calendar,
  Camera,
  ChevronRight,
  Clock,
  Database,
  File,
  FileSpreadsheet,
  Inbox,
  Lock,
  RotateCcw,
  RefreshCw,
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
  const [returnsList, setReturnsList] = useState([]);
  const [exchangeRequests, setExchangeRequests] = useState([]);
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
  const [convertType, setConvertType] = useState('DC Internal');
  const [convertDocNumber, setConvertDocNumber] = useState('');
  const [convertRemarks, setConvertRemarks] = useState('');
  const [convertSubmitting, setConvertSubmitting] = useState(false);

  // Barcode Close / DC Conversion modal states
  const [barcodeCloseModal, setBarcodeCloseModal] = useState(false);
  const [selectedBarcodeForClose, setSelectedBarcodeForClose] = useState('');
  const [barcodeCloseDocType, setBarcodeCloseDocType] = useState('DC Internal');
  const [barcodeCloseDocNumber, setBarcodeCloseDocNumber] = useState('');
  const [barcodeCloseRemarks, setBarcodeCloseRemarks] = useState('');
  const [barcodeCloseSubmitting, setBarcodeCloseSubmitting] = useState(false);
  const [barcodeCloseMgtId, setBarcodeCloseMgtId] = useState('');

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
      setReturnsList(txnRes.data.returns || []);
      fetchTxnChat(txnData.transactionId);

      // Fetch barcodes matching this transaction
      const bcRes = await api.get(`/barcodes/transaction/${txnData.transactionId}`);
      setBarcodes(bcRes.data.barcodes || []);

      // Fetch exchange requests matching this transaction
      try {
        const exRes = await api.get(`/barcodes/exchange-requests/transaction/${txnData.transactionId}`);
        setExchangeRequests(exRes.data.data || []);
      } catch (exErr) {
        console.error('Failed to load exchange requests:', exErr);
      }

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
      const handlerList = empList.filter(h =>
        h._id !== user?._id &&
        h.role !== 'super_admin' &&
        !(h.role === 'department_admin' && h.departmentAdminType === 'store')
      );
      setHandlers(handlerList.map(h => ({ value: h._id, label: `${h.fullName} (${h.employeeId})` })));

      const mgtList = empList.filter(e => e.role === 'department_admin' && e.departmentAdminType === 'management' && e._id !== user?._id);
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
      const res = await api.patch(`/transactions/${id}/reject-receipt`, {
        reason: rejectReceiptReason
      });
      alert(res.data?.message || 'Receipt rejected successfully.');
      setRejectReceiptModal(false);
      setRejectReceiptReason('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject receipt.');
    } finally {
      setRejectReceiptSubmitting(false);
    }
  };

  // Store dispatch action handler (assign handler / accept ready)
  const handleStoreAction = async (e) => {
    e.preventDefault();
    try {
      if (storeActionType === 'accept') {
        await api.put(`/transactions/${id}/store-accept`, {
          remarks: storeRemarks
        });
        alert('Transaction accepted by store successfully.');
      } else if (storeActionType === 'assign_return_handler') {
        const activeReturn = returnsList?.find(r =>
          ['handler_assigned', 'collected'].includes(r.status)
        );
        if (!activeReturn) {
          alert('No active return request found to assign handler to.');
          return;
        }
        const activeReturns = returnsList?.filter(r =>
          r.status === activeReturn.status &&
          (r.returnHandler?._id || r.returnHandler) === (activeReturn.returnHandler?._id || activeReturn.returnHandler)
        ) || [activeReturn];

        for (const r of activeReturns) {
          await api.put(`/barcodes/return/${r._id}/assign-handler`, {
            handlerId,
            remarks: storeRemarks
          });
        }
        alert('Return handler assigned successfully.');
      } else {
        const res = await api.put(`/transactions/${id}/assign-handler`, {
          handlerId,
          remarks: storeRemarks
        });
        if (res.data?.pendingTransfer) {
          alert('Handler transfer request sent. Waiting for acceptance.');
        } else {
          alert('Sourcing handler assigned successfully.');
        }
      }
      setStoreModal(false);
      setStoreRemarks('');
      setHandlerId('');
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

  // Handler send back to store after requester rejection
  const handleSendToStore = async () => {
    if (confirm('Are you sure you want to send the rejected materials back to the store?')) {
      try {
        await api.patch(`/transactions/${id}/handler-action`, {
          actionType: 'send_to_store',
          remarks: 'Handler returned rejected materials to store.'
        });
        alert('Materials sent to store.');
        fetchData();
      } catch (err) {
        alert(err.response?.data?.message || 'Action failed.');
      }
    }
  };

  // Store accept returned materials
  const handleAcceptRejectedReturn = async () => {
    if (confirm('Accept the returned materials from the handler? This will mark the transaction as rejected.')) {
      try {
        await api.patch(`/transactions/${id}/store-action`, {
          actionType: 'accept_rejected_return',
          remarks: 'Store accepted returned materials from handler.'
        });
        alert('Returned materials accepted by store. Transaction marked as rejected.');
        fetchData();
      } catch (err) {
        alert(err.response?.data?.message || 'Action failed.');
      }
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

  // Handler reject job assignment
  const handleHandlerReject = async () => {
    const reason = prompt('Please specify a reason for rejecting this assignment:');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    try {
      await api.patch(`/transactions/${id}/handler-action`, {
        actionType: 'reject',
        remarks: reason
      });
      alert('Sourcing assignment rejected.');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Rejection failed.');
    }
  };

  // Handler-2: Accept pending transfer request
  const handleAcceptTransfer = async () => {
    if (!confirm('Accept this handler transfer request? You will become the new handler.')) return;
    try {
      await api.patch(`/transactions/${id}/handler-action`, {
        actionType: 'accept_transfer',
        remarks: 'Transfer accepted.'
      });
      alert('Handler transfer accepted. You are now the handler.');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Accept transfer failed.');
    }
  };

  // Handler-2: Reject pending transfer request
  const handleRejectTransfer = async () => {
    const reason = prompt('Please specify a reason for rejecting this handler transfer:');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    try {
      await api.patch(`/transactions/${id}/handler-action`, {
        actionType: 'reject_transfer',
        remarks: reason
      });
      alert('Handler transfer rejected.');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Reject transfer failed.');
    }
  };

  // Handler-1: Cancel pending transfer request
  const handleCancelTransfer = async () => {
    if (!confirm('Cancel the pending handler transfer request?')) return;
    try {
      await api.patch(`/transactions/${id}/handler-action`, {
        actionType: 'cancel_transfer',
        remarks: 'Cancelled by sender.'
      });
      alert('Handler transfer request cancelled.');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Cancel transfer failed.');
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

  const handleBarcodeCloseSubmit = async (e) => {
    e.preventDefault();
    if (!barcodeCloseDocNumber.trim()) {
      alert('Please enter a document number.');
      return;
    }
    if (['DC FOC', 'Invoice'].includes(barcodeCloseDocType) && !barcodeCloseMgtId) {
      alert('Please select a management approver.');
      return;
    }
    setBarcodeCloseSubmitting(true);
    try {
      await api.post('/barcodes/close-request', {
        barcode: selectedBarcodeForClose,
        documentType: barcodeCloseDocType,
        documentNumber: barcodeCloseDocNumber,
        remarks: barcodeCloseRemarks,
        managementApprover: ['DC FOC', 'Invoice'].includes(barcodeCloseDocType) ? barcodeCloseMgtId : undefined
      });
      alert('Close request submitted successfully!');
      setBarcodeCloseModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit close request.');
    } finally {
      setBarcodeCloseSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Retrieving secure movement transaction...
        </p>
      </div>
    );
  }

  if (error || !txn) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 font-semibold text-center">
        {error || 'Transaction transaction not found.'}
      </div>
    );
  }

  // Permissions & Actions checks
  const isSender = txn.requester?._id === user?._id || txn.requester === user?._id;
  const isReceiver = txn.receiver?._id === user?._id || txn.receiver === user?._id;
  const isHandler = txn.handler?._id === user?._id || txn.handler === user?._id;
  const isPendingTransferTarget = txn.pendingHandlerTransfer?.status === 'pending' &&
    (txn.pendingHandlerTransfer.toHandler?._id === user?._id || txn.pendingHandlerTransfer.toHandler === user?._id);
  const hasPendingTransfer = txn.pendingHandlerTransfer?.status === 'pending';
  const showMatchTab = !['closed', 'completed', 'cancelled', 'rejected'].includes(txn.status) && txn.documentType === 'RDC' && (activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'accounts'));
  const canApprove = ((activeRole.role === 'team_lead' && txn.status === 'submitted') ||
    (activeRole.role === 'department_admin' && activeRole.adminType === 'management' && ['submitted', 'tl_approved'].includes(txn.status))) && !isSender;
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
  const isRequesterTLOrAdmin = txn.requester?.role === 'team_lead' || txn.requester?.role === 'department_admin';
  const flowStages = [
    { label: 'Request Created', done: true, sub: getTimelineDate('Request Created') || new Date(txn.createdAt).toLocaleString(), originalIndex: 0 },
    ...(!isRequesterTLOrAdmin ? [{ label: 'Team Lead Approved', done: ['tl_approved', 'mgt_approved', 'store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status), sub: getTimelineDate('Team Lead Approved'), originalIndex: 1 }] : []),
    { label: 'Management Approved', done: ['mgt_approved', 'store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status), sub: getTimelineDate('Management Approved'), originalIndex: 2 },
    { label: 'Store Accepted', done: ['store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status), sub: getTimelineDate('Store Accepted'), originalIndex: 3 },
    { label: 'Handler Assigned', done: (txn.timeline?.some(t => t.action === 'Handler Accepted' || t.action === 'Handler Transfer Accepted') || ['dispatched', 'received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status)), sub: getTimelineDate('Handler Accepted') || getTimelineDate('Handler Transfer Accepted') || getTimelineDate('Handler Assigned'), originalIndex: 4 },
    { label: 'Delivered to Requester', done: ['dispatched', 'received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status), sub: getTimelineDate('Dispatched'), originalIndex: 5 },
    { label: 'Active / Distributed', done: ['received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status), sub: getTimelineDate('Received'), originalIndex: 6 },
    { label: 'Returns / Conversions in Progress', done: barcodes.some(b => ['Return Requested', 'Returned', 'Closed'].includes(b.status) || b.closeRequest?.status === 'pending'), sub: getTimelineDate('Return') || getTimelineDate('Close Requested') || getTimelineDate('Closed'), originalIndex: 7 },
    { label: 'All Items Returned / Converted', done: barcodes.length > 0 && barcodes.every(b => ['Returned', 'Closed'].includes(b.status)), sub: getTimelineDate('All Returned') || getTimelineDate('Closed'), originalIndex: 8 },
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

  const allMaterialsResolved = barcodes.length > 0 && barcodes.every(b => {
    return ['Returned', 'Closed', 'Split', 'Cancelled'].includes(b.status);
  });

  const mgtApproved = txn.approvalChain?.some(a => a.role === 'management' && a.action === 'approved');
  const isRequesterRejected = txn.requesterRejected ||
    txn.timeline?.some(t => t.action === 'Receipt Rejected' || t.action?.toLowerCase()?.includes('receipt rejected')) ||
    (txn.status === 'rejected' && mgtApproved) ||
    txn.timeline?.some(t => t.action === 'Request Rejected' && (t.description?.toLowerCase()?.includes('requester') || t.description?.toLowerCase()?.includes('receipt')));

  // Construct unified transaction timeline events from approvals, transactions logs, and barcode histories
  const unifiedTimelineRaw = [];
  let isTerminated = false;

  // 1. Request Created (Always)
  if (txn.createdAt) {
    unifiedTimelineRaw.push({
      timestamp: new Date(txn.createdAt),
      action: 'Request Created',
      by: txn.requester?.fullName || 'Requester',
      status: 'COMPLETED',
      badgeChar: 'R',
      stageIndex: 1
    });
  }

  // 2. Team Lead Approval
  if (!isRequesterTLOrAdmin && !isTerminated) {
    const tlApp = txn.approvalChain?.find(a => a.role === 'team_lead');
    if (tlApp) {
      const tlStatus = tlApp.action === 'approved' ? 'APPROVED' : 'REJECTED';
      unifiedTimelineRaw.push({
        timestamp: new Date(tlApp.timestamp || tlApp.createdAt),
        action: tlApp.action === 'approved' ? 'Team Lead Approved' : 'Team Lead Rejected',
        by: tlApp.user?.fullName || txn.teamLead?.fullName || 'Team Lead',
        remarks: tlApp.remarks,
        status: tlStatus,
        badgeChar: 'T',
        stageIndex: 2
      });
      if (tlStatus === 'REJECTED') isTerminated = true;
    } else {
      const tlApproved = txn.approvalChain?.some(a => a.role === 'team_lead' && a.action === 'approved');
      const tlDone = tlApproved || ['tl_approved', 'mgt_approved', 'store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status);
      const isRejected = txn.status === 'rejected' && !tlApproved && !txn.approvalChain?.some(a => a.role === 'management');

      const tlStatus = tlDone ? 'APPROVED' : (isRejected ? 'REJECTED' : 'PENDING');
      unifiedTimelineRaw.push({
        timestamp: tlDone ? new Date(txn.createdAt) : null,
        action: isRejected ? 'Team Lead Rejected' : 'Team Lead Review',
        by: txn.teamLead?.fullName || 'Team Lead',
        status: tlStatus,
        badgeChar: 'T',
        stageIndex: 2
      });
      if (tlStatus === 'REJECTED' || tlStatus === 'PENDING') isTerminated = true;
    }
  }

  // 3. Management Approval
  if (!isTerminated) {
    const mgtApp = txn.approvalChain?.find(a => a.role === 'management');
    if (mgtApp) {
      const mgtStatus = mgtApp.action === 'approved' ? 'APPROVED' : 'REJECTED';
      unifiedTimelineRaw.push({
        timestamp: new Date(mgtApp.timestamp || mgtApp.createdAt),
        action: mgtApp.action === 'approved' ? 'Management Approved' : 'Management Rejected',
        by: mgtApp.user?.fullName || txn.managementApprover?.fullName || 'Management',
        remarks: mgtApp.remarks,
        status: mgtStatus,
        badgeChar: 'M',
        stageIndex: 3
      });
      if (mgtStatus === 'REJECTED') isTerminated = true;
    } else {
      const mgtApproved = txn.approvalChain?.some(a => a.role === 'management' && a.action === 'approved');
      const mgtDone = mgtApproved || ['mgt_approved', 'store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status);
      const isRejected = txn.status === 'rejected' && !mgtApproved;

      const mgtStatus = mgtDone ? 'APPROVED' : (isRejected ? 'REJECTED' : 'PENDING');
      unifiedTimelineRaw.push({
        timestamp: mgtDone ? new Date(txn.createdAt) : null,
        action: isRejected ? 'Management Rejected' : 'Management Review',
        by: txn.managementApprover?.fullName || 'Management',
        status: mgtStatus,
        badgeChar: 'M',
        stageIndex: 3
      });
      if (mgtStatus === 'REJECTED' || mgtStatus === 'PENDING') isTerminated = true;
    }
  }

  // 4. Store Sourcing Check
  if (!isTerminated) {
    const storeTimeline = txn.timeline?.find(t => t.action?.toLowerCase()?.includes('store accepted') || t.action?.toLowerCase()?.includes('ready (store accept)'));
    const storeDone = ['store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status) || !!storeTimeline || isRequesterRejected;

    unifiedTimelineRaw.push({
      timestamp: storeTimeline ? new Date(storeTimeline.timestamp || storeTimeline.createdAt) : (storeDone ? new Date(txn.createdAt) : null),
      action: 'Store Sourcing Check',
      by: txn.store?.fullName || 'Store Incharge',
      status: storeDone ? 'ACCEPTED' : 'PENDING',
      badgeChar: 'S',
      stageIndex: 4
    });
    if (!storeDone) isTerminated = true;
  }

  // 5. Sourcing & Dispatch (Two-Way Flow)
  if (!isTerminated) {
    if (!txn.handler) {
      const dispatchTimeline = txn.timeline?.find(t => t.action?.toLowerCase()?.includes('dispatched'));
      const dispatchDone = ['dispatched', 'received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status) || !!dispatchTimeline || isRequesterRejected;

      unifiedTimelineRaw.push({
        timestamp: dispatchTimeline ? new Date(dispatchTimeline.timestamp || dispatchTimeline.createdAt) : null,
        action: 'Direct Dispatch to Requester',
        by: txn.store?.fullName || 'Store Incharge',
        status: dispatchDone ? 'DISPATCHED' : 'PENDING',
        badgeChar: 'D',
        stageIndex: 5
      });
      if (!dispatchDone) isTerminated = true;
    } else {
      const allHandlerAssignedTimeline = txn.timeline?.filter(t => t.action === 'Handler Assigned' || t.action?.toLowerCase()?.includes('handler assigned')) || [];
      const handlerAcceptedTimeline = txn.timeline?.find(t => t.action === 'Handler Accepted' || t.action === 'Handler Transfer Accepted');

      if (allHandlerAssignedTimeline.length === 0) {
        const handlerDone = !!handlerAcceptedTimeline || ['dispatched', 'received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status) || isRequesterRejected;
        unifiedTimelineRaw.push({
          timestamp: txn.createdAt ? new Date(txn.createdAt) : null,
          action: `Handler Assigned: ${txn.handler?.fullName || 'Handler'}`,
          by: txn.store?.fullName || 'Store Admin',
          status: handlerDone ? 'ACCEPTED' : 'PENDING',
          badgeChar: 'H',
          stageIndex: 5
        });
        if (!handlerDone) isTerminated = true;
      } else {
        allHandlerAssignedTimeline.forEach((tEntry, index) => {
          const isLastAssignment = index === allHandlerAssignedTimeline.length - 1;
          const handlerDone = !isLastAssignment || !!handlerAcceptedTimeline || ['dispatched', 'received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status) || isRequesterRejected;

          let handlerName = txn.handler?.fullName || 'Handler';
          const match = tEntry.description?.match(/Handler Assigned:\s*([^.]+)/i);
          if (match && match[1]) {
            handlerName = match[1].trim();
          } else if (tEntry.metadata?.handlerId && tEntry.metadata.handlerId === txn.handler?._id) {
            handlerName = txn.handler?.fullName;
          }

          let remarksVal = '';
          if (tEntry.description?.includes(':')) {
            remarksVal = tEntry.description.substring(tEntry.description.indexOf(':') + 1).trim();
          } else {
            remarksVal = tEntry.description;
          }

          unifiedTimelineRaw.push({
            timestamp: new Date(tEntry.timestamp || tEntry.createdAt),
            action: `Handler Assigned: ${handlerName}`,
            by: tEntry.user?.fullName || txn.store?.fullName || 'Store Admin',
            remarks: remarksVal,
            status: handlerDone ? 'ACCEPTED' : 'PENDING',
            badgeChar: 'H',
            stageIndex: 5
          });

          if (isLastAssignment && !handlerDone) {
            isTerminated = true;
          }
        });
      }

      let dispatchDone = false;
      const handlerDone = !!handlerAcceptedTimeline || ['dispatched', 'received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status) || isRequesterRejected;
      if (handlerDone) {
        const dispatchTimeline = txn.timeline?.find(t => t.action?.toLowerCase()?.includes('dispatched'));
        dispatchDone = ['dispatched', 'received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status) || !!dispatchTimeline || isRequesterRejected;

        unifiedTimelineRaw.push({
          timestamp: dispatchTimeline ? new Date(dispatchTimeline.timestamp || dispatchTimeline.createdAt) : null,
          action: 'Handler Delivery / Transit',
          by: txn.handler?.fullName || 'Handler',
          status: dispatchDone ? 'DISPATCHED' : 'PENDING',
          badgeChar: 'D',
          stageIndex: 6
        });
      }
      if (!handlerDone || !dispatchDone) isTerminated = true;
    }
  }

  // 6. Requester Collection / Acceptance
  if (!isTerminated) {
    const receiveTimeline = txn.timeline?.find(t => t.action?.toLowerCase()?.includes('received'));
    const rejectTimeline = txn.timeline?.find(t => t.action === 'Request Rejected' || t.action === 'Receipt Rejected');
    const receiveDone = ['received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status);
    const requesterRejected = !!txn.requesterRejected;

    if (receiveDone || requesterRejected) {
      let statusVal = 'PENDING';
      if (receiveDone) {
        statusVal = 'ACCEPTED';
      } else if (requesterRejected) {
        statusVal = 'REJECTED';
      }

      unifiedTimelineRaw.push({
        timestamp: receiveTimeline
          ? new Date(receiveTimeline.timestamp || receiveTimeline.createdAt)
          : (rejectTimeline ? new Date(rejectTimeline.timestamp || rejectTimeline.createdAt) : null),
        action: 'Requester Collection Check',
        by: rejectTimeline
          ? (rejectTimeline.user?.fullName || txn.requester?.fullName || 'Requester')
          : (txn.requester?.fullName || 'Requester'),
        remarks: rejectTimeline?.description || rejectTimeline?.remarks,
        status: statusVal,
        badgeChar: 'R',
        stageIndex: 7
      });
    }
  }

  // 5.5. Handler Transfer Timeline Events
  txn.timeline?.forEach((t, tIdx) => {
    const act = t.action?.toLowerCase();
    if (act?.includes('handler transfer')) {
      let statusLabel = 'COMPLETED';
      let badgeChar = 'H';

      if (act.includes('requested')) {
        const hasResolution = txn.timeline.slice(tIdx + 1).some(laterT => {
          const laterAct = laterT.action?.toLowerCase();
          return laterAct?.includes('handler transfer accepted') ||
            laterAct?.includes('handler transfer rejected') ||
            laterAct?.includes('handler transfer cancelled');
        });
        statusLabel = hasResolution ? 'COMPLETED' : 'PENDING';
      } else if (act.includes('rejected') || act.includes('cancelled')) {
        statusLabel = 'REJECTED';
      } else if (act.includes('accepted')) {
        statusLabel = 'APPROVED';
      }

      unifiedTimelineRaw.push({
        timestamp: new Date(t.timestamp || t.createdAt),
        action: t.action,
        by: t.user?.fullName || 'Handler',
        remarks: t.description || '',
        status: statusLabel,
        badgeChar,
        stageIndex: 5.5
      });
    }
  });

  // 6.5. Return/Rejection Timeline Events
  txn.timeline?.forEach(t => {
    const act = t.action?.toLowerCase();
    if (act?.includes('returned to store') || act?.includes('store accepted return')) {
      unifiedTimelineRaw.push({
        timestamp: new Date(t.timestamp || t.createdAt),
        action: t.action,
        by: t.user?.fullName || txn.store?.fullName || 'Store Admin',
        remarks: t.description,
        status: 'COMPLETED',
        badgeChar: 'R',
        stageIndex: 7.5
      });
    }
  });

  // 6.8. Exchange Request Timeline Events
  exchangeRequests.forEach(ex => {
    // 1. Exchange Requested
    if (ex.status === 'pending') {
      unifiedTimelineRaw.push({
        timestamp: new Date(ex.createdAt),
        action: 'Barcode Exchange Requested',
        by: ex.requester?.fullName || 'Requester',
        remarks: `Warranty exchange requested for old barcode ${ex.oldBarcode}. Failure reason: ${ex.warrantyReason}`,
        status: 'PENDING',
        badgeChar: 'E',
        stageIndex: 7.2
      });
    }

    // 2. Exchange Approved/Rejected
    if (ex.status === 'approved') {
      unifiedTimelineRaw.push({
        timestamp: new Date(ex.approvedAt || ex.updatedAt),
        action: 'Barcode Exchange Completed',
        by: ex.approvedBy?.fullName || 'Store Admin',
        remarks: `Warranty exchange approved. Old barcode ${ex.oldBarcode} replaced with new barcode ${ex.newBarcode || 'Pending'}.`,
        status: 'APPROVED',
        badgeChar: 'E',
        stageIndex: 7.3
      });
    } else if (ex.status === 'rejected') {
      unifiedTimelineRaw.push({
        timestamp: new Date(ex.updatedAt),
        action: 'Barcode Exchange Rejected',
        by: ex.approvedBy?.fullName || 'Store Admin',
        remarks: `Exchange request for old barcode ${ex.oldBarcode} was rejected by store.`,
        status: 'REJECTED',
        badgeChar: 'E',
        stageIndex: 7.3
      });
    }
  });

  // 7. Post-delivery Barcode Operations (Transfers, Splits, Returns, Conversions)
  barcodes.forEach(bc => {
    const historyToRender = [...(bc.history || [])];
    if (bc.closeRequest) {
      if (bc.closeRequest.status === 'pending_accounts_approval') {
        historyToRender.push({
          action: 'Pending Accounts Upload',
          user: { fullName: 'Accounts Admin' },
          timestamp: bc.closeRequest.updatedAt || new Date().toISOString(),
          remarks: 'Awaiting invoice document upload to close transaction'
        });
      } else if (bc.closeRequest.status === 'pending_store_acceptance') {
        historyToRender.push({
          action: 'Pending Store Acceptance',
          user: { fullName: 'Store Admin' },
          timestamp: bc.closeRequest.updatedAt || new Date().toISOString(),
          remarks: 'Awaiting store confirmation of the conversion request'
        });
      }
    }

    historyToRender.forEach((h, hIdx) => {
      // Include post-delivery specific barcode operations: Transfer, Return, Split, Close, Closed, Approval
      const isPostDelivery = h.action.toLowerCase().includes('transfer') ||
        h.action.toLowerCase().includes('split') ||
        h.action.toLowerCase().includes('return') ||
        h.action.toLowerCase().includes('close') ||
        h.action.toLowerCase().includes('closed') ||
        h.action.toLowerCase().includes('approval');
      if (!isPostDelivery) return;
      if (h.action === 'Return Assignment Declined by Handler' || h.action === 'Return Reassignment Declined by Handler') {
        return;
      }
      let hasLaterCollected = false;
      if (h.action.toLowerCase().includes('return requested')) {
        for (let i = hIdx + 1; i < historyToRender.length; i++) {
          const act = historyToRender[i].action.toLowerCase();
          if (act.includes('return requested')) {
            break;
          }
          if (act.includes('return collected') || act.includes('returned to store')) {
            hasLaterCollected = true;
            break;
          }
        }
      }
      if (h.action.toLowerCase().includes('return requested') && hasLaterCollected) {
        return;
      }

      let hasLaterSplitDecision = false;
      if (h.action.toLowerCase().includes('split requested')) {
        for (let i = hIdx + 1; i < historyToRender.length; i++) {
          const act = historyToRender[i].action.toLowerCase();
          if (act.includes('split requested')) {
            break;
          }
          if (act.includes('split approved') || act.includes('split rejected')) {
            hasLaterSplitDecision = true;
            break;
          }
        }
      }
      if (h.action.toLowerCase().includes('split requested') && hasLaterSplitDecision) {
        return;
      }

      const ts = h.timestamp || h.createdAt;
      if (ts) {
        let actionLabel = h.action;
        let statusLabel = 'COMPLETED';
        let badgeChar = 'B';

        // Check if there is a later completion event in history for this barcode
        const laterEvents = historyToRender.slice(hIdx + 1);
        const hasLaterCompletion = laterEvents.length > 0;
        const nextEvent = historyToRender[hIdx + 1];
        const isLaterRejected = nextEvent && (
          nextEvent.action.toLowerCase().includes('reject') ||
          nextEvent.action.toLowerCase().includes('decline') ||
          nextEvent.action.toLowerCase().includes('cancel')
        );

        let byLabel = h.user?.fullName || 'Operator';

        if (h.action.toLowerCase().includes('transfer')) {
          actionLabel = `${h.action} for ${bc.barcode}`;
          if (h.action.toLowerCase().includes('accepted') || h.action.toLowerCase().includes('approved')) {
            statusLabel = 'ACCEPTED';
            byLabel = `Accepted by: ${h.user?.fullName || 'Operator'}`;
          } else if (h.action.toLowerCase().includes('rejected')) {
            statusLabel = 'REJECTED';
            byLabel = `Rejected by: ${h.user?.fullName || 'Operator'}`;
          } else {
            statusLabel = isLaterRejected ? 'REJECTED' : (hasLaterCompletion ? 'ACCEPTED' : 'PENDING');
            if (statusLabel === 'PENDING') {
              if (h.action.toLowerCase().includes('pending acceptance')) {
                byLabel = `Pending Acceptance by: ${h.user?.fullName || 'Recipient'}`;
              } else {
                byLabel = `Pending Approval`;
              }
            } else {
              byLabel = `Initiated by: ${h.user?.fullName || 'Operator'}`;
            }
          }
          badgeChar = 'T';
        } else if (h.action.toLowerCase().includes('split')) {
          actionLabel = `${h.action} for ${bc.barcode}`;
          if (h.action === 'Split Child Created') {
            statusLabel = 'ACCEPTED';
            byLabel = `Created by: ${h.user?.fullName || 'Store Admin'}`;
          } else if (h.action.toLowerCase().includes('accepted') || h.action.toLowerCase().includes('approved') || h.action.toLowerCase().includes('completed')) {
            statusLabel = 'ACCEPTED';
            byLabel = `Accepted by: ${h.user?.fullName || 'Operator'}`;
          } else if (h.action.toLowerCase().includes('rejected')) {
            statusLabel = 'REJECTED';
            byLabel = `Rejected by: ${h.user?.fullName || 'Operator'}`;
          } else {
            statusLabel = isLaterRejected ? 'REJECTED' : (hasLaterCompletion ? 'ACCEPTED' : 'PENDING');
            if (statusLabel === 'PENDING') {
              byLabel = 'Pending Store Approval';
            } else {
              byLabel = `Initiated by: ${h.user?.fullName || 'Operator'}`;
            }
          }
          badgeChar = 'S';
        } else if (h.action.toLowerCase().includes('return')) {
          actionLabel = `${h.action} for ${bc.barcode}`;
          const hAct = h.action.toLowerCase();
          if (hAct.includes('accepted') || hAct.includes('completed') || hAct.includes('returned')) {
            statusLabel = 'ACCEPTED';
            byLabel = `Accepted by: ${h.user?.fullName || 'Operator'}`;
          } else if (hAct.includes('rejected') || hAct.includes('declined') || hAct.includes('reject') || hAct.includes('decline')) {
            statusLabel = 'REJECTED';
            byLabel = `Rejected/Declined by: ${h.user?.fullName || 'Operator'}`;
          } else {
            // intermediate return actions (requested, collected, handed over) are PENDING until final acceptance
            statusLabel = isLaterRejected ? 'REJECTED' : (hasLaterCompletion ? 'ACCEPTED' : 'PENDING');
            if (statusLabel === 'PENDING') {
              if (h.action.toLowerCase().includes('requested')) {
                byLabel = `Pending Return Collection by Handler`;
              } else if (h.action.toLowerCase().includes('collected')) {
                byLabel = `Pending Handover to Store by: ${h.user?.fullName || 'Handler'}`;
              } else if (h.action.toLowerCase().includes('handed over')) {
                byLabel = `Pending Store Acceptance`;
              } else {
                byLabel = 'Pending Return';
              }
            } else {
              if (h.action.toLowerCase().includes('collected')) {
                byLabel = `Collected by: ${h.user?.fullName || 'Handler'}`;
              } else if (h.action.toLowerCase().includes('handed over')) {
                byLabel = `Handed over by: ${h.user?.fullName || 'Handler'}`;
              } else {
                byLabel = `Initiated by: ${h.user?.fullName || 'Operator'}`;
              }
            }

            if (h.action.toLowerCase().includes('requested')) {
              if (h.action.includes('Via Handler')) {
                let handlerName = h.metadata?.handlerName;
                if (!handlerName) {
                  const nextAssigned = historyToRender.slice(hIdx + 1).find(laterH =>
                    laterH.action === 'Handler Assigned' ||
                    laterH.action === 'Return Handler Reassigned' ||
                    laterH.action.includes('Collected')
                  );
                  if (nextAssigned) {
                    if (nextAssigned.action === 'Return Handler Reassigned') {
                      handlerName = nextAssigned.metadata?.handlerName;
                      if (!handlerName && nextAssigned.remarks?.startsWith('Reassigned return handler to ')) {
                        handlerName = nextAssigned.remarks.replace('Reassigned return handler to ', '');
                      }
                    } else if (nextAssigned.action === 'Handler Assigned') {
                      handlerName = nextAssigned.user?.fullName;
                    } else {
                      handlerName = nextAssigned.user?.fullName;
                    }
                  }
                }
                if (!handlerName) {
                  handlerName = 'Handler';
                }
                if (statusLabel === 'PENDING') {
                  byLabel = `Pending Return Collection by Handler: ${handlerName}`;
                } else {
                  byLabel = `Initiated by: ${h.user?.fullName || 'Operator'} (Handler: ${handlerName})`;
                }
              } else {
                if (statusLabel === 'PENDING') {
                  byLabel = `Pending Return Collection by Store`;
                } else {
                  byLabel = `Initiated by: ${h.user?.fullName || 'Operator'}`;
                }
              }
            }
          }
          if (h.action === 'Return Handler Reassigned') {
            let handlerName = h.metadata?.handlerName;
            if (!handlerName && h.remarks?.startsWith('Reassigned return handler to ')) {
              handlerName = h.remarks.replace('Reassigned return handler to ', '');
            }
            if (!handlerName) {
              handlerName = 'Handler';
            }
            const decision = statusLabel === 'ACCEPTED' ? 'Accepted' : (statusLabel === 'REJECTED' ? 'Rejected' : 'Pending');
            byLabel = `Reassigned to: ${handlerName} (${decision})`;
          }
          badgeChar = 'R';
        } else if (h.action.toLowerCase().includes('close') || h.action.toLowerCase().includes('closed') || h.action.toLowerCase().includes('approval') || h.action.toLowerCase().includes('upload') || h.action.toLowerCase().includes('conversion')) {
          actionLabel = `${h.action} for ${bc.barcode}`;
          if (h.action.toLowerCase().includes('closed') || h.action.toLowerCase().includes('completed')) {
            statusLabel = 'APPROVED';
            byLabel = `Approved by: ${h.user?.fullName || 'Operator'}`;
          } else if (h.action.toLowerCase().includes('rejected') || h.action.toLowerCase().includes('declined')) {
            statusLabel = 'REJECTED';
            byLabel = `Rejected by: ${h.user?.fullName || 'Operator'}`;
          } else if (h.action === 'First Approval') {
            const isApproved = ['pending_accounts_approval', 'pending_store_acceptance', 'approved'].includes(bc.closeRequest?.status);
            statusLabel = isApproved ? 'APPROVED' : 'PENDING';
            if (statusLabel === 'PENDING') {
              if (bc.closeRequest?.managementApprover) {
                byLabel = `Pending Management Approval by: ${bc.closeRequest.managementApprover.fullName}`;
              } else {
                byLabel = 'Pending Approval';
              }
            } else {
              byLabel = `Approved by Management: ${h.user?.fullName || 'Approver'}`;
            }
          } else if (h.action === 'Close Requested') {
            const isAccepted = ['pending_accounts_approval', 'pending_store_acceptance', 'approved'].includes(bc.closeRequest?.status);
            statusLabel = isAccepted ? 'ACCEPTED' : 'PENDING';
            if (statusLabel === 'PENDING') {
              if (bc.closeRequest?.managementApprover) {
                byLabel = `Pending Management Approval by: ${bc.closeRequest.managementApprover.fullName}`;
              } else {
                byLabel = 'Pending Approval';
              }
            } else {
              byLabel = `Initiated by: ${h.user?.fullName || 'Operator'}`;
            }
          } else if (h.action.toLowerCase().includes('pending')) {
            statusLabel = 'PENDING';
            byLabel = h.user?.fullName || 'Pending Action';
          } else {
            statusLabel = isLaterRejected ? 'REJECTED' : (hasLaterCompletion ? 'APPROVED' : 'PENDING');
            if (statusLabel === 'PENDING') {
              if (bc.closeRequest?.status === 'pending_accounts_approval') {
                byLabel = 'Pending Accounts Approval';
              } else if (bc.closeRequest?.status === 'pending_store_acceptance') {
                byLabel = 'Pending Store Acceptance';
              } else if (bc.closeRequest?.managementApprover) {
                byLabel = `Pending Management Approval by: ${bc.closeRequest.managementApprover.fullName}`;
              } else {
                byLabel = 'Pending Approval';
              }
            } else {
              byLabel = `Initiated by: ${h.user?.fullName || 'Operator'}`;
            }
          }
          badgeChar = 'C';
        }

        unifiedTimelineRaw.push({
          timestamp: new Date(ts),
          action: actionLabel,
          by: byLabel,
          remarks: h.remarks,
          status: statusLabel,
          badgeChar,
          stageIndex: 8
        });
      }
    });
  });

  // Sort: purely by timestamp ascending, using stageIndex to break ties if timestamps are close (within 2 seconds)
  const unifiedTimeline = [...unifiedTimelineRaw];
  unifiedTimeline.sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (Math.abs(timeA - timeB) < 2000) {
        if (a.stageIndex !== b.stageIndex) {
          return a.stageIndex - b.stageIndex;
        }
        const getPriority = (action) => {
          const act = action?.toLowerCase() || '';
          if (act.includes('split request') && !act.includes('approved') && !act.includes('rejected') && !act.includes('child')) return 1;
          if (act.includes('split approved') || act.includes('split rejected')) return 2;
          if (act.includes('split child')) return 3;
          return 4;
        };
        return getPriority(a.action) - getPriority(b.action);
      }
      return timeA - timeB;
    }
    if (a.stageIndex !== b.stageIndex) {
      return a.stageIndex - b.stageIndex;
    }
    return 0;
  });

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

            {/* Edit request for requester before team lead approval */}
            {txn.status === 'submitted' && isSender && !isRequesterTLOrAdmin && (
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



            {/* Pending Handler Transfer Status and Actions */}
            {hasPendingTransfer && isHandler && (
              <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-amber-600 dark:text-amber-400 font-semibold text-xs">
                <span>Waiting for Handler Acceptance ({txn.pendingHandlerTransfer?.toHandler?.fullName || 'New Handler'})</span>
                <Button size="xs" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={handleCancelTransfer}>
                  Cancel Request
                </Button>
              </div>
            )}

            {isPendingTransferTarget && (
              <div className="flex items-center gap-2.5 bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-xl">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  New Handler Assignment Request (From {txn.pendingHandlerTransfer?.fromHandler?.fullName || 'Previous Handler'})
                </span>
                <Button size="sm" variant="success" onClick={handleAcceptTransfer}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={handleRejectTransfer}>
                  Reject
                </Button>
              </div>
            )}

            {/* Handler Actions (Transfer / Send to Requester / Send to Store) */}
            {txn.status === 'handler_assigned' && isHandler && !hasPendingTransfer && (
              <>
                {(() => {
                  const hasAccepted = (() => {
                    const timeline = txn.timeline || [];
                    const assignments = timeline.filter(t => t.action === 'Handler Assigned' || t.action?.toLowerCase()?.includes('handler assigned'));
                    if (assignments.length === 0) {
                      return timeline.some(t => t.action === 'Handler Accepted' || t.action === 'Handler Transfer Accepted' || t.action?.toLowerCase()?.includes('handler accepted') || t.action?.toLowerCase()?.includes('handler transfer accepted'));
                    }
                    const sortedAssignments = [...assignments].sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));
                    const lastAssignmentTime = new Date(sortedAssignments[0].timestamp || sortedAssignments[0].createdAt);
                    const acceptances = timeline.filter(t => t.action === 'Handler Accepted' || t.action === 'Handler Transfer Accepted' || t.action?.toLowerCase()?.includes('handler accepted') || t.action?.toLowerCase()?.includes('handler transfer accepted'));
                    return acceptances.some(t => new Date(t.timestamp || t.createdAt) >= lastAssignmentTime);
                  })();
                  const wasRejected = txn.timeline?.some(t =>
                    t.action?.toLowerCase()?.includes('receipt rejected') ||
                    t.action?.toLowerCase()?.includes('request rejected')
                  );

                  if (!hasAccepted) {
                    return (
                      <>
                        <Button
                          size="sm"
                          variant="success"
                          onClick={handleCollectFromStore}
                        >
                          Accept Delivery Job
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-rose-600 border-rose-200 hover:bg-rose-50"
                          onClick={handleHandlerReject}
                        >
                          Reject Job
                        </Button>
                      </>
                    );
                  }

                  return (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setStoreActionType('assign_handler');
                          setStoreModal(true);
                        }}
                      >
                        Transfer Handler Role
                      </Button>
                      {!wasRejected ? (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={handleConfirmDispatch}
                        >
                          Send to Requester
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={handleSendToStore}
                        >
                          Send to Store
                        </Button>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            {/* Requester Actions (Confirm Receipt only) */}
            {txn.status === 'dispatched' && isSender && !txn.requesterRejected && !txn.rejectedDeliveryStatus && (
              <>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => setReceiveModal(true)}
                >
                  Confirm Receipt
                </Button>
              </>
            )}

            {/* Handler Actions (After Requester Rejection) */}
            {txn.status === 'dispatched' && txn.rejectedDeliveryStatus === 'rejected_by_requester' && isHandler && !hasPendingTransfer && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setStoreActionType('assign_handler');
                    setStoreModal(true);
                  }}
                >
                  Transfer Handler Role
                </Button>
                <Button
                  size="sm"
                  variant="success"
                  onClick={handleSendToStore}
                >
                  Send to Store
                </Button>
              </>
            )}

            {/* Store Admin Action (Accept Returned Materials from Handler) */}
            {txn.status === 'dispatched' && txn.rejectedDeliveryStatus === 'sent_to_store' && (activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'store')) && (
              <Button
                size="sm"
                variant="success"
                onClick={handleAcceptRejectedReturn}
              >
                Accept Returned Materials
              </Button>
            )}

            {/* Return Handler Actions Panel */}
            {(() => {
              let activeReturn = returnsList?.find(r =>
                ['handler_assigned', 'collected'].includes(r.status) &&
                (r.returnHandler?._id === user?._id || r.returnHandler === user?._id)
              );
              if (!activeReturn) {
                activeReturn = returnsList?.find(r =>
                  ['handler_assigned', 'collected'].includes(r.status)
                );
              }
              if (!activeReturn) return null;

              const isAssignedReturnHandler = activeReturn.returnHandler?._id === user?._id || activeReturn.returnHandler === user?._id;
              const isStoreAdmin = activeRole.role === 'department_admin' && activeRole.adminType === 'store';
              const isSuper = activeRole.role === 'super_admin';

              if (!isAssignedReturnHandler && !isStoreAdmin && !isSuper) return null;

              const activeReturns = returnsList?.filter(r =>
                r.status === activeReturn.status &&
                (r.returnHandler?._id || r.returnHandler) === (activeReturn.returnHandler?._id || activeReturn.returnHandler)
              ) || [activeReturn];

              return (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-955/20 px-2.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900 uppercase">
                    Return of {activeReturns.length > 1 ? activeReturns.map(r => r.barcode).join(', ') : activeReturn.barcode} ({activeReturn.status.replace('_', ' ')})
                  </span>

                  {activeReturn.status === 'handler_assigned' && (isAssignedReturnHandler || isSuper) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-rose-600 border-rose-200 hover:bg-rose-50"
                        onClick={async () => {
                          if (confirm('Decline this return assignment?')) {
                            try {
                              for (const r of activeReturns) {
                                await api.put(`/barcodes/return/${r._id}/handler-action`, {
                                  actionType: 'reject',
                                  remarks: 'Handler declined return request assignment'
                                });
                              }
                              alert('Return requests rejected successfully!');
                              fetchData();
                            } catch (err) {
                              alert(err.response?.data?.message || 'Failed to decline return request.');
                            }
                          }
                        }}
                      >
                        Reject Assignment
                      </Button>
                      <Button
                        size="sm"
                        variant="success"
                        onClick={async () => {
                          try {
                            for (const r of activeReturns) {
                              await api.put(`/barcodes/return/${r._id}/handler-action`, {
                                actionType: 'collect',
                                remarks: 'Handler collected returning items from requester'
                              });
                            }
                            alert('Returns collected from requester successfully!');
                            fetchData();
                          } catch (err) {
                            alert(err.response?.data?.message || 'Failed to collect return.');
                          }
                        }}
                      >
                        Accept (Collect from Requester)
                      </Button>
                    </>
                  )}

                  {activeReturn.status === 'collected' && (
                    <>
                      {(isStoreAdmin || isSuper || isAssignedReturnHandler) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setStoreActionType('assign_return_handler');
                            setStoreModal(true);
                          }}
                        >
                          Change Handler
                        </Button>
                      )}
                      {(isAssignedReturnHandler || isSuper) && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={async () => {
                            try {
                              for (const r of activeReturns) {
                                await api.put(`/barcodes/return/${r._id}/handler-action`, {
                                  actionType: 'deliver',
                                  remarks: 'Handler delivered returning items to store'
                                });
                              }
                              alert('Returns delivered to store successfully!');
                              fetchData();
                            } catch (err) {
                              alert(err.response?.data?.message || 'Failed to deliver to store.');
                            }
                          }}
                        >
                          Deliver to Store
                        </Button>
                      )}
                    </>
                  )}
                </div>
              );
            })()}



            {/* Return Multiple Button (only shown when transaction is in active status, user is the requester, not the handler, and no active return is on handler) */}
            {txn.status === 'active' && (txn.requester?._id === user?._id || txn.requester === user?._id) && (txn.handler?._id !== user?._id && txn.handler !== user?._id) && !returnsList?.some(r => (r.fromUser?._id === user?._id || r.fromUser === user?._id) && ['handler_assigned', 'collected'].includes(r.status)) && (
              <Button size="sm" variant="outline" onClick={() => navigate(`/transactions/${txn._id}/return-multiple`)}>
                Return Multiple
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
            if (txn.requesterRejected) {
              const rejectTimeline = txn.timeline?.find(t => t.action === 'Request Rejected' || t.action === 'Receipt Rejected');
              const rejectUser = rejectTimeline?.user || txn.requester;
              const rejectTime = rejectTimeline?.timestamp || txn.updatedAt;
              return (
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mt-1">
                  Rejected by: {rejectUser?.fullName || 'Requester'} (REQUESTER) on {new Date(rejectTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} at {new Date(rejectTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </p>
              );
            }
            const rejectEntry = txn.approvalChain?.find(a => a.action === 'rejected');
            if (rejectEntry) {
              return (
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mt-1">
                  Rejected by: {rejectEntry.user?.fullName || 'Approver'} ({rejectEntry.role?.replace('_', ' ')?.toUpperCase()}) on {new Date(rejectEntry.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} at {new Date(rejectEntry.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
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
            {(['mgt_approved', 'store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active', 'partially_returned', 'closed'].includes(txn.status) && !allMaterialsResolved && !txn.chatLocked) && (
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
            {!isRequesterTLOrAdmin && (
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
            )}

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

            {/* Expected Return Date Row */}
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded-xl shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Expected Return Date</span>
                <p className="font-bold text-slate-855 dark:text-slate-200 text-xs truncate">
                  {txn.dueDate ? new Date(txn.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
                </p>
              </div>
            </div>

            {/* Store Dispatch Remarks / Purpose */}
            {txn.remarks && (
              <div className="flex items-start gap-3.5 md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 rounded-xl shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Store Dispatch Remarks / Purpose</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs italic">
                    "{txn.remarks}"
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Progress Summary timeline */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
            <h3 className="font-black text-sm text-slate-800 dark:text-white">Progress Summary</h3>
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

        const returnedCount = barcodes.filter(b => b.status === 'Returned').length;
        const closedCount = barcodes.filter(b => b.status === 'Closed').length;
        const exchangedCount = barcodes.filter(b => b.status === 'Exchanged').length;

        const totalItemsVal = barcodes.length > 0
          ? (activeCount + returnedCount + closedCount + exchangedCount)
          : (txn.totalItems || totalItemsCount);

        return (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
            {[
              { label: 'Total Items', val: totalItemsVal, icon: Inbox, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20' },
              { label: 'Active', val: activeCount, icon: ArrowRightLeft, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20' },
              { label: 'Exchanged', val: exchangedCount, icon: RefreshCw, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20' },
              { label: 'Returned', val: returnedCount, icon: RotateCcw, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/20' },
              { label: 'Closed', val: closedCount, icon: Lock, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/20' },
              { label: 'Cancelled', val: barcodes.filter(b => b.status === 'Cancelled').length + (txn.status === 'cancelled' ? (txn.totalItems || totalItemsCount) : 0), icon: AlertTriangle, color: 'text-slate-650 bg-slate-50 dark:bg-slate-950/20' }
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
                <div key={mIdx} className="border border-slate-100 dark:border-slate-800/80 rounded-xl p-4 bg-slate-50/30 dark:bg-slate-900/10">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-150">{mat.name}</h4>
                      {(() => {
                        let descText = mat.description;
                        if (descText && descText.startsWith('Split child of')) {
                          const parentBarcode = descText.replace('Split child of', '').trim();
                          const childBarcode = mat.barcodes && mat.barcodes[0] ? (mat.barcodes[0].barcode || mat.barcodes[0]) : '';
                          if (childBarcode) {
                            descText = `Split child: ${childBarcode} created from Parent: ${parentBarcode}`;
                          }
                        }
                        return descText ? <p className="text-xs text-slate-400 mt-0.5">{descText}</p> : null;
                      })()}
                    </div>
                    <div className="flex flex-col items-end text-right">
                      <Badge variant="info" className="text-xs px-2 py-0.5">{mat.quantity} {mat.unit || 'pcs'}</Badge>
                      {mat.price > 0 && (
                        <div className="text-[10px] text-slate-500 font-bold mt-1">
                          Unit Price: ₹{mat.price.toLocaleString('en-IN')} | Total: ₹{(mat.price * mat.quantity).toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>
                  </div>

                  {(!mat.barcodes || mat.barcodes.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">No barcodes assigned to this material yet (Pending dispatch).</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {mat.barcodes.map((bc, bIdx) => {
                        const bcStr = bc.barcode || bc;
                        const bcDetail = barcodes.find(b => b.barcode === bcStr);
                        const status = bcDetail?.status || bc.status || 'Active';
                        const ownerName = bcDetail?.owner?.fullName || bc.owner?.fullName || txn.requester?.fullName || 'Requester';

                        return (
                          <div
                            key={bIdx}
                            onClick={() => handleBarcodeClick(bcStr)}
                            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-2.5 rounded-lg flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors gap-2"
                          >
                            <div className="min-w-0 flex flex-col gap-0.5">
                              <span className="text-xs font-mono font-black text-blue-650 dark:text-blue-450 tracking-wide">
                                {bcStr}
                              </span>
                              <span className="text-[10px] text-slate-500 font-bold truncate">Owner: {ownerName}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant={status === 'Returned' ? 'secondary' : status === 'Cancelled' ? 'danger' : status === 'Active' ? 'success' : 'primary'} className="text-[9px] px-2 py-0.5 leading-none shrink-0 font-bold">
                                {status.toUpperCase()}
                              </Badge>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {txn.materials && txn.materials.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50/50 dark:bg-blue-955/10 border border-blue-100 dark:border-blue-900 rounded-xl flex justify-between items-center text-xs font-black">
                  <span className="text-slate-500 uppercase tracking-wider font-bold">Transaction Valuation / Combined Total:</span>
                  <span className="text-sm text-blue-650 dark:text-blue-400 font-black">
                    ₹{txn.materials.reduce((sum, mat) => sum + ((mat.price || 0) * mat.quantity), 0).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
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
                {unifiedTimeline.map((item, idx) => {
                  const isPending = item.status === 'PENDING';
                  const isRejected = item.status === 'REJECTED';
                  const badgeColor = isPending
                    ? 'bg-slate-200 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500'
                    : isRejected
                      ? 'bg-rose-600 border-rose-600 text-white'
                      : 'bg-emerald-600 border-emerald-600 text-white';

                  return (
                    <div key={idx} className={`relative ${isPending ? 'opacity-60' : ''}`}>
                      <span className={`absolute -left-[45px] top-[2px] w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black shadow-sm select-none ${badgeColor}`}>
                        {item.badgeChar}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-bold block">
                            {item.timestamp ? formatTimelineTime(item.timestamp) : 'Pending Action'}
                          </span>
                          <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm
                            ${isPending
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                              : isRejected
                                ? 'bg-rose-500/10 text-rose-500 dark:bg-rose-950/20'
                                : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/20'
                            }
                          `}>
                            {item.status}
                          </span>
                        </div>
                        <h4 className={`text-xs font-black font-sans mt-0.5 ${isPending ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-105'}`}>
                          {item.action}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium italic mt-0.5">
                          By: {item.by} {item.remarks ? `— ${item.remarks}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
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
                  {barcodes.filter(b => b.status === 'Cancelled').length || (txn.status === 'cancelled' ? barcodes.length : 0)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Transfers */}
        {activeTab === 'transfers' && (
          <Card title="Internal Transfers Log">
            <div className="flex flex-col gap-3">
              {barcodes.filter(b => b.history.some(h => h.action.toLowerCase().includes('transfer'))).length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No internal barcode transfers have occurred in this challan.</p>
              ) : (
                barcodes.filter(b => b.history.some(h => h.action.toLowerCase().includes('transfer'))).map(bc => (
                  <div key={bc.barcode} className="p-4 border border-slate-105 bg-white dark:bg-slate-950 rounded-xl">
                    <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{bc.barcode}</span>
                    <div className="mt-2 pl-3 border-l border-slate-200 dark:border-slate-800 flex flex-col gap-2.5">
                      {bc.history.filter(h => h.action.toLowerCase().includes('transfer') || h.action.toLowerCase().includes('created')).map((h, i) => (
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
              {barcodes.filter(b => b.status === 'Returned' || b.status === 'Return Requested' || b.status === 'Exchanged').length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No returns initiated yet.</p>
              ) : (
                barcodes.filter(b => b.status === 'Returned' || b.status === 'Return Requested' || b.status === 'Exchanged').map(bc => (
                  <div
                    key={bc.barcode}
                    onClick={() => handleBarcodeClick(bc.barcode)}
                    className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{bc.barcode}</span>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{bc.materialName}</h4>
                    </div>
                    <Badge variant={bc.status === 'Returned' ? 'secondary' : bc.status === 'Exchanged' ? 'danger' : 'warning'}>
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

      {/* Invoice Matching Card for Accounts
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
      )} */}

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
            {(txn.status !== 'closed' || !allMaterialsResolved) && txn.status !== 'completed' && txn.status !== 'rejected' && !txn.chatLocked && !allMaterialsResolved ? (
              <form onSubmit={handleSendTxnMessage} className="pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0 flex gap-2">
                <input
                  type="text"
                  placeholder="Type your message here..."
                  value={txnChatText}
                  onChange={(e) => setTxnChatText(e.target.value)}
                  required
                  className="flex-1 text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
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
              {txn.remarks && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-xl space-y-1">
                  <span className="block text-[9px] text-slate-400 font-black uppercase tracking-wider">Store Dispatch Remarks / Purpose</span>
                  <p className="text-xs text-slate-700 dark:text-slate-350 font-medium italic">"{txn.remarks}"</p>
                </div>
              )}
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
                  Convert DC Type
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
                  <option value="DC Internal">DC Internal</option>
                  <option value="DC FOC">DC FOC</option>
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
                  {convertSubmitting ? 'Converting...' : 'Convert to DC'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Close / DC Conversion Modal */}
      {barcodeCloseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Convert Barcode to DC
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">DC Conversion Approval Request</p>
              </div>
              <button onClick={() => setBarcodeCloseModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBarcodeCloseSubmit} className="mt-4 flex flex-col gap-4 text-xs">
              <div>
                <span className="block text-slate-500 font-bold uppercase tracking-wider mb-1">Target Barcode</span>
                <span className="block font-mono font-black text-blue-650 dark:text-blue-450 text-xs mt-0.5">{selectedBarcodeForClose}</span>
              </div>

              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Target Document Type *</label>
                <select
                  value={barcodeCloseDocType}
                  onChange={(e) => setBarcodeCloseDocType(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                >
                  <option value="DC Internal">DC Internal</option>
                  <option value="DC FOC">DC FOC</option>
                  <option value="Invoice">Invoice</option>
                </select>
              </div>

              {['DC FOC', 'Invoice'].includes(barcodeCloseDocType) && (
                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Choose Management Approver *</label>
                  <select
                    value={barcodeCloseMgtId}
                    onChange={(e) => setBarcodeCloseMgtId(e.target.value)}
                    required
                    className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                  >
                    <option value="">Select Management Admin...</option>
                    {managementUsers.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">New Document Number *</label>
                <input
                  type="text"
                  value={barcodeCloseDocNumber}
                  onChange={(e) => setBarcodeCloseDocNumber(e.target.value)}
                  required
                  placeholder="e.g. DC-10092"
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Remarks / Reason *</label>
                <textarea
                  value={barcodeCloseRemarks}
                  onChange={(e) => setBarcodeCloseRemarks(e.target.value)}
                  required
                  placeholder="Conversion reason for approval..."
                  rows="2.5"
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" type="button" onClick={() => setBarcodeCloseModal(false)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={barcodeCloseSubmitting}>
                  {barcodeCloseSubmitting ? 'Requesting...' : 'Request Conversion'}
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