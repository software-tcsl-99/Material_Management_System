import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Eye, FileText } from 'lucide-react';
import api from '../../lib/axios';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';

const ExternalReceiptDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  
  // Lightbox
  const [activePhoto, setActivePhoto] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/receiving/${id}`);
        setReceipt(response.data.data);
      } catch (err) {
        console.error('Fetch external receipt error:', err);
        setError('Failed to load receipt details.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Retrieving external receipt file...
        </p>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 font-semibold text-center">
        {error || 'External receipt record not found.'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/receiving')}
          className="p-1 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
              Receipt {receipt.receiptId}
            </h1>
            <Badge variant="info">{receipt.type}</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Logged on {new Date(receipt.createdAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Source Entity Info */}
        <Card title="Origin Specifications" className="md:col-span-1 text-sm flex flex-col gap-4">
          {receipt.type === 'vendor' ? (
            <div className="flex flex-col gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">Vendor Name</span>
                <span className="font-bold">{receipt.vendorName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">PO Number</span>
                <span className="font-semibold">{receipt.poNumber}</span>
              </div>
              {receipt.prNumber && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">PR Number</span>
                  <span>{receipt.prNumber}</span>
                </div>
              )}
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">Address</span>
                <span className="text-slate-500 leading-relaxed text-xs">{receipt.vendorAddress || '—'}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">Customer Name</span>
                <span className="font-bold">{receipt.customerName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">Document Reference</span>
                <span className="font-semibold">{receipt.documentNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block tracking-wider">Address</span>
                <span className="text-slate-500 leading-relaxed text-xs">{receipt.customerAddress || '—'}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Common details */}
        <Card title="Receiving Specifications" className="md:col-span-2">
          <div className="grid grid-cols-2 gap-y-4 gap-x-5 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Logged By (Receiver)</span>
              <span className="font-semibold">{receipt.receiver?.fullName}</span>
              <p className="text-xs text-slate-500">ID: {receipt.receiver?.employeeId}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Total Valuation</span>
              <span className="font-bold text-slate-900 dark:text-white">₹{receipt.grandTotal?.toLocaleString()}</span>
            </div>
            {receipt.type === 'customer' && receipt.documentDescription && (
              <div className="col-span-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Document Description</span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{receipt.documentDescription}</p>
              </div>
            )}
            <div className="col-span-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 block font-medium">Receiving Remarks</span>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{receipt.remarks || 'No remarks logged.'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Materials */}
      <Card title="Arrived Materials Inventory">
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">
                <th className="px-5 py-3">Material Name</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Quantity</th>
                <th className="px-5 py-3">Unit</th>
                <th className="px-5 py-3 text-right">Price</th>
                <th className="px-5 py-3">Barcode</th>
                <th className="px-5 py-3 text-right">Row Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {receipt.materials?.map((mat, idx) => (
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

      {/* Photo evidence */}
      {receipt.photos?.length > 0 && (
        <Card title="Secured Physical Inspection Photo Evidence">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {receipt.photos.map((ph, idx) => (
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

      {/* Lightbox Modal */}
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
                  {activePhoto.metadata?.capturedAt ? new Date(activePhoto.metadata.capturedAt).toLocaleString() : 'N/A'}
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

export default ExternalReceiptDetailPage;
