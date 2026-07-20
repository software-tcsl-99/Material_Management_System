import { ArrowLeftRight, ArrowRight, Layers } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import api from '../../lib/axios';

const TransferListPage = () => {
  const navigate = useNavigate();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/barcodes/list/transfers');
      setTransfers(response.data.data || []);
    } catch (err) {
      console.error('Error fetching transfers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'approved':
        return <Badge variant="info">Approved</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Group transfers by transactionId
  const groupedTransfers = transfers.reduce((acc, t) => {
    const txId = t.transactionId || 'UNKNOWN';
    if (!acc[txId]) {
      acc[txId] = [];
    }
    acc[txId].push(t);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white m-0 flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-blue-600" /> Transferred Barcodes List
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Barcode-wise movement log grouped by their parent transaction</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-650" />
        </div>
      ) : Object.keys(groupedTransfers).length === 0 ? (
        <Card>
          <div className="text-center py-12 text-slate-400 text-sm">
            No transfer records found.
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(groupedTransfers).map(([txnId, items]) => (
            <div
              key={txnId}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
            >
              {/* Group Header */}
              <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span className="text-[10px] text-slate-400 font-extrabold tracking-wider block">Parent Transaction</span>
                  <span
                    onClick={() => navigate(`/transactions/${txnId}`)}
                    className="font-bold text-slate-800 dark:text-slate-200 hover:underline cursor-pointer font-mono text-sm tracking-wide"
                  >
                    {txnId}
                  </span>
                </div>
                <Badge variant="primary" className="text-[10px] font-bold px-2.5 py-0.5 tracking-wider">
                  {items.length} {items.length === 1 ? 'Transfer' : 'Transfers'}
                </Badge>
              </div>

              {/* Group Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 bg-slate-50/30 dark:bg-slate-900/10">
                      <th className="px-5 py-3">Barcode</th>
                      <th className="px-5 py-3">Movement Route</th>
                      <th className="px-5 py-3">Routing Type</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((row) => (
                      <tr
                        key={row._id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors cursor-pointer"
                        onClick={() => navigate(`/barcodes/${row.barcode}`)}
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="font-extrabold text-blue-650 dark:text-blue-400 hover:underline tracking-wider font-mono">
                            {row.barcode}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
                            <span className="font-bold text-slate-850 dark:text-slate-150">
                              {row.fromUser ? `${row.fromUser.fullName} (${row.fromDepartment?.name || 'Service'})` : '-'}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-bold text-slate-855 dark:text-slate-105">
                              {row.toUser ? `${row.toUser.fullName} (${row.toDepartment?.name || 'R&D'})` : '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="capitalize font-extrabold text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {row.type?.replace('_', ' ')}
                          </span>
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
                          <span className="text-slate-550 dark:text-slate-300 block truncate max-w-xs">{row.remarks || '-'}</span>
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

export default TransferListPage;
