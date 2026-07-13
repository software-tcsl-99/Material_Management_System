import { ArrowLeft, Camera, CheckCircle, FileText, Layers, MapPin, Shield, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import TallyMaterialAutocomplete from '../../components/ui/TallyMaterialAutocomplete';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';

const StoreDispatchPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [transaction, setTransaction] = useState(null);

  // Form Fields
  const [receiverId, setReceiverId] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [dispatchMethod, setDispatchMethod] = useState('handler');
  const [handlerId, setHandlerId] = useState('');
  const [remarks, setRemarks] = useState('');

  // Dropdowns Lists
  const [employees, setEmployees] = useState([]);
  const [handlers, setHandlers] = useState([]);

  // Materials states (matching the transaction materials list + store added ones)
  const [materialRows, setMaterialRows] = useState([]);
  // Available barcodes mapping by material name
  const [rowBarcodesMap, setRowBarcodesMap] = useState({});

  // Transaction level document photos state (multiple capture support)
  const [docPhotos, setDocPhotos] = useState([]);

  // Searchable custom employee dropdown states
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const [empSearchQuery, setEmpSearchQuery] = useState('');

  // Searchable custom handler dropdown states
  const [handlerDropdownOpen, setHandlerDropdownOpen] = useState(false);
  const [handlerSearchQuery, setHandlerSearchQuery] = useState('');

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.receiver-dropdown-container')) {
        setEmpDropdownOpen(false);
      }
      if (!e.target.closest('.handler-dropdown-container')) {
        setHandlerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Load employees
        const empRes = await api.get('/employees?limit=1000&allDepartments=true');
        const empList = empRes.data.employees || empRes.data.data || [];
        setEmployees(empList);

        // Filter handlers (disabled filtering to show all users)
        const handlerList = empList;
        setHandlers(handlerList);

        // Fetch transaction details
        const txRes = await api.get(`/transactions/${id}`);
        const tx = txRes.data.transaction || txRes.data;
        if (!tx) {
          setError('Transaction not found.');
          return;
        }
        setTransaction(tx);

        // Default receiver to requester
        setReceiverId(tx.requester?._id || '');

        // Fetch the expected return date from request form
        const dateVal = tx.expectedReturnDate || tx.dueDate;
        if (dateVal) {
          try {
            const formattedDate = new Date(dateVal).toISOString().split('T')[0];
            setExpectedReturnDate(formattedDate);
          } catch (e) {
            console.error('Error formatting date:', dateVal, e);
          }
        }

        // Fetch Tally inventory to get live pricing and units
        let tallyInventory = [];
        try {
          const tallyRes = await api.get('/tally/inventory');
          tallyInventory = tallyRes.data.materials || [];
        } catch (tallyErr) {
          console.warn('Error loading Tally inventory in dispatch form:', tallyErr);
        }

        // Map transaction materials to local form rows
        const rows = tx.materials.map(m => {
          const matchedTally = tallyInventory.find(item => item.name.toLowerCase() === m.name.toLowerCase());
          const barcodeInputs = [];
          for (let i = 0; i < m.quantity; i++) {
            barcodeInputs.push('');
          }
          return {
            name: m.name,
            quantity: m.quantity,
            unit: matchedTally?.unit || m.unit || 'pcs',
            description: m.description || '',
            price: matchedTally?.price || m.price || 0,
            barcodes: barcodeInputs,
            photos: [],
            isPreExisting: true
          };
        });
        setMaterialRows(rows);
      } catch (err) {
        console.error('Error fetching dispatch transaction:', err);
        setError(err.response?.data?.message || 'Failed to load transaction data.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  const materialNamesKey = materialRows.map(r => r.name).filter(Boolean).join(',');

  // Fetch available barcodes from GOKUL SHIRGAON store for each material in rows
  useEffect(() => {
    const fetchAvailableBarcodes = async () => {
      const uniqueNames = [...new Set(materialRows.map(r => r.name).filter(Boolean))];
      for (const name of uniqueNames) {
        try {
          const res = await api.get(`/barcodes/store-available?materialName=${encodeURIComponent(name)}`);
          const bcList = res.data.barcodes || [];
          setRowBarcodesMap(prev => ({
            ...prev,
            [name]: bcList.map(b => b.barcode)
          }));
        } catch (err) {
          console.error(`Failed to fetch store barcodes for "${name}":`, err);
        }
      }
    };

    if (materialRows.length > 0) {
      fetchAvailableBarcodes();
    }
  }, [materialNamesKey]);

  const handlePriceChange = (index, value) => {
    const updated = [...materialRows];
    updated[index].price = parseFloat(value) || 0;
    setMaterialRows(updated);
  };

  const handleBarcodeChange = (matIndex, bcIndex, value) => {
    const updated = [...materialRows];
    updated[matIndex].barcodes[bcIndex] = value;
    setMaterialRows(updated);
  };

  // Add a new custom material row
  const handleAddMaterialRow = () => {
    setMaterialRows([
      ...materialRows,
      {
        name: '',
        quantity: 1,
        unit: 'pcs',
        description: 'Store Added Item',
        price: 0,
        barcodes: [''],
        photos: [],
        isPreExisting: false
      }
    ]);
  };

  const handleRemoveMaterialRow = (index) => {
    setMaterialRows(materialRows.filter((_, idx) => idx !== index));
  };

  const handleMaterialNameChange = (index, value) => {
    const updated = [...materialRows];
    updated[index].name = value;
    setMaterialRows(updated);
  };

  const handleQuantityChange = (index, value) => {
    const qty = parseInt(value) || 1;
    const updated = [...materialRows];
    updated[index].quantity = qty;

    // Adjust barcodes size
    const currentBarcodes = updated[index].barcodes;
    if (currentBarcodes.length < qty) {
      const diff = qty - currentBarcodes.length;
      updated[index].barcodes = [...currentBarcodes, ...Array(diff).fill('')];
    } else if (currentBarcodes.length > qty) {
      updated[index].barcodes = currentBarcodes.slice(0, qty);
    }
    setMaterialRows(updated);
  };

  // Simulate Geo-Tagged Photo Capture for Material
  const handleCaptureMaterialPhoto = (index) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const updated = [...materialRows];
          const newPhoto = {
            url: `/images/mock-material-${index + 1}-${Date.now()}.jpg`,
            metadata: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy || 10,
              address: 'MIDC Phase II, Sector A, Pune, India',
              date: new Date().toLocaleDateString('en-IN'),
              time: new Date().toLocaleTimeString('en-IN'),
              device: navigator.userAgent,
              employeeName: user?.fullName || 'Store Operator',
              capturedAt: new Date().toISOString()
            }
          };
          updated[index].photos = [...(updated[index].photos || []), newPhoto];
          setMaterialRows(updated);
        },
        (error) => {
          const updated = [...materialRows];
          const newPhoto = {
            url: `/images/mock-material-${index + 1}-${Date.now()}.jpg`,
            metadata: {
              lat: 18.5204,
              lng: 73.8567,
              accuracy: 15,
              address: 'MIDC Pune, Maharashtra, India',
              date: new Date().toLocaleDateString('en-IN'),
              time: new Date().toLocaleTimeString('en-IN'),
              device: navigator.userAgent,
              employeeName: user?.fullName || 'Store Operator',
              capturedAt: new Date().toISOString()
            }
          };
          updated[index].photos = [...(updated[index].photos || []), newPhoto];
          setMaterialRows(updated);
        }
      );
    }
  };

  // Simulate Geo-Tagged Photo Capture for Document
  const handleCaptureDocPhoto = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPhoto = {
            url: `/images/mock-doc-gatepass-${docPhotos.length + 1}.jpg`,
            metadata: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy || 10,
              address: 'MIDC Phase II, Sector A, Pune, India',
              date: new Date().toLocaleDateString('en-IN'),
              time: new Date().toLocaleTimeString('en-IN'),
              device: navigator.userAgent,
              employeeName: user?.fullName || 'Store Operator',
              capturedAt: new Date().toISOString()
            }
          };
          setDocPhotos([...docPhotos, newPhoto]);
        },
        (error) => {
          const newPhoto = {
            url: `/images/mock-doc-gatepass-${docPhotos.length + 1}.jpg`,
            metadata: {
              lat: 18.5204,
              lng: 73.8567,
              accuracy: 15,
              address: 'MIDC Pune, Maharashtra, India',
              date: new Date().toLocaleDateString('en-IN'),
              time: new Date().toLocaleTimeString('en-IN'),
              device: navigator.userAgent,
              employeeName: user?.fullName || 'Store Operator',
              capturedAt: new Date().toISOString()
            }
          };
          setDocPhotos([...docPhotos, newPhoto]);
        }
      );
    }
  };

  const handleRemoveDocPhoto = (index) => {
    setDocPhotos(docPhotos.filter((_, idx) => idx !== index));
  };

  // Filter out super_admin and apply search query
  const filteredEmployees = employees.filter(emp => {
    if (emp.role === 'super_admin' || emp._id === user?._id) return false;
    if (empSearchQuery.trim()) {
      const q = empSearchQuery.toLowerCase();
      const matchName = emp.fullName?.toLowerCase().includes(q);
      const matchId = emp.employeeId?.toLowerCase().includes(q);
      return matchName || matchId;
    }
    return true;
  });

  // Filter out super_admin and apply search query for handlers
  const filteredHandlers = handlers.filter(h => {
    if (h.role === 'super_admin' || h._id === user?._id) return false;
    if (h.role === 'department_admin' && h.departmentAdminType === 'store') return false;
    if (handlerSearchQuery.trim()) {
      const q = handlerSearchQuery.toLowerCase();
      const matchName = h.fullName?.toLowerCase().includes(q);
      const matchId = h.employeeId?.toLowerCase().includes(q);
      return matchName || matchId;
    }
    return true;
  });

  // Calculate dynamic totals
  const getGrandTotal = () => {
    return materialRows.reduce((sum, row) => sum + (row.price * row.quantity), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!receiverId) {
      setError('Receiver Employee is required.');
      return;
    }
    if (!expectedReturnDate) {
      setError('Expected Return Date is compulsory.');
      return;
    }
    if (dispatchMethod === 'handler' && !handlerId) {
      setError('Sourcing handler assignment is required.');
      return;
    }

    // Material validation checks
    for (let i = 0; i < materialRows.length; i++) {
      const row = materialRows[i];
      if (!row.name.trim()) {
        setError(`Please specify a name for material row #${i + 1}.`);
        return;
      }
      if (row.price < 10) {
        setError(`Unit price must be more than 10 rupees for material "${row.name}".`);
        return;
      }
      if (row.barcodes.some(bc => !bc.trim())) {
        setError(`Please enter all barcodes for material "${row.name}".`);
        return;
      }
      if (row.barcodes.some(bc => /[^0-9]/.test(bc))) {
        setError(`Barcodes for material "${row.name}" must contain only numbers (no alphabetic characters).`);
        return;
      }
      if (!row.photos || row.photos.length === 0) {
        setError(`Geo-tagged verification photo is required for material "${row.name}".`);
        return;
      }
    }

    if (docPhotos.length === 0) {
      setError('At least one global Gate Pass/Document Verification Photo is required.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        receiver: receiverId,
        documentType: 'RDC',
        documentNumber: '',
        expectedReturnDate,
        priority: 'medium',
        costCenter: '',
        dcType: 'DC-Internal',
        dispatchMethod,
        handlerId: dispatchMethod === 'handler' ? handlerId : undefined,
        remarks: remarks.trim(),
        materials: materialRows.map(row => ({
          name: row.name,
          quantity: row.quantity,
          unit: row.unit,
          description: row.description,
          price: row.price,
          barcodes: row.barcodes.map(bc => bc.trim()),
          photos: row.photos
        })),
        photos: docPhotos
      };

      await api.post(`/transactions/${transaction.transactionId}/store-dispatch`, payload);
      alert('Sourcing Dispatch registered successfully!');
      navigate('/pending');
    } catch (err) {
      setError(err.response?.data?.message || 'Dispatch operation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !transaction) {
    return (
      <div className="p-6">
        <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl text-xs font-bold">
          {error}
        </div>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/pending')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Pending list
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 md:p-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/pending')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-600" />
              Register & Dispatch Sourcing Request ({transaction.transactionId})
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Purpose / Description: {transaction.description || 'N/A'}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-150 text-rose-600 p-4 rounded-xl text-xs font-bold animate-pulse">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Step 1: Logistics Document Details */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-850 p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-xs font-bold tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            1. Logistics Gate Pass & Document Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-bold tracking-wider mb-1.5 text-[10px]">
                Sender / Receiver Employee
              </label>
              <input
                type="text"
                value={transaction?.requester ? `${transaction.requester.fullName} (${transaction.requester.employeeId || 'N/A'})` : 'N/A'}
                disabled
                className="w-full text-xs bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-800 rounded-lg px-3.5 py-2.5 font-bold cursor-not-allowed text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-slate-500 dark:text-slate-400 font-bold tracking-wider mb-1.5 text-[10px]">
                Expected Return Date *
              </label>
              <input
                type="date"
                value={expectedReturnDate}
                disabled
                required
                className="w-full text-xs bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-800 rounded-lg px-3 py-2 font-bold cursor-not-allowed text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-500 dark:text-slate-400 font-bold tracking-wider mb-1.5 text-[10px]">
                Dispatch Remarks / Purpose
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks or purpose for this dispatch..."
                rows="2"
                className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg px-3.5 py-2.5 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 transition text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Step 2: Logistics Delivery Options */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-xs font-bold tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            2. Logistics Delivery Option
          </h3>

          <div className="flex gap-4">
            <label className="flex-1 flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition">
              <input
                type="radio"
                name="dispatchMethod"
                value="handler"
                checked={dispatchMethod === 'handler'}
                onChange={() => setDispatchMethod('handler')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">Sourcing / Assign Handler</span>
                <span className="block text-[10px] text-slate-400">Assigned employee handles delivery/transit verification.</span>
              </div>
            </label>

            <label className="flex-1 flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-100/50 transition">
              <input
                type="radio"
                name="dispatchMethod"
                value="direct"
                checked={dispatchMethod === 'direct'}
                onChange={() => setDispatchMethod('direct')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-200">Direct Dispatch (Bypass Handler)</span>
                <span className="block text-[10px] text-slate-400">Bypasses intermediary courier step; requester directly signs.</span>
              </div>
            </label>
          </div>

          {dispatchMethod === 'handler' && (
            <div className="pt-2 animate-in slide-in-from-top-2 duration-200">
              <label className="block text-slate-500 dark:text-slate-400 font-bold tracking-wider mb-1.5 text-[10px]">
                Assign Sourcing Handler *
              </label>
              <div className="relative handler-dropdown-container">
                <button
                  type="button"
                  onClick={() => setHandlerDropdownOpen(!handlerDropdownOpen)}
                  className="w-full flex justify-between items-center text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-lg px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 transition text-left text-slate-800 dark:text-slate-200"
                >
                  <span>
                    {handlerId
                      ? (handlers.find(h => h._id === handlerId)
                        ? `${handlers.find(h => h._id === handlerId).fullName} (${handlers.find(h => h._id === handlerId).employeeId})`
                        : 'Select Handler employee')
                      : 'Select Handler employee'}
                  </span>
                  <span className="text-slate-400">▼</span>
                </button>

                {handlerDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 flex flex-col max-h-60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                      <input
                        type="text"
                        value={handlerSearchQuery}
                        onChange={(e) => setHandlerSearchQuery(e.target.value)}
                        placeholder="Search handler..."
                        className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded px-2.5 py-1.5 font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <div className="overflow-y-auto flex-1 py-1">
                      {filteredHandlers.length > 0 ? (
                        filteredHandlers.map(h => (
                          <button
                            key={h._id}
                            type="button"
                            onClick={() => {
                              setHandlerId(h._id);
                              setHandlerDropdownOpen(false);
                              setHandlerSearchQuery('');
                            }}
                            className={`w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer block transition ${h._id === handlerId ? 'bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-450' : 'text-slate-700 dark:text-slate-350'}`}
                          >
                            {h.fullName} ({h.employeeId})
                          </button>
                        ))
                      ) : (
                        <div className="p-3.5 text-xs text-slate-400 font-bold text-center">
                          No handlers found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Material Item Breakdown, Barcodes, Unit Pricing, and Photos */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" />
              3. Assign Barcodes & Item Pricing
            </h3>
          </div>

          <div className="space-y-6">
            {materialRows.map((row, matIndex) => (
              <div key={matIndex} className="p-5 bg-slate-50/50 dark:bg-slate-950/25 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-5 relative animate-in zoom-in-95 duration-200">

                {/* Remove button for custom added rows */}
                {!row.isPreExisting && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMaterialRow(matIndex)}
                    className="absolute top-3 right-3 text-rose-500 hover:text-rose-700 cursor-pointer"
                    title="Remove custom material"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}

                {/* Header/Pricing Specifications Row */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  {/* Material Name */}
                  <div className="md:col-span-4 space-y-1.5">
                    <span className="text-[9px] bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-bold tracking-wider">
                      Material Specification
                    </span>
                    {row.isPreExisting ? (
                      <input
                        type="text"
                        value={row.name}
                        disabled
                        className="w-full text-xs border rounded-lg px-2 py-1 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1 bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                      />
                    ) : (
                      <TallyMaterialAutocomplete
                        value={row.name}
                        onChange={(nameVal, unitVal, priceVal) => {
                          handleMaterialNameChange(matIndex, nameVal);
                          const updated = [...materialRows];
                          if (unitVal) {
                            updated[matIndex].unit = unitVal;
                          }
                          if (priceVal) {
                            updated[matIndex].price = priceVal;
                          }
                          setMaterialRows(updated);
                        }}
                        placeholder="Search Tally inventory..."
                        required
                        className="px-2 py-1 bg-white text-slate-900 border-slate-300 dark:bg-slate-900 dark:text-white dark:border-slate-700 font-medium mt-1"
                      />
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="md:col-span-2 space-y-1.5">
                    <span className="text-[9px] text-slate-400 font-extrabold tracking-wider block">Quantity</span>
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => handleQuantityChange(matIndex, e.target.value)}
                      disabled={row.isPreExisting}
                      className={`w-full text-xs border rounded-lg px-2 py-1 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 ${row.isPreExisting
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-505 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                        : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                    />
                  </div>

                  {/* Unit */}
                  <div className="md:col-span-2 space-y-1.5">
                    <span className="text-[9px] text-slate-400 font-extrabold tracking-wider block">Unit</span>
                    <input
                      type="text"
                      value={row.unit}
                      onChange={(e) => {
                        const updated = [...materialRows];
                        updated[matIndex].unit = e.target.value;
                        setMaterialRows(updated);
                      }}
                      placeholder="Unit"
                      className="w-full text-xs bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg px-2 py-1 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  {/* Unit Price */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="block text-slate-400 font-extrabold tracking-wider text-[9px]">
                      Unit Price (₹) *
                    </label>
                    <input
                      type="number"
                      min="10"
                      value={row.price || ''}
                      onChange={(e) => handlePriceChange(matIndex, e.target.value)}
                      required
                      placeholder="10"
                      className="w-full text-xs bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg px-2 py-1 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>

                  {/* Row Total */}
                  <div className="md:col-span-2 space-y-1.5 pb-2 text-right">
                    <span className="block text-slate-400 font-extrabold tracking-wider text-[9px]">
                      Row Total
                    </span>
                    <span className="block text-xs font-bold text-slate-900 dark:text-slate-200 font-mono">
                      ₹{(row.price * row.quantity).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Barcodes Assignment Sub-Panel */}
                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                  <span className="block text-[9px] text-slate-400 font-extrabold tracking-wider">
                    Serial Barcode Assignment
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {row.barcodes.map((bcVal, bcIndex) => (
                      <div key={bcIndex} className="space-y-1">
                        <label className="block text-slate-400 font-bold tracking-wider text-[9px]">
                          Barcode #{bcIndex + 1} *
                        </label>
                        <select
                          value={bcVal}
                          onChange={(e) => handleBarcodeChange(matIndex, bcIndex, e.target.value)}
                          required
                          disabled={(rowBarcodesMap[row.name] || []).length === 0}
                          className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {(rowBarcodesMap[row.name] || []).length === 0 ? (
                            <option value="">material is not availble</option>
                          ) : (
                            <>
                              <option value="">Select Barcode...</option>
                              {(rowBarcodesMap[row.name] || []).map((code) => {
                                // Prevent selecting the same barcode in multiple inputs
                                const isSelectedElsewhere = materialRows.some((r, rIdx) =>
                                  r.barcodes.some((bc, bIdx) => bc === code && !(rIdx === matIndex && bIdx === bcIndex))
                                );
                                if (isSelectedElsewhere) return null;
                                return (
                                  <option key={code} value={code}>
                                    {code}
                                  </option>
                                );
                              })}
                            </>
                          )}
                        </select>
                        {(rowBarcodesMap[row.name] || []).length === 0 && (
                          <p className="text-[9px] text-rose-500 font-extrabold mt-1">
                            material is not availble
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Material Photo Verification Card Footer */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <label className="block text-slate-500 font-bold tracking-wider text-[10px]">
                      Material Photo Verification *
                    </label>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Captures image of the actual parts with location verification metadata.</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCaptureMaterialPhoto(matIndex)}
                      className="flex items-center gap-1.5 text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-800 font-bold text-xs"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      Capture Tagged Photo
                    </Button>
                  </div>
                </div>

                {row.photos && row.photos.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                    <span className="block text-[9px] text-slate-400 font-extrabold mb-2">
                      Material Photos Verification ({row.photos.length}) *
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {row.photos.map((photo, pIdx) => (
                        <div key={pIdx} className="flex items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200 dark:border-slate-800 relative animate-in zoom-in-95 duration-200 w-full">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <img src={photo.url} alt={`Material Capture ${pIdx + 1}`} className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-800 shrink-0" />
                            <div className="text-[9px] text-slate-400 leading-tight min-w-0">
                              <span className="block text-slate-600 dark:text-slate-300 font-bold flex items-center gap-1">
                                <MapPin className="h-2.5 w-2.5 text-rose-500 shrink-0" />
                                {photo.metadata.lat.toFixed(4)}, {photo.metadata.lng.toFixed(4)}
                              </span>
                              <span className="block truncate font-semibold mt-0.5">{photo.metadata.address}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...materialRows];
                              updated[matIndex].photos = updated[matIndex].photos.filter((_, idx) => idx !== pIdx);
                              setMaterialRows(updated);
                            }}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition shrink-0"
                            title="Delete photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 4: Transaction Level Gate Pass / Document Photo (Multiple support) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-xs font-bold tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Camera className="h-4 w-4 text-blue-600" />
            4. Required Dispatch Document / Gate Pass Photo(s)
          </h3>
          <p className="text-[10px] text-slate-400 font-bold">
            Please capture geo-tagged images of the signed Gate Pass, Delivery Challan or Invoice verification document (Multiple captures allowed).
          </p>

          <div className="space-y-4">
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={handleCaptureDocPhoto}
                className="flex items-center gap-2 text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-800"
              >
                <Camera className="h-4 w-4" />
                Capture Tagged Document Photo
              </Button>
            </div>

            {docPhotos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {docPhotos.map((photo, pIdx) => (
                  <div key={pIdx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 relative animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3">
                      <img src={photo.url} alt={`Document Capture ${pIdx + 1}`} className="w-12 h-12 object-cover rounded-lg border border-slate-300" />
                      <div className="text-[10px] text-slate-400 leading-tight">
                        <span className="block text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-rose-500" />
                          Doc #{pIdx + 1} - Lat: {photo.metadata.lat.toFixed(4)}
                        </span>
                        <span className="block truncate max-w-[180px] font-semibold mt-0.5">{photo.metadata.address}</span>
                        <span className="block font-bold text-slate-500 text-[9px] mt-0.5">{photo.metadata.date} | {photo.metadata.time}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveDocPhoto(pIdx)}
                      className="text-rose-500 hover:text-rose-700 font-bold text-xs p-1"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Step 5: Summary and Action Panel */}
        <div className="bg-slate-50 dark:bg-slate-950/60 p-6 rounded-2xl border border-slate-150 dark:border-slate-855 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold tracking-wider block mb-0.5">WHOLE TRANSACTION GRAND TOTAL</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              ₹{getGrandTotal().toLocaleString()}
            </span>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/pending')}
              className="flex-1 md:flex-initial"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Submit & Register Dispatch
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default StoreDispatchPage;
