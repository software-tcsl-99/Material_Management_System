import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import api from '../lib/api';

export default function BarcodeDetail() {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const chatEndRef = useRef(null);
  const [acceptPhoto, setAcceptPhoto] = useState('/images/mock-accept.jpg');
  const [accepting, setAccepting] = useState(false);

  // Close Request modal states
  const [barcodeCloseModal, setBarcodeCloseModal] = useState(false);
  const [barcodeCloseDocType, setBarcodeCloseDocType] = useState('DC Internal');
  const [barcodeCloseDocNumber, setBarcodeCloseDocNumber] = useState('');
  const [barcodeCloseRemarks, setBarcodeCloseRemarks] = useState('');
  const [barcodeCloseSubmitting, setBarcodeCloseSubmitting] = useState(false);
  const [managementUsers, setManagementUsers] = useState([]);
  const [selectedManagementId, setSelectedManagementId] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['barcodeDetail', barcode],
    queryFn: async () => {
      const { data } = await api.get(`/barcodes/${barcode}`);
      return data;
    }
  });

  const { data: userData } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data.user;
    }
  });

  useEffect(() => {
    api.get('/employees?limit=1000&allDepartments=true').then(res => {
      const empList = res.data.employees || res.data.data || [];
      const mgtList = empList.filter(e => e.role === 'department_admin' && e.departmentAdminType === 'management' && e._id !== userData?._id && e.role !== 'super_admin');
      setManagementUsers(mgtList.map(m => ({ value: m._id, label: `${m.fullName} (${m.employeeId})` })));
    }).catch(err => console.error(err));
  }, [userData]);

  const fetchChat = async (txnId) => {
    if (!txnId) return;
    setLoadingChat(true);
    try {
      const chatRes = await api.get(`/chat/${txnId}/messages`);
      setChatMessages(chatRes.data.messages || []);
      setTimeout(() => {
        if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    } finally {
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    if (data?.barcode?.transactionId) {
      fetchChat(data.barcode.transactionId);
    }
  }, [data]);

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatText.trim() || !data?.barcode?.transactionId) return;
    try {
      const res = await api.post(`/chat/${data.barcode.transactionId}/messages`, {
        message: chatText
      });
      setChatMessages(prev => [...prev, res.data.chatMessage]);
      setChatText('');
      setTimeout(() => {
        if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit chat comment.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-650" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm font-semibold flex items-center gap-2">
        <AlertCircle className="w-5 h-5" /> Error loading barcode details.
      </div>
    );
  }

  const { barcode: bc, transfers, returns } = data;

  const isOwner = userData && (bc.owner?._id || bc.owner)?.toString() === userData._id?.toString();

  const filteredHistory = bc?.history?.filter(log => {
    const matches = log.action.match(/[A-Z]{2}\d{6}/g);
    if (matches) {
      const hasOtherBarcode = matches.some(bCode => bCode !== bc.barcode);
      if (hasOtherBarcode) return false;
    }
    return true;
  }) || [];

  const timelineHistory = [...filteredHistory];
  if (bc?.closeRequest) {
    if (bc.closeRequest.status === 'pending_accounts_approval') {
      timelineHistory.push({
        action: 'Pending Accounts Upload',
        user: { fullName: 'Accounts Admin' },
        timestamp: bc.closeRequest.updatedAt || new Date().toISOString(),
        remarks: 'Awaiting invoice document upload to close transaction'
      });
    } else if (bc.closeRequest.status === 'pending_store_acceptance') {
      timelineHistory.push({
        action: 'Pending Store Acceptance',
        user: { fullName: 'Store Admin' },
        timestamp: bc.closeRequest.updatedAt || new Date().toISOString(),
        remarks: 'Awaiting store confirmation of the conversion request'
      });
    }
  }
  if (bc?.status === 'Cancelled' || bc?.transaction?.status === 'rejected') {
    const rejectTimeline = bc.transaction?.timeline?.find(t => t.action === 'Request Rejected' || t.action === 'Receipt Rejected' || t.action?.toLowerCase()?.includes('reject'));
    const rejectUser = rejectTimeline?.user || bc.transaction?.requester;
    const rejectTime = rejectTimeline?.timestamp || bc.transaction?.updatedAt;
    const rejectRemarks = rejectTimeline?.remarks || bc.transaction?.rejectionReason;
    
    timelineHistory.push({
      action: 'Transaction Rejected / Barcode Cancelled',
      user: rejectUser,
      timestamp: rejectTime,
      remarks: `Status: Cancelled. Reason: ${rejectRemarks || 'No reason specified'}`
    });
  }
  timelineHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const handleAcceptSplit = async () => {
    setAccepting(true);
    try {
      await api.post('/barcodes/accept-split-material', {
        barcode: bc.barcode,
        gps: { lat: 18.5204, lng: 73.8567, address: 'MIDC Pune, India' },
        photos: [{ url: acceptPhoto, capturedAt: new Date().toISOString() }]
      });
      alert('Material accepted successfully!');
      refetch();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept material.');
    } finally {
      setAccepting(false);
    }
  };

  const handleBarcodeCloseSubmit = async (e) => {
    e.preventDefault();
    if (!barcodeCloseDocNumber.trim()) {
      alert('Please enter a document number.');
      return;
    }
    if (['DC FOC', 'Invoice'].includes(barcodeCloseDocType) && !selectedManagementId) {
      alert('Please select a management approver.');
      return;
    }
    setBarcodeCloseSubmitting(true);
    try {
      await api.post('/barcodes/close-request', {
        barcode,
        documentType: barcodeCloseDocType,
        documentNumber: barcodeCloseDocNumber,
        remarks: barcodeCloseRemarks,
        managementApprover: ['DC FOC', 'Invoice'].includes(barcodeCloseDocType) ? selectedManagementId : undefined
      });
      alert('Close request submitted successfully!');
      setBarcodeCloseModal(false);
      refetch();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit close request.');
    } finally {
      setBarcodeCloseSubmitting(false);
    }
  };

  const material = bc.transaction?.materials?.find(m => 
    m.barcodes?.some(b => b.barcode === bc.barcode || b === bc.barcode)
  );
  const price = material?.price || 0;

  const mockPhotos = [
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&q=80',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=300&q=80'
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16 relative">

      {/* Page Title & Navigation line */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-1">
            <span>Transactions</span>
            <ChevronRight className="w-3 h-3" />
            <span
              onClick={() => bc.transaction && navigate(`/transactions/${bc.transaction._id || bc.transaction}`)}
              className="text-blue-600 hover:underline cursor-pointer font-bold"
            >
              {bc.transactionId}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-1 -ml-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none m-0">
              5. Materials & Barcodes Tree
            </h1>
          </div>
        </div>

        {/* Actions Panel */}
        <div className="flex items-center gap-2 flex-wrap">
          {bc.status?.toUpperCase() === 'ACTIVE' && (
            (userData?.role === 'super_admin' || (userData?.role === 'department_admin' && userData?.departmentAdminType === 'store')) ||
              (bc.owner?._id || bc.owner)?.toString() === userData?._id?.toString()
          ) && (
            !bc.transaction || 
            ['received', 'active', 'partially_returned', 'closed'].includes(bc.transaction.status)
          ) && (
            !returns || 
            !returns.some(r => ['pending', 'handler_assigned', 'collected', 'store_received'].includes(r.status))
          ) && (
            !transfers || 
            !transfers.some(t => ['pending', 'approved'].includes(t.status))
          ) && (
            !bc.closeRequest || 
            !['pending_accounts_approval', 'pending_store_acceptance'].includes(bc.closeRequest.status)
          ) && (
            <>
              <Button size="sm" variant="outline" onClick={() => navigate(`/barcodes/${bc.barcode}/split`)}>
                Split Serial
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/barcodes/${bc.barcode}/return`)}>
                Return Request
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                setBarcodeCloseDocType('DC Internal');
                setBarcodeCloseDocNumber('');
                setBarcodeCloseRemarks('');
                setBarcodeCloseModal(true);
              }}>
                Convert to DC
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                setBarcodeCloseDocType('Invoice');
                setBarcodeCloseDocNumber('');
                setBarcodeCloseRemarks('');
                setBarcodeCloseModal(true);
              }}>
                Convert to Invoice
              </Button>
              <Button size="sm" onClick={() => navigate(`/barcodes/${bc.barcode}/transfer`)}>
                Transfer Barcode
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="font-extrabold text-xs uppercase">
            Export <ChevronDown className="w-3.5 h-3.5 ml-1 inline-block" />
          </Button>
        </div>
      </div>


      {/* Main Details Grid Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-stretch">
        {/* Left Card Detail */}
        <div className="flex flex-col justify-center items-start border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl md:w-1/4">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-2">Barcode Detail</span>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-white font-mono">{bc.barcode}</h2>
            <span className="text-[9px] font-extrabold bg-blue-50 text-blue-600 dark:bg-blue-950/30 px-2 py-0.5 rounded uppercase font-mono">
              {bc.materialName}
            </span>
          </div>
        </div>

        {/* Right Info Grid */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-6 p-1">
          <div>
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Material</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">{bc.materialName}</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Barcode</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs font-mono">{bc.barcode}</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Shares / Owner</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
              {bc.owner?.fullName || 'Stores'}
            </span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Unit Valuation</span>
            <span className="font-extrabold text-blue-650 dark:text-blue-400 text-xs">
              {price > 0 ? `₹${price.toLocaleString('en-IN')}` : '₹0'}
            </span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Transaction Combined Valuation</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs">
              {bc.transaction?.materials
                ? `₹${bc.transaction.materials.reduce((sum, m) => sum + ((m.price || 0) * m.quantity), 0).toLocaleString('en-IN')}`
                : 'N/A'
              }
            </span>
          </div>
          <div className="flex flex-col items-start gap-1">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Status</span>
            <Badge variant={bc.status?.toUpperCase() === 'RETURNED' ? 'secondary' : bc.status?.toUpperCase() === 'CANCELLED' ? 'danger' : bc.status?.toUpperCase() === 'ACTIVE' ? 'primary' : 'success'}>
              {bc.status?.toUpperCase() === 'ACTIVE' ? 'Active (Transferred)' : bc.status?.toUpperCase()}
            </Badge>
          </div>
      </div>
    </div>

    {/* Main Details Panel Content */}
      <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left Column: Photos, Remarks, Attachments (2 Columns) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Photos Panel with individual GPS Locations */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/60">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Photos</h4>
                <span className="text-[10px] text-blue-650 hover:underline font-bold cursor-pointer">View All</span>
              </div>
              <div className="flex flex-col gap-4">
                {!bc.photos || bc.photos.length === 0 ? (
                  <p className="text-xs text-slate-405 italic mt-1">No photos uploaded</p>
                ) : (
                  bc.photos.map((p, i) => (
                    <div key={i} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                        <img src={p.url} alt={`Scan ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Photo #{i + 1} Location (GPS)</span>
                        {p.lat && p.lng ? (
                          <>
                            <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {p.lat.toFixed(4)}° N, {p.lng.toFixed(4)}° E
                            </p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                              {p.address}
                            </p>
                          </>
                        ) : bc.gps ? (
                          <>
                            <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {bc.gps.lat.toFixed(4)}° N, {bc.gps.lng.toFixed(4)}° E
                            </p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                              {bc.gps.address}
                            </p>
                          </>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">No GPS coordinates recorded</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Remarks Panel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col gap-2">
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-50 dark:border-slate-800/60">Remarks</h4>
              <p className="text-xs text-slate-600 dark:text-slate-350 font-semibold leading-relaxed mt-1">
                {bc.history?.[bc.history.length - 1]?.remarks || 'No remarks recorded for this status lot.'}
              </p>
            </div>

            {/* Attachments Panel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col gap-2">
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-50 dark:border-slate-800/60">Attachments</h4>
              {bc.documents?.length === 0 ? (
                <p className="text-xs text-slate-400 italic mt-1">No documents</p>
              ) : (
                <div className="flex flex-col gap-2.5 mt-1">
                  {bc.documents.map((doc, idx) => (
                    <a key={idx} href={doc.url} className="text-xs text-blue-650 hover:underline font-bold" target="_blank" rel="noreferrer">
                      {doc.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Left-Dated Stepper timeline (3 Columns) */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="relative pl-[110px] py-4">
              {/* Vertical green timeline line running in center of dates and texts */}
              <div className="absolute left-[92px] top-4 bottom-4 w-0.5 bg-emerald-600" />

              <div className="flex flex-col gap-8">
                {timelineHistory.map((log, idx) => {
                  const logDate = new Date(log.timestamp);
                  const actionLower = log.action.toLowerCase();
                  const isTransfer = actionLower.includes('transfer');
                  const isReturn = actionLower.includes('return');
                  const isSplit = actionLower.includes('split');
                  const isClose = actionLower.includes('close') || actionLower.includes('closed') || actionLower.includes('approval') || actionLower.includes('upload') || actionLower.includes('conversion');
                  const isRejectedLog = actionLower.includes('reject') || actionLower.includes('cancel');

                  const hasLaterCompletion = timelineHistory.slice(idx + 1).some(laterH => {
                    const latAct = laterH.action.toLowerCase();
                    return latAct.includes('accepted') || 
                           latAct.includes('completed') || 
                           latAct.includes('approved') || 
                           latAct.includes('rejected') || 
                           latAct.includes('closed') ||
                           latAct.includes('returned') ||
                           latAct.includes('first approval') ||
                           latAct.includes('approval');
                  });

                  let actionLabel = log.action;
                  let statusLabel = 'COMPLETED';
                  let byLabel = log.user?.fullName || 'System';

                  if (isTransfer) {
                    actionLabel = `${log.action} for ${bc.barcode}`;
                    if (actionLower.includes('accepted') || actionLower.includes('approved')) {
                      statusLabel = 'ACCEPTED';
                      byLabel = `Accepted by: ${log.user?.fullName || 'Operator'}`;
                    } else if (actionLower.includes('rejected')) {
                      statusLabel = 'REJECTED';
                      byLabel = `Rejected by: ${log.user?.fullName || 'Operator'}`;
                    } else {
                      statusLabel = hasLaterCompletion ? 'ACCEPTED' : 'PENDING';
                      if (statusLabel === 'PENDING') {
                        if (actionLower.includes('pending acceptance')) {
                          byLabel = `Pending Acceptance by: ${log.user?.fullName || 'Recipient'}`;
                        } else {
                          byLabel = `Pending Approval`;
                        }
                      } else {
                        byLabel = `Initiated by: ${log.user?.fullName || 'Operator'}`;
                      }
                    }
                  } else if (isSplit) {
                    actionLabel = `${log.action} for ${bc.barcode}`;
                    if (actionLower.includes('accepted') || actionLower.includes('approved') || actionLower.includes('completed')) {
                      statusLabel = 'ACCEPTED';
                      byLabel = `Accepted by: ${log.user?.fullName || 'Operator'}`;
                    } else if (actionLower.includes('rejected')) {
                      statusLabel = 'REJECTED';
                      byLabel = `Rejected by: ${log.user?.fullName || 'Operator'}`;
                    } else {
                      statusLabel = hasLaterCompletion ? 'ACCEPTED' : 'PENDING';
                      if (statusLabel === 'PENDING') {
                        byLabel = 'Pending Store Approval';
                      } else {
                        byLabel = `Initiated by: ${log.user?.fullName || 'Operator'}`;
                      }
                    }
                  } else if (isReturn) {
                    actionLabel = `${log.action} for ${bc.barcode}`;
                    if (actionLower.includes('accepted') || actionLower.includes('completed') || actionLower.includes('returned')) {
                      statusLabel = 'ACCEPTED';
                      byLabel = `Accepted by: ${log.user?.fullName || 'Operator'}`;
                    } else if (actionLower.includes('rejected')) {
                      statusLabel = 'REJECTED';
                      byLabel = `Rejected by: ${log.user?.fullName || 'Operator'}`;
                    } else {
                      statusLabel = hasLaterCompletion ? 'ACCEPTED' : 'PENDING';
                      if (statusLabel === 'PENDING') {
                        if (actionLower.includes('requested')) {
                          byLabel = `Pending Return Collection by Handler`;
                        } else if (actionLower.includes('collected')) {
                          byLabel = `Pending Handover to Store by: ${log.user?.fullName || 'Handler'}`;
                        } else if (actionLower.includes('handed over')) {
                          byLabel = `Pending Store Acceptance`;
                        } else {
                          byLabel = 'Pending Return';
                        }
                      } else {
                        if (actionLower.includes('collected')) {
                          byLabel = `Collected by: ${log.user?.fullName || 'Handler'}`;
                        } else if (actionLower.includes('handed over')) {
                          byLabel = `Handed over by: ${log.user?.fullName || 'Handler'}`;
                        } else {
                          byLabel = `Initiated by: ${log.user?.fullName || 'Operator'}`;
                        }
                      }
                    }
                  } else if (isClose) {
                    actionLabel = `${log.action} for ${bc.barcode}`;
                    if (actionLower.includes('closed') || actionLower.includes('completed')) {
                      statusLabel = 'APPROVED';
                      byLabel = `Approved by: ${log.user?.fullName || 'Operator'}`;
                    } else if (actionLower.includes('rejected') || actionLower.includes('declined')) {
                      statusLabel = 'REJECTED';
                      byLabel = `Rejected by: ${log.user?.fullName || 'Operator'}`;
                    } else if (log.action === 'First Approval') {
                      const isApproved = ['pending_accounts_approval', 'pending_store_acceptance', 'approved'].includes(bc.closeRequest?.status);
                      statusLabel = isApproved ? 'APPROVED' : 'PENDING';
                      if (statusLabel === 'PENDING') {
                        if (bc.closeRequest?.managementApprover) {
                          byLabel = `Pending Management Approval by: ${bc.closeRequest.managementApprover.fullName}`;
                        } else {
                          byLabel = 'Pending Approval';
                        }
                      } else {
                        byLabel = `Approved by Management: ${log.user?.fullName || 'Approver'}`;
                      }
                    } else if (log.action === 'Close Requested') {
                      const isAccepted = ['pending_accounts_approval', 'pending_store_acceptance', 'approved'].includes(bc.closeRequest?.status);
                      statusLabel = isAccepted ? 'ACCEPTED' : 'PENDING';
                      if (statusLabel === 'PENDING') {
                        if (bc.closeRequest?.managementApprover) {
                          byLabel = `Pending Management Approval by: ${bc.closeRequest.managementApprover.fullName}`;
                        } else {
                          byLabel = 'Pending Approval';
                        }
                      } else {
                        byLabel = `Initiated by: ${log.user?.fullName || 'Operator'}`;
                      }
                    } else if (actionLower.includes('pending')) {
                      statusLabel = 'PENDING';
                      byLabel = log.user?.fullName || 'Pending Action';
                    } else {
                      statusLabel = hasLaterCompletion ? 'APPROVED' : 'PENDING';
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
                        byLabel = `Initiated by: ${log.user?.fullName || 'Operator'}`;
                      }
                    }
                  } else if (isRejectedLog) {
                    statusLabel = 'REJECTED';
                  }

                  let circleColor = 'bg-emerald-600';
                  if (isTransfer) circleColor = 'bg-orange-500';
                  else if (isReturn || isRejectedLog) circleColor = 'bg-rose-500';
                  else if (isSplit) circleColor = 'bg-indigo-500';
                  else if (isClose) circleColor = 'bg-blue-500';

                  return (
                    <div key={idx} className="relative flex items-start">
                      {/* Date and Time on the left of the line */}
                      <div className="absolute -left-[110px] w-[85px] text-right pr-3.5 flex flex-col gap-0.5 select-none">
                        <span className="text-[10px] text-slate-800 dark:text-slate-200 font-extrabold uppercase tracking-wide">
                          {logDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-[9px] text-slate-400 block font-bold">
                          {logDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>

                      {/* Middle: Stepper circle node exactly centered on the line */}
                      <span className={`absolute left-[-22px] top-[4px] w-3 h-3 rounded-full ${circleColor} border-2 border-white dark:border-slate-900 z-10`} />

                      {/* Right side: Action details */}
                      <div className="pl-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-xs font-black text-slate-800 dark:text-slate-100 font-sans leading-snug">
                            {actionLabel}
                          </h5>
                          <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm
                            ${statusLabel === 'PENDING'
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                              : statusLabel === 'REJECTED'
                                ? 'bg-rose-500/10 text-rose-500 dark:bg-rose-950/20'
                                : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/20'
                            }
                          `}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium italic mt-0.5">
                          By: {byLabel} {log.remarks ? `— ${log.remarks}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Barcode Close / DC Conversion Modal */}
      {barcodeCloseModal && (() => {
        const materialName = material?.name || bc.materialName || 'Unknown Material';
        const isInvoice = barcodeCloseDocType === 'Invoice';
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {isInvoice ? 'Convert Barcode to Invoice' : 'Convert DC Type'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    {isInvoice ? 'Invoice Conversion Request (Accounts Approval)' : 'Challan type migration event'}
                  </p>
                </div>
                <button onClick={() => setBarcodeCloseModal(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleBarcodeCloseSubmit} className="mt-4 flex flex-col gap-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-slate-500 font-bold uppercase tracking-wider mb-1">Target Barcode</span>
                    <span className="block font-mono font-black text-blue-650 dark:text-blue-450 text-xs mt-0.5">{barcode}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-bold uppercase tracking-wider mb-1">Material</span>
                    <span className="block font-sans font-extrabold text-slate-850 dark:text-slate-205 text-xs mt-0.5 truncate">{materialName}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Target Document Type *</label>
                  {isInvoice ? (
                    <input
                      type="text"
                      value="Invoice"
                      disabled
                      className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-250 dark:border-slate-800 rounded-lg px-3 py-2.5 font-bold focus:outline-none cursor-not-allowed text-slate-500"
                    />
                  ) : (
                    <select
                      value={barcodeCloseDocType}
                      onChange={(e) => setBarcodeCloseDocType(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-lg px-3 py-2.5 font-semibold focus:outline-none"
                    >
                      <option value="DC Internal">DC Internal</option>
                      <option value="DC FOC">DC FOC</option>
                    </select>
                  )}
                </div>

                {['DC FOC', 'Invoice'].includes(barcodeCloseDocType) && (
                  <div>
                    <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Choose Management Approver *</label>
                    <select
                      value={selectedManagementId}
                      onChange={(e) => setSelectedManagementId(e.target.value)}
                      required
                      className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-lg px-3 py-2.5 font-semibold focus:outline-none"
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
                    placeholder={isInvoice ? "e.g. INV-20260012" : "e.g. DC-10092"}
                    className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-lg px-3 py-2.5 font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5">Remarks / Reason *</label>
                  <textarea
                    value={barcodeCloseRemarks}
                    onChange={(e) => setBarcodeCloseRemarks(e.target.value)}
                    required
                    placeholder={isInvoice ? "Invoice conversion reason for Accounts Admin approval..." : "Conversion reason for TL approval..."}
                    rows="2.5"
                    className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-lg px-3 py-2.5 font-semibold focus:outline-none"
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
        );
      })()}
    </div>
  );
}
