import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Paperclip,
  User,
  Calendar
} from 'lucide-react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import api from '../lib/api';

export default function BarcodeViewAll() {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'photos';

  const { data, isLoading, error } = useQuery({
    queryKey: ['barcodeDetail', barcode],
    queryFn: async () => {
      const { data } = await api.get(`/barcodes/${barcode}`);
      return data;
    }
  });

  const bc = data?.barcode;
  const transfers = data?.transfers || [];
  const returns = data?.returns || [];
  const splits = data?.splits || [];
  const exchanges = data?.exchanges || [];

  // Re-build exact timelineHistory matching BarcodeDetail
  const filteredHistory = bc?.history?.filter(log => {
    const actionLower = (log.action || '').toLowerCase();

    // Exclude database-level generic exchange entries, as we will render them dynamically
    if (['exchanged', 'barcode exchanged', 'exchange requested'].includes(actionLower)) {
      return false;
    }

    // Exclude timeline entries referencing a different barcode
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

  exchanges.forEach(ex => {
    if (ex.status === 'pending') {
      timelineHistory.push({
        action: 'Barcode Exchange Requested',
        user: ex.requester,
        timestamp: ex.createdAt,
        remarks: `Warranty exchange requested. Failure reason: ${ex.warrantyReason}`
      });
    }
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

  const remarksList = timelineHistory.filter(log => log.remarks && log.remarks.trim());

  const handleTabChange = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-xs text-slate-405 font-semibold mb-1">
            <span>Transactions</span>
            <ChevronRight className="w-3 h-3" />
            <span
              onClick={() => navigate(`/barcodes/${barcode}`)}
              className="text-blue-650 hover:underline cursor-pointer font-bold font-mono"
            >
              {barcode}
            </span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-405 font-medium">View All Asset Data</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/barcodes/${barcode}`)} className="p-1 -ml-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-905 dark:text-white leading-none m-0 font-mono">
              Barcode History Assets: {barcode}
            </h1>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-650 mb-3" />
          <p className="text-xs font-semibold text-slate-500 tracking-wider">
            Fetching asset list...
          </p>
        </div>
      ) : error || !bc ? (
        <div className="p-5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-3xl text-red-650 dark:text-red-400 text-xs font-bold flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-bold">Error loading barcode details</p>
          </div>
        </div>
      ) : (
        <div className="w-full space-y-6">
          {/* Custom Tabs Navigation */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1.5 p-1 bg-slate-50 dark:bg-slate-950/30 rounded-2xl w-fit">
            <button
              onClick={() => handleTabChange('photos')}
              className={`flex items-center gap-2 px-4.5 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'photos'
                  ? 'bg-white dark:bg-slate-900 text-blue-650 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-800'
                  : 'text-slate-550 hover:text-slate-700 dark:hover:text-slate-350 hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Photos ({bc.photos?.length || 0})
            </button>
            <button
              onClick={() => handleTabChange('remarks')}
              className={`flex items-center gap-2 px-4.5 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'remarks'
                  ? 'bg-white dark:bg-slate-900 text-blue-650 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-800'
                  : 'text-slate-550 hover:text-slate-700 dark:hover:text-slate-350 hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Remarks ({remarksList.length})
            </button>
            <button
              onClick={() => handleTabChange('attachments')}
              className={`flex items-center gap-2 px-4.5 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'attachments'
                  ? 'bg-white dark:bg-slate-900 text-blue-650 dark:text-blue-400 shadow-sm border border-slate-200/50 dark:border-slate-800'
                  : 'text-slate-550 hover:text-slate-700 dark:hover:text-slate-350 hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
              }`}
            >
              <Paperclip className="w-4 h-4" />
              Attachments ({bc.documents?.length || 0})
            </button>
          </div>

          {/* TAB CONTENTS - SHOW ONLY THE SELECTED ASSET LAYER */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm min-h-[300px]">
            {activeTab === 'photos' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-wider border-b border-slate-100 dark:border-slate-850 pb-2">
                  All Uploaded Photos
                </h3>
                {!bc.photos || bc.photos.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-10 text-center">No photos uploaded for this barcode.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bc.photos.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-955/20 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="w-28 h-28 bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                          <img src={p.url} alt={`Scan ${idx + 1}`} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col gap-1 text-xs">
                          <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase">Photo #{idx + 1} GPS Location</span>
                          {(() => {
                            const pLat = p ? parseFloat(p.lat) : NaN;
                            const pLng = p ? parseFloat(p.lng) : NaN;
                            const hasPCoords = !isNaN(pLat) && !isNaN(pLng);
                            const bcLat = bc?.gps ? parseFloat(bc.gps.lat) : NaN;
                            const bcLng = bc?.gps ? parseFloat(bc.gps.lng) : NaN;
                            const hasBcCoords = !isNaN(bcLat) && !isNaN(bcLng);

                            if (hasPCoords) {
                              return (
                                <>
                                  <p className="font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                    {pLat.toFixed(4)}° N, {pLng.toFixed(4)}° E
                                  </p>
                                  <p className="text-[10px] text-slate-505 font-semibold tracking-wide">
                                    {p.address || 'Captured Location'}
                                  </p>
                                </>
                              );
                            } else if (hasBcCoords) {
                              return (
                                <>
                                  <p className="font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                    {bcLat.toFixed(4)}° N, {bcLng.toFixed(4)}° E
                                  </p>
                                  <p className="text-[10px] text-slate-505 font-semibold tracking-wide">
                                    {bc.gps.address || 'Recorded GPS Location'}
                                  </p>
                                </>
                              );
                            } else {
                              return <p className="text-[10px] text-slate-400 italic">No GPS coordinates recorded</p>;
                            }
                          })()}
                          <span className="text-[9px] text-slate-405 font-bold font-mono mt-1.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(p.capturedAt || p.uploadedAt || bc.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'remarks' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-wider border-b border-slate-100 dark:border-slate-850 pb-2">
                  All History Remarks
                </h3>
                {remarksList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-10 text-center">No remarks recorded for this barcode.</p>
                ) : (
                  <div className="space-y-4">
                    {remarksList.slice().reverse().map((log, idx) => (
                      <div key={idx} className="bg-slate-50/50 dark:bg-slate-955/20 border border-slate-100 dark:border-slate-800 p-4.5 rounded-2xl flex flex-col gap-2.5">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <span className="inline-block text-[10px] font-extrabold bg-blue-50 text-blue-600 dark:bg-blue-950/30 px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                              {log.action}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-505 font-semibold mt-1">
                              <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                              <span>By <span className="font-extrabold text-slate-700 dark:text-slate-200">{log.user?.fullName || log.user?.name || log.user || 'System'}</span></span>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold font-mono">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-150/60 dark:border-slate-800/80 rounded-xl">
                          <p className="text-xs text-slate-655 dark:text-slate-300 italic font-semibold leading-relaxed">
                            "{log.remarks}"
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'attachments' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-wider border-b border-slate-100 dark:border-slate-850 pb-2">
                  All Uploaded Attachments
                </h3>
                {!bc.documents || bc.documents.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-10 text-center">No documents uploaded for this barcode.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bc.documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-955/20 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-650 dark:text-blue-400 hover:underline font-bold block truncate"
                          >
                            {doc.name}
                          </a>
                          <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 font-mono">
                            Uploaded: {new Date(doc.uploadedAt || bc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
