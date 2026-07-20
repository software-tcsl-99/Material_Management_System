import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Camera, Paperclip, Trash2, X, FileText } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GeoCamera from '../components/geo-camera/GeoCamera';
import api from '../lib/api';

export default function ReceivingForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'receive';
  const requestedReturnIds = searchParams.get('returnIds')?.split(',').filter(Boolean) || [];
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraBarcode, setCameraBarcode] = useState(null);
  const [barcodeEvidence, setBarcodeEvidence] = useState({});
  const [commonRemark, setCommonRemark] = useState('');
  const [commonDocuments, setCommonDocuments] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

  // Fetch transaction details
  const { data: txnData, isLoading, error } = useQuery({
    queryKey: ['transactionDetail', id],
    queryFn: async () => {
      const { data } = await api.get(`/transactions/${id}`);
      return data.transaction;
    }
  });

  const receiveMutation = useMutation({
    mutationFn: async (payload) => {
      if (mode === 'handler-pickup') {
        return api.patch(`/transactions/${id}/handler-action`, { actionType: 'collect', ...payload });
      }
      if (mode === 'store-return') {
        return Promise.all(payload.receipts.map(receipt => api.put(`/barcodes/return/${receipt.returnId}/accept`, { receipt })));
      }
      if (mode === 'transfer-accept') {
        const transferId = searchParams.get('transferId');
        const r = payload.receipts[0];
        const transferPayload = {
          transferId,
          action: 'accept',
          reason: r.remarks || 'Transfer accepted',
          photos: r.photos || [],
          gps: r.gps || { lat: 18.5204, lng: 73.8567, address: 'MIDC kolhapur, India' }
        };
        return api.post('/barcodes/handle-transfer', transferPayload);
      }
      return api.patch(`/transactions/${id}/receive`, payload);
    },
    onSuccess: () => {
      alert(mode === 'handler-pickup' ? 'Handler collection recorded successfully!' : mode === 'store-return' ? 'Returned materials accepted by store!' : mode === 'transfer-accept' ? 'Transfer accepted successfully!' : 'Materials successfully received!');
      navigate(`/transactions/${txnData.transactionId}`);
    }
  });

  const { data: barcodes = [] } = useQuery({
    queryKey: ['transactionReceivingBarcodes', txnData?.transactionId],
    queryFn: async () => {
      const { data } = await api.get(`/barcodes/transaction/${txnData.transactionId}`);
      return data.barcodes || [];
    },
    enabled: !!txnData?.transactionId
  });

  const { data: returnRequests = [] } = useQuery({
    queryKey: ['receivingReturnRequests', txnData?.transactionId, requestedReturnIds.join(',')],
    queryFn: async () => {
      const { data } = await api.get('/barcodes/list/returns');
      const allReturns = data.returns || data.data || [];
      return allReturns.filter(returnRequest =>
        requestedReturnIds.length
          ? requestedReturnIds.includes(returnRequest._id)
          : returnRequest.transactionId === txnData.transactionId && returnRequest.status === 'store_received'
      );
    },
    enabled: mode === 'store-return' && !!txnData?.transactionId
  });

  const targetBarcode = searchParams.get('barcode');
  const formItems = mode === 'store-return'
    ? returnRequests.map(returnRequest => ({
      barcode: returnRequest.barcode,
      materialName: barcodes.find(barcode => barcode.barcode === returnRequest.barcode)?.materialName || 'Returned Material',
      owner: returnRequest.fromUser,
      returnId: returnRequest._id
    }))
    : mode === 'transfer-accept'
      ? barcodes.filter(b => b.barcode === targetBarcode)
      : barcodes;

  const formTitle = mode === 'handler-pickup'
    ? 'Handler Material Collection'
    : mode === 'store-return'
      ? 'Receive Returned Materials'
      : mode === 'transfer-accept'
        ? 'Accept Material Transfer'
        : 'Receive Materials';

  const updateEvidence = (barcode, changes) => {
    setBarcodeEvidence(current => ({
      ...current,
      [barcode]: {
        condition: 'good',
        photos: [],
        documents: [],
        ...current[barcode],
        ...changes
      }
    }));
  };

  const handleCapturePhoto = (uploadData) => {
    if (!cameraBarcode || !uploadData?.url) return;
    const current = barcodeEvidence[cameraBarcode] || { photos: [] };
    updateEvidence(cameraBarcode, {
      photos: [...(current.photos || []), { url: uploadData.url, capturedAt: new Date().toISOString() }],
      gps: uploadData.metadata ? { lat: uploadData.metadata.lat, lng: uploadData.metadata.lng, address: uploadData.metadata.address } : undefined
    });
    setCameraOpen(false);
    setCameraBarcode(null);
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
    if (!formItems.length) {
      alert(mode === 'store-return' ? 'No return materials are ready for store receipt.' : 'No dispatched barcodes were found for this transaction.');
      return;
    }
    if (!commonRemark.trim()) {
      alert('Please enter the common receiving remark before proceeding.');
      return;
    }
    const receipts = formItems.map(item => ({
      barcode: item.barcode,
      returnId: item.returnId,
      remarks: commonRemark.trim(),
      ...(barcodeEvidence[item.barcode] || {}),
      documents: commonDocuments
    }));
    const missingEvidence = receipts.find(receipt => !receipt.photos?.length);
    if (missingEvidence) return alert(`A GeoCamera photo is required for barcode ${missingEvidence.barcode}.`);

    const payload = {
      materialCondition: 'per_barcode',
      remarks: mode === 'handler-pickup' ? 'Per-barcode handler collection verification completed.' : 'Per-barcode receiving verification completed.',
      receipts
    };

    receiveMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !txnData) {
    return (
      <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-danger text-sm font-semibold flex items-center gap-2">
        <AlertCircle className="w-5 h-5" /> Error loading transaction.
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
          <h1 className="text-lg font-extrabold text-slate-800">{formTitle}</h1>
          <p className="text-xs text-slate-500 font-semibold tracking-wider">
            Transaction ID: {txnData.transactionId}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-extrabold text-slate-800 tracking-wider">Per-Barcode {mode === 'handler-pickup' ? 'Collection' : 'Receiving'} Verification</h3>
            <p className="text-[10px] text-slate-400 mt-1">Each material needs its own condition, GeoCamera proof, and optional attachment.</p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500">Common Receiving Remark / Purpose *</label>
            <textarea value={commonRemark} onChange={(e) => setCommonRemark(e.target.value)} required rows="3" placeholder="Add one common remark for all listed materials..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none resize-none" />
          </div>
          {formItems.map(bc => {
            const evidence = barcodeEvidence[bc.barcode] || { condition: 'good', photos: [], documents: [] };
            return (
              <div key={bc.barcode} className="border border-slate-200 rounded-2xl p-4 space-y-4 bg-slate-50/50">
                <div className="flex justify-between gap-3 text-xs">
                  <div>
                    <p className="font-mono font-extrabold text-slate-800">{bc.barcode}</p>
                    <p className="text-slate-500 font-semibold">{bc.materialName}</p>
                  </div>
                  <span className="text-[10px] text-slate-400">Owner: {bc.owner?.fullName || txnData.requester?.fullName || 'Requester'}</span>
                </div>
                <div className="relative">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Material Condition</label>
                  <select value={evidence.condition} onChange={(e) => updateEvidence(bc.barcode, { condition: e.target.value })} className="w-full appearance-none bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-primary">
                    <option value="good">Good / Perfect Condition</option><option value="damaged">Minor Box Damage</option><option value="needs_repair">Unit Defective</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 bottom-2.5 text-slate-400 text-[10px]">▼</span>
                </div>

                {/* Live Photo Grid for this specific barcode */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="block text-[10px] text-slate-500 font-bold tracking-wider">
                      Live Photo Verification ({evidence.photos.length}) *
                    </span>
                    <button
                      type="button"
                      onClick={() => { setCameraBarcode(bc.barcode); setCameraOpen(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Camera className="w-3.5 h-3.5" /> Capture Live Photo
                    </button>
                  </div>

                  {evidence.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2.5">
                      {evidence.photos.map((photo, pIdx) => (
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
                                const updatedPhotos = evidence.photos.filter((_, i) => i !== pIdx);
                                updateEvidence(bc.barcode, { photos: updatedPhotos });
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
              </div>
            );
          })}
        </div>

        {/* Global Document Upload Section */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <div>
            <h4 className="text-xs font-extrabold text-slate-800 tracking-wider flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-primary" />
              Upload Dispatch Documents / Attachments (PDF/Word/Images)
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Attach documents applicable to the entire materials batch (Multiple files allowed).</p>
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
                            className="w-full h-full flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold gap-1"
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

        {cameraOpen && (
          <GeoCamera
            triggerOnly={true}
            onCapture={handleCapturePhoto}
            onClose={() => setCameraOpen(false)}
          />
        )}

        {/* Submit */}
        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-xl transition shadow-md shadow-primary/10 cursor-pointer"
          >
            {mode === 'handler-pickup' ? 'Accept & Collect Materials' : mode === 'store-return' ? 'Accept Returned Materials' : mode === 'transfer-accept' ? 'Confirm & Accept Transfer' : 'Accept Materials & submit'}
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
