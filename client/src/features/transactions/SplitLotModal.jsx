import React, { useState } from 'react';
import { Split, X, AlertCircle } from 'lucide-react';
import api from '../../lib/axios';
import Button from '../../components/ui/Button';

const SplitLotModal = ({ isOpen, onClose, barcode, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please enter a remark or reason for the split.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post('/barcodes/split-request', {
        barcode: barcode.barcode,
        reason: reason.trim()
      });
      alert('Split request submitted to store successfully!');
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit split request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Split className="w-5 h-5 text-blue-500" />
              Request Material Split
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Parent Barcode: {barcode.barcode}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 text-xs">
          <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950/20 p-3.5 rounded-xl border border-slate-100 dark:border-slate-850">
            <div>
              <span className="text-slate-400 font-bold uppercase text-[9px] block">Material</span>
              <span className="font-extrabold text-slate-700 dark:text-slate-200">{barcode.materialName}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold uppercase text-[9px] block">Current Owner</span>
              <span className="font-extrabold text-slate-700 dark:text-slate-200">{barcode.owner?.fullName || 'Active Owner'}</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-500 font-extrabold uppercase tracking-wider mb-1">Remark / Reason for Split *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="Provide reason for split request..."
              rows="3"
              className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 font-bold text-xs bg-red-50 dark:bg-red-950/25 p-3 rounded-lg border border-red-100 dark:border-red-950">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SplitLotModal;
