import { AlertCircle, Calendar, CheckCircle, Eye, History, Layers, RefreshCw, Search, ShieldAlert, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import api from '../../lib/axios';

const AuditLogPage = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Filters State
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [limit, setLimit] = useState(15);

  // Selected Log for details Modal
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: limit === 'all' ? 100000 : limit,
        search,
        action: actionFilter,
        entity: entityFilter,
      };

      const response = await api.get('/audit-logs', { params });
      setLogs(response.data.data || []);
      const total = response.data.total || 0;
      setTotalLogs(total);

      const parsedLimit = limit === 'all' ? total : limit;
      setTotalPages(Math.ceil(total / (parsedLimit || 15)) || 1);
    } catch (err) {
      console.error('Fetch audit logs error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [currentPage, actionFilter, entityFilter, limit]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAuditLogs();
  };

  const getActionColor = (action) => {
    switch (action?.toLowerCase()) {
      case 'create': return 'success';
      case 'edit': return 'warning';
      case 'delete': return 'danger';
      case 'approve': return 'success';
      case 'reject': return 'danger';
      case 'resubmit': return 'warning';
      case 'receive': return 'default';
      default: return 'neutral';
    }
  };

  // Helper to extract fields changed
  const getDiffDetails = (before, after) => {
    const diffs = [];
    const allKeys = Array.from(new Set([...Object.keys(before || {}), ...Object.keys(after || {})]));
    for (const key of allKeys) {
      if (['_id', '__v', 'createdAt', 'updatedAt', 'updatedBy', 'createdBy'].includes(key)) continue;
      const oldVal = before?.[key];
      const newVal = after?.[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diffs.push({
          key,
          oldVal: oldVal !== undefined ? (typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal)) : '(none)',
          newVal: newVal !== undefined ? (typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal)) : '(none)'
        });
      }
    }
    return diffs;
  };

  const columns = [
    {
      header: 'Actor',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0 border border-blue-100 dark:border-blue-900/50">
            {row.user?.fullName?.charAt(0) || 'S'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
              {row.user?.fullName || 'System/Cron'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {row.user?.employeeId || 'SYSTEM'}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Operation',
      cell: (row) => <Badge variant={getActionColor(row.action)}>{row.action}</Badge>,
    },
    {
      header: 'Entity Class',
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-350">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.entity}</span>
        </div>
      ),
    },
    {
      header: 'Entity Ref',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-400 font-bold bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded border border-slate-100 dark:border-slate-800 truncate max-w-[150px] block">
          {row.entityId}
        </span>
      ),
    },
    {
      header: 'Timestamp',
      cell: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium">
            {new Date(row.createdAt).toLocaleString()}
          </span>
        </div>
      ),
    },
    {
      header: 'Dossier Diff',
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSelectedLog(row)}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Eye className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-1">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 dark:from-blue-950 dark:via-slate-900 dark:to-indigo-950 text-white rounded-3xl p-6 md:p-8 shadow-lg border border-blue-500/20 dark:border-indigo-500/10">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-0 bottom-0 -translate-x-12 translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 shadow-inner">
              <History className="w-8 h-8 text-blue-100" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight m-0 bg-clip-text bg-gradient-to-r from-white via-blue-50 to-indigo-100">
                Audit Ledger
              </h1>
              <p className="text-xs md:text-sm text-blue-200/90 font-medium mt-1.5 max-w-xl leading-relaxed">
                Browse and query secure system modification logs, state change records, and user transaction histories.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchAuditLogs}
            className="flex items-center gap-2 self-start md:self-auto px-4 py-2.5 bg-white/10 hover:bg-white/15 active:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/10 hover:border-white/20 backdrop-blur-sm transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Logs
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Total Actions Logged</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">
              {totalLogs.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Deletes & Rejections</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">
              {logs.filter(l => ['delete', 'reject'].includes(l.action?.toLowerCase())).length} on Page
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase tracking-wider">Creates & Approvals</span>
            <span className="text-2xl font-black text-slate-800 dark:text-white mt-1 block">
              {logs.filter(l => ['create', 'approve'].includes(l.action?.toLowerCase())).length} on Page
            </span>
          </div>
        </div>
      </div>

      {/* Query Filters */}
      <form onSubmit={handleSearchSubmit} className="bg-white dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search actor, ID, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition focus:outline-none"
          />
        </div>

        <div>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
            className="block w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none cursor-pointer transition"
          >
            <option value="">All Operations</option>
            <option value="create">create</option>
            <option value="edit">edit</option>
            <option value="delete">delete</option>
            <option value="approve">approve</option>
            <option value="reject">reject</option>
            <option value="resubmit">resubmit</option>
            <option value="receive">receive</option>
          </select>
        </div>

        <div>
          <select
            value={entityFilter}
            onChange={(e) => { setEntityFilter(e.target.value); setCurrentPage(1); }}
            className="block w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none cursor-pointer transition"
          >
            <option value="">All Entity Classes</option>
            <option value="Transaction">Transaction</option>
            <option value="Employee">Employee</option>
            <option value="Department">Department</option>
            <option value="Designation">Designation</option>
            <option value="Location">Location</option>
            <option value="InternalReceipt">InternalReceipt</option>
            <option value="ExternalReceipt">ExternalReceipt</option>
          </select>
        </div>

        <div>
          <select
            value={limit}
            onChange={(e) => {
              const val = e.target.value;
              setLimit(val === 'all' ? 'all' : parseInt(val, 10));
              setCurrentPage(1);
            }}
            className="block w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none cursor-pointer transition"
          >
            <option value={15}>Show 15 Per Page</option>
            <option value={30}>Show 30 Per Page</option>
            <option value={50}>Show 50 Per Page</option>
            <option value={100}>Show 100 Per Page</option>
            <option value="all">Show All Logs</option>
          </select>
        </div>
      </form>

      {/* DataTable */}
      <div className="bg-white dark:bg-slate-900/20 rounded-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden shadow-sm">
        <DataTable
          columns={columns}
          data={logs}
          loading={loading}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(page)}
          emptyMessage="No audit logs match report criteria."
        />
      </div>

      {/* Difference Details Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Audit Dossier & Modification Diff"
        size="lg"
      >
        {selectedLog && (
          <div className="flex flex-col gap-5 p-1">
            {/* Metadata Summary Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 rounded-2xl">
              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px] block mb-0.5">Actor</span>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <p className="font-bold text-xs text-slate-700 dark:text-slate-200">{selectedLog.user?.fullName || 'SYSTEM'}</p>
                </div>
              </div>
              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px] block mb-0.5">Operation</span>
                <Badge variant={getActionColor(selectedLog.action)}>{selectedLog.action}</Badge>
              </div>
              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px] block mb-0.5">Entity</span>
                <p className="font-semibold text-xs text-slate-700 dark:text-slate-200">{selectedLog.entity} ({selectedLog.entityId})</p>
              </div>
              <div>
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px] block mb-0.5">Timestamp</span>
                <p className="text-xs text-slate-700 dark:text-slate-200">{new Date(selectedLog.createdAt).toLocaleString()}</p>
              </div>
            </div>

            {/* Description */}
            {selectedLog.description && (
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/50 dark:border-blue-900/30 rounded-xl flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-350">
                <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p>{selectedLog.description}</p>
              </div>
            )}

            {/* Diff Analysis */}
            {(() => {
              const diffs = getDiffDetails(selectedLog.before, selectedLog.after);
              if (diffs.length > 0) {
                return (
                  <div className="flex flex-col gap-2">
                    <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">Property Modification Diff ({diffs.length} fields changed)</span>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs max-h-80 overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                            <th className="p-3">Field</th>
                            <th className="p-3">Previous State</th>
                            <th className="p-3">Updated State</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                          {diffs.map((diff, index) => (
                            <tr key={index} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20 font-mono">
                              <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 font-sans">{diff.key}</td>
                              <td className="p-3 text-red-600 dark:text-red-400 bg-red-50/20 dark:bg-red-950/10 font-bold truncate max-w-[150px]">{diff.oldVal}</td>
                              <td className="p-3 text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10 font-bold truncate max-w-[150px]">{diff.newVal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AuditLogPage;
