import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, Camera, Check, Paperclip, Trash2, X, FileText } from 'lucide-react';
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

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraBarcode, setCameraBarcode] = useState(null);
  const [barcodeEvidence, setBarcodeEvidence] = useState({});
  const [commonDocuments, setCommonDocuments] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

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

  const getInitialEvidence = (bc) => {
    const isNewEx = bc.history?.some(h => h.action === 'Exchange Child Created');
    const recLog = bc.history?.find(h => h.action === 'Received');
    const recTime = recLog ? new Date(recLog.timestamp) : new Date(bc.updatedAt || Date.now());
    const passed = (Date.now() - recTime.getTime()) > 3600000;

    if (isNewEx) {
      return { reason: 'Defective/Damaged', condition: 'defective', remarks: '', photos: [], documents: [] };
    } else if (passed) {
      return { reason: 'Job Completed', condition: 'good', remarks: '', photos: [], documents: [] };
    } else {
      return { reason: '', condition: 'good', remarks: '', photos: [], documents: [] };
    }
  };

  const updateEvidence = (barcode, changes) => {
    setBarcodeEvidence(current => {
      const bc = activeOwnedBarcodes.find(item => item.barcode === barcode);
      const initial = bc ? getInitialEvidence(bc) : { reason: '', condition: 'good', remarks: '', photos: [], documents: [] };
      return {
        ...current,
        [barcode]: { ...initial, ...current[barcode], ...changes }
      };
    });
  };

  const handleCapturePhoto = (uploadData) => {
    if (!cameraBarcode || !uploadData?.url) return;
    const bc = activeOwnedBarcodes.find(item => item.barcode === cameraBarcode);
    const initial = bc ? getInitialEvidence(bc) : { reason: '', condition: 'good', remarks: '', photos: [], documents: [] };
    const current = { ...initial, ...(barcodeEvidence[cameraBarcode] || {}) };
    updateEvidence(cameraBarcode, {
      photos: [...(current.photos || []), { url: uploadData.url, capturedAt: new Date().toISOString() }],
      gps: uploadData.metadata ? { lat: uploadData.metadata.lat, lng: uploadData.metadata.lng, address: uploadData.metadata.address } : undefined
    });
    setCameraOpen(false);
    setCameraBarcode(null);
  };

  const handleCommonAttachment = async (file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setCommonDocuments(prev => [...prev, { name: file.name, url: data.url, type: file.type || 'document', size: file.size, uploadedAt: new Date().toISOString() }]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to upload attachment.');
    }
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
    if (returnMethod === 'handler' && !handlerId) {
      alert('Please select a sourcing handler.');
      return;
    }

    const payloads = Array.from(selectedBarcodes).map(barcode => {
      const bc = activeOwnedBarcodes.find(item => item.barcode === barcode);
      const initial = bc ? getInitialEvidence(bc) : { reason: '', condition: 'good', remarks: '', photos: [], documents: [] };
      const evidence = { ...initial, ...(barcodeEvidence[barcode] || {}) };
      return {
        barcode,
        reason: evidence.reason,
        condition: evidence.condition,
        remarks: evidence.remarks,
        returnHandler: returnMethod === 'handler' ? handlerId : undefined,
        gps: evidence.gps || (evidence.photos?.[0]?.metadata ? {
          lat: evidence.photos[0].metadata.lat,
          lng: evidence.photos[0].metadata.lng,
          address: evidence.photos[0].metadata.address
        } : undefined),
        photos: (evidence.photos || []).map(p => ({ url: p.url, capturedAt: p.capturedAt || new Date() })),
        documents: commonDocuments
      };
    });
    const incomplete = payloads.find(item => !item.reason || !item.remarks?.trim() || !item.photos?.length);
    if (incomplete) {
      alert(`Each selected barcode needs a reason, remark, and GeoCamera photo. Missing: ${incomplete.barcode}`);
      return;
    }

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
          <p className="text-xs text-slate-400 font-semibold tracking-wider">
            Transaction: {txn.transactionId}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 text-xs text-slate-700 dark:text-slate-300">

        {/* Checklist of eligible barcodes */}
        <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-200 tracking-wider">Select Active Barcodes to Return</h3>
            {activeOwnedBarcodes.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[10px] text-blue-650 hover:underline font-extrabold"
              >
                {selectedBarcodes.size === activeOwnedBarcodes.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {activeOwnedBarcodes.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No active owned barcodes are eligible for return under this transaction (others may have been split, returned, or transferred).</p>
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

        {selectedBarcodes.size > 0 && (
          <div className="space-y-3">
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-200 tracking-wider">Per-Barcode Return Details</h3>
              <p className="text-[10px] text-slate-400 mt-1">Record a separate remark and GeoCamera photo for every returned barcode.</p>
            </div>
            {Array.from(selectedBarcodes).map(barcode => {
              const bc = activeOwnedBarcodes.find(item => item.barcode === barcode);
              if (!bc) return null;

              const isNewEx = bc.history?.some(h => h.action === 'Exchange Child Created');
              const recLog = bc.history?.find(h => h.action === 'Received');
              const recTime = recLog ? new Date(recLog.timestamp) : new Date(bc.updatedAt || Date.now());
              const passed = (Date.now() - recTime.getTime()) > 3600000;

              const initial = getInitialEvidence(bc);
              const evidence = { ...initial, ...(barcodeEvidence[barcode] || {}) };

              return (
                <div key={barcode} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-950/20 space-y-4">
                  <div>
                    <p className="font-mono font-extrabold text-slate-850 dark:text-white">{barcode}</p>
                    <p className="text-[10px] text-slate-400 font-semibold">{bc?.materialName || 'Material'}</p>
                  </div>

                  {!isNewEx && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select
                        value={evidence.reason}
                        onChange={(e) => updateEvidence(barcode, { reason: e.target.value })}
                        required
                        className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 font-bold outline-none"
                      >
                        {passed ? (
                          <option value="Job Completed">Job Completed</option>
                        ) : (
                          <>
                            <option value="">Select return reason *</option>
                            <option value="Job Completed">Job Completed</option>
                            <option value="Defective/Damaged">Defective/Damaged</option>
                            <option value="Incorrect Material">Incorrect Material</option>
                            <option value="Excess Stock">Excess Stock</option>
                          </>
                        )}
                      </select>

                      <select
                        value={evidence.condition}
                        onChange={(e) => updateEvidence(barcode, { condition: e.target.value })}
                        className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 font-bold outline-none"
                      >
                        {passed ? (
                          <option value="good">Good Condition (Usable)</option>
                        ) : (
                          <>
                            <option value="good">Good Condition (Usable)</option>
                            <option value="damaged">Damaged / Needs QC</option>
                            <option value="defective">Defective</option>
                          </>
                        )}
                      </select>
                    </div>
                  )}

                  <textarea
                    value={evidence.remarks}
                    onChange={(e) => updateEvidence(barcode, { remarks: e.target.value })}
                    required
                    rows="2"
                    placeholder="Return remark / reason details *"
                    className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2.5 font-bold resize-none outline-none"
                  />

                  {/* Per-Barcode Photos Grid */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="block text-[10px] text-slate-500 font-bold tracking-wider">
                        Live Photo Verification ({(evidence.photos || []).length}) *
                      </span>
                      <button
                        type="button"
                        onClick={() => { setCameraBarcode(barcode); setCameraOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        <Camera className="w-3.5 h-3.5" /> Capture Live Photo
                      </button>
                    </div>

                    {(evidence.photos || []).length > 0 && (
                      <div className="flex flex-wrap gap-2.5">
                        {evidence.photos.map((photo, pIdx) => (
                          <div key={pIdx} className="flex flex-col items-center gap-1">
                            <div className="relative w-24 h-24 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                              <img
                                src={photo.url}
                                alt="Captured evidence"
                                className="w-full h-full object-cover cursor-pointer hover:opacity-85 transition"
                                onClick={() => setPreviewImage(photo.url)}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedPhotos = evidence.photos.filter((_, i) => i !== pIdx);
                                  updateEvidence(barcode, { photos: updatedPhotos });
                                }}
                                className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition cursor-pointer"
                                title="Delete Photo"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                            <span className="text-[9px] text-slate-500 font-bold text-center truncate w-24">
                              Capture {pIdx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedBarcodes.size > 0 && (
          /* Global Document Upload Section */
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div>
              <h4 className="text-xs font-extrabold text-slate-850 dark:text-white tracking-wider flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-primary" />
                Upload Dispatch Documents / Attachments (PDF/Word/Images)
              </h4>
              <p className="text-[10px] text-slate-450 mt-0.5">Attach documents applicable to the entire return batch (Multiple files allowed).</p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <label className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-extrabold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                <Paperclip className="w-4 h-4 text-primary" />
                Add Attachment
                <input
                  type="file"
                  accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => handleCommonAttachment(e.target.files?.[0])}
                />
              </label>
            </div>

            {commonDocuments.length > 0 && (
              <div className="space-y-1">
                <span className="block text-[9px] font-bold text-slate-450 tracking-wider">
                  Uploaded Attachments ({commonDocuments.length})
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {commonDocuments.map((doc, docIdx) => {
                    const urlLower = doc.url.toLowerCase();
                    const ext = urlLower.split('.').pop().split('?')[0];
                    const isImg = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext) || urlLower.startsWith('data:image');
                    return (
                      <div key={docIdx} className="flex flex-col items-center gap-1">
                        <div className="relative w-24 h-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex items-center justify-center">
                          {isImg ? (
                            <img
                              src={doc.url}
                              alt={doc.name || `Document ${docIdx + 1}`}
                              className="w-full h-full object-cover cursor-pointer hover:opacity-85 transition"
                              onClick={() => setPreviewImage(doc.url)}
                            />
                          ) : (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full h-full flex flex-col items-center justify-center bg-blue-50 dark:bg-blue-955/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold gap-1"
                              title="Click to view file"
                            >
                              <FileText className="w-6 h-6" />
                              {ext.toUpperCase().substring(0, 4)}
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => setCommonDocuments(prev => prev.filter((_, i) => i !== docIdx))}
                            className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition cursor-pointer"
                            title="Delete File"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <span className="text-[9px] text-slate-500 font-bold text-center truncate w-24" title={doc.name}>
                          {doc.name || `Doc ${docIdx + 1}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Return Method */}
        <div>
          <label className="block text-slate-500 font-bold tracking-wider mb-2 text-[10px]">
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
            <label className="block text-slate-500 font-bold tracking-wider mb-1.5 text-[10px]">
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
                          className={`w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer block transition ${emp._id === handlerId ? 'bg-primary/5 text-primary font-bold' : 'text-slate-705'}`}
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
          triggerOnly={true}
          onCapture={handleCapturePhoto}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {/* Full-screen Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] p-2" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/85 text-white rounded-full transition-colors cursor-pointer z-10"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
