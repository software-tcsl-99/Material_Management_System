import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Camera, FileText, Trash2, X, Paperclip } from 'lucide-react';
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
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [commonDocuments, setCommonDocuments] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

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

  const isNewExchangedBarcode = bcData?.history?.some(h => h.action === 'Exchange Child Created');
  const receivedLog = bcData?.history?.find(h => h.action === 'Received');
  const receivedTime = receivedLog ? new Date(receivedLog.timestamp) : new Date(bcData?.updatedAt || Date.now());
  const timeElapsedMs = Date.now() - receivedTime.getTime();
  const hasPassedOneHour = timeElapsedMs > 60 * 60 * 1000;

  React.useEffect(() => {
    if (bcData) {
      const isNewEx = bcData.history?.some(h => h.action === 'Exchange Child Created');
      if (isNewEx) {
        setReason('Defective Unit Replacement');
        setCondition('defective');
      } else {
        const recLog = bcData.history?.find(h => h.action === 'Received');
        const recTime = recLog ? new Date(recLog.timestamp) : new Date(bcData.updatedAt || Date.now());
        const passed = (Date.now() - recTime.getTime()) > 3600000;
        if (passed) {
          setReason('Project Completed');
          setCondition('good');
        }
      }
    }
  }, [bcData]);

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
      setCapturedPhotos(prev => [...prev, {
        url: uploadData.url,
        capturedAt: new Date().toISOString(),
        metadata: uploadData.metadata
      }]);
      setCameraOpen(false);
    }
  };

  const handleCommonAttachment = async (file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setCommonDocuments(prev => [...prev, {
        name: file.name,
        url: data.url,
        type: file.type || 'document',
        size: file.size,
        uploadedAt: new Date().toISOString()
      }]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to upload attachment.');
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
    if (!capturedPhotos.length) {
      alert('Please capture a GeoCamera photo before submitting.');
      return;
    }

    const payload = {
      barcode,
      reason,
      condition,
      remarks,
      returnHandler: returnMethod === 'handler' ? handlerId : undefined,
      gps: capturedPhotos[0]?.metadata ? {
        lat: capturedPhotos[0].metadata.lat,
        lng: capturedPhotos[0].metadata.lng,
        address: capturedPhotos[0].metadata.address
      } : { lat: 18.5204, lng: 73.8567, address: 'MIDC Pune, India' },
      photos: capturedPhotos.map(p => ({ url: p.url, capturedAt: p.capturedAt })),
      documents: commonDocuments
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
        {!isNewExchangedBarcode && (
          <>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Reason for Return</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none font-semibold"
                required
              >
                {hasPassedOneHour ? (
                  <option value="Project Completed">Project Completed</option>
                ) : (
                  <>
                    <option value="">Select Reason</option>
                    <option value="Project Completed">Project Completed</option>
                    <option value="Damaged / Needs Repair">Damaged / Needs Repair</option>
                    <option value="Defective Unit Replacement">Defective Unit Replacement</option>
                    <option value="Incorrect Specification Sourced">Incorrect Specification Sourced</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Physical Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none font-semibold"
              >
                {hasPassedOneHour ? (
                  <option value="good">Good / Functional</option>
                ) : (
                  <>
                    <option value="good">Good / Functional</option>
                    <option value="damaged">Damaged</option>
                    <option value="needs_repair">Needs Repair</option>
                    <option value="defective">Defective</option>
                  </>
                )}
              </select>
            </div>
          </>
        )}

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

        {/* Photos and Documents Dynamic Box Layout */}
        <div className="space-y-4 pt-2">
          {/* Live Photo Grid */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="block text-[10px] text-slate-500 font-bold tracking-wider">
                Live Photo Verification ({capturedPhotos.length}) *
              </span>
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <Camera className="w-3.5 h-3.5" /> Capture Live Photo
              </button>
            </div>

            {capturedPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2.5">
                {capturedPhotos.map((photo, pIdx) => (
                  <div key={pIdx} className="flex flex-col items-center gap-1">
                    <div className="relative w-24 h-24 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                      <img
                        src={photo.url}
                        alt="Captured evidence"
                        className="w-full h-full object-cover cursor-pointer hover:opacity-85 transition"
                        onClick={() => setPreviewImage(photo.url)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCapturedPhotos(prev => prev.filter((_, i) => i !== pIdx));
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition cursor-pointer"
                        title="Delete Photo"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <span className="text-[9px] text-slate-500 font-bold text-center truncate w-24">
                      Capture {pIdx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Document Upload Section */}
          <div className="border-t border-slate-105 pt-4 space-y-3">
            <div>
              <h4 className="text-xs font-extrabold text-slate-800 dark:text-white tracking-wider flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-primary" />
                Upload Dispatch Documents / Attachments (PDF/Word/Images)
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Attach documents applicable to this return (Multiple files allowed).</p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <label className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-extrabold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                <Paperclip className="w-4 h-4 text-primary" />
                Add Attachment
                <input
                  type="file"
                  accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => handleCommonAttachment(e.target.files?.[0])}
                />
              </label>
            </div>

            {commonDocuments.length > 0 && (
              <div className="space-y-1">
                <span className="block text-[9px] font-bold text-slate-450 tracking-wider">
                  Uploaded Attachments ({commonDocuments.length})
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {commonDocuments.map((doc, docIdx) => {
                    const urlLower = doc.url.toLowerCase();
                    const ext = urlLower.split('.').pop().split('?')[0];
                    const isImg = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext) || urlLower.startsWith('data:image');
                    return (
                      <div key={docIdx} className="flex flex-col items-center gap-1">
                        <div className="relative w-24 h-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex items-center justify-center">
                          {isImg ? (
                            <img
                              src={doc.url}
                              alt={doc.name || `Document ${docIdx + 1}`}
                              className="w-full h-full object-cover cursor-pointer hover:opacity-85 transition"
                              onClick={() => setPreviewImage(doc.url)}
                            />
                          ) : (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full h-full flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-955/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold gap-1"
                              title="Click to view file"
                            >
                              <FileText className="w-6 h-6" />
                              {ext.toUpperCase().substring(0, 4)}
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setCommonDocuments(prev => prev.filter((_, i) => i !== docIdx))}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition cursor-pointer"
                            title="Delete File"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <span className="text-[9px] text-slate-500 font-bold text-center truncate w-24" title={doc.name}>
                          {doc.name || `Doc ${docIdx + 1}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {cameraOpen && (
          <GeoCamera
            triggerOnly={true}
            onCapture={handleCapturePhoto}
            onClose={() => setCameraOpen(false)}
          />
        )}

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
      {/* Full-screen Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] p-2" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/85 text-white rounded-full transition-colors cursor-pointer z-10"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
