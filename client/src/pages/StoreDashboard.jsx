import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Archive, Plus, ArrowRight, UserCheck, ShieldAlert } from 'lucide-react';
import api from '../lib/api';

export default function StoreDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get Store items
  const { data: storeItems, isLoading } = useQuery({
    queryKey: ['storeInventory'],
    queryFn: async () => {
      const { data } = await api.get('/barcodes/search?status=Returned');
      return data.barcodes || [];
    }
  });

  // Get pending acceptances
  const { data: pendingRequests } = useQuery({
    queryKey: ['pendingStoreRequests'],
    queryFn: async () => {
      const { data } = await api.get('/transactions?status=tl_approved');
      return data.transactions || [];
    }
  });

  const acceptMutation = useMutation({
    mutationFn: async (id) => {
      return api.put(`/transactions/${id}/store-accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingStoreRequests'] });
      alert('Transaction accepted into store!');
    }
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header bar */}
      <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Store Administration</h1>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
            Manage physical stock inventory, returns, and handler assignments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side (Pending requests queue + assign handler trigger) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Inbound Sourcing Queue</h2>
            
            {pendingRequests?.length === 0 ? (
              <p className="text-slate-400 text-xs py-8 text-center font-semibold">No requests pending store actions.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingRequests?.map((req) => (
                  <div key={req._id} className="py-4 flex justify-between items-center gap-4">
                    <div>
                      <p className="font-extrabold text-xs text-primary">{req.transactionId}</p>
                      <p className="text-xs text-slate-700 font-bold mt-1">{req.description || 'Request'}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                        Requester: {req.requester?.fullName} ({req.department?.name})
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptMutation.mutate(req._id)}
                        className="px-3.5 py-2 bg-success hover:bg-success-dark text-white rounded-xl text-xs font-bold transition shadow-sm"
                      >
                        Accept & Sourced
                      </button>
                      <button
                        onClick={() => navigate(`/transactions/${req.transactionId}`)}
                        className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side (Inventory Summary Widget) */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Stores Inventory</h2>
            
            <div className="overflow-y-auto max-h-96 divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-slate-50">
              {storeItems?.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-8">No inventory in stock.</p>
              ) : (
                storeItems?.map((bc) => (
                  <div key={bc._id} className="p-3 text-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800">{bc.barcode}</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5">{bc.materialName}</p>
                    </div>
                    <span className="bg-success-light text-success px-2 py-0.5 rounded-full text-[9px] font-bold">
                      IN STOCK
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
