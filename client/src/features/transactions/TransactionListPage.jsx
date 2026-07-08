import { ArrowRight, Calendar, ChevronDown, Download, Filter, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import DataTable from '../../components/ui/DataTable';
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

  // Tab Filtering (All, Pending, In Progress, Received, Partially Returned, Closed, Rejected)
  const [activeTab, setActiveTab] = useState('All');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

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
      else if (activeTab === 'In Progress') statusFilter = 'in_progress';
      else if (activeTab === 'Received') statusFilter = 'received';
      else if (activeTab === 'Partially Returned') statusFilter = 'partially_returned';
      else if (activeTab === 'Closed') statusFilter = 'closed';
      else if (activeTab === 'Rejected') statusFilter = 'rejected';

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

  const columns = [
    {
      header: 'Transaction ID',
      cell: (row) => (
        <span className="font-bold text-blue-600 dark:text-blue-400 text-md">
          {row.transactionId}
        </span>
      ),
    },
    {
      header: 'Requester',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-extrabold text-slate-800 dark:text-slate-200">{row.requester?.fullName || row.sender?.fullName}</span>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{row.requester?.employeeId || row.sender?.employeeId}</span>
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
      header: 'Expected Return Date',
      cell: (row) => (
        <span className="block text-[11px] text-slate-500 font-semibold text-center">
          {row.dueDate ? new Date(row.dueDate).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (row) => {
        const getVariant = (status) => {
          switch (status) {
            case 'closed':
            case 'completed':
              return 'success';
            case 'rejected':
            case 'cancelled':
              return 'danger';
            case 'partially_returned':
              return 'warning';
            case 'received':
              return 'info';
            case 'active':
              return 'info';
            default:
              return 'default';
          }
        };
        return (
          <Badge variant={getVariant(row.status)}>
            {row.status.replace('_', ' ').toUpperCase()}
          </Badge>
        );
      },
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
        else if (row.status === 'completed' || row.status === 'closed') progress = 100;
        else if (row.status === 'rejected') progress = 100;
        else if (row.status === 'partially_returned') progress = 90;
        else if (row.status === 'active') progress = 95;

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
      header: '',
      cell: () => (
        <div className="flex justify-end items-center">
          <div className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white m-0">
            {allParam ? 'Enterprise Sourcing Directory' : 'My Transactions'}
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

          {/* Status Filter Dropdown Button */}
          <div className="relative inline-block text-left select-none">
            <div>
              <button
                type="button"
                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                className="inline-flex items-center justify-between gap-2 w-full px-3 h-[36px] text-xs font-extrabold text-slate-750 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900 focus:outline-none transition-all cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-slate-450" />
                  <span>
                    Status: <strong className="text-blue-600 dark:text-blue-400">{
                      (() => {
                        const statusOptions = [
                          { label: 'All Statuses', value: 'All' },
                          { label: 'Pending', value: 'Pending' },
                          { label: 'In Progress', value: 'In Progress' },
                          { label: 'Received', value: 'Received' },
                          { label: 'Partially Returned', value: 'Partially Returned' },
                          { label: 'Closed', value: 'Closed' },
                          { label: 'Rejected', value: 'Rejected' }
                        ];
                        return statusOptions.find(opt => opt.value === activeTab)?.label || 'All Statuses';
                      })()
                    }</strong>
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform duration-200 ${statusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {statusDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setStatusDropdownOpen(false)}
                />

                <div className="absolute left-0 mt-2 w-full min-w-[200px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg focus:outline-none z-20 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="py-1">
                    {[
                      { label: 'All Statuses', value: 'All' },
                      { label: 'Pending', value: 'Pending' },
                      { label: 'In Progress', value: 'In Progress' },
                      { label: 'Received', value: 'Received' },
                      { label: 'Partially Returned', value: 'Partially Returned' },
                      { label: 'Closed', value: 'Closed' },
                      { label: 'Rejected', value: 'Rejected' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setActiveTab(option.value);
                          setCurrentPage(1);
                          setStatusDropdownOpen(false);
                        }}
                        className={`flex items-center w-full px-4 py-2.5 text-left text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer
                          ${activeTab === option.value
                            ? 'text-blue-600 bg-blue-50/50 dark:text-blue-400 dark:bg-blue-950/30 font-bold'
                            : 'text-slate-750 dark:text-slate-300'
                          }
                        `}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <Button type="submit" size="sm" className="h-[36px] mt-auto">
            Search
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
        onRowClick={(row) => navigate(`/transactions/${row._id}`)}
        emptyMessage="No material movements match your selection."
      />
    </div>
  );
};

export default TransactionListPage;
