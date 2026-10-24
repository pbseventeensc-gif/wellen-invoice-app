'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Download,
  FileSpreadsheet,
  Search,
  ShieldCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatRupiah } from '@/utils/taxCalculator';
import TablePagination from '@/components/ui/TablePagination';
import { listInvoiceWorkflows } from '@/utils/invoiceWorkflow';

function safeSpreadsheetText(value) {
  const text = String(value ?? '');
  return /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function toCsvTextCell(value) {
  return `"${safeSpreadsheetText(value).replace(/"/g, '""')}"`;
}

export default function EfakturExportPage() {
  // Keep the initial state identical on the server and client to prevent hydration mismatch.
  // Supabase invoice data is loaded after mount.
  const [invoices, setInvoices] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [nsfpStart, setNsfpStart] = useState('010.000-26.00000001');

  const [npwpMap, setNpwpMap] = useState({
    'PT. Foods Beverages Indonesia': '01.345.678.9-012.000',
    'PT ASPIRASI HIDUP INDONESIA TBK': '01.234.567.8-011.000',
    'PT. PMG INTEGRASI KOMUNIKASI': '02.111.222.3-015.000',
    'PT DIGITAL CREATIVE ASIA': '03.444.555.6-020.000',
  });

  const loadData = async () => {
    try {
      const data = await listInvoiceWorkflows(['approved']);
      setInvoices(data);
      setSelectedIds(data.map((invoice) => invoice.id));
      setLoadError('');
    } catch (error) {
      console.error('Failed to load e-Faktur invoices from Supabase:', error);
      setLoadError('Approved invoice data could not be loaded from the shared database.');
    }
  };

  useEffect(() => {
    // Sengaja dimuat setelah mount (bukan di initial state) agar tidak terjadi hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    window.addEventListener('wellen-invoice-workflows', loadData);
    window.addEventListener('focus', loadData);
    return () => {
      window.removeEventListener('wellen-invoice-workflows', loadData);
      window.removeEventListener('focus', loadData);
    };
  }, []);

  const handleNpwpChange = (clientName, newNpwp) => {
    setNpwpMap((prev) => ({
      ...prev,
      [clientName]: newNpwp,
    }));
  };

  const filteredInvoices = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return invoices.filter((inv) => {
      const matchNo = inv.invoice_number?.toLowerCase().includes(term);
      const matchClient = inv.client_name?.toLowerCase().includes(term);
      return matchNo || matchClient;
    });
  }, [invoices, searchTerm]);

  const selectedInvoices = useMemo(() => {
    return filteredInvoices.filter((inv) => selectedIds.includes(inv.id));
  }, [filteredInvoices, selectedIds]);
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const visiblePage = Math.min(currentPage, totalPages);
  const paginatedInvoices = filteredInvoices.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);
  const visibleIds = paginatedInvoices.map((invoice) => invoice.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const totalDpp = useMemo(() => {
    return selectedInvoices.reduce((sum, i) => sum + Number(i.subtotal_net || i.total_harga_net || 0), 0);
  }, [selectedInvoices]);

  const totalPpn = useMemo(() => {
    return selectedInvoices.reduce((sum, i) => sum + Number(i.ppn_amount || 0), 0);
  }, [selectedInvoices]);

  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExportDjpCsv = () => {
    if (selectedInvoices.length === 0) {
      alert('Please select at least one approved invoice to export e-Faktur CSV.');
      return;
    }

    let csvContent = 'FK,KD_JENIS_TRANSAKSI,FG_PENGGANTI,NOMOR_FAKTUR,MASA_PAJAK,TAHUN_PAJAK,TANGGAL_FAKTUR,NPWP,NAMA,ALAMAT_LENGKAP,JUMLAH_DPP,JUMLAH_PPN,JUMLAH_PPNBM,ID_KETERANGAN_TAMBAHAN,FG_UANG_MUKA,UANG_MUKA_DPP,UANG_MUKA_PPN,UANG_MUKA_PPNBM,REFERENSI\n';

    const nsfpBase = nsfpStart.replace(/[^0-9]/g, '');
    const prefix = nsfpStart.slice(0, 11);
    const startNum = parseInt(nsfpBase.slice(-8), 10) || 1;

    selectedInvoices.forEach((inv, idx) => {
      const generatedNsfp = `${prefix}${String(startNum + idx).padStart(8, '0')}`;
      const npwpClean = (npwpMap[inv.client_name] || '01.234.567.8-012.000').replace(/[^0-9]/g, '');
      const dateStr = inv.invoice_date || inv.time_created?.slice(0, 10) || '2026-09-10';
      const [year, month] = dateStr.split('-');

      const dpp = Math.round(Number(inv.subtotal_net || inv.total_harga_net || 0));
      const ppn = Math.round(Number(inv.ppn_amount || 0));
      const address = (inv.client_address || 'JAKARTA').replace(/\s+/g, ' ').trim();
      const row = [
        'FK',
        '01',
        '0',
        toCsvTextCell(generatedNsfp),
        toCsvTextCell(month || '09'),
        toCsvTextCell(year || '2026'),
        toCsvTextCell(dateStr),
        toCsvTextCell(npwpClean),
        toCsvTextCell(inv.client_name || 'CLIENT'),
        toCsvTextCell(address),
        String(dpp),
        String(ppn),
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        toCsvTextCell(inv.invoice_number || ''),
      ];
      csvContent += `${row.join(',')}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `DJP_eFaktur_Keluaran_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    if (selectedInvoices.length === 0) {
      alert('Please select at least one invoice to export Excel.');
      return;
    }

    const nsfpBase = nsfpStart.replace(/[^0-9]/g, '');
    const prefix = nsfpStart.slice(0, 11);
    const startNum = parseInt(nsfpBase.slice(-8), 10) || 1;

    const exportRows = selectedInvoices.map((inv, idx) => {
      const generatedNsfp = `${prefix}${String(startNum + idx).padStart(8, '0')}`;
      return {
        No: idx + 1,
        'Tanggal Faktur': inv.invoice_date || inv.time_created?.slice(0, 10),
        'Nomor Seri Faktur Pajak (NSFP)': generatedNsfp,
        'Nomor Invoice WPP': safeSpreadsheetText(inv.invoice_number),
        'NPWP Klien': safeSpreadsheetText(npwpMap[inv.client_name] || '01.234.567.8-012.000'),
        'Nama PKP Klien / PT': safeSpreadsheetText(inv.client_name),
        'Nilai DPP (Net)': Number(inv.subtotal_net || inv.total_harga_net || 0),
        'PPN Keluaran (11%)': Number(inv.ppn_amount || 0),
        'Grand Total Tagihan': Number(inv.grand_total || inv.grandTotal || 0),
        'Status Pelaporan DJP': 'Ready for DJP Upload',
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'e-Faktur Pajak Keluaran');
    XLSX.writeFile(wb, `eFaktur_Tax_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 font-sans text-stone-900 antialiased">
      {loadError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {loadError}
        </div>
      )}
      {/* Header Navigasi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-200/80 gap-3">
        <div>
          <div className="text-[12px] text-stone-400 font-normal">
            Tax & Compliance &rsaquo; <span className="text-stone-600">DJP e-Faktur Pajak Exporter</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight mt-0.5">DJP e-Faktur Pajak Exporter</h1>
          <p className="text-xs text-stone-500 mt-0.5 font-normal">
            Export approved taxable invoices directly to DJP e-Faktur CSV format (Faktur Pajak Keluaran FK) for DJP Online filing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-normal px-3.5 py-2 rounded-xl text-xs shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet size={14} />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportDjpCsv}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-normal px-3.5 py-2 rounded-xl text-xs shadow-2xs transition-colors cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Kartu Ringkasan Indikator Pajak */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-2xs">
          <span className="text-[10px] font-normal text-stone-400 uppercase tracking-wider block mb-1">
            SELECTED TAXABLE INVOICES (PKP)
          </span>
          <p className="text-xl font-mono text-stone-900 font-normal">
            {selectedInvoices.length} <span className="text-xs font-normal text-stone-500">Documents</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-2xs">
          <span className="text-[10px] font-normal text-stone-400 uppercase tracking-wider block mb-1">
            TOTAL NET VALUE (DPP PAJAK)
          </span>
          <p className="text-xl font-mono text-stone-900 font-normal">
            {formatRupiah(totalDpp)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-2xs">
          <span className="text-[10px] font-normal text-stone-400 uppercase tracking-wider block mb-1">
            TOTAL PPN KELUARAN (11%)
          </span>
          <p className="text-xl font-mono text-stone-900 font-normal">
            {formatRupiah(totalPpn)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-2xs">
          <span className="text-[10px] font-normal text-stone-400 uppercase tracking-wider block mb-1">
            NSFP START NUMBER RANGE
          </span>
          <input
            type="text"
            value={nsfpStart}
            onChange={(e) => setNsfpStart(e.target.value)}
            className="w-full mt-1 font-mono text-xs font-normal px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-[#578ef5]"
          />
        </div>
      </div>

      {/* Bar Pencarian & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[300px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search WPP Invoice number or Client PT Entity..."
            className="w-full text-xs pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-[#578ef5] text-stone-900 placeholder:text-stone-400 font-normal"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-normal text-stone-600">
          <ShieldCheck size={16} className="text-amber-600" />
          <span>Validated for DJP Online e-Faktur Import</span>
        </div>
      </div>

      {/* Tabel Data e-Faktur Keluaran */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <div className="data-table-scroll">
          <table className="data-table w-full text-left text-xs border-collapse">
            <thead className="bg-stone-50 text-stone-500 uppercase font-normal text-[10px] border-b border-stone-200 tracking-wider">
              <tr>
                <th className="py-3.5 px-4 text-center w-12 font-normal">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleSelectAll}
                    className="rounded border-stone-300 text-stone-700 focus:ring-[#578ef5] cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4 text-center w-12 font-normal">NO</th>
                <th className="py-3.5 px-4 w-36 font-normal">DATE</th>
                <th className="py-3.5 px-4 w-44 font-normal">INVOICE NO</th>
                <th className="py-3.5 px-4 font-normal">CLIENT PT ENTITY</th>
                <th className="py-3.5 px-4 w-48 font-normal">NPWP KLIEN (EDITABLE)</th>
                <th className="py-3.5 px-4 text-right w-36 font-normal">NET (DPP)</th>
                <th className="py-3.5 px-4 text-right w-32 font-normal">PPN 11%</th>
                <th className="py-3.5 px-4 text-right w-36 font-normal">GRAND TOTAL</th>
                <th className="py-3.5 px-4 text-center w-40 font-normal">NSFP GENERATED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-normal">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400 font-normal">
                    No approved invoices found for e-Faktur export.
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv, idx) => {
                  const rowNumber = (visiblePage - 1) * pageSize + idx + 1;
                  const isSelected = selectedIds.includes(inv.id);
                  const nsfpBase = nsfpStart.replace(/[^0-9]/g, '');
                  const prefix = nsfpStart.slice(0, 11);
                  const startNum = parseInt(nsfpBase.slice(-8), 10) || 1;
                  const generatedNsfp = `${prefix}${String(startNum + rowNumber - 1).padStart(8, '0')}`;

                  return (
                    <tr
                      key={inv.id || idx}
                      className={`transition-colors ${
                        isSelected ? 'bg-[#578ef5]/10' : 'hover:bg-stone-50/60 opacity-60'
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(inv.id)}
                          className="rounded border-stone-300 text-stone-700 focus:ring-[#578ef5] cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-stone-400 font-normal">{rowNumber}</td>
                      <td className="py-3.5 px-4 font-mono text-stone-600 whitespace-nowrap font-normal">
                        {inv.invoice_date || inv.time_created?.slice(0, 10)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-normal text-stone-900 whitespace-nowrap">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3.5 px-4 font-normal text-stone-900 max-w-xs truncate">
                        {inv.client_name}
                      </td>
                      <td className="py-3.5 px-4">
                        <input
                          type="text"
                          value={npwpMap[inv.client_name] || '01.234.567.8-012.000'}
                          onChange={(e) => handleNpwpChange(inv.client_name, e.target.value)}
                          className="w-full px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-normal text-stone-800 outline-none focus:border-[#578ef5] focus:bg-white"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-stone-900 font-normal whitespace-nowrap">
                        {formatRupiah(inv.subtotal_net || inv.total_harga_net || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-normal text-stone-900 whitespace-nowrap">
                        {formatRupiah(inv.ppn_amount || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-normal text-stone-900 whitespace-nowrap">
                        {formatRupiah(inv.grand_total || inv.grandTotal || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-xs font-normal text-stone-900 whitespace-nowrap">
                        <span className="bg-stone-100 text-stone-900 px-2.5 py-1 rounded-md border border-stone-200 font-normal">
                          {generatedNsfp}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredInvoices.length > 0 && (
          <TablePagination
            currentPage={visiblePage}
            pageSize={pageSize}
            totalItems={filteredInvoices.length}
            onPageChange={(page) => setCurrentPage(Math.min(page, totalPages))}
          />
        )}
      </div>
    </div>
  );
}
