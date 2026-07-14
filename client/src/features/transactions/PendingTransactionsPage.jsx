import {
  ArrowLeft,
  Clock,
  Search,
  X,
  Camera
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import useActiveRole from '../../hooks/useActiveRole';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';
import TallyMaterialAutocomplete from '../../components/ui/TallyMaterialAutocomplete';

const PendingTransactionsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const activeRole = useActiveRole();

  const [loading, setLoading] = useState(true);
  const [txns, setTxns] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [pendingCloseRequests, setPendingCloseRequests] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null); // Can be a transaction OR a barcode transfer or close request
  const isHandler = !!selectedItem && (selectedItem.handler?._id === user?._id || selectedItem.handler === user?._id);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDueToday, setFilterDueToday] = useState(false);
  const [filterEscalated, setFilterEscalated] = useState(false);
  const [filterCrossDept, setFilterCrossDept] = useState(false);
  const [statusTab, setStatusTab] = useState('pending'); // 'pending' | 'history'
  const [filterRequestType, setFilterRequestType] = useState('all'); // 'all' | 'material' | 'transfer' | 'split' | 'return' | 'conversion'

  // Selection for bulk actions (transactions only)
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Action state
  const [actionError, setActionError] = useState('');
  const [actionRemarks, setActionRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [transferPhoto, setTransferPhoto] = useState('/images/mock-transfer.jpg');
  const handleTransferPhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSubmitting(true);
    setActionError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setTransferPhoto(data.url);
    } catch (err) {
      setActionError('Photo upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };
  const [pendingSplits, setPendingSplits] = useState([]);
  const [approveNewBarcode, setApproveNewBarcode] = useState('');
  const [approveMaterialName, setApproveMaterialName] = useState('');
  const [pendingReturns, setPendingReturns] = useState([]);
  const [pendingExchanges, setPendingExchanges] = useState([]);
  const [exchangeNewBarcode, setExchangeNewBarcode] = useState('');
  const [txnExpectedReturnDates, setTxnExpectedReturnDates] = useState({});

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

  // Physical Receipt Modal States
  const [receiveModal, setReceiveModal] = useState(false);
  const [receiveCondition, setReceiveCondition] = useState('Good');
  const [receiveRemarks, setReceiveRemarks] = useState('');
  const [receivePhoto, setReceivePhoto] = useState('');
  const [receiveCoords, setReceiveCoords] = useState({ lat: 18.5204, lng: 73.8567, address: 'MIDC Pune, India' });
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [receivingSubmitting, setReceivingSubmitting] = useState(false);

  // Split Sourcing Modal States for Tally
  const [approveQuantity, setApproveQuantity] = useState(1);
  const [approveUnit, setApproveUnit] = useState('pcs');
  const [approveRate, setApproveRate] = useState(0);
  const [approveGodown, setApproveGodown] = useState('');

  useEffect(() => {
    if (selectedItem && selectedItem.barcode && !selectedItem.materials) {
      // It is a split request
      setApproveMaterialName(selectedItem.requestedMaterialName || selectedItem.materialName || '');
      setApproveNewBarcode('');
      setApproveQuantity(1);
      setApproveUnit(selectedItem.materialName?.toLowerCase().includes('cable') ? 'mtr' : 'pcs');
      setApproveRate(selectedItem.materialName?.toLowerCase().includes('cable') ? 500 : 0);
      setApproveGodown(selectedItem.requester?.fullName || '');
    }
  }, [selectedItem]);

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
        const isTLOrAdmin = txn.requester?.role === 'team_lead' || txn.requester?.role === 'department_admin';
        return {
          why: isTLOrAdmin
            ? "This request was initiated by a Team Lead/Admin and requires your management approval before sourcing."
            : "This request has been approved by the department Team Lead and requires your management approval before sourcing.",
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
      const isCloseReqEligible = ['super_admin', 'team_lead', 'department_admin'].includes(activeRole.role);

      const [txnRes, transferRes, splitRes, returnRes, closeRes, exchangeRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/barcodes/pending/transfers'),
        isStore ? api.get('/barcodes/split-requests/pending') : Promise.resolve({ data: { data: [] } }),
        api.get('/barcodes/returns/pending'),
        isCloseReqEligible ? api.get('/barcodes/close-requests/pending') : Promise.resolve({ data: { data: [] } }),
        isStore ? api.get('/barcodes/exchange-requests/pending') : Promise.resolve({ data: { data: [] } })
      ]);

      const allTxns = txnRes.data.data || [];
      const allTransfers = transferRes.data.transfers || [];
      const allSplits = splitRes.data.data || [];
      const allReturns = returnRes.data.data || [];
      const allCloses = closeRes.data.data || [];
      const allExchanges = exchangeRes.data.data || [];

      // Map transaction expected return dates
      const dateMap = {};
      allTxns.forEach(t => {
        if (t.transactionId) {
          dateMap[t.transactionId] = t.expectedReturnDate || t.dueDate || null;
        }
      });
      setTxnExpectedReturnDates(dateMap);

      setTxns(allTxns);
      setPendingTransfers(allTransfers);
      setPendingSplits(allSplits);
      setPendingExchanges(allExchanges);
      // Group returns by transactionId, status, and returnHandler for single-card workflow view
      const groupedReturnsMap = {};
      allReturns.forEach(r => {
        const handlerKey = r.returnHandler?._id || r.returnHandler || 'none';
        const key = `${r.transactionId}_${r.status}_${handlerKey}`;
        if (!groupedReturnsMap[key]) {
          groupedReturnsMap[key] = {
            ...r,
            isGroup: true,
            items: []
          };
        }
        groupedReturnsMap[key].items.push(r);
      });
      setPendingReturns(Object.values(groupedReturnsMap));
      setPendingCloseRequests(allCloses);

      // Determine default list based on user role to auto-select first item
      let defaultList = [];
      if (activeRole.role === 'employee') {
        defaultList = allTxns.filter(t =>
          (t.requester?._id === user?._id && ['submitted', 'tl_approved'].includes(t.status)) ||
          ((t.handler?._id === user?._id || t.handler === user?._id) && (['store_accepted', 'handler_assigned'].includes(t.status) || (t.status === 'dispatched' && t.rejectedDeliveryStatus === 'rejected_by_requester'))) ||
          ((t.pendingHandlerTransfer?.toHandler?._id === user?._id || t.pendingHandlerTransfer?.toHandler === user?._id) && t.pendingHandlerTransfer?.status === 'pending')
        );
      } else if (activeRole.role === 'team_lead') {
        defaultList = allTxns.filter(t => t.status === 'submitted');
      } else if (activeRole.role === 'department_admin') {
        if (activeRole.adminType === 'management') {
          defaultList = allTxns.filter(t =>
            t.status === 'tl_approved' &&
            (t.managementApprover?._id || t.managementApprover)?.toString() === user?._id?.toString()
          );
        } else if (activeRole.adminType === 'store') {
          defaultList = allTxns.filter(t =>
            ['mgt_approved', 'ready_for_dispatch', 'store_accepted'].includes(t.status) ||
            (t.status === 'dispatched' && t.rejectedDeliveryStatus === 'sent_to_store')
          );
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
        setHandlers(empList.filter(h =>
          h._id !== user?._id &&
          h.role !== 'super_admin' &&
          !(h.role === 'department_admin' && h.departmentAdminType === 'store')
        ).map(h => ({ value: h._id, label: `${h.fullName} (${h.employeeId})` })));
      })
      .catch(err => console.error('Error loading employees:', err));
  }, [activeRole.role, activeRole.adminType]);

  // Apply filters to transactions
  const filteredTxns = txns.filter(t => {
    // For employee, only show their own requests
    if (activeRole.role === 'employee') {
      const isMyTxn = (t.requester?._id === user?._id || t.requester === user?._id) ||
        (t.handler?._id === user?._id || t.handler === user?._id) ||
        (t.pendingHandlerTransfer?.toHandler?._id === user?._id || t.pendingHandlerTransfer?.toHandler === user?._id);
      if (!isMyTxn) return false;
    }

    // For management, only show requests where they are the selected managementApprover
    if (activeRole.role === 'department_admin' && activeRole.adminType === 'management') {
      const isMyMgtApprover = (t.managementApprover?._id || t.managementApprover)?.toString() === user?._id?.toString();
      if (!isMyMgtApprover) return false;
    }

    // 1. Status mapping based on tab
    const isHandlerDeliveryPending = t.handler && ['store_accepted', 'handler_assigned', 'dispatched'].includes(t.status);

    if (statusTab === 'pending') {
      if (isHandlerDeliveryPending) {
        if (t.status === 'handler_assigned') {
          // Only show to the assigned handler or pending transfer target
          const isMyHandler = t.handler && (t.handler?._id === user?._id || t.handler === user?._id);
          const isPendingTarget = t.pendingHandlerTransfer?.status === 'pending' && (t.pendingHandlerTransfer?.toHandler?._id === user?._id || t.pendingHandlerTransfer?.toHandler === user?._id);
          if (!isMyHandler && !isPendingTarget) return false;
        } else if (t.status === 'store_accepted') {
          // Only show to store admin (and super admin)
          const isStore = activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'store');
          if (!isStore) return false;
        } else if (t.status === 'dispatched') {
          if (t.rejectedDeliveryStatus === 'rejected_by_requester') {
            // Only show to the assigned handler or pending transfer target
            const isMyHandler = t.handler && (t.handler?._id === user?._id || t.handler === user?._id);
            const isPendingTarget = t.pendingHandlerTransfer?.status === 'pending' && (t.pendingHandlerTransfer?.toHandler?._id === user?._id || t.pendingHandlerTransfer?.toHandler === user?._id);
            if (!isMyHandler && !isPendingTarget) return false;
          } else if (t.rejectedDeliveryStatus === 'sent_to_store') {
            // Only show to store admin (and super admin)
            const isStore = activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'store');
            if (!isStore) return false;
          } else {
            // Normal transit - only show to the requester (confirm receipt)
            const isMyRequester = t.requester && (t.requester?._id === user?._id || t.requester === user?._id);
            if (!isMyRequester) return false;
          }
        }
      } else {
        if (activeRole.role === 'employee') {
          const isRequesterPending = (t.requester?._id === user?._id || t.requester === user?._id) && t.status === 'dispatched';
          if (!isRequesterPending) return false;
        } else if (activeRole.role === 'team_lead') {
          if (t.status !== 'submitted') return false;
        } else if (activeRole.role === 'department_admin') {
          if (activeRole.adminType === 'management') {
            if (t.status !== 'tl_approved') return false;
          } else if (activeRole.adminType === 'store') {
            const isSentToStore = t.status === 'dispatched' && t.rejectedDeliveryStatus === 'sent_to_store';
            if (!isSentToStore && !['mgt_approved', 'ready_for_dispatch', 'store_accepted'].includes(t.status)) return false;
          } else {
            return false;
          }
        } else if (activeRole.role === 'super_admin') {
          if (['completed', 'received', 'closed', 'rejected', 'active', 'partially_returned'].includes(t.status)) return false;
        }
      }
    } else if (statusTab === 'history') {
      const isHistoryStatus = ['completed', 'received', 'closed', 'rejected', 'active', 'partially_returned'].includes(t.status);
      if (!isHistoryStatus) return false;
    }

    if (filterRequestType !== 'all' && filterRequestType !== 'material') return false;

    // 2. Search query
    if (search) {
      const q = search.toLowerCase();
      const matchId = t.transactionId.toLowerCase().includes(q);
      const matchRequester = t.requester?.fullName?.toLowerCase().includes(q) || t.sender?.fullName?.toLowerCase().includes(q);
      const matchMaterial = t.items?.some(it => it.materialName?.toLowerCase().includes(q)) || t.description?.toLowerCase().includes(q);
      if (!matchId && !matchRequester && !matchMaterial) return false;
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
    if (filterRequestType !== 'all' && filterRequestType !== 'transfer') return false;

    if (search) {
      const q = search.toLowerCase();
      const matchBarcode = tr.barcode.toLowerCase().includes(q);
      const matchRequester = tr.fromUser?.fullName?.toLowerCase().includes(q) || tr.toUser?.fullName?.toLowerCase().includes(q);
      const matchMaterial = tr.materialName?.toLowerCase().includes(q);
      if (!matchBarcode && !matchRequester && !matchMaterial) return false;
    }

    return true;
  });

  // Filter pending splits
  const filteredSplits = pendingSplits.filter(s => {
    if (statusTab !== 'pending') return false;
    if (filterRequestType !== 'all' && filterRequestType !== 'split') return false;
    if (search) {
      const q = search.toLowerCase();
      const matchId = s.transactionId?.toLowerCase().includes(q) || s.barcode?.toLowerCase().includes(q);
      const matchRequester = s.requester?.fullName?.toLowerCase().includes(q);
      const matchMaterial = s.materialName?.toLowerCase().includes(q);
      if (!matchId && !matchRequester && !matchMaterial) return false;
    }
    return true;
  });

  // Filter pending returns
  const filteredReturns = pendingReturns.filter(r => {
    if (statusTab !== 'pending') return false;
    if (filterRequestType !== 'all' && filterRequestType !== 'return') return false;
    if (search) {
      const q = search.toLowerCase();
      const matchId = r.transactionId?.toLowerCase().includes(q) || r.barcode?.toLowerCase().includes(q) || r.items?.some(it => it.barcode?.toLowerCase().includes(q));
      const matchRequester = r.fromUser?.fullName?.toLowerCase().includes(q);
      const matchMaterial = r.materialName?.toLowerCase().includes(q) || r.items?.some(it => it.materialName?.toLowerCase().includes(q));
      if (!matchId && !matchRequester && !matchMaterial) return false;
    }
    return true;
  });

  // Filter pending close requests
  const filteredCloseRequests = pendingCloseRequests.filter(cr => {
    if (statusTab !== 'pending') return false;
    if (filterRequestType !== 'all' && filterRequestType !== 'conversion') return false;
    if (search) {
      const q = search.toLowerCase();
      const matchId = cr.barcode?.toLowerCase().includes(q) || cr.documentNumber?.toLowerCase().includes(q);
      const matchRequester = cr.requester?.fullName?.toLowerCase().includes(q);
      const matchMaterial = cr.materialName?.toLowerCase().includes(q);
      if (!matchId && !matchRequester && !matchMaterial) return false;
    }
    return true;
  });

  // Filter pending exchange requests
  const filteredExchanges = pendingExchanges.filter(e => {
    if (statusTab !== 'pending') return false;
    if (filterRequestType !== 'all' && filterRequestType !== 'exchange') return false;
    if (search) {
      const q = search.toLowerCase();
      const matchId = e.transactionId?.toLowerCase().includes(q) || e.oldBarcode?.toLowerCase().includes(q) || e.newBarcode?.toLowerCase().includes(q);
      const matchRequester = e.requester?.fullName?.toLowerCase().includes(q);
      const matchMaterial = e.materialName?.toLowerCase().includes(q);
      if (!matchId && !matchRequester && !matchMaterial) return false;
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
      const targetTxnId = selectedItem?.transactionId;
      setActionRemarks('');
      setSelectedItem(null);
      fetchApprovals();
      if (action === 'accept' && targetTxnId) {
        navigate(`/transactions/${targetTxnId}`);
      }
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
    if (!approveGodown.trim()) {
      alert('Please specify the Tally Godown Name.');
      return;
    }
    setActionError('');
    setSubmitting(true);
    try {
      await api.post('/barcodes/approve-split', {
        requestId: selectedItem._id,
        newBarcode: approveNewBarcode.trim(),
        materialName: approveMaterialName.trim() || selectedItem.materialName,
        quantity: Number(approveQuantity) || 1,
        unit: approveUnit.trim(),
        price: Number(approveRate) || 0,
        godown: approveGodown.trim(),
        reason: actionRemarks ? actionRemarks.trim() : ''
      });
      alert('Split request approved and new material created!');
      const targetTxnId = selectedItem?.transactionId;
      setApproveNewBarcode('');
      setApproveMaterialName('');
      setApproveQuantity(1);
      setApproveUnit('pcs');
      setApproveRate(0);
      setApproveGodown('');
      setActionRemarks('');
      setSelectedItem(null);
      fetchApprovals();
      if (targetTxnId) {
        navigate(`/transactions/${targetTxnId}`);
      }
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
      if (selectedItem.items && selectedItem.items.length > 0) {
        for (const item of selectedItem.items) {
          await api.put(`/barcodes/return/${item._id}/accept`);
        }
      } else {
        await api.put(`/barcodes/return/${selectedItem._id}/accept`);
      }
      alert('Return request accepted successfully!');
      const targetTxnId = selectedItem?.transactionId;
      setSelectedItem(null);
      fetchApprovals();
      if (targetTxnId) {
        navigate(`/transactions/${targetTxnId}`);
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to accept return request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseRequestAction = async (action, requestId) => {
    let reason = '';
    if (action === 'reject') {
      const reasonText = prompt('Please enter a rejection reason for this DC Conversion request:');
      if (reasonText === null) return; // Cancelled
      reason = reasonText || 'Rejected';
    } else {
      const isInvoice = selectedItem.documentType === 'Invoice';
      if (isInvoice && selectedItem.status === 'pending_accounts_approval') {
        const invoiceNumber = prompt('Please enter the Invoice Number to close this conversion request:', selectedItem.documentNumber || '');
        if (invoiceNumber === null) return; // Cancel clicked
        if (!invoiceNumber.trim()) {
          alert('Invoice number is required.');
          return;
        }

        // Trigger file input for actual invoice document upload
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/pdf,image/*';
        fileInput.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          setSubmitting(true);
          setActionError('');
          try {
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await api.post('/upload', formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });

            const invoiceUrl = uploadRes.data.url;

            await api.post(`/barcodes/close-requests/${requestId}/respond`, {
              action: 'approve',
              invoiceNumber: invoiceNumber.trim(),
              invoiceUrl
            });

            alert('Invoice registered and RDC closed successfully with uploaded document!');
            setSelectedItem(null);
            fetchApprovals();
          } catch (err) {
            setActionError(err.response?.data?.message || 'Failed to upload/approve close request.');
          } finally {
            setSubmitting(false);
          }
        };
        fileInput.click();
        return;
      } else {
        if (!confirm('Are you sure you want to approve this DC Conversion request?')) {
          return;
        }
      }
    }

    setSubmitting(true);
    setActionError('');
    try {
      await api.post(`/barcodes/close-requests/${requestId}/respond`, {
        action,
        rejectionReason: reason
      });
      alert(`DC Conversion request successfully ${action}d!`);
      setSelectedItem(null);
      fetchApprovals();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to process request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnHandlerAction = async (actionType) => {
    setActionError('');
    setSubmitting(true);
    try {
      if (selectedItem.items && selectedItem.items.length > 0) {
        for (const item of selectedItem.items) {
          await api.put(`/barcodes/return/${item._id}/handler-action`, {
            actionType,
            remarks: actionRemarks || `Return marked as ${actionType}ed`
          });
        }
      } else {
        await api.put(`/barcodes/return/${selectedItem._id}/handler-action`, {
          actionType,
          remarks: actionRemarks || `Return marked as ${actionType}ed`
        });
      }
      alert(`Return request marked as ${actionType}ed successfully!`);
      const targetTxnId = selectedItem?.transactionId;
      setActionRemarks('');
      setSelectedItem(null);
      fetchApprovals();
      if (targetTxnId) {
        navigate(`/transactions/${targetTxnId}`);
      }
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
      } else if (storeActionType === 'assign_return_handler') {
        const activeReturns = selectedItem.items || [selectedItem];
        for (const r of activeReturns) {
          await api.put(`/barcodes/return/${r._id}/assign-handler`, {
            handlerId,
            remarks: storeRemarks
          });
        }
        alert('Return handler assigned successfully.');
        const targetTxnId = selectedItem.transactionId;
        setStoreModal(false);
        setStoreRemarks('');
        setHandlerId('');
        setSelectedItem(null);
        fetchApprovals();
        navigate(`/transactions/${targetTxnId}`);
        return;
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
        navigate(`/transactions/${targetId}`);
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
      navigate(`/transactions/${txnId}`);
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
  };

  const handleAcceptTransfer = async (txnId) => {
    if (!confirm('Accept this handler transfer request? You will become the new handler.')) return;
    setActionError('');
    setSubmitting(true);
    try {
      await api.patch(`/transactions/${txnId}/handler-action`, {
        actionType: 'accept_transfer',
        remarks: 'Transfer accepted.'
      });
      alert('Handler transfer accepted. You are now the handler.');
      setSelectedItem(null);
      fetchApprovals();
    } catch (err) {
      alert(err.response?.data?.message || 'Accept transfer failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectTransfer = async (txnId) => {
    setRejectModalTitle('Reject Handler Transfer');
    setRejectModalLabel('Please specify a reason for rejecting this handler transfer:');
    setRejectActionCallback(() => async (reasonText) => {
      setActionError('');
      setSubmitting(true);
      try {
        await api.patch(`/transactions/${txnId}/handler-action`, {
          actionType: 'reject_transfer',
          remarks: reasonText
        });
        alert('Handler transfer rejected.');
        setSelectedItem(null);
        fetchApprovals();
      } catch (err) {
        alert(err.response?.data?.message || 'Reject transfer failed.');
      } finally {
        setSubmitting(false);
      }
    });
    setRejectModalOpen(true);
  };

  const handleCancelTransfer = async (txnId) => {
    if (!confirm('Cancel the pending handler transfer request?')) return;
    setActionError('');
    setSubmitting(true);
    try {
      await api.patch(`/transactions/${txnId}/handler-action`, {
        actionType: 'cancel_transfer',
        remarks: 'Cancelled by sender.'
      });
      alert('Handler transfer request cancelled.');
      setSelectedItem(null);
      fetchApprovals();
    } catch (err) {
      alert(err.response?.data?.message || 'Cancel transfer failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequesterRejectReceipt = async (txnId) => {
    setRejectModalTitle('Reject Material Receipt');
    setRejectModalLabel('Please specify a rejection reason for this material receipt:');
    setRejectActionCallback(() => async (reasonText) => {
      setActionError('');
      setSubmitting(true);
      try {
        const res = await api.patch(`/transactions/${txnId}/reject-receipt`, {
          reason: reasonText
        });
        alert(res.data?.message || 'Receipt rejected successfully.');
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

  const handleRequesterAcceptReceipt = (txnId) => {
    setReceiveCondition('Good');
    setReceiveRemarks('');
    setReceivePhoto('');
    setReceiveCoords({ lat: 18.5204, lng: 73.8567, address: 'MIDC Pune, India' });
    setReceiveModal(true);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCapturingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setReceivePhoto(data.url);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          const lat = position.coords.latitude.toFixed(4);
          const lng = position.coords.longitude.toFixed(4);
          setReceiveCoords({
            lat,
            lng,
            address: `Received Dock Area, Pune Plant (${lat}° N, ${lng}° E)`
          });
        }, () => {
          const lat = 18.5204;
          const lng = 73.8567;
          setReceiveCoords({
            lat,
            lng,
            address: `Received Dock Area, Pune Plant (Coordinates: ${lat}, ${lng})`
          });
        });
      }
    } catch (err) {
      alert('Photo upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setCapturingPhoto(false);
    }
  };

  const handleReceiveSubmit = async (e) => {
    e.preventDefault();
    if (!receivePhoto) {
      alert('Please capture/upload a photo to confirm physical receiving check.');
      return;
    }
    setReceivingSubmitting(true);
    try {
      await api.patch(`/transactions/${selectedItem._id}/receive`, {
        receiverGeo: receiveCoords,
        materialCondition: receiveCondition,
        remarks: receiveRemarks,
        photo: receivePhoto
      });
      alert('Materials accepted. Barcodes distributed to inventory.');
      setReceiveModal(false);
      setSelectedItem(null);
      fetchApprovals();
      navigate(`/transactions/${selectedItem._id}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Error receiving materials.');
    } finally {
      setReceivingSubmitting(false);
    }
  };

  const handleAcceptExchangeRequest = async () => {
    if (!exchangeNewBarcode.trim()) {
      alert('Please enter a new barcode ID.');
      return;
    }
    setActionError('');
    setSubmitting(true);
    try {
      const res = await api.post(`/barcodes/exchange-requests/${selectedItem._id}/respond`, {
        action: 'accept',
        newBarcode: exchangeNewBarcode
      });
      alert('Exchange request completed. Old barcode has been replaced with the new barcode.');
      setExchangeNewBarcode('');
      setSelectedItem(null);
      fetchApprovals();
      if (res.data.transactionDbId) {
        navigate(`/transactions/${res.data.transactionDbId}`);
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to approve exchange.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectExchangeRequest = async () => {
    const reason = prompt('Please specify a rejection reason:');
    if (!reason) {
      alert('Rejection reason is required.');
      return;
    }
    setActionError('');
    setSubmitting(true);
    try {
      const res = await api.post(`/barcodes/exchange-requests/${selectedItem._id}/respond`, {
        action: 'reject',
        reason
      });
      alert('Exchange request rejected.');
      setSelectedItem(null);
      fetchApprovals();
      if (res.data.transactionDbId) {
        navigate(`/transactions/${res.data.transactionDbId}`);
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to reject exchange.');
    } finally {
      setSubmitting(false);
    }
  };


  const showPricing = true;

  return (
    <div className="flex flex-col gap-5 h-[calc(100vh-7rem)] overflow-hidden">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
            Approvals Command Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">Active Role Profile: <span className="font-extrabold text-blue-650 dark:text-blue-400">{activeRole.label}</span></p>
        </div>

        {/* Filter and Search controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {/* Request Type Selector */}
          <select
            value={filterRequestType}
            onChange={(e) => setFilterRequestType(e.target.value)}
            className="w-full sm:w-44 px-3 py-2 text-xs bg-white border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-200 font-extrabold"
          >
            <option value="all">All Request Types</option>
            <option value="material">Material Requests</option>
            <option value="transfer">Barcode Transfers</option>
            <option value="split">Split Requests</option>
            <option value="return">Return Requests</option>
            <option value="conversion">Conversion Requests</option>
            <option value="exchange">Exchange Requests</option>
          </select>

          {/* Search bar */}
          <div className="w-full sm:w-80 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search ID, requester, material name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-200"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 shrink-0">
        <button onClick={() => setStatusTab('pending')} className={`pb-2.5 text-xs font-bold tracking-wider border-b-2 transition-all cursor-pointer ${statusTab === 'pending' ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-slate-400'}`}>
          Pending Requests ({filteredTxns.length + filteredTransfers.length + filteredSplits.length + filteredReturns.length + filteredCloseRequests.length + filteredExchanges.length})
        </button>
        <button onClick={() => setStatusTab('history')} className={`pb-2.5 text-xs font-bold tracking-wider border-b-2 transition-all cursor-pointer ${statusTab === 'history' ? 'border-blue-600 text-blue-600 font-extrabold' : 'border-transparent text-slate-400'}`}>
          Request History
        </button>
      </div>



      {/* Main display layout */}
      <div className="flex-1 flex gap-5 overflow-hidden min-h-0">

        {!selectedItem ? (
          /* Left Side: Cards Queue list taking full width */
          <div className="w-full flex flex-col gap-3 overflow-y-auto pr-1">
            {((statusTab === 'pending' && filteredTxns.length === 0 && filteredTransfers.length === 0 && filteredSplits.length === 0 && filteredReturns.length === 0 && filteredCloseRequests.length === 0 && filteredExchanges.length === 0) ||
              (statusTab === 'history' && filteredTxns.length === 0)) ? (
              <div className="text-center py-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <Clock className="w-10 h-10 text-slate-355 mx-auto mb-2.5 animate-pulse" />
                <p className="text-sm font-bold text-slate-500">Queue is empty</p>
              </div>
            ) : (
              <>
                {/* Split Requests List */}
                {statusTab === 'pending' && filteredSplits.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] text-slate-400 font-extrabold tracking-widest pl-1 mb-1 block">Split Requests</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredSplits.map(s => {
                        const isActive = selectedItem?._id === s._id && s.barcode && !s.fromUser;
                        return (
                          <div
                            key={s._id}
                            onClick={() => {
                              setSelectedItem(s);
                            }}
                            className={`p-4 rounded-xl hover:shadow-md cursor-pointer transition-all relative flex flex-col gap-2 border
                          ${isActive
                                ? 'border-purple-500 ring-1 ring-purple-500/20 bg-purple-50/20 dark:bg-purple-950/10'
                                : 'border-purple-200 dark:border-purple-900/40 bg-purple-50/10 dark:bg-purple-950/5 hover:border-purple-300 dark:hover:border-purple-800'}
                        `}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 tracking-wider font-extrabold">Split Request</span>
                                <span className="text-xs font-extrabold text-slate-655 dark:text-slate-400 font-mono">{s.transactionId}</span>
                              </div>
                              <Badge variant="primary">PENDING</Badge>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{s.materialName}</h4>
                              <p className="text-[10px] text-slate-550 dark:text-slate-300 font-semibold mt-0.5">Parent: <span className="font-extrabold text-blue-600">{s.barcode}</span></p>
                              <p className="text-[10px] text-slate-550 dark:text-slate-300 font-semibold">Requester: <span className="font-extrabold">{s.requester?.fullName}</span></p>
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
                )}                {/* Return Requests List */}
                {statusTab === 'pending' && filteredReturns.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] text-slate-400 font-extrabold tracking-widest pl-1 mb-1 block">Return Requests</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredReturns.map(r => {
                        const isActive = selectedItem?._id === r._id;
                        return (
                          <div
                            key={r._id}
                            onClick={() => setSelectedItem(r)}
                            className={`p-4 rounded-xl hover:shadow-md cursor-pointer transition-all relative flex flex-col gap-2 border
                          ${isActive
                                ? 'border-amber-500 ring-1 ring-amber-500/20 bg-amber-50/20 dark:bg-amber-950/10'
                                : 'border-amber-200 dark:border-amber-900/40 bg-amber-50/10 dark:bg-amber-950/5 hover:border-amber-300 dark:hover:border-amber-800'}
                        `}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 tracking-wider font-extrabold">Return Request</span>
                                <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400 font-mono">{r.transactionId}</span>
                              </div>
                              <Badge variant={r.status === 'completed' ? 'success' : 'warning'}>
                                {r.status.toUpperCase().replace('_', ' ')}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                                {r.items && r.items.length > 1 ? 'Barcodes: ' : 'Barcode: '}
                                <span className="font-mono text-blue-650 font-bold">
                                  {r.items && r.items.length > 1 ? r.items.map(it => it.barcode).join(', ') : r.barcode}
                                </span>
                              </p>
                              <p className="text-[10px] text-slate-555 dark:text-slate-300 font-semibold mt-0.5">From: <span className="font-extrabold">{r.fromUser?.fullName}</span></p>
                              <p className="text-[10px] text-slate-555 font-semibold">
                                Condition: <span className="font-extrabold text-amber-700">
                                  {r.items && r.items.length > 1 ? [...new Set(r.items.map(it => it.condition))].join(', ') : r.condition}
                                </span>
                              </p>
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
                )}                {/* DC/Invoice Conversion Requests List */}
                {statusTab === 'pending' && filteredCloseRequests.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] text-slate-400 font-extrabold tracking-widest pl-1 mb-1 block">Conversion Requests</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredCloseRequests.map(r => {
                        const isActive = selectedItem?._id === r._id && !!r.documentType;
                        const isInvoice = r.documentType === 'Invoice';
                        return (
                          <div
                            key={r._id}
                            onClick={() => setSelectedItem(r)}
                            className={`p-4 rounded-xl hover:shadow-md cursor-pointer transition-all relative flex flex-col gap-2 border
                          ${isActive
                                ? 'border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/10'
                                : 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/10 dark:bg-emerald-950/5 hover:border-emerald-300 dark:hover:border-emerald-800'}
                        `}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-bold tracking-wider font-extrabold text-emerald-600 dark:text-emerald-400">
                                  {isInvoice ? 'Invoice Conversion' : 'DC Conversion'}
                                </span>
                                <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400 font-mono">{r.barcode}</span>
                              </div>
                              <Badge variant="warning">
                                {r.status === 'pending_store_acceptance' ? 'AWAITING STORE' : 'PENDING'}
                              </Badge>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Convert to {r.documentType}</h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-300 font-semibold mt-0.5">Number: <span className="font-extrabold">{r.documentNumber}</span></p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-300 font-semibold">Requester: <span className="font-extrabold">{r.requester?.fullName}</span></p>
                            </div>
                            <div className="mt-2 pt-1.5 border-t border-dashed border-slate-100 dark:border-slate-800 text-[10px] font-bold flex justify-between items-center text-slate-500">
                              <span className="text-rose-600 dark:text-rose-400 font-extrabold">
                                {r.status === 'pending_store_acceptance' ? (
                                  (activeRole.role === 'department_admin' && activeRole.adminType === 'store') ? "Action Required: Store Accept" : "Tracking: Pending Store Acceptance"
                                ) : r.status === 'pending_accounts_approval' ? (
                                  (activeRole.role === 'department_admin' && activeRole.adminType === 'accounts') ? "Action Required: Upload Invoice" : "Tracking: Pending Accounts Approval"
                                ) : ['DC FOC', 'Invoice'].includes(r.documentType) ? (
                                  (activeRole.role === 'department_admin' && activeRole.adminType === 'management' && (r.managementApprover?._id || r.managementApprover || '').toString() === user?._id?.toString()) ? "Action Required: Management Approve" : "Tracking: Pending Management Approval"
                                ) : (
                                  activeRole.role === 'team_lead' ? "Action Required: Approve Conversion" : "Tracking: Pending TL Approval"
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Exchange Requests List */}
                {statusTab === 'pending' && filteredExchanges.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] text-slate-400 font-extrabold tracking-widest pl-1 mb-1 block">Exchange Requests</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredExchanges.map(e => {
                        const isActive = selectedItem?._id === e._id && !!e.oldBarcode;
                        return (
                          <div
                            key={e._id}
                            onClick={() => setSelectedItem(e)}
                            className={`p-4 rounded-xl hover:shadow-md cursor-pointer transition-all relative flex flex-col gap-2 border
                          ${isActive
                                ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-100 dark:bg-indigo-950/45'
                                : 'border-slate-200 dark:border-slate-800 bg-indigo-50 dark:bg-indigo-950/20 hover:bg-indigo-100/50 dark:hover:bg-indigo-950/30'}
                        `}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tracking-wider font-extrabold">Exchange Request</span>
                                <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400 font-mono">{e.oldBarcode} &rarr; {e.newBarcode || 'Store ID'}</span>
                              </div>
                              <Badge variant="warning">AWAITING STORE</Badge>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 font-sans">Exchange to {e.newDocumentType}</h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-300 font-semibold mt-0.5">Material: <span className="font-extrabold">{e.materialName}</span></p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-300 font-semibold">Requester: <span className="font-extrabold">{e.requester?.fullName}</span></p>
                            </div>
                            <div className="mt-2 pt-1.5 border-t border-dashed border-slate-100 dark:border-slate-800 text-[10px] font-bold flex justify-between items-center text-slate-500">
                              <span className="text-rose-600 dark:text-rose-400 font-extrabold">
                                {(activeRole.role === 'department_admin' && activeRole.adminType === 'store') || activeRole.role === 'super_admin' ? "Action Required: Approve Warranty" : "Tracking: Pending Store Acceptance"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}                {/* Transactions List */}
                {(statusTab === 'pending' || statusTab === 'history') && filteredTxns.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] text-slate-400 font-extrabold tracking-widest pl-1 mb-1 block">
                      {statusTab === 'history' ? 'Request History' : 'Material Requests'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredTxns.map(t => {
                        const isSelected = selectedIds.has(t._id);
                        const isActive = selectedItem?._id === t._id && !selectedItem.barcode;
                        return (
                          <div
                            key={t._id}
                            onClick={() => setSelectedItem(t)}
                            className={`p-4 rounded-xl hover:shadow-md cursor-pointer transition-all relative flex flex-col gap-2 border
                          ${isActive
                                ? 'border-blue-500 ring-1 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/10'
                                : 'border-blue-200 dark:border-blue-900/40 bg-blue-50/10 dark:bg-blue-950/5 hover:border-blue-300 dark:hover:border-blue-800'}
                        `}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 tracking-wider font-extrabold">
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
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1 leading-snug">{t.description || 'Material Logistics transaction'}</h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-300 font-medium mt-0.5">Sender: <span className="font-extrabold">{t.sender?.fullName || t.requester?.fullName}</span></p>
                            </div>

                            <div className="flex items-center justify-between text-[9px] text-slate-400 font-extrabold mt-1">
                              <span>{t.documentType} Challan</span>
                              <span className="text-slate-700 dark:text-slate-300 font-bold">
                                ₹{t.grandTotal?.toLocaleString() || '0'}
                              </span>
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
                {statusTab === 'pending' && filteredTransfers.length > 0 && (
                  <div className="flex flex-col gap-2 mt-4">
                    <span className="text-[10px] text-slate-400 font-extrabold tracking-widest pl-1 mb-1 block">Barcode Transfers</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredTransfers.map(tr => {
                        const isActive = selectedItem?._id === tr._id && !!selectedItem.barcode;
                        return (
                          <div
                            key={tr._id}
                            onClick={() => setSelectedItem(tr)}
                            className={`p-4 rounded-xl hover:shadow-md cursor-pointer transition-all relative flex flex-col gap-2 border
                          ${isActive
                                ? 'border-indigo-500 ring-1 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/10'
                                : 'border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/10 dark:bg-indigo-950/5 hover:border-indigo-300 dark:hover:border-indigo-800'}
                        `}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tracking-wider font-extrabold">Transfer Request</span>
                                <span className="text-xs font-extrabold text-indigo-655 dark:text-indigo-400 font-mono">{tr.barcode}</span>
                              </div>
                              <Badge variant="warning">TRANSFER</Badge>
                            </div>

                            <div>
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">Barcode Transfer Sourcing</h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-300 font-medium mt-0.5">Sender: <span className="font-extrabold">{tr.fromUser?.fullName}</span></p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-300 font-medium mt-0.5">Recipient: <span className="font-extrabold">{tr.toUser?.fullName}</span></p>
                            </div>

                            <div className="text-[9px] text-slate-400 font-extrabold mt-1">
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
                className="flex items-center gap-2 text-xs font-bold text-blue-650 dark:text-blue-700 transition animate-fade-in"
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
                    <h3 className="text-base font-extrabold text-slate-855 mt-1">
                      {selectedItem.items && selectedItem.items.length > 1 ? `Return of ${selectedItem.items.length} items` : `Return of ${selectedItem.barcode}`}
                    </h3>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/transactions/${selectedItem.transactionId}`)}>
                    Open full transaction view
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 text-xs font-semibold text-slate-600">
                  <div className="grid grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-955/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-0.5">FROM OWNER</span>
                      <span className="font-bold text-slate-855 dark:text-slate-150">{selectedItem.fromUser?.fullName}</span>
                      <span className="block text-[9px] text-slate-400 mt-0.5 font-bold">ID: {selectedItem.fromUser?.employeeId}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-0.5">ITEM CONDITION</span>
                      <span className="font-bold text-amber-700 font-mono">
                        {selectedItem.items && selectedItem.items.length > 1 ? [...new Set(selectedItem.items.map(it => it.condition))].join(', ') : selectedItem.condition}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-0.5">EXPECTED RETURN</span>
                      <span className="font-bold text-slate-805 dark:text-slate-150 font-mono">
                        {txnExpectedReturnDates[selectedItem.transactionId]
                          ? new Date(txnExpectedReturnDates[selectedItem.transactionId]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {selectedItem.items && selectedItem.items.length > 1 && (
                    <div className="bg-slate-50 dark:bg-slate-95/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                      <span className="text-[9px] text-slate-400 font-bold block mb-1">Returned Items ({selectedItem.items.length})</span>
                      <div className="flex flex-col gap-1.5">
                        {selectedItem.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-750 dark:text-slate-205 border-b border-slate-100 dark:border-slate-800 pb-1.5 last:border-b-0 last:pb-0 font-mono">
                            <span className="text-blue-650">{it.barcode}</span>
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">{it.condition}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedItem.returnHandler && (
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block mb-0.5">ASSIGNED RETURN HANDLER</span>
                        <span className="font-bold text-slate-855 dark:text-slate-150">{selectedItem.returnHandler?.fullName}</span>
                        <span className="block text-[9px] text-slate-400 mt-0.5 font-bold">ID: {selectedItem.returnHandler?.employeeId}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block mb-0.5">DELIVERY METHOD</span>
                        <span className="font-bold text-blue-650 font-mono">Via Courier Handler</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-[10px] text-slate-400 font-extrabold mb-1.5">Reason for Return</h4>
                    <div className="p-3.5 bg-slate-50/50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-350 font-bold italic">
                      "{selectedItem.reason || 'No reason provided.'}"
                    </div>
                  </div>

                  {selectedItem.remarks && (
                    <div>
                      <h4 className="text-[10px] text-slate-400 font-extrabold mb-1.5">Remarks</h4>
                      <div className="p-3.5 bg-slate-50/50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-350 font-bold">
                        {selectedItem.remarks}
                      </div>
                    </div>
                  )}

                  {selectedItem.photos && selectedItem.photos.length > 0 && (
                    <div>
                      <h4 className="text-[10px] text-slate-400 font-extrabold mb-1.5">Captured Photo</h4>
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
                        <label className="block text-[10px] font-bold text-slate-500 tracking-wider mb-2">Decision Comments / Remarks</label>
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
                      {selectedItem.status === 'handler_assigned' && (
                        activeRole.role === 'super_admin' ||
                        activeRole.role === 'team_lead' ||
                        activeRole.role === 'employee' ||
                        selectedItem.returnHandler?._id === user?._id ||
                        selectedItem.returnHandler === user?._id
                      ) && (
                          <>
                            <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => handleReturnHandlerAction('reject')} disabled={submitting}>
                              Reject Assignment
                            </Button>
                            <Button variant="success" onClick={() => handleReturnHandlerAction('collect')} disabled={submitting}>
                              Accept (Collect from Requester)
                            </Button>
                          </>
                        )}

                      {/* Handler Deliver & Change Handler Buttons */}
                      {selectedItem.status === 'collected' && (
                        activeRole.role === 'super_admin' ||
                        activeRole.role === 'team_lead' ||
                        activeRole.role === 'employee' ||
                        selectedItem.returnHandler?._id === user?._id ||
                        selectedItem.returnHandler === user?._id
                      ) && (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setStoreActionType('assign_return_handler');
                                setStoreModal(true);
                              }}
                              disabled={submitting}
                            >
                              Change Handler
                            </Button>
                            <Button variant="success" onClick={() => handleReturnHandlerAction('deliver')} disabled={submitting}>
                              Deliver to Store
                            </Button>
                          </>
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
                  <div className="grid grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-0.5">PARENT BARCODE</span>
                      <span className="font-bold text-blue-600 font-mono text-sm">{selectedItem.barcode}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-0.5">REQUESTED BY</span>
                      <span className="font-bold text-slate-800 dark:text-slate-150">{selectedItem.requester?.fullName}</span>
                      <span className="block text-[9px] text-slate-400 mt-0.5 font-bold">ID: {selectedItem.requester?.employeeId}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-0.5">EXPECTED RETURN</span>
                      <span className="font-bold text-slate-800 dark:text-slate-150 font-mono text-xs">
                        {txnExpectedReturnDates[selectedItem.transactionId]
                          ? new Date(txnExpectedReturnDates[selectedItem.transactionId]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] text-slate-400 font-extrabold mb-1.5">Reason for Split</h4>
                    <div className="p-3.5 bg-slate-50/50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-350 font-bold italic">
                      "{selectedItem.reason}"
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white tracking-wider">Register New Material & Tally Stock Journal Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">New Barcode ID *</label>
                        <input
                          type="text"
                          value={approveNewBarcode}
                          onChange={(e) => setApproveNewBarcode(e.target.value)}
                          placeholder="e.g. DG300002"
                          className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2 font-semibold font-mono"
                        />
                      </div>
                      <div>
                        <TallyMaterialAutocomplete
                          value={approveMaterialName}
                          onChange={(name, unit, price) => {
                            setApproveMaterialName(name);
                            if (unit) setApproveUnit(unit);
                            if (price !== undefined) setApproveRate(price);
                          }}
                          placeholder="Select Tally Stock Item..."
                          label="Material Name"
                          required
                          className="w-full text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Tally Godown Name *</label>
                        <input
                          type="text"
                          value={approveGodown}
                          onChange={(e) => setApproveGodown(e.target.value)}
                          placeholder="e.g. Ravi Sharma"
                          required
                          className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Qty *</label>
                          <input
                            type="number"
                            min="1"
                            value={approveQuantity}
                            onChange={(e) => setApproveQuantity(Number(e.target.value))}
                            required
                            className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-2 py-2.5 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Unit *</label>
                          <input
                            type="text"
                            value={approveUnit}
                            onChange={(e) => setApproveUnit(e.target.value)}
                            placeholder="pcs"
                            required
                            className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-2 py-2.5 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Rate (₹) *</label>
                          <input
                            type="number"
                            min="0"
                            value={approveRate}
                            onChange={(e) => setApproveRate(Number(e.target.value))}
                            required
                            className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-2 py-2.5 font-semibold"
                          />
                        </div>
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
            ) : (selectedItem.documentType && !selectedItem.materials) ? (() => {
              const isInvoice = selectedItem.documentType === 'Invoice';
              const canApprove = (() => {
                if (activeRole.role === 'super_admin') return true;
                if (selectedItem.status === 'pending_store_acceptance') {
                  return activeRole.role === 'department_admin' && activeRole.adminType === 'store';
                }
                if (isInvoice) {
                  if (selectedItem.status === 'pending') {
                    return activeRole.role === 'department_admin' && activeRole.adminType === 'management' &&
                      (selectedItem.managementApprover?._id || selectedItem.managementApprover || '').toString() === user?._id?.toString();
                  }
                  if (selectedItem.status === 'pending_accounts_approval') {
                    return activeRole.role === 'department_admin' && activeRole.adminType === 'accounts';
                  }
                  return false;
                }
                if (selectedItem.documentType === 'DC Internal') {
                  return activeRole.role === 'team_lead';
                }
                if (selectedItem.documentType === 'DC FOC') {
                  return activeRole.role === 'department_admin' && activeRole.adminType === 'management' &&
                    (selectedItem.managementApprover?._id || selectedItem.managementApprover || '').toString() === user?._id?.toString();
                }
                return false;
              })();

              const getBadgeLabel = () => {
                if (selectedItem.status === 'pending_store_acceptance') return 'PENDING STORE ACCEPTANCE';
                if (isInvoice) {
                  if (selectedItem.status === 'pending') return 'PENDING MANAGEMENT APPROVAL';
                  if (selectedItem.status === 'pending_accounts_approval') return 'PENDING ACCOUNTS UPLOAD';
                }
                if (selectedItem.documentType === 'DC FOC') return 'PENDING MANAGEMENT APPROVAL';
                return 'PENDING TL APPROVAL';
              };

              const getHelperText = () => {
                if (selectedItem.status === 'pending_store_acceptance') return 'Only Store Admins can accept this request.';
                if (isInvoice) {
                  if (selectedItem.status === 'pending') return 'Only the selected Management Approver can approve this request.';
                  if (selectedItem.status === 'pending_accounts_approval') return 'Only Accounts Admin can upload invoice and close.';
                }
                if (selectedItem.documentType === 'DC FOC') return 'Only the selected Management Approver can approve this request.';
                return 'Only Team Leads can approve this request.';
              };

              const showRejectButton = selectedItem.status !== 'pending_store_acceptance';
              const approveButtonText = selectedItem.status === 'pending_store_acceptance'
                ? 'Accept & Close Barcode'
                : (isInvoice
                  ? (selectedItem.status === 'pending_accounts_approval' ? 'Upload Invoice & Close' : 'Approve Request')
                  : 'Approve Request');

              return (
                /* CLOSE REQUEST PREVIEW */
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">
                          {isInvoice ? 'Invoice Conversion Request' : 'DC Conversion Request'}
                        </span>
                        <Badge variant="warning">
                          {getBadgeLabel()}
                        </Badge>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200 mt-1">Barcode: {selectedItem.barcode}</h3>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block mb-0.5">TARGET DOCUMENT TYPE</span>
                        <span className="font-bold text-blue-600 dark:text-blue-455">{selectedItem.documentType}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block mb-0.5">NEW DOCUMENT NUMBER</span>
                        <span className="font-bold text-slate-800 dark:text-slate-150">{selectedItem.documentNumber}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block mb-0.5">REQUESTER</span>
                        <span className="font-bold text-slate-800 dark:text-slate-150">{selectedItem.requester?.fullName}</span>
                        <span className="block text-[9px] text-slate-400 mt-0.5 font-bold">ID: {selectedItem.requester?.employeeId}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block mb-0.5">EXPECTED RETURN</span>
                        <span className="font-bold text-slate-800 dark:text-slate-150 font-mono text-xs">
                          {txnExpectedReturnDates[selectedItem.transactionId]
                            ? new Date(txnExpectedReturnDates[selectedItem.transactionId]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {selectedItem.remarks && (
                      <div>
                        <h4 className="text-[10px] text-slate-400 font-extrabold mb-1.5">Remarks / Reason</h4>
                        <div className="p-3.5 bg-slate-50/50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-350 font-bold italic">
                          "{selectedItem.remarks}"
                        </div>
                      </div>
                    )}

                    {actionError && <p className="text-xs text-rose-500 font-bold">{actionError}</p>}

                    {canApprove ? (
                      <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex gap-3 justify-end shrink-0">
                        {showRejectButton && (
                          <Button
                            variant="outline"
                            className="text-rose-600 border-rose-200 hover:bg-rose-50"
                            onClick={() => handleCloseRequestAction('reject', selectedItem._id)}
                            disabled={submitting}
                          >
                            Reject Request
                          </Button>
                        )}
                        <Button
                          variant="success"
                          onClick={() => handleCloseRequestAction('approve', selectedItem._id)}
                          disabled={submitting}
                        >
                          {approveButtonText}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic text-center mt-auto pt-5 border-t">
                        {getHelperText()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()
              : selectedItem.oldBarcode ? (() => {
                const canApprove = activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'store');
                return (
                  /* EXCHANGE REQUEST PREVIEW */
                  <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-150">
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">Barcode Exchange Request</span>
                          <Badge variant="warning">PENDING WARRANTY</Badge>
                        </div>
                        <h3 className="text-base font-extrabold text-slate-855 mt-1">Exchange: {selectedItem.oldBarcode} &rarr; {selectedItem.newBarcode || 'Pending Store ID'}</h3>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 text-xs font-semibold text-slate-600">
                      <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-955/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold block mb-0.5">OLD BARCODE</span>
                          <span className="font-bold text-rose-600">{selectedItem.oldBarcode}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold block mb-0.5">NEW BARCODE</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 italic">{selectedItem.newBarcode || 'Pending Assignment'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 bg-slate-50 dark:bg-slate-955/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold block mb-0.5">MATERIAL NAME</span>
                          <span className="font-bold text-slate-800 dark:text-slate-150">{selectedItem.materialName}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 bg-slate-50 dark:bg-slate-955/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold block mb-0.5">REQUESTER</span>
                          <span className="font-bold text-slate-800 dark:text-slate-150">{selectedItem.requester?.fullName}</span>
                          <span className="block text-[9px] text-slate-400 mt-0.5 font-bold">ID: {selectedItem.requester?.employeeId}</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[10px] text-slate-400 font-extrabold mb-1.5">Warranty Form / Failure Reason</h4>
                        <div className="p-3.5 bg-slate-50/50 border border-slate-100 dark:bg-slate-955 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-350 font-bold italic font-sans">
                          "{selectedItem.warrantyReason}"
                        </div>
                      </div>

                      {canApprove && (
                        <div className="bg-slate-50 dark:bg-slate-955 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 tracking-wider mb-1">Assign New Barcode ID *</label>
                            <input
                              type="text"
                              value={exchangeNewBarcode}
                              onChange={(e) => setExchangeNewBarcode(e.target.value)}
                              required
                              placeholder="e.g. DG300005"
                              className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 font-semibold focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                      {actionError && <p className="text-xs text-rose-500 font-bold">{actionError}</p>}

                      {canApprove ? (
                        <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex gap-3 justify-end shrink-0">
                          <Button
                            variant="outline"
                            className="text-rose-600 border-rose-200 hover:bg-rose-50"
                            onClick={handleRejectExchangeRequest}
                            disabled={submitting}
                          >
                            Reject Exchange
                          </Button>
                          <Button
                            variant="success"
                            onClick={handleAcceptExchangeRequest}
                            disabled={submitting}
                          >
                            Complete Barcode Exchange
                          </Button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic text-center mt-auto pt-5 border-t">
                          Only Store Admin can process barcode exchange requests.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()
                : selectedItem.barcode ? (
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
                          <span className="block text-[9px] text-slate-400 mt-0.5 font-bold">{selectedItem.fromDepartment?.name}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold block mb-0.5">TO RECIPIENT</span>
                          <span className="font-bold text-slate-800 dark:text-slate-150">{selectedItem.toUser?.fullName}</span>
                          <span className="block text-[9px] text-slate-400 mt-0.5 font-bold">{selectedItem.toDepartment?.name}</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[10px] text-slate-400 font-extrabold mb-1.5">Remarks / Reason</h4>
                        <div className="p-3.5 bg-slate-50/50 border border-slate-100 dark:bg-slate-950 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 font-bold">
                          {selectedItem.remarks || 'No remarks provided.'}
                        </div>
                      </div>

                      <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col gap-4">
                        {selectedItem.barcode && (
                          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                            <label className="block text-xs font-bold text-slate-500 tracking-wider">Transfer Verification Photo *</label>
                            <div className="flex items-center gap-3">
                              <img src={transferPhoto} alt="Verification" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                              <div className="flex flex-col gap-1.5">
                                <label className="inline-flex items-center justify-center px-4 py-2 border border-slate-350 text-slate-700 dark:text-slate-200 font-bold rounded-lg cursor-pointer text-xs hover:bg-slate-100 dark:hover:bg-slate-800">
                                  Upload Actual Photo
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleTransferPhotoUpload}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-bold text-slate-500 tracking-wider mb-2">Remarks on action</label>
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
                        <h3 className="text-base font-extrabold text-slate-800 dark:text-white mt-1">{selectedItem.description || 'Material Logistics transaction'}</h3>
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
                          <span className="text-[10px] text-slate-400 font-bold tracking-wider block mb-0.5">SENDER</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{selectedItem.sender?.fullName || selectedItem.requester?.fullName}</span>
                          <span className="block text-slate-400 text-[10px]">{selectedItem.sender?.department?.name || selectedItem.department?.name || 'Engineering'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold tracking-wider block mb-0.5">EXPECTED RETURN</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {selectedItem.expectedReturnDate ? new Date(selectedItem.expectedReturnDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : (selectedItem.dueDate ? new Date(selectedItem.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold tracking-wider block mb-0.5">GRAND TOTAL</span>
                          <span className="font-extrabold text-blue-650 dark:text-blue-400">
                            {showPricing ? `₹${selectedItem.grandTotal?.toLocaleString() || '0'}` : 'Awaiting Dispatch'}
                          </span>
                        </div>
                      </div>

                      {selectedItem.remarks && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800 rounded-xl space-y-1.5 text-xs">
                          <span className="text-[10px] text-slate-400 font-extrabold tracking-wider block mb-0.5">Store Dispatch Remarks / Purpose</span>
                          <p className="font-semibold text-slate-700 dark:text-slate-350 italic">
                            "{selectedItem.remarks}"
                          </p>
                        </div>
                      )}

                      {/* Materials Table */}
                      <div>
                        <h4 className="text-xs font-bold tracking-wider text-slate-500 mb-3">Item Breakdown & Barcode Maps</h4>
                        <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 dark:bg-slate-950/40 text-slate-550 font-bold">
                              <tr>
                                <th className="px-4 py-2">Material</th>
                                <th className="px-4 py-2">Quantity</th>
                                {showPricing && <th className="px-4 py-2 text-right">Unit Price</th>}
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
                                  {showPricing && <td className="px-4 py-2.5 text-right font-bold text-slate-800 dark:text-slate-200">₹{mat.price?.toLocaleString() || '0'}</td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Approval Comments Form (only if status is pending) */}
                      {statusTab === 'pending' && activeRole.role !== 'employee' && !isHandler && selectedItem.requester?._id !== user?._id && selectedItem.requester !== user?._id && ['submitted', 'tl_approved', 'mgt_approved', 'ready_for_dispatch', 'store_accepted'].includes(selectedItem.status) && (
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
                                    Accept & Dispatch Request
                                  </Button>
                                ) : (
                                  <>
                                    {['submitted', 'tl_approved', 'mgt_approved', 'ready_for_dispatch'].includes(selectedItem.status) &&
                                      !['store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed', 'active', 'closed'].includes(selectedItem.status) && (
                                        <Button
                                          variant="success"
                                          onClick={async () => {
                                            if (confirm('Are you sure you want to mark this transaction as Sourced (Ready to dispatch)?')) {
                                              setSubmitting(true);
                                              try {
                                                await api.put(`/transactions/${selectedItem._id}/store-accept`, {
                                                  remarks: 'Accepted by store'
                                                });
                                                alert('Transaction accepted by store successfully.');
                                                setSelectedItem(null);
                                                fetchApprovals();
                                              } catch (err) {
                                                alert(err.response?.data?.message || 'Store action failed.');
                                              } finally {
                                                setSubmitting(false);
                                              }
                                            }
                                          }}
                                          disabled={submitting}
                                        >
                                          Ready (Store Accept)
                                        </Button>
                                      )}
                                    {['store_accepted', 'handler_assigned'].includes(selectedItem.status) &&
                                      !['dispatched', 'received', 'completed', 'active', 'closed'].includes(selectedItem.status) && (
                                        <>
                                          {selectedItem.status === 'store_accepted' && (
                                            <Button variant="outline" onClick={handleDirectDispatch} disabled={submitting}>
                                              Direct Dispatch (Bypass Handler)
                                            </Button>
                                          )}
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
                                <label className="block text-xs font-bold text-slate-500 tracking-wider mb-2">Decision Comments / Remarks</label>
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
                                      navigate(`/store-dispatch/${selectedItem.transactionId}`);
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

                      {/* Pending Handler Transfer Panel (Handler-1 / Handler-2 views) */}
                      {selectedItem.pendingHandlerTransfer?.status === 'pending' && (
                        (selectedItem.handler?._id === user?._id || selectedItem.handler === user?._id) ||
                        (selectedItem.pendingHandlerTransfer?.toHandler?._id === user?._id || selectedItem.pendingHandlerTransfer?.toHandler === user?._id)
                      ) && (
                          <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col gap-4">
                            <h4 className="text-xs font-bold tracking-wider text-slate-500">Handler Transfer Pending</h4>
                            {actionError && <p className="text-xs text-rose-500 font-bold">{actionError}</p>}
                            <div className="flex gap-3 justify-end items-center">
                              {/* Handler-1 view (waiting/cancel) */}
                              {(selectedItem.handler?._id === user?._id || selectedItem.handler === user?._id) && (
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-slate-500 font-bold">Waiting for Handler Acceptance ({selectedItem.pendingHandlerTransfer?.toHandler?.fullName || 'New Handler'})</span>
                                  <Button
                                    variant="outline"
                                    className="text-rose-600 border-rose-250 hover:bg-rose-50"
                                    onClick={() => handleCancelTransfer(selectedItem._id)}
                                    disabled={submitting}
                                  >
                                    Cancel Request
                                  </Button>
                                </div>
                              )}
                              {/* Handler-2 view (accept/reject) */}
                              {(selectedItem.pendingHandlerTransfer?.toHandler?._id === user?._id || selectedItem.pendingHandlerTransfer?.toHandler === user?._id) && (
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-slate-500 font-bold">Assignment Request (From {selectedItem.pendingHandlerTransfer?.fromHandler?.fullName || 'Previous Handler'})</span>
                                  <Button
                                    variant="outline"
                                    className="text-rose-600 border-rose-250 hover:bg-rose-50"
                                    onClick={() => handleRejectTransfer(selectedItem._id)}
                                    disabled={submitting}
                                  >
                                    Reject
                                  </Button>
                                  <Button
                                    variant="success"
                                    onClick={() => handleAcceptTransfer(selectedItem._id)}
                                    disabled={submitting}
                                  >
                                    Accept
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      {/* Handler Actions Panel */}
                      {(!selectedItem.pendingHandlerTransfer || selectedItem.pendingHandlerTransfer.status !== 'pending') && (activeRole.role === 'super_admin' || selectedItem.handler?._id === user?._id || selectedItem.handler === user?._id) && ['store_accepted', 'handler_assigned'].includes(selectedItem.status) && (
                        <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col gap-4">
                          <h4 className="text-xs font-bold tracking-wider text-slate-500">Handler Sourcing Actions</h4>
                          {actionError && <p className="text-xs text-rose-500 font-bold">{actionError}</p>}
                          <div className="flex gap-3 justify-end">
                            <div className="flex gap-3">
                              {(() => {
                                const hasAccepted = (() => {
                                  const timeline = selectedItem.timeline || [];
                                  const assignments = timeline.filter(t => t.action === 'Handler Assigned' || t.action?.toLowerCase()?.includes('handler assigned'));
                                  if (assignments.length === 0) {
                                    return timeline.some(t => t.action === 'Handler Accepted' || t.action === 'Handler Transfer Accepted' || t.action?.toLowerCase()?.includes('handler accepted') || t.action?.toLowerCase()?.includes('handler transfer accepted'));
                                  }
                                  const sortedAssignments = [...assignments].sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));
                                  const lastAssignmentTime = new Date(sortedAssignments[0].timestamp || sortedAssignments[0].createdAt);
                                  const acceptances = timeline.filter(t => t.action === 'Handler Accepted' || t.action === 'Handler Transfer Accepted' || t.action?.toLowerCase()?.includes('handler accepted') || t.action?.toLowerCase()?.includes('handler transfer accepted'));
                                  return acceptances.some(t => new Date(t.timestamp || t.createdAt) >= lastAssignmentTime);
                                })();
                                if (selectedItem.status === 'store_accepted' || !hasAccepted) {
                                  return (
                                    <>
                                      <Button
                                        variant="outline"
                                        className="text-rose-600 border-rose-250 hover:bg-rose-50"
                                        onClick={() => handleHandlerReject(selectedItem._id)}
                                        disabled={submitting}
                                      >
                                        Reject Job
                                      </Button>
                                      <Button
                                        variant="success"
                                        onClick={() => handleCollectFromStore(selectedItem._id)}
                                        disabled={submitting}
                                      >
                                        Accept Delivery Job
                                      </Button>
                                    </>
                                  );
                                } else {
                                  return (
                                    <Button
                                      variant="success"
                                      onClick={() => navigate(`/transactions/${selectedItem._id}`)}
                                      disabled={submitting}
                                    >
                                      Go to Delivery Details Page
                                    </Button>
                                  );
                                }
                              })()}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Handler Actions Panel (After Requester Rejection) */}
                      {(!selectedItem.pendingHandlerTransfer || selectedItem.pendingHandlerTransfer.status !== 'pending') && (activeRole.role === 'super_admin' || selectedItem.handler?._id === user?._id || selectedItem.handler === user?._id) && selectedItem.status === 'dispatched' && selectedItem.rejectedDeliveryStatus === 'rejected_by_requester' && (
                        <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col gap-4">
                          <h4 className="text-xs font-bold tracking-wider text-slate-500">Handler Sourcing Actions (Rejected Delivery)</h4>
                          {actionError && <p className="text-xs text-rose-500 font-bold">{actionError}</p>}
                          <div className="flex gap-3 justify-end">
                            <div className="flex gap-3">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setStoreActionType('assign_handler');
                                  setStoreModal(true);
                                }}
                                disabled={submitting}
                              >
                                Change Handler
                              </Button>
                              <Button
                                variant="success"
                                onClick={async () => {
                                  if (confirm('Are you sure you want to send the rejected materials back to the store?')) {
                                    setSubmitting(true);
                                    try {
                                      await api.patch(`/transactions/${selectedItem._id}/handler-action`, {
                                        actionType: 'send_to_store',
                                        remarks: 'Handler returned rejected materials to store.'
                                      });
                                      alert('Materials sent to store.');
                                      setSelectedItem(null);
                                      fetchApprovals();
                                    } catch (err) {
                                      alert(err.response?.data?.message || 'Action failed.');
                                    } finally {
                                      setSubmitting(false);
                                    }
                                  }
                                }}
                                disabled={submitting}
                              >
                                Send to Store
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Store Admin Action Panel (Accept Returned Materials from Handler) */}
                      {selectedItem.status === 'dispatched' && selectedItem.rejectedDeliveryStatus === 'sent_to_store' && (activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'store')) && (
                        <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col gap-4">
                          <h4 className="text-xs font-bold tracking-wider text-slate-500">Store Admin Actions</h4>
                          {actionError && <p className="text-xs text-rose-500 font-bold">{actionError}</p>}
                          <div className="flex gap-3 justify-end">
                            <div className="flex gap-3">
                              <Button
                                variant="success"
                                onClick={async () => {
                                  if (confirm('Accept the returned materials from the handler? This will mark the transaction as rejected.')) {
                                    setSubmitting(true);
                                    try {
                                      await api.patch(`/transactions/${selectedItem._id}/store-action`, {
                                        actionType: 'accept_rejected_return',
                                        remarks: 'Store accepted returned materials from handler.'
                                      });
                                      alert('Returned materials accepted by store. Transaction marked as rejected.');
                                      setSelectedItem(null);
                                      fetchApprovals();
                                    } catch (err) {
                                      alert(err.response?.data?.message || 'Action failed.');
                                    } finally {
                                      setSubmitting(false);
                                    }
                                  }
                                }}
                                disabled={submitting}
                              >
                                Accept Returned Materials
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Requester Actions Panel */}
                      {(activeRole.role === 'super_admin' || selectedItem.requester?._id === user?._id || selectedItem.requester === user?._id) && selectedItem.status === 'dispatched' && !selectedItem.requesterRejected && !selectedItem.rejectedDeliveryStatus && (
                        <div className="mt-auto border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col gap-4">
                          <h4 className="text-xs font-bold tracking-wider text-slate-500">Requester Sourcing Actions</h4>
                          {actionError && <p className="text-xs text-rose-500 font-bold">{actionError}</p>}
                          <div className="flex gap-3 justify-end">
                            <div className="flex gap-3">
                              {!selectedItem.handler && (
                                <Button
                                  variant="outline"
                                  className="text-rose-600 border-rose-250 hover:bg-rose-50"
                                  onClick={() => handleRequesterRejectReceipt(selectedItem._id)}
                                  disabled={submitting}
                                >
                                  Reject Material Receipt
                                </Button>
                              )}
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
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {storeActionType === 'assign_return_handler' ? 'Assign Return Handler' : 'Store dispatch / Sourcing Manager'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {storeActionType === 'assign_return_handler' ? 'Assign a return handler for the materials.' : 'Assign handler or complete DC sourcing check.'}
            </p>

            <form onSubmit={handleStoreActionSubmit} className="mt-4 flex flex-col gap-4 text-xs font-semibold text-slate-650 dark:text-slate-400">
              <div>
                <label className="block text-slate-500 font-bold tracking-wider mb-1.5">Select Handler *</label>
                <select
                  value={handlerId}
                  onChange={(e) => setHandlerId(e.target.value)}
                  required
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                >
                  <option value="">Select Handler employee</option>
                  {handlers.map(h => (
                    <option key={h.value} value={h.value}>{h.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold tracking-wider mb-1.5">Remarks / Sourcing notes</label>
                <textarea
                  value={storeRemarks}
                  onChange={(e) => setStoreRemarks(e.target.value)}
                  placeholder="e.g. Sourced from Shelf Bay 4..."
                  rows="2"
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3.5 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
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
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
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
      {/* Physical Receiving Form Modal */}
      {receiveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Verify Materials Receipt
                </h3>
                <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-0.5 font-sans">Physical check & Geo-Tag confirmation</p>
              </div>
              <button onClick={() => setReceiveModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReceiveSubmit} className="mt-4 flex flex-col gap-4 text-xs font-semibold text-slate-650 dark:text-slate-400">
              {selectedItem?.remarks && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-xl space-y-1">
                  <span className="block text-[9px] text-slate-400 font-bold tracking-wider">Store Dispatch Remarks / Purpose</span>
                  <p className="text-xs text-slate-700 dark:text-slate-350 font-medium italic font-semibold">"{selectedItem.remarks}"</p>
                </div>
              )}
              <div>
                <label className="block text-slate-500 font-bold tracking-wider mb-1.5">Material Condition *</label>
                <select
                  value={receiveCondition}
                  onChange={(e) => setReceiveCondition(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                >
                  <option value="Good">Good condition</option>
                  <option value="Minor Damage">Minor packaging damage</option>
                  <option value="Damaged">Damaged / Reject receipt</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold tracking-wider mb-1.5">Remarks / Discrepancy checks</label>
                <textarea
                  value={receiveRemarks}
                  onChange={(e) => setReceiveRemarks(e.target.value)}
                  placeholder="Tallied all items against challan details..."
                  rows="2"
                  className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3.5 py-2 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>

              {/* Camera Photo capture */}
              <div>
                <label className="block text-slate-500 font-bold tracking-wider mb-1.5">Geo-Tagged Receipt Photo *</label>
                {receivePhoto ? (
                  <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 h-36">
                    <img src={receivePhoto} alt="Challan check" className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 bg-slate-950/80 p-2 text-[9px] text-white flex flex-col leading-tight">
                      <span className="font-extrabold">Coordinates: {receiveCoords.lat}, {receiveCoords.lng}</span>
                      <span className="truncate">{receiveCoords.address}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReceivePhoto('')}
                      className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-white rounded-lg hover:bg-slate-900 text-[10px] font-bold"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <label
                    className="w-full h-32 border-2 border-dashed border-slate-200 dark:border-slate-800 dark:hover:border-blue-500 hover:border-blue-500 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-slate-50/50 cursor-pointer text-slate-500 font-bold"
                  >
                    {capturingPhoto ? (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                        <span className="text-[10px] font-bold tracking-wider">Uploading verification picture...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-6 h-6 text-slate-400" />
                        <span className="text-[10px] font-bold tracking-wider">Upload/Take Verification Picture</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={capturingPhoto}
                      className="hidden"
                    />
                  </label>
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
    </div>
  );
};

export default PendingTransactionsPage;
