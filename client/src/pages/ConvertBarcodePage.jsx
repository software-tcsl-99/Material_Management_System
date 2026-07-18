import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Camera, Paperclip, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import GeoCamera from '../components/geo-camera/GeoCamera';
import Button from '../components/ui/Button';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

export default function ConvertBarcodePage() {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: userData } = useAuthStore();
  const defaultType = searchParams.get('defaultType') || 'DC';

  // Fetch barcode detail
  const { data: detailData, isLoading } = useQuery({
    queryKey: ['barcodeConvertDetail', barcode],
    queryFn: async () => {
      const { data } = await api.get(`/barcodes/${barcode}`);
      return data;
    }
  });

  const bc = detailData?.barcode;
  const splits = detailData?.splits || [];
  const exchanges = detailData?.exchanges || [];
  const transfers = detailData?.transfers || [];
  const returns = detailData?.returns || [];

  const isSplitPending = splits.some(s => s.status === 'pending');
  const isExchangePending = exchanges.some(e => e.status === 'pending');
  const isTransferPending = transfers.some(t => t.status === 'pending');
  const isReturnPending = returns.some(r => ['pending', 'handler_assigned', 'collected', 'store_received'].includes(r.status));
  const isClosePending = bc?.closeRequest && bc.closeRequest.documentNumber && ['pending', 'pending_accounts_approval', 'pending_store_acceptance'].includes(bc.closeRequest.status);

  const hasPendingAction = isSplitPending || isExchangePending || isTransferPending || isReturnPending || isClosePending;

  // Fetch Tally Customers
  const { data: tallyCustomersData = [] } = useQuery({
    queryKey: ['tallyCustomersConvert'],
    queryFn: async () => {
      const res = await api.get('/barcodes/tally/customers');
      return res.data.customers || [];
    }
  });

  // Fetch management users list
  const [managementUsers, setManagementUsers] = useState([]);
  useEffect(() => {
    api.get('/employees?limit=1000&allDepartments=true').then(res => {
      const empList = res.data.employees || res.data.data || [];
      const mgtList = empList.filter(e => e.role === 'department_admin' && e.departmentAdminType === 'management' && e._id !== userData?._id && e.role !== 'super_admin');
      setManagementUsers(mgtList.map(m => ({ value: m._id, label: `${m.fullName} (${m.employeeId})` })));
    }).catch(err => console.error(err));
  }, [userData]);

  // Form states
  const [docType, setDocType] = useState(defaultType === 'Invoice' ? 'Invoice' : 'DC FOC');
  const [remarks, setRemarks] = useState('');
  const [selectedManagementId, setSelectedManagementId] = useState('');
  const [selectedCustomerName, setSelectedCustomerName] = useState('');
  const [closePhotos, setClosePhotos] = useState([]); // array of { url, capturedAt }
  const [closeAttachments, setCloseAttachments] = useState([]); // array of File objects
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const material = bc?.transaction?.materials?.find(m =>
    m.barcodes.some(b => b.barcode === barcode)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (['DC FOC', 'Invoice'].includes(docType) && !selectedManagementId) {
      alert('Please select a management approver.');
      return;
    }
    if (docType === 'DC FOC' && !selectedCustomerName) {
      alert('Please select a customer.');
      return;
    }
    if (!remarks.trim()) {
      alert('Please enter a remark or reason.');
      return;
    }
    if (closePhotos.length === 0) {
      alert('Please capture at least one live verification photo.');
      return;
    }
    setSubmitting(true);
    try {
      const uploadedAttachments = [];
      for (const file of closeAttachments) {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploadedAttachments.push({
          name: file.name,
          url: data.url,
          type: file.type,
          size: file.size
        });
      }

      await api.post('/barcodes/close-request', {
        barcode,
        documentType: docType,
        documentNumber: 'N/A', // no longer gathered via form, default value on backend
        remarks: remarks.trim(),
        managementApprover: ['DC FOC', 'Invoice'].includes(docType) ? selectedManagementId : undefined,
        customerName: docType === 'DC FOC' ? selectedCustomerName : undefined,
        photos: closePhotos,
        gps: { lat: 18.5204, lng: 73.8567, address: 'MIDC Pune, India' },
        documents: uploadedAttachments
      });

      alert('Conversion request submitted successfully!');
      navigate(`/barcodes/${barcode}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit conversion request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (hasPendingAction) {
    return (
      <div className="max-w-md mx-auto mt-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 text-center text-xs">
        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-955/20 flex items-center justify-center mx-auto">
          <span className="text-amber-500 font-extrabold text-xl">⚠️</span>
        </div>
        <h2 className="text-base font-extrabold text-slate-800 dark:text-white">Action Blocked</h2>
        <p className="text-slate-500 dark:text-slate-400 font-semibold">
          This barcode has a pending request (split, return, transfer, exchange, or close) in progress. No other actions can be initiated until it is resolved.
        </p>
        <button
          onClick={() => navigate(`/barcodes/${barcode}`)}
          className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-dark transition cursor-pointer"
        >
          Back to Barcode Details
        </button>
      </div>
    );
  }

  const renderAttachmentsAndPhotos = () => (
    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
      {/* GeoCamera Integration for Multiple Photos */}
      <div className="space-y-2">
        <label className="block text-[10px] font-bold text-slate-500 tracking-wider font-sans">Verification Live Photos</label>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition"
            >
              <Camera className="w-4 h-4 text-blue-650 dark:text-blue-400" />
              Capture Live Photo
            </button>
            <span className="text-[10px] text-slate-400 font-bold">
              ({closePhotos.length} photo(s) captured)
            </span>
          </div>

          {closePhotos.length > 0 && (
            <div className="flex flex-wrap gap-2.5 bg-slate-50 dark:bg-slate-955/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
              {closePhotos.map((photo, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shadow-sm group">
                  <img src={photo.url} alt={`Live verification #${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setClosePhotos(prev => prev.filter((_, i) => i !== idx))}
                    className="absolute inset-0 bg-rose-600/85 flex items-center justify-center text-white text-[10px] font-extrabold opacity-0 group-hover:opacity-100 transition"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attachments for Multiple Documents */}
      <div className="space-y-2">
        <label className="block text-[10px] font-bold text-slate-500 tracking-wider font-sans">Attachment Files (Documents/Challans)</label>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer transition">
              Choose File
              <input
                type="file"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setCloseAttachments(prev => [...prev, e.target.files[0]]);
                  }
                }}
                className="hidden"
                accept="*/*"
              />
            </label>
            <span className="text-[10px] text-slate-400 font-bold">
              ({closeAttachments.length} file(s) attached)
            </span>
          </div>

          {closeAttachments.length > 0 && (
            <div className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-955/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
              {closeAttachments.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 px-3.5 py-2 rounded-xl">
                  <div className="flex items-center gap-2 truncate">
                    <Paperclip className="w-3.5 h-3.5 text-blue-650 dark:text-blue-400 flex-shrink-0" />
                    <span className="text-[10px] text-slate-600 dark:text-slate-350 font-mono truncate max-w-[200px] sm:max-w-xs">{file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCloseAttachments(prev => prev.filter((_, i) => i !== idx))}
                    className="text-[10px] text-rose-500 hover:text-rose-700 font-extrabold transition flex-shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const isInvoiceMode = docType === 'Invoice';

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in p-2 sm:p-4">
      {/* Header Navigation */}
      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold text-slate-800 dark:text-white">
            {isInvoiceMode ? 'Convert Barcode to Invoice' : 'Convert DC Challan Type'}
          </h1>
          <p className="text-[10px] text-slate-400 font-bold tracking-wider font-mono uppercase mt-0.5">
            Barcode conversion loop • {barcode}
          </p>
        </div>
      </div>

      {isInvoiceMode ? (
        /* ================= INVOICE MODE: COMPLETELY DIFFERENT PREMIUM UI ================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Material details */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <FileText className="w-4 h-4 text-blue-650 dark:text-blue-400" />
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">Material & Sourcing Details</h2>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-600">
              <div className="space-y-1 bg-slate-50 dark:bg-slate-950/20 p-4.5 rounded-2xl border border-slate-100 dark:border-slate-850">
                <span className="text-[10px] text-slate-400 font-extrabold block">Material Name</span>
                <span className="text-xs font-extrabold text-slate-800 dark:text-white">{material?.name || bc?.materialName || 'N/A'}</span>
              </div>

              {material?.description && (
                <div className="space-y-1 bg-slate-50/50 dark:bg-slate-950/10 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] text-slate-400 font-extrabold block">Description</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300">{material.description}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] text-slate-400 font-extrabold block">Quantity</span>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white">{material?.quantity || 1} {material?.unit || 'pcs'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] text-slate-400 font-extrabold block">Unit Price</span>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white">₹{material?.price || 0}</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/20 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                <span className="text-[10px] text-slate-400 font-extrabold block">Total Valuation</span>
                <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                  ₹{(material?.quantity || 1) * (material?.price || 0)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-455 font-bold block text-[10px]">Current Status</span>
                  <p className="font-extrabold text-slate-750 dark:text-slate-205 mt-0.5">{bc?.status}</p>
                </div>
                <div>
                  <span className="text-slate-455 font-bold block text-[10px]">Owner</span>
                  <p className="font-extrabold text-slate-750 dark:text-slate-205 mt-0.5">{bc?.owner?.fullName || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-slate-455 font-bold block text-[10px]">Transaction ID</span>
                  <p className="font-extrabold text-slate-750 dark:text-slate-205 mt-0.5">{bc?.transactionId}</p>
                </div>
                <div>
                  <span className="text-slate-455 font-bold block text-[10px]">Barcode ID</span>
                  <p className="font-extrabold text-slate-750 dark:text-slate-205 mt-0.5 font-mono">{barcode}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Premium Invoice form */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-6 text-xs font-semibold text-slate-600">
              
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 tracking-wider">Target Document Type</label>
                <input
                  type="text"
                  value="Invoice"
                  disabled
                  className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 font-bold focus:outline-none cursor-not-allowed text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 tracking-wider">Choose Management Approver *</label>
                <select
                  value={selectedManagementId}
                  onChange={(e) => setSelectedManagementId(e.target.value)}
                  required
                  className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Management Admin...</option>
                  {managementUsers.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 tracking-wider">Remarks / Reason *</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  required
                  placeholder="Provide conversion justification for accounts approval..."
                  rows="3"
                  className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3.5 font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {renderAttachmentsAndPhotos()}

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button variant="ghost" type="button" onClick={() => navigate(-1)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={submitting}>
                  {submitting ? 'Requesting Conversion...' : 'Convert to Invoice'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* ================= DC CONVERSION MODE: DROPDOWN CHANNELS ================= */
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6 text-xs font-semibold text-slate-600">
            
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-500 tracking-wider">Target Document Type *</label>
              <select
                value={docType}
                onChange={(e) => {
                  setDocType(e.target.value);
                  setSelectedManagementId('');
                  setSelectedCustomerName('');
                }}
                className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="DC FOC">DC FOC</option>
                <option value="DC Internal">DC Internal</option>
              </select>
            </div>

            {docType === 'DC FOC' && (
              <>
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 tracking-wider">Choose Management Approver *</label>
                  <select
                    value={selectedManagementId}
                    onChange={(e) => setSelectedManagementId(e.target.value)}
                    required
                    className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Management Admin...</option>
                    {managementUsers.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 tracking-wider">Select Tally Customer *</label>
                  <select
                    value={selectedCustomerName}
                    onChange={(e) => setSelectedCustomerName(e.target.value)}
                    required
                    className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select Customer...</option>
                    {tallyCustomersData?.map(cust => (
                      <option key={cust} value={cust}>{cust}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-500 tracking-wider">Remarks / Reason *</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                required
                placeholder="Provide migration reason details..."
                rows="3"
                className="w-full text-xs bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-xl px-4 py-3 font-semibold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {renderAttachmentsAndPhotos()}

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="ghost" type="button" onClick={() => navigate(-1)}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Request Conversion'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {cameraOpen && (
        <GeoCamera
          onCapture={(uploadData) => {
            let capturedUrl = '';
            if (uploadData && typeof uploadData === 'object' && uploadData.url) {
              capturedUrl = uploadData.url;
            } else {
              capturedUrl = uploadData;
            }
            setClosePhotos(prev => [...prev, { url: capturedUrl, capturedAt: new Date().toISOString() }]);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}
