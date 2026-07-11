import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Plus, Trash } from 'lucide-react';
import api from '../lib/api';

export default function SplitMaterial() {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [requestedMaterialName, setRequestedMaterialName] = useState('');
  const [extraSplits, setExtraSplits] = useState([]); // array of strings (material names)

  // Fetch barcode detail
  const { data: bcData, isLoading } = useQuery({
    queryKey: ['barcodeSplitDetail', barcode],
    queryFn: async () => {
      const { data } = await api.get(`/barcodes/${barcode}`);
      return data.barcode;
    }
  });

  const splitRequestMutation = useMutation({
    mutationFn: async (payload) => {
      // Create main split request
      await api.post('/barcodes/split-request', {
        barcode: payload.barcode,
        reason: payload.reason,
        requestedMaterialName: payload.requestedMaterialName
      });

      // Create extra split requests
      if (payload.extraSplits && payload.extraSplits.length > 0) {
        await Promise.all(
          payload.extraSplits.map(item =>
            api.post('/barcodes/split-request', {
              barcode: item.barcode,
              reason: item.reason,
              requestedMaterialName: item.requestedMaterialName
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

    // Validate extra splits have names entered
    for (let i = 0; i < extraSplits.length; i++) {
      if (!extraSplits[i].trim()) {
        alert(`Please enter a material name for extra split row #${i + 1}`);
        return;
      }
    }

    splitRequestMutation.mutate({
      barcode,
      reason,
      requestedMaterialName,
      extraSplits: extraSplits.map(name => ({
        barcode: barcode,
        reason: reason,
        requestedMaterialName: name.trim()
      }))
    });
  };

  const addSplitRow = () => {
    setExtraSplits([...extraSplits, '']);
  };

  const removeSplitRow = (index) => {
    setExtraSplits(extraSplits.filter((_, i) => i !== index));
  };

  const updateSplitRow = (index, value) => {
    const updated = [...extraSplits];
    updated[index] = value;
    setExtraSplits(updated);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
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
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider font-mono">
            Primary Barcode: {barcode}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Barcode Box */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4">
          <span className="text-[10px] text-primary font-black uppercase tracking-wider block">Primary Split Item</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
            <div>
              <span className="text-slate-400 font-bold uppercase block text-[10px]">Material</span>
              <p className="font-extrabold text-slate-750 dark:text-slate-200 mt-0.5">{bcData?.materialName}</p>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase block text-[10px]">Current Owner</span>
              <p className="font-extrabold text-slate-750 dark:text-slate-200 mt-0.5">{bcData?.owner?.fullName}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requested New Material Name (Optional)</label>
            <input
              type="text"
              value={requestedMaterialName}
              onChange={(e) => setRequestedMaterialName(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3.5 py-2.5 font-semibold"
              placeholder="e.g. Split Material Sub-type Name (leaves parent name if blank)"
            />
          </div>

          {/* Extra Materials List nested inside Primary Split Item Box */}
          {extraSplits.map((name, index) => {
            return (
              <div key={index} className="border border-purple-100/70 dark:border-purple-900/40 bg-purple-50/10 dark:bg-purple-950/10 rounded-xl p-4 space-y-3 relative">
                <button
                  type="button"
                  onClick={() => removeSplitRow(index)}
                  className="absolute top-3.5 right-3.5 p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                >
                  <Trash className="w-3.5 h-3.5" />
                </button>

                <span className="text-[10px] text-purple-650 dark:text-purple-400 font-black uppercase tracking-wider block">Additional Split Item #{index + 1}</span>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requested New Material Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => updateSplitRow(index, e.target.value)}
                    required
                    className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
                    placeholder="e.g. Split Material Sub-type Name"
                  />
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
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remark / Reason for Split (Applies to all) *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows="4"
            className="w-full text-sm bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3.5 py-3 font-semibold"
            placeholder="Provide reason for split request..."
            required
          />
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
    </div>
  );
}
