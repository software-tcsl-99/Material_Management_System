import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Calendar, Download, Edit2, Eye, Plus, Trash2, Search, ArrowLeftRight, CheckCircle, Clock } from 'lucide-react';
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
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const typeParam = searchParams.get('type');
  const allParam = searchParams.get('all') === 'true';

  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Tab Filtering (All, In Progress, Pending, Completed, Closed)
  const [activeTab, setActiveTab] = useState('All');

  // Filters state
  const [search, setSearch] = useState('');
  const [docType, setDocType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isAdmin = ['super_admin', 'admin'].includes(user?.role);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      let statusFilter = '';
      if (activeTab === 'Pending') statusFilter = 'submitted';
      else if (activeTab === 'In Progress') statusFilter = 'tl_approved'; // Or multiple progress states
      else if (activeTab === 'Completed') statusFilter = 'completed';
      else if (activeTab === 'Closed') statusFilter = 'rejected';

      const params = {
        page: currentPage,
        limit: 10,
        search,
        status: statusFilter,
        documentType: docType,
        startDate,
        endDate,
        // If not looking at all transactions, show only user's transactions
        sender: (!isAdmin && !allParam) ? user?._id : undefined,
      };

      const response = await api.get('/transactions', { params });
      let data = response.data.data || [];

      // Manual filtering for in-progress statuses if needed
      if (activeTab === 'In Progress') {
        // Find any transaction that is in workflow states between submission and completion
        data = data.filter(t => ['tl_approved', 'store_accepted', 'handler_assigned', 'dispatched', 'received'].includes(t.status));
      }

      setTransactions(data || []);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, activeTab, docType, startDate, endDate, allParam, tabParam, typeParam]);

  const handleDownloadAll = async () => {
    try {
      const response = await api.get('/reports/export', {
        responseType: 'blob',
        params: {
          search,
          documentType: docType,
          startDate,
          endDate,
        },
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Transactions_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchTransactions();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction permanently?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      fetchTransactions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete transaction');
    }
  };

  const columns = [
    {
      header: 'Transaction ID',
      cell: (row) => (
        <span className="font-bold text-blue-600 dark:text-blue-400 font-mono text-xs">
          {row.transactionId}
        </span>
      ),
    },
    {
      header: 'Requester',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-extrabold text-slate-800 dark:text-slate-200">{row.sender?.fullName}</span>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{row.sender?.employeeId}</span>
        </div>
      ),
    },
    {
      header: 'Date',
      cell: (row) => (
        <span className="text-[11px] text-slate-500 font-semibold">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.status === 'rejected' ? 'danger' : row.status === 'completed' ? 'success' : 'primary'}>
          {row.status.toUpperCase()}
        </Badge>
      ),
    },
    {
      header: 'Progress',
      cell: (row) => {
        // Calculate progress percentage
        let progress = 10;
        if (row.status === 'tl_approved') progress = 30;
        else if (row.status === 'mgt_approved' || row.status === 'ready_for_dispatch') progress = 45;
        else if (row.status === 'store_accepted') progress = 60;
        else if (row.status === 'handler_assigned') progress = 70;
        else if (row.status === 'dispatched') progress = 85;
        else if (row.status === 'received') progress = 95;
        else if (row.status === 'completed') progress = 100;
        else if (row.status === 'rejected') progress = 100;

        return (
          <div className="flex items-center gap-2 w-28">
            <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${row.status === 'rejected' ? 'bg-red-500' : 'bg-blue-600'}`} 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <span className="text-[9px] font-black text-slate-650 dark:text-slate-400 shrink-0">
              {progress}%
            </span>
          </div>
        );
      },
    },
    {
      header: 'Actions',
      cell: (row) => {
        const isOwner = row.sender?._id === user?._id || row.sender === user?._id;
        const canModify = isOwner && ['draft', 'submitted'].includes(row.status);
        return (
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="ghost"
              onClick={() => navigate(`/transactions/${row._id}`)}
              className="p-1 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"
              title="Open Detail dossier"
            >
              <Eye className="w-4 h-4" />
            </Button>
            {canModify && (
              <>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => navigate(`/transactions/edit/${row._id}`)}
                  className="p-1 text-slate-500 hover:text-amber-500"
                  title="Modify Challan"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => handleDelete(row._id)}
                  className="p-1 text-slate-500 hover:text-red-500"
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
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white m-0">
            {allParam ? 'Enterprise Sourcing Directory' : 'My Transactions dossier'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse and monitor full material logistics loop transactions
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            icon={Download}
          >
            Export Logs
          </Button>
          {!isAdmin && (
            <Button
              size="sm"
              onClick={() => navigate('/transactions/create')}
              icon={Plus}
            >
              Send Request
            </Button>
          )}
        </div>
      </div>

      {/* Tabs list matching mockup Panel 2 */}
      <div className="flex border-b border-slate-200 dark:border-slate-850 gap-6 select-none">
        {['All', 'In Progress', 'Pending', 'Completed', 'Closed'].map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setCurrentPage(1);
            }}
            className={`pb-2.5 text-[10px] font-extrabold uppercase tracking-widest border-b-2 transition-all cursor-pointer
              ${activeTab === tab
                ? 'border-blue-600 text-blue-600 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-650 dark:hover:text-slate-200'
              }
            `}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Advanced Filter Form */}
      <form onSubmit={handleSearchSubmit} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Challan ID, description, material name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 text-xs font-semibold rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <Select
            id="doctype-filter"
            placeholder="All Document Types"
            options={[
              { label: 'Delivery Challan (DC)', value: 'DC' },
              { label: 'Returnable DC (RDC)', value: 'RDC' },
              { label: 'Invoice Challan', value: 'Invoice' },
              { label: 'Emergency Send', value: 'Emergency Send' },
            ]}
            value={docType}
            onChange={(e) => {
              setDocType(e.target.value);
              setCurrentPage(1);
            }}
            className="[&_select]:py-2 [&_select]:text-xs"
          />

          <Button type="submit" size="sm" className="h-[36px] mt-auto">
            Search dossier
          </Button>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Filter Date Range:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <span className="text-slate-400"><ArrowRight className="w-3.5 h-3.5" /></span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          {(search || docType || startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setDocType('');
                setStartDate('');
                setEndDate('');
                setCurrentPage(1);
              }}
              className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer ml-auto"
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
