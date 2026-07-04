import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import api from '../lib/api';

export default function SplitMaterial() {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

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
      return api.post('/barcodes/split-request', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barcodeDetail', barcode] });
      queryClient.invalidateQueries({ queryKey: ['barcodeSplitDetail', barcode] });
      alert('Split request submitted to store successfully!');
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
    splitRequestMutation.mutate({
      barcode,
      reason
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold text-slate-800 dark:text-white">Request Material Split</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider font-mono">
            Barcode: {barcode}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
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
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remark / Reason for Split *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows="4"
            className="w-full text-sm bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3.5 py-3 font-semibold"
            placeholder="Provide reason for split request..."
            required
          />
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={splitRequestMutation.isPending}
            className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-xl transition shadow-md shadow-primary/10 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{splitRequestMutation.isPending ? 'Sending...' : 'Send Request'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
