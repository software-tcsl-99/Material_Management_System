import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
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

  // Exchange Request modal states
  const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
  const [exchangeNewBarcode, setExchangeNewBarcode] = useState('');
  const [exchangeWarrantyReason, setExchangeWarrantyReason] = useState('');
  const [exchangeSubmitting, setExchangeSubmitting] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [viewAllModalOpen, setViewAllModalOpen] = useState(false);

  const handleExport = async (format) => {
    setExportDropdownOpen(false);
    setExporting(true);
    try {
      const response = await api.get(`/barcodes/${barcode}/export/${format}`, {
        responseType: 'blob'
      });
      const fileExtension = format === 'excel' ? 'xlsx' : 'pdf';
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Barcode_${barcode}.${fileExtension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting barcode:', err);
    } finally {
      setExporting(false);
    }
  };

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

  const bc = data?.barcode;
  const transfers = data?.transfers || [];
  const returns = data?.returns || [];
  const splits = data?.splits || [];
  const exchanges = data?.exchanges || [];

  const isOwner = bc && userData && (bc.owner?._id || bc.owner)?.toString() === userData._id?.toString();

  const isReplacementBarcode = exchanges.some(ex => ex.newBarcode === barcode && ex.status === 'approved');
  const showOnlyReturnButton = bc && bc.status?.toUpperCase() === 'ACTIVE' && isReplacementBarcode;
  const showAllButtons = bc && (
    bc.status?.toUpperCase() === 'EXCHANGED' ||
    (bc.status?.toUpperCase() === 'ACTIVE' && !isReplacementBarcode)
  );

  const filteredHistory = bc?.history?.filter(log => {
    const actionLower = (log.action || '').toLowerCase();

    // Exclude database-level generic exchange entries, as we will render them dynamically
    if (['exchanged', 'barcode exchanged', 'exchange requested'].includes(actionLower)) {
      return false;
    }

    // Exclude timeline entries referencing a different barcode (e.g., "Split Approved for 554545" when viewing child "1111")
    const words = log.action.split(' ');
    const forIndex = words.indexOf('for');
    if (forIndex !== -1 && forIndex < words.length - 1) {
      const targetBarcode = words[forIndex + 1].replace(/[^a-zA-Z0-9]/g, '').trim();
      if (targetBarcode && targetBarcode !== barcode) {
        return false;
      }
    }

    const matches = log.action.match(/[A-Z]{2}\d{6}/g);
    if (matches) {
      const hasOtherBarcode = matches.some(bCode => bCode !== barcode);
      if (hasOtherBarcode) return false;
    }
    return true;
  }) || [];

  const timelineHistory = [...filteredHistory];

  // Dynamically build clean exchange logs chronologically (Request -> Approve/Reject)
  exchanges.forEach(ex => {
    // 1. Exchange Requested
    if (ex.status === 'pending') {
      timelineHistory.push({
        action: 'Barcode Exchange Requested',
        user: ex.requester,
        timestamp: ex.createdAt,
        remarks: `Warranty exchange requested. Failure reason: ${ex.warrantyReason}`
      });
    }

    // 2. Exchange Approved/Rejected
    if (ex.status === 'approved') {
      if (barcode === ex.oldBarcode) {
        timelineHistory.push({
          action: 'Barcode Exchange Completed (Old Barcode Closed)',
          user: ex.approvedBy || { fullName: 'Store Admin' },
          timestamp: ex.approvedAt || ex.updatedAt,
          remarks: `Old barcode ${ex.oldBarcode} exchanged for new barcode ${ex.newBarcode || 'Pending'} under warranty.`
        });
      } else if (barcode === ex.newBarcode) {
        timelineHistory.push({
          action: 'Barcode Exchange Completed (Replacement Active)',
          user: ex.approvedBy || { fullName: 'Store Admin' },
          timestamp: ex.approvedAt || ex.updatedAt,
          remarks: `New replacement barcode ${ex.newBarcode} activated for old barcode ${ex.oldBarcode} under warranty.`
        });
      }
    } else if (ex.status === 'rejected') {
      timelineHistory.push({
        action: 'Barcode Exchange Rejected',
        user: ex.approvedBy || { fullName: 'Store Admin' },
        timestamp: ex.updatedAt,
        remarks: `Exchange request for old barcode ${ex.oldBarcode} was rejected by store.`
      });
    }
  });
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
    const rejectTime = rejectTimeline?.timestamp || bc.transaction?.updatedAt || bc?.updatedAt || new Date().toISOString();
    const rejectRemarks = rejectTimeline?.remarks || bc.transaction?.rejectionReason;

    timelineHistory.push({
      action: 'Transaction Rejected / Barcode Cancelled',
      user: rejectUser,
      timestamp: rejectTime,
      remarks: `Status: Cancelled. Reason: ${rejectRemarks || 'No reason specified'}`
    });
  }
  timelineHistory.sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    if (Math.abs(timeA - timeB) < 2000) {
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
  });

  const remarksHistory = timelineHistory.filter(h => h.remarks && h.remarks.trim());
  const recentRemark = remarksHistory.length > 0 ? remarksHistory[remarksHistory.length - 1] : null;

  // Aggregate all photos from different forms and stages
  const allPhotos = [];
  const seenPhotoUrls = new Set();
  const addPhoto = (url, lat, lng, address, date, source) => {
    if (!url || typeof url !== 'string' || seenPhotoUrls.has(url)) return;
    seenPhotoUrls.add(url);
    
    let cleanLat = parseFloat(lat);
    let cleanLng = parseFloat(lng);
    if (isNaN(cleanLat) || isNaN(cleanLng)) {
      cleanLat = bc?.gps?.lat ? parseFloat(bc.gps.lat) : NaN;
      cleanLng = bc?.gps?.lng ? parseFloat(bc.gps.lng) : NaN;
    }

    allPhotos.push({
      url,
      lat: cleanLat,
      lng: cleanLng,
      address: address || bc?.gps?.address || '',
      date: date || bc?.createdAt || new Date().toISOString(),
      source
    });
  };

  if (bc?.photos) {
    bc.photos.forEach(p => {
      const url = typeof p === 'string' ? p : p.url;
      const lat = typeof p === 'object' ? p.lat : undefined;
      const lng = typeof p === 'object' ? p.lng : undefined;
      const address = typeof p === 'object' ? p.address : undefined;
      const date = typeof p === 'object' ? (p.capturedAt || p.uploadedAt) : undefined;
      addPhoto(url, lat, lng, address, date, 'Barcode Asset');
    });
  }

  if (bc?.history) {
    bc.history.forEach(log => {
      if (log.photo) {
        addPhoto(log.photo, log.gps?.lat, log.gps?.lng, log.gps?.address, log.timestamp, `History (${log.action})`);
      }
      if (log.metadata && log.metadata.photo) {
        addPhoto(log.metadata.photo, log.gps?.lat, log.gps?.lng, log.gps?.address, log.timestamp, `History (${log.action})`);
      }
      if (log.metadata && Array.isArray(log.metadata.photos)) {
        log.metadata.photos.forEach(p => {
          const url = typeof p === 'string' ? p : p.url;
          addPhoto(url, log.gps?.lat, log.gps?.lng, log.gps?.address, log.timestamp, `History (${log.action})`);
        });
      }
    });
  }

  if (bc?.transaction?.photos) {
    bc.transaction.photos.forEach(p => {
      const url = typeof p === 'string' ? p : p.url;
      const lat = typeof p === 'object' ? p.metadata?.lat : undefined;
      const lng = typeof p === 'object' ? p.metadata?.lng : undefined;
      const address = typeof p === 'object' ? p.metadata?.address : undefined;
      const date = typeof p === 'object' ? (p.metadata?.capturedAt || p.metadata?.date) : undefined;
      addPhoto(url, lat, lng, address, date, 'Transaction Request');
    });
  }

  if (bc?.transaction?.materials) {
    bc.transaction.materials.forEach(mat => {
      const hasBarcode = mat.barcodes?.some(b => {
        const bStr = typeof b === 'string' ? b : (b.barcode || b._id?.toString() || '');
        return bStr === barcode;
      });
      if (hasBarcode && mat.photos) {
        mat.photos.forEach(p => {
          const url = typeof p === 'string' ? p : p.url;
          const lat = typeof p === 'object' ? p.metadata?.lat : undefined;
          const lng = typeof p === 'object' ? p.metadata?.lng : undefined;
          const address = typeof p === 'object' ? p.metadata?.address : undefined;
          const date = typeof p === 'object' ? p.metadata?.capturedAt : undefined;
          addPhoto(url, lat, lng, address, date, 'Dispatch Form');
        });
      }
    });
  }

  transfers.forEach((tr, index) => {
    if (tr.photos) {
      tr.photos.forEach(p => {
        const url = typeof p === 'string' ? p : p.url;
        const date = typeof p === 'object' ? p.capturedAt : undefined;
        addPhoto(url, tr.gps?.lat, tr.gps?.lng, tr.gps?.address, date || tr.createdAt, `Transfer #${transfers.length - index}`);
      });
    }
  });

  returns.forEach((rt, index) => {
    if (rt.photos) {
      rt.photos.forEach(p => {
        const url = typeof p === 'string' ? p : p.url;
        const date = typeof p === 'object' ? p.capturedAt : undefined;
        addPhoto(url, rt.gps?.lat, rt.gps?.lng, rt.gps?.address, date || rt.createdAt, `Return #${returns.length - index}`);
      });
    }
  });

  // Sort photos chronologically so the last one is the most recent
  allPhotos.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const recentPhoto = allPhotos.length > 0 ? allPhotos[allPhotos.length - 1] : null;

  // Aggregate all attachments/documents from different forms and stages
  const allAttachments = [];
  const seenDocUrls = new Set();
  const addAttachment = (name, url, type, size, date, source) => {
    if (!url || typeof url !== 'string' || seenDocUrls.has(url)) return;
    seenDocUrls.add(url);
    allAttachments.push({
      name: name || 'Unnamed Document',
      url,
      type: type || 'document',
      size: size || 0,
      date: date || bc?.createdAt || new Date().toISOString(),
      source
    });
  };

  if (bc?.documents) {
    bc.documents.forEach(doc => {
      addAttachment(doc.name, doc.url, doc.type, doc.size, doc.uploadedAt, 'Barcode Asset');
    });
  }

  if (bc?.transaction?.documents) {
    bc.transaction.documents.forEach(doc => {
      addAttachment(doc.name, doc.url, doc.type, doc.size, doc.uploadedAt, 'Transaction Challan');
    });
  }

  const closeRequestsList = data?.closeRequests || [];
  closeRequestsList.forEach((cr, index) => {
    if (cr.invoiceUrl) {
      const fileName = cr.invoiceUrl.split('/').pop() || `Invoice_Close_Request_${index + 1}.pdf`;
      addAttachment(
        `Invoice - ${fileName}`,
        cr.invoiceUrl,
        'pdf',
        0,
        cr.approvedAt || cr.createdAt,
        `Close Request (Voucher No: ${cr.documentNumber || 'N/A'})`
      );
    }
  });

  allAttachments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const recentDoc = allAttachments.length > 0 ? allAttachments[allAttachments.length - 1] : null;

  const handleAcceptSplit = async () => {
    setAccepting(true);
    try {
      await api.post('/barcodes/accept-split-material', {
        barcode: barcode,
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

  const handleExchangeSubmit = async (e) => {
    e.preventDefault();
    if (!exchangeWarrantyReason.trim()) {
      alert('Please enter a warranty / failure reason.');
      return;
    }
    setExchangeSubmitting(true);
    try {
      await api.post('/barcodes/exchange-request', {
        oldBarcode: barcode,
        warrantyReason: exchangeWarrantyReason
      });
      alert('Exchange request submitted successfully!');
      setExchangeModalOpen(false);
      setExchangeWarrantyReason('');
      refetch();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit exchange request.');
    } finally {
      setExchangeSubmitting(false);
    }
  };

  const material = bc?.transaction?.materials?.find(m =>
    m.barcodes?.some(b => b.barcode === barcode || b === barcode)
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
            {bc?.transactionId ? (
              <span
                onClick={() => bc.transaction && navigate(`/transactions/${bc.transaction._id || bc.transaction}`)}
                className="text-blue-600 hover:underline cursor-pointer font-bold"
              >
                {bc.transactionId}
              </span>
            ) : (
              <span className="text-slate-400 font-medium">Loading Transaction...</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-1 -ml-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-none m-0 font-mono">
              Barcode: {barcode}
            </h1>
          </div>
        </div>

        {/* Actions Panel */}
        <div className="flex items-center gap-2 flex-wrap">
          {bc && showOnlyReturnButton && (
            (userData?.role === 'super_admin' || (userData?.role === 'department_admin' && userData?.departmentAdminType === 'store')) ||
            (bc.owner?._id || bc.owner)?.toString() === userData?._id?.toString()
          ) && (
              !returns ||
              !returns.some(r => ['pending', 'handler_assigned', 'collected', 'store_received'].includes(r.status))
            ) && (
              <Button size="sm" variant="outline" onClick={() => navigate(`/barcodes/${barcode}/return`)}>
                Return Request
              </Button>
            )}
          {bc && showAllButtons && (
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
              !splits ||
              !splits.some(s => s.status === 'pending')
            ) && (
              !exchanges ||
              !exchanges.some(e => e.status === 'pending')
            ) && (
              <>
                <Button size="sm" variant="outline" onClick={() => navigate(`/barcodes/${barcode}/split`)}>
                  Split Serial
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/barcodes/${barcode}/return`)}>
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
                <Button size="sm" variant="outline" onClick={() => setExchangeModalOpen(true)}>
                  Exchange Barcode
                </Button>
                <Button size="sm" onClick={() => navigate(`/barcodes/${barcode}/transfer`)}>
                  Transfer Barcode
                </Button>
              </>
            )}
          {bc && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="font-extrabold text-xs"
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              >
                Export <ChevronDown className="w-3.5 h-3.5 ml-1 inline-block" />
              </Button>
              {exportDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50 py-1.5 text-xs text-left">
                  <button
                    onClick={() => handleExport('excel')}
                    disabled={exporting}
                    className="w-full text-left block px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold disabled:opacity-50"
                  >
                    Export to Excel
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    disabled={exporting}
                    className="w-full text-left block px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold disabled:opacity-50"
                  >
                    Export to PDF
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-650 mb-3" />
          <p className="text-xs font-semibold text-slate-500 tracking-wider">
            Fetching secure barcode Data...
          </p>
        </div>
      ) : error || !data ? (
        <div className="p-5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-3xl text-red-650 dark:text-red-400 text-xs font-bold flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">Error loading barcode details</p>
            <p className="text-[10px] opacity-80 mt-0.5">Please check network connection or verify the barcode serial ID.</p>
          </div>
        </div>
      ) : (
        <>

          {/* Main Details Grid Container */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-stretch">
            {/* Left Card Detail */}
            <div className="flex flex-col justify-center items-start border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl md:w-1/4">
              <span className="text-[10px] text-slate-400 font-extrabold tracking-wider mb-2">Barcode Detail</span>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white font-mono">{bc.barcode}</h2>
                <span className="text-[9px] font-extrabold bg-blue-50 text-blue-600 dark:bg-blue-950/30 px-2 py-0.5 rounded font-mono">
                  {bc.materialName}
                </span>
              </div>
            </div>

            {/* Right Info Grid */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-6 p-1">
              <div>
                <span className="text-[9px] text-slate-400 font-extrabold tracking-wider block mb-1">Material</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">{bc.materialName}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-extrabold tracking-wider block mb-1">Barcode</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs font-mono">{bc.barcode}</span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-extrabold tracking-wider block mb-1">Shares / Owner</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                  {bc.owner?.fullName || 'Stores'}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-extrabold tracking-wider block mb-1">Unit Valuation</span>
                <span className="font-extrabold text-blue-650 dark:text-blue-400 text-xs">
                  {price > 0 ? `₹${price.toLocaleString('en-IN')}` : '₹0'}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-extrabold tracking-wider block mb-1">Transaction Combined Valuation</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs">
                  {bc.transaction?.materials
                    ? `₹${bc.transaction.materials.reduce((sum, m) => sum + ((m.price || 0) * m.quantity), 0).toLocaleString('en-IN')}`
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex flex-col items-start gap-1">
                <span className="text-[9px] text-slate-400 font-extrabold tracking-wider block">Status</span>
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
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wider">Photos</h4>
                    <span
                      onClick={() => navigate(`/barcodes/${barcode}/view-all?tab=photos`)}
                      className="text-[10px] text-blue-650 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                    >
                      View All
                    </span>
                  </div>
                  <div className="flex flex-col gap-4">
                    {!recentPhoto ? (
                      <p className="text-xs text-slate-405 italic mt-1">No photos uploaded</p>
                    ) : (
                      (
                        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                            <img src={recentPhoto.url} alt="Recent Scan" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="text-[10px] text-slate-400 font-bold tracking-wider flex items-center gap-1.5">
                              <span>Photo Location (GPS)</span>
                              <span className="bg-blue-50 text-blue-600 dark:bg-blue-950/30 px-1.5 py-0.5 rounded font-mono text-[8px] normal-case">
                                {recentPhoto.source}
                              </span>
                            </span>
                            {(() => {
                              const pLat = parseFloat(recentPhoto.lat);
                              const pLng = parseFloat(recentPhoto.lng);
                              const hasPCoords = !isNaN(pLat) && !isNaN(pLng);

                              if (hasPCoords) {
                                return (
                                  <>
                                    <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                      {pLat.toFixed(4)}° N, {pLng.toFixed(4)}° E
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-bold tracking-wide">
                                      {recentPhoto.address || 'Captured Location'}
                                    </p>
                                  </>
                                );
                              } else {
                                return <p className="text-[10px] text-slate-400 italic">No GPS coordinates recorded</p>;
                              }
                            })()}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Remarks Panel */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/60">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wider">Remarks</h4>
                    <span
                      onClick={() => navigate(`/barcodes/${barcode}/view-all?tab=remarks`)}
                      className="text-[10px] text-blue-650 dark:text-blue-405 hover:underline font-bold cursor-pointer"
                    >
                      View All
                    </span>
                  </div>
                  {recentRemark ? (
                    <div className="mt-1">
                      <p className="text-xs text-slate-655 dark:text-slate-100 font-semibold leading-relaxed">
                        "{recentRemark.remarks}"
                      </p>
                      <span className="block text-[10px] text-slate-405 font-bold mt-1.5 leading-none">
                        By {recentRemark.user?.fullName || recentRemark.user?.name || recentRemark.user || 'System'} • {recentRemark.action} • {new Date(recentRemark.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 dark:text-slate-100 font-semibold leading-relaxed mt-1">
                      No remarks recorded for this status lot.
                    </p>
                  )}
                </div>

                {/* Attachments Panel */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/60">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-wider">Attachments</h4>
                    <span
                      onClick={() => navigate(`/barcodes/${barcode}/view-all?tab=attachments`)}
                      className="text-[10px] text-blue-650 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                    >
                      View All
                    </span>
                  </div>
                  {allAttachments.length === 0 ? (
                    <p className="text-xs text-slate-405 italic mt-1">No documents</p>
                  ) : (
                    (
                      <div className="flex flex-col gap-1 mt-1">
                        <a href={recentDoc.url} className="text-xs text-blue-650 dark:text-blue-400 hover:underline font-bold" target="_blank" rel="noreferrer">
                          {recentDoc.name}
                        </a>
                        <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">
                          Uploaded {new Date(recentDoc.date).toLocaleDateString()} • {recentDoc.source}
                        </span>
                      </div>
                    )
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
                      if (log.action === 'Return Assignment Declined by Handler' || log.action === 'Return Reassignment Declined by Handler') {
                        return null;
                      }
                      let hasLaterCollected = false;
                      if (log.action.toLowerCase().includes('return requested')) {
                        for (let i = idx + 1; i < timelineHistory.length; i++) {
                          const act = timelineHistory[i].action.toLowerCase();
                          if (act.includes('return requested')) {
                            break;
                          }
                          if (act.includes('return collected') || act.includes('returned to store')) {
                            hasLaterCollected = true;
                            break;
                          }
                        }
                      }
                      if (log.action.toLowerCase().includes('return requested') && hasLaterCollected) {
                        return null;
                      }
                      let hasLaterSplitDecision = false;
                      if (log.action.toLowerCase().includes('split requested')) {
                        for (let i = idx + 1; i < timelineHistory.length; i++) {
                          const act = timelineHistory[i].action.toLowerCase();
                          if (act.includes('split requested')) {
                            break;
                          }
                          if (act.includes('split approved') || act.includes('split rejected')) {
                            hasLaterSplitDecision = true;
                            break;
                          }
                        }
                      }
                      if (log.action.toLowerCase().includes('split requested') && hasLaterSplitDecision) {
                        return null;
                      }
                      const logDate = log.timestamp ? new Date(log.timestamp) : new Date();
                      const isLogDateValid = !isNaN(logDate.getTime());
                      const actionLower = log.action.toLowerCase();
                      const isTransfer = actionLower.includes('transfer');
                      const isReturn = actionLower.includes('return');
                      const isSplit = actionLower.includes('split');
                      const isClose = actionLower.includes('close') || actionLower.includes('closed') || actionLower.includes('approval') || actionLower.includes('upload') || actionLower.includes('conversion');
                      const isRejectedLog = actionLower.includes('reject') || actionLower.includes('cancel');

                      const isExchange = actionLower.includes('exchange');

                      const laterEvents = timelineHistory.slice(idx + 1);
                      const hasLaterCompletion = laterEvents.length > 0;
                      const nextEvent = timelineHistory[idx + 1];
                      const isLaterRejected = nextEvent && (
                        nextEvent.action.toLowerCase().includes('reject') ||
                        nextEvent.action.toLowerCase().includes('decline') ||
                        nextEvent.action.toLowerCase().includes('cancel')
                      );

                      let actionLabel = log.action;
                      let statusLabel = 'COMPLETED';
                      let byLabel = log.user?.fullName || 'System';

                      if (isExchange) {
                        actionLabel = log.action;
                        if (actionLower.includes('requested')) {
                          statusLabel = 'PENDING';
                          byLabel = `Requested by: ${log.user?.fullName || 'Requester'}`;
                        } else if (actionLower.includes('completed') || actionLower.includes('approved')) {
                          statusLabel = 'ACCEPTED';
                          byLabel = `Accepted by: ${log.user?.fullName || 'Store Admin'}`;
                        } else if (actionLower.includes('rejected')) {
                          statusLabel = 'REJECTED';
                          byLabel = `Rejected by: ${log.user?.fullName || 'Store Admin'}`;
                        }
                      } else if (isTransfer) {
                        actionLabel = `${log.action} for ${bc.barcode}`;
                        if (actionLower.includes('accepted') || actionLower.includes('approved')) {
                          statusLabel = 'ACCEPTED';
                          byLabel = `Accepted by: ${log.user?.fullName || 'Operator'}`;
                        } else if (actionLower.includes('rejected')) {
                          statusLabel = 'REJECTED';
                          byLabel = `Rejected by: ${log.user?.fullName || 'Operator'}`;
                        } else {
                          statusLabel = isLaterRejected ? 'REJECTED' : (hasLaterCompletion ? 'ACCEPTED' : 'PENDING');
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
                        if (log.action === 'Split Child Created') {
                          statusLabel = 'ACCEPTED';
                          byLabel = `Created by: ${log.user?.fullName || 'Store Admin'}`;
                        } else if (actionLower.includes('accepted') || actionLower.includes('approved') || actionLower.includes('completed')) {
                          statusLabel = 'ACCEPTED';
                          byLabel = `Accepted by: ${log.user?.fullName || 'Operator'}`;
                        } else if (actionLower.includes('rejected')) {
                          statusLabel = 'REJECTED';
                          byLabel = `Rejected by: ${log.user?.fullName || 'Operator'}`;
                        } else {
                          statusLabel = isLaterRejected ? 'REJECTED' : (hasLaterCompletion ? 'ACCEPTED' : 'PENDING');
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
                        } else if (actionLower.includes('rejected') || actionLower.includes('declined') || actionLower.includes('reject') || actionLower.includes('decline')) {
                          statusLabel = 'REJECTED';
                          byLabel = `Rejected/Declined by: ${log.user?.fullName || 'Operator'}`;
                        } else {
                          statusLabel = isLaterRejected ? 'REJECTED' : (hasLaterCompletion ? 'ACCEPTED' : 'PENDING');
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

                          if (actionLower.includes('requested')) {
                            if (log.action.includes('Via Handler')) {
                              let handlerName = log.metadata?.handlerName;
                              if (!handlerName) {
                                const nextAssigned = timelineHistory.slice(idx + 1).find(laterH =>
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
                                byLabel = `Initiated by: ${log.user?.fullName || 'Operator'} (Handler: ${handlerName})`;
                              }
                            } else {
                              if (statusLabel === 'PENDING') {
                                byLabel = `Pending Return Collection by Store`;
                              } else {
                                byLabel = `Initiated by: ${log.user?.fullName || 'Operator'}`;
                              }
                            }
                          }
                        }
                        if (log.action === 'Return Handler Reassigned') {
                          let handlerName = log.metadata?.handlerName;
                          if (!handlerName && log.remarks?.startsWith('Reassigned return handler to ')) {
                            handlerName = log.remarks.replace('Reassigned return handler to ', '');
                          }
                          if (!handlerName) {
                            handlerName = 'Handler';
                          }
                          const decision = statusLabel === 'ACCEPTED' ? 'Accepted' : (statusLabel === 'REJECTED' ? 'Rejected' : 'Pending');
                          byLabel = `Reassigned to: ${handlerName} (${decision})`;
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
                            <span className="text-[10px] text-slate-800 dark:text-slate-200 font-extrabold tracking-wide">
                              {isLogDateValid ? logDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                            </span>
                            <span className="text-[9px] text-slate-400 block font-bold">
                              {isLogDateValid ? logDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                            </span>
                          </div>

                          {/* Middle: Stepper circle node exactly centered on the line */}
                          <span className={`absolute left-[-22px] top-[4px] w-3 h-3 rounded-full ${circleColor} border-2 border-white dark:border-slate-900 z-10`} />

                          {/* Right side: Action details */}
                          <div className="pl-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 font-sans leading-snug">
                                {actionLabel}
                              </h5>
                              <span className={`text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-sm
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
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic mt-0.5">
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
        </>
      )}

      {/* Barcode Close / DC Conversion Modal */}
      {barcodeCloseModal && (() => {
        const materialName = material?.name || bc?.materialName || 'Unknown Material';
        const isInvoice = barcodeCloseDocType === 'Invoice';
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {isInvoice ? 'Convert Barcode to Invoice' : 'Convert DC Type'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-0.5">
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
                    <span className="block text-slate-500 font-bold tracking-wider mb-1">Target Barcode</span>
                    <span className="block font-mono font-bold text-blue-650 dark:text-blue-450 text-xs mt-0.5">{barcode}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-bold tracking-wider mb-1">Material</span>
                    <span className="block font-sans font-extrabold text-slate-850 dark:text-slate-205 text-xs mt-0.5 truncate">{materialName}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-bold tracking-wider mb-1.5">Target Document Type *</label>
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
                    <label className="block text-slate-500 font-bold tracking-wider mb-1.5">Choose Management Approver *</label>
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
                  <label className="block text-slate-500 font-bold tracking-wider mb-1.5">New Document Number *</label>
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
                  <label className="block text-slate-500 font-bold tracking-wider mb-1.5">Remarks / Reason *</label>
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

      {/* Exchange Barcode Modal */}
      {exchangeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-955/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-wider">Exchange Barcode</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Old Barcode: {barcode}</p>
              </div>
              <button onClick={() => setExchangeModalOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExchangeSubmit} className="flex flex-col gap-4 text-xs font-semibold text-slate-600">

              <div>
                <label className="block text-slate-500 font-bold tracking-wider mb-1.5">Under Warranty Form: Failure Reason *</label>
                <textarea
                  value={exchangeWarrantyReason}
                  onChange={(e) => setExchangeWarrantyReason(e.target.value)}
                  required
                  placeholder="Please describe why this item requires exchange (warranty details/failure reason)..."
                  rows="3"
                  className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-lg px-3 py-2.5 font-semibold focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" type="button" onClick={() => setExchangeModalOpen(false)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={exchangeSubmitting}>
                  {exchangeSubmitting ? 'Submitting...' : 'Submit Exchange'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View All Photos, Remarks & Documents Modal */}
      {viewAllModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl p-6 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">All Process Photos, Remarks & Documents History</h3>
                <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-0.5 font-mono">Barcode: {barcode}</p>
              </div>
              <button onClick={() => setViewAllModalOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable list of process history cards) */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {timelineHistory.slice().reverse().map((log, idx) => {
                // Find associated photo by timestamp or metadata
                const logTime = new Date(log.timestamp).getTime();
                const associatedPhoto = bc.photos?.find(p => {
                  const pTime = new Date(p.capturedAt || p.uploadedAt).getTime();
                  return Math.abs(pTime - logTime) < 10000; // within 10 seconds
                });

                return (
                  <div key={idx} className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 p-4.5 rounded-2xl flex flex-col gap-3">
                    {/* Header: Action Name, User, and Date */}
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="inline-block text-[10px] font-extrabold bg-blue-50 text-blue-600 dark:bg-blue-950/30 px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                          {log.action}
                        </span>
                        <p className="text-[11px] text-slate-500 font-semibold mt-1">
                          By <span className="font-extrabold text-slate-750 dark:text-slate-200">{log.user?.fullName || log.user?.name || log.user || 'System'}</span>
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>

                    {/* Remarks Body */}
                    {log.remarks && (
                      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-150/60 dark:border-slate-800/80 rounded-xl">
                        <p className="text-xs text-slate-655 dark:text-slate-350 italic font-semibold leading-relaxed">
                          "{log.remarks}"
                        </p>
                      </div>
                    )}

                    {/* Associated Photo */}
                    {associatedPhoto && (
                      <div className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-150/60 dark:border-slate-800/80 p-3 rounded-xl">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                          <img src={associatedPhoto.url} alt="Process Upload" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col gap-0.5 text-[10px] text-slate-500">
                          <span className="font-extrabold text-slate-400 text-[9px] uppercase tracking-wider">Process GPS Coordinates</span>
                          {associatedPhoto.lat && associatedPhoto.lng ? (
                            <>
                              <p className="font-mono font-bold text-slate-700 dark:text-slate-200">
                                {parseFloat(associatedPhoto.lat).toFixed(4)}° N, {parseFloat(associatedPhoto.lng).toFixed(4)}° E
                              </p>
                              <p className="text-[9px] text-slate-400 font-bold leading-tight">
                                {associatedPhoto.address || 'Pune, India'}
                              </p>
                            </>
                          ) : (
                            <p className="italic text-slate-400">No location coordinates uploaded.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {timelineHistory.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-8">No process history logs recorded for this barcode.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <Button variant="ghost" onClick={() => setViewAllModalOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
