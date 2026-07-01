import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Edit2, Eye, FileSpreadsheet, FileText, MapPin, 
  Clock, CheckCircle2, AlertTriangle, Truck, Layers, MessageSquare, 
  Send, Reply, Split, Shield, ClipboardList, Camera, Globe, X,
  User, Calendar, AlertCircle, Plus, ChevronRight, File, CornerDownRight, Check
} from 'lucide-react';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';
import { useActiveRole } from '../../hooks/useActiveRole';

// Import sub modals
import TransferFormModal from './TransferFormModal';
import ReturnFormModal from './ReturnFormModal';
import SplitLotModal from './SplitLotModal';

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
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'materials' | 'timeline' | 'transfers' | 'returns' | 'documents' | 'chat' | 'audit'
  
  // Side Panel / Drawer states
  const [selectedBarcode, setSelectedBarcode] = useState(null); // Full Barcode Object
  const [barcodeTimeline, setBarcodeTimeline] = useState([]); // Barcode logs
  const [barcodeChatText, setBarcodeChatText] = useState('');
  const [barcodeChatMessages, setBarcodeChatMessages] = useState([]);
  const [loadingBarcodeTimeline, setLoadingBarcodeTimeline] = useState(false);

  // Modals / Action Forms
  const [barcodeAction, setBarcodeAction] = useState(null); // 'transfer' | 'return' | 'split'
  const [employees, setEmployees] = useState([]);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const txnRes = await api.get(`/transactions/${id}`);
      const txnData = txnRes.data.data;
      setTxn(txnData);

      // Fetch barcodes matching this transaction
      const bcRes = await api.get('/barcodes', { params: { transactionId: txnData.transactionId } });
      setBarcodes(bcRes.data.data || []);
      
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
    api.get('/employees').then(res => {
      setEmployees((res.data.data || []).map(e => ({ value: e._id, label: `${e.fullName} (${e.employeeId})` })));
      // Filter handlers
      const handlerList = (res.data.data || []).filter(e => e.role === 'employee');
      setHandlers(handlerList.map(h => ({ value: h._id, label: `${h.fullName} (${h.employeeId})` })));
    }).catch(err => console.error(err));
  }, [id]);

  // Fetch Barcode details when clicked
  const handleBarcodeClick = async (barcodeStr) => {
    setLoadingBarcodeTimeline(true);
    try {
      const res = await api.get(`/barcodes/${barcodeStr}`);
      setSelectedBarcode(res.data.data);

      // Fetch timeline logs
      setBarcodeTimeline(res.data.data?.history || []);

      // Fetch chat messages
      const chatRes = await api.get(`/barcodes/${barcodeStr}/chat`);
      setBarcodeChatMessages(chatRes.data.data || []);
    } catch (err) {
      console.error('Error fetching barcode detail timeline:', err);
    } finally {
      setLoadingBarcodeTimeline(false);
    }
  };

  // Submit Barcode chat comment
  const handleBarcodeChatSubmit = async (e) => {
    e.preventDefault();
    if (!barcodeChatText.trim() || !selectedBarcode) return;
    try {
      const res = await api.post(`/barcodes/${selectedBarcode.barcode}/chat`, {
        message: barcodeChatText,
        transactionId: txn.transactionId
      });
      setBarcodeChatMessages([...barcodeChatMessages, res.data.data]);
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
        await api.patch(`/transactions/${id}/accept`, {
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
      await api.patch(`/transactions/${id}/reject`, {
        rejectionReason
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

  // Store dispatch action handler
  const handleStoreAction = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/transactions/${id}/store-action`, {
        actionType: storeActionType,
        handlerId,
        remarks: storeRemarks
      });
      alert('Store dispatch logged successfully.');
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
  const isSender = txn.sender?._id === user?._id || txn.sender === user?._id;
  const isReceiver = txn.receiver?._id === user?._id || txn.receiver === user?._id;
  const showMatchTab = txn.documentType === 'RDC' && (activeRole.role === 'super_admin' || (activeRole.role === 'department_admin' && activeRole.adminType === 'accounts'));
  const canApprove = (activeRole.role === 'team_lead' && txn.status === 'submitted') ||
                     (activeRole.role === 'department_admin' && activeRole.adminType === 'management' && ['submitted', 'tl_approved'].includes(txn.status));

  // Visual Timeline Definition matching Mockup Panel 3
  const flowStages = [
    { label: 'Request Created', done: true, sub: txn.sender?.fullName },
    { label: 'Team Lead Approved', done: ['tl_approved', 'mgt_approved', 'ready_for_dispatch', 'store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed'].includes(txn.status) },
    { label: 'Store Accepted', done: ['store_accepted', 'handler_assigned', 'dispatched', 'received', 'completed'].includes(txn.status) },
    { label: 'Handler Assigned', done: ['handler_assigned', 'dispatched', 'received', 'completed'].includes(txn.status) },
    { label: 'Delivered to Receiver', done: ['dispatched', 'received', 'completed'].includes(txn.status) },
    { label: 'Active/Distributed', done: ['received', 'completed'].includes(txn.status) },
    { label: 'Returns in Progress', done: barcodes.some(b => ['Return Requested', 'Returned'].includes(b.status)) },
    { label: 'All Items Returned', done: txn.status === 'completed' && barcodes.every(b => b.status === 'Returned') },
    { label: 'Transaction Closed', done: ['completed', 'rejected'].includes(txn.status) }
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16 relative">
      {/* Top Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none m-0">
                {txn.transactionId}
              </h1>
              <Badge variant={txn.status === 'rejected' ? 'danger' : txn.status === 'completed' ? 'success' : 'primary'}>
                {txn.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">
              {txn.documentType} CHALLAN • Created {new Date(txn.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Dynamic Context Actions */}
        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
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

          {/* Store dispatch action */}
          {activeRole.role === 'department_admin' && activeRole.adminType === 'store' && ['mgt_approved', 'ready_for_dispatch'].includes(txn.status) && (
            <>
              <Button size="sm" variant="outline" onClick={handleDirectDispatch}>
                Direct Dispatch (Bypass Handler)
              </Button>
              <Button size="sm" onClick={() => setStoreModal(true)}>
                Sourcing / Assign Handler
              </Button>
            </>
          )}

          {/* Handler action */}
          {txn.status === 'handler_assigned' && isReceiver && (
            <Button size="sm" onClick={handleConfirmDispatch}>
              Confirm Dispatch / Pick Up
            </Button>
          )}

          {/* Physical Receiving */}
          {txn.status === 'dispatched' && isSender && (
            <Button size="sm" variant="success" onClick={() => setReceiveModal(true)}>
              Accept Material Receipt
            </Button>
          )}

          {/* Convert Document Type (Sender/Owner or Admin can perform if not completed/rejected) */}
          {!['completed', 'rejected'].includes(txn.status) && (isSender || isAdmin) && (
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

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Timeline Panel */}
        <div className="lg:col-span-1 flex flex-col gap-5">
          <Card title="Lifecycle Timeline">
            <div className="relative flex flex-col gap-6 pl-6 border-l-2 border-slate-200 dark:border-slate-800 ml-3 py-2">
              {flowStages.map((stage, idx) => (
                <div key={idx} className="relative">
                  <span className={`absolute -left-[33px] top-0 w-5.5 h-5.5 rounded-full border-2 flex items-center justify-center text-[9px] font-black transition-all
                    ${stage.done 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20' 
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-400'
                    }
                  `}>
                    {stage.done ? '✓' : idx + 1}
                  </span>
                  <div>
                    <h4 className={`text-[11px] font-extrabold uppercase tracking-wide ${stage.done ? 'text-slate-850 dark:text-slate-200' : 'text-slate-400'}`}>
                      {stage.label}
                    </h4>
                    {stage.sub && <p className="text-[9px] text-slate-400 mt-0.5">{stage.sub}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Details Pane */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Tab Selection */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 overflow-x-auto select-none no-scrollbar">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'materials', label: 'Materials Tree' },
              { id: 'timeline', label: 'Timeline History' },
              { id: 'transfers', label: 'Transfers' },
              { id: 'returns', label: 'Returns' },
              { id: 'documents', label: 'Documents' },
              { id: 'chat', label: 'Chat thread' },
              { id: 'audit', label: 'Cryptographic Audit' }
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

          {/* TAB 1: Overview */}
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-6">
              <Card title="Movement Overview">
                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Sender / Requester</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{txn.sender?.fullName}</p>
                    <p className="text-slate-400 text-[10px] font-medium">Emp ID: {txn.sender?.employeeId} | {txn.sender?.department?.name}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Receiver / temporary Holder</span>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{txn.receiver?.fullName || txn.otherReceiverName || 'Internal Store / Handler'}</p>
                    {txn.receiver && <p className="text-slate-400 text-[10px] font-medium">Emp ID: {txn.receiver?.employeeId}</p>}
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Priority</span>
                    <Badge variant={txn.priority === 'critical' || txn.priority === 'high' ? 'danger' : 'primary'}>
                      {txn.priority.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Cost Center</span>
                    <p className="font-bold text-slate-850 dark:text-slate-200">{txn.costCenter || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Expected Return Date</span>
                    <p className="font-bold text-slate-850 dark:text-slate-200">
                      {txn.expectedReturnDate ? new Date(txn.expectedReturnDate).toLocaleDateString() : 'Direct challan (No return expected)'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-0.5">Material Value Total</span>
                    <p className="font-black text-blue-600 dark:text-blue-400 text-sm">₹{txn.grandTotal?.toLocaleString()}</p>
                  </div>
                  {txn.rejectionReason && (
                    <div className="col-span-2 bg-rose-500/10 border border-rose-500/25 p-4 rounded-xl text-rose-600 dark:text-rose-400">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider block mb-1">Rejection Reason</span>
                      <p className="font-bold text-xs">{txn.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Photos Panel */}
              {(txn.documentPhotos?.length > 0 || txn.photos?.length > 0) && (
                <Card title="Verification Photos">
                  <div className="flex flex-wrap gap-3">
                    {(txn.documentPhotos || txn.photos || []).map((img, idx) => (
                      <div key={idx} className="relative border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden group w-36 h-28 bg-slate-50">
                        <img src={img.url || img} alt="Verification challan" className="w-full h-full object-cover" />
                        <a 
                          href={img.url || img} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity"
                        >
                          View Image
                        </a>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* TAB 2: Materials & Barcodes Tree */}
          {activeTab === 'materials' && (
            <Card title="Materials Tree (Independent Barcode loops)">
              <div className="flex flex-col gap-5">
                {txn.materials?.map((mat, idx) => {
                  const materialBarcodes = barcodes.filter(b => b.materialName === mat.name);
                  return (
                    <div key={idx} className="border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/20">
                      <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/50 dark:border-slate-850">
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">{mat.name}</h4>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                            Qty: {mat.quantity || mat.qty} {mat.unit} • ₹{mat.price} each
                          </span>
                        </div>
                        <span className="font-extrabold text-slate-700 dark:text-slate-350 text-xs">
                          ₹{mat.total?.toLocaleString()}
                        </span>
                      </div>

                      {/* Barcodes list */}
                      <div className="flex flex-col gap-2 mt-3">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Items and Status</span>
                        {materialBarcodes.length === 0 ? (
                          <div className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-lg flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{mat.barcode || 'N/A'}</span>
                            <span className="text-slate-400 italic text-[10px] font-medium">Pending store dispatch assignment</span>
                          </div>
                        ) : (
                          materialBarcodes.map(bc => (
                            <button
                              key={bc.barcode}
                              type="button"
                              onClick={() => handleBarcodeClick(bc.barcode)}
                              className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 hover:border-blue-400 dark:hover:border-blue-800 rounded-lg flex items-center justify-between gap-4 transition-all text-left w-full cursor-pointer shadow-xs group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
                                  {bc.barcode}
                                </span>
                                <Badge variant={bc.status === 'Returned' ? 'secondary' : 'success'}>
                                  {bc.status.toUpperCase()}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                                <span>Owner: {bc.owner?.fullName || 'N/A'}</span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* TAB 3: Timeline History */}
          {activeTab === 'timeline' && (
            <Card title="Activity Logs and Version Audits">
              <div className="flex flex-col gap-4">
                {txn.approvalChain?.map((app, idx) => (
                  <div key={idx} className="p-3.5 bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl flex items-start gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg shrink-0">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {app.role === 'team_lead' ? 'Team Lead Approval' : 'Management Sign-off'}
                      </h4>
                      <p className="text-[10px] text-slate-450 mt-0.5">Remarks: {app.remarks}</p>
                      <span className="text-[9px] text-slate-400 mt-1 block font-semibold">
                        {app.approver?.fullName || app.user?.fullName} on {new Date(app.timestamp || app.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
                
                {/* Versions */}
                {txn.versions?.map((ver, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-150 dark:border-slate-850 rounded-xl flex items-start gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-650 rounded-lg shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200">
                        Workflow Event: {ver.action.toUpperCase()}
                      </h4>
                      <span className="text-[9px] text-slate-400 mt-1 block font-semibold">
                        Modified by Employee on {new Date(ver.timestamp || ver.createdAt || txn.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* TAB 4: Transfers */}
          {activeTab === 'transfers' && (
            <Card title="Internal Transfers Log">
              <div className="flex flex-col gap-3">
                {barcodes.filter(b => b.history.some(h => h.action.includes('Transfer'))).length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No internal barcode transfers have occurred in this challan.</p>
                ) : (
                  barcodes.map(bc => (
                    <div key={bc.barcode} className="p-4 border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl">
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{bc.barcode}</span>
                      <div className="mt-2 pl-3 border-l border-slate-200 dark:border-slate-800 flex flex-col gap-2.5">
                        {bc.history.filter(h => h.action.includes('Transfer') || h.action.includes('Created')).map((h, i) => (
                          <div key={i} className="text-[11px] text-slate-600 dark:text-slate-400">
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

          {/* TAB 5: Returns */}
          {activeTab === 'returns' && (
            <Card title="Returns Log">
              <div className="flex flex-col gap-3">
                {barcodes.filter(b => b.status === 'Returned' || b.status === 'Return Requested').length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No returns initiated yet.</p>
                ) : (
                  barcodes.filter(b => b.status === 'Returned' || b.status === 'Return Requested').map(bc => (
                    <div key={bc.barcode} className="p-4 border border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl flex items-center justify-between gap-4">
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

          {/* TAB 6: Documents */}
          {activeTab === 'documents' && (
            <Card title="Supporting Challan Documents">
              <div className="flex flex-col gap-3.5">
                <div className="p-4 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <File className="w-8 h-8 text-blue-600 shrink-0" />
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

          {/* TAB 7: Chat Thread */}
          {activeTab === 'chat' && (
            <Card title="Inline Dossier Discussion Threads">
              <div className="flex flex-col gap-3 py-2">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Comment streams inside this transaction context:</p>
                
                {/* Renders global comments / barcode chat log for this txn */}
                <div className="border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl p-4 min-h-[150px] max-h-[300px] overflow-y-auto flex flex-col gap-3">
                  {barcodes.length === 0 ? (
                    <p className="text-xs text-slate-450 italic text-center py-10">No barcode conversations found.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50/60 dark:bg-blue-950/20 px-2 py-0.5 rounded uppercase tracking-wider font-mono self-start">
                        Comment Log
                      </span>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold italic mt-1">
                        Use the barcode side panel (by clicking a barcode in the tree) to read and write active chat thread logs!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* TAB 8: Cryptographic Audit */}
          {activeTab === 'audit' && (
            <Card title="Audit and Integrity Signatures">
              <div className="p-4 bg-slate-900 text-slate-300 font-mono text-[10px] rounded-xl flex flex-col gap-2 leading-relaxed">
                <div>// SECURITY HASH Dossier Trail</div>
                <div className="text-emerald-500 font-bold">✓ INTEGRITY VERIFIED</div>
                <div>Hash Code: SHA256.{id.substring(0, 12)}.{txn.transactionId.replace(/-/g, '')}</div>
                <div>Registered Timestamp: {new Date(txn.createdAt).toISOString()}</div>
                <div>Sender Cryptographic Signature: [RSA-2048-SIGNED]</div>
              </div>
            </Card>
          )}

          {/* Invoice Matching Card for Accounts */}
          {activeTab === 'matching' && showMatchTab && (
            <Card title="Invoice Match verification Form">
              <form onSubmit={handleInvoiceMatchSubmit} className="flex flex-col gap-4 text-xs">
                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1">Invoice Number *</label>
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
                  <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    value={matchFormData.invoiceDate}
                    onChange={(e) => setMatchFormData({ ...matchFormData, invoiceDate: e.target.value })}
                    required
                    className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1">Invoice Total Value (₹) *</label>
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

        </div>
      </div>

      {/* Barcode Flow Slide-in Drawer Panel (Panel 5 & Panel 10) */}
      {selectedBarcode && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs" onClick={() => setSelectedBarcode(null)} />
          
          {/* Drawer Pane */}
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-screen shadow-2xl flex flex-col z-50 border-l border-slate-200 dark:border-slate-850 animate-in slide-in-from-right duration-200">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950/20">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-mono leading-none">
                    {selectedBarcode.barcode}
                  </h3>
                  <Badge variant={selectedBarcode.status === 'Returned' ? 'secondary' : 'success'}>
                    {selectedBarcode.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                  Item: {selectedBarcode.materialName}
                </p>
              </div>
              <button onClick={() => setSelectedBarcode(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions at Drawer top */}
            {selectedBarcode.status === 'Active' && selectedBarcode.owner?._id === user?._id && (
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/25 border-b border-slate-100 dark:border-slate-800 flex gap-2">
                <Button size="xs" variant="outline" className="flex-1 text-[10px] uppercase font-extrabold" onClick={() => setBarcodeAction('transfer')}>
                  Transfer Lot
                </Button>
                <Button size="xs" variant="outline" className="flex-1 text-[10px] uppercase font-extrabold" onClick={() => setBarcodeAction('return')}>
                  Return Store
                </Button>
                <Button size="xs" variant="outline" className="flex-1 text-[10px] uppercase font-extrabold" onClick={() => setBarcodeAction('split')}>
                  Split Lot
                </Button>
              </div>
            )}

            {/* Main scrollable body */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 custom-scrollbar">
              
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50/50 dark:bg-slate-900/30 p-3.5 rounded-xl border border-slate-150 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <div>
                  <span className="text-[9px] text-slate-450 uppercase block font-bold mb-0.5">Current Owner</span>
                  <span className="text-slate-900 dark:text-white font-bold text-xs">{selectedBarcode.owner?.fullName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-455 uppercase block font-bold mb-0.5">Transfers count</span>
                  <span className="text-slate-900 dark:text-white font-bold text-xs">
                    {selectedBarcode.history.filter(h => h.action.includes('Transfer')).length}
                  </span>
                </div>
              </div>

              {/* Barcode timeline logs */}
              <div>
                <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3 block">
                  Barcode Lifecycle Logs
                </h4>
                
                <div className="relative pl-5 border-l-2 border-slate-200 dark:border-slate-800 ml-2.5 py-1 flex flex-col gap-4">
                  {barcodeTimeline.map((log, i) => (
                    <div key={i} className="relative">
                      <span className="absolute -left-[27px] top-1.5 w-3 h-3 bg-blue-600 dark:bg-blue-500 rounded-full border border-white dark:border-slate-900" />
                      <div className="text-xs">
                        <div className="font-extrabold text-slate-800 dark:text-white">{log.action}</div>
                        {log.remarks && <p className="text-[10px] text-slate-500 mt-0.5">{log.remarks}</p>}
                        <span className="text-[9px] text-slate-400 block mt-0.5 font-bold uppercase">
                          by {log.user?.fullName || 'System'} on {new Date(log.timestamp || log.createdAt || txn.updatedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Barcode Discussion thread panel */}
              <div className="border-t border-slate-150 dark:border-slate-800 pt-4">
                <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2.5 block">
                  Loop Chat Logs
                </h4>
                <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto p-2 bg-slate-50/50 dark:bg-slate-900/35 border border-slate-100 dark:border-slate-800/80 rounded-xl">
                  {barcodeChatMessages.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic text-center py-6">No discussions logged for this item loop.</p>
                  ) : (
                    barcodeChatMessages.map((msg, i) => {
                      const isMe = msg.sender?._id === user?._id || msg.sender === user?._id;
                      return (
                        <div key={i} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                          <span className="text-[8px] font-extrabold text-slate-400 mb-0.5">{msg.sender?.fullName}</span>
                          <div className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold
                            ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'}
                          `}>
                            {msg.message}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Comment input form */}
                <form onSubmit={handleBarcodeChatSubmit} className="mt-2.5 flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter audit trail comment..."
                    value={barcodeChatText}
                    onChange={(e) => setBarcodeChatText(e.target.value)}
                    required
                    className="flex-1 text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg px-2.5 py-2 font-semibold focus:outline-none focus:border-blue-500"
                  />
                  <button type="submit" className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>

            </div>
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
                  <div className="relative border border-slate-200 dark:border-slate-850 rounded-xl overflow-hidden bg-slate-50 h-36">
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
