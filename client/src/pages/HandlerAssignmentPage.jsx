import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserCheck } from 'lucide-react';
import api from '../lib/api';

export default function HandlerAssignmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [handlerId, setHandlerId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');

  // Fetch employees to pick handlers (Stores or delivery team)
  const { data: handlers } = useQuery({
    queryKey: ['handlersList'],
    queryFn: async () => {
      const { data } = await api.get('/employees?limit=100');
      return data.employees || [];
    }
  });

  const assignMutation = useMutation({
    mutationFn: async (payload) => {
      return api.put(`/transactions/${id}/assign-handler`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactionDetail', id] });
      alert('Handler assigned successfully!');
      navigate(`/transactions/${id}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!handlerId) {
      alert('Please select a handler.');
      return;
    }

    assignMutation.mutate({
      handlerId,
      remarks,
      expectedDeliveryDate
    });
  };

  return (
    <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold text-slate-800 font-sans">Assign Delivery Handler</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Transaction: {id}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Select Handler</label>
          <select
            value={handlerId}
            onChange={(e) => setHandlerId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none"
            required
          >
            <option value="">Select Handler</option>
            {handlers?.map(h => (
              <option key={h._id} value={h._id}>{h.fullName} ({h.department?.name})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase font-sans">Expected Delivery Date & Time</label>
          <input
            type="datetime-local"
            value={expectedDeliveryDate}
            onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Instruction / Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Add delivery instructions..."
            rows={3}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 outline-none resize-none"
          />
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
            Assign & Notify
          </button>
        </div>
      </form>
    </div>
  );
}
