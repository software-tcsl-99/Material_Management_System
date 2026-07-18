import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, Plus, Send, Trash } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GeoCamera from '../components/geo-camera/GeoCamera';
import TallyMaterialAutocomplete from '../components/ui/TallyMaterialAutocomplete';
import api from '../lib/api';

export default function SplitMaterial() {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [requestedMaterialName, setRequestedMaterialName] = useState('');
  const [isOtherPrimaryMaterial, setIsOtherPrimaryMaterial] = useState(false);
  const [extraSplits, setExtraSplits] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photoMeta, setPhotoMeta] = useState(null);

  // Fetch barcode detail
  const { data: detailData, isLoading } = useQuery({
    queryKey: ['barcodeSplitDetail', barcode],
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

  const splitRequestMutation = useMutation({
    mutationFn: async (payload) => {
      // Create main split request
      await api.post('/barcodes/split-request', {
        barcode: payload.barcode,
        reason: payload.reason,
        requestedMaterialName: payload.requestedMaterialName,
        batchId: payload.batchId,
        gps: payload.gps,
        photos: payload.photos
      });

      // Create extra split requests
      if (payload.extraSplits && payload.extraSplits.length > 0) {
        await Promise.all(
          payload.extraSplits.map(item =>
            api.post('/barcodes/split-request', {
              barcode: item.barcode,
              reason: item.reason,
              requestedMaterialName: item.requestedMaterialName,
              batchId: payload.batchId,
              gps: payload.gps,
              photos: payload.photos
            })
          )
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barcodeDetail', barcode] });
      queryClient.invalidateQueries({ queryKey: ['barcodeSplitDetail', barcode] });
      alert('Split request(s) submitted to store successfully!');
      navigate(`/barcodes/${barcode}`);
    },
    onError: (err) => {
      alert(err.response?.data?.message || 'Failed to submit split request.');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Please enter a reason or remark for the split.');
      return;
    }
    if (!requestedMaterialName.trim()) {
      alert('Please select the split material from Tally or choose Other Material.');
      return;
    }
    if (!capturedPhoto) {
      alert('Please capture a GeoCamera photo before sending the split request.');
      return;
    }

    // Validate extra splits have names entered
    for (let i = 0; i < extraSplits.length; i++) {
      if (!extraSplits[i].name.trim()) {
        alert(`Please enter a material name for extra split row #${i + 1}`);
        return;
      }
    }

    splitRequestMutation.mutate({
      barcode,
      reason,
      requestedMaterialName: requestedMaterialName.trim(),
      batchId: `${barcode}-${Date.now()}`,
      gps: photoMeta ? { lat: photoMeta.lat, lng: photoMeta.lng, address: photoMeta.address } : undefined,
      photos: [{ url: capturedPhoto, capturedAt: new Date().toISOString() }],
      extraSplits: extraSplits.map(item => ({
        barcode: barcode,
        reason: reason,
        requestedMaterialName: item.name.trim()
      }))
    });
  };

  const addSplitRow = () => {
    setExtraSplits([...extraSplits, { name: '', isOther: false }]);
  };

  const removeSplitRow = (index) => {
    setExtraSplits(extraSplits.filter((_, i) => i !== index));
  };

  const updateSplitRow = (index, value) => {
    const updated = [...extraSplits];
    updated[index] = { ...updated[index], name: value };
    setExtraSplits(updated);
  };

  const setExtraSplitOther = (index, isOther) => {
    const updated = [...extraSplits];
    updated[index] = { ...updated[index], isOther, name: '' };
    setExtraSplits(updated);
  };

  const handleCapturePhoto = (uploadData) => {
    if (uploadData && typeof uploadData === 'object' && uploadData.url) {
      setCapturedPhoto(uploadData.url);
      setPhotoMeta(uploadData.metadata);
    } else {
      setCapturedPhoto(uploadData);
    }
    setCameraOpen(false);
  };

  if (isLoading) {
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
    <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold text-slate-800 dark:text-white">Request Material Split</h1>
          <p className="text-xs text-slate-500 font-semibold tracking-wider font-mono">
            Primary Barcode: {barcode}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Barcode Box */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <span className="text-[10px] text-primary font-bold tracking-wider block">Primary Split Item</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">Material</span>
              <p className="font-extrabold text-slate-750 dark:text-slate-200 mt-0.5">{bcData?.materialName}</p>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[10px]">Current Owner</span>
              <p className="font-extrabold text-slate-750 dark:text-slate-200 mt-0.5">{bcData?.owner?.fullName}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-500 tracking-wider">Split Material Name *</label>
            {isOtherPrimaryMaterial ? (
              <input
                type="text"
                value={requestedMaterialName}
                onChange={(e) => setRequestedMaterialName(e.target.value)}
                required
                className="w-full text-sm bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3.5 py-2.5 font-semibold"
                placeholder="Type material name not available in Tally"
              />
            ) : (
              <TallyMaterialAutocomplete
                value={requestedMaterialName}
                onChange={(name) => setRequestedMaterialName(name)}
                placeholder="Select material from Tally..."
                className="px-3.5 py-2.5 rounded-xl"
                required
              />
            )}
            <button
              type="button"
              onClick={() => { setIsOtherPrimaryMaterial(!isOtherPrimaryMaterial); setRequestedMaterialName(''); }}
              className="text-[10px] font-bold text-blue-600 hover:underline"
            >
              {isOtherPrimaryMaterial ? 'Choose from Tally instead' : 'Material not in Tally? Choose Other Material'}
            </button>
          </div>

          {/* Extra Materials List nested inside Primary Split Item Box */}
          {extraSplits.map((item, index) => {
            return (
              <div key={index} className="border border-purple-100/70 dark:border-purple-900/40 bg-purple-50/10 dark:bg-purple-950/10 rounded-xl p-4 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => removeSplitRow(index)}
                  className="absolute top-3.5 right-3.5 p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>

                <span className="text-[10px] text-purple-650 dark:text-purple-400 font-bold tracking-wider block">Additional Split Item #{index + 1}</span>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 tracking-wider">Requested New Material Name *</label>
                  {item.isOther ? (
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateSplitRow(index, e.target.value)}
                      required
                      className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                      placeholder="Type material name not available in Tally"
                    />
                  ) : (
                    <TallyMaterialAutocomplete
                      value={item.name}
                      onChange={(name) => updateSplitRow(index, name)}
                      placeholder="Select material from Tally..."
                      className="px-3 py-2.5 rounded-lg"
                      required
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setExtraSplitOther(index, !item.isOther)}
                    className="text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    {item.isOther ? 'Choose from Tally instead' : 'Material not in Tally? Choose Other Material'}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add Button nested inside Primary Split Item Box */}
          <div className="flex justify-start pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={addSplitRow}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add More Materials to Split</span>
            </button>
          </div>
        </div>

        {/* Primary Remark / Reason for Split */}
        <div className="space-y-2 border-t border-slate-150 dark:border-slate-800 pt-5">
          <label className="block text-[10px] font-bold text-slate-500 tracking-wider">Remark / Reason for Split (Applies to all) *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows="4"
            className="w-full text-sm bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3.5 py-3 font-semibold"
            placeholder="Provide reason for split request..."
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-555">GeoCamera Photo *</label>
          {capturedPhoto ? (
            <div className="relative border border-slate-200 rounded-2xl overflow-hidden aspect-video w-64 bg-slate-100">
              <img src={capturedPhoto} alt="Split request proof" className="w-full h-full object-cover" />
              <button type="button" onClick={() => { setCapturedPhoto(null); setPhotoMeta(null); }} className="absolute top-2 right-2 bg-black/60 hover:bg-black text-white p-1 rounded-full text-xs">Clear</button>
            </div>
          ) : (
            <button type="button" onClick={() => setCameraOpen(true)} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-xl transition">
              <Camera className="w-4 h-4 text-primary" /> Open GeoCamera
            </button>
          )}
        </div>

        {/* Submit */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={splitRequestMutation.isPending}
            className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-xl transition shadow-md shadow-primary/10 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{splitRequestMutation.isPending ? 'Sending...' : 'Send Request(s)'}</span>
          </button>
        </div>
      </form>
      {cameraOpen && <GeoCamera onCapture={handleCapturePhoto} onClose={() => setCameraOpen(false)} />}
    </div>
  );
}
