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
    invoice_number: 'WPK 0826-702910',
    invoice_date: '2026-09-11',
    client_name: 'PT DIGITAL CREATIVE ASIA',
    promo_name: 'STICKER VINYL INDOOR GLOSSY',
    total_harga_net: 3263986,
    is_dpp_active: true,
    dpp_lain: 2991989,
    ppn_amount: 359038,
    grand_total: 3616496,
    ar_name: 'FAHADA',
    time_created: '2026-09-11 10:15',
    time_rejected: '2026-09-11 11:30',
    status: 'rejected',
    reject_reason: 'Total quantity and item description need revision as requested by client.',
    items: [
      { id: '1', item_description: 'AZKO BINTARO XCHANGE', qty: 1, unit_price: 1974874, total_price: 1974874 },
      { id: '2', item_description: 'AZKO KOTA KASABLANKA', qty: 1, unit_price: 1648150, total_price: 1648150 },
    ],
  },
];

export default function StatusApprovalPage() {
  const [rejectedInvoices, setRejectedInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadRejectedInvoices = () => {
    try {
      const stored = localStorage.getItem('wellen_rejected_invoices');
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRejectedInvoices(parsed);
          return;
        }
      }
      setRejectedInvoices(DEFAULT_REJECTED);
      localStorage.setItem('wellen_rejected_invoices', JSON.stringify(DEFAULT_REJECTED));
    } catch (e) {
      console.error('Failed to load rejected invoices:', e);
      setRejectedInvoices(DEFAULT_REJECTED);
    }
  };

  useEffect(() => {
    loadRejectedInvoices();
    window.addEventListener('storage', loadRejectedInvoices);
    return () => window.removeEventListener('storage', loadRejectedInvoices);
  }, []);

  const handleDeleteItem = (id, invNumber) => {
    if (confirm(`Delete rejected invoice ${invNumber} from list?`)) {
      const updated = rejectedInvoices.filter((inv) => inv.id !== id);
      setRejectedInvoices(updated);
      localStorage.setItem('wellen_rejected_invoices', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleClearAll = () => {
    if (confirm('Clear all rejected invoices history?')) {
      setRejectedInvoices([]);
      localStorage.setItem('wellen_rejected_invoices', JSON.stringify([]));
      window.dispatchEvent(new Event('storage'));
    }
  };

  const filteredInvoices = useMemo(() => {
    return rejectedInvoices.filter((inv) => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        (inv.invoice_number || '').toLowerCase().includes(term) ||
        (inv.client_name || '').toLowerCase().includes(term) ||
        (inv.promo_name || '').toLowerCase().includes(term) ||
        (inv.ar_name || '').toLowerCase().includes(term) ||
        (inv.reject_reason || '').toLowerCase().includes(term);

      return matchSearch;
    });
  }, [rejectedInvoices, searchTerm]);

  const totalPages = Math.ceil(filteredInvoices.length / pageSize) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2.5">
            <XCircle className="text-rose-600" size={28} />
            Approval Status (Rejected Invoices)
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Track invoices rejected or returned for revision by management/approval with reasons.
          </p>
        </div>

        {rejectedInvoices.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold transition cursor-pointer self-start"
          >
            <Trash2 size={14} />
            Clear History
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs">
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Total Rejected Invoices</p>
          <p className="text-2xl font-extrabold text-stone-900 mt-1 font-mono">{rejectedInvoices.length}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
          <input
            type="text"
            placeholder="Search invoice number, client, reason..."
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
                <th className="py-3 px-4">INVOICE NUMBER</th>
                <th className="py-3 px-4">CLIENT & PROMO</th>
                <th className="py-3 px-4">REJECTION REASON</th>
                <th className="py-3 px-4 text-center">AR STAFF</th>
                <th className="py-3 px-4 text-right">GRAND TOTAL</th>
                <th className="py-3 px-4 text-center w-28">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-normal">
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400 text-xs">
                    No rejected invoices found.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={inv.id || idx} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3.5 px-4 text-center text-stone-400 font-mono">
                        {globalIdx}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-stone-900 whitespace-nowrap">
                        {inv.invoice_number}
                        <span className="block text-[10px] text-stone-400 font-normal">
                          {inv.invoice_date}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-bold text-stone-900 truncate">{inv.client_name}</p>
                        <p className="text-[11px] text-stone-500 truncate">{inv.promo_name}</p>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-[11px] font-medium flex items-start gap-1.5">
                          <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                          <span>{inv.reject_reason || 'Needs revision'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-1 bg-stone-100 text-stone-700 rounded-lg text-[11px] font-semibold">
                          {inv.ar_name || inv.created_by || 'FAHADA'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-stone-900 whitespace-nowrap">
                        {formatRupiah(inv.grand_total || inv.total_harga_net)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setIsPrintModalOpen(true);
                            }}
                            className="p-1.5 text-stone-400 hover:text-[#578ef5] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="View / Print Preview"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(inv.id, inv.invoice_number)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
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
        {filteredInvoices.length > 0 && (
          <div className="p-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
            <div>
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredInvoices.length)} of {filteredInvoices.length} rejected invoices
            </div>
            <div className="flex items-center gap-1">
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

      {/* Print / Preview Modal */}
      {isPrintModalOpen && selectedInvoice && (
        <PrintModal
          invoice={selectedInvoice}
          onClose={() => {
            setIsPrintModalOpen(false);
            setSelectedInvoice(null);
          }}
        />
      )}
    </div>
  );
}
