import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, FileText } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import api from '../../lib/axios';

const PendingApprovals = ({ approvals = [], onRefresh }) => {
  const navigate = useNavigate();
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [actionType, setActionType] = useState(''); // 'accept' | 'reject'
  const [remarks, setRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const openActionModal = (txn, type) => {
    setSelectedTxn(txn);
    setActionType(type);
    setRemarks('');
    setRejectionReason('');
    setError('');
  };

  const handleActionSubmit = async () => {
    if (!selectedTxn) return;
    setSubmitting(true);
    setError('');

    try {
      if (actionType === 'accept') {
        // Redirect to receiving page or submit standard accept.
        // Wait, for incoming transactions, the receiver must accept them.
        // Let's call /api/transactions/:id/accept endpoint
        await api.patch(`/transactions/${selectedTxn._id}/accept`, {
          remarks,
        });
      } else {
        // Call /api/transactions/:id/reject endpoint
        if (!rejectionReason.trim()) {
          setError('Rejection reason is required');
          setSubmitting(false);
          return;
        }
        await api.patch(`/transactions/${selectedTxn._id}/reject`, {
          rejectionReason,
        });
      }

      setSelectedTxn(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Approval action error:', err);
      setError(err.response?.data?.message || 'Failed to complete approval action');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Pending Approvals" subtitle="Movement requests awaiting your action">
      <div className="flow-root mt-2">
        <ul className="-my-5 divide-y divide-slate-100 dark:divide-slate-800">
          {approvals.length === 0 ? (
            <li className="py-8 text-center text-xs text-slate-400">No pending approvals in your queue.</li>
          ) : (
            approvals.map((txn) => (
              <li key={txn._id} className="py-4.5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 bg-indigo-50 dark:bg-slate-800 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p 
                      onClick={() => navigate(`/transactions/${txn._id}`)}
                      className="text-xs font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:underline"
                    >
                      {txn.transactionId}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      From: <span className="font-semibold">{txn.sender?.fullName}</span> ({txn.documentType})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openActionModal(txn, 'reject')}
                    className="h-8 w-8 p-0 rounded-full text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                    title="Reject"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openActionModal(txn, 'accept')}
                    className="h-8 w-8 p-0 rounded-full text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    title="Accept"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Accept / Reject Action Modal */}
      <Modal
        isOpen={!!selectedTxn}
        onClose={() => setSelectedTxn(null)}
        title={actionType === 'accept' ? 'Accept Movement Request' : 'Reject Movement Request'}
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Transaction: <span className="font-bold text-slate-800 dark:text-white">{selectedTxn?.transactionId}</span>
            <br />
            Are you sure you want to {actionType} this material movement request from {selectedTxn?.sender?.fullName}?
          </p>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400">
              {error}
            </div>
          )}

          {actionType === 'accept' ? (
            <Input
              id="remarks"
              label="Acceptance Remarks (Optional)"
              placeholder="e.g. Received materials in perfect condition"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          ) : (
            <Input
              id="rejectionReason"
              label="Rejection Reason"
              placeholder="e.g. Quantity mismatch, damage found"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
            />
          )}

          <div className="flex items-center justify-end gap-2.5 mt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => setSelectedTxn(null)}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === 'accept' ? 'success' : 'danger'}
              size="sm"
              loading={submitting}
              onClick={handleActionSubmit}
            >
              {actionType === 'accept' ? 'Approve & Accept' : 'Reject Request'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

export default PendingApprovals;
