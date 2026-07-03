import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, CheckCircle, XCircle, Clock, Eye, AlertTriangle, 
  ArrowLeft, ArrowRight, Shield, Layers, FileText, CheckSquare, Square,
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
  const isHandler = !!selectedItem && (selectedItem.handler?._id === user?._id || selectedItem.handler === user?._id);
  
  // Search & Filters
  const [search, setSearch] = useState('');
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

  // Custom Rejection Modal States
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectModalTitle, setRejectModalTitle] = useState('');
  const [rejectModalLabel, setRejectModalLabel] = useState('');
  const [rejectReasonText, setRejectReasonText] = useState('');
  const [rejectActionCallback, setRejectActionCallback] = useState(null);
  
  // Store Sourcing Modal States
  const [storeModal, setStoreModal] = useState(false);
  const [storeActionType, setStoreActionType] = useState('accept');
  const [storeRemarks, setStoreRemarks] = useState('');
  const [handlerId, setHandlerId] = useState('');
  const [handlers, setHandlers] = useState([]);

  const getCardStatusLine = (t) => {
    const isHandler = t.handler?._id === user?._id || t.handler === user?._id;
    if (isHandler) {
      if (t.status === 'store_accepted') return "Action Required: Collect from Store";
      if (t.status === 'handler_assigned') return "Action Required: Dispatch/Handover";
    }

    if (activeRole.role === 'team_lead') {
      if (t.status === 'submitted') return "Action Required: Review Request";
      return "Tracking: Awaiting Sourcing";
    }

    if (activeRole.role === 'department_admin' && activeRole.adminType === 'management') {
      if (t.status === 'tl_approved') return "Action Required: Review Request";
      return "Tracking: Awaiting Store";
    }

    if (activeRole.role === 'department_admin' && activeRole.adminType === 'store') {
      if (['mgt_approved', 'ready_for_dispatch'].includes(t.status)) return "Action Required: Store Sourcing Accept";
      if (t.status === 'store_accepted') return "Action Required: Assign Sourcing Handler";
      return "Tracking: Sourced/Dispatched";
    }

    if (activeRole.role === 'employee') {
      return `Tracking: ${t.status.toUpperCase().replace('_', ' ')}`;
    }

    return t.status.toUpperCase().replace('_', ' ');
  };

  const getContextInfo = (txn) => {
    const isHandler = txn.handler?._id === user?._id || txn.handler === user?._id;
    if (isHandler) {
      if (txn.status === 'store_accepted') {
        return {
          why: "You are the assigned Sourcing Handler for this request, and the store has accepted/marked the items ready.",
          action: "Collect the items from the Store and click 'Accept (Collect from Store)' below to put them in transit."
        };
      }
      if (txn.status === 'handler_assigned') {
        return {
          why: "You have collected the materials from the store and are delivering them.",
          action: "Hand over the materials to the requester at their location, then click 'Send to Requester' below to complete transit."
        };
      }
    }

    if (activeRole.role === 'team_lead') {
      if (txn.status === 'submitted') {
        return {
          why: "This request was created by an employee in your department and requires your initial approval.",
          action: "Review the items and click 'Approve & Forward' or 'Reject Request' below."
        };
      }
      return {
        why: `This request is currently in the '${txn.status.replace('_', ' ').toUpperCase()}' stage.`,
        action: "No pending action required from you at this stage."
      };
    }

    if (activeRole.role === 'department_admin' && activeRole.adminType === 'management') {
      if (txn.status === 'tl_approved') {
        return {
          why: "This request has been approved by the department Team Lead and requires your management approval before sourcing.",
          action: "Review and click 'Approve & Forward' or 'Reject Request' below."
        };
      }
      return {
        why: `This request is currently in the '${txn.status.replace('_', ' ').toUpperCase()}' stage.`,
        action: "No pending action required from you at this stage."
      };
    }

    if (activeRole.role === 'department_admin' && activeRole.adminType === 'store') {
      if (['mgt_approved', 'ready_for_dispatch', 'submitted', 'tl_approved'].includes(txn.status)) {
        return {
          why: "This request has received all approvals and is now routed to the store to prepare the inventory.",
          action: "Check inventory availability and click 'Ready (Store Accept)' below when the barcodes are prepared."
        };
      }
      if (txn.status === 'store_accepted') {
        return {
          why: "You have marked these items ready. A sourcing handler needs to be assigned to pick them up.",
          action: "Select a Handler and click 'Sourcing / Assign Handler', or click 'Direct Dispatch' if the requester is collecting in person."
        };
      }
      return {
        why: `This request is currently in the '${txn.status.replace('_', ' ').toUpperCase()}' stage.`,
        action: "No pending action required from you at this stage."
      };
    }

    if (activeRole.role === 'employee') {
      if (['submitted', 'tl_approved', 'mgt_approved', 'ready_for_dispatch', 'store_accepted', 'handler_assigned'].includes(txn.status)) {
        return {
          why: "This is your material request. It is currently moving through the approval & sourcing pipeline.",
          action: `Awaiting current stage: ${txn.status.replace('_', ' ').toUpperCase()}. No action needed from you.`
        };
      }
    }

    return {
      why: `Transaction status is '${txn.status.replace('_', ' ').toUpperCase()}'.`,
      action: "No immediate action required."
    };
  };

  const getTransferContextInfo = (req) => {
    const isRecipient = req.toUser?._id === user?._id || req.toUser === user?._id;
    if (isRecipient && req.status === 'pending') {
      return {
        why: `${req.fromUser?.fullName || 'Another user'} wants to transfer ownership of barcode ${req.barcode} to you.`,
        action: "Please verify the photo/GPS details and click 'Confirm Receipt (Accept Return)' or 'Reject Request' below."
      };
    }
    return {
      why: `Barcode transfer is currently '${req.status.toUpperCase()}'.`,
      action: "Awaiting recipient confirmation."
    };
  };

  const getSplitContextInfo = (req) => {
    if (activeRole.role === 'department_admin' && activeRole.adminType === 'store') {
      return {
        why: `Requester ${req.requester?.fullName || 'Requester'} submitted a split request for barcode ${req.barcode} to register child units.`,
        action: "Specify the child barcode IDs and click 'Approve & Create Material' to finalize the split, or reject."
      };
    }
    return {
      why: "A split request is pending store approval.",
      action: "Awaiting store validation."
    };
  };

  const getReturnContextInfo = (req) => {
    if (activeRole.role === 'department_admin' && activeRole.adminType === 'store') {
      return {
        why: `Employee ${req.fromUser?.fullName || 'Employee'} has returned barcode ${req.barcode} to the store.`,
        action: "Please verify the physical item's presence/remarks and click 'Confirm Receipt (Accept Return)' below."
      };
    }
    return {
      why: "Return request is pending store validation.",
      action: "Awaiting store admin confirmation."
    };
  };

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const isStore = activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'store');
      
      const [txnRes, transferRes, splitRes, returnRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/barcodes/pending/transfers'),
        isStore ? api.get('/barcodes/split-requests/pending') : Promise.resolve({ data: { data: [] } }),
        api.get('/barcodes/returns/pending')
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
          defaultList = allTxns.filter(t => t.status === 'tl_approved');
        } else if (activeRole.adminType === 'store') {
          defaultList = allTxns.filter(t => ['mgt_approved', 'ready_for_dispatch', 'store_accepted'].includes(t.status));
        }
      } else if (activeRole.role === 'super_admin') {
        defaultList = allTxns.filter(t => !['completed', 'received', 'closed', 'rejected'].includes(t.status));
      }

      setSelectedItem(null);
    } catch (err) {
      console.error('Error fetching approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
    api.get('/employees?limit=1000&allDepartments=true')
      .then(res => {
        const empList = res.data.employees || res.data.data || [];
        setHandlers(empList.map(h => ({ value: h._id, label: `${h.fullName} (${h.employeeId})` })));
      })
      .catch(err => console.error('Error loading employees:', err));
  }, [activeRole.role, activeRole.adminType]);

  // Apply filters to transactions
  const filteredTxns = txns.filter(t => {
    // For employee, only show their own requests
    if (activeRole.role === 'employee') {
      const isMyTxn = (t.requester?._id === user?._id || t.requester === user?._id) || 
                      (t.handler?._id === user?._id || t.handler === user?._id);
      if (!isMyTxn) return false;
    }

    // 1. Status mapping based on tab
    if (statusTab === 'pending') {
      if (activeRole.role === 'employee') {
        const isHandlerPending = (t.handler?._id === user?._id || t.handler === user?._id) && t.status === 'store_accepted';
        const isRequesterPending = (t.requester?._id === user?._id || t.requester === user?._id) && t.status === 'dispatched';
        if (!isHandlerPending && !isRequesterPending) return false;
      } else if (activeRole.role === 'team_lead') {
        if (t.status !== 'submitted') return false;
      } else if (activeRole.role === 'department_admin') {
        if (activeRole.adminType === 'management') {
          // Management sees tl_approved requests
          if (t.status !== 'tl_approved') return false;
        } else if (activeRole.adminType === 'store') {
          // Store sees requests after management approved
          if (!['mgt_approved', 'ready_for_dispatch', 'store_accepted'].includes(t.status)) return false;
        } else {
          return false;
        }
      } else if (activeRole.role === 'super_admin') {
        if (['completed', 'received', 'closed', 'rejected'].includes(t.status)) return false;
      }
    } else if (statusTab === 'approved') {
      let allowedStatuses = ['ready_for_dispatch', 'store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active', 'closed'];
      if (activeRole.role === 'team_lead') {
        allowedStatuses.push('tl_approved', 'mgt_approved');
      } else if (activeRole.role === 'department_admin' && activeRole.adminType === 'management') {
        allowedStatuses.push('mgt_approved');
      } else if (activeRole.role === 'super_admin') {
        allowedStatuses.push('tl_approved', 'mgt_approved');
      }
      if (!allowedStatuses.includes(t.status)) return false;
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
    let reason = actionRemarks;
    if (action === 'reject' && !reason.trim()) {
      setRejectModalTitle('Reject Sourcing Request');
      setRejectModalLabel('Please specify a rejection reason for this request:');
      setRejectActionCallback(() => async (reasonText) => {
        setActionError('');
        setSubmitting(true);
        const idsToProcess = txnId ? [txnId] : (selectedItem ? [selectedItem._id] : []);
        if (idsToProcess.length === 0) {
          setActionError('Select at least one transaction to process.');
          setSubmitting(false);
          return;
        }
        try {
          const promises = idsToProcess.map(id => {
            return api.put(`/transactions/${id}/reject`, { 
              reason: reasonText
            });
          });
          await Promise.all(promises);
          alert(`Rejected ${idsToProcess.length} request(s) successfully.`);
          setSelectedIds(new Set());
          setActionRemarks('');
          setSelectedItem(null);
          fetchApprovals();
        } catch (err) {
          setActionError(err.response?.data?.message || 'Rejection action failed.');
        } finally {
          setSubmitting(false);
        }
      });
      setRejectModalOpen(true);
      return;
    }
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
            remarks: reason || 'Approved'
          });
        } else {
          return api.put(`/transactions/${id}/reject`, { 
            reason: reason || 'Rejected'
          });
        }
      });

      await Promise.all(promises);
      alert(`${action === 'approve' ? 'Approved' : 'Rejected'} ${idsToProcess.length} requests successfully.`);
      setSelectedIds(new Set());
      setActionRemarks('');
      setSelectedItem(null);
      fetchApprovals();
      if (action === 'approve' && idsToProcess.length > 0) {
        navigate(`/transactions/${idsToProcess[0]}`);
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Approval action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferAction = async (transferId, action) => {
    let reason = actionRemarks;
    if (action === 'reject' && !reason.trim()) {
      setRejectModalTitle('Reject Barcode Transfer');
      setRejectModalLabel('Please specify a rejection reason for this transfer:');
      setRejectActionCallback(() => async (reasonText) => {
        setActionError('');
        setSubmitting(true);
        try {
          const payload = {
            transferId,
            action,
            reason: reasonText,
            gps: { lat: 18.5204, lng: 73.8567, address: 'MIDC Pune, India' }
          };
          await api.post('/barcodes/handle-transfer', payload);
          alert(`Transfer request rejected successfully.`);
          setActionRemarks('');
          setSelectedItem(null);
          fetchApprovals();
        } catch (err) {
          setActionError(err.response?.data?.message || 'Failed to update barcode transfer.');
        } finally {
          setSubmitting(false);
        }
      });
      setRejectModalOpen(true);
      return;
    }
    setActionError('');
    setSubmitting(true);
    try {
      const payload = {
        transferId,
        action,
        reason: action === 'reject' ? reason.trim() : (actionRemarks || `Transfer request ${action}ed`),
        gps: { lat: 18.5204, lng: 73.8567, address: 'MIDC Pune, India' }
      };
      if (action === 'accept') {
        payload.photos = [{ url: transferPhoto, capturedAt: new Date().toISOString() }];
      }
      await api.post('/barcodes/handle-transfer', payload);
      alert(`Transfer request ${action}ed successfully.`);
      setActionRemarks('');
      setSelectedItem(null);
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
    let reason = actionRemarks;
    if (!reason.trim()) {
      setRejectModalTitle('Reject Split Request');
      setRejectModalLabel('Please enter a rejection reason for this split request:');
      setRejectActionCallback(() => async (reasonText) => {
        setActionError('');
        setSubmitting(true);
        try {
          await api.post('/barcodes/approve-split', {
            requestId: selectedItem._id,
            action: 'reject',
            reason: reasonText
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
      });
      setRejectModalOpen(true);
      return;
    }
    setActionError('');
    setSubmitting(true);
    try {
      await api.post('/barcodes/approve-split', {
        requestId: selectedItem._id,
        action: 'reject',
        reason: reason.trim()
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

  const handleReturnHandlerAction = async (actionType) => {
    setActionError('');
    setSubmitting(true);
    try {
      await api.put(`/barcodes/return/${selectedItem._id}/handler-action`, {
        actionType,
        remarks: actionRemarks || `Return marked as ${actionType}ed`
      });
      alert(`Return request marked as ${actionType}ed successfully!`);
      setActionRemarks('');
      setSelectedItem(null);
      fetchApprovals();
    } catch (err) {
      setActionError(err.response?.data?.message || `Failed to perform handler action: ${actionType}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStoreActionSubmit = async (e) => {
    e.preventDefault();
    setActionError('');
    setSubmitting(true);
    try {
      if (storeActionType === 'accept') {
        await api.put(`/transactions/${selectedItem._id}/store-accept`, {
          remarks: storeRemarks
        });
        alert('Transaction accepted by store successfully.');
      } else {
        await api.put(`/transactions/${selectedItem._id}/assign-handler`, {
          handlerId,
          remarks: storeRemarks
        });
        alert('Sourcing handler assigned successfully.');
      }
      const targetId = selectedItem._id;
      setStoreModal(false);
      setStoreRemarks('');
      setHandlerId('');
      setSelectedItem(null);
      fetchApprovals();
      navigate(`/transactions/${targetId}`);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Store action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDirectDispatch = async () => {
    if (confirm('Directly dispatch materials to requester bypassing handler?')) {
      setActionError('');
      setSubmitting(true);
      try {
        await api.patch(`/transactions/${selectedItem._id}/store-action`, {
          actionType: 'direct_dispatch',
          remarks: 'Direct dispatch bypassed handler'
        });
        alert('Direct dispatch completed.');
        const targetId = selectedItem._id;
        setSelectedItem(null);
        fetchApprovals();
        navigate(`/transactions/${targetId}/receive`);
      } catch (err) {
        alert(err.response?.data?.message || 'Direct dispatch failed.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleConfirmDispatch = async (txnId) => {
    setActionError('');
    setSubmitting(true);
    try {
      await api.patch(`/transactions/${txnId}/handler-action`, {
        actionType: 'dispatch',
        remarks: 'Handler confirmed pick up, in transit.'
      });
      alert('In transit status logged.');
      setSelectedItem(null);
      fetchApprovals();
      navigate(`/transactions/${txnId}/receive`);
    } catch (err) {
      alert(err.response?.data?.message || 'Confirm dispatch failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCollectFromStore = async (txnId) => {
    setActionError('');
    setSubmitting(true);
    try {
      await api.patch(`/transactions/${txnId}/handler-action`, {
        actionType: 'collect',
        remarks: 'Handler collected materials from store.'
      });
      alert('Materials collected. Status updated to handler assigned.');
      setSelectedItem(null);
      fetchApprovals();
      navigate(`/transactions/${txnId}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Collection failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleHandlerReject = async (txnId) => {
    setRejectModalTitle('Reject Sourcing Assignment');
    setRejectModalLabel('Please enter a reason for rejecting this assignment:');
    setRejectActionCallback(() => async (reasonText) => {
      setActionError('');
      setSubmitting(true);
      try {
        await api.patch(`/transactions/${txnId}/handler-action`, {
          actionType: 'reject',
          remarks: reasonText
        });
        alert('Sourcing assignment rejected.');
        setSelectedItem(null);
        fetchApprovals();
      } catch (err) {
        alert(err.response?.data?.message || 'Rejection failed.');
      } finally {
        setSubmitting(false);
      }
    });
    setRejectModalOpen(true);
  };

  const handleRequesterRejectReceipt = async (txnId) => {
    setRejectModalTitle('Reject Material Receipt');
    setRejectModalLabel('Please specify a rejection reason for this material receipt:');
    setRejectActionCallback(() => async (reasonText) => {
      setActionError('');
      setSubmitting(true);
      try {
        await api.patch(`/transactions/${txnId}/reject-receipt`, {
          reason: reasonText
        });
        alert('Receipt rejected and transaction closed.');
        setSelectedItem(null);
        fetchApprovals();
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to reject receipt.');
      } finally {
        setSubmitting(false);
      }
    });
    setRejectModalOpen(true);
  };

  const handleRequesterAcceptReceipt = async (txnId) => {
    const remarks = prompt('Enter optional remarks for accepting this material receipt:');
    setActionError('');
    setSubmitting(true);
    try {
      const lat = (18.5204 + (Math.random() - 0.5) * 0.01).toFixed(4);
      const lng = (73.8567 + (Math.random() - 0.5) * 0.01).toFixed(4);
      await api.patch(`/transactions/${txnId}/receive`, {
        receiverGeo: {
          lat,
          lng,
          address: `Received Dock Area, Pune Plant (${lat}° N, ${lng}° E)`
        },
        materialCondition: 'Good',
        remarks: remarks || 'Accepted from Pending dashboard',
        photo: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80'
      });
      alert('Materials accepted. Barcodes distributed to inventory.');
      setSelectedItem(null);
      fetchApprovals();
      navigate(`/transactions/${txnId}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Error receiving materials.');
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="flex flex-col gap-5 h-[calc(100vh-7rem)] overflow-hidden">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white m-0">
            Approvals Command Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">Active Role Profile: <span className="font-extrabold text-blue-650 dark:text-blue-400">{activeRole.label}</span></p>
        </div>

        {/* Search bar on the right side of title */}
        <div className="w-full sm:w-80 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search ID, barcode, sender..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 shrink-0">
        <button onClick={() => setStatusTab('pending')} className={`pb-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${statusTab === 'pending' ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-slate-400'}`}>
          Pending Requests
        </button>
        {(activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'store')) && (
          <button onClick={() => setStatusTab('split_requests')} className={`pb-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${statusTab === 'split_requests' ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-slate-400'}`}>
            Split Requests ({pendingSplits.length})
          </button>
        )}
        {(activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'store') || pendingReturns.length > 0) && (
          <button onClick={() => setStatusTab('return_requests')} className={`pb-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${statusTab === 'return_requests' ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-slate-400'}`}>
            Return Requests ({pendingReturns.length})
          </button>
        )}
        <button onClick={() => setStatusTab('approved')} className={`pb-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${statusTab === 'approved' ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-slate-400'}`}>
          Approved History
        </button>
      </div>



      {/* Main display layout */}
      <div className="flex-1 flex gap-5 overflow-hidden min-h-0">
        
        {!selectedItem ? (
          /* Left Side: Cards Queue list taking full width */
          <div className="w-full flex flex-col gap-3 overflow-y-auto pr-1">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-wider">Split Request</span>
                            <span className="text-xs font-extrabold text-slate-655 dark:text-slate-400 font-mono">{s.transactionId}</span>
                          </div>
                          <Badge variant="primary">PENDING</Badge>
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">{s.materialName}</h4>
                          <p className="text-[10px] text-slate-550 font-semibold mt-0.5">Parent: <span className="font-extrabold text-blue-600">{s.barcode}</span></p>
                          <p className="text-[10px] text-slate-550 font-semibold">Requester: <span className="font-extrabold">{s.requester?.fullName}</span></p>
                        </div>
                        <div className="mt-2 pt-1.5 border-t border-dashed border-slate-100 dark:border-slate-800 text-[10px] font-bold flex justify-between items-center text-slate-500">
                          <span className="text-rose-600 dark:text-rose-400">
                            {activeRole.role === 'department_admin' && activeRole.adminType === 'store' ? "Action Required: Approve Split" : "Tracking: Pending Split Approval"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                    </div>
                  </div>
                )}

                {/* Return Requests List */}
                {statusTab === 'return_requests' && pendingReturns.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1 mb-1 block">Return Requests</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-450 tracking-wider">Return Request</span>
                            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400 font-mono">{r.transactionId}</span>
                          </div>
                          <Badge variant={r.status === 'completed' ? 'success' : 'warning'}>
                            {r.status.toUpperCase().replace('_', ' ')}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Barcode: <span className="font-mono text-blue-650 font-black">{r.barcode}</span></p>
                          <p className="text-[10px] text-slate-550 font-semibold mt-0.5">From: <span className="font-extrabold">{r.fromUser?.fullName}</span></p>
                          <p className="text-[10px] text-slate-550 font-semibold">Condition: <span className="font-extrabold text-amber-700 uppercase">{r.condition}</span></p>
                        </div>
                        <div className="mt-2 pt-1.5 border-t border-dashed border-slate-100 dark:border-slate-800 text-[10px] font-bold flex justify-between items-center text-slate-500">
                          <span className="text-rose-600 dark:text-rose-400 font-extrabold">
                            {r.status === 'handler_assigned' && (r.returnHandler?._id === user?._id || r.returnHandler === user?._id) ? "Action Required: Collect returning items" :
                             r.status === 'collected' && (r.returnHandler?._id === user?._id || r.returnHandler === user?._id) ? "Action Required: Deliver to Store" :
                             r.status === 'store_received' && (activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'store')) ? "Action Required: Confirm Return Receipt" :
                             (activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'store')) && r.status === 'pending' ? "Action Required: Confirm Return Receipt" :
                             `Tracking: ${r.status.toUpperCase().replace('_', ' ')}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                    </div>
                  </div>
                )}

                {/* Transactions List */}
                {statusTab !== 'split_requests' && filteredTxns.length > 0 && (
                  <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1 mb-1 block">Material Requests</span>
                  


                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-black uppercase text-blue-655 dark:text-blue-450 tracking-wider">
                                {t.status === 'submitted' ? 'Material Request (Team Lead Approval)' :
                                 t.status === 'tl_approved' ? 'Material Request (Management Approval)' :
                                 ['mgt_approved', 'ready_for_dispatch'].includes(t.status) ? 'Store Sourcing Request' :
                                 t.status === 'store_accepted' ? 'Assign Sourcing Handler Request' :
                                 t.status === 'handler_assigned' ? 'Handler Transit Request' :
                                 t.status === 'dispatched' ? 'Requester Delivery Confirmation' : 'Material Request'}
                              </span>
                              <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400 font-mono">{t.transactionId}</span>
                            </div>
                          </div>

                        </div>

                        <div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 line-clamp-1 leading-snug">{t.description || 'Material Logistics Dossier'}</h4>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Sender: <span className="font-extrabold">{t.sender?.fullName || t.requester?.fullName}</span></p>
                        </div>

                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-extrabold uppercase mt-1">
                          <span>{t.documentType} Challan</span>
                          <span className="text-slate-700 dark:text-slate-300 font-black">₹{t.grandTotal?.toLocaleString() || '0'}</span>
                        </div>
                        <div className="mt-2 pt-1.5 border-t border-dashed border-slate-100 dark:border-slate-800 text-[10px] font-bold flex justify-between items-center text-slate-500">
                          <span className={`${getCardStatusLine(t).startsWith('Action') ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                            {getCardStatusLine(t)}
                          </span>
                        </div>

                        {t.crossDepartment && (
                          <span className="absolute top-2 right-14 text-[9px] font-extrabold text-amber-700 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded">Cross-Dept</span>
                        )}
                      </div>
                    );
                  })}
                    </div>
                  </div>
                )}

                {/* Barcode Transfers List */}
                {filteredTransfers.length > 0 && (
                  <div className="flex flex-col gap-2 mt-4">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest pl-1 mb-1 block">Barcode Transfers</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Transfer Request</span>
                            <span className="text-xs font-extrabold text-indigo-655 dark:text-indigo-400 font-mono">{tr.barcode}</span>
                          </div>
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
                        <div className="mt-2 pt-1.5 border-t border-dashed border-slate-100 dark:border-slate-800 text-[10px] font-bold flex justify-between items-center text-slate-500">
                          <span className={`${(tr.toUser?._id === user?._id || tr.toUser === user?._id) ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                            {(tr.toUser?._id === user?._id || tr.toUser === user?._id) ? "Action Required: Confirm Ownership" : "Tracking: Pending Recipient Confirmation"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Right Side: Selected details preview workspace taking full width */
          <div className="w-full flex bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex-col">
            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-105 flex items-center shrink-0">
              <button 
                onClick={() => setSelectedItem(null)} 
                className="flex items-center gap-2 text-xs font-black text-blue-650 hover:text-blue-700 transition animate-fade-in"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Pending List
              </button>
            </div>
            {selectedItem.condition ? (
              /* RETURN REQUEST PREVIEW */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">Return Request</span>
                      <Badge variant={selectedItem.status === 'completed' ? 'success' : 'warning'}>
                        {selectedItem.status.toUpperCase().replace('_', ' ')}
                      </Badge>
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

                  {selectedItem.returnHandler && (
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block mb-0.5">ASSIGNED RETURN HANDLER</span>
                        <span className="font-bold text-slate-855 dark:text-slate-150">{selectedItem.returnHandler?.fullName}</span>
                        <span className="block text-[9px] text-slate-400 mt-0.5 font-bold">ID: {selectedItem.returnHandler?.employeeId}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block mb-0.5">DELIVERY METHOD</span>
                        <span className="font-bold text-blue-650 uppercase font-mono">Via Courier Handler</span>
                      </div>
                    </div>
                  )}

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

                  <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col gap-4">
                    {/* Optional remarks input for handler actions */}
                    {['handler_assigned', 'collected'].includes(selectedItem.status) && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Decision Comments / Remarks</label>
                        <textarea
                          value={actionRemarks}
                          onChange={(e) => setActionRemarks(e.target.value)}
                          placeholder="Add optional remarks for collection/delivery..."
                          rows="2"
                          className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3.5 py-2 font-semibold"
                        />
                      </div>
                    )}
                    
                    <div className="flex justify-end gap-3 shrink-0">
                      <Button variant="outline" onClick={() => { setSelectedItem(null); setActionRemarks(''); }}>
                        Cancel
                      </Button>
                      
                      {/* Handler Collect Button */}
                      {selectedItem.status === 'handler_assigned' && (activeRole.role === 'super_admin' || selectedItem.returnHandler?._id === user?._id || selectedItem.returnHandler === user?._id) && (
                        <Button variant="success" onClick={() => handleReturnHandlerAction('collect')} disabled={submitting}>
                          Accept (Collect from Requester)
                        </Button>
                      )}
                      
                      {/* Handler Deliver Button */}
                      {selectedItem.status === 'collected' && (activeRole.role === 'super_admin' || selectedItem.returnHandler?._id === user?._id || selectedItem.returnHandler === user?._id) && (
                        <Button variant="success" onClick={() => handleReturnHandlerAction('deliver')} disabled={submitting}>
                          Deliver to Store
                        </Button>
                      )}
                      
                      {/* Store Confirm Receipt Button */}
                      {(selectedItem.status === 'pending' || selectedItem.status === 'store_received' || activeRole.role === 'super_admin') && (activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'store')) && (
                        <Button variant="success" onClick={handleAcceptReturnRequest} disabled={submitting}>
                          Confirm Receipt (Accept Return)
                        </Button>
                      )}
                    </div>
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
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {selectedItem.expectedReturnDate ? new Date(selectedItem.expectedReturnDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : (selectedItem.dueDate ? new Date(selectedItem.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A')}
                      </span>
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
                  {statusTab === 'pending' && activeRole.role !== 'employee' && !isHandler && (
                    <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col gap-4">
                      {((activeRole.role === 'department_admin' && activeRole.adminType === 'store') ||
                        (activeRole.role === 'super_admin' && ['mgt_approved', 'ready_for_dispatch', 'store_accepted'].includes(selectedItem.status))) ? (
                        <div className="flex flex-col gap-3">
                          {actionError && <p className="text-xs text-rose-500 font-bold">{actionError}</p>}
                          <div className="flex gap-3 justify-end">
                            {selectedItem.materials?.every(m => !m.barcodes || m.barcodes.length === 0) ? (
                              <Button
                                variant="success"
                                onClick={() => navigate(`/store-dispatch/${selectedItem.transactionId}`)}
                                disabled={submitting}
                              >
                                Register & Dispatch Request
                              </Button>
                            ) : (
                              <>
                                {['submitted', 'tl_approved', 'mgt_approved', 'ready_for_dispatch'].includes(selectedItem.status) &&
                                 !['store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active', 'closed'].includes(selectedItem.status) && (
                                  <Button
                                    variant="success"
                                    onClick={() => {
                                      setStoreActionType('accept');
                                      setStoreModal(true);
                                    }}
                                    disabled={submitting}
                                  >
                                    Ready (Store Accept)
                                  </Button>
                                )}
                                {selectedItem.status === 'store_accepted' &&
                                 selectedItem.materials?.every(m => !m.barcodes || m.barcodes.length === 0) &&
                                 !['handler_assigned', 'dispatched', 'received', 'completed', 'active', 'closed'].includes(selectedItem.status) && (
                                  <>
                                    <Button variant="outline" onClick={handleDirectDispatch} disabled={submitting}>
                                      Direct Dispatch (Bypass Handler)
                                    </Button>
                                    <Button
                                      variant="success"
                                      onClick={() => {
                                        setStoreActionType('assign_handler');
                                        setStoreModal(true);
                                      }}
                                      disabled={submitting}
                                    >
                                      Sourcing / Assign Handler
                                    </Button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  )}

                  {/* Handler Actions Panel */}
                  {(activeRole.role === 'super_admin' || selectedItem.handler?._id === user?._id || selectedItem.handler === user?._id) && ['store_accepted', 'handler_assigned'].includes(selectedItem.status) && (
                    <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col gap-4">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Handler Sourcing Actions</h4>
                      {actionError && <p className="text-xs text-rose-500 font-bold">{actionError}</p>}
                      <div className="flex gap-3 justify-end">
                        <div className="flex gap-3">
                          {selectedItem.status === 'store_accepted' ? (
                            <>
                              <Button
                                variant="outline"
                                className="text-rose-600 border-rose-250 hover:bg-rose-50"
                                onClick={() => handleHandlerReject(selectedItem._id)}
                                disabled={submitting}
                              >
                                Reject Assignment
                              </Button>
                              <Button
                                variant="success"
                                onClick={() => handleCollectFromStore(selectedItem._id)}
                                disabled={submitting}
                              >
                                Accept (Collect from Store)
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="success"
                              onClick={() => handleConfirmDispatch(selectedItem._id)}
                              disabled={submitting}
                            >
                              Send to Requester (In Transit)
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Requester Actions Panel */}
                  {(activeRole.role === 'super_admin' || selectedItem.requester?._id === user?._id || selectedItem.requester === user?._id) && selectedItem.status === 'dispatched' && (
                    <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col gap-4">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Requester Sourcing Actions</h4>
                      {actionError && <p className="text-xs text-rose-500 font-bold">{actionError}</p>}
                      <div className="flex gap-3 justify-end">
                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            className="text-rose-600 border-rose-250 hover:bg-rose-50"
                            onClick={() => handleRequesterRejectReceipt(selectedItem._id)}
                            disabled={submitting}
                          >
                            Reject Material Receipt
                          </Button>
                          <Button
                            variant="success"
                            onClick={() => handleRequesterAcceptReceipt(selectedItem._id)}
                            disabled={submitting}
                          >
                            Accept Material Receipt
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          }
        </div>
      )}
    </div>

      {/* Store Sourcing / Action Modal */}
      {storeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Store dispatch / Sourcing Manager
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Assign handler or complete DC sourcing check.</p>

            <form onSubmit={handleStoreActionSubmit} className="mt-4 flex flex-col gap-4 text-xs font-semibold text-slate-650 dark:text-slate-400">
              <div>
                <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Action Mode *</label>
                <select
                  value={storeActionType}
                  onChange={(e) => setStoreActionType(e.target.value)}
                  className="w-full text-xs bg-slate-550 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
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
                    className="w-full text-xs bg-slate-550 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                  >
                    <option value="">Select Handler employee</option>
                    {handlers.map(h => (
                      <option key={h.value} value={h.value}>{h.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-550 font-bold uppercase tracking-wider mb-1.5">Remarks / Sourcing notes</label>
                <textarea
                  value={storeRemarks}
                  onChange={(e) => setStoreRemarks(e.target.value)}
                  placeholder="e.g. Sourced from Shelf Bay 4..."
                  rows="2"
                  className="w-full text-xs bg-slate-550 border border-slate-250 dark:bg-slate-950 dark:border-slate-800 rounded-lg px-3.5 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" type="button" onClick={() => setStoreModal(false)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={submitting}>Submit Sourcing Status</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Rejection Reason Dialog */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {rejectModalTitle || 'Confirm Rejection'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {rejectModalLabel || 'Please specify a rejection reason:'}
            </p>
            <div className="mt-4">
              <textarea
                value={rejectReasonText}
                onChange={(e) => setRejectReasonText(e.target.value)}
                placeholder="Type reason here..."
                rows="3"
                className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-rose-500 transition"
              />
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectReasonText('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                type="button"
                onClick={() => {
                  if (!rejectReasonText.trim()) {
                    alert('Rejection reason is required.');
                    return;
                  }
                  if (rejectActionCallback) {
                    rejectActionCallback(rejectReasonText.trim());
                  }
                  setRejectModalOpen(false);
                  setRejectReasonText('');
                }}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingTransactionsPage;
