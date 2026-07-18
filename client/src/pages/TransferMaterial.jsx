import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Camera } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GeoCamera from '../components/geo-camera/GeoCamera';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

export default function TransferMaterial() {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [toUserId, setToUserId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photoMeta, setPhotoMeta] = useState(null);

  // Fetch employees to transfer to
  const { data: employees, isLoading: isEmployeesLoading } = useQuery({
    queryKey: ['employeesList'],
    queryFn: async () => {
      const { data } = await api.get('/employees?limit=100');
      return data.employees || [];
    }
  });

  // Fetch barcode detail
  const { data: detailData, isLoading: isBarcodeLoading } = useQuery({
    queryKey: ['barcodeTransferDetail', barcode],
    queryFn: async () => {
      const { data } = await api.get(`/barcodes/${barcode}`);
      return data;
    }
  });

  const bcData = detailData?.barcode;
  const splits = detailData?.splits || [];
  const exchanges = detailData?.exchanges || [];
  const transfers = detailData?.transfers || [];
  const returns = detailData?.returns || [];

  const isSplitPending = splits.some(s => s.status === 'pending');
  const isExchangePending = exchanges.some(e => e.status === 'pending');
  const isTransferPending = transfers.some(t => t.status === 'pending');
  const isReturnPending = returns.some(r => ['pending', 'handler_assigned', 'collected', 'store_received'].includes(r.status));
  const isClosePending = bcData?.closeRequest && ['pending_accounts_approval', 'pending_store_acceptance'].includes(bcData.closeRequest.status);

  const hasPendingAction = isSplitPending || isExchangePending || isTransferPending || isReturnPending || isClosePending;

  const transferMutation = useMutation({
    mutationFn: async (payload) => {
      return api.post('/barcodes/transfer', payload);
    },
    onSuccess: () => {
      alert('Transfer request submitted successfully!');
      navigate(`/barcodes/${barcode}`);
    }
  });

  const handleCapturePhoto = (uploadData) => {
    if (uploadData && typeof uploadData === 'object' && uploadData.url) {
      setCapturedPhoto(uploadData.url);
      setPhotoMeta(uploadData.metadata);
    } else {
      setCapturedPhoto(uploadData);
    }
    setCameraOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!toUserId) {
      alert('Please select a recipient.');
      return;
    }
    if (!remarks.trim()) {
      alert('Please enter a remark or reason for the transfer.');
      return;
    }
    if (!capturedPhoto) {
      alert('Please capture a GeoCamera photo before sending the transfer request.');
      return;
    }

    const payload = {
      barcode,
      toUserId,
      remarks,
      requiresApproval,
      gps: photoMeta ? { lat: photoMeta.lat, lng: photoMeta.lng, address: photoMeta.address } : undefined,
      photos: capturedPhoto ? [{ url: capturedPhoto, capturedAt: new Date() }] : undefined
    };

    transferMutation.mutate(payload);
  };

  if (isBarcodeLoading || isEmployeesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (hasPendingAction) {
    return (
      <div className="max-w-md mx-auto mt-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center mx-auto">
          <span className="text-amber-500 font-extrabold text-xl">⚠️</span>
        </div>
        <h2 className="text-base font-extrabold text-slate-800 dark:text-white">Action Blocked</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This barcode has a pending request (split, return, transfer, exchange, or close) in progress. No other actions can be initiated until it is resolved.
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
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold text-slate-800">Transfer Material</h1>
          <p className="text-xs text-slate-500 font-semibold tracking-wider">
            Barcode: {barcode}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Recipient Employee</label>
          <select
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none"
            required
          >
            <option value="">Select Recipient</option>
            {employees?.filter(e => e._id !== user?._id && e.role !== 'super_admin').map(e => (
              <option key={e._id} value={e._id}>{e.fullName} ({e.department?.name})</option>
            ))}
          </select>
        </div>


        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Reason for transfer..."
            rows={3}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none resize-none"
            required
          />
        </div>

        {/* Live Photo Attachment */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-555">Live Photo with Metadata Overlay *</label>
          {capturedPhoto ? (
            <div className="relative border border-slate-200 rounded-2xl overflow-hidden aspect-video w-64 bg-slate-100">
              <img src={capturedPhoto} alt="Captured preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setCapturedPhoto(null)}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black text-white p-1 rounded-full text-xs"
              >
                Clear
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-xl transition"
            >
              <Camera className="w-4 h-4 text-primary" /> Open GeoCamera
            </button>
          )}
        </div>

        {/* Submit */}
        {transferMutation.isError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400">
            {transferMutation.error?.response?.data?.message || 'Failed to submit transfer request.'}
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-xl transition shadow-md shadow-primary/10"
          >
            Send Transfer Request
          </button>
        </div>
      </form>

      {cameraOpen && (
        <GeoCamera
          onCapture={handleCapturePhoto}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}
