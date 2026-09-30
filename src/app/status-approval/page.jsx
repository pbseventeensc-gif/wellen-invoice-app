'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  XCircle,
  Clock,
  Search,
  Printer,
  Trash2,
  Building2,
  User,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter
} from 'lucide-react';
import { formatRupiah } from '@/utils/taxCalculator';
import PrintModal from '@/components/invoice-print/PrintModal';

const DEFAULT_TRACKING = [
  {
    id: 'wpk-track-1',
    invoice_number: 'WPP-2026-1010',
    wpp_number: 'WPP-2026-1010',
    no_faktur: 'WPP-2026-1010',
    client_name: 'PT ASPIRASI HIDUP INDONESIA TBK',
    store_name: 'AZKO BINTARO XCHANGE',
    item_description: 'AZKO BINTARO XCHANGE',
    total_price: 1974874,
    total_faktur: 1974874,
    status: 'rejected',
    reject_reason: 'salah quantity dan mohon direvisi',
    ar_name: 'FAHADA',
  },
  {
    id: 'wpk-track-2',
    invoice_number: 'WPP 0826-702911',
    wpp_number: 'WPP 0826-702911',
    no_faktur: 'WPP 0826-702911',
    client_name: 'PT DIGITAL CREATIVE ASIA',
    store_name: 'AZKO KOTA KASABLANKA',
    item_description: 'AZKO KOTA KASABLANKA',
    total_price: 1648150,
    total_faktur: 1648150,
    status: 'waiting_approval',
    reject_reason: '',
    ar_name: 'FAHADA',
  },
];

export default function StatusApprovalPage() {
  const [trackingItems, setTrackingItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadTrackingItems = () => {
    try {
      const storedStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
      const trackingRows = storedStaging.filter((it) => it.status === 'waiting_approval' || it.status === 'rejected');

      if (trackingRows.length > 0) {
        setTrackingItems(trackingRows);
        return;
      }

      setTrackingItems(DEFAULT_TRACKING);
    } catch (e) {
      console.error('Failed to load tracking items:', e);
      setTrackingItems(DEFAULT_TRACKING);
    }
  };

  useEffect(() => {
    loadTrackingItems();
    window.addEventListener('storage', loadTrackingItems);
    return () => window.removeEventListener('storage', loadTrackingItems);
  }, []);

  const handleDeleteItem = (id, invNumber) => {
    if (confirm(`Delete item ${invNumber} from tracking list?`)) {
      try {
        const storedStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
        const updatedStaging = storedStaging.filter((it) => it.id !== id);
        localStorage.setItem('wellen_wpp_staging', JSON.stringify(updatedStaging));
        loadTrackingItems();
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleClearAll = () => {
    if (confirm('Reset status for all tracking items back to draft?')) {
      try {
        const storedStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
        const updatedStaging = storedStaging.map((it) =>
          it.status === 'waiting_approval' || it.status === 'rejected' ? { ...it, status: 'draft', reject_reason: '' } : it
        );
        localStorage.setItem('wellen_wpp_staging', JSON.stringify(updatedStaging));
        loadTrackingItems();
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.error(e);
      }
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
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

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

        {trackingItems.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold transition cursor-pointer self-start"
          >
            <Trash2 size={14} />
            Reset All Status
          </button>
        )}
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs">
          <span className="text-[10px] font-normal text-stone-400 uppercase tracking-wider block mb-1">
            WAITING APPROVAL
          </span>
          <p className="text-xl font-mono text-amber-600 font-bold">
            {stats.waiting} <span className="text-xs font-normal text-stone-500">Items</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs">
          <span className="text-[10px] font-normal text-stone-400 uppercase tracking-wider block mb-1">
            REJECTED / REVISION
          </span>
          <p className="text-xl font-mono text-rose-600 font-bold">
            {stats.rejected} <span className="text-xs font-normal text-stone-500">Items</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs">
          <span className="text-[10px] font-normal text-stone-400 uppercase tracking-wider block mb-1">
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
              type="text"
              placeholder="Search invoice number, store, reason..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#55e07e] text-stone-900"
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
          <span className="text-xs text-stone-500 font-normal">Rows per page:</span>
          <select
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
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
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
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
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id, item.wpp_number || item.no_faktur)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove Item"
                          >
                            <Trash2 size={15} />
                          </button>
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
          <div className="p-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500 font-normal">
            <div>
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} items
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-3 py-1 font-semibold text-stone-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
