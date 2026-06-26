import { ArrowLeft, CheckCircle2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import api from '../../lib/axios';

const CreateEmployeePage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Masters lists
  const [depts, setDepts] = useState([]);
  const [desigs, setDesigs] = useState([]);
  const [locs, setLocs] = useState([]);

  // Form State
  const [employeeId, setEmployeeId] = useState(() => 'EMP' + Math.floor(100000 + Math.random() * 900000));
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('employee');
  const [deptId, setDeptId] = useState('');
  const [desigId, setDesigId] = useState('');
  const [locId, setLocId] = useState('');

  // Password feedback modal
  const [tempPassword, setTempPassword] = useState('');

  useEffect(() => {
    const fetchMasters = async () => {
      setLoading(true);
      try {
        const [deptRes, desigRes, locRes] = await Promise.all([
          api.get('/masters/departments'),
          api.get('/masters/designations'),
          api.get('/masters/locations'),
        ]);

        const deptsList = deptRes.data.departments || deptRes.data.data || [];
        const desigsList = desigRes.data.designations || desigRes.data.data || [];
        const locsList = locRes.data.locations || locRes.data.data || [];

        setDepts(deptsList.filter(d => d.status === 'active').map(d => ({ value: d._id, label: d.name })));
        setDesigs(desigsList.filter(d => d.status === 'active').map(d => ({ value: d._id, label: d.name })));
        setLocs(locsList.filter(d => d.status === 'active').map(d => ({ value: d._id, label: d.name })));
      } catch (err) {
        console.error('Fetch masters error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMasters();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!deptId || !desigId || !locId) {
      setError('Please configure Department, Designation, and Location.');
      return;
    }

    setSubmitting(true);
    setError('');

    const payload = {
      employeeId: employeeId,
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role,
      department: deptId,
      designation: desigId,
      workLocation: locId
    };

    try {
      const response = await api.post('/employees', payload);
      setTempPassword(response.data.tempPassword);
    } catch (err) {
      console.error('Failed to create employee:', err);
      setError(err.response?.data?.message || 'Failed to register employee. Check unique constraints.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/employees')}
          className="p-1 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
            Create Employee Account
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Add a new employee and configure system node assignments
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400">
          {error}
        </div>
      )}

      {tempPassword ? (
        <div className="flex flex-col gap-6">
          <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-lg text-emerald-800 dark:text-emerald-400">Employee Account Registered!</h3>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              The user has been successfully registered. Share the temporary password below to allow them to access the portal. They will be forced to change it on first login.
            </p>
          </div>

          <Card title="Temporary Access Credentials" className="text-center flex flex-col items-center gap-4 py-8">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Temporary Password</span>
            <span className="text-3xl font-extrabold font-mono select-all bg-indigo-50 border border-indigo-100 dark:bg-slate-950 dark:border-slate-800 text-indigo-700 dark:text-indigo-400 px-6 py-3 rounded-lg">
              {tempPassword}
            </span>
            <Button size="sm" onClick={() => navigate('/employees')} className="mt-3 px-8">
              Done & Return
            </Button>
          </Card>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Card title="Personnel Profile">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Input
                id="employeeId"
                label="Employee ID (Auto-generated)"
                value={employeeId}
                disabled
                required
              />
              <Input
                id="fullName"
                label="Full Name"
                placeholder="e.g. James Miller"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <Input
                id="email"
                label="Corporate Email"
                type="email"
                placeholder="e.g. james.m@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                id="phone"
                label="Phone Number"
                placeholder="e.g. +91 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <Select
                id="role"
                label="System Authorization Role"
                options={[
                  { label: 'Employee (Standard Portal Access)', value: 'employee' },
                  { label: 'Admin (System Control)', value: 'admin' }
                ]}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              />
            </div>
          </Card>

          <Card title="Corporate Node Configuration">
            {loading ? (
              <div className="py-8 flex justify-center"><Spinner size="sm" /></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Select
                  id="department"
                  label="Department"
                  placeholder="Select Department..."
                  options={depts}
                  value={deptId}
                  onChange={(e) => setDeptId(e.target.value)}
                  required
                />
                <Select
                  id="designation"
                  label="Designation"
                  placeholder="Select Designation..."
                  options={desigs}
                  value={desigId}
                  onChange={(e) => setDesigId(e.target.value)}
                  required
                />
                <Select
                  id="workLocation"
                  label="Work Location"
                  placeholder="Select Location..."
                  options={locs}
                  value={locId}
                  onChange={(e) => setLocId(e.target.value)}
                  required
                />
              </div>
            )}
          </Card>

          <div className="flex items-center justify-end gap-3.5 border-t border-slate-200 dark:border-slate-800 pt-5">
            <Button variant="outline" size="sm" onClick={() => navigate('/employees')} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting} icon={Save}>
              Register Employee
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default CreateEmployeePage;
