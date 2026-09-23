'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, X, Search, Printer, FileText } from 'lucide-react';
import { formatRupiah } from '@/utils/taxCalculator';
import PrintModal from '@/components/invoice-print/PrintModal';

const DEFAULT_APPROVED_INVOICES = [
  {
    id: 'wpk-default-1',
    invoice_number: 'WPK 0826-702908',
    invoice_date: '2026-08-28',
    client_name: 'PT. PMG INTEGRASI KOMUNIKASI',
    promo_name: 'COCA COLA - POSTER MENU COMBO SEIZEL BURGER',
    grand_total: 327450,
    status: 'approved',
    ar_name: 'FAHADA',
  },
];

export default function ApprovedInvoiceSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [approvedList, setApprovedList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const loadApprovedInvoices = () => {
    try {
      const stored = localStorage.getItem('wellen_invoices');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const combined = [
            ...parsed,
            ...DEFAULT_APPROVED_INVOICES.filter(
              (def) => !parsed.some((p) => p.id === def.id || p.invoice_number === def.invoice_number)
            ),
          ];
          setApprovedList(combined);
          return;
        }
      }
      setApprovedList(DEFAULT_APPROVED_INVOICES);
      localStorage.setItem('wellen_invoices', JSON.stringify(DEFAULT_APPROVED_INVOICES));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadApprovedInvoices();

    const handleStorageUpdate = () => loadApprovedInvoices();
    const handleOpenTrigger = () => {
      loadApprovedInvoices();
      setIsOpen(true);
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('open-approved-drawer', handleOpenTrigger);

    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('open-approved-drawer', handleOpenTrigger);
    };
  }, []);

  const filteredList = approvedList.filter((inv) => {
    const term = searchTerm.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(term) ||
      inv.client_name?.toLowerCase().includes(term) ||
      inv.promo_name?.toLowerCase().includes(term)
    );
  });

  return (
    <>
      {/* 1. Backdrop Gelap saat Drawer Terbuka */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/40 z-50 backdrop-blur-[2px] transition-opacity print:hidden"
        />
      )}

      {/* 2. Drawer Panel Sisi Kanan */}
      <aside
        className={`fixed top-0 right-0 h-full w-96 max-w-[90vw] bg-white z-50 shadow-2xl border-l border-stone-200 flex flex-col transition-transform duration-300 ease-in-out print:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header Drawer */}
        <div className="p-4 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Approved Invoices
              </h2>
              <p className="text-[10px] text-stone-400 font-normal">
                {approvedList.length} faktur siap cetak / unduh
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-stone-400 hover:text-white p-1 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Input Pencarian */}
        <div className="p-3 border-b border-stone-100 bg-stone-50/60">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Cari No. Invoice / PT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:border-amber-500 text-stone-800 placeholder:text-stone-400"
            />
          </div>
        </div>

        {/* List Invoice Approved */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 text-stone-400 space-y-2">
              <FileText size={36} className="mx-auto text-stone-300 stroke-[1.5]" />
              <p className="text-xs font-medium text-stone-600">Belum ada invoice yang disetujui</p>
            </div>
          ) : (
            filteredList.map((inv) => (
              <div
                key={inv.id}
                className="bg-white border border-stone-200/90 rounded-xl p-3 shadow-xs hover:border-amber-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-stone-900">
                    {inv.invoice_number}
                  </span>
                  <span className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                    Approved
                  </span>
                </div>

                <p className="text-[11px] font-semibold text-stone-800 mt-1 line-clamp-1">
                  {inv.client_name}
                </p>
                <p className="text-[10px] text-stone-500 line-clamp-1">
                  {inv.promo_name || '-'}
                </p>

                <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-stone-400 block leading-tight">Total:</span>
                    <span className="font-mono text-xs font-bold text-stone-900">
                      {formatRupiah(inv.grand_total || inv.grandTotal || 0)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedInvoice(inv);
                      setIsPrintModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 bg-stone-100 hover:bg-amber-500 hover:text-stone-950 text-stone-700 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    <Printer size={12} />
                    <span>Cetak</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Drawer */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 flex justify-between items-center text-[11px]">
          <span className="text-stone-500">Total Approved:</span>
          <span className="font-mono font-bold text-stone-900">{approvedList.length} Dokumen</span>
        </div>
      </aside>

      {/* Modal Cetak */}
      <PrintModal
        invoice={selectedInvoice}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        onPrintConfirmed={(id) => {
          const now = new Date();
          const pad = (n) => String(n).padStart(2, '0');
          const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

          const updated = approvedList.map((item) =>
            item.id === id ? { ...item, time_download: timeStr } : item
          );
          setApprovedList(updated);
          localStorage.setItem('wellen_invoices', JSON.stringify(updated));
        }}
      />
    </>
  );
}