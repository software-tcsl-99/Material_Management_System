import { ArrowLeft, ArrowRight, Camera, MapPin, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GeoCamera from '../../components/geo-camera/GeoCamera';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import useGeoLocation from '../../hooks/useGeoLocation';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';

const CreateTransactionPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [step, setStep] = useState(1);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [receiverId, setReceiverId] = useState('');
  const [otherReceiverName, setOtherReceiverName] = useState('');
  const [documentType, setDocumentType] = useState('DC');
  const [documentNumber, setDocumentNumber] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [description, setDescription] = useState('');
  const [documentPhotos, setDocumentPhotos] = useState([]); // Document photos (step 2)
  const { getPosition } = useGeoLocation();
  const [fileUploading, setFileUploading] = useState(false);

  // Materials State
  const [materials, setMaterials] = useState([
    { name: '', description: '', qty: 1, unit: 'Nos', price: 0, barcode: '', photos: [] },
  ]);

  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await api.get('/employees');
        // Filter out the current logged in user so they can't send materials to themselves
        // Include all active employees (allow admins as receivers too, exclude super_admin)
        const list = (response.data.data || []).filter(
          (emp) => emp._id !== user?._id && emp.status === 'active' && emp.role !== 'super_admin'
        );
        const formatted = list.map(emp => ({ value: emp._id, label: `${emp.fullName} (${emp.employeeId})` }));
        formatted.push({ value: 'other', label: 'Other (Specify Name)' });
        setEmployees(formatted);
      } catch (err) {
        console.error('Error fetching employees:', err);
      }
    };
    fetchEmployees();
  }, [user]);

  // Material dynamic operations
  const handleAddMaterial = () => {
    setMaterials([
      ...materials,
      { name: '', description: '', qty: 1, unit: 'Nos', price: 0, barcode: '', photos: [] }
    ]);
  };

  const handleRemoveMaterial = (index) => {
    if (materials.length === 1) return;
    setMaterials(materials.filter((_, idx) => idx !== index));
  };

  const handleMaterialChange = (index, field, value) => {
    const updated = [...materials];
    if (field === 'qty' || field === 'price') {
      // coerce numeric input to a number; treat empty string as 0
      const raw = value === '' ? 0 : Number(value);
      updated[index][field] = Number.isNaN(raw) ? 0 : raw;
    } else {
      updated[index][field] = value ?? '';
    }
    setMaterials(updated);
  };

  const handleMaterialPhotoCapture = (materialIndex, photoData) => {
    const updated = [...materials];
    updated[materialIndex].photos = [...(updated[materialIndex].photos || []), photoData];
    setMaterials(updated);
  };

  const handleMaterialPhotoRemove = (materialIndex, photoIndex) => {
    const updated = [...materials];
    updated[materialIndex].photos = updated[materialIndex].photos.filter((_, idx) => idx !== photoIndex);
    setMaterials(updated);
  };

  // Document photo handlers
  const handleDocumentPhotoCapture = (photoData) => {
    setDocumentPhotos([...documentPhotos, photoData]);
  };

  const handleDocumentPhotoRemove = (index) => {
    setDocumentPhotos(documentPhotos.filter((_, idx) => idx !== index));
  };

  // Temporary file upload handler for document photos
  const handleDocumentFileUpload = async (file) => {
    if (!file) return;
    setFileUploading(true);
    try {
      // attempt to get location metadata
      let loc = { lat: 0, lng: 0, accuracy: 0, address: '' };
      try {
        const fetched = await getPosition();
        loc = fetched;
      } catch (err) {
        console.warn('Could not fetch location for upload fallback', err);
      }

      const fd = new FormData();
      fd.append('image', file);
      fd.append('folder', 'mms/document-photos');

      const resp = await api.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const uploadData = {
        url: resp.data.url,
        metadata: {
          lat: loc.lat || 0,
          lng: loc.lng || 0,
          accuracy: loc.accuracy || 0,
          address: loc.address || '',
          device: navigator.userAgent,
          capturedAt: new Date(),
        },
      };

      setDocumentPhotos((p) => [...p, uploadData]);
    } catch (err) {
      console.error('File upload failed:', err);
      setError('Upload failed. Please try another image.');
    } finally {
      setFileUploading(false);
    }
  };

  // Concurrent multiple file upload handler for a specific material
  const handleMaterialMultipleFilesUpload = async (materialIndex, files) => {
    if (!files || files.length === 0) return;
    setFileUploading(true);
    setError('');

    let loc = { lat: 0, lng: 0, accuracy: 0, address: '' };
    try {
      const fetched = await getPosition();
      loc = fetched;
    } catch (err) {
      console.warn('Could not fetch location for upload fallback', err);
    }

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fd = new FormData();
        fd.append('image', file);
        fd.append('folder', 'mms/material-photos');

        const resp = await api.post('/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        return {
          url: resp.data.url,
          metadata: {
            lat: loc.lat || 0,
            lng: loc.lng || 0,
            accuracy: loc.accuracy || 0,
            address: loc.address || '',
            device: navigator.userAgent,
            capturedAt: new Date(),
          },
        };
      });

      const newUploadedPhotos = await Promise.all(uploadPromises);
      const updated = [...materials];
      updated[materialIndex].photos = [...(updated[materialIndex].photos || []), ...newUploadedPhotos];
      setMaterials(updated);
    } catch (err) {
      console.error('Multiple file upload failed:', err);
      setError('One or more image uploads failed. Please try again.');
    } finally {
      setFileUploading(false);
    }
  };

  const calculateGrandTotal = () => {
    return materials.reduce((sum, item) => sum + ((Number(item.qty) || 0) * (Number(item.price) || 0)), 0);
  };

  // Next step validation
  const validateStep = () => {
    setError('');
    if (step === 1) {
      if (!receiverId) {
        setError('Please select a receiver');
        return false;
      }
      if (receiverId === 'other' && !otherReceiverName.trim()) {
        setError('Please specify receiver name');
        return false;
      }
      if (!documentNumber.trim()) {
        setError('Document number is required');
        return false;
      }
      if (documentType === 'RDC') {
        if (!expectedReturnDate) {
          setError('Expected return date is required for Returnable DC');
          return false;
        }
        const selectedDate = new Date(expectedReturnDate);
        selectedDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate <= today) {
          setError('Expected Return Date must be a future date');
          return false;
        }
      }
    } else if (step === 2) {
      if (documentPhotos.length === 0) {
        setError('At least one live geo-tagged document evidence photo is required');
        return false;
      }
    } else if (step === 3) {
      // Validate materials
      for (let i = 0; i < materials.length; i++) {
        const item = materials[i];
        if (!item.name.trim()) {
          setError(`Item ${i + 1} name is required`);
          return false;
        }
        if (item.qty <= 0) {
          setError(`Item ${i + 1} quantity must be greater than 0`);
          return false;
        }
        if (!item.barcode || !item.barcode.trim()) {
          setError(`Item ${i + 1} barcode is required`);
          return false;
        }
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) setStep(step + 1);
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  // Submit to Server
  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    setError('');

    // Compile transaction schema
    const payload = {
      receiver: receiverId,
      otherReceiverName: receiverId === 'other' ? otherReceiverName : '',
      documentType,
      documentNumber,
      expectedReturnDate: documentType === 'RDC' ? expectedReturnDate : undefined,
      description,
      materials: materials.map(m => ({
        name: m.name,
        description: m.description,
        quantity: Number(m.qty) || 0,
        unit: m.unit || 'Nos',
        price: Number(m.price) || 0,
        barcode: m.barcode || '',
        total: (Number(m.qty) || 0) * (Number(m.price) || 0),
        photos: m.photos || [],
      })),
      documentPhotos,
      photos: [], // Keep for backward compatibility
      grandTotal: calculateGrandTotal(),
      status: receiverId === 'other' ? 'completed' : 'pending'
    };

    // Debug log to help diagnose server 500s
    console.debug('CreateTransaction payload:', payload);

    try {
      await api.post('/transactions', payload);
      navigate('/transactions');
    } catch (err) {
      console.error('Failed to create transaction:', err);
      const resp = err.response?.data;
      if (resp) {
        if (resp.errors && Array.isArray(resp.errors)) {
          setError(`${resp.message} - ${resp.errors.join('; ')}`);
        } else if (resp.message) {
          setError(resp.message + (resp.error ? `: ${resp.error}` : ''));
        } else {
          setError('Failed to submit transaction. Check all fields.');
        }
      } else {
        setError('Failed to submit transaction. Network or server error.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/transactions')}
          className="p-1 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
            Send Material Movement Request
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Log a new physical material transfer out of this location
          </p>
        </div>
      </div>

      {/* Stepper Indicators */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-xl shadow-sm flex items-center justify-around gap-2 text-xs font-semibold">
        {[
          { num: 1, label: 'Document Details' },
          { num: 2, label: 'Geo Evidence Photo' },
          { num: 3, label: 'Material Items' }
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors
              ${step === s.num
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : step > s.num
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
              }
            `}>
              {step > s.num ? '✓' : s.num}
            </span>
            <span className={step === s.num ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400">
          {error}
        </div>
      )}

      {/* STEP 1: Details */}
      {step === 1 && (
        <Card title="Step 1: Document Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Select
              id="receiver"
              label="Select Receiver Employee"
              placeholder="Search or select employee..."
              options={employees}
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              required
            />

            {receiverId === 'other' && (
              <Input
                id="otherReceiverName"
                label="Receiver Name"
                placeholder="Enter receiver's name"
                value={otherReceiverName}
                onChange={(e) => setOtherReceiverName(e.target.value)}
                required
              />
            )}

            <Select
              id="documentType"
              label="Document Type"
              options={[
                { label: 'Delivery Challan (DC)/ FOC', value: 'DC' },
                { label: 'Returnable DC (RDC)', value: 'RDC' },
                { label: 'Invoice', value: 'Invoice' },
                { label: 'Emergency Send', value: 'Emergency Send' }
              ]}
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              required
            />

            <Input
              id="documentNumber"
              label="Document Number"
              placeholder="e.g. DC-10294, INV-8924"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              required
            />

            {documentType === 'RDC' && (
              <Input
                id="expectedReturnDate"
                label="Expected Return Date"
                type="date"
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                required
              />
            )}

            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label htmlFor="description" className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Overall Description / Remarks
              </label>
              <textarea
                id="description"
                placeholder="Details about the purpose of movement..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="block w-full rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 px-3.5 py-2.5 bg-white text-slate-900 border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:focus:ring-indigo-500"
                rows={3}
              />
            </div>
          </div>
        </Card>
      )}

      {/* STEP 2: Geo Photo */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          <GeoCamera onCapture={handleDocumentPhotoCapture} label="Document Evidence Photo Capture" />

          {/* Temporary upload fallback for testing without camera */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-500">Temporary Upload (for testing):</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleDocumentFileUpload(e.target.files[0])}
              disabled={fileUploading}
            />
            {fileUploading && <span className="text-xs text-slate-500">Uploading...</span>}
          </div>

          {/* Captured Document Photos Grid */}
          {documentPhotos.length > 0 && (
            <Card title="Captured Document Evidence Photos" subtitle="Geo-tagged metadata embedded">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {documentPhotos.map((ph, idx) => (
                  <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm aspect-video">
                    <img src={ph.url} alt="Document Evidence" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleDocumentPhotoRemove(idx)}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow cursor-pointer transition-colors"
                      title="Remove Image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 p-2 text-[9px] text-white">
                      <p className="font-bold truncate">{ph.metadata?.address || ''}</p>
                      <p>
                        Lat: {Number.isFinite(Number(ph.metadata?.lat)) ? Number(ph.metadata.lat).toFixed(4) : '0.0000'},
                        &nbsp;Lng: {Number.isFinite(Number(ph.metadata?.lng)) ? Number(ph.metadata.lng).toFixed(4) : '0.0000'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* STEP 3: Materials Table */}
      {step === 3 && (
        <Card
          title="Step 3: Add Materials"
          headerAction={
            <Button size="sm" onClick={handleAddMaterial} icon={Plus}>
              Add Row
            </Button>
          }
        >
          <div className="flex flex-col gap-4">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">
                    <th className="px-4 py-3">Material Name *</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 w-20">Qty *</th>
                    <th className="px-4 py-3 w-24">Unit</th>
                    <th className="px-4 py-3 w-28">Price (₹)</th>
                    <th className="px-4 py-3 w-24">Barcode *</th>
                    <th className="px-4 py-3 w-24">Total</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {materials.map((mat, idx) => (
                    <tr key={idx} className="text-slate-700 dark:text-slate-200">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          placeholder="Name"
                          value={mat.name ?? ''}
                          onChange={(e) => handleMaterialChange(idx, 'name', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 px-1 py-1 text-sm focus:outline-none dark:text-white"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          placeholder="e.g. Blue, large"
                          value={mat.description ?? ''}
                          onChange={(e) => handleMaterialChange(idx, 'description', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 px-1 py-1 text-sm focus:outline-none dark:text-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="1"
                          value={mat.qty ?? 0}
                          onChange={(e) => handleMaterialChange(idx, 'qty', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 px-1 py-1 text-sm focus:outline-none dark:text-white"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          placeholder="e.g. Nos, Kg"
                          value={mat.unit ?? ''}
                          onChange={(e) => handleMaterialChange(idx, 'unit', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 px-1 py-1 text-sm focus:outline-none dark:text-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          value={mat.price ?? 0}
                          onChange={(e) => handleMaterialChange(idx, 'price', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 px-1 py-1 text-sm focus:outline-none dark:text-white"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          placeholder="Barcode *"
                          value={mat.barcode ?? ''}
                          onChange={(e) => handleMaterialChange(idx, 'barcode', e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 px-1 py-1 text-sm focus:outline-none dark:text-white"
                          required
                        />
                      </td>
                      <td className="px-4 py-2 text-sm font-semibold">
                        {(() => {
                          const itemTotal = (Number(mat.qty) || 0) * (Number(mat.price) || 0);
                          return `₹${isFinite(itemTotal) ? itemTotal.toLocaleString() : '0'}`;
                        })()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterial(idx)}
                          disabled={materials.length === 1}
                          className="text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout for Adding Materials */}
            <div className="flex flex-col gap-4 md:hidden">
              {materials.map((mat, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-3 relative shadow-sm">
                  {/* Header / Number & Remove */}
                  <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800 pb-2">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Material #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMaterial(idx)}
                      disabled={materials.length === 1}
                      className="text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:pointer-events-none cursor-pointer p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Inputs Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Material Name *</label>
                      <input
                        type="text"
                        placeholder="Name"
                        value={mat.name ?? ''}
                        onChange={(e) => handleMaterialChange(idx, 'name', e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                        required
                      />
                    </div>

                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Description</label>
                      <input
                        type="text"
                        placeholder="e.g. Blue, large"
                        value={mat.description ?? ''}
                        onChange={(e) => handleMaterialChange(idx, 'description', e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Qty *</label>
                      <input
                        type="number"
                        min="1"
                        value={mat.qty ?? 0}
                        onChange={(e) => handleMaterialChange(idx, 'qty', e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Unit</label>
                      <input
                        type="text"
                        placeholder="e.g. Nos, Kg"
                        value={mat.unit ?? ''}
                        onChange={(e) => handleMaterialChange(idx, 'unit', e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={mat.price ?? 0}
                        onChange={(e) => handleMaterialChange(idx, 'price', e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Barcode *</label>
                      <input
                        type="text"
                        placeholder="Barcode"
                        value={mat.barcode ?? ''}
                        onChange={(e) => handleMaterialChange(idx, 'barcode', e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white"
                        required
                      />
                    </div>

                    <div className="col-span-2 flex justify-between items-center bg-slate-100 dark:bg-slate-950 px-3 py-2 rounded-lg mt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Item Total</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {(() => {
                          const itemTotal = (Number(mat.qty) || 0) * (Number(mat.price) || 0);
                          return `₹${isFinite(itemTotal) ? itemTotal.toLocaleString() : '0'}`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-lg">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Grand Total Valuation
              </span>
              <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                ₹{calculateGrandTotal().toLocaleString()}
              </span>
            </div>

            {/* Live Material Photos Box inside Step 3 Card - Per Material */}
            <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-5 flex flex-col gap-6">
              {materials.map((mat, matIdx) => (
                <div key={matIdx} className="flex flex-col gap-4 p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-200/60 dark:border-slate-850">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                      Photos for {mat.name || `Material ${matIdx + 1}`}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <GeoCamera
                        onCapture={(photoData) => handleMaterialPhotoCapture(matIdx, photoData)}
                        label={`Capture Photo for Material ${matIdx + 1}`}
                      />
                    </div>

                    <div className="flex flex-col justify-center items-center p-6 bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-350 dark:border-slate-700 rounded-xl gap-3">
                      <div className="p-3 bg-indigo-50 dark:bg-slate-800 rounded-full text-indigo-600 dark:text-indigo-400">
                        <Camera className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Upload Photos for Material {matIdx + 1}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleMaterialMultipleFilesUpload(matIdx, e.target.files)}
                        disabled={fileUploading}
                        className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-slate-800 dark:file:text-indigo-400 cursor-pointer"
                      />
                      {fileUploading && <span className="text-[10px] text-indigo-600 font-semibold animate-pulse">Uploading photos...</span>}
                    </div>
                  </div>

                  {/* Photos Gallery for this material */}
                  {mat.photos && mat.photos.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Attached Photos ({mat.photos.length})
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {mat.photos.map((ph, phIdx) => (
                          <div key={phIdx} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm aspect-video">
                            <img src={ph.url} alt={`Material ${matIdx + 1} Evidence`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleMaterialPhotoRemove(matIdx, phIdx)}
                              className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow cursor-pointer transition-colors"
                              title="Remove Image"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 p-2 text-[9px] text-white">
                              <p className="font-bold truncate flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-indigo-400 shrink-0" /> {ph.metadata?.address || 'Location registered'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Stepper Actions footer */}
      <div className="flex items-center justify-between border-t border-slate-200/85 dark:border-slate-800 pt-5">
        {step > 1 ? (
          <Button variant="outline" size="sm" onClick={prevStep} className="px-6">
            Previous Step
          </Button>
        ) : (
          <div /> // spacing helper
        )}

        {step < 3 ? (
          <Button size="sm" onClick={nextStep} icon={ArrowRight} className="px-6 flex-row-reverse">
            Next Step
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleSubmit}
            loading={submitting}
            icon={Save}
            className="px-6 bg-emerald-600 hover:bg-emerald-700"
          >
            Submit Movement Request
          </Button>
        )}
      </div>
    </div>
  );
};

export default CreateTransactionPage;
