import { ArrowRight, Calendar, Clock, Download, Edit2, Eye, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import DataTable from '../../components/ui/DataTable';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';

const PendingTransactionsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'admin'].includes(user?.role);

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'all'

  // Pending approvals state
  const [pendingTxns, setPendingTxns] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPages, setPendingPages] = useState(1);
  const [pendingSearch, setPendingSearch] = useState('');

  // All transactions state
  const [allTxns, setAllTxns] = useState([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allPage, setAllPage] = useState(1);
  const [allPages, setAllPages] = useState(1);

  // All transactions filters
  const [allSearch, setAllSearch] = useState('');
  const [allStatus, setAllStatus] = useState('');
  const [allDocType, setAllDocType] = useState('');
  const [allStartDate, setAllStartDate] = useState('');
  const [allEndDate, setAllEndDate] = useState('');

  // Approve / Reject action modals state
  const [actionModal, setActionModal] = useState(''); // 'accept' | 'reject'
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const handleDownloadAll = async () => {
    try {
      const params = {
        search: activeTab === 'pending' ? pendingSearch : allSearch,
        status: activeTab === 'pending' ? 'pending' : allStatus,
        documentType: allDocType,
        startDate: allStartDate,
        endDate: allEndDate,
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

  // Fetch pending transactions (only where user is receiver)
  const fetchPendingTransactions = async () => {
    setPendingLoading(true);
    try {
      const params = {
        page: pendingPage,
        limit: 10,
        status: 'pending',
        search: pendingSearch,
        receiver: user?._id,
      };
      const response = await api.get('/transactions', { params });
      setPendingTxns(response.data.data || []);
      setPendingPages(response.data.pagination?.pages || 1);
    } catch (err) {
      console.error('Error fetching pending transactions:', err);
    } finally {
      setPendingLoading(false);
    }
  };

  // Fetch all transactions
  const fetchAllTransactions = async () => {
    setAllLoading(true);
    try {
      const params = {
        page: allPage,
        limit: 10,
        search: allSearch,
        status: allStatus,
        documentType: allDocType,
        startDate: allStartDate,
        endDate: allEndDate,
      };
      const response = await api.get('/transactions', { params });
      setAllTxns(response.data.data || []);
      setAllPages(response.data.pagination?.pages || 1);
    } catch (err) {
      console.error('Error fetching all transactions:', err);
    } finally {
      setAllLoading(false);
    }
  };

  // Run fetches based on active tab and page changes
  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingTransactions();
    } else {
      fetchAllTransactions();
    }
  }, [activeTab, pendingPage, allPage, allStatus, allDocType, allStartDate, allEndDate]);

  const handlePendingSearchSubmit = (e) => {
    e.preventDefault();
    setPendingPage(1);
    fetchPendingTransactions();
  };

  const handleAllSearchSubmit = (e) => {
    e.preventDefault();
    setAllPage(1);
    fetchAllTransactions();
  };

  const handleDecisionClick = (txn, actionType) => {
    setSelectedTxn(txn);
    setActionModal(actionType);
    setRemarks('');
    setRejectionReason('');
    setActionError('');
  };

  const handleDecisionSubmit = async () => {
    if (!selectedTxn) return;
    setSubmitting(true);
    setActionError('');

    try {
      if (actionModal === 'accept') {
        await api.patch(`/transactions/${selectedTxn._id}/accept`, { remarks });
      } else if (actionModal === 'reject') {
        if (!rejectionReason.trim()) {
          setActionError('Rejection reason is required');
          setSubmitting(false);
          return;
        }
        await api.patch(`/transactions/${selectedTxn._id}/reject`, { rejectionReason });
      }
      setActionModal('');
      setSelectedTxn(null);
      fetchPendingTransactions();
      if (activeTab === 'all') fetchAllTransactions();
    } catch (err) {
      console.error('Decision submit error:', err);
      setActionError(err.response?.data?.message || 'Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      fetchAllTransactions();
    } catch (err) {
      console.error('Delete transaction error:', err);
      alert(err.response?.data?.message || 'Failed to delete transaction');
    }
  };

  // Table columns for Pending requests
  const pendingColumns = [
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
          <span className="text-[10px] text-slate-500 font-medium">
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
      header: 'Decisions / Actions',
      cell: (row) => {
        const isReceiver = row.receiver?._id === user?._id || row.receiver === user?._id;
        const isOwner = row.sender?._id === user?._id || row.sender === user?._id;
        const canModify = isOwner && ['draft', 'pending'].includes(row.status);
        
        return (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate(`/transactions/${row._id}`)}
              className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800"
              title="View Details"
            >
              <Eye className="w-4.5 h-4.5" />
            </Button>
            {isReceiver ? (
              <>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-2.5 py-1"
                  onClick={() => handleDecisionClick(row, 'accept')}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-2.5 py-1"
                  onClick={() => handleDecisionClick(row, 'reject')}
                >
                  Reject
                </Button>
              </>
            ) : null}
            {canModify ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate(`/transactions/edit/${row._id}`)}
                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800"
                title="Edit"
              >
                <Edit2 className="w-4.5 h-4.5" />
              </Button>
            ) : isOwner ? (
              <span className="text-[10px] text-slate-400 font-medium italic">Sent by you (Pending approval)</span>
            ) : null}
          </div>
        );
      },
    },
  ];

  // Table columns for All transactions
  const allColumns = [
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
          <span className="text-[10px] text-slate-500 font-medium">
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
          <span className="font-semibold">{row.receiver?.fullName}</span>
          <span className="text-[10px] text-slate-500 font-medium">{row.receiver?.employeeId}</span>
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
            {isAdmin ? 'All Transactions' : 'Pending requests & transactions'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin ? 'Browse and manage all material transfers' : 'Review pending material transfers or view and search all company material logs'}
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
              className="self-start sm:self-center"
            >
              Send Material
            </Button>
          )}
        </div>
      </div>

      {/* Tabs - Only show if not admin */}
      {!isAdmin && (
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
          <button
            onClick={() => {
              setActiveTab('pending');
              setPendingPage(1);
            }}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'pending'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
          >
            <Clock className="w-4 h-4" />
            Pending Approvals
          </button>
          <button
            onClick={() => {
              setActiveTab('all');
              setAllPage(1);
            }}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${activeTab === 'all'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
          >
            <FileText className="w-4 h-4" />
            All Transactions
          </button>
        </div>
      )}

      {/* Admin always sees all transactions tab content */}
      {isAdmin ? (
        <div className="flex flex-col gap-6">
          <form onSubmit={handleAllSearchSubmit} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div className="lg:col-span-2">
                <Input
                  id="allSearch"
                  placeholder="Search by ID, doc number, materials..."
                  value={allSearch}
                  onChange={(e) => setAllSearch(e.target.value)}
                  className="[&_input]:py-2"
                />
              </div>

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
                value={allStatus}
                onChange={(e) => {
                  setAllStatus(e.target.value);
                  setAllPage(1);
                }}
                className="[&_select]:py-2"
              />

              <Select
                id="doctype-filter"
                placeholder="All Doc Types"
                options={[
                  { label: 'Delivery Challan (DC)', value: 'DC' },
                  { label: 'Returnable DC (RDC)', value: 'RDC' },
                  { label: 'Invoice', value: 'Invoice' },
                  { label: 'Emergency Send', value: 'Emergency Send' },
                ]}
                value={allDocType}
                onChange={(e) => {
                  setAllDocType(e.target.value);
                  setAllPage(1);
                }}
                className="[&_select]:py-2"
              />

              <Button type="submit" size="sm" className="flex items-center justify-center py-2 h-[42px] w-full lg:w-auto lg:mt-auto">
                Search
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="font-semibold text-slate-600 dark:text-slate-400">Date Range:</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="date"
                  value={allStartDate}
                  onChange={(e) => {
                    setAllStartDate(e.target.value);
                    setAllPage(1);
                  }}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="text-slate-400"><ArrowRight className="w-3.5 h-3.5" /></span>
                <input
                  type="date"
                  value={allEndDate}
                  onChange={(e) => {
                    setAllEndDate(e.target.value);
                    setAllPage(1);
                  }}
                  className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              {(allSearch || allStatus || allDocType || allStartDate || allEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setAllSearch('');
                    setAllStatus('');
                    setAllDocType('');
                    setAllStartDate('');
                    setAllEndDate('');
                    setAllPage(1);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer ml-auto"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </form>

          <DataTable
            columns={allColumns}
            data={allTxns}
            loading={allLoading}
            currentPage={allPage}
            totalPages={allPages}
            onPageChange={(page) => setAllPage(page)}
            emptyMessage="No material movements match your selection."
          />
        </div>
      ) : (
        <>
          {/* Pending requests Tab Content */}
          {activeTab === 'pending' && (
            <div className="flex flex-col gap-6">
              <form onSubmit={handlePendingSearchSubmit} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    id="pendingSearch"
                    placeholder="Search pending requests by ID, doc number, materials..."
                    value={pendingSearch}
                    onChange={(e) => setPendingSearch(e.target.value)}
                    className="[&_input]:py-2"
                  />
                </div>
                <Button type="submit" size="sm" className="h-[42px] px-5 flex items-center gap-2">
                  <Search className="w-4 h-4" /> Search
                </Button>
              </form>

              <DataTable
                columns={pendingColumns}
                data={pendingTxns}
                loading={pendingLoading}
                currentPage={pendingPage}
                totalPages={pendingPages}
                onPageChange={(page) => setPendingPage(page)}
                emptyMessage="No pending requests require your action at the moment."
              />
            </div>
          )}

          {/* All transactions Tab Content */}
          {activeTab === 'all' && (
            <div className="flex flex-col gap-6">
              <form onSubmit={handleAllSearchSubmit} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  <div className="lg:col-span-2">
                    <Input
                      id="allSearch"
                      placeholder="Search by ID, doc number, materials..."
                      value={allSearch}
                      onChange={(e) => setAllSearch(e.target.value)}
                      className="[&_input]:py-2"
                    />
                  </div>

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
                    value={allStatus}
                    onChange={(e) => {
                      setAllStatus(e.target.value);
                      setAllPage(1);
                    }}
                    className="[&_select]:py-2"
                  />

                  <Select
                    id="doctype-filter"
                    placeholder="All Doc Types"
                    options={[
                      { label: 'Delivery Challan (DC)', value: 'DC' },
                      { label: 'Returnable DC (RDC)', value: 'RDC' },
                      { label: 'Invoice', value: 'Invoice' },
                      { label: 'Emergency Send', value: 'Emergency Send' },
                    ]}
                    value={allDocType}
                    onChange={(e) => {
                      setAllDocType(e.target.value);
                      setAllPage(1);
                    }}
                    className="[&_select]:py-2"
                  />

                  <Button type="submit" size="sm" className="flex items-center justify-center py-2 h-[42px] w-full lg:w-auto lg:mt-auto">
                    Search
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-slate-600 dark:text-slate-400">Date Range:</span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="date"
                      value={allStartDate}
                      onChange={(e) => {
                        setAllStartDate(e.target.value);
                        setAllPage(1);
                      }}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                    <span className="text-slate-400"><ArrowRight className="w-3.5 h-3.5" /></span>
                    <input
                      type="date"
                      value={allEndDate}
                      onChange={(e) => {
                        setAllEndDate(e.target.value);
                        setAllPage(1);
                      }}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  {(allSearch || allStatus || allDocType || allStartDate || allEndDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setAllSearch('');
                        setAllStatus('');
                        setAllDocType('');
                        setAllStartDate('');
                        setAllEndDate('');
                        setAllPage(1);
                      }}
                      className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer ml-auto"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </form>

              <DataTable
                columns={allColumns}
                data={allTxns}
                loading={allLoading}
                currentPage={allPage}
                totalPages={allPages}
                onPageChange={(page) => setAllPage(page)}
                emptyMessage="No material movements match your selection."
              />
            </div>
          )}

          {/* Decision confirmation Modal */}
          <Modal
            isOpen={!!actionModal}
            onClose={() => {
              setActionModal('');
              setSelectedTxn(null);
            }}
            title={actionModal === 'accept' ? 'Approve & Accept Transfer' : 'Reject Movement Request'}
          >
            {selectedTxn && (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Confirm decision for transfer dossier <span className="font-bold text-slate-800 dark:text-white">{selectedTxn.transactionId}</span>.
                </p>

                {actionError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400">
                    {actionError}
                  </div>
                )}

                {actionModal === 'accept' ? (
                  <Input
                    id="remarks"
                    label="Remarks (Optional)"
                    placeholder="e.g. Verified quantity, approved for dispatch"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                ) : (
                  <Input
                    id="rejectionReason"
                    label="Rejection Reason"
                    placeholder="e.g. Mismatched materials or quality issues"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    required
                  />
                )}

                <div className="flex items-center justify-end gap-2.5 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActionModal('');
                      setSelectedTxn(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant={actionModal === 'accept' ? 'success' : 'danger'}
                    size="sm"
                    loading={submitting}
                    onClick={handleDecisionSubmit}
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            )}
          </Modal>
        </>
      )}
    </div>
  );
};

export default PendingTransactionsPage;
