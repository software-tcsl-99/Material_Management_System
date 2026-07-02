import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Eye, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
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
      header: 'From Employee',
      accessor: (row) => row.fromUser ? `${row.fromUser.fullName} (${row.fromUser.employeeId})` : '-'
    },
    {
      header: 'To Employee',
      accessor: (row) => row.toUser ? `${row.toUser.fullName} (${row.toUser.employeeId})` : '-'
    },
    {
      header: 'Routing Type',
      accessor: (row) => (
        <span className="capitalize font-semibold text-slate-650">
          {row.type?.replace('_', ' ')}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: (row) => getStatusBadge(row.status)
    },
    {
      header: 'Date',
      accessor: (row) => new Date(row.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    },
    {
      header: 'Remarks',
      accessor: (row) => <span className="text-slate-500 italic max-w-xs truncate block">{row.remarks || '-'}</span>
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
            <ArrowLeftRight className="w-6 h-6 text-blue-600" /> Transferred Barcodes List
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Barcode-wise movement log grouped by their parent transaction</p>
        </div>
      </div>

      <Card title="All Transfers">
        <DataTable
          columns={columns}
          data={transfers}
          loading={loading}
          emptyMessage="No transfer records found."
        />
      </Card>
    </div>
  );
};

export default TransferListPage;
