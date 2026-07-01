import React, { useState, useEffect } from 'react';
import { Send, X, AlertCircle } from 'lucide-react';
import api from '../../lib/axios';
import Button from '../../components/ui/Button';

const TransferFormModal = ({ isOpen, onClose, barcode, onSuccess }) => {
  const [employees, setEmployees] = useState([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [requiresMgmtApproval, setRequiresMgmtApproval] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      api.get('/employees').then(res => {
        setEmployees(res.data.data || []);
      }).catch(err => console.error(err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetUserId) {
      setError('Please select a target recipient employee.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post(`/barcodes/${barcode.barcode}/transfer`, {
        targetUserId,
        remarks: remarks + (requiresMgmtApproval ? ' [Requires Mgmt Approval]' : ''),
        requiresMgmtApproval,
        gps: { lat: 18.5204, lng: 73.8567, address: 'MIDC Pune, India' }
      });
      alert(res.data.message || 'Transfer request submitted successfully.');
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Transfer request failed.');
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
              <Send className="w-5 h-5 text-blue-500" />
              Transfer Material
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Barcode: {barcode.barcode}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 text-xs">
          <div>
            <label className="block text-slate-500 font-extrabold uppercase tracking-wider mb-1">Target Employee *</label>
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              required
              className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-800 dark:focus:border-blue-500 dark:text-white px-3 py-2.5 font-semibold"
            >
              <option value="">Select Target Employee</option>
              {employees.map(emp => (
                <option key={emp._id} value={emp._id}>{emp.fullName} ({emp.employeeId})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2.5 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 rounded-xl border border-blue-100/50 dark:border-blue-900/50">
            <input
              type="checkbox"
              id="requiresMgmtApproval"
              checked={requiresMgmtApproval}
              onChange={(e) => setRequiresMgmtApproval(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="requiresMgmtApproval" className="text-slate-600 dark:text-slate-300 font-bold cursor-pointer select-none">
              Requires Management Approval
            </label>
          </div>

          <div>
            <label className="block text-slate-500 font-extrabold uppercase tracking-wider mb-1">Remarks / Reason *</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              required
              placeholder="e.g., Transferring encoder for calibration testing."
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
              {submitting ? 'Submitting...' : 'Send Transfer Request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferFormModal;
