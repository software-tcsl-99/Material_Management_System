import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCcw, Eye, Calendar, ShieldCheck, AlertTriangle } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
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
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-650 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3" /> Good
          </span>
        );
      case 'damaged':
      case 'defective':
      case 'needs_repair':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3" /> {condition?.replace('_', ' ')}
          </span>
        );
      default:
        return <span className="capitalize font-semibold text-slate-500">{condition}</span>;
    }
  };

  const columns = [
    {
      header: 'Barcode',
      accessor: (row) => (
        <span 
          onClick={() => navigate(`/barcodes/${row.barcode}`)}
          className="font-extrabold text-blue-650 hover:underline cursor-pointer tracking-wider"
        >
          {row.barcode}
        </span>
      )
    },
    {
      header: 'Transaction ID',
      accessor: (row) => (
        <span 
          onClick={() => navigate(`/transactions/${row.transactionId}`)}
          className="font-bold text-slate-800 dark:text-slate-200 hover:underline cursor-pointer"
        >
          {row.transactionId}
        </span>
      )
    },
    {
      header: 'Returned By',
      accessor: (row) => row.fromUser ? `${row.fromUser.fullName} (${row.fromUser.employeeId})` : '-'
    },
    {
      header: 'Condition',
      accessor: (row) => getConditionBadge(row.condition)
    },
    {
      header: 'Status',
      accessor: (row) => getStatusBadge(row.status)
    },
    {
      header: 'Return Date',
      accessor: (row) => new Date(row.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    },
    {
      header: 'Reason / Remarks',
      accessor: (row) => (
        <span className="text-slate-500 italic max-w-xs truncate block">
          {row.reason || row.remarks || '-'}
        </span>
      )
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <button
          onClick={() => navigate(`/barcodes/${row.barcode}`)}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 transition"
        >
          <Eye className="w-4 h-4" />
        </button>
      )
    }
  ];

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

      <Card title="All Returns">
        <DataTable
          columns={columns}
          data={returns}
          loading={loading}
          emptyMessage="No return records found."
        />
      </Card>
    </div>
  );
};

export default ReturnListPage;
