import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Camera, ShieldCheck } from 'lucide-react';
import api from '../lib/api';
import GeoCamera from '../components/geo-camera/GeoCamera';

export default function TransferMaterial() {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const [toUserId, setToUserId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photoMeta, setPhotoMeta] = useState(null);

  // Fetch employees to transfer to
  const { data: employees } = useQuery({
    queryKey: ['employeesList'],
    queryFn: async () => {
      const { data } = await api.get('/employees?limit=100');
      return data.employees || [];
    }
  });

  const transferMutation = useMutation({
    mutationFn: async (payload) => {
      return api.post('/barcodes/transfer', payload);
    },
    onSuccess: () => {
      alert('Transfer request submitted successfully!');
      navigate(`/barcodes/${barcode}`);
    }
  });

  const handleCapturePhoto = (dataUrl, metadata) => {
    setCapturedPhoto(dataUrl);
    setPhotoMeta(metadata);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!toUserId) {
      alert('Please select a recipient.');
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

  return (
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold text-slate-800">Transfer Material</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Barcode: {barcode}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Recipient Employee</label>
          <select
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none"
            required
          >
            <option value="">Select Recipient</option>
            {employees?.map(e => (
              <option key={e._id} value={e._id}>{e.fullName} ({e.department?.name})</option>
            ))}
          </select>
        </div>


        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Remarks</label>
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
          <label className="block text-[10px] font-bold text-slate-500 uppercase">Live Photo with Metadata Overlay</label>
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
