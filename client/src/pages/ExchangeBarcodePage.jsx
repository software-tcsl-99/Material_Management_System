import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Camera } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GeoCamera from '../components/geo-camera/GeoCamera';
import Button from '../components/ui/Button';
import BarcodeScanner from '../components/BarcodeScanner';
import api from '../lib/api';

export default function ExchangeBarcodePage() {
  const { barcode } = useParams();
  const navigate = useNavigate();

  const [exchangeNewBarcode, setExchangeNewBarcode] = useState('');
  const [exchangeSubmitting, setExchangeSubmitting] = useState(false);
  const [hasNewBarcode, setHasNewBarcode] = useState('no'); // 'yes' | 'no'
  const [exchangePhoto, setExchangePhoto] = useState('');
  const [exchangeAttachment, setExchangeAttachment] = useState(null);
  const [exchangeRemarks, setExchangeRemarks] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  // Fetch barcode detail
  const { data: detailData, isLoading, refetch } = useQuery({
    queryKey: ['barcodeExchangeDetail', barcode],
    queryFn: async () => {
      const { data } = await api.get(`/barcodes/${barcode}`);
      return data;
    }
  });

  const bc = detailData?.barcode;
  const splits = detailData?.splits || [];
  const exchanges = detailData?.exchanges || [];
  const transfers = detailData?.transfers || [];
  const returns = detailData?.returns || [];

  const isSplitPending = splits.some(s => s.status === 'pending');
  const isExchangePending = exchanges.some(e => e.status === 'pending');
  const isTransferPending = transfers.some(t => t.status === 'pending');
  const isReturnPending = returns.some(r => ['pending', 'handler_assigned', 'collected', 'store_received'].includes(r.status));
  const isClosePending = bc?.closeRequest && bc.closeRequest.documentNumber && ['pending', 'pending_accounts_approval', 'pending_store_acceptance'].includes(bc.closeRequest.status);

  const isExchanged = bc?.status?.toUpperCase() === 'EXCHANGED';
  const hasPendingAction = isSplitPending || isExchangePending || isTransferPending || isReturnPending || isClosePending || isExchanged;

  const handleExchangeSubmit = async (e) => {
    e.preventDefault();
    if (!exchangeRemarks.trim()) {
      alert('Please enter remarks / failure reason.');
      return;
    }
    if (!exchangePhoto) {
      alert('Please capture a GeoCamera photo before submitting.');
      return;
    }
    if (hasNewBarcode === 'yes' && !exchangeNewBarcode.trim()) {
      alert('Please enter the new barcode ID.');
      return;
    }
    setExchangeSubmitting(true);
    try {
      let uploadedAttachmentUrl = '';
      if (exchangeAttachment) {
        const formData = new FormData();
        formData.append('file', exchangeAttachment);
        const { data } = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploadedAttachmentUrl = data.url;
      }

      const reasonCombined = `Remarks: ${exchangeRemarks.trim()}${uploadedAttachmentUrl ? ` | Attachment: ${uploadedAttachmentUrl}` : ''}`;

      await api.post('/barcodes/exchange-request', {
        oldBarcode: barcode,
        warrantyReason: reasonCombined,
        newBarcode: hasNewBarcode === 'yes' ? exchangeNewBarcode.trim().toUpperCase() : undefined,
        photos: exchangePhoto ? [{ url: exchangePhoto }] : [],
        gps: { lat: 18.5204, lng: 73.8567, address: 'MIDC kolhapur, India' }
      });

      alert('Exchange request submitted successfully!');
      navigate(`/barcodes/${barcode}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit exchange request.');
    } finally {
      setExchangeSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (hasPendingAction) {
    const message = isExchanged
      ? "This barcode has already been exchanged under warranty."
      : "This barcode has a pending request (split, return, transfer, exchange, or close) in progress. No other actions can be initiated until it is resolved.";

    return (
      <div className="max-w-md mx-auto mt-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-955/20 flex items-center justify-center mx-auto">
          <span className="text-amber-500 font-extrabold text-xl">⚠️</span>
        </div>
        <h2 className="text-base font-extrabold text-slate-800 dark:text-white">Action Blocked</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {message}
        </p>
        <button
          onClick={() => navigate(`/barcodes/${barcode}`)}
          className="px-5 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-dark transition cursor-pointer"
        >
          Back to Barcode Details
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold text-slate-800 dark:text-white">Exchange Barcode</h1>
          <p className="text-xs text-slate-500 font-semibold tracking-wider font-mono">
            Old Barcode: {barcode}
          </p>
        </div>
      </div>

      <form onSubmit={handleExchangeSubmit} className="space-y-6 text-xs font-semibold text-slate-600">

        {/* Fetched Material Details */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <span className="text-[10px] text-primary font-bold tracking-wider block">Material Details</span>
          <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">Material Name</span>
              <p className="font-extrabold text-slate-750 dark:text-slate-205 mt-0.5">{bc?.materialName}</p>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">Transaction ID</span>
              <p className="font-extrabold text-slate-750 dark:text-slate-205 mt-0.5">{bc?.transactionId}</p>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">Current Status</span>
              <p className="font-extrabold text-slate-750 dark:text-slate-205 mt-0.5">{bc?.status}</p>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">Current Owner</span>
              <p className="font-extrabold text-slate-750 dark:text-slate-205 mt-0.5">{bc?.owner?.fullName || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Remarks and Failure Reason */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-500 tracking-wider">Remarks / Failure Reason *</label>
          <textarea
            value={exchangeRemarks}
            onChange={(e) => setExchangeRemarks(e.target.value)}
            required
            placeholder="Please describe why this item requires exchange (warranty details/failure reason)..."
            rows="4"
            className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-lg px-3.5 py-3.5 font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* New Barcode Choice */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-500 tracking-wider">Do you have the new barcode ID?</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setHasNewBarcode('yes')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${hasNewBarcode === 'yes'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200'
                }`}
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => {
                setHasNewBarcode('no');
                setExchangeNewBarcode('');
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition ${hasNewBarcode === 'no'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200'
                }`}
            >
              No (Store Admin will assign it)
            </button>
          </div>
        </div>

        {hasNewBarcode === 'yes' && (
          <div className="animate-in slide-in-from-top-2 duration-150 space-y-2">
            <label className="block text-[10px] font-bold text-slate-500 tracking-wider">Scan New Barcode ID *</label>
            <div className="flex gap-2">
              {exchangeNewBarcode ? (
                <div className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs font-mono font-bold flex items-center justify-between min-h-[38px] text-slate-800 dark:text-white">
                  <span>{exchangeNewBarcode}</span>
                  <button
                    type="button"
                    onClick={() => setExchangeNewBarcode('')}
                    className="text-[10px] text-rose-500 hover:text-rose-700 font-extrabold"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="flex-1 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 font-bold flex items-center justify-between min-h-[38px]">
                  <span>No barcode scanned yet</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center transition shadow-sm font-extrabold text-xs flex-shrink-0 h-[38px]"
                title="Open Camera Scanner"
              >
                <Camera className="w-3.5 h-3.5 mr-1" />
                Scan
              </button>
            </div>
          </div>
        )}

        {/* Verification Photo */}
        <GeoCamera
          value={exchangePhoto}
          onCapture={(data) => setExchangePhoto(data ? data.url : '')}
          label="Exchange Verification Photo *"
        />

        {/* File Attachment */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-500 tracking-wider">Attachment (e.g. Warranty Card)</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
              Choose File
              <input
                type="file"
                onChange={(e) => setExchangeAttachment(e.target.files[0])}
                className="hidden"
                accept="*/*"
              />
            </label>
            <span className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]">
              {exchangeAttachment ? exchangeAttachment.name : 'No file chosen'}
            </span>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" type="button" onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={exchangeSubmitting}>
            {exchangeSubmitting ? 'Submitting...' : 'Submit Exchange'}
          </Button>
        </div>
      </form>
      {scannerOpen && (
        <BarcodeScanner
          onScan={(code) => {
            if (code) {
              setExchangeNewBarcode(code.trim().toUpperCase());
            }
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
