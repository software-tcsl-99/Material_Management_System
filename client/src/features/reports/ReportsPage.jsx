import { ArrowRight, Calendar, DollarSign, FileSpreadsheet, FileText, Filter, RefreshCw, Eye, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Select from '../../components/ui/Select';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';

const ReportsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ totalTransactions: 0, totalValue: 0, avgValue: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reportType, setReportType] = useState('transaction'); // 'transaction' | 'handler' | 'returns'

  // Filters State
  const [status, setStatus] = useState('');
  const [docType, setDocType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [senderName, setSenderName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [handlerName, setHandlerName] = useState('');
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [flow, setFlow] = useState('all');
  const [scope, setScope] = useState('all');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [exporting, setExporting] = useState(false);

  // Fetch employees list to use as filter options
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await api.get('/employees');
        const list = (response.data.data || []).filter(emp => emp.role !== 'super_admin' && emp.role !== 'admin');
        const formatted = list.map(emp => ({ value: emp._id, label: `${emp.fullName} (${emp.employeeId})` }));
        formatted.push({ value: 'other', label: 'Other / Non-Employee' });
        setEmployees(formatted);
      } catch (err) {
        console.error('Error fetching filter employees:', err);
      }
    };
    fetchEmployees();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: 15,
        status,
        documentType: docType,
        startDate,
        endDate,
        sender: senderName,
        receiver: receiverName,
        handler: handlerName,
        barcode: barcodeQuery,
        expectedReturnDate,
        flow,
        scope,
        reportType,
      };

      const response = await api.get('/reports', { params });

      setTransactions(response.data.data || []);
      setSummary(response.data.summary || { totalTransactions: 0, totalValue: 0, avgValue: 0 });
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [
    currentPage, 
    status, 
    docType, 
    startDate, 
    endDate, 
    senderName, 
    receiverName, 
    handlerName,
    barcodeQuery,
    expectedReturnDate,
    flow, 
    scope,
    reportType
  ]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = {
        status,
        documentType: docType,
        startDate,
        endDate,
        sender: senderName,
        receiver: receiverName,
        handler: handlerName,
        barcode: barcodeQuery,
        expectedReturnDate,
        flow,
        scope,
        reportType,
      };
      
      const response = await api.get('/reports/export', {
        responseType: 'blob',
        params,
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `MMS_Report_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download report error:', err);
    } finally {
      setExporting(false);
    }
  };

  const isAdmin = ['super_admin', 'admin'].includes(user?.role);

  const getColumns = () => {
    if (reportType === 'returns') {
      return [
        {
          header: 'Transaction ID',
          cell: (row) => <span className="font-bold text-indigo-600 dark:text-indigo-400">{row.transactionId}</span>,
        },
        {
          header: 'Barcode',
          cell: (row) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{row.barcode}</span>,
        },
        {
          header: 'Returned By',
          cell: (row) => (
            <div className="flex flex-col">
              <span className="font-semibold text-slate-905 dark:text-slate-100">{row.fromUser?.fullName}</span>
              <span className="text-[10px] text-slate-400 font-medium">ID: {row.fromUser?.employeeId}</span>
            </div>
          ),
        },
        {
          header: 'Return Handler',
          cell: (row) => (
            <div className="flex flex-col">
              <span className="font-semibold text-slate-905 dark:text-slate-100">{row.returnHandler?.fullName || 'N/A'}</span>
              {row.returnHandler && <span className="text-[10px] text-slate-400 font-medium">ID: {row.returnHandler.employeeId}</span>}
            </div>
          ),
        },
        {
          header: 'Condition',
          cell: (row) => (
            <Badge variant={row.condition === 'good' ? 'success' : 'warning'}>
              {(row.condition || 'good').toUpperCase()}
            </Badge>
          ),
        },
        {
          header: 'Reason',
          cell: (row) => (
            <span className="text-xs italic text-slate-600 dark:text-slate-400 truncate max-w-[150px] block" title={row.reason}>
              {row.reason || 'N/A'}
            </span>
          ),
        },
        {
          header: 'Status',
          cell: (row) => (
            <Badge variant={row.status === 'completed' ? 'success' : 'warning'}>
              {(row.status || 'pending').toUpperCase().replace('_', ' ')}
            </Badge>
          ),
        },
        {
          header: 'Request Date',
          cell: (row) => (
            <span className="text-xs text-slate-505 font-medium">
              {new Date(row.createdAt).toLocaleDateString()}
            </span>
          ),
        }
      ];
    }

    if (reportType === 'handler') {
      return [
        {
          header: 'Transaction ID',
          cell: (row) => <span className="font-bold text-indigo-600 dark:text-indigo-400">{row.transactionId}</span>,
        },
        {
          header: 'Handler Details',
          cell: (row) => (
            <div className="flex flex-col">
              <span className="font-semibold text-slate-905 dark:text-slate-100">{row.handler?.fullName || 'N/A'}</span>
              {row.handler && <span className="text-[10px] text-slate-400 font-medium">ID: {row.handler.employeeId}</span>}
            </div>
          ),
        },
        {
          header: 'Sender (Requester)',
          cell: (row) => (
            <div className="flex flex-col">
              <span className="font-semibold text-slate-905 dark:text-slate-100">{row.sender?.fullName || row.requester?.fullName}</span>
              <span className="text-[10px] text-slate-400 font-medium">ID: {row.sender?.employeeId || row.requester?.employeeId}</span>
            </div>
          ),
        },
        {
          header: 'Receiver Details',
          cell: (row) => (
            <div className="flex flex-col">
              <span className="font-semibold text-slate-905 dark:text-slate-100">{row.receiver?.fullName || row.otherReceiverName || 'Other'}</span>
              {row.receiver && <span className="text-[10px] text-slate-400 font-medium">ID: {row.receiver.employeeId}</span>}
            </div>
          ),
        },
        {
          header: 'Valuation',
          cell: (row) => <span className="font-bold text-slate-950 dark:text-white">₹{(row.grandTotal || 0).toLocaleString()}</span>,
        },
        {
          header: 'Date Assigned',
          cell: (row) => <span className="text-xs text-slate-505 font-medium">{new Date(row.createdAt).toLocaleDateString()}</span>,
        },
        {
          header: 'Status',
          cell: (row) => <Badge>{row.status}</Badge>,
        },
        {
          header: 'Actions',
          cell: (row) => (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate(row.isExternal ? `/receiving/${row._id}` : `/transactions/${row._id}`)}
              className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </Button>
          ),
        },
      ];
    }    return [
      {
        header: 'Transaction ID',
        cell: (row) => <span className="font-bold text-indigo-600 dark:text-indigo-400">{row.transactionId}</span>,
      },
      {
        header: 'Doc Ref',
        cell: (row) => (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800 dark:text-slate-200">{row.documentType}</span>
            {row.documentNumber && row.documentNumber !== 'N/A' && (
              <span className="text-[10px] text-slate-400 font-medium">No: {row.documentNumber}</span>
            )}
          </div>
        ),
      },
      {
        header: 'Date',
        cell: (row) => (
          <span className="text-xs text-slate-505 dark:text-slate-450 font-medium">
            {new Date(row.createdAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        header: 'Expected Return',
        cell: (row) => (
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {row.expectedReturnDate 
              ? new Date(row.expectedReturnDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) 
              : 'N/A'}
          </span>
        ),
      },
      {
        header: 'Requester',
        cell: (row) => (
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {row.requester?.fullName}
          </span>
        ),
      },
      {
        header: 'Handler',
        cell: (row) => (
          <span className="text-xs text-slate-600 dark:text-slate-450 font-medium">
            {row.handler?.fullName || 'N/A'}
          </span>
        ),
      },
      {
        header: 'Material Details',
        cell: (row) => (
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate max-w-[180px] block" title={row.materials?.map(m => `${m.qty ?? m.quantity} ${m.unit} x ${m.name}`).join(', ')}>
            {row.materials?.map(m => `${m.qty ?? m.quantity} ${m.unit} x ${m.name}`).join(', ')}
          </span>
        ),
      },
      {
        header: 'Barcodes',
        cell: (row) => {
          const barcodes = [];
          row.materials?.forEach(m => {
            m.barcodes?.forEach(b => {
              if (b.barcode) barcodes.push(b.barcode);
            });
          });
          if (barcodes.length === 0) return <span className="text-[10px] text-slate-400">None</span>;
          return (
            <div className="flex flex-wrap gap-1 max-w-[140px]">
              {barcodes.slice(0, 2).map((bc, idx) => (
                <span key={idx} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1 py-0.5 rounded text-[9px] font-mono border border-slate-200 dark:border-slate-700">
                  {bc}
                </span>
              ))}
              {barcodes.length > 2 && (
                <span className="text-[9px] text-slate-400 font-bold self-center">+{barcodes.length - 2}</span>
              )}
            </div>
          );
        }
      },
      {
        header: 'Valuation',
        cell: (row) => <span className="font-bold text-slate-950 dark:text-white">₹{(row.grandTotal || 0).toLocaleString()}</span>,
      },
      {
        header: 'Status',
        cell: (row) => <Badge>{row.status}</Badge>,
      },
      {
        header: 'Actions',
        cell: (row) => (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(row.isExternal ? `/receiving/${row._id}` : `/transactions/${row._id}`)}
            className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </Button>
        ),
      },
    ];
  };

  const getKpiLabels = () => {
    if (reportType === 'returns') {
      return {
        title1: 'Returns Count',
        value1: `${summary.totalTransactions} returns`,
        title2: 'Good Condition',
        value2: `${summary.totalValue} items`,
        title3: 'Damaged / Issues',
        value3: `${summary.avgValue} items`,
      };
    }
    if (reportType === 'handler') {
      return {
        title1: 'Tasks Count',
        value1: `${summary.totalTransactions} assignments`,
        title2: 'Completed Tasks',
        value2: `${summary.totalValue} delivered`,
        title3: 'Active Tasks',
        value3: `${summary.avgValue} active`,
      };
    }
    return {
      title1: 'Transfers Count',
      value1: `${summary.totalTransactions} cycles`,
      title2: 'Total Valuation',
      value2: `₹${(summary.totalValue || 0).toLocaleString()}`,
      title3: 'Average Valuation',
      value3: `₹${Math.round(summary.avgValue || 0).toLocaleString()}`,
    };
  };

  const kpis = getKpiLabels();
  const columns = getColumns();

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto px-1">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-slate-200/10 shadow-lg text-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-xl">
            <Filter className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight m-0 bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">
              Report Command Center
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Build custom material logs, analyze transfer valuations, and download formatted Excel worksheets.
            </p>
          </div>
        </div>
        <Button
          size="md"
          onClick={handleExportExcel}
          disabled={exporting}
          icon={FileSpreadsheet}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-emerald-500/20 font-bold tracking-wide transition-all scale-100 hover:scale-[1.02] active:scale-[0.98] border-none"
        >
          {exporting ? 'Exporting...' : 'Export Excel Report'}
        </Button>
      </div>

      {/* Report Type Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => { setReportType('transaction'); setCurrentPage(1); }}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            reportType === 'transaction'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Transactions Report
        </button>
        <button
          onClick={() => { setReportType('handler'); setCurrentPage(1); }}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            reportType === 'handler'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Handlers Report
        </button>
        <button
          onClick={() => { setReportType('returns'); setCurrentPage(1); }}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            reportType === 'returns'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Returns Report
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Count Card */}
        <Card className="relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300 shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{kpis.title1}</span>
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                {kpis.value1}
              </span>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
              <FileText className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Valuation Card */}
        <Card className="relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300 shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{kpis.title2}</span>
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {kpis.value2}
              </span>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>

        {/* Average Card */}
        <Card className="relative overflow-hidden group hover:border-sky-500/30 transition-all duration-300 shadow-sm border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-sky-500/10 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{kpis.title3}</span>
              <span className="text-2xl font-extrabold text-sky-600 dark:text-sky-400 mt-1">
                {kpis.value3}
              </span>
            </div>
            <div className="p-3 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-100 dark:border-sky-900/30">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Criteria Card */}
      <Card 
        title="Filter & Query Criteria" 
        headerAction={
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 h-8 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Filter className="w-3.5 h-3.5" />
            {showMobileFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
        }
        className="border border-slate-100 dark:border-slate-800 shadow-sm rounded-xl p-3.5 bg-white dark:bg-slate-900 animate-in fade-in duration-300"
      >
        <div className={`${showMobileFilters ? 'grid' : 'hidden md:grid'} grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end`}>
          
          <div>
            <Select
              id="status"
              label="Status"
              placeholder="All Statuses"
              options={[
                { label: 'Draft', value: 'draft' },
                { label: 'Pending Approval', value: 'submitted' },
                { label: 'TL Approved', value: 'tl_approved' },
                { label: 'Mgt Approved', value: 'mgt_approved' },
                { label: 'Store Accepted', value: 'store_accepted' },
                { label: 'Handler Assigned', value: 'handler_assigned' },
                { label: 'Dispatched', value: 'dispatched' },
                { label: 'Received', value: 'received' },
                { label: 'Completed', value: 'completed' },
                { label: 'Rejected', value: 'rejected' }
              ]}
              value={status}
              onChange={(e) => { setStatus(e.target.value); setCurrentPage(1); }}
              className="[&_select]:py-1.5 [&_select]:text-xs [&_label]:text-[10px] [&_select]:h-9"
            />
          </div>

          <div>
            <Select
              id="docType"
              label="Doc Type"
              placeholder="All Doc Types"
              options={[
                { label: 'Delivery Challan (DC)', value: 'DC' },
                { label: 'Returnable DC (RDC)', value: 'RDC' },
                { label: 'Invoice', value: 'Invoice' },
                { label: 'Emergency Send', value: 'Emergency Send' }
              ]}
              value={docType}
              onChange={(e) => { setDocType(e.target.value); setCurrentPage(1); }}
              className="[&_select]:py-1.5 [&_select]:text-xs [&_label]:text-[10px] [&_select]:h-9"
            />
          </div>

          <div>
            <Select
              id="flow"
              label="Type / Flow"
              placeholder="All Flows"
              options={[
                { label: 'Sent', value: 'sent' },
                { label: 'Received', value: 'received' }
              ]}
              value={flow}
              onChange={(e) => { setFlow(e.target.value); setCurrentPage(1); }}
              className="[&_select]:py-1.5 [&_select]:text-xs [&_label]:text-[10px] [&_select]:h-9"
            />
          </div>

          <div>
            <Select
              id="scope"
              label="Scope"
              placeholder="All Scopes"
              options={[
                { label: 'Internal (Employees)', value: 'internal' },
                { label: 'External (Non-Employees)', value: 'external' }
              ]}
              value={scope}
              onChange={(e) => { setScope(e.target.value); setCurrentPage(1); }}
              className="[&_select]:py-1.5 [&_select]:text-xs [&_label]:text-[10px] [&_select]:h-9"
            />
          </div>

          <div>
            <Select
              id="sender"
              label="Sender Employee"
              placeholder="All Senders"
              options={employees}
              value={senderName}
              onChange={(e) => { setSenderName(e.target.value); setCurrentPage(1); }}
              className="[&_select]:py-1.5 [&_select]:text-xs [&_label]:text-[10px] [&_select]:h-9"
            />
          </div>

          <div>
            <Select
              id="receiver"
              label="Receiver Employee"
              placeholder="All Receivers"
              options={employees}
              value={receiverName}
              onChange={(e) => { setReceiverName(e.target.value); setCurrentPage(1); }}
              className="[&_select]:py-1.5 [&_select]:text-xs [&_label]:text-[10px] [&_select]:h-9"
            />
          </div>

          <div>
            <Select
              id="handler"
              label="Logistics Handler"
              placeholder="All Handlers"
              options={employees}
              value={handlerName}
              onChange={(e) => { setHandlerName(e.target.value); setCurrentPage(1); }}
              className="[&_select]:py-1.5 [&_select]:text-xs [&_label]:text-[10px] [&_select]:h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="barcode" className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Barcode Search
            </label>
            <input
              id="barcode"
              type="text"
              placeholder="Scan or Enter Barcode..."
              value={barcodeQuery}
              onChange={(e) => { setBarcodeQuery(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-350 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all h-9 font-semibold"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="expectedReturnDate" className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Expected Return Date
            </label>
            <input
              id="expectedReturnDate"
              type="date"
              value={expectedReturnDate}
              onChange={(e) => { setExpectedReturnDate(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all h-9 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="startDate" className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Created From
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all h-9 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="endDate" className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Created To
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all h-9 cursor-pointer"
            />
          </div>

          {/* Action Buttons */}
          <div className="col-span-full flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-2.5 mt-1">
            {(status || docType || senderName || receiverName || handlerName || barcodeQuery || expectedReturnDate || startDate || endDate || flow !== 'all' || scope !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer h-8 text-xs px-3.5 font-semibold rounded-lg transition-all"
                onClick={() => {
                  setStatus('');
                  setDocType('');
                  setSenderName('');
                  setReceiverName('');
                  setHandlerName('');
                  setBarcodeQuery('');
                  setExpectedReturnDate('');
                  setStartDate('');
                  setEndDate('');
                  setFlow('all');
                  setScope('all');
                  setCurrentPage(1);
                }}
              >
                Clear Filters
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 cursor-pointer h-8 text-xs px-3.5 font-semibold rounded-lg transition-all"
              onClick={fetchReports}
              icon={RefreshCw}
            >
              Reload
            </Button>
          </div>

        </div>
      </Card>

      {/* Grid ledger */}
      <DataTable
        columns={columns}
        data={transactions}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => setCurrentPage(page)}
        emptyMessage="No material movement dossiers found matching the query rules."
      />
    </div>
  );
};

export default ReportsPage;
