import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import TallyMaterialAutocomplete from '../../components/ui/TallyMaterialAutocomplete';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';

const EditTransactionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [description, setDescription] = useState('');

  // Routing dropdowns state
  const [mgtApprovers, setMgtApprovers] = useState([]);
  const [selectedMgt, setSelectedMgt] = useState('');

  // Materials State
  const [materials, setMaterials] = useState([
    { name: '', qty: 1, price: 0, unit: 'Nos' }
  ]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [empRes, txnRes] = await Promise.all([
          api.get('/employees?limit=1000&allDepartments=true'),
          api.get(`/transactions/${id}`),
        ]);

        const employeesList = empRes.data.employees || empRes.data.data || [];
        setMgtApprovers(
          employeesList
            .filter((emp) => emp.role === 'department_admin' && emp.departmentAdminType === 'management' && emp._id !== user?._id && emp.role !== 'super_admin')
            .map((emp) => ({ value: emp._id, label: `${emp.fullName} (${emp.employeeId})` }))
        );

        const txnData = txnRes.data.data || txnRes.data.transaction;

        // Safety check: can only edit before Team Lead approval
        if (!['draft', 'submitted'].includes(txnData.status)) {
          alert('You cannot edit a transaction that has already been approved, processed, or rejected.');
          navigate(`/transactions/${id}`);
          return;
        }

        const dateVal = txnData.dueDate || txnData.expectedReturnDate;
        setExpectedReturnDate(dateVal ? new Date(dateVal).toISOString().split('T')[0] : '');
        setDescription(txnData.description || '');
        setSelectedMgt(txnData.managementApprover?._id || txnData.managementApprover || '');

        const mappedMaterials = (txnData.materials || []).map((m) => ({
          name: m.name,
          qty: m.quantity !== undefined ? m.quantity : (m.qty || 1),
          unit: m.unit || 'Nos',
          price: m.price || 0
        }));
        setMaterials(mappedMaterials.length > 0 ? mappedMaterials : [{ name: '', qty: 1, price: 0, unit: 'Nos' }]);
      } catch (err) {
        console.error('Fetch edit data error:', err);
        setError('Failed to load transaction data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user, navigate]);

  // Materials Operations
  const handleAddMaterial = () => {
    setMaterials([
      ...materials,
      { name: '', qty: 1, price: 0, unit: 'Nos' }
    ]);
  };

  const handleRemoveMaterial = (index) => {
    if (materials.length === 1) return;
    setMaterials(materials.filter((_, idx) => idx !== index));
  };

  const handleMaterialChange = (index, field, value) => {
    const updated = [...materials];
    if (field === 'qty') {
      updated[index].qty = Math.max(1, Number(value) || 1);
    } else if (field === 'price') {
      updated[index].price = Math.max(0, Number(value) || 0);
    } else {
      updated[index][field] = value ?? '';
    }
    setMaterials(updated);
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!expectedReturnDate) {
      setError('Expected return date is required');
      return;
    }
    if (!description.trim()) {
      setError('Purpose is required');
      return;
    }
    if (!selectedMgt) {
      setError('Management Approver is required');
      return;
    }

    // Validate all materials
    for (let i = 0; i < materials.length; i++) {
      const mat = materials[i];
      if (!mat.name?.trim()) {
        setError(`Material Name is required for Row #${i + 1}`);
        return;
      }
      if (Number(mat.qty) <= 0) {
        setError(`Quantity must be greater than 0 for Row #${i + 1}`);
        return;
      }
    }

    setSubmitting(true);

    const payload = {
      isSimplified: true,
      expectedReturnDate,
      dueDate: expectedReturnDate,
      description,
      managementApprover: selectedMgt,
      materials: materials.map(m => ({
        name: m.name.trim(),
        quantity: Number(m.qty) || 1,
        unit: m.unit || 'Nos',
        price: Number(m.price) || 0,
        barcodes: []
      })),
      documentType: 'RDC'
    };

    try {
      await api.put(`/transactions/${id}`, payload);
      navigate(`/transactions/${id}`);
    } catch (err) {
      console.error('Update transaction failed:', err);
      setError(err.response?.data?.message || 'Failed to update transaction request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-semibold text-slate-500 tracking-wider">
          Loading Request Details...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/transactions/${id}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white m-0">
            Edit Material Request
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Sourcing and logistics transfer request with barcode loops</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card title="Simplified Sourcing Request Form">
          <div className="grid grid-cols-1 gap-5 text-xs font-semibold">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Input
                id="expectedReturnDate"
                label="Expected Return Date *"
                type="date"
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                required
              />

              <Select
                id="managementApprover"
                label="Choose Management Approver *"
                placeholder="Select Management Approver..."
                options={mgtApprovers}
                value={selectedMgt}
                onChange={(e) => setSelectedMgt(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 tracking-wider mb-1.5 font-semibold">Purpose / Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Purpose of request..."
                rows="3"
                className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-indigo-500 dark:text-white px-3 py-2 font-semibold"
                required
              />
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-350 tracking-wider">Materials Needed</h3>
                <Button size="xs" variant="outline" type="button" onClick={handleAddMaterial} className="flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </Button>
              </div>

              <div className="space-y-3">
                {materials.map((mat, idx) => (
                  <div key={idx} className="flex items-end gap-3 bg-slate-50/50 dark:bg-slate-900/30 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 relative">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-6">
                        <TallyMaterialAutocomplete
                          label={`${idx + 1}. Material Name *`}
                          placeholder="Search Tally inventory..."
                          value={mat.name}
                          onChange={(nameVal, unitVal, priceVal) => {
                            handleMaterialChange(idx, 'name', nameVal);
                            handleMaterialChange(idx, 'unit', unitVal || 'Nos');
                            handleMaterialChange(idx, 'price', priceVal || 0);
                          }}
                          required
                          className="px-2 py-1 bg-white text-slate-900 border-slate-300 dark:bg-slate-900 dark:text-white dark:border-slate-700 font-medium"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <Input
                          label="Quantity *"
                          type="number"
                          min="1"
                          value={mat.qty}
                          onChange={(e) => handleMaterialChange(idx, 'qty', e.target.value)}
                          required
                          inputClassName="px-2 py-1"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Input
                          label="Unit"
                          value={mat.unit || 'Nos'}
                          onChange={(e) => handleMaterialChange(idx, 'unit', e.target.value)}
                          required
                          disabled
                          inputClassName="px-2 py-1 bg-slate-50 dark:bg-slate-900 cursor-not-allowed text-slate-500 font-semibold"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Input
                          label="Est. Price (₹)"
                          type="number"
                          value={mat.price || 0}
                          onChange={(e) => handleMaterialChange(idx, 'price', e.target.value)}
                          required
                          disabled
                          inputClassName="px-2 py-1 bg-slate-50 dark:bg-slate-900 cursor-not-allowed text-slate-500 font-semibold"
                        />
                      </div>
                    </div>

                    {materials.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMaterial(idx)}
                        className="p-2.5 text-slate-400 hover:text-red-500 rounded-lg border border-slate-200 bg-white dark:bg-slate-955 dark:border-slate-800 hover:border-red-200 shrink-0 mb-0.5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end items-center gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <Button variant="ghost" type="button" onClick={() => navigate(`/transactions/${id}`)}>Cancel</Button>
              <Button variant="success" type="submit" disabled={submitting} icon={Save}>
                {submitting ? 'Saving request...' : 'Save & Resubmit Request'}
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
};

export default EditTransactionPage;
