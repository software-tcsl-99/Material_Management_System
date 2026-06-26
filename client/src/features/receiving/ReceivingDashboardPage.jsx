import { ArrowRight, Download, Eye, FileSpreadsheet, Layers, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Tabs from '../../components/ui/Tabs';
import api from '../../lib/axios';

const ReceivingDashboardPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('internal');
  const [loading, setLoading] = useState(false);
  const [internalReceipts, setInternalReceipts] = useState([]);
  const [externalReceipts, setExternalReceipts] = useState([]);

  const handleDownload = async (id, type) => {
    try {
      const response = await api.get(`/receiving/${id}/export/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', response.headers['content-disposition']?.split('filename=')[1] || `receipt.${type}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      if (activeTab === 'internal') {
        const response = await api.get('/receiving/internal');
        setInternalReceipts(response.data.data || []);
      } else {
        const response = await api.get('/receiving/external');
        setExternalReceipts(response.data.data || []);
      }
    } catch (err) {
      console.error('Fetch receipts error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [activeTab]);

  const internalColumns = [
    {
      header: 'Txn ID',
      cell: (row) => <span className="font-bold text-indigo-600 dark:text-indigo-400">{row.transaction?.transactionId}</span>,
    },
    {
      header: 'Sender',
      cell: (row) => <span>{row.transaction?.sender?.fullName || '—'}</span>,
    },
    {
      header: 'Condition',
      cell: (row) => <Badge>{row.materialCondition}</Badge>,
    },
    {
      header: 'Date Received',
      cell: (row) => <span>{new Date(row.createdAt).toLocaleDateString()}</span>,
    },
    {
      header: 'Remarks',
      accessor: 'remarks',
    },
    {
      header: 'Action',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/transactions/${row.transaction?._id}`)}
            icon={Eye}
            title="View Transaction Dossier"
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDownload(row._id, 'pdf')}
            icon={Download}
            title="Download PDF"
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDownload(row._id, 'excel')}
            icon={FileSpreadsheet}
            title="Download Excel"
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          />
        </div>
      ),
    },
  ];

  const externalColumns = [
    {
      header: 'Receipt ID',
      cell: (row) => <span className="font-bold text-indigo-600 dark:text-indigo-400">{row.receiptId}</span>,
    },
    {
      header: 'Type',
      cell: (row) => <Badge variant="info">{row.type}</Badge>,
    },
    {
      header: 'Vendor/Customer',
      cell: (row) => <span>{row.type === 'vendor' ? row.vendorName : row.customerName}</span>,
    },
    {
      header: 'Grand Total',
      cell: (row) => <span>₹{row.grandTotal?.toLocaleString()}</span>,
    },
    {
      header: 'Date Logged',
      cell: (row) => <span>{new Date(row.createdAt).toLocaleDateString()}</span>,
    },
    {
      header: 'Action',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/receiving/${row._id}`)}
            icon={Eye}
            title="View Receipt Dossier"
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDownload(row._id, 'pdf')}
            icon={Download}
            title="Download PDF"
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDownload(row._id, 'excel')}
            icon={FileSpreadsheet}
            title="Download Excel"
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
          Receiving Hub
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Select a receiving workflow or monitor receipt audit trials
        </p>
      </div>

      {/* Workflow Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card
          className="hover:border-indigo-500/40 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => navigate('/receiving/internal')}
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-slate-800 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Layers className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Receive Internal Shipment <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Log and verify material movements sent by other departments or company personnel. Resolves active transfer timelines.
              </p>
            </div>
          </div>
        </Card>

        <Card
          className="hover:border-indigo-500/40 hover:shadow-md transition-all cursor-pointer group"
          onClick={() => navigate('/receiving/external')}
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-slate-800 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Truck className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Receive External Supply <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Log material inventory shipments received directly from outside vendors (PO fulfillment) or customer returns.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* History log tabs */}
      <Card title="Receiving History Logs">
        <div className="flex flex-col gap-4">
          <Tabs
            tabs={[
              { label: 'Internal Receipts Ledger', value: 'internal' },
              { label: 'External Receipts Ledger', value: 'external' }
            ]}
            activeTab={activeTab}
            onChange={(val) => setActiveTab(val)}
          />

          <DataTable
            columns={activeTab === 'internal' ? internalColumns : externalColumns}
            data={activeTab === 'internal' ? internalReceipts : externalReceipts}
            loading={loading}
            emptyMessage={`No logged ${activeTab} receipts recorded.`}
          />
        </div>
      </Card>
    </div>
  );
};

export default ReceivingDashboardPage;
