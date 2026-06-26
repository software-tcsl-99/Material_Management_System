import { ArrowLeft, Edit2, Eye, FileSpreadsheet, FileText, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import api from '../../lib/axios';
import useAuthStore from '../../store/authStore';

const TransactionDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [txn, setTxn] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Action state
  const [actionModal, setActionModal] = useState(''); // 'accept' | 'reject' | 'receive' | 'resubmit'
  const [remarks, setRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState('');

  // Lightbox for photos
  const [activePhoto, setActivePhoto] = useState(null);



  const fetchTransactionDetails = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/transactions/${id}`);
      const txnData = response.data.data;
      console.log('Transaction data:', txnData);
      console.log('txnData.materials:', txnData.materials);
      console.log('txnData.documentPhotos:', txnData.documentPhotos);
      console.log('txnData.photos:', txnData.photos);
      setTxn(txnData);
    } catch (err) {
      console.error('Error fetching transaction:', err);
      setError('Failed to load transaction details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactionDetails();
  }, [id]);

  const handleDownload = async (type) => {
    try {
      const endpoint = type === 'excel' ? `/transactions/${id}/export` : `/transactions/${id}/export/pdf`;
      const response = await api.get(endpoint, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = response.headers['content-disposition']?.split('filename=')[1] || (type === 'excel' ? `Transaction_${txn.transactionId}.xlsx` : `Transaction_${txn.transactionId}.pdf`);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download transaction details');
    }
  };

  const handleResubmit = async () => {
    setSubmitting(true);
    setActionError('');
    try {
      // For now, just resubmit as-is, but in edit page user can update first!
      await api.post(`/transactions/${id}/resubmit`);
      setActionModal('');
      fetchTransactionDetails();
    } catch (err) {
      console.error('Resubmit error:', err);
      setActionError(err.response?.data?.message || 'Failed to resubmit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActionSubmit = async () => {
    setSubmitting(true);
    setActionError('');
    try {
      if (actionModal === 'accept') {
        await api.patch(`/transactions/${id}/accept`, { remarks });
      } else if (actionModal === 'reject') {
        if (!rejectionReason.trim()) {
          setActionError('Rejection reason is required');
          setSubmitting(false);
          return;
        }
        await api.patch(`/transactions/${id}/reject`, { rejectionReason });
      } else if (actionModal === 'receive') {
        navigate(`/receiving/internal?txnId=${txn.transactionId}`);
        return;
      } else if (actionModal === 'resubmit') {
        await handleResubmit();
      }
      setActionModal('');
      fetchTransactionDetails();
    } catch (err) {
      console.error('Action submit error:', err);
      setActionError(err.response?.data?.message || 'Action execution failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Fetching secure movement dossier...
        </p>
      </div>
    );
  }

  if (error || !txn) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 font-semibold text-center">
        {error || 'Transaction dossier not found.'}
      </div>
    );
  }

  const isReceiver = txn.receiver?._id === user?._id || txn.receiver === user?._id;
  const isSender = txn.sender?._id === user?._id || txn.sender === user?._id;

  // Status tracking indices
  const statusSteps = ['draft', 'pending', 'accepted', 'completed'];
  const currentStatusIdx = statusSteps.indexOf(txn.status === 'rejected' ? 'pending' : txn.status);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
                Dossier {txn.transactionId}
              </h1>
              <Badge>{txn.status}</Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Logged on {new Date(txn.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Dynamic Actions */}
        <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
          {/* Download buttons for everyone */}
          <Button
            variant="outline"
            size="sm"
            icon={FileSpreadsheet}
            onClick={() => handleDownload('excel')}
          >
            Download Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={FileText}
            onClick={() => handleDownload('pdf')}
          >
            Download PDF
          </Button>

          {txn.status === 'pending' && isReceiver && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => setActionModal('reject')}
              >
                Reject Request
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={() => setActionModal('accept')}
              >
                Approve & Accept
              </Button>
            </>
          )}

          {txn.status === 'accepted' && isReceiver && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/receiving/internal?txn=${txn._id}`)}
            >
              Complete Transaction
            </Button>
          )}

          {txn.status === 'rejected' && isSender && (
            <>
              <Button
                variant="outline"
                size="sm"
                icon={Edit2}
                onClick={() => navigate(`/transactions/edit/${txn._id}`)}
              >
                Edit & Resubmit
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Visual Tracking Progress Line */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-xl shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-5">
          Movement Chain Tracking
        </h3>
        <div className="relative flex items-center justify-between w-full">
          {/* Background line */}
          <div className="absolute left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-800 z-0" />
          {/* Active progress line */}
          <div
            className="absolute left-0 h-0.5 bg-indigo-500 z-0 transition-all duration-300"
            style={{ width: `${(currentStatusIdx / (statusSteps.length - 1)) * 100}%` }}
          />

          {statusSteps.map((stepName, idx) => {
            const isCompleted = idx <= currentStatusIdx;
            const isActive = idx === currentStatusIdx;
            const isRejected = txn.status === 'rejected' && idx === 1;

            return (
              <div key={idx} className="relative z-10 flex flex-col items-center gap-1.5 bg-white dark:bg-slate-900 px-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-300
                  ${isRejected
                    ? 'bg-red-500 border-red-500 text-white animate-pulse'
                    : isCompleted
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-slate-100 border-slate-300 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
                  }
                  ${isActive && !isRejected ? 'ring-4 ring-indigo-100 dark:ring-indigo-950' : ''}
                `}>
                  {isRejected ? '✗' : idx + 1}
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider
                  ${isRejected
                    ? 'text-red-500'
                    : isCompleted
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400'
                  }
                `}>
                  {isRejected ? 'Rejected' : stepName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Profiles + Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Parties Panel */}
        <Card title="Transport Parties" className="md:col-span-1 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Sender</span>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold">{txn.sender?.fullName}</p>
              <p className="text-xs text-slate-500">ID: {txn.sender?.employeeId}</p>
              <p className="text-xs text-slate-500">{txn.sender?.department?.name}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 mt-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Receiver</span>
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold">{txn.receiver ? txn.receiver.fullName : txn.otherReceiverName || 'Other'}</p>
              {txn.receiver && <p className="text-xs text-slate-500">ID: {txn.receiver.employeeId}</p>}
              {txn.receiver?.department?.name && <p className="text-xs text-slate-500">{txn.receiver.department.name}</p>}
            </div>
          </div>
        </Card>

        {/* Documentation Panel */}
        <Card title="Document Details" className="md:col-span-2">
          <div className="grid grid-cols-2 gap-y-4 gap-x-5 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Document Type</span>
              <span className="font-semibold">{txn.documentType}</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Document Number</span>
              <span className="font-semibold">{txn.documentNumber || 'N/A'}</span>
            </div>
            {txn.expectedReturnDate && (
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Expected Return Date</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {new Date(txn.expectedReturnDate).toLocaleDateString()}
                </span>
              </div>
            )}
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Grand Valuation</span>
              <span className="font-bold text-slate-900 dark:text-white">₹{txn.grandTotal?.toLocaleString()}</span>
            </div>
            <div className="col-span-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Overall Description</span>
              <span className="text-slate-700 dark:text-slate-300 leading-relaxed">{txn.description || 'No description provided.'}</span>
            </div>
            {txn.rejectionReason && (
              <div className="col-span-2 p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-lg text-rose-700 dark:text-rose-400">
                <span className="text-xs font-semibold block uppercase tracking-wider mb-1">Rejection Reason</span>
                <p className="text-sm font-medium">{txn.rejectionReason}</p>
              </div>
            )}
          </div>
        </Card>
      </div>


      {/* Materials List Table */}
      <Card title="Transported Materials List">
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">
                <th className="px-5 py-3">Material Name</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Quantity</th>
                <th className="px-5 py-3">Unit</th>
                <th className="px-5 py-3 text-right">Unit Price</th>
                <th className="px-5 py-3">Barcode</th>
                <th className="px-5 py-3 text-right">Row Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {txn.materials?.map((mat, idx) => (
                <tr key={idx} className="text-slate-700 dark:text-slate-200">
                  <td className="px-5 py-3.5 text-sm font-semibold">{mat.name}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">{mat.description || '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-right font-medium">{mat.qty ?? mat.quantity}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-500">{mat.unit}</td>
                  <td className="px-5 py-3.5 text-sm text-right">₹{mat.price?.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-sm font-mono text-slate-500">{mat.barcode || '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-right font-bold text-slate-900 dark:text-white">
                    ₹{((mat.qty ?? mat.quantity) * mat.price).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Material Photos - Per Material */}
      {txn.materials?.some(mat => mat.photos && mat.photos.length > 0) && (
        <Card title="Material Verification Photos" subtitle="Photos acquired live with coordinate overlays.">
          <div className="flex flex-col gap-6">
            {txn.materials?.filter(mat => mat.photos && mat.photos.length > 0).map((mat, matIdx) => (
              <div key={matIdx} className="flex flex-col gap-3">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">{mat.name}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {mat.photos.map((ph, phIdx) => (
                    <div
                      key={phIdx}
                      onClick={() => setActivePhoto(ph)}
                      className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm aspect-video cursor-pointer hover:opacity-90 transition-opacity group"
                    >
                      <img src={ph.url} alt={`${mat.name} Evidence`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="p-2 bg-slate-900/60 rounded-full"><Eye className="w-5 h-5" /></span>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 p-2.5 text-[9px] text-white">
                        <p className="font-bold truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-indigo-400 shrink-0" /> {ph.metadata?.address || 'Geolocation logged'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Document Photos */}
      {txn.documentPhotos?.length > 0 && (
        <Card title="Document Evidence Photos" subtitle="Photos acquired live with coordinate overlays.">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {txn.documentPhotos.map((ph, idx) => (
              <div
                key={idx}
                onClick={() => setActivePhoto(ph)}
                className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm aspect-video cursor-pointer hover:opacity-90 transition-opacity group"
              >
                <img src={ph.url} alt="Document Evidence" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="p-2 bg-slate-900/60 rounded-full"><Eye className="w-5 h-5" /></span>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 p-2.5 text-[9px] text-white">
                  <p className="font-bold truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-indigo-400 shrink-0" /> {ph.metadata?.address || 'Geolocation logged'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Captured Evidence Photos (Legacy) */}
      {(!txn.documentPhotos || txn.documentPhotos.length === 0) && txn.photos?.length > 0 && (
        <Card title="Secured On-Site Evidence Photo Dossier" subtitle="Photos acquired live with coordinate overlays. Gallery bypass restricted.">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {txn.photos.map((ph, idx) => (
              <div
                key={idx}
                onClick={() => setActivePhoto(ph)}
                className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm aspect-video cursor-pointer hover:opacity-90 transition-opacity group"
              >
                <img src={ph.url} alt="Evidence" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="p-2 bg-slate-900/60 rounded-full"><Eye className="w-5 h-5" /></span>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 p-2.5 text-[9px] text-white">
                  <p className="font-bold truncate flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-indigo-400 shrink-0" /> {ph.metadata?.address || 'Geolocation logged'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Actions Modal */}
      <Modal
        isOpen={!!actionModal}
        onClose={() => setActionModal('')}
        title={actionModal === 'accept' ? 'Approve & Accept Request' : 'Reject Movement Request'}
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Confirm decision to {actionModal} transaction dossier <span className="font-bold text-slate-800 dark:text-white">{txn.transactionId}</span>.
          </p>

          {actionError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400">
              {actionError}
            </div>
          )}

          {actionModal === 'accept' ? (
            <Input
              id="remarks"
              label="Remarks (Optional)"
              placeholder="e.g. Approved and loading complete"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          ) : (
            <Input
              id="rejectionReason"
              label="Rejection Reason"
              placeholder="e.g. Quantity discrepancies found on items"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
            />
          )}

          <div className="flex items-center justify-end gap-2.5 mt-2">
            <Button variant="outline" size="sm" onClick={() => setActionModal('')}>
              Cancel
            </Button>
            <Button
              variant={actionModal === 'accept' ? 'success' : 'danger'}
              size="sm"
              loading={submitting}
              onClick={handleActionSubmit}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* Photo Lightbox Modal */}
      <Modal
        isOpen={!!activePhoto}
        onClose={() => setActivePhoto(null)}
        title="Secured Image Dossier & Verification"
        size="lg"
      >
        {activePhoto && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 aspect-video w-full bg-slate-950">
              <img src={activePhoto.url} alt="Lightbox Evidence" className="w-full h-full object-contain" />
            </div>

            {/* Geotagged Info Grid */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">Dossier Coordinates</span>
                <p className="font-semibold flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                  Lat: {activePhoto.metadata?.lat?.toFixed(6)}, Lng: {activePhoto.metadata?.lng?.toFixed(6)}
                </p>
                <p className="text-slate-500 mt-1">Accuracy: +/- {Math.round(activePhoto.metadata?.accuracy || 0)} meters</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">Acquired Timestamp</span>
                <p className="font-semibold">
                  {activePhoto.metadata?.capturedAt
                    ? new Date(activePhoto.metadata.capturedAt).toLocaleString()
                    : (activePhoto.metadata?.date && activePhoto.metadata?.time)
                      ? `${activePhoto.metadata.date} ${activePhoto.metadata.time}`
                      : 'N/A'}
                </p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">Reverse Geocoded Address</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                  {activePhoto.metadata?.address || 'Unavailable'}
                </p>
              </div>
              <div className="sm:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">Device Agent Signature</span>
                <p className="font-mono text-[10px] text-slate-500 truncate select-all">{activePhoto.metadata?.device || 'Unknown WebAgent Browser'}</p>
              </div>
            </div>

            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={() => setActivePhoto(null)}>
                Dismiss Dossier
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TransactionDetailPage;
