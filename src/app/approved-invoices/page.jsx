'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  Search, 
  Printer, 
  Trash2, 
  FileSpreadsheet, 
  Building2,
  User,
  ArrowUpDown,
  Download,
  Clock,
  CreditCard,
  History,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatRupiah } from '@/utils/taxCalculator';
import PrintModal from '@/components/invoice-print/PrintModal';

const DEFAULT_APPROVED = [
  {
    id: 'wpk-default-1',
    invoice_number: 'WPK 0826-702909',
    invoice_date: '2026-09-10',
    client_name: 'PT ASPIRASI HIDUP INDONESIA TBK',
    promo_name: 'PROMO ADHOC WEEKEND BOOM DEALS',
    total_harga_net: 2937587,
    is_dpp_active: false,
    dpp_lain: 2692788,
    ppn_amount: 323135,
    grand_total: 3260722,
    discountJasaCetak: -326399,
    ar_name: 'FAHADA',
    time_created: '2026-09-10 12:00',
    time_approved: '2026-09-10 12:00',
    time_download: null,
    status: 'approved',
    items: [
      { id: '1', item_description: 'AZKO KOTA KASABLANKA', qty: 1, unit_price: 1484820, total_price: 1484820 },
      { id: '2', item_description: 'AZKO PEJATEN VILLAGE', qty: 1, unit_price: 7386, total_price: 7386 },
      { id: '3', item_description: 'AZKO LIPPO MALL KRAMAT JATI', qty: 1, unit_price: 50450, total_price: 50450 },
      { id: '4', item_description: 'AZKO LP PALEM SEMI', qty: 1, unit_price: 187340, total_price: 187340 },
    ],
  },
  {
    id: 'wpk-default-2',
    invoice_number: 'WPK 0826-702908',
    invoice_date: '2026-08-28',
    client_name: 'PT. PMG INTEGRASI KOMUNIKASI',
    promo_name: 'COCA COLA - POSTER MENU COMBO SEIZEL BURGER',
    total_harga_net: 295000,
    is_dpp_active: false,
    dpp_lain: 270417,
    ppn_amount: 32450,
    grand_total: 327450,
    discountJasaCetak: -32778,
    ar_name: 'FAHADA',
    time_created: '2026-08-28 10:30',
    time_approved: '2026-08-28 10:30',
    time_download: null,
    status: 'approved',
    items: [
      { id: '1', item_description: 'POSTER A3+ COMBO BURGER', qty: 10, unit_price: 29500, total_price: 295000 },
    ],
  },
];

export default function ApprovedInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('ALL');
  const [selectedCreator, setSelectedCreator] = useState('ALL');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // State untuk Sorting (Pengurutan Kolom)
  const [sortField, setSortField] = useState('invoice_date');
  const [sortDirection, setSortDirection] = useState('desc');

  // State untuk Pagination (Skala Ratusan Data)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Ambil data invoice dari storage dan bersihkan duplikasi berdasarkan nomor invoice
  const loadInvoices = () => {
    try {
      const stored = localStorage.getItem('wellen_invoices');
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        const dataList = Array.isArray(parsed) ? parsed : [];
        
        const uniqueInvoices = Array.from(
          new Map(dataList.map((item) => [item.id || item.invoice_number, item])).values()
        );

        setInvoices(uniqueInvoices);
      } else {
        setInvoices(DEFAULT_APPROVED);
        localStorage.setItem('wellen_invoices', JSON.stringify(DEFAULT_APPROVED));
      }
    } catch (e) {
      console.error('Gagal memuat invoice:', e);
      setInvoices([]);
    }
  };

  useEffect(() => {
    loadInvoices();
    window.addEventListener('storage', loadInvoices);
    return () => window.removeEventListener('storage', loadInvoices);
  }, []);

  // Filter list unik nama klien & nama pembuat (creator) untuk dropdown filter
  const clientList = ['ALL', ...Array.from(new Set(invoices.map((inv) => inv.client_name).filter(Boolean)))];
  const creatorList = ['ALL', ...Array.from(new Set(invoices.map((inv) => inv.ar_name || inv.created_by || 'FAHADA').filter(Boolean)))];

  // Handler klik header untuk mengubah urutan (sorting)
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter & Sorting data
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        inv.invoice_number?.toLowerCase().includes(term) ||
        inv.client_name?.toLowerCase().includes(term) ||
        inv.promo_name?.toLowerCase().includes(term);

      const matchesClient = selectedClient === 'ALL' || inv.client_name === selectedClient;

      const creatorName = inv.ar_name || inv.created_by || 'FAHADA';
      const matchesCreator = selectedCreator === 'ALL' || creatorName === selectedCreator;

      return matchesSearch && matchesClient && matchesCreator;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'invoice_date') {
        valA = a.invoice_date || a.time_created || '';
        valB = b.invoice_date || b.time_created || '';
      } else if (sortField === 'time_approved' || sortField === 'time_download') {
        valA = a.time_approved || a.time_created || a.time_download || '';
        valB = b.time_approved || b.time_created || b.time_download || '';
      } else if (sortField === 'total_harga_net') {
        valA = Number(a.total_harga_net || a.totalBersih || 0);
        valB = Number(b.total_harga_net || b.totalBersih || 0);
      } else if (sortField === 'grand_total') {
        valA = Number(a.grand_total || a.grandTotal || 0);
        valB = Number(b.grand_total || b.grandTotal || 0);
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [invoices, searchTerm, selectedClient, selectedCreator, sortField, sortDirection]);

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  // Hitung jumlah berkas yang belum di-download
  const pendingDownloadCount = invoices.filter((inv) => !inv.time_download).length;
  // Hitung total akumulasi nominal
  const totalRevenue = filteredInvoices.reduce((sum, it) => sum + Number(it.grand_total || it.grandTotal || 0), 0);

  // Payment Settlement Totals (Unpaid vs Paid)
  const paidInvoices = filteredInvoices.filter((i) => i.payment_status === 'paid');
  const unpaidInvoices = filteredInvoices.filter((i) => i.payment_status !== 'paid');

  const paidTotal = paidInvoices.reduce((sum, i) => sum + Number(i.grand_total || i.grandTotal || 0), 0);
  const unpaidTotal = unpaidInvoices.reduce((sum, i) => sum + Number(i.grand_total || i.grandTotal || 0), 0);

  // Toggle Status Pelunasan Payment (Unpaid <-> Paid)
  const handleTogglePaymentStatus = (id) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    const updated = invoices.map((inv) => {
      if (inv.id === id) {
        const isCurrentlyPaid = inv.payment_status === 'paid';
        return {
          ...inv,
          payment_status: isCurrentlyPaid ? 'unpaid' : 'paid',
          payment_date: isCurrentlyPaid ? null : todayStr,
        };
      }
      return inv;
    });

    setInvoices(updated);
    localStorage.setItem('wellen_invoices', JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  };

  // State untuk Drawer Audit Log
  const [selectedAuditInvoice, setSelectedAuditInvoice] = useState(null);

  // Export Rekap ke Excel
  const handleExportExcel = () => {
    if (filteredInvoices.length === 0) {
      alert('No data available for export.');
      return;
    }

    const exportRows = filteredInvoices.map((inv, idx) => ({
      No: idx + 1,
      Date: inv.invoice_date || inv.time_created?.slice(0, 10),
      'Invoice No': inv.invoice_number,
      'Client / PT': inv.client_name,
      'Promo / Material': inv.promo_name || '-',
      Created: inv.ar_name || inv.created_by || 'FAHADA',
      'Approval Time': inv.time_approved || inv.time_created || '-',
      'Payment Settlement Status': inv.payment_status === 'paid' ? `Lunas (${inv.payment_date || '-'})` : 'Belum Lunas (Unpaid)',
      'Net Value': inv.total_harga_net || inv.totalBersih || 0,
      'VAT': inv.ppn_amount || 0,
      'Grand Total': inv.grand_total || inv.grandTotal || 0,
      Status: 'Approved',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Approved Invoices');
    XLSX.writeFile(workbook, `Approved_Invoices_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleDeleteInvoice = (id, invoiceNumber) => {
    if (confirm(`Delete invoice ${invoiceNumber}? Deleted data cannot be recovered.`)) {
      const updated = invoices.filter((inv) => inv.id !== id);
      setInvoices(updated);
      localStorage.setItem('wellen_invoices', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Approved Invoices</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-normal px-2.5 py-0.5 rounded-full border border-emerald-300">
              {filteredInvoices.length} Documents
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1 font-normal">
            Complete list of all approved invoices, ready for A4 physical printing and data export.
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-normal px-3 py-1.5 rounded-lg text-xs shadow-2xs transition-colors cursor-pointer"
        >
          <FileSpreadsheet size={14} />
          <span>Export Excel</span>
        </button>
      </div>

      {/* Kartu Ringkasan Cepat (Warna Hitam, Tanpa Bold) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
          <span className="text-[10px] font-normal text-stone-400 uppercase tracking-wider block mb-1">
            TOTAL INVOICES APPROVED
          </span>
          <p className="text-xl font-mono text-stone-900 font-normal">
            {filteredInvoices.length} <span className="text-xs font-normal text-stone-500">Files</span>
            {pendingDownloadCount > 0 && (
              <span className="ml-2 text-[11px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md font-sans font-normal border border-stone-200">
                {pendingDownloadCount} pending download
              </span>
            )}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
          <span className="text-[10px] font-normal text-stone-400 uppercase tracking-wider block mb-1">
            AGGREGATE GROSS REVENUE
          </span>
          <p className="text-xl font-mono text-stone-900 font-normal">
            {formatRupiah(totalRevenue)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
          <span className="text-[10px] font-normal text-stone-400 uppercase tracking-wider block mb-1">
            PAID / SETTLED RECEIVABLES
          </span>
          <p className="text-xl font-mono text-stone-900 font-normal">
            {formatRupiah(paidTotal)}
          </p>
          <p className="text-[10px] text-stone-400 mt-1 font-normal">{paidInvoices.length} invoices settled</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs">
          <span className="text-[10px] font-normal text-stone-400 uppercase tracking-wider block mb-1">
            OUTSTANDING UNPAID RECEIVABLES
          </span>
          <p className="text-xl font-mono text-stone-900 font-normal">
            {formatRupiah(unpaidTotal)}
          </p>
          <p className="text-[10px] text-stone-400 mt-1 font-normal">{unpaidInvoices.length} pending settlement</p>
        </div>
      </div>

      {/* Filter & Bar Pencarian */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[280px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search WPK invoice number, store name, or promo..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full text-xs pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 text-stone-900 placeholder:text-stone-400 font-normal"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Klien */}
          <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5">
            <Building2 size={14} className="text-stone-400" />
            <select
              value={selectedClient}
              onChange={(e) => {
                setSelectedClient(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-transparent focus:outline-none font-normal text-stone-700 cursor-pointer"
            >
              {clientList.map((client) => (
                <option key={client} value={client}>
                  {client === 'ALL' ? 'All Clients / PT' : client}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Created By */}
          <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5">
            <User size={14} className="text-stone-400" />
            <select
              value={selectedCreator}
              onChange={(e) => {
                setSelectedCreator(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-transparent focus:outline-none font-normal text-stone-700 cursor-pointer"
            >
              {creatorList.map((creator) => (
                <option key={creator} value={creator}>
                  {creator === 'ALL' ? 'All Creators' : creator}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabel Lengkap Approved Invoices */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-stone-50 text-stone-500 uppercase font-normal text-[10px] border-b border-stone-200 tracking-wider">
              <tr>
                <th className="py-3.5 px-4 text-center w-12 font-normal">NO</th>
                
                {/* Header Tanggal */}
                <th 
                  onClick={() => handleSort('invoice_date')}
                  className="py-3.5 px-4 text-center w-28 font-normal cursor-pointer hover:text-stone-950 transition-colors select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>DATE</span>
                    <ArrowUpDown size={12} className="text-stone-400" />
                  </div>
                </th>

                {/* Header No Invoice */}
                <th 
                  onClick={() => handleSort('invoice_number')}
                  className="py-3.5 px-4 w-40 font-normal cursor-pointer hover:text-stone-950 transition-colors select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>INVOICE NO</span>
                    <ArrowUpDown size={12} className="text-stone-400" />
                  </div>
                </th>

                {/* Header Klien */}
                <th 
                  onClick={() => handleSort('client_name')}
                  className="py-3.5 px-4 font-normal cursor-pointer hover:text-stone-950 transition-colors select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>CLIENT (PT) & PROJECT</span>
                    <ArrowUpDown size={12} className="text-stone-400" />
                  </div>
                </th>

                {/* Header Created */}
                <th 
                  onClick={() => handleSort('ar_name')}
                  className="py-3.5 px-4 text-center w-28 font-normal cursor-pointer hover:text-stone-950 transition-colors select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>CREATED BY</span>
                    <ArrowUpDown size={12} className="text-stone-400" />
                  </div>
                </th>

                {/* Header Approved Timestamp */}
                <th 
                  onClick={() => handleSort('time_approved')}
                  className="py-3.5 px-4 text-center w-36 font-normal cursor-pointer hover:text-stone-950 transition-colors select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>APPROVE</span>
                    <ArrowUpDown size={12} className="text-stone-400" />
                  </div>
                </th>

                {/* Header Status Pelunasan */}
                <th className="py-3.5 px-4 text-center w-32 font-normal">PAYMENT</th>

                {/* Header Nilai Net */}
                <th 
                  onClick={() => handleSort('total_harga_net')}
                  className="py-3.5 px-4 text-right w-36 font-normal cursor-pointer hover:text-stone-950 transition-colors select-none"
                >
                  <div className="inline-flex items-center justify-end gap-1">
                    <span>NET VALUE</span>
                    <ArrowUpDown size={12} className="text-stone-400" />
                  </div>
                </th>

                <th className="py-3.5 px-4 text-right w-28 font-normal">VAT</th>

                {/* Header Grand Total */}
                <th 
                  onClick={() => handleSort('grand_total')}
                  className="py-3.5 px-4 text-right w-36 font-normal cursor-pointer hover:text-stone-950 transition-colors select-none"
                >
                  <div className="inline-flex items-center justify-end gap-1">
                    <span>GRAND TOTAL</span>
                    <ArrowUpDown size={12} className="text-stone-400" />
                  </div>
                </th>

                <th className="py-3.5 px-4 text-center w-24 font-normal">STATUS</th>
                <th className="py-3.5 px-4 text-center w-28 font-normal">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-normal">
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-stone-400 font-normal">
                    No invoices matching the search or filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((row, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr key={row.id || idx} className="hover:bg-amber-50/20 transition-colors font-normal">
                      <td className="py-3.5 px-4 text-center text-stone-400 font-mono">{globalIdx}</td>

                      <td className="py-3.5 px-4 text-center text-stone-600 font-mono text-[11px] whitespace-nowrap">
                        {row.invoice_date || row.time_created?.slice(0, 10)}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-stone-900 whitespace-nowrap">
                        {row.invoice_number}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-stone-900 truncate">{row.client_name}</p>
                        <p className="text-[11px] text-stone-500 truncate mt-0.5 font-normal">{row.promo_name || '-'}</p>
                      </td>

                      <td className="py-3.5 px-4 text-center text-stone-700 whitespace-nowrap font-normal">
                        {row.ar_name || row.created_by || 'FAHADA'}
                      </td>

                      {/* Kolom Approved Timestamp */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {row.time_approved || row.time_created ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <Clock size={11} /> {row.time_approved || row.time_created}
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-stone-400 italic">
                            -
                          </span>
                        )}
                      </td>

                      {/* Kolom Payment Settlement Toggle */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleTogglePaymentStatus(row.id)}
                          title="Click to toggle Payment Settlement status"
                          className="cursor-pointer transition hover:scale-105 active:scale-95"
                        >
                          {row.payment_status === 'paid' ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full font-medium">
                              <CreditCard size={11} /> Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 text-[10px] px-2.5 py-0.5 rounded-full font-medium">
                              <Clock size={11} /> Unpaid
                            </span>
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-stone-700 whitespace-nowrap">
                        {formatRupiah(row.total_harga_net || row.totalBersih || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-stone-500 whitespace-nowrap">
                        {formatRupiah(row.ppn_amount || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-stone-900 whitespace-nowrap">
                        {formatRupiah(row.grand_total || row.grandTotal || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-normal">
                          <CheckCircle2 size={11} /> Approved
                        </span>
                      </td>

                      {/* Kolom Aksi */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedAuditInvoice(row)}
                            className="p-1.5 bg-stone-100 hover:bg-slate-800 hover:text-white text-stone-600 rounded-lg transition-colors cursor-pointer"
                            title="View Activity Audit Trail Log"
                          >
                            <History size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(row);
                              setIsPrintModalOpen(true);
                            }}
                            className="p-1.5 bg-stone-100 hover:bg-amber-500 hover:text-stone-950 text-stone-700 rounded-lg transition-colors cursor-pointer"
                            title="Print A4 Invoice"
                          >
                            <Printer size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(row.id, row.invoice_number)}
                            className="p-1.5 bg-stone-100 hover:bg-rose-500 hover:text-white text-stone-400 rounded-lg transition-colors cursor-pointer"
                            title="Delete Document"
                          >
                            <Trash2 size={14} />
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

        {/* Footer Pagination Bar */}
        {filteredInvoices.length > 0 && (
          <div className="p-4 bg-stone-50/80 border-t border-stone-200/80 rounded-b-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-600">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-stone-500">Tampilkan per halaman:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-500 cursor-pointer shadow-2xs"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <span className="text-stone-500 font-medium">
                Halaman <strong className="font-mono text-stone-900 font-bold">{currentPage}</strong> dari{' '}
                <strong className="font-mono text-stone-900 font-bold">{totalPages}</strong>{' '}
                <span className="text-stone-400 font-mono">({filteredInvoices.length} total data)</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="p-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 transition cursor-pointer shadow-2xs"
                title="Halaman Pertama"
              >
                <ChevronsLeft size={15} />
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 transition cursor-pointer shadow-2xs"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft size={15} />
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                  })
                  .map((page, index, array) => {
                    const showEllipsis = index > 0 && page - array[index - 1] > 1;
                    return (
                      <div key={page} className="flex items-center gap-1">
                        {showEllipsis && <span className="px-1 text-stone-400 font-mono">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                            currentPage === page
                              ? 'bg-amber-500 text-slate-950 shadow-xs'
                              : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 transition cursor-pointer shadow-2xs"
                title="Halaman Berikutnya"
              >
                <ChevronRight size={15} />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-1.5 bg-white border border-stone-200 rounded-lg hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 transition cursor-pointer shadow-2xs"
                title="Halaman Terakhir"
              >
                <ChevronsRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Drawer Audit Trail History Log */}
      {selectedAuditInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200/90 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <History className="text-slate-700" size={18} />
                <h3 className="font-bold text-slate-900 text-sm">Document Activity Audit Log</h3>
              </div>
              <button
                onClick={() => setSelectedAuditInvoice(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Invoice Number:</span>
                <span className="font-bold text-slate-900">{selectedAuditInvoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Client / PT:</span>
                <span className="font-medium text-slate-900 truncate max-w-[240px]">{selectedAuditInvoice.client_name}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Grand Total:</span>
                <span className="font-semibold text-slate-900">{formatRupiah(selectedAuditInvoice.grand_total || selectedAuditInvoice.grandTotal || 0)}</span>
              </div>
            </div>

            {/* Timeline Events */}
            <div className="space-y-3 pt-2 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-slate-800 mt-1 shrink-0" />
                <div>
                  <p className="font-bold text-slate-900">Approved & Issued</p>
                  <p className="text-[11px] text-slate-500">{selectedAuditInvoice.time_created || '2026-09-10 12:00'} • Approved by Manager</p>
                </div>
              </div>
              {selectedAuditInvoice.time_download && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-slate-600 mt-1 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-900">PDF Printed / Downloaded</p>
                    <p className="text-[11px] text-slate-500">{selectedAuditInvoice.time_download}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {isPrintModalOpen && selectedInvoice && (
        <PrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          invoice={selectedInvoice}
        />
      )}
    </div>
  );
}