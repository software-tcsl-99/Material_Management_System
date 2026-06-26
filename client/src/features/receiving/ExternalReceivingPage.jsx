import { ArrowLeft, CheckCircle2, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GeoCamera from '../../components/geo-camera/GeoCamera';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Tabs from '../../components/ui/Tabs';
import api from '../../lib/axios';

const ExternalReceivingPage = () => {
  const navigate = useNavigate();

  // Tabs for Vendor vs Customer
  const [activeTab, setActiveTab] = useState('vendor'); // 'vendor' | 'customer'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Common Form State
  const [remarks, setRemarks] = useState('');
  const [photos, setPhotos] = useState([]); // [{ url, metadata }]
  const [materials, setMaterials] = useState([
    { name: '', description: '', qty: 1, unit: 'Nos', price: 0, barcode: '' }
  ]);

  // Vendor Specific Fields
  const [vendorName, setVendorName] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [prNumber, setPrNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');

  // Customer Specific Fields
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [docDescription, setDocDescription] = useState('');

  const focusAndScroll = (id) => {
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        element.focus();
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Dynamic Row operations
  const handleAddMaterial = () => {
    setMaterials([
      ...materials,
      { name: '', description: '', qty: 1, unit: 'Nos', price: 0, barcode: '' }
    ]);
  };

  const handleRemoveMaterial = (index) => {
    if (materials.length === 1) return;
    setMaterials(materials.filter((_, idx) => idx !== index));
  };

  const handleMaterialChange = (index, field, value) => {
    const updated = [...materials];
    if (field === 'qty' || field === 'price') {
      updated[index][field] = parseFloat(value) || 0;
    } else {
      updated[index][field] = value;
    }
    setMaterials(updated);
  };

  const calculateGrandTotal = () => {
    return materials.reduce((sum, item) => sum + (item.qty * item.price), 0);
  };

  // Geo camera photo capture handler
  const handlePhotoCapture = (photoData) => {
    setPhotos([...photos, photoData]);
  };



  const handleRemovePhoto = (index) => {
    setPhotos(photos.filter((_, idx) => idx !== index));
  };

  // Form Validation
  const validateForm = () => {
    setError('');

    if (activeTab === 'vendor') {
      if (!vendorName.trim()) {
        setError('Vendor name is required');
        focusAndScroll('vendorName');
        return false;
      }
      if (!poNumber.trim()) {
        setError('PO number is required');
        focusAndScroll('poNumber');
        return false;
      }
    } else {
      if (!customerName.trim()) {
        setError('Customer name is required');
        focusAndScroll('customerName');
        return false;
      }
      if (!docNumber.trim()) {
        setError('Document reference number is required');
        focusAndScroll('docNumber');
        return false;
      }
    }

    if (photos.length === 0) {
      setError('At least one live geo-tagged evidence photo is required');
      return false;
    }

    // Material validation
    for (let i = 0; i < materials.length; i++) {
      const item = materials[i];
      if (!item.name.trim()) {
        setError(`Item ${i + 1} name is required`);
        focusAndScroll(`material-name-${i}`);
        focusAndScroll(`material-name-mob-${i}`);
        return false;
      }
      if (item.qty <= 0) {
        setError(`Item ${i + 1} quantity must be greater than 0`);
        focusAndScroll(`material-qty-${i}`);
        focusAndScroll(`material-qty-mob-${i}`);
        return false;
      }
      if (!item.barcode || !item.barcode.trim()) {
        setError(`Item ${i + 1} barcode is required`);
        focusAndScroll(`material-barcode-${i}`);
        focusAndScroll(`material-barcode-mob-${i}`);
        return false;
      }
    }

    return true;
  };

  // Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    const payload = {
      type: activeTab,
      // Vendor specifics
      vendorName: activeTab === 'vendor' ? vendorName : undefined,
      vendorAddress: activeTab === 'vendor' ? vendorAddress : undefined,
      prNumber: activeTab === 'vendor' ? prNumber : undefined,
      poNumber: activeTab === 'vendor' ? poNumber : undefined,
      // Customer specifics
      customerName: activeTab === 'customer' ? customerName : undefined,
      customerAddress: activeTab === 'customer' ? customerAddress : undefined,
      documentNumber: activeTab === 'customer' ? docNumber : undefined,
      documentDescription: activeTab === 'customer' ? docDescription : undefined,
      // Common
      materials: materials.map(m => ({
        name: m.name,
        description: m.description,
        quantity: Number(m.qty) || 0,
        unit: m.unit || 'Nos',
        price: Number(m.price) || 0,
        barcode: m.barcode || '',
        total: (Number(m.qty) || 0) * (Number(m.price) || 0),
      })),
      photos,
      remarks,
      grandTotal: calculateGrandTotal()
    };

    try {
      await api.post('/receiving/external', payload);
      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error('Failed to log external receipt:', err);
      setError(err.response?.data?.message || 'Failed to submit external receipt. Check all fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="p-1 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white m-0">
            Log External Material Receipt
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Log physical material transfers arriving from external vendors or customers
          </p>
        </div>
      </div>

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 font-semibold text-center flex flex-col items-center gap-2">
          <CheckCircle2 className="w-8 h-8" />
          <p>External receipt logged successfully! Returning to dashboard...</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400">
          {error}
        </div>
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Tab Switcher */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-2.5 rounded-xl shadow-sm">
            <Tabs
              tabs={[
                { label: 'Vendor Supply Receipt', value: 'vendor' },
                { label: 'Customer Supply Receipt', value: 'customer' }
              ]}
              activeTab={activeTab}
              onChange={(val) => {
                setActiveTab(val);
                setError('');
              }}
            />
          </div>

          {/* Form Fields: Vendor Specific */}
          {activeTab === 'vendor' && (
            <Card title="Vendor Delivery Specifications">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input
                  id="vendorName"
                  label="Vendor Name"
                  placeholder="e.g. Acme Corporation Ltd."
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  required
                />
                <Input
                  id="poNumber"
                  label="Purchase Order (PO) Number"
                  placeholder="e.g. PO-892415"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  required
                />
                <Input
                  id="prNumber"
                  label="Purchase Requisition (PR) Number"
                  placeholder="e.g. PR-10294 (Optional)"
                  value={prNumber}
                  onChange={(e) => setPrNumber(e.target.value)}
                />
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label htmlFor="vendorAddress" className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Vendor Address
                  </label>
                  <textarea
                    id="vendorAddress"
                    placeholder="Warehouse or billing address..."
                    value={vendorAddress}
                    onChange={(e) => setVendorAddress(e.target.value)}
                    className="block w-full rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 px-3.5 py-2.5 bg-white text-slate-900 border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:focus:ring-indigo-500"
                    rows={2}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Form Fields: Customer Specific */}
          {activeTab === 'customer' && (
            <Card title="Customer Delivery Specifications">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input
                  id="customerName"
                  label="Customer Name"
                  placeholder="e.g. John Doe Enterprises"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
                <Input
                  id="docNumber"
                  label="Challan / Document Reference Number"
                  placeholder="e.g. DC-7725A"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  required
                />
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label htmlFor="customerAddress" className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Customer Address
                  </label>
                  <textarea
                    id="customerAddress"
                    placeholder="Delivery/Customer premises address..."
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="block w-full rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 px-3.5 py-2.5 bg-white text-slate-900 border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:focus:ring-indigo-500"
                    rows={2}
                  />
                </div>
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label htmlFor="docDescription" className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Document Description
                  </label>
                  <textarea
                    id="docDescription"
                    placeholder="Purpose of return, customer specifications..."
                    value={docDescription}
                    onChange={(e) => setDocDescription(e.target.value)}
                    className="block w-full rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 px-3.5 py-2.5 bg-white text-slate-900 border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:focus:ring-indigo-500"
                    rows={2}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Geo Evidence Photos */}
          <div className="flex flex-col gap-6">
            <GeoCamera onCapture={handlePhotoCapture} label="Live Receipt Photo Evidence (Required)" />



            {photos.length > 0 && (
              <Card title="Captured Evidence Photos" subtitle="Photos geo-tagged automatically">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {photos.map((ph, idx) => (
                    <div key={idx} className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm aspect-video">
                      <img src={ph.url} alt="Evidence" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full shadow cursor-pointer transition-colors"
                        title="Remove Image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 p-2 text-[9px] text-white">
                        <p className="font-bold truncate">{ph.metadata?.address || 'Geolocation logged'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Materials Table */}
          <Card
            title="Arriving Materials List"
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
                            id={`material-name-${idx}`}
                            type="text"
                            placeholder="Name"
                            value={mat.name}
                            onChange={(e) => handleMaterialChange(idx, 'name', e.target.value)}
                            className="w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 px-1 py-1 text-sm focus:outline-none dark:text-white"
                            required
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            placeholder="e.g. Specifications"
                            value={mat.description}
                            onChange={(e) => handleMaterialChange(idx, 'description', e.target.value)}
                            className="w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 px-1 py-1 text-sm focus:outline-none dark:text-white"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            id={`material-qty-${idx}`}
                            type="number"
                            min="1"
                            value={mat.qty}
                            onChange={(e) => handleMaterialChange(idx, 'qty', e.target.value)}
                            className="w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 px-1 py-1 text-sm focus:outline-none dark:text-white"
                            required
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            placeholder="Nos"
                            value={mat.unit}
                            onChange={(e) => handleMaterialChange(idx, 'unit', e.target.value)}
                            className="w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 px-1 py-1 text-sm focus:outline-none dark:text-white"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={mat.price}
                            onChange={(e) => handleMaterialChange(idx, 'price', e.target.value)}
                            className="w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 px-1 py-1 text-sm focus:outline-none dark:text-white"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            id={`material-barcode-${idx}`}
                            type="text"
                            placeholder="Barcode *"
                            value={mat.barcode}
                            onChange={(e) => handleMaterialChange(idx, 'barcode', e.target.value)}
                            className="w-full bg-transparent border-0 border-b border-transparent focus:border-indigo-500 px-1 py-1 text-sm focus:outline-none dark:text-white"
                            required
                          />
                        </td>
                        <td className="px-4 py-2 text-sm font-semibold">
                          ₹{(mat.qty * mat.price).toLocaleString()}
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
                  <div key={idx} className="bg-slate-50 dark:bg-slate-900 border border-slate-205/85 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-3 relative shadow-sm">
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
                          id={`material-name-mob-${idx}`}
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
                          id={`material-qty-mob-${idx}`}
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
                          id={`material-barcode-mob-${idx}`}
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
                  Total Valuation
                </span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                  ₹{calculateGrandTotal().toLocaleString()}
                </span>
              </div>
            </div>
          </Card>

          {/* Remarks */}
          <Card title="Receiving Remarks">
            <div className="flex flex-col gap-1.5">
              <textarea
                placeholder="Log physical inspection notes, package seals inspection, carrier details..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="block w-full rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 px-3.5 py-2.5 bg-white text-slate-900 border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900 dark:text-white dark:border-slate-700 dark:focus:ring-indigo-500"
                rows={3}
              />
            </div>
          </Card>

          {/* Submission bar */}
          <div className="flex items-center justify-end gap-3.5 border-t border-slate-200 dark:border-slate-800 pt-5">
            <Button variant="outline" size="sm" onClick={() => navigate('/')} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={loading} icon={Save}>
              Submit External Receipt
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ExternalReceivingPage;
