'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import FeedbackDialog from '@/components/ui/FeedbackDialog';
import { clearAllInvoiceData } from '@/utils/invoiceWorkflow';

export default function ClearInvoiceDataButton({ onCleared }) {
  const [feedback, setFeedback] = useState(null);
  const [isClearing, setIsClearing] = useState(false);

  const handleResetAllData = () => {
    setFeedback({
      variant: 'confirm',
      title: 'Clear all sample & workflow data?',
      description: 'This will permanently remove all invoice, approval queue, and POS staging records from both the online database and this browser.',
      confirmLabel: 'Clear all data',
    });
  };

  const confirmResetAllData = async () => {
    if (isClearing) return;
    setIsClearing(true);
    setFeedback(null);
    try {
      await clearAllInvoiceData();

      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('wellen_') && !key.includes('auth')) {
          localStorage.removeItem(key);
        }
      });
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('wellen_')) {
          sessionStorage.removeItem(key);
        }
      });

      localStorage.removeItem('wellen_rejected_invoices');
      localStorage.removeItem('wellen_invoices');
      localStorage.removeItem('wellen_approval_queue');
      localStorage.removeItem('wellen_wpp_staging');
      localStorage.removeItem('wellen_imported_wpp');
      localStorage.removeItem('wellen_new_status_count');
      localStorage.removeItem('wellen_invoice_status_seen');
      sessionStorage.removeItem('wellen_staged_items');
      sessionStorage.removeItem('wellen_import_source');
      sessionStorage.removeItem('wellen_po_prices_include_ppn');

      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('wellen-status-notifications'));
      window.dispatchEvent(new Event('wellen-invoice-workflows'));
      window.dispatchEvent(new Event('wellen-invoice-staging'));

      onCleared?.();
      setFeedback({
        variant: 'success',
        title: 'Data cleared',
        description: 'All invoices, approval queues, and POS staging data have been completely cleared.',
      });
    } catch (error) {
      console.error('Failed to clear sample data:', error);
      setFeedback({
        variant: 'error',
        title: 'Sample data could not be cleared',
        description: error.message || 'Data could not be deleted. Check your connection and try again.',
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleResetAllData}
        disabled={isClearing}
        aria-label={isClearing ? 'Deleting all invoice data' : 'Clear all invoice data'}
        title={isClearing ? 'Deleting data...' : 'Clear all invoice data'}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-50"
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
      <FeedbackDialog
        open={Boolean(feedback)}
        variant={feedback?.variant}
        title={feedback?.title}
        description={feedback?.description}
        confirmLabel={feedback?.confirmLabel}
        onConfirm={confirmResetAllData}
        onClose={() => setFeedback(null)}
      />
    </>
  );
}
