import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Eye, History, ShieldAlert } from 'lucide-react';
import api from '../../lib/axios';
import Button from '../../components/ui/Button';
import DataTable from '../../components/ui/DataTable';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import Input from '../../components/ui/Input';

const AuditLogPage = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters State
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  // Selected Log for details Modal
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: 15,
        search,
        action: actionFilter,
        entity: entityFilter,
      };

      const response = await api.get('/audit-logs', { params });
      setLogs(response.data.data || []);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (err) {
      console.error('Fetch audit logs error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [currentPage, actionFilter, entityFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAuditLogs();
  };

  const getActionColor = (action) => {
    switch (action) {
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

  const columns = [
    {
      header: 'Actor',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {row.user?.fullName || 'System/Cron'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {row.user?.employeeId || 'SYSTEM'}
          </span>
        </div>
      ),
    },
    {
      header: 'Operation',
      cell: (row) => <Badge variant={getActionColor(row.action)}>{row.action}</Badge>,
    },
    {
      header: 'Entity Class',
      accessor: 'entity',
    },
    {
      header: 'Entity Ref',
      cell: (row) => <span className="font-mono text-xs text-slate-500 truncate max-w-[100px] block">{row.entityId}</span>,
    },
    {
      header: 'IP Address',
      cell: (row) => <span className="font-mono text-xs">{row.ipAddress || '127.0.0.1'}</span>,
    },
    {
      header: 'Timestamp',
      cell: (row) => (
        <span className="text-xs text-slate-500 font-medium">
          {new Date(row.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Dossier Diff',
      cell: (row) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSelectedLog(row)}
          icon={Eye}
          title="View Data Modification details"
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
            Audit Ledger
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Browse and query secure system modification logs and transaction histories
          </p>
        </div>
      </div>

      {/* Query filters */}
      <form onSubmit={handleSearchSubmit} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1">
          <Input
            id="search"
            placeholder="Search actor name, employee ID, entity ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
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

        <select
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setCurrentPage(1); }}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
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
      </form>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={logs}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => setCurrentPage(page)}
        emptyMessage="No audit logs match report criteria."
      />

      {/* Difference Details Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Audit Logs Detail & Data Modification Diff"
        size="lg"
      >
        {selectedLog && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 text-xs p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-lg">
              <div>
                <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px] block mb-0.5">Actor</span>
                <p className="font-bold">{selectedLog.user?.fullName || 'SYSTEM'}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px] block mb-0.5">IP Address</span>
                <p className="font-mono">{selectedLog.ipAddress}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px] block mb-0.5">Operation</span>
                <Badge variant={getActionColor(selectedLog.action)}>{selectedLog.action}</Badge>
              </div>
              <div>
                <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px] block mb-0.5">Timestamp</span>
                <p>{new Date(selectedLog.timestamp).toLocaleString()}</p>
              </div>
            </div>

            {/* Old vs New Data side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mt-2">
              <div>
                <span className="font-bold text-slate-500 uppercase tracking-wide text-[10px] block mb-1">Old State Ledger</span>
                <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg max-h-80 overflow-y-auto font-mono whitespace-pre-wrap select-all">
                  {selectedLog.oldData ? JSON.stringify(selectedLog.oldData, null, 2) : 'No prior state recorded.'}
                </div>
              </div>
              <div>
                <span className="font-bold text-slate-500 uppercase tracking-wide text-[10px] block mb-1">New State Ledger</span>
                <div className="p-3 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg max-h-80 overflow-y-auto font-mono whitespace-pre-wrap select-all">
                  {selectedLog.newData ? JSON.stringify(selectedLog.newData, null, 2) : 'No post-op state recorded.'}
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={() => setSelectedLog(null)}>
                Dismiss Diff
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AuditLogPage;
