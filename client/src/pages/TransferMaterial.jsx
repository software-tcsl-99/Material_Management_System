import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Camera, Send, FileText } from 'lucide-react';
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
  const [managementApprover, setManagementApprover] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photoMeta, setPhotoMeta] = useState(null);

  // Fetch employees to transfer to
  const { data: employees, isLoading: isEmployeesLoading } = useQuery({
    queryKey: ['employeesList'],
    queryFn: async () => {
      const { data } = await api.get('/employees?limit=1000&allDepartments=true');
      return data.employees || data.data || [];
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

  const selectedRecipient = employees?.find(e => e._id === toUserId);
  const fromDeptId = (user?.department?._id || user?.department || '').toString();
  const toDeptId = (selectedRecipient?.department?._id || selectedRecipient?.department || '').toString();
  const isCrossDept = !!toUserId && !!fromDeptId && !!toDeptId && fromDeptId !== toDeptId;

  const managementUsers = employees?.filter(e => 
    e.role === 'department_admin' && 
    e.departmentAdminType === 'management'
  ) || [];

  const isSplitPending = splits.some(s => s.status === 'pending');
  const isExchangePending = exchanges.some(e => e.status === 'pending');
  const isTransferPending = transfers.some(t => t.status === 'pending');
  const isReturnPending = returns.some(r => ['pending', 'handler_assigned', 'collected', 'store_received'].includes(r.status));
  const isClosePending = bcData?.closeRequest && bcData.closeRequest.documentNumber && ['pending_accounts_approval', 'pending_store_acceptance'].includes(bcData.closeRequest.status);

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
    if (isCrossDept && !managementApprover) {
      alert('Please select a management approver for cross-department transfer.');
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
      remarks: remarks.trim(),
      requiresApproval: isCrossDept || requiresApproval,
      managementApprover: isCrossDept ? managementApprover : undefined,
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
        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-955/20 flex items-center justify-center mx-auto">
          <span className="text-amber-500 font-extrabold text-xl">⚠️</span>
        </div>
        <h2 className="text-base font-extrabold text-slate-800 dark:text-white">Action Blocked</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          This barcode has a pending request (split, return, transfer, exchange, or close) in progress. No other actions can be initiated until it is resolved.
        </p>
        <button
          onClick={() => navigate(`/barcodes/${barcode}`)}
          className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-dark transition cursor-pointer"
        >
          Back to Barcode Details
        </button>
      </div>
    );
  }

  const material = bcData?.transaction?.materials?.find(m =>
    m.barcodes.some(b => b.barcode === barcode)
  );

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in p-2 sm:p-4">
      {/* Header Navigation */}
      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold text-slate-800 dark:text-white">Transfer Material</h1>
          <p className="text-[10px] text-slate-400 font-bold tracking-wider font-mono uppercase mt-0.5 animate-pulse">
            Barcode Transfer Flow • {barcode} {material?.name || bcData?.materialName ? `| Material: ${material?.name || bcData?.materialName} (Qty: ${material?.quantity || 1} ${material?.unit || 'pcs'} - Owner: ${bcData?.owner?.fullName || 'N/A'})` : ''}
          </p>
        </div>
      </div>

      {/* Sourcing Transfer form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6 text-xs font-semibold text-slate-600">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Recipient Employee *</label>
            <select
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 font-semibold focus:outline-none"
              required
            >
              <option value="">Select Recipient</option>
              {employees?.filter(e => e._id !== user?._id && e.role !== 'super_admin').map(e => (
                <option key={e._id} value={e._id}>{e.fullName} ({e.department?.name || 'No Dept'})</option>
              ))}
            </select>
          </div>

          {isCrossDept && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Management Approver *</label>
              <select
                value={managementApprover}
                onChange={(e) => setManagementApprover(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-955 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 font-semibold focus:outline-none"
                required
              >
                <option value="">Select Management Approver</option>
                {managementUsers.map(m => (
                  <option key={m._id} value={m._id}>{m.fullName} ({m.employeeId})</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2.5 bg-blue-50/50 dark:bg-blue-955/20 p-3.5 rounded-xl border border-blue-100/50 dark:border-blue-900/50">
            <input
              type="checkbox"
              id="requiresApproval"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="requiresApproval" className="text-slate-600 dark:text-slate-300 font-bold cursor-pointer select-none">
              Requires Management Approval (Force TL/Department Admin check)
            </label>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Remarks / Reason *</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Provide reason for transfer..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3.5 font-semibold focus:outline-none"
              required
            />
          </div>

          {/* Live Photo Attachment */}
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Live Photo with Metadata Overlay *</label>
            {capturedPhoto ? (
              <div className="relative border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden aspect-video w-64 bg-slate-100 dark:bg-slate-950">
                <img src={capturedPhoto} alt="Captured preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setCapturedPhoto(null)}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black text-white p-1 px-2.5 rounded-xl text-[10px] font-bold transition"
                >
                  Clear
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl transition"
              >
                <Camera className="w-4 h-4 text-blue-600" /> Open GeoCamera
              </button>
            )}
          </div>

          {/* Submit */}
          {transferMutation.isError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-semibold text-rose-455">
              {transferMutation.error?.response?.data?.message || 'Failed to submit transfer request.'}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-355 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-xl transition shadow-md shadow-primary/10 cursor-pointer"
            >
              Send Transfer Request
            </button>
          </div>
        </form>
      </div>

      {cameraOpen && (
        <GeoCamera
          onCapture={handleCapturePhoto}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}
