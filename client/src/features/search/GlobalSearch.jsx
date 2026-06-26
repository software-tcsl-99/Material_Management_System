import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, FileText, Users, Download, ArrowRight, Eye } from 'lucide-react';
import api from '../../lib/axios';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';

const GlobalSearch = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ transactions: [], employees: [], externalReceipts: [] });
  const [error, setError] = useState('');

  const executeSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/search?q=${encodeURIComponent(query)}`);
      setResults({
        transactions: response.data.data?.transactions || [],
        employees: response.data.data?.employees || [],
        externalReceipts: response.data.data?.externalReceipts || [],
      });
    } catch (err) {
      console.error('Global search error:', err);
      setError('Failed to perform global search operations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeSearch();
  }, [query]);

  const hasResults = 
    results.transactions.length > 0 || 
    results.employees.length > 0 || 
    results.externalReceipts.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
          Global Search Dossier
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Query results matching query string: <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">"{query}"</span>
        </p>
      </div>

      {loading ? (
        <div className="h-[40vh] w-full flex flex-col items-center justify-center gap-3">
          <Spinner size="lg" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider animate-pulse">
            Searching indexes...
          </p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-semibold text-center">
          {error}
        </div>
      ) : !hasResults ? (
        <div className="p-16 text-center text-slate-400 font-semibold text-sm">
          No records matched your search query. Try searching by transaction IDs, document numbers, employee names, emails, barcodes, or vendor PO/PR references.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Matches: Transactions */}
          {results.transactions.length > 0 && (
            <Card title={`Material Movements Matches (${results.transactions.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">
                      <th className="px-4 py-2">Transaction ID</th>
                      <th className="px-4 py-2">Doc Ref</th>
                      <th className="px-4 py-2">Sender</th>
                      <th className="px-4 py-2">Receiver</th>
                      <th className="px-4 py-2">Total</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {results.transactions.map((txn) => (
                      <tr key={txn._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">{txn.transactionId}</td>
                        <td className="px-4 py-3">{txn.documentType} ({txn.documentNumber})</td>
                        <td className="px-4 py-3 font-medium">{txn.sender?.fullName || '—'}</td>
                        <td className="px-4 py-3 font-medium">{txn.receiver?.fullName || '—'}</td>
                        <td className="px-4 py-3 font-bold">₹{txn.grandTotal?.toLocaleString()}</td>
                        <td className="px-4 py-3"><Badge>{txn.status}</Badge></td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/transactions/${txn._id}`)}
                            icon={Eye}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Matches: External Receipts */}
          {results.externalReceipts.length > 0 && (
            <Card title={`External Supply Receipts Matches (${results.externalReceipts.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">
                      <th className="px-4 py-2">Receipt ID</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Vendor/Customer</th>
                      <th className="px-4 py-2">PO / DC Ref</th>
                      <th className="px-4 py-2">Total</th>
                      <th className="px-4 py-2">Logged Date</th>
                      <th className="px-4 py-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {results.externalReceipts.map((rec) => (
                      <tr key={rec._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">{rec.receiptId}</td>
                        <td className="px-4 py-3"><Badge variant="info">{rec.type}</Badge></td>
                        <td className="px-4 py-3 font-medium">{rec.type === 'vendor' ? rec.vendorName : rec.customerName}</td>
                        <td className="px-4 py-3 font-mono text-xs">{rec.poNumber || rec.documentNumber}</td>
                        <td className="px-4 py-3 font-bold">₹{rec.grandTotal?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{new Date(rec.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/receiving/${rec._id}`)}
                            icon={Eye}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Matches: Employees */}
          {results.employees.length > 0 && (
            <Card title={`Personnel Profiles Matches (${results.employees.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">
                      <th className="px-4 py-2">Employee ID</th>
                      <th className="px-4 py-2">Full Name</th>
                      <th className="px-4 py-2">Contact Details</th>
                      <th className="px-4 py-2">Department</th>
                      <th className="px-4 py-2">Location</th>
                      <th className="px-4 py-2">Role</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {results.employees.map((emp) => (
                      <tr key={emp._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono font-bold">{emp.employeeId}</td>
                        <td className="px-4 py-3 font-semibold">{emp.fullName}</td>
                        <td className="px-4 py-3 flex flex-col text-xs text-slate-500">
                          <span>{emp.email}</span>
                          <span>{emp.phone}</span>
                        </td>
                        <td className="px-4 py-3">{emp.department?.name || '—'}</td>
                        <td className="px-4 py-3">{emp.workLocation?.name || '—'}</td>
                        <td className="px-4 py-3"><Badge variant={emp.role === 'super_admin' ? 'default' : 'neutral'}>{emp.role}</Badge></td>
                        <td className="px-4 py-3"><Badge>{emp.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
