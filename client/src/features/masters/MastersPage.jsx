import { CheckCircle, Edit2, Plus, Save, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import DataTable from '../../components/ui/DataTable';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Tabs from '../../components/ui/Tabs';
import api from '../../lib/axios';

const MastersPage = () => {
  const [activeTab, setActiveTab] = useState('department');
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);

  // CSV upload state
  const [csvFile, setCsvFile] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvSuccess, setCsvSuccess] = useState('');
  const [csvError, setCsvError] = useState('');

  const handleCSVFileChange = (e) => {
    setCsvFile(e.target.files?.[0] || null);
    setCsvSuccess('');
    setCsvError('');
  };

  const handleCSVUpload = async () => {
    if (!csvFile) return;
    setCsvUploading(true);
    setCsvSuccess('');
    setCsvError('');

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const response = await api.post('/masters/upload-csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setCsvSuccess(response.data.message || 'CSV imported successfully.');
      setCsvFile(null);
      fetchMastersList();
    } catch (err) {
      console.error('CSV upload error:', err);
      setCsvError(err.response?.data?.message || 'Failed to upload CSV. Verify file format.');
    } finally {
      setCsvUploading(false);
    }
  };

  // Modal configurations for Add/Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null); // null for Add, item object for Edit
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Forms Fields state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  const fetchMastersList = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      if (activeTab === 'department') endpoint = '/masters/departments';
      else if (activeTab === 'designation') endpoint = '/masters/designations';
      else endpoint = '/masters/locations';

      const response = await api.get(endpoint);
      // Server returns different keys depending on resource. Normalize to array.
      let payload = [];
      if (activeTab === 'department') payload = response.data?.departments || response.data?.data || [];
      else if (activeTab === 'designation') payload = response.data?.designations || response.data?.data || [];
      else payload = response.data?.locations || response.data?.data || [];
      setList(payload || []);
    } catch (err) {
      console.error('Fetch masters list error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMastersList();
  }, [activeTab]);

  const openAddModal = () => {
    setEditItem(null);
    setName('');
    setAddress('');
    setLat('');
    setLng('');
    setModalError('');
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditItem(item);
    setName(item.name);
    if (activeTab === 'location') {
      setAddress(item.address || '');
      setLat(item.coordinates?.lat || '');
      setLng(item.coordinates?.lng || '');
    }
    setModalError('');
    setModalOpen(true);
  };

  const handleToggleStatus = async (item) => {
    const confirmText = `Are you sure you want to ${item.status === 'active' ? 'disable' : 'enable'} this ${activeTab}?`;
    if (!window.confirm(confirmText)) return;

    try {
      let endpoint = `/masters/${activeTab}s/${item._id}/status`;
      await api.patch(endpoint);
      fetchMastersList();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to update status.');
    }
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setModalError('Name is required');
      return;
    }

    setSubmitting(true);
    setModalError('');

    try {
      let endpoint = `/masters/${activeTab}s`;
      let payload = { name: name.trim() };

      if (activeTab === 'location') {
        payload.address = address.trim();
        payload.coordinates = {
          lat: parseFloat(lat) || 0,
          lng: parseFloat(lng) || 0,
        };
      }

      if (editItem) {
        // Edit flow
        await api.put(`${endpoint}/${editItem._id}`, payload);
      } else {
        // Create flow
        await api.post(endpoint, payload);
      }

      setModalOpen(false);
      fetchMastersList();
    } catch (err) {
      console.error('Master write error:', err);
      setModalError(err.response?.data?.message || 'Transaction failed. Check input data.');
    } finally {
      setSubmitting(false);
    }
  };

  // Build columns based on tab type
  const getColumns = () => {
    const actionsCell = (row) => (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openEditModal(row)}
          className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800"
          title="Edit Details"
        >
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleToggleStatus(row)}
          className={`p-1.5 ${row.status === 'active' ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50' : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50'} dark:hover:bg-slate-800`}
          title={row.status === 'active' ? 'Disable' : 'Enable'}
        >
          {row.status === 'active' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
        </Button>
      </div>
    );

    const commonCols = [
      {
        header: 'Name',
        accessor: 'name',
        className: 'font-semibold text-slate-900 dark:text-white',
      },
      {
        header: 'Status',
        cell: (row) => <Badge>{row.status}</Badge>,
      },
    ];

    if (activeTab === 'location') {
      return [
        {
          header: 'Location Name',
          accessor: 'name',
          className: 'font-semibold text-slate-900 dark:text-white',
        },
        {
          header: 'Physical Address',
          accessor: 'address',
          className: 'max-w-[200px] truncate',
        },
        {
          header: 'GPS Coordinates',
          cell: (row) => (
            <span className="font-mono text-xs text-slate-500">
              {row.coordinates?.lat?.toFixed(5)}, {row.coordinates?.lng?.toFixed(5)}
            </span>
          ),
        },
        {
          header: 'Status',
          cell: (row) => <Badge>{row.status}</Badge>,
        },
        {
          header: 'Actions',
          cell: actionsCell,
        },
      ];
    }

    return [
      ...commonCols,
      {
        header: 'Actions',
        cell: actionsCell,
      },
    ];
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
            Master Data Configuration
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Setup corporate node lists (departments, designations, and work locations)
          </p>
        </div>
        <Button
          size="sm"
          onClick={openAddModal}
          icon={Plus}
          className="self-start sm:self-center"
        >
          Add {activeTab}
        </Button>
      </div>

      {/* CSV Import Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1 flex flex-col gap-1.5">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Bulk CSV Upload (Master Data)</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">CSV Header format:</span>
              <code className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded font-mono select-all">
                type,name,address,lat,lng
              </code>
            </div>
            <ul className="list-disc pl-4 text-xs text-slate-500 space-y-0.5 mt-1">
              <li><strong>type</strong> must be: <code>department</code>, <code>designation</code>, or <code>location</code> (or <code>workplace</code>)</li>
              <li><strong>name</strong> is the unique identifier for the master node</li>
              <li><strong>address, lat, lng</strong> are optional/only needed when type is location</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVFileChange}
              id="csv-file-upload-masters"
              className="block text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-slate-800 dark:file:text-indigo-400 cursor-pointer"
            />
            {csvFile && (
              <Button
                size="sm"
                onClick={handleCSVUpload}
                loading={csvUploading}
              >
                Upload CSV
              </Button>
            )}
          </div>
        </div>

        {csvSuccess && (
          <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {csvSuccess}
          </div>
        )}
        {csvError && (
          <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400">
            {csvError}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-2.5 rounded-xl shadow-sm">
        <Tabs
          tabs={[
            { label: 'Departments List', value: 'department' },
            { label: 'Designations List', value: 'designation' },
            { label: 'Work Locations List', value: 'location' }
          ]}
          activeTab={activeTab}
          onChange={(val) => setActiveTab(val)}
        />
      </div>

      {/* DataTable */}
      <DataTable
        columns={getColumns()}
        data={list}
        loading={loading}
        emptyMessage={`No ${activeTab} nodes registered in company master list.`}
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? `Edit ${activeTab}` : `Create ${activeTab}`}
      >
        <form onSubmit={handleModalSubmit} className="flex flex-col gap-4">
          {modalError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400">
              {modalError}
            </div>
          )}

          <Input
            id="name"
            label={`${activeTab} Name`}
            placeholder={`e.g. Sales, Manager, Warehouse A`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {activeTab === 'location' && (
            <>
              <Input
                id="address"
                label="Physical Address"
                placeholder="Full Street address..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="lat"
                  label="Latitude"
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 19.0760"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                />
                <Input
                  id="lng"
                  label="Longitude"
                  type="number"
                  step="0.000001"
                  placeholder="e.g. 72.8777"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2.5 mt-2">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting} icon={Save}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MastersPage;
