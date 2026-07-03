import { CheckCircle, Edit2, Plus, RefreshCw, Search, ShieldAlert, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import api from '../../lib/axios';

const EmployeeListPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');

  // CSV Upload State
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
      const response = await api.post('/employees/upload-csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setCsvSuccess(response.data.message || 'Employees uploaded successfully.');
      setCsvFile(null);
      fetchEmployees();
    } catch (err) {
      console.error('CSV upload error:', err);
      setCsvError(err.response?.data?.message || 'Failed to upload CSV. Verify file format.');
    } finally {
      setCsvUploading(false);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await api.get('/employees');
      setEmployees(response.data.data || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleToggleStatus = async (id, currentStatus) => {
    const confirmation = window.confirm(
      `Are you sure you want to ${currentStatus === 'active' ? 'disable' : 'enable'} this employee account?`
    );
    if (!confirmation) return;

    try {
      await api.patch(`/employees/${id}/status`);
      fetchEmployees();
    } catch (err) {
      console.error('Toggle status error:', err);
      alert(err.response?.data?.message || 'Failed to update employee status.');
    }
  };

  const handleResetPassword = async (id, name) => {
    const confirmation = window.confirm(
      `Are you sure you want to reset password for ${name}? The new temporary password will be returned.`
    );
    if (!confirmation) return;

    try {
      const response = await api.patch(`/employees/${id}/reset-password`);
      const temp = response.data.defaultPassword || response.data.tempPassword || '';
      alert(
        `Password reset successfully!\n\nTemporary Password: ${temp}\n\nPlease copy this password and share it with the employee. They will be forced to change it on their next login.`
      );
    } catch (err) {
      console.error('Reset password error:', err);
      alert(err.response?.data?.message || 'Failed to reset password.');
    }
  };

  // Filter list on client side since list is typically small
  const filteredEmployees = employees.filter((emp) => {
    const term = search.toLowerCase();
    return (
      emp.fullName?.toLowerCase().includes(term) ||
      emp.employeeId?.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term) ||
      emp.phone?.includes(term) ||
      emp.department?.name?.toLowerCase().includes(term)
    );
  });

  const columns = [
    {
      header: 'Employee ID',
      cell: (row) => <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{row.employeeId}</span>,
    },
    {
      header: 'Full Name',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-400">
            {row.profilePhoto ? (
              <img src={row.profilePhoto} alt={row.fullName} className="w-full h-full object-cover" />
            ) : (
              row.fullName?.charAt(0) || 'U'
            )}
          </div>
          <span className="font-semibold">{row.fullName}</span>
        </div>
      ),
    },
    {
      header: 'Contact Details',
      cell: (row) => (
        <div className="flex flex-col text-xs">
          <span>{row.email}</span>
          <span className="text-slate-500">{row.phone}</span>
        </div>
      ),
    },
    {
      header: 'Company Node',
      cell: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300">{row.department?.name || '—'}</span>
          <span className="text-slate-500">{row.designation?.name || '—'}</span>
        </div>
      ),
    },
    {
      header: 'Role',
      cell: (row) => {
        if (row.role === 'super_admin') return <Badge variant="default">Super Admin</Badge>;
        if (row.role === 'department_admin') {
          if (row.departmentAdminType === 'management') return <Badge variant="default">Management</Badge>;
          return <Badge variant="default">Admin</Badge>;
        }
        if (row.role === 'team_lead') return <Badge variant="info">Team Lead</Badge>;
        return <Badge variant="neutral">Employee</Badge>;
      },
    },
    {
      header: 'Status',
      cell: (row) => <Badge>{row.status}</Badge>,
    },
    {
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/employees/edit/${row._id}`)}
            className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Edit Details"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleToggleStatus(row._id, row.status)}
            className={`p-1.5 ${row.status === 'active' ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50' : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50'} dark:hover:bg-slate-800`}
            title={row.status === 'active' ? 'Disable Account' : 'Enable Account'}
          >
            {row.status === 'active' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleResetPassword(row._id, row.fullName)}
            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800"
            title="Reset Password"
          >
            <ShieldAlert className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
            Employee Accounts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage system users, reset default security credentials, and configure roles
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => navigate('/employees/create')}
          icon={Plus}
          className="self-start sm:self-center"
        >
          Create Employee
        </Button>
      </div>

      {/* CSV Import Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex-1 flex flex-col gap-1.5">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Bulk CSV Upload (Employees)</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">CSV Header format:</span>
              <code className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded font-mono select-all">
                employeeId,fullName,email,phone,role,department,designation,workLocation
              </code>
            </div>
            <ul className="list-disc pl-4 text-xs text-slate-500 space-y-0.5 mt-1">
              <li><strong>employeeId, fullName, email</strong> are required</li>
              <li><strong>role</strong> can be <code>employee</code> or <code>admin</code> (super_admin is restricted)</li>
              <li><strong>department, designation, workLocation</strong> will be auto-resolved (or created if missing)</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVFileChange}
              id="csv-file-upload-employees"
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

      {/* Client Search Bar */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-nowrap">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, name, email, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchEmployees}
            icon={RefreshCw}
            disabled={loading}
            className="shrink-0"
          >
            Reload
          </Button>
        </div>
      </Card>

      {/* DataTable */}
      <DataTable
        columns={columns}
        data={filteredEmployees}
        loading={loading}
        emptyMessage="No employees registered in corporate database."
      />
    </div>
  );
};

export default EmployeeListPage;
