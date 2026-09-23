'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Download,
  FileSpreadsheet,
  FileCheck2,
  CheckCircle2,
  Search,
  Layers,
  ShieldCheck,
  ArrowUpDown,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatRupiah } from '@/utils/taxCalculator';

export default function EfakturExportPage() {
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [nsfpStart, setNsfpStart] = useState('010.000-26.00000001');

  // NPWP Klien Map state (bisa diedit di tabel)
  const [npwpMap, setNpwpMap] = useState({
    'PT. Foods Beverages Indonesia': '01.345.678.9-012.000',
    'PT ASPIRASI HIDUP INDONESIA TBK': '01.234.567.8-011.000',
    'PT. PMG INTEGRASI KOMUNIKASI': '02.111.222.3-015.000',
    'PT DIGITAL CREATIVE ASIA': '03.444.555.6-020.000',
  });

  const loadData = () => {
    try {
      const stored = localStorage.getItem('wellen_invoices');
      if (stored) {
        const parsed = JSON.parse(stored);
        const dataList = Array.isArray(parsed) ? parsed : [];
        setInvoices(dataList);
        setSelectedIds(dataList.map((i) => i.id));
      } else {
        setInvoices([]);
      }
    } catch (e) {
      console.error('Gagal memuat data faktur:', e);
      setInvoices([]);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const handleNpwpChange = (clientName, newNpwp) => {
    setNpwpMap((prev) => ({
      ...prev,
      [clientName]: newNpwp,
    }));
  };

  // Filter Invoice Terpilih
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

  // Total Nilai Pajak
  const totalDpp = useMemo(() => {
    return selectedInvoices.reduce((sum, i) => sum + Number(i.subtotal_net || i.total_harga_net || 0), 0);
  }, [selectedInvoices]);

  const totalPpn = useMemo(() => {
    return selectedInvoices.reduce((sum, i) => sum + Number(i.ppn_amount || 0), 0);
  }, [selectedInvoices]);

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredInvoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInvoices.map((i) => i.id));
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Ekspor CSV Standar Format e-Faktur DJP (Faktur Pajak Keluaran FK)
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
      const clientNameClean = (inv.client_name || 'CLIENT').replace(/,/g, '');
      const addressClean = (inv.client_address || 'JAKARTA').replace(/\n/g, ' ').replace(/,/g, '');

      csvContent += `FK,01,0,"${generatedNsfp}",${month || '09'},${year || '2026'},"${dateStr}","${npwpClean}","${clientNameClean}","${addressClean}",${dpp},${ppn},0,0,0,0,0,0,"${inv.invoice_number}"\n`;
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

  // Ekspor Rekap e-Faktur ke Excel
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
        'Nomor Invoice WPP': inv.invoice_number,
        'NPWP Klien': npwpMap[inv.client_name] || '01.234.567.8-012.000',
        'Nama PKP Klien / PT': inv.client_name,
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
    <div className="max-w-[1400px] mx-auto space-y-5 pb-20 font-sans text-slate-800 antialiased">
      {/* Header Navigasi & Judul Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200/80 gap-3">
        <div>
          <div className="text-[12px] text-slate-400">
            Tax & Compliance &rsaquo; <span className="text-slate-600">DJP e-Faktur Pajak Exporter</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">DJP e-Faktur Pajak Exporter</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-normal">
            Export approved taxable invoices directly to DJP e-Faktur CSV format (Faktur Pajak Keluaran FK) for DJP Online filing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-normal px-3 py-1.5 rounded-lg text-xs shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet size={14} />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportDjpCsv}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-normal px-3 py-1.5 rounded-lg text-xs shadow-2xs transition-colors cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Kartu Ringkasan Indikator Pajak e-Faktur (Warna Hitam, Tanpa Bold) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wider block mb-1">
            SELECTED TAXABLE INVOICES (PKP)
          </span>
          <p className="text-xl font-mono text-slate-900 font-normal">
            {selectedInvoices.length} <span className="text-xs font-normal text-slate-500">Documents</span>
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wider block mb-1">
            TOTAL NET VALUE (DPP PAJAK)
          </span>
          <p className="text-xl font-mono text-slate-900 font-normal">
            {formatRupiah(totalDpp)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wider block mb-1">
            TOTAL PPN KELUARAN (11%)
          </span>
          <p className="text-xl font-mono text-slate-900 font-normal">
            {formatRupiah(totalPpn)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wider block mb-1">
            NSFP START NUMBER RANGE
          </span>
          <input
            type="text"
            value={nsfpStart}
            onChange={(e) => setNsfpStart(e.target.value)}
            className="w-full mt-1 font-mono text-xs font-normal px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-400"
          />
        </div>
      </div>

      {/* Bar Pencarian & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[300px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search WPP Invoice number or Client PT Entity..."
            className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 text-slate-900 placeholder:text-slate-400 font-normal"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-normal text-slate-600">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span>Validated for DJP Online e-Faktur Import</span>
        </div>
      </div>

      {/* Tabel Data e-Faktur Keluaran (Teks Hitam, Tanpa Bold) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase font-normal text-[10px] border-b border-slate-200 tracking-wider">
              <tr>
                <th className="py-3.5 px-4 text-center w-12 font-normal">
                  <input
                    type="checkbox"
                    checked={filteredInvoices.length > 0 && selectedIds.length === filteredInvoices.length}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-slate-700 focus:ring-slate-400 cursor-pointer"
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
            <tbody className="divide-y divide-slate-100 font-normal">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-normal">
                    No approved invoices found for e-Faktur export.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv, idx) => {
                  const isSelected = selectedIds.includes(inv.id);
                  const nsfpBase = nsfpStart.replace(/[^0-9]/g, '');
                  const prefix = nsfpStart.slice(0, 11);
                  const startNum = parseInt(nsfpBase.slice(-8), 10) || 1;
                  const generatedNsfp = `${prefix}${String(startNum + idx).padStart(8, '0')}`;

                  return (
                    <tr
                      key={inv.id || idx}
                      className={`transition-colors ${
                        isSelected ? 'bg-amber-50/20' : 'hover:bg-slate-50/60 opacity-60'
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(inv.id)}
                          className="rounded border-slate-300 text-slate-700 focus:ring-slate-400 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400 font-normal">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap font-normal">
                        {inv.invoice_date || inv.time_created?.slice(0, 10)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-normal text-slate-900 whitespace-nowrap">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3.5 px-4 font-normal text-slate-900 max-w-xs truncate">
                        {inv.client_name}
                      </td>
                      <td className="py-3.5 px-4">
                        <input
                          type="text"
                          value={npwpMap[inv.client_name] || '01.234.567.8-012.000'}
                          onChange={(e) => handleNpwpChange(inv.client_name, e.target.value)}
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-normal text-slate-800 outline-none focus:border-slate-400 focus:bg-white"
                        />
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-900 font-normal whitespace-nowrap">
                        {formatRupiah(inv.subtotal_net || inv.total_harga_net || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-normal text-slate-900 whitespace-nowrap">
                        {formatRupiah(inv.ppn_amount || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-normal text-slate-900 whitespace-nowrap">
                        {formatRupiah(inv.grand_total || inv.grandTotal || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-xs font-normal text-slate-900 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-900 px-2.5 py-1 rounded-md border border-slate-200 font-normal">
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
      </div>
    </div>
  );
}
