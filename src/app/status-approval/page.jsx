'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Search,
  AlertCircle,
  Edit3,
  X
} from 'lucide-react';
import { formatRupiah } from '@/utils/taxCalculator';
import FeedbackDialog from '@/components/ui/FeedbackDialog';
import TablePagination from '@/components/ui/TablePagination';
import { listInvoiceWorkflows } from '@/utils/invoiceWorkflow';

export default function StatusApprovalPage() {
  // Initial state kosong (sama di server & client) untuk mencegah hydration mismatch.
  // Only unsent drafts remain local; submitted approval state is read from Supabase.
  const [trackingItems, setTrackingItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [feedback, setFeedback] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadTrackingItems = async () => {
    try {
      const invoices = await listInvoiceWorkflows(['waiting_approval', 'rejected']);
      setTrackingItems(invoices.flatMap((invoice) => (invoice.items || []).map((item, index) => ({
        ...item,
        id: item.id || `${invoice.id}-${index}`,
        invoice_number: invoice.invoice_number,
        status: invoice.status,
        client_name: invoice.client_name || item.client_name,
        ar_name: invoice.ar_name || invoice.created_by || '—',
        wpp_number: item.source_no_wpp || item.wpp_number || item.no_faktur || invoice.invoice_number,
        store_name: item.store_name || item.item_description || '',
        total_price: item.total_price || item.total_faktur || invoice.grand_total || 0,
        reject_reason: invoice.reject_reason,
      }))));
    } catch (error) {
      console.error('Failed to load invoice status from Supabase:', error);
      setFeedback({
        variant: 'error',
        title: 'Invoice status could not be loaded',
        description: 'The shared invoice workflow could not be reached. Check your connection and Supabase access, then retry.',
      });
    }
  };

  useEffect(() => {
    // Sengaja dimuat setelah mount (bukan di initial state) agar tidak terjadi hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTrackingItems();
    window.addEventListener('wellen-invoice-workflows', loadTrackingItems);
    window.addEventListener('focus', loadTrackingItems);
    return () => {
      window.removeEventListener('wellen-invoice-workflows', loadTrackingItems);
      window.removeEventListener('focus', loadTrackingItems);
    };
  }, []);

  const handleSaveEdit = () => {
    if (!editingItem) return;
    try {
      const staging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
      if (!Array.isArray(staging)) throw new Error('POS staging data is not an array.');
      const qty = Number(editingItem.qty) || 1;
      const unitPrice = Number(editingItem.unit_price) || 0;
      let updatedCount = 0;
      const updated = staging.map((item) => {
        if (item.id !== editingItem.id) return item;
        updatedCount += 1;
        const totalPrice = Math.round(qty * unitPrice);
        return {
          ...item,
          store_name: editingItem.store_name,
          item_description: editingItem.store_name,
          qty,
          unit_price: unitPrice,
          total_price: totalPrice,
          nilai_wpp: totalPrice,
          status: 'draft',
        };
      });
      if (!updatedCount) throw new Error('The local draft matching this rejected invoice item was not found.');
      localStorage.setItem('wellen_wpp_staging', JSON.stringify(updated));
      setIsEditModalOpen(false);
      setEditingItem(null);
      setFeedback({
        variant: 'success',
        title: 'Draft revision prepared',
        description: 'A local draft was prepared. The rejected invoice remains unchanged in the shared approval history.',
      });
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error('Failed to prepare rejected invoice revision:', error);
      setFeedback({
        variant: 'error',
        title: 'Draft revision could not be prepared',
        description: error.message || 'The local draft could not be updated.',
      });
    }
  };

  const stats = useMemo(() => {
    const waiting = trackingItems.filter((i) => i.status === 'waiting_approval').length;
    const rejected = trackingItems.filter((i) => i.status === 'rejected').length;
    return { waiting, rejected, total: trackingItems.length };
  }, [trackingItems]);

  const filteredItems = useMemo(() => {
    return trackingItems.filter((item) => {
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'WAITING' && item.status === 'waiting_approval') ||
        (statusFilter === 'REJECTED' && item.status === 'rejected');

      const term = searchTerm.toLowerCase();
      const matchSearch =
        (item.wpp_number || item.no_faktur || '').toLowerCase().includes(term) ||
        (item.client_name || '').toLowerCase().includes(term) ||
        (item.store_name || item.item_description || '').toLowerCase().includes(term) ||
        (item.ar_name || item.created_by || '').toLowerCase().includes(term) ||
        (item.reject_reason || '').toLowerCase().includes(term);

      return matchesStatus && matchSearch;
    });
  }, [trackingItems, statusFilter, searchTerm]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const visiblePage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (visiblePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, visiblePage, pageSize]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-stone-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Status Approval</h1>
            <span className="bg-amber-100 text-amber-800 text-xs font-normal px-2.5 py-0.5 rounded-full border border-amber-300">
              {stats.total} Active Tracking Items
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1 font-normal">
            Monitor invoices currently waiting for management approval and those rejected for revision.
          </p>
        </div>

      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider block mb-1">
            WAITING APPROVAL
          </span>
          <p className="text-xl font-mono text-amber-600 font-bold">
            {stats.waiting} <span className="text-xs font-normal text-stone-500">Items</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider block mb-1">
            REJECTED / REVISION
          </span>
          <p className="text-xl font-mono text-rose-600 font-bold">
            {stats.rejected} <span className="text-xs font-normal text-stone-500">Items</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs">
          <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider block mb-1">
            TOTAL TRACKING
          </span>
          <p className="text-xl font-mono text-stone-900 font-bold">
            {stats.total} <span className="text-xs font-normal text-stone-500">Items</span>
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input
              id="status-search"
              name="statusSearch"
              aria-label="Search invoice number, store, reason"
              type="text"
              placeholder="Search invoice number, store, reason..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500 text-stone-900"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl p-1 text-xs shrink-0">
            <button
              onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${statusFilter === 'ALL' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-500 hover:text-stone-900'}`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => { setStatusFilter('WAITING'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${statusFilter === 'WAITING' ? 'bg-amber-500 text-stone-950 shadow-2xs font-bold' : 'text-stone-500 hover:text-stone-900'}`}
            >
              Waiting ({stats.waiting})
            </button>
            <button
              onClick={() => { setStatusFilter('REJECTED'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${statusFilter === 'REJECTED' ? 'bg-rose-600 text-white shadow-2xs font-bold' : 'text-stone-500 hover:text-stone-900'}`}
            >
              Rejected ({stats.rejected})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <label htmlFor="rows-per-page" className="text-xs text-stone-500 font-normal">Rows per page:</label>
          <select
            id="rows-per-page"
            name="rowsPerPage"
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="text-xs font-normal px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none cursor-pointer"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        <div className="data-table-scroll">
          <table className="data-table w-full text-left text-xs border-collapse">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-normal border-b border-stone-200 tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center font-normal">NO</th>
                <th className="py-3.5 px-4 font-normal">INVOICE NO</th>
                <th className="py-3.5 px-4 font-normal">CLIENT & STORE NAME</th>
                <th className="py-3.5 px-4 font-normal">STATUS & REASON</th>
                <th className="py-3.5 px-4 text-center font-normal">AR STAFF</th>
                <th className="py-3.5 px-4 text-right font-normal">TOTAL PRICE</th>
                <th className="py-3.5 px-4 text-center w-28 font-normal">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-normal">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400 text-xs font-normal">
                    No tracking items found matching filters.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const globalIdx = (visiblePage - 1) * pageSize + idx + 1;
                  const isRejected = item.status === 'rejected';
                  return (
                    <tr key={item.id || idx} className="hover:bg-stone-50/50 transition-colors font-normal">
                      <td className="py-3.5 px-4 text-center text-stone-400 font-mono">
                        {globalIdx}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-stone-900 whitespace-nowrap">
                        {item.wpp_number || item.no_faktur}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-semibold text-stone-900 truncate">{item.client_name}</p>
                        <p className="text-[11px] text-stone-500 truncate">{item.store_name || item.item_description}</p>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        {isRejected ? (
                          <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-[11px] font-normal flex items-start gap-1.5">
                            <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-rose-700 block mb-0.5 uppercase tracking-wide text-[10px]">Rejected</span>
                              <span>{item.reject_reason || 'Needs revision'}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold">
                            <Clock size={12} className="text-amber-600" />
                            <span>Waiting Approval</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-1 bg-stone-100 text-stone-700 rounded-lg text-[11px] font-normal">
                          {item.ar_name || item.created_by || 'FAHADA'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-normal text-stone-900 whitespace-nowrap">
                        {formatRupiah(item.total_price || item.total_faktur)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isRejected ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItem({
                                  id: item.id,
                                  store_name: item.store_name || item.item_description || '',
                                  qty: item.qty || 1,
                                  unit_price: item.unit_price || item.total_price || 0,
                                  reject_reason: item.reject_reason || '',
                                });
                                setIsEditModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-[10px] shadow-2xs transition-colors cursor-pointer"
                              title="Prepare a local draft revision"
                            >
                              <Edit3 size={12} />
                              Edit Draft
                            </button>
                          ) : (
                            <span className="text-[10px] font-medium text-amber-700">In Review</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredItems.length > 0 && (
          <TablePagination
            currentPage={visiblePage}
            pageSize={pageSize}
            totalItems={filteredItems.length}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="p-5 border-b border-stone-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-tight">Prepare Draft Revision</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-600 mb-1">Rejection Reason / Notes:</label>
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900">
                  {editingItem.reject_reason || 'Needs revision'}
                </div>
              </div>
              <div>
                <label className="block font-semibold text-stone-600 mb-1">Store Name / Description:</label>
                <input
                  type="text"
                  value={editingItem.store_name}
                  onChange={(event) => setEditingItem({ ...editingItem, store_name: event.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-900 outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                <label className="block font-semibold text-stone-600">
                  Quantity:
                  <input
                    type="number"
                    step="any"
                    value={editingItem.qty}
                    onChange={(event) => setEditingItem({ ...editingItem, qty: event.target.value })}
                    className="mt-1 w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono text-stone-900 outline-none focus:border-amber-500"
                  />
                </label>
                <label className="block font-semibold text-stone-600">
                  Unit Price (Rp):
                  <input
                    type="number"
                    value={editingItem.unit_price}
                    onChange={(event) => setEditingItem({ ...editingItem, unit_price: event.target.value })}
                    className="mt-1 w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono text-stone-900 outline-none focus:border-amber-500"
                  />
                </label>
              </div>
            </div>
            <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 bg-white border border-stone-200 text-stone-700 rounded-xl font-semibold hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl"
              >
                Save as Draft
              </button>
            </div>
          </div>
        </div>
      )}
      <FeedbackDialog
        open={Boolean(feedback)}
        variant={feedback?.variant}
        title={feedback?.title}
        description={feedback?.description}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}
