import { ArrowLeft, Camera, Plus, Save, Trash2, Check, ArrowRight } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';
import { BrowserMultiFormatReader } from '@zxing/browser';

const CreateTransactionPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [receiverId, setReceiverId] = useState('');
  const [otherReceiverName, setOtherReceiverName] = useState('');
  const [documentType, setDocumentType] = useState('RDC'); // Default documentType is RDC
  const [documentNumber, setDocumentNumber] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [description, setDescription] = useState('');
  
  // New fields
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [dcType, setDcType] = useState('DC-Internal');

  // Materials State
  const [materials, setMaterials] = useState([
    { name: '', description: '', qty: 1, unit: 'Nos', price: 0, barcodes: [''], photos: [] },
  ]);

  // Barcode Scanner Modal State
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeScanTarget, setActiveScanTarget] = useState(null); // { matIdx, bcIdx }
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await api.get('/employees');
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

  // Materials Operations
  const handleAddMaterial = () => {
    setMaterials([
      ...materials,
      { name: '', description: '', qty: 1, unit: 'Nos', price: 0, barcodes: [''], photos: [] }
    ]);
  };

  const handleRemoveMaterial = (index) => {
    if (materials.length === 1) return;
    setMaterials(materials.filter((_, idx) => idx !== index));
  };

  const handleMaterialChange = (index, field, value) => {
    const updated = [...materials];
    if (field === 'qty') {
      const qtyNum = Math.max(1, Number(value) || 1);
      updated[index].qty = qtyNum;
      
      const current = updated[index].barcodes || [];
      if (current.length < qtyNum) {
        const diff = qtyNum - current.length;
        for (let i = 0; i < diff; i++) current.push('');
      } else if (current.length > qtyNum) {
        current.length = qtyNum;
      }
      updated[index].barcodes = current;
    } else if (field === 'price') {
      const raw = value === '' ? 0 : Number(value);
      updated[index].price = Number.isNaN(raw) ? 0 : raw;
    } else {
      updated[index][field] = value ?? '';
    }
    setMaterials(updated);
  };

  const handleBarcodeValChange = (matIdx, bcIdx, val) => {
    const updated = [...materials];
    updated[matIdx].barcodes[bcIdx] = val;
    setMaterials(updated);
  };

  // Scanner actions
  const startScanner = (matIdx, bcIdx) => {
    setActiveScanTarget({ matIdx, bcIdx });
    setScannerOpen(true);
    setError('');

    setTimeout(() => {
      if (videoRef.current) {
        const codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;
        codeReader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
          if (result) {
            handleBarcodeValChange(matIdx, bcIdx, result.getText());
            stopScanner();
          }
        }).catch(err => {
          console.error('Camera stream init failed:', err);
        });
      }
    }, 300);
  };

  const stopScanner = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }
    setScannerOpen(false);
    setActiveScanTarget(null);
  };

  const simulateScan = () => {
    if (activeScanTarget) {
      const randCodes = ['BC-00010-9943', 'BC-00012-1082', 'BC-00014-9982', 'BC-00016-8341', 'BC-00018-7243'];
      const pickCode = randCodes[Math.floor(Math.random() * randCodes.length)];
      handleBarcodeValChange(activeScanTarget.matIdx, activeScanTarget.bcIdx, pickCode);
      stopScanner();
    }
  };

  const calculateGrandTotal = () => {
    return materials.reduce((sum, item) => sum + ((Number(item.qty) || 0) * (Number(item.price) || 0)), 0);
  };

  // Validation
  const validateForm = () => {
    setError('');
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
    if (documentType === 'RDC' && !expectedReturnDate) {
      setError('Expected return date is required for Returnable DC');
      return false;
    }

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
      for (let j = 0; j < item.barcodes.length; j++) {
        if (!item.barcodes[j] || !item.barcodes[j].trim()) {
          setError(`Item ${i + 1} barcode #${j + 1} is required`);
          return false;
        }
      }
    }
    return true;
  };

  // Submit
  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    setError('');

    const payload = {
      receiver: receiverId === 'other' ? undefined : receiverId,
      otherReceiverName: receiverId === 'other' ? otherReceiverName : '',
      documentType,
      documentNumber,
      expectedReturnDate: documentType === 'RDC' ? expectedReturnDate : undefined,
      description,
      priority,
      dueDate: dueDate || undefined,
      costCenter,
      dcType,
      materials: materials.map(m => ({
        name: m.name,
        description: m.description,
        qty: Number(m.qty) || 0,
        unit: m.unit || 'Nos',
        price: Number(m.price) || 0,
        barcodes: m.barcodes,
        photos: [],
      })),
      documentPhotos: [], // Don't require photo capture on request
      grandTotal: calculateGrandTotal()
    };

    try {
      await api.post('/transactions', payload);
      navigate('/transactions');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to submit transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white m-0">
            Create Enterprise Material Request
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Sourcing and logistics transfer request with barcode loops (default type is RDC)</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400">
          {error}
        </div>
      )}

      {/* Main Single Page Layout */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Step 1: Governance details */}
        <Card title="Document & Sourcing Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <Select
              id="receiver"
              label="Select Receiver Employee *"
              placeholder="Select employee..."
              options={employees}
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              required
            />

            {receiverId === 'other' && (
              <Input
                id="otherReceiverName"
                label="Receiver Name *"
                placeholder="Enter receiver's name"
                value={otherReceiverName}
                onChange={(e) => setOtherReceiverName(e.target.value)}
                required
              />
            )}

            <Select
              id="documentType"
              label="Document Type *"
              options={[
                { label: 'Returnable DC (RDC)', value: 'RDC' },
                { label: 'Delivery Challan (DC)', value: 'DC' },
                { label: 'Invoice', value: 'Invoice' },
                { label: 'Emergency Send', value: 'Emergency Send' }
              ]}
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              required
            />

            {documentType === 'DC' && (
              <Select
                id="dcType"
                label="Challan Sub-Type *"
                options={[
                  { label: 'DC-Internal', value: 'DC-Internal' },
                  { label: 'DC-FOC (Free of Charge)', value: 'DC-FOC' }
                ]}
                value={dcType}
                onChange={(e) => setDcType(e.target.value)}
                required
              />
            )}

            <Input
              id="documentNumber"
              label="Document Number *"
              placeholder="e.g. RDC-1002, DC-9902"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              required
            />

            <Select
              id="priority"
              label="Request Priority *"
              options={[
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
                { label: 'Critical', value: 'critical' }
              ]}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              required
            />

            <Input
              id="dueDate"
              label="Due Date (Optional)"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />

            <Input
              id="costCenter"
              label="Cost Center / Project Reference"
              placeholder="e.g. DEPT-ENG-2026"
              value={costCenter}
              onChange={(e) => setCostCenter(e.target.value)}
            />

            {documentType === 'RDC' && (
              <Input
                id="expectedReturnDate"
                label="Expected Return Date *"
                type="date"
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                required
              />
            )}

            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description / Purpose</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Logistics request description..."
                rows="3"
                className="w-full text-sm bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-indigo-500 dark:text-white px-3 py-2 font-semibold"
              />
            </div>
          </div>
        </Card>

        {/* Step 2: Materials & Barcode Registration */}
        <Card
          title="Materials & Barcode Registration"
          headerAction={
            <Button size="sm" onClick={handleAddMaterial} icon={Plus}>
              Add Material Row
            </Button>
          }
        >
          <div className="flex flex-col gap-6">
            {materials.map((mat, matIdx) => (
              <div key={matIdx} className="bg-slate-50/50 dark:bg-slate-900/30 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex flex-col gap-4 relative shadow-sm">
                <button
                  type="button"
                  onClick={() => handleRemoveMaterial(matIdx)}
                  disabled={materials.length === 1}
                  className="absolute top-4 right-4 text-slate-400 hover:text-red-500 cursor-pointer disabled:opacity-20"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>

                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Material Item #{matIdx + 1}</span>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-semibold">
                  <div className="md:col-span-2">
                    <Input
                      label="Material Name *"
                      placeholder="e.g. Panel PC, Encoder"
                      value={mat.name}
                      onChange={(e) => handleMaterialChange(matIdx, 'name', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Qty *"
                      type="number"
                      min="1"
                      value={mat.qty}
                      onChange={(e) => handleMaterialChange(matIdx, 'qty', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Price (₹) *"
                      type="number"
                      min="0"
                      value={mat.price}
                      onChange={(e) => handleMaterialChange(matIdx, 'price', e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Independent Barcode list */}
                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-900 mt-2 flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Per-Unit Scans (Every barcode is independent)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {Array.from({ length: mat.qty }).map((_, bcIdx) => (
                      <div key={bcIdx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder={`Scan Barcode #${bcIdx + 1} *`}
                          value={mat.barcodes[bcIdx] || ''}
                          onChange={(e) => handleBarcodeValChange(matIdx, bcIdx, e.target.value)}
                          required
                          className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none dark:bg-slate-900 dark:border-slate-800 dark:text-white px-3 py-2 font-mono font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => startScanner(matIdx, bcIdx)}
                          className="p-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg cursor-pointer flex items-center justify-center shrink-0"
                          title="Scan with Camera"
                        >
                          <Camera className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-end items-center gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <Button variant="ghost" type="button" onClick={() => navigate('/transactions')}>Cancel</Button>
              <Button variant="success" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting request...' : 'Create Material Request'}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Barcode Scanner Modal */}
      {scannerOpen && activeScanTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-3">Align Barcode in Camera View</h3>
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-slate-100 dark:border-slate-800">
              <video ref={videoRef} className="w-full h-full object-cover" />
            </div>
            
            <p className="text-[10px] text-slate-500 mt-2.5 text-center">Library automatically detects barcode strings</p>

            <div className="flex gap-2.5 mt-5">
              <Button variant="ghost" className="flex-1" onClick={stopScanner}>Cancel</Button>
              <Button variant="outline" className="flex-1 border-blue-200 text-blue-600" onClick={simulateScan}>Simulate Scan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateTransactionPage;
