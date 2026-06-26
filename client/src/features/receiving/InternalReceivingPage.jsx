import { ArrowLeft, ArrowRight, Camera, CheckCircle2, FileSpreadsheet, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GeoCamera from '../../components/geo-camera/GeoCamera';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import DataTable from '../../components/ui/DataTable';
import Select from '../../components/ui/Select';
import Spinner from '../../components/ui/Spinner';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';

const InternalReceivingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTxnId = searchParams.get('txn') || searchParams.get('txnId'); // accept either `txn` or `txnId`

  const [loading, setLoading] = useState(false);
  const [incomingTxns, setIncomingTxns] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState(null);

  // Form State
  const [receiverDocumentPhotos, setReceiverDocumentPhotos] = useState([]);
  const [receiverMaterialPhotos, setReceiverMaterialPhotos] = useState([]);
  const [materialCondition, setMaterialCondition] = useState('Good');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [activeMaterialIndex, setActiveMaterialIndex] = useState(null);
  const [activePhotoType, setActivePhotoType] = useState(null); // 'document' or 'material'

  // Fetch pending receipts
  const fetchIncomingTransactions = async () => {
    setLoading(true);
    try {
      // Fetch transactions that are 'accepted' but not yet 'completed' (which are awaiting physical receipt) and where receiver is current user
      const { user } = useAuthStore.getState();
      const response = await api.get('/transactions', {
        params: { status: 'accepted', receiver: user?._id, limit: 50 },
      });
      setIncomingTxns(response.data.data || []);

      // If a specific transaction query parameter is present, select it immediately
      if (queryTxnId) {
        const found = (response.data.data || []).find(t => t._id === queryTxnId || t.transactionId === queryTxnId);
        if (found) setSelectedTxn(found);
        else {
          // If not found in simple list, fetch directly
          const detailRes = await api.get(`/transactions/${queryTxnId}`);
          if (detailRes.data.data) {
            setSelectedTxn(detailRes.data.data);
          }
        }
      }
    } catch (err) {
      console.error('Fetch incoming error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomingTransactions();
  }, [queryTxnId]);

  const handleDocumentPhotoCapture = (photoData) => {
    setReceiverDocumentPhotos([...receiverDocumentPhotos, photoData]);
  };

  const handleMaterialPhotoCapture = (photoData) => {
    const updated = [...receiverMaterialPhotos];
    const existing = updated.find(item => item.materialIndex === activeMaterialIndex);
    if (existing) {
      existing.photos = [...existing.photos, photoData];
    } else {
      updated.push({ materialIndex: activeMaterialIndex, photos: [photoData] });
    }
    setReceiverMaterialPhotos(updated);
  };



  const handleRemovePhoto = (type, materialIndex = null, photoIndex = null) => {
    if (type === 'document' && photoIndex !== null) {
      setReceiverDocumentPhotos(receiverDocumentPhotos.filter((_, idx) => idx !== photoIndex));
    } else if (type === 'material' && materialIndex !== null && photoIndex !== null) {
      const updated = [...receiverMaterialPhotos];
      const existingIdx = updated.findIndex(item => item.materialIndex === materialIndex);
      if (existingIdx !== -1) {
        updated[existingIdx].photos = updated[existingIdx].photos.filter((_, idx) => idx !== photoIndex);
        if (updated[existingIdx].photos.length === 0) {
          updated.splice(existingIdx, 1);
        }
        setReceiverMaterialPhotos(updated);
      }
    }
  };

  const handleReset = () => {
    setSelectedTxn(null);
    setReceiverDocumentPhotos([]);
    setReceiverMaterialPhotos([]);
    setMaterialCondition('Good');
    setRemarks('');
    setError('');
    setSuccess(false);
    setActiveMaterialIndex(null);
    setActivePhotoType(null);
    fetchIncomingTransactions();
  };

  const handleDownloadReceipt = async (receiptId) => {
    try {
      const response = await api.get(`/receiving/${receiptId}/export/excel`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = response.headers['content-disposition']?.split('filename=')[1] || `receipt_${receiptId}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTxn) return;
    if (!receiverDocumentPhotos || receiverDocumentPhotos.length === 0) {
      setError('At least one document photo/upload is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    const payload = {
      transactionId: selectedTxn._id,
      receiverDocumentPhotos,
      receiverMaterialPhotos,
      materialCondition,
      remarks,
    };

    try {
      const response = await api.post('/receiving/internal', payload);
      setSuccess(true);

      // Download Excel immediately
      if (response.data.data?._id) {
        await handleDownloadReceipt(response.data.data._id);
      }

      setTimeout(() => {
        handleReset();
        navigate('/transactions');
      }, 2000);
    } catch (err) {
      console.error('Failed to log internal receipt:', err);
      setError(err.response?.data?.message || 'Failed to record receipt. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Transaction ID',
      cell: (row) => <span className="font-bold text-indigo-600 dark:text-indigo-400">{row.transactionId}</span>,
    },
    {
      header: 'Doc Type',
      accessor: 'documentType',
    },
    {
      header: 'Sender',
      cell: (row) => <span>{row.sender?.fullName}</span>,
    },
    {
      header: 'Grand Total',
      cell: (row) => <span>₹{row.grandTotal?.toLocaleString()}</span>,
    },
    {
      header: 'Date Sent',
      cell: (row) => <span>{new Date(row.createdAt).toLocaleDateString()}</span>,
    },
    {
      header: 'Action',
      cell: (row) => (
        <Button
          size="sm"
          onClick={() => setSelectedTxn(row)}
          icon={ArrowRight}
        >
          Receive Items
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Querying incoming supply chains...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
            Internal Material Receiving
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Receive and verify materials transferred internally from other company agents
          </p>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 font-semibold text-center flex flex-col items-center gap-2">
          <CheckCircle2 className="w-8 h-8" />
          <p>Material receipt recorded successfully! Marking transaction completed...</p>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400">
          {error}
        </div>
      )}

      {/* Grid view of awaiting receipts */}
      {!selectedTxn && !success && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Incoming Materials Awaiting Physical Receipt
          </h3>
          <DataTable
            columns={columns}
            data={incomingTxns}
            loading={loading}
            emptyMessage="No approved incoming shipments are awaiting receipt in your department queue."
          />
        </div>
      )}

      {/* Log Receipt Form */}
      {selectedTxn && !success && (
        <div className="flex flex-col gap-6">
          <div className="flex justify-start">
            <Button variant="outline" size="sm" onClick={handleReset} icon={ArrowLeft}>
              Back to List
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Dossier info */}
            <Card title="Movement Dossier Details" className="md:col-span-1 text-sm flex flex-col gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">Txn ID</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedTxn.transactionId}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">Sender Agent</span>
                <span className="font-semibold">{selectedTxn.sender?.fullName}</span>
                <p className="text-xs text-slate-500">ID: {selectedTxn.sender?.employeeId}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">Document reference</span>
                <span className="font-semibold">{selectedTxn.documentType} ({selectedTxn.documentNumber})</span>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">Material Summary</span>
                <ul className="text-xs text-slate-600 dark:text-slate-400 list-disc list-inside mt-1 gap-1 flex flex-col">
                  {selectedTxn.materials?.map((m, idx) => (
                    <li key={idx} className="truncate">
                      {m.qty ?? m.quantity} {m.unit} x <span className="font-semibold">{m.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            {/* Receiving Form */}
            <form onSubmit={handleSubmit} className="md:col-span-2 flex flex-col gap-6">
              <Card title="Sender's Photos (View Only)">
                {/* Sender's Document Photos */}
                {selectedTxn.documentPhotos && selectedTxn.documentPhotos.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Document Photos</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {selectedTxn.documentPhotos.map((photo, idx) => (
                        <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm aspect-video">
                          <img src={photo.url} alt={`Sender Document ${idx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Sender's Material Photos */}
                {selectedTxn.materials?.some(m => m.photos && m.photos.length > 0) && (
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Material Photos</h4>
                    {selectedTxn.materials.map((material, matIdx) => (
                      material.photos && material.photos.length > 0 && (
                        <div key={matIdx} className="mb-4">
                          <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">{material.name}</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {material.photos.map((photo, phIdx) => (
                              <div key={phIdx} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm aspect-video">
                                <img src={photo.url} alt={`Sender ${material.name} ${phIdx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Verify Receipt Condition">
                <div className="flex flex-col gap-5">
                  <Select
                    id="materialCondition"
                    label="Physical Material Condition"
                    options={[
                      { label: 'Good (No issues found)', value: 'Good' },
                      { label: 'Damaged (Material compromised)', value: 'Damaged' },
                      { label: 'Partially Damaged', value: 'Partially Damaged' },
                      { label: 'Mismatch (Quantity or specifications mismatch)', value: 'Mismatch' },
                    ]}
                    value={materialCondition}
                    onChange={(e) => setMaterialCondition(e.target.value)}
                    required
                  />

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="remarks" className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Receiving Remarks
                    </label>
                    <textarea
                      id="remarks"
                      placeholder="Add observations about packaging, delivery, items check..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="block w-full rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 px-3.5 py-2.5 bg-white text-slate-900 border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:focus:ring-indigo-500"
                      rows={3}
                    />
                  </div>
                </div>
              </Card>

              {/* Receiver's Document Photos */}
              <Card title="Receiver's Document Photos (Required)">
                <div className="flex flex-col gap-4">
                  <GeoCamera
                    onCapture={handleDocumentPhotoCapture}
                    label="Capture Document Photo"
                  />

                  {receiverDocumentPhotos.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Captured Document Photos</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {receiverDocumentPhotos.map((photo, idx) => (
                          <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm aspect-video">
                            <img src={photo.url} alt={`Receiver Document ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto('document', null, idx)}
                              className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Receiver's Material Photos */}
              <Card title="Receiver's Material Photos (Optional)">
                <div className="flex flex-col gap-6">
                  {selectedTxn.materials?.map((material, matIdx) => {
                    const matPhotos = receiverMaterialPhotos.find(item => item.materialIndex === matIdx)?.photos || [];
                    return (
                      <div key={matIdx} className="flex flex-col gap-4 p-4 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl border border-slate-200/60 dark:border-slate-850">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">{material.name}</h4>

                        {/* Camera and Upload */}
                        {activeMaterialIndex === matIdx && activePhotoType === 'material' ? (
                          <>
                            <GeoCamera
                              onCapture={(photoData) => {
                                handleMaterialPhotoCapture(photoData);
                                setActiveMaterialIndex(null);
                                setActivePhotoType(null);
                              }}
                              label={`Capture Photo for ${material.name}`}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setActiveMaterialIndex(null);
                                setActivePhotoType(null);
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              setActiveMaterialIndex(matIdx);
                              setActivePhotoType('material');
                            }}
                            icon={Camera}
                          >
                            Add Photo
                          </Button>
                        )}

                        {/* Captured Photos */}
                        {matPhotos.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Captured Photos</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                              {matPhotos.map((photo, phIdx) => (
                                <div key={phIdx} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm aspect-video">
                                  <img src={photo.url} alt={`Receiver ${material.name} ${phIdx + 1}`} className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePhoto('material', matIdx, phIdx)}
                                    className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              <div className="flex items-center justify-end gap-3.5">
                <Button variant="outline" size="sm" onClick={handleReset} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" loading={submitting} icon={FileSpreadsheet} className="bg-emerald-600 hover:bg-emerald-700">
                  Log Receipt & Complete Cycle
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalReceivingPage;
