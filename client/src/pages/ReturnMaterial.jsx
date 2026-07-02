import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Camera } from 'lucide-react';
import api from '../lib/api';
import GeoCamera from '../components/geo-camera/GeoCamera';

export default function ReturnMaterial() {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const [reason, setReason] = useState('');
  const [condition, setCondition] = useState('good');
  const [remarks, setRemarks] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photoMeta, setPhotoMeta] = useState(null);

  const returnMutation = useMutation({
    mutationFn: async (payload) => {
      return api.post('/barcodes/return', payload);
    },
    onSuccess: () => {
      alert('Return request sent to store successfully!');
      navigate(`/barcodes/${barcode}`);
    }
  });

  const handleCapturePhoto = (dataUrl, metadata) => {
    setCapturedPhoto(dataUrl);
    setPhotoMeta(metadata);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason) {
      alert('Please select a reason.');
      return;
    }

    const payload = {
      barcode,
      reason,
      condition,
      remarks,
      gps: photoMeta ? { lat: photoMeta.lat, lng: photoMeta.lng, address: photoMeta.address } : undefined,
      photos: capturedPhoto ? [{ url: capturedPhoto, capturedAt: new Date() }] : undefined
    };

    returnMutation.mutate(payload);
  };

  return (
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold text-slate-800">Return to Store</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Barcode: {barcode}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Reason for Return</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none"
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
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Physical Condition</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none"
          >
            <option value="good">Good / Functional</option>
            <option value="damaged">Damaged</option>
            <option value="needs_repair">Needs Repair</option>
            <option value="defective">Defective</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Remarks (Optional)</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Add extra remarks..."
            rows={3}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none resize-none"
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
