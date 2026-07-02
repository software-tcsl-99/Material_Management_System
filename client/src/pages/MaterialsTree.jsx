import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import api from '../lib/api';

export default function MaterialsTree() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedItems, setExpandedItems] = useState({});

  const { data: barcodes, isLoading } = useQuery({
    queryKey: ['barcodesSearchTree', searchTerm],
    queryFn: async () => {
      const { data } = await api.get(`/barcodes/search?q=${searchTerm}`);
      return data.barcodes || [];
    }
  });

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Group barcodes by material name
  const materialsGroup = barcodes?.reduce((acc, bc) => {
    if (!acc[bc.materialName]) {
      acc[bc.materialName] = [];
    }
    acc[bc.materialName].push(bc);
    return acc;
  }, {}) || {};

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-800">Materials & Barcodes Tree</h1>
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
          View hierarchical ownership lineage of each barcode serial unit
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          placeholder="Search by material name, barcode serial..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 focus:border-primary rounded-xl py-2 pl-9 pr-4 text-xs text-slate-700 outline-none transition"
        />
      </div>

      {/* Hierarchy Tree */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-slate-400 text-xs text-center py-8">Loading tree nodes...</p>
        ) : Object.keys(materialsGroup).length === 0 ? (
          <p className="text-slate-400 text-xs text-center py-8">No records matching search.</p>
        ) : (
          Object.entries(materialsGroup).map(([materialName, list]) => {
            const isExpanded = expandedItems[materialName];
            return (
              <div key={materialName} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {/* Parent Node header */}
                <button
                  onClick={() => toggleExpand(materialName)}
                  className="w-full flex justify-between items-center bg-slate-50 hover:bg-slate-100 p-4 transition font-extrabold text-xs text-slate-700 uppercase"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary shrink-0" />
                    <span>{materialName} ({list.length} units)</span>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                </button>

                {/* Children Node list */}
                {isExpanded && (
                  <div className="divide-y divide-slate-100 bg-white">
                    {list.map((bc) => (
                      <div
                        key={bc._id}
                        onClick={() => navigate(`/barcodes/${bc.barcode}`)}
                        className="p-3.5 pl-8 flex justify-between items-center text-xs hover:bg-slate-50 cursor-pointer transition"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800">{bc.barcode}</p>
                          <p className="text-[10px] text-slate-400 font-bold">
                            Owner: <span className="text-slate-700">{bc.owner?.fullName}</span>
                          </p>
                        </div>

                        <span className={`badge ${bc.status === 'Active' ? 'badge-primary' : 'badge-success'}`}>
                          {bc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
