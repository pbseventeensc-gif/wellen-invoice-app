'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  XCircle,
  Search,
  Printer,
  Trash2,
  Building2,
  User,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { formatRupiah } from '@/utils/taxCalculator';
import PrintModal from '@/components/invoice-print/PrintModal';

const DEFAULT_REJECTED = [
  {
    id: 'wpk-rej-1',
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
];

export default function StatusApprovalPage() {
  const [rejectedItems, setRejectedItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadRejectedItems = () => {
    try {
      const storedStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
      const rejectedRows = storedStaging.filter((it) => it.status === 'rejected');

      if (rejectedRows.length > 0) {
        setRejectedItems(rejectedRows);
        return;
      }

      setRejectedItems(DEFAULT_REJECTED);
    } catch (e) {
      console.error('Failed to load rejected items:', e);
      setRejectedItems(DEFAULT_REJECTED);
    }
  };

  useEffect(() => {
    loadRejectedItems();
    window.addEventListener('storage', loadRejectedItems);
    return () => window.removeEventListener('storage', loadRejectedItems);
  }, []);

  const handleDeleteItem = (id, invNumber) => {
    if (confirm(`Delete rejected item ${invNumber} from list?`)) {
      try {
        const storedStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
        const updatedStaging = storedStaging.filter((it) => it.id !== id);
        localStorage.setItem('wellen_wpp_staging', JSON.stringify(updatedStaging));
        loadRejectedItems();
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleClearAll = () => {
    if (confirm('Reset status for all rejected items back to draft?')) {
      try {
        const storedStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
        const updatedStaging = storedStaging.map((it) =>
          it.status === 'rejected' ? { ...it, status: 'draft', reject_reason: '' } : it
        );
        localStorage.setItem('wellen_wpp_staging', JSON.stringify(updatedStaging));
        loadRejectedItems();
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const filteredItems = useMemo(() => {
    return rejectedItems.filter((item) => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        (item.wpp_number || item.no_faktur || '').toLowerCase().includes(term) ||
        (item.client_name || '').toLowerCase().includes(term) ||
        (item.store_name || item.item_description || '').toLowerCase().includes(term) ||
        (item.ar_name || item.created_by || '').toLowerCase().includes(term) ||
        (item.reject_reason || '').toLowerCase().includes(term);

      return matchSearch;
    });
  }, [rejectedItems, searchTerm]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2.5">
            <XCircle className="text-rose-600" size={28} />
            Status Approval (Rejected Items)
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Synchronized with Invoice List. Track items rejected or returned for revision by management/approval.
          </p>
        </div>

        {rejectedItems.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold transition cursor-pointer self-start"
          >
            <Trash2 size={14} />
            Reset All Rejected Status
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Total Rejected Items</p>
          <p className="text-2xl font-extrabold text-stone-900 mt-1 font-mono">{rejectedItems.length}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
          <input
            type="text"
            placeholder="Search invoice number, store, reason..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:border-rose-500 text-stone-900"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <span className="text-xs text-stone-500 font-medium">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="text-xs font-semibold px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none cursor-pointer"
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
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-semibold border-b border-stone-200 tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">NO</th>
                <th className="py-3 px-4">INVOICE NO</th>
                <th className="py-3 px-4">CLIENT & STORE NAME</th>
                <th className="py-3 px-4">REJECTION REASON</th>
                <th className="py-3 px-4 text-center">AR STAFF</th>
                <th className="py-3 px-4 text-right">TOTAL PRICE</th>
                <th className="py-3 px-4 text-center w-28">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-normal">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400 text-xs">
                    No rejected items found.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={item.id || idx} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3.5 px-4 text-center text-stone-400 font-mono">
                        {globalIdx}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-stone-900 whitespace-nowrap">
                        {item.wpp_number || item.no_faktur}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-bold text-stone-900 truncate">{item.client_name}</p>
                        <p className="text-[11px] text-stone-500 truncate">{item.store_name || item.item_description}</p>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-[11px] font-medium flex items-start gap-1.5">
                          <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                          <span>{item.reject_reason || 'Needs revision'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-1 bg-stone-100 text-stone-700 rounded-lg text-[11px] font-semibold">
                          {item.ar_name || item.created_by || 'FAHADA'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-stone-900 whitespace-nowrap">
                        {formatRupiah(item.total_price || item.total_faktur)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id, item.wpp_number || item.no_faktur)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Item"
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
          <div className="p-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
            <div>
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length} rejected items
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
