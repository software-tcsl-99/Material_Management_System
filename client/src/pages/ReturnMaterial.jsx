import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Camera } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GeoCamera from '../components/geo-camera/GeoCamera';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

export default function ReturnMaterial() {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [reason, setReason] = useState('');
  const [condition, setCondition] = useState('good');
  const [remarks, setRemarks] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photoMeta, setPhotoMeta] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [returnMethod, setReturnMethod] = useState('direct'); // 'direct' or 'handler'
  const [handlerId, setHandlerId] = useState('');
  const [handlerSearchQuery, setHandlerSearchQuery] = useState('');
  const [handlerDropdownOpen, setHandlerDropdownOpen] = useState(false);

  React.useEffect(() => {
    api.get('/employees?limit=1000&allDepartments=true')
      .then(res => {
        const empList = res.data.employees || res.data.data || [];
        setEmployees(empList);
      })
      .catch(err => console.error('Error loading employees:', err));
  }, []);

  React.useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!event.target.closest('.handler-dropdown-container')) {
        setHandlerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredHandlers = employees.filter(emp => {
    if (emp.role === 'super_admin' || emp._id === user?._id) return false;
    const term = handlerSearchQuery.toLowerCase();
    return (
      emp.fullName.toLowerCase().includes(term) ||
      emp.employeeId.toLowerCase().includes(term)
    );
  });

  // Fetch barcode detail
  const { data: detailData, isLoading: isBarcodeLoading } = useQuery({
    queryKey: ['barcodeReturnDetail', barcode],
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
  const isExchanged = bcData?.status?.toUpperCase() === 'EXCHANGED';

  const hasPendingAction = isSplitPending || isExchangePending || isTransferPending || isReturnPending || isClosePending || isExchanged;

  const returnMutation = useMutation({
    mutationFn: async (payload) => {
      return api.post('/barcodes/return', payload);
    },
    onSuccess: () => {
      alert('Return request sent successfully!');
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
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason) {
      alert('Please select a reason.');
      return;
    }
    if (returnMethod === 'handler' && !handlerId) {
      alert('Please select a sourcing handler.');
      return;
    }
    if (!remarks || !remarks.trim()) {
      alert('Remarks / Details are required.');
      return;
    }
    if (!capturedPhoto) {
      alert('Please capture a GeoCamera photo before submitting.');
      return;
    }

    const payload = {
      barcode,
      reason,
      condition,
      remarks,
      returnHandler: returnMethod === 'handler' ? handlerId : undefined,
      gps: photoMeta ? { lat: photoMeta.lat, lng: photoMeta.lng, address: photoMeta.address } : undefined,
      photos: capturedPhoto ? [{ url: capturedPhoto, capturedAt: new Date() }] : undefined
    };

    returnMutation.mutate(payload);
  };

  if (isBarcodeLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (hasPendingAction) {
    const message = isExchanged
      ? "This barcode has already been exchanged under warranty and cannot be returned."
      : "This barcode has a pending request (split, return, transfer, exchange, or close) in progress. No other actions can be initiated until it is resolved.";

    return (
      <div className="max-w-md mx-auto mt-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center mx-auto">
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
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold text-slate-800">Return to Store</h1>
          <p className="text-xs text-slate-500 font-semibold tracking-wider">
            Barcode: {barcode}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Reason for Return</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none font-semibold"
            required
          >
            <option value="">Select Reason</option>
            <option value="Project Completed">Project Completed</option>
            <option value="Damaged / Needs Repair">Damaged / Needs Repair</option>
            <option value="Defective Unit Replacement">Defective Unit Replacement</option>
            <option value="Incorrect Specification Sourced">Incorrect Specification Sourced</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Physical Condition</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none font-semibold"
          >
            <option value="good">Good / Functional</option>
            <option value="damaged">Damaged</option>
            <option value="needs_repair">Needs Repair</option>
            <option value="defective">Defective</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Remarks (Optional)</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Add extra remarks..."
            rows={3}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none resize-none font-semibold"
          />
        </div>

        {/* Logistics Delivery Option */}
        <div className="space-y-3">
          <label className="block text-[10px] font-bold text-slate-500 tracking-wider mb-1.5">
            Logistics Delivery Option *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={`flex flex-col p-3 border rounded-2xl cursor-pointer transition text-xs font-semibold ${returnMethod === 'direct' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="radio"
                  name="returnMethod"
                  value="direct"
                  checked={returnMethod === 'direct'}
                  onChange={() => {
                    setReturnMethod('direct');
                    setHandlerId('');
                  }}
                  className="accent-primary"
                />
                <span className="font-bold">Direct Return (Bypass Handler)</span>
              </div>
              <span className="text-[10px] text-slate-400 pl-5">
                You will personally deliver the material back to the store.
              </span>
            </label>

            <label className={`flex flex-col p-3 border rounded-2xl cursor-pointer transition text-xs font-semibold ${returnMethod === 'handler' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="radio"
                  name="returnMethod"
                  value="handler"
                  checked={returnMethod === 'handler'}
                  onChange={() => setReturnMethod('handler')}
                  className="accent-primary"
                />
                <span className="font-bold">Assign Sourcing Handler</span>
              </div>
              <span className="text-[10px] text-slate-400 pl-5">
                Assign an employee to collect and deliver it to the store.
              </span>
            </label>
          </div>
        </div>

        {returnMethod === 'handler' && (
          <div className="pt-2 animate-in slide-in-from-top-2 duration-200">
            <label className="block text-slate-500 font-bold tracking-wider mb-1.5 text-[10px]">
              Select Sourcing Handler *
            </label>
            <div className="relative handler-dropdown-container">
              <button
                type="button"
                onClick={() => setHandlerDropdownOpen(!handlerDropdownOpen)}
                className="w-full flex justify-between items-center text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-primary transition text-left text-slate-855"
              >
                <span>
                  {handlerId
                    ? (employees.find(e => e._id === handlerId)
                      ? `${employees.find(e => e._id === handlerId).fullName} (${employees.find(e => e._id === handlerId).employeeId})`
                      : 'Select Sourcing Handler')
                    : 'Select Sourcing Handler'}
                </span>
                <span className="text-slate-400">▼</span>
              </button>

              {handlerDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 flex flex-col max-h-60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-2 border-b border-slate-100 shrink-0">
                    <input
                      type="text"
                      value={handlerSearchQuery}
                      onChange={(e) => setHandlerSearchQuery(e.target.value)}
                      placeholder="Search handler..."
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-semibold focus:outline-none focus:border-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  <div className="overflow-y-auto flex-1 py-1">
                    {filteredHandlers.length > 0 ? (
                      filteredHandlers.map(emp => (
                        <button
                          key={emp._id}
                          type="button"
                          onClick={() => {
                            setHandlerId(emp._id);
                            setHandlerDropdownOpen(false);
                            setHandlerSearchQuery('');
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-slate-50 cursor-pointer block transition ${emp._id === handlerId ? 'bg-primary/5 text-primary font-bold' : 'text-slate-705'}`}
                        >
                          {emp.fullName} ({emp.employeeId})
                        </button>
                      ))
                    ) : (
                      <div className="p-3.5 text-xs text-slate-400 font-bold text-center">
                        No employees found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Photo Attachment */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-500">Live Photo with Metadata Overlay</label>
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
        {returnMutation.isError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400">
            {returnMutation.error?.response?.data?.message || 'Failed to submit return request.'}
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
            Send Return Request
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
