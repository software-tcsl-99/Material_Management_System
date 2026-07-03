import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCcw, Eye, Calendar, ShieldCheck, AlertTriangle, Layers } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import api from '../../lib/axios';

const ReturnListPage = () => {
  const navigate = useNavigate();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const response = await api.get('/barcodes/list/returns');
      setReturns(response.data.data || []);
    } catch (err) {
      console.error('Error fetching returns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'collected':
        return <Badge variant="info">Collected</Badge>;
      case 'handler_assigned':
        return <Badge variant="secondary">Handler Assigned</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getConditionBadge = (condition) => {
    switch (condition?.toLowerCase()) {
      case 'good':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-655 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3 text-emerald-600" /> Good
          </span>
        );
      case 'damaged':
      case 'defective':
      case 'needs_repair':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> {condition?.replace('_', ' ')}
          </span>
        );
      default:
        return <span className="capitalize font-semibold text-slate-550">{condition}</span>;
    }
  };

  // Group returns by transactionId
  const groupedReturns = returns.reduce((acc, r) => {
    const txId = r.transactionId || 'UNKNOWN';
    if (!acc[txId]) {
      acc[txId] = [];
    }
    acc[txId].push(r);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white m-0 flex items-center gap-2">
            <RefreshCcw className="w-6 h-6 text-blue-600 animate-spin-slow" /> Returned Barcodes List
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Barcode-wise return log grouped by their parent transaction</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-655" />
        </div>
      ) : Object.keys(groupedReturns).length === 0 ? (
        <Card>
          <div className="text-center py-12 text-slate-400 italic text-sm">
            No return records found.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(groupedReturns).map(([txnId, items]) => (
            <div 
              key={txnId}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
            >
              {/* Group Header */}
              <div className="px-5 py-4 bg-slate-50 dark:bg-slate-955/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Parent Transaction</span>
                  <span 
                    onClick={() => navigate(`/transactions/${txnId}`)}
                    className="font-black text-slate-800 dark:text-slate-105 hover:underline cursor-pointer font-mono text-sm tracking-wide"
                  >
                    {txnId}
                  </span>
                </div>
                <Badge variant="warning" className="text-[10px] font-black px-2.5 py-0.5 uppercase tracking-wider">
                  {items.length} {items.length === 1 ? 'Return' : 'Returns'}
                </Badge>
              </div>

              {/* Group Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 bg-slate-50/30 dark:bg-slate-900/10">
                      <th className="px-5 py-3">Barcode</th>
                      <th className="px-5 py-3">Returned By</th>
                      <th className="px-5 py-3">Condition</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Return Date</th>
                      <th className="px-5 py-3">Reason / Remarks</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((row) => (
                      <tr 
                        key={row._id} 
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors"
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span 
                            onClick={() => navigate(`/barcodes/${row.barcode}`)}
                            className="font-extrabold text-blue-650 hover:underline cursor-pointer tracking-wider font-mono"
                          >
                            {row.barcode}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-bold text-slate-850 dark:text-slate-150">
                            {row.fromUser ? `${row.fromUser.fullName} (${row.fromUser.employeeId})` : '-'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {getConditionBadge(row.condition)}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {getStatusBadge(row.status)}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-medium">
                          {new Date(row.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-slate-550 italic block truncate max-w-xs">{row.reason || row.remarks || '-'}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => navigate(`/barcodes/${row.barcode}`)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReturnListPage;
