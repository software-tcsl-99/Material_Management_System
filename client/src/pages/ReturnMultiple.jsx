import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Camera, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GeoCamera from '../components/geo-camera/GeoCamera';
import Button from '../components/ui/Button';
import api from '../lib/api';

export default function ReturnMultiple() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Authentication Context (Retrieve current user info)
  const [currentUser, setCurrentUser] = useState(null);
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const [reason, setReason] = useState('');
  const [condition, setCondition] = useState('good');
  const [remarks, setRemarks] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photoMeta, setPhotoMeta] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [returnMethod, setReturnMethod] = useState('direct'); // 'direct' or 'handler'
  const [handlerId, setHandlerId] = useState('');
  const [handlerSearchQuery, setHandlerSearchQuery] = useState('');
  const [handlerDropdownOpen, setHandlerDropdownOpen] = useState(false);

  // Selected barcode list
  const [selectedBarcodes, setSelectedBarcodes] = useState(new Set());

  // Fetch transaction details
  const { data: txn, isLoading: txnLoading, error: txnError } = useQuery({
    queryKey: ['transactionDetail', id],
    queryFn: async () => {
      const { data } = await api.get(`/transactions/${id}`);
      return data.transaction;
    }
  });

  // Fetch barcodes matching this transaction
  const { data: barcodes = [], isLoading: barcodesLoading } = useQuery({
    queryKey: ['transactionBarcodes', id],
    queryFn: async () => {
      if (!txn?.transactionId) return [];
      const { data } = await api.get(`/barcodes/transaction/${txn.transactionId}`);
      return data.barcodes || [];
    },
    enabled: !!txn?.transactionId
  });

  useEffect(() => {
    api.get('/employees?limit=1000&allDepartments=true')
      .then(res => {
        const empList = res.data.employees || res.data.data || [];
        setEmployees(empList);
      })
      .catch(err => console.error('Error loading employees:', err));
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!event.target.closest('.handler-dropdown-container')) {
        setHandlerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredHandlers = employees.filter(emp => {
    if (emp.role === 'super_admin') return false;
    const term = handlerSearchQuery.toLowerCase();
    return (
      emp.fullName.toLowerCase().includes(term) ||
      emp.employeeId.toLowerCase().includes(term)
    );
  });

  // Filter only active barcodes owned by the logged-in requester user
  const activeOwnedBarcodes = barcodes.filter(bc => {
    const isBarcodeActive = bc.status === 'Active';
    const isOwner = bc.owner?._id === currentUser?._id || bc.owner === currentUser?._id;
    return isBarcodeActive && isOwner;
  });

  const returnMutation = useMutation({
    mutationFn: async (payloads) => {
      // Execute posts sequentially
      for (const payload of payloads) {
        await api.post('/barcodes/return', payload);
      }
    },
    onSuccess: () => {
      alert('Return requests for selected barcodes submitted successfully!');
      navigate(`/transactions/${id}`);
    }
  });

  const handleCapturePhoto = (dataUrl, metadata) => {
    setCapturedPhoto(dataUrl);
    setPhotoMeta(metadata);
  };

  const handleToggleSelect = (bcCode) => {
    const updated = new Set(selectedBarcodes);
    if (updated.has(bcCode)) updated.delete(bcCode);
    else updated.add(bcCode);
    setSelectedBarcodes(updated);
  };

  const handleSelectAll = () => {
    if (selectedBarcodes.size === activeOwnedBarcodes.length) {
      setSelectedBarcodes(new Set());
    } else {
      setSelectedBarcodes(new Set(activeOwnedBarcodes.map(b => b.barcode)));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedBarcodes.size === 0) {
      alert('Please select at least one barcode to return.');
      return;
    }
    if (!reason) {
      alert('Please select a reason.');
      return;
    }
    if (returnMethod === 'handler' && !handlerId) {
      alert('Please select a sourcing handler.');
      return;
    }

    const payloads = Array.from(selectedBarcodes).map(barcode => ({
      barcode,
      reason,
      condition,
      remarks,
      returnHandler: returnMethod === 'handler' ? handlerId : undefined,
      gps: photoMeta ? { lat: photoMeta.lat, lng: photoMeta.lng, address: photoMeta.address } : undefined,
      photos: capturedPhoto ? [{ url: capturedPhoto, capturedAt: new Date() }] : undefined
    }));

    returnMutation.mutate(payloads);
  };

  if (txnLoading || barcodesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (txnError || !txn) {
    return (
      <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl text-danger text-sm font-semibold flex items-center gap-2">
        <AlertCircle className="w-5 h-5" /> Error loading transaction.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold text-slate-850 dark:text-white">Return Multiple Materials</h1>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Transaction: {txn.transactionId}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 text-xs text-slate-700 dark:text-slate-300">

        {/* Checklist of eligible barcodes */}
        <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Select Active Barcodes to Return</h3>
            {activeOwnedBarcodes.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[10px] text-blue-650 hover:underline font-extrabold uppercase"
              >
                {selectedBarcodes.size === activeOwnedBarcodes.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {activeOwnedBarcodes.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No active owned barcodes are eligible for return under this transaction (others may have been split, returned, or transferred).</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
              {activeOwnedBarcodes.map(bc => {
                const isSelected = selectedBarcodes.has(bc.barcode);
                return (
                  <div
                    key={bc._id}
                    onClick={() => handleToggleSelect(bc.barcode)}
                    className={`p-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${isSelected
                      ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-955/10 ring-1 ring-blue-500/20'
                      : 'border-slate-200/80 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                      }`}
                  >
                    <div className="min-w-0">
                      <p className="font-extrabold font-mono text-slate-850 dark:text-slate-200">{bc.barcode}</p>
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5 truncate">{bc.materialName}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-350 bg-white dark:bg-slate-900'
                      }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5 text-[10px]">
            Return Reason *
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-primary text-slate-800 dark:text-white"
          >
            <option value="">Select Reason...</option>
            <option value="Job Completed">Job Completed</option>
            <option value="Defective/Damaged">Defective/Damaged</option>
            <option value="Incorrect Material">Incorrect Material</option>
            <option value="Excess Stock">Excess Stock</option>
          </select>
        </div>

        {/* Condition & Remarks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5 text-[10px]">
              Material Condition *
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-955 dark:border-slate-800 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-primary text-slate-800 dark:text-white"
            >
              <option value="good">Good Condition (Usable)</option>
              <option value="damaged">Damaged / Needs QC Sourcing</option>
              <option value="wasted">Scrap / Wasted</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5 text-[10px]">
              Remarks / Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Additional comments..."
              className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-955 dark:border-slate-800 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-primary text-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Return Method */}
        <div>
          <label className="block text-slate-500 font-bold uppercase tracking-wider mb-2 text-[10px]">
            Return Dispatch Method
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="border border-slate-200 rounded-2xl p-4 flex flex-col cursor-pointer hover:bg-slate-50/50">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="returnMethod"
                  checked={returnMethod === 'direct'}
                  onChange={() => setReturnMethod('direct')}
                  className="accent-primary"
                />
                <span className="font-bold">Direct Return to Store</span>
              </div>
              <span className="text-[10px] text-slate-400 pl-5">
                Physically hand over materials back to store inventory directly.
              </span>
            </label>

            <label className="border border-slate-200 rounded-2xl p-4 flex flex-col cursor-pointer hover:bg-slate-50/50">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="returnMethod"
                  checked={returnMethod === 'handler'}
                  onChange={() => setReturnMethod('handler')}
                  className="accent-primary"
                />
                <span className="font-bold">Assign Return Handler</span>
              </div>
              <span className="text-[10px] text-slate-400 pl-5">
                Assign an employee to collect and deliver it to the store.
              </span>
            </label>
          </div>
        </div>

        {returnMethod === 'handler' && (
          <div className="pt-2 animate-in slide-in-from-top-2 duration-200">
            <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1.5 text-[10px]">
              Select Sourcing Handler *
            </label>
            <div className="relative handler-dropdown-container">
              <button
                type="button"
                onClick={() => setHandlerDropdownOpen(!handlerDropdownOpen)}
                className="w-full flex justify-between items-center text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-primary transition text-left text-slate-855 dark:text-white"
              >
                <span>
                  {handlerId
                    ? (employees.find(e => e._id === handlerId)
                      ? `${employees.find(e => e._id === handlerId).fullName} (${employees.find(e => e._id === handlerId).employeeId})`
                      : 'Select Sourcing Handler')
                    : 'Select Sourcing Handler'}
                </span>
                <span className="text-slate-400">▼</span>
              </button>

              {handlerDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-905 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 flex flex-col max-h-60 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <input
                      type="text"
                      value={handlerSearchQuery}
                      onChange={(e) => setHandlerSearchQuery(e.target.value)}
                      placeholder="Search handler..."
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-semibold focus:outline-none focus:border-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  <div className="overflow-y-auto flex-1 py-1">
                    {filteredHandlers.length > 0 ? (
                      filteredHandlers.map(emp => (
                        <button
                          key={emp._id}
                          type="button"
                          onClick={() => {
                            setHandlerId(emp._id);
                            setHandlerDropdownOpen(false);
                            setHandlerSearchQuery('');
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer block transition ${emp._id === handlerId ? 'bg-primary/5 text-primary font-black' : 'text-slate-705'}`}
                        >
                          {emp.fullName} ({emp.employeeId})
                        </button>
                      ))
                    ) : (
                      <div className="p-3.5 text-xs text-slate-400 font-bold text-center">
                        No employees found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Photo Attachment */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase">Live Photo with Metadata Overlay</label>
          {capturedPhoto ? (
            <div className="relative border border-slate-200 rounded-2xl overflow-hidden aspect-video w-64 bg-slate-100">
              <img src={capturedPhoto} alt="Captured preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setCapturedPhoto(null)}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black text-white p-1 rounded-full text-xs"
              >
                Clear
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-xl transition"
            >
              <Camera className="w-4 h-4 text-primary" /> Open GeoCamera
            </button>
          )}
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => navigate(-1)}>Cancel</Button>
          <Button
            variant="success"
            type="submit"
            disabled={returnMutation.isPending || selectedBarcodes.size === 0}
          >
            {returnMutation.isPending ? 'Submitting...' : `Submit Return (${selectedBarcodes.size} Selected)`}
          </Button>
        </div>
      </form>

      {cameraOpen && (
        <GeoCamera
          onCapture={handleCapturePhoto}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}
