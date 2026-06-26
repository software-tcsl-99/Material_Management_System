import { ArrowRight, Calendar, Download, Edit2, Eye, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import DataTable from '../../components/ui/DataTable';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';

const TransactionListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters state
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [docType, setDocType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isAdmin = ['super_admin', 'admin'].includes(user?.role);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: 10,
        search,
        status,
        documentType: docType,
        startDate,
        endDate,
      };

      const response = await api.get('/transactions', { params });
      const data = response.data.data || [];
      const pages = response.data.pagination?.pages || 1;

      setTransactions(data || []);
      setTotalPages(pages || 1);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, status, docType, startDate, endDate]);

  const handleDownloadAll = async () => {
    try {
      const params = {
        search,
        status,
        documentType: docType,
        startDate,
        endDate,
      };
      const response = await api.get('/reports/export', {
        responseType: 'blob',
        params,
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Transactions_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download all error:', err);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchTransactions();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      fetchTransactions();
    } catch (err) {
      console.error('Delete transaction error:', err);
      alert(err.response?.data?.message || 'Failed to delete transaction');
    }
  };

  const columns = [
    {
      header: 'Transaction ID',
      cell: (row) => (
        <span className="font-bold text-indigo-600 dark:text-indigo-400">
          {row.transactionId}
        </span>
      ),
    },
    {
      header: 'Doc Type',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {row.documentType}
          </span>
          <span className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">
            No: {row.documentNumber || 'N/A'}
          </span>
        </div>
      ),
    },
    {
      header: 'Sender',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold">{row.sender?.fullName}</span>
          <span className="text-[10px] text-slate-500 font-medium">{row.sender?.employeeId}</span>
        </div>
      ),
    },
    {
      header: 'Receiver',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold">{row.receiver?.fullName || row.otherReceiverName || 'Other'}</span>
          {row.receiver && <span className="text-[10px] text-slate-500 font-medium">{row.receiver?.employeeId}</span>}
        </div>
      ),
    },
    {
      header: 'Date',
      cell: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Grand Total',
      cell: (row) => (
        <span className="font-bold text-slate-900 dark:text-white">
          ₹{(row.grandTotal || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (row) => <Badge>{row.status}</Badge>,
    },
    {
      header: 'Actions',
      cell: (row) => {
        // Can edit/delete if own transaction and status is draft/pending
        const isOwner = row.sender?._id === user?._id || row.sender === user?._id;
        const canModify = isOwner && ['draft', 'pending'].includes(row.status);

        return (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate(`/transactions/${row._id}`)}
              className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </Button>
            {canModify && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/transactions/edit/${row._id}`)}
                  className="p-1.5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(row._id)}
                  className="p-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
            Material Movements
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browse and track material transfers across company locations
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            icon={Download}
          >
            Export Report
          </Button>
          {!isAdmin && (
            <Button
              size="sm"
              onClick={() => navigate('/transactions/create')}
              icon={Plus}
            >
              Send Material
            </Button>
          )}
        </div>
      </div>

      {/* Filter Options Bar */}
      <form onSubmit={handleSearchSubmit} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Text Search */}
          <div className="lg:col-span-2">
            <Input
              id="search"
              placeholder="Search by ID, doc number, materials..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="[&_input]:py-2"
            />
          </div>

          {/* Status Dropdown */}
          <Select
            id="status-filter"
            placeholder="All Statuses"
            options={[
              { label: 'Draft', value: 'draft' },
              { label: 'Pending Approval', value: 'pending' },
              { label: 'Accepted', value: 'accepted' },
              { label: 'Rejected', value: 'rejected' },
              { label: 'Completed', value: 'completed' },
            ]}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="[&_select]:py-2"
          />

          {/* Doc Type Dropdown */}
          <Select
            id="doctype-filter"
            placeholder="All Doc Types"
            options={[
              { label: 'Delivery Challan (DC)', value: 'DC' },
              { label: 'Returnable DC (RDC)', value: 'RDC' },
              { label: 'Invoice', value: 'Invoice' },
              { label: 'Emergency Send', value: 'Emergency Send' },
            ]}
            value={docType}
            onChange={(e) => {
              setDocType(e.target.value);
              setCurrentPage(1);
            }}
            className="[&_select]:py-2"
          />

          {/* Submit Search button on Mobile / Search trigger */}
          <Button type="submit" size="sm" className="hidden lg:flex items-center justify-center py-2 h-[42px] mt-auto">
            Search
          </Button>
        </div>

        {/* Date Filter Panel */}
        <div className="flex flex-wrap items-center gap-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-600 dark:text-slate-400">Date Range:</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
            <span className="text-slate-400"><ArrowRight className="w-3.5 h-3.5" /></span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
          {(search || status || docType || startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatus('');
                setDocType('');
                setStartDate('');
                setEndDate('');
                setCurrentPage(1);
              }}
              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer ml-auto"
            >
              Clear Filters
            </button>
          )}
        </div>
      </form>

      {/* Grid Table */}
      <DataTable
        columns={columns}
        data={transactions}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => setCurrentPage(page)}
        emptyMessage="No material movements match your selection."
      />
    </div>
  );
};

export default TransactionListPage;
