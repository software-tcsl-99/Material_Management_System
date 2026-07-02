import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import api from '../lib/api';

export default function BarcodeDetail() {
  const { barcode } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const chatEndRef = useRef(null);
  const [acceptPhoto, setAcceptPhoto] = useState('/images/mock-accept.jpg');
  const [accepting, setAccepting] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['barcodeDetail', barcode],
    queryFn: async () => {
      const { data } = await api.get(`/barcodes/${barcode}`);
      return data;
    }
  });

  const { data: userData } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data.user;
    }
  });

  const fetchChat = async (txnId) => {
    if (!txnId) return;
    setLoadingChat(true);
    try {
      const chatRes = await api.get(`/chat/${txnId}/messages`);
      setChatMessages(chatRes.data.messages || []);
      setTimeout(() => {
        if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    } finally {
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    if (data?.barcode?.transactionId) {
      fetchChat(data.barcode.transactionId);
    }
  }, [data]);

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatText.trim() || !data?.barcode?.transactionId) return;
    try {
      const res = await api.post(`/chat/${data.barcode.transactionId}/messages`, {
        message: chatText
      });
      setChatMessages(prev => [...prev, res.data.chatMessage]);
      setChatText('');
      setTimeout(() => {
        if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit chat comment.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-650" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm font-semibold flex items-center gap-2">
        <AlertCircle className="w-5 h-5" /> Error loading barcode details.
      </div>
    );
  }

  const { barcode: bc, transfers, returns } = data;

  const isOwner = userData && (bc.owner?._id || bc.owner)?.toString() === userData._id?.toString();

  const handleAcceptSplit = async () => {
    setAccepting(true);
    try {
      await api.post('/barcodes/accept-split-material', {
        barcode: bc.barcode,
        gps: { lat: 18.5204, lng: 73.8567, address: 'MIDC Pune, India' },
        photos: [{ url: acceptPhoto, capturedAt: new Date().toISOString() }]
      });
      alert('Material accepted successfully!');
      refetch();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept material.');
    } finally {
      setAccepting(false);
    }
  };

  const mockPhotos = [
    'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&q=80',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=300&q=80'
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-16 relative">

      {/* Page Title & Navigation line */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-1">
            <span>Transactions</span>
            <ChevronRight className="w-3 h-3" />
            <span
              onClick={() => bc.transaction && navigate(`/transactions/${bc.transaction._id || bc.transaction}`)}
              className="text-blue-600 hover:underline cursor-pointer font-bold"
            >
              {bc.transactionId}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-1 -ml-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none m-0">
              5. Materials & Barcodes Tree
            </h1>
          </div>
        </div>

        {/* Actions Panel */}
        <div className="flex items-center gap-2 flex-wrap">
          {bc.status?.toUpperCase() === 'ACTIVE' && bc.transaction && (
            (userData?.role === 'super_admin' || (userData?.role === 'department_admin' && userData?.departmentAdminType === 'store')) ||
              ['active', 'received', 'partially_returned'].includes(bc.transaction.status?.toLowerCase()) &&
              (bc.owner?._id || bc.owner)?.toString() === userData?._id?.toString()
          ) && (
            <>
              <Button size="sm" variant="outline" onClick={() => navigate(`/barcodes/${bc.barcode}/split`)}>
                Split Serial
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/barcodes/${bc.barcode}/return`)}>
                Return Request
              </Button>
              <Button size="sm" onClick={() => navigate(`/barcodes/${bc.barcode}/transfer`)}>
                Transfer Barcode
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="font-extrabold text-xs uppercase">
            Export <ChevronDown className="w-3.5 h-3.5 ml-1 inline-block" />
          </Button>
        </div>
      </div>

      {/* Split Material Acceptance Card */}
      {bc.status === 'pending_acceptance' && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-6 rounded-3xl space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Pending Split Material Acceptance</h3>
              <p className="text-xs text-slate-650 dark:text-slate-400 mt-0.5 font-semibold">
                {isOwner
                  ? "You have received this split material. Please capture/specify a verification photo to accept it."
                  : `Awaiting acceptance by owner: ${bc.owner?.fullName || 'Requester'}`
                }
              </p>
            </div>
          </div>

          {isOwner && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <img src={acceptPhoto} alt="Verification" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider">Verification Photo URL</span>
                  <input
                    type="text"
                    value={acceptPhoto}
                    onChange={(e) => setAcceptPhoto(e.target.value)}
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-2.5 py-1.5 focus:outline-none w-52 font-semibold"
                    placeholder="Photo URL..."
                  />
                </div>
              </div>
              <Button variant="success" onClick={handleAcceptSplit} disabled={accepting} className="w-full sm:w-auto sm:ml-auto">
                {accepting ? 'Accepting...' : 'Confirm Acceptance'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Main Details Grid Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-stretch">
        {/* Left Card Detail */}
        <div className="flex flex-col justify-center items-start border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 p-5 rounded-2xl md:w-1/4">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-2">Barcode Detail</span>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-white font-mono">{bc.barcode}</h2>
            <span className="text-[9px] font-extrabold bg-blue-50 text-blue-600 dark:bg-blue-950/30 px-2 py-0.5 rounded uppercase font-mono">
              {bc.materialName}
            </span>
          </div>
        </div>

        {/* Right Info Grid */}
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-6 p-1">
          <div>
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Material</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">{bc.materialName}</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Barcode</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs font-mono">{bc.barcode}</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Shares / Owner</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
              {bc.owner?.fullName || 'Stores'}
            </span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Quantity</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">1</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">Total Transfers</span>
            <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">{bc.transferCount || 0}</span>
          </div>
          <div className="flex flex-col items-start gap-1">
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Status</span>
            <Badge variant={bc.status?.toUpperCase() === 'RETURNED' ? 'secondary' : bc.status?.toUpperCase() === 'ACTIVE' ? 'primary' : 'success'}>
              {bc.status?.toUpperCase() === 'ACTIVE' ? 'Active (Transferred)' : bc.status?.toUpperCase()}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 overflow-x-auto select-none no-scrollbar">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'timeline', label: 'Timeline' },
          { id: 'details', label: 'Details' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2.5 text-[10px] font-extrabold uppercase tracking-widest border-b-2 transition-all cursor-pointer whitespace-nowrap
              ${activeTab === tab.id
                ? 'border-blue-650 text-blue-650 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panel Content Body */}
      <div className="w-full">
        {/* TAB 1: Overview (Split Column: left is info panels, right is center timeline) */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Left Column: Photos, GPS, Remarks, Attachments (2 Columns) */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Photos Panel */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800/60">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Photos</h4>
                  <span className="text-[10px] text-blue-650 hover:underline font-bold cursor-pointer">View All</span>
                </div>
                <div className="flex gap-3">
                  {bc.photos?.length === 0 ? (
                    mockPhotos.map((url, i) => (
                      <div key={i} className="w-28 h-28 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center shadow-xs">
                        <img src={url} alt={`Fallback Mock ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))
                  ) : (
                    bc.photos.map((p, i) => (
                      <div key={i} className="w-28 h-28 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center shadow-xs">
                        <img src={p.url} alt={`Scan ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Location (GPS) Panel */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col gap-2">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-50 dark:border-slate-800/60">Location (GPS)</h4>
                <p className="font-mono text-xs text-slate-800 dark:text-slate-200 font-bold mt-1">
                  {bc.gps ? `${bc.gps.lat.toFixed(4)}° N, ${bc.gps.lng.toFixed(4)}° E` : '18.5204° N, 73.8567° E'}
                </p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                  {bc.gps?.address || 'Pune, Maharashtra, India'}
                </p>
              </div>

              {/* Remarks Panel */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col gap-2">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-50 dark:border-slate-800/60">Remarks</h4>
                <p className="text-xs text-slate-600 dark:text-slate-350 font-semibold leading-relaxed mt-1">
                  {bc.history?.[bc.history.length - 1]?.remarks || 'No remarks recorded for this status lot.'}
                </p>
              </div>

              {/* Attachments Panel */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col gap-2">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-50 dark:border-slate-800/60">Attachments</h4>
                {bc.documents?.length === 0 ? (
                  <p className="text-xs text-slate-400 italic mt-1">No documents</p>
                ) : (
                  <div className="flex flex-col gap-2.5 mt-1">
                    {bc.documents.map((doc, idx) => (
                      <a key={idx} href={doc.url} className="text-xs text-blue-650 hover:underline font-bold" target="_blank" rel="noreferrer">
                        {doc.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Left-Dated Stepper timeline (3 Columns) */}
            <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <div className="relative pl-[110px] py-4">
                {/* Vertical green timeline line running in center of dates and texts */}
                <div className="absolute left-[92px] top-4 bottom-4 w-0.5 bg-emerald-600" />

                <div className="flex flex-col gap-8">
                  {bc.history?.map((log, idx) => {
                    const logDate = new Date(log.timestamp);
                    const isTransfer = log.action.toLowerCase().includes('transfer');

                    return (
                      <div key={idx} className="relative flex items-start">
                        {/* Date and Time on the left of the line */}
                        <div className="absolute -left-[110px] w-[85px] text-right pr-3.5 flex flex-col gap-0.5 select-none">
                          <span className="text-[10px] text-slate-800 dark:text-slate-200 font-extrabold uppercase tracking-wide">
                            {logDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[9px] text-slate-405 block font-bold">
                            {logDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        </div>

                        {/* Middle: Stepper circle node exactly centered on the line */}
                        <span className={`absolute left-[-22px] top-[4px] w-3 h-3 rounded-full ${isTransfer ? 'bg-orange-500' : 'bg-emerald-600'} border-2 border-white dark:border-slate-900 z-10`} />

                        {/* Right side: Action details */}
                        <div className="pl-4">
                          <h5 className="text-xs font-black text-slate-800 dark:text-slate-100 font-sans leading-snug">
                            {log.action}
                          </h5>
                          <p className="text-[10px] text-slate-500 font-medium italic mt-0.5">
                            By: {log.user?.fullName || 'System'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: Timeline Logs */}
        {activeTab === 'timeline' && (
          <Card title="Activity Timeline Logs">
            <div className="flex flex-col gap-4">
              {bc.history?.map((hist, idx) => (
                <div key={idx} className="p-3.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-650 rounded-lg shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {hist.action.toUpperCase()}
                    </h4>
                    {hist.remarks && <p className="text-[10px] text-slate-500 mt-0.5">{hist.remarks}</p>}
                    <span className="text-[9px] text-slate-400 mt-1 block font-semibold">
                      by {hist.user?.fullName || 'System'} on {new Date(hist.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* TAB 3: Details (Current Ownership Details) */}
        {activeTab === 'details' && (
          <Card title="Ownership Node Specifications">
            <div className="space-y-3.5 text-xs font-semibold text-slate-650">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-400">Current Owner:</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">{bc.owner?.fullName || 'N/A'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-400">Owner Designation:</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">{bc.owner?.designation || '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-400">Owner Dept:</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">{bc.ownerDepartment?.name || 'Stores'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800/60">
                <span className="text-slate-400">Employee ID:</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">{bc.owner?.employeeId || '-'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Accumulated Transfers:</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200">{bc.transferCount || 0} times</span>
              </div>
            </div>
          </Card>
        )}


      </div>

    </div>
  );
}
