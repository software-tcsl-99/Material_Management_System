import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import api from '../../lib/axios';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Card from '../../components/ui/Card';
import Spinner from '../../components/ui/Spinner';

const EditEmployeePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Masters lists
  const [depts, setDepts] = useState([]);
  const [desigs, setDesigs] = useState([]);
  const [locs, setLocs] = useState([]);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('employee');
  const [deptId, setDeptId] = useState('');
  const [desigId, setDesigId] = useState('');
  const [locId, setLocId] = useState('');

  const focusAndScroll = (id) => {
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        element.focus();
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [deptRes, desigRes, locRes, empRes] = await Promise.all([
          api.get('/masters/departments'),
          api.get('/masters/designations'),
          api.get('/masters/locations'),
          api.get(`/employees/${id}`),
        ]);

        const deptsList = deptRes.data.departments || deptRes.data.data || [];
        const desigsList = desigRes.data.designations || desigRes.data.data || [];
        const locsList = locRes.data.locations || locRes.data.data || [];
        const empData = empRes.data.data;

        setDepts(deptsList.filter(d => d.status === 'active' || d._id === empData.department?._id).map(d => ({ value: d._id, label: d.name })));
        setDesigs(desigsList.filter(d => d.status === 'active' || d._id === empData.designation?._id).map(d => ({ value: d._id, label: d.name })));
        setLocs(locsList.filter(d => d.status === 'active' || d._id === empData.workLocation?._id).map(d => ({ value: d._id, label: d.name })));

        setFullName(empData.fullName);
        setEmail(empData.email);
        setPhone(empData.phone);
        setRole(empData.role);
        setDeptId(empData.department?._id || empData.department || '');
        setDesigId(empData.designation?._id || empData.designation || '');
        setLocId(empData.workLocation?._id || empData.workLocation || '');
      } catch (err) {
        console.error('Fetch edit masters error:', err);
        setError('Failed to load employee details.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!deptId) {
      setError('Department configuration is required.');
      focusAndScroll('department');
      return;
    }
    if (!desigId) {
      setError('Designation configuration is required.');
      focusAndScroll('designation');
      return;
    }
    if (!locId) {
      setError('Work Location configuration is required.');
      focusAndScroll('workLocation');
      return;
    }

    setSubmitting(true);
    setError('');

    const payload = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role,
      department: deptId,
      designation: desigId,
      workLocation: locId
    };

    try {
      await api.put(`/employees/${id}`, payload);
      navigate('/employees');
    } catch (err) {
      console.error('Failed to update employee:', err);
      setError(err.response?.data?.message || 'Failed to update employee details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Retrieving employee registry...
        </p>
      </div>
    );
  }

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
            Edit Employee Account
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Modify corporate designations, locations, and roles
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card title="Personnel Profile">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Input
              id="fullName"
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <Input
              id="email"
              label="Corporate Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="phone"
              label="Phone Number"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Select
              id="department"
              label="Department"
              options={depts}
              value={deptId}
              onChange={(e) => setDeptId(e.target.value)}
              required
            />
            <Select
              id="designation"
              label="Designation"
              options={desigs}
              value={desigId}
              onChange={(e) => setDesigId(e.target.value)}
              required
            />
            <Select
              id="workLocation"
              label="Work Location"
              options={locs}
              value={locId}
              onChange={(e) => setLocId(e.target.value)}
              required
            />
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3.5 border-t border-slate-200 dark:border-slate-800 pt-5">
          <Button variant="outline" size="sm" onClick={() => navigate('/employees')} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={submitting} icon={Save}>
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditEmployeePage;
