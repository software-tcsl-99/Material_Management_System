import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Camera } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GeoCamera from '../components/geo-camera/GeoCamera';
import api from '../lib/api';

export default function ReceivingForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [condition, setCondition] = useState('good');
  const [remarks, setRemarks] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photoMeta, setPhotoMeta] = useState(null);

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
      // Direct update transaction to active/received
      return api.put(`/transactions/${id}/approve`, { remarks: 'Received materials from handler' });
    },
    onSuccess: () => {
      alert('Materials successfully received!');
      navigate(`/transactions/${txnData.transactionId}`);
    }
  });

  const handleCapturePhoto = (dataUrl, metadata) => {
    setCapturedPhoto(dataUrl);
    setPhotoMeta(metadata);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!capturedPhoto) {
      alert('GEO-tagged verification photo is mandatory to accept delivery.');
      return;
    }

    const payload = {
      condition,
      remarks,
      gps: { lat: photoMeta.lat, lng: photoMeta.lng, address: photoMeta.address },
      photo: capturedPhoto
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
          <h1 className="text-lg font-extrabold text-slate-800">Receive Materials</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Transaction ID: {txnData.transactionId}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Dispatched items list summary */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Dispatched Items checklist</h3>
          <div className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
            {txnData.materials?.map((m, idx) => (
              <div key={idx} className="py-2 flex justify-between">
                <span>{m.name}</span>
                <span className="text-slate-400">Qty: {m.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Physical Condition</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none"
          >
            <option value="good">Good / Perfect Condition</option>
            <option value="damaged">Minor Box Damage</option>
            <option value="needs_repair">Unit Defective</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Remarks / Verification notes</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Add any remarks..."
            rows={3}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none resize-none"
          />
        </div>

        {/* Live Photo Attachment */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase">GEO-Tagged Delivery Verification Photo (Mandatory)</label>
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
              <Camera className="w-4 h-4 text-primary" /> Capture Verification Photo
            </button>
          )}
        </div>

        {/* Submit */}
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
            Accept Materials & Sign Delivery
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
