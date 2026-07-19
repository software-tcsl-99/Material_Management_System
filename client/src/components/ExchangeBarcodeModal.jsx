import { useState } from 'react';
import { Camera, X } from 'lucide-react';
import Button from './ui/Button';
import GeoCamera from './geo-camera/GeoCamera';
import api from '../lib/api';

export default function ExchangeBarcodeModal({
  isOpen,
  onClose,
  oldBarcode,
  bc,
  refetch
}) {
  const [exchangeNewBarcode, setExchangeNewBarcode] = useState('');
  const [exchangeSubmitting, setExchangeSubmitting] = useState(false);
  const [hasNewBarcode, setHasNewBarcode] = useState('no'); // 'yes' | 'no'
  const [exchangePhoto, setExchangePhoto] = useState('');
  const [exchangeAttachment, setExchangeAttachment] = useState(null);
  const [exchangeRemarks, setExchangeRemarks] = useState('');

  if (!isOpen) return null;

  const handleExchangeSubmit = async (e) => {
    e.preventDefault();
    if (!exchangeRemarks.trim()) {
      alert('Please enter remarks / failure reason.');
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
        oldBarcode,
        warrantyReason: reasonCombined,
        newBarcode: hasNewBarcode === 'yes' ? exchangeNewBarcode.trim().toUpperCase() : undefined,
        photos: exchangePhoto ? [{ url: exchangePhoto }] : [],
        gps: { lat: 18.5204, lng: 73.8567, address: 'MIDC Pune, India' }
      });

      alert('Exchange request submitted successfully!');
      onClose();
      setExchangeNewBarcode('');
      setExchangePhoto('');
      setExchangeAttachment(null);
      setExchangeRemarks('');
      setHasNewBarcode('no');
      refetch();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit exchange request.');
    } finally {
      setExchangeSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-955/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white tracking-wider">Exchange Barcode</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Old Barcode: {oldBarcode}</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleExchangeSubmit} className="flex flex-col gap-4 text-xs font-semibold text-slate-600">
            
            {/* Fetched Material Details */}
            <div className="bg-slate-50 dark:bg-slate-955 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1 mb-2 text-[10px]">
              <div className="font-extrabold text-slate-850 dark:text-slate-200">Material Name: <span className="text-blue-600 dark:text-blue-450">{bc?.materialName}</span></div>
              <div className="text-slate-500">Transaction ID: {bc?.transactionId}</div>
              <div className="text-slate-550">Current Status: {bc?.status}</div>
              <div className="text-slate-500">Current Owner: {bc?.owner?.fullName || 'N/A'}</div>
            </div>

            <div>
              <label className="block text-slate-500 font-bold tracking-wider mb-1">Remarks / Failure Reason *</label>
              <textarea
                value={exchangeRemarks}
                onChange={(e) => setExchangeRemarks(e.target.value)}
                required
                placeholder="Please describe why this item requires exchange (warranty details/failure reason)..."
                rows="3.5"
                className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-lg px-3 py-2.5 font-semibold focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-slate-500 font-bold tracking-wider">Do you have the new barcode ID?</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setHasNewBarcode('yes')}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                    hasNewBarcode === 'yes'
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
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                    hasNewBarcode === 'no'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200'
                  }`}
                >
                  No
                </button>
              </div>
            </div>

            {hasNewBarcode === 'yes' && (
              <div className="animate-in slide-in-from-top-2 duration-150">
                <label className="block text-slate-500 font-bold tracking-wider mb-1">Type New Barcode ID *</label>
                <input
                  type="text"
                  value={exchangeNewBarcode}
                  onChange={(e) => setExchangeNewBarcode(e.target.value)}
                  required
                  placeholder="e.g. DG300005"
                  className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-lg px-3 py-2 font-semibold focus:outline-none"
                />
              </div>
            )}

            <GeoCamera
              value={exchangePhoto}
              onCapture={(data) => setExchangePhoto(data ? data.url : '')}
              label="Warranty Verification Photo *"
            />

            <div>
              <label className="block text-slate-500 font-bold tracking-wider mb-1.5">Attachment (e.g. Warranty Card)</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  Choose File
                  <input
                    type="file"
                    onChange={(e) => setExchangeAttachment(e.target.files[0])}
                    className="hidden"
                    accept="*/*"
                  />
                </label>
                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[180px]">
                  {exchangeAttachment ? exchangeAttachment.name : 'No file chosen'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={exchangeSubmitting}>
                {exchangeSubmitting ? 'Submitting...' : 'Submit Exchange'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
