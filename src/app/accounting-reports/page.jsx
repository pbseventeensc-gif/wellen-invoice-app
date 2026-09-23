'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  ReceiptText, 
  FileCheck, 
  CheckCheck, 
  Building2, 
  ChevronDown,
  Download,
  PieChart
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatRupiah } from '@/utils/taxCalculator';

function fmtShort(n) {
  if (!n) return 'Rp 0';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `Rp ${(n / 1e9).toFixed(1).replace('.', ',')} M`;
  if (abs >= 1e6) return `Rp ${(n / 1e6).toFixed(1).replace('.', ',')} jt`;
  return formatRupiah(n);
}

export default function AccountingReportsPage() {
  const [invoices, setInvoices] = useState([]);
  const [role, setRole] = useState('accounting');
  const [periodFilter, setPeriodFilter] = useState('month');
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-09-30');

  // Ambil data faktur yang sudah sah dari localStorage
  const loadData = () => {
    try {
      const stored = localStorage.getItem('wellen_invoices');
      if (stored) {
        const parsed = JSON.parse(stored);
        setInvoices(Array.isArray(parsed) ? parsed : []);
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

  // Perhitungan Nilai Finansial Riil
  const totalOmzetVal = useMemo(() => {
    return invoices.reduce((sum, i) => sum + Number(i.grand_total || i.grandTotal || 0), 0);
  }, [invoices]);

  const totalInvoicesCount = invoices.length;
  const processedCount = invoices.filter((i) => Boolean(i.time_download)).length;
  const realizationRate = totalInvoicesCount > 0 ? Math.round((processedCount / totalInvoicesCount) * 100) : 0;

  const activeClientsSet = useMemo(() => {
    return new Set(invoices.map((i) => i.client_name).filter(Boolean));
  }, [invoices]);

  // Klasifikasi Pajak (Faktur PPN PKP vs Non-PPN)
  const pkpInvoices = useMemo(() => invoices.filter((i) => Number(i.ppn_amount || 0) > 0), [invoices]);
  const nonPkpInvoices = useMemo(() => invoices.filter((i) => Number(i.ppn_amount || 0) === 0), [invoices]);

  const pkpRevenue = useMemo(() => {
    return pkpInvoices.reduce((sum, i) => sum + Number(i.grand_total || i.grandTotal || 0), 0);
  }, [pkpInvoices]);

  const nonPkpRevenue = useMemo(() => {
    return nonPkpInvoices.reduce((sum, i) => sum + Number(i.grand_total || i.grandTotal || 0), 0);
  }, [nonPkpInvoices]);

  const pkpPct = totalInvoicesCount > 0 ? Math.round((pkpInvoices.length / totalInvoicesCount) * 100) : 100;

  // Ekspor Rekap Akuntansi ke Excel
  const handleExport = () => {
    if (invoices.length === 0) {
      alert('No invoice data available for export.');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(invoices.map((inv, idx) => ({
      No: idx + 1,
      Date: inv.invoice_date || inv.time_created?.slice(0, 10) || '-',
      'Invoice Number': inv.invoice_number,
      'Client Entity': inv.client_name,
      'Net Value (DPP)': Number(inv.total_harga_net || inv.totalBersih || 0),
      'VAT (11%)': Number(inv.ppn_amount || 0),
      'Total Receivable (Grand Total)': Number(inv.grand_total || inv.grandTotal || 0),
      'Print / Download Status': inv.time_download ? `Printed (${inv.time_download})` : 'Not Printed',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Accounting Reports');
    XLSX.writeFile(wb, `Accounting_Reports_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Periode 6 Bulan Terakhir
  const monthlyData = useMemo(() => {
    const months = [
      { key: '2026-05', label: 'May 2026' },
      { key: '2026-06', label: 'Jun 2026' },
      { key: '2026-07', label: 'Jul 2026' },
      { key: '2026-08', label: 'Aug 2026' },
      { key: '2026-09', label: 'Sep 2026' },
      { key: '2026-10', label: 'Oct 2026' },
    ];

    return months.map((m) => {
      const matched = invoices.filter((inv) => {
        const d = String(inv.invoice_date || inv.time_created || '');
        return d.startsWith(m.key);
      });

      const revenue = matched.reduce((sum, inv) => sum + Number(inv.grand_total || inv.grandTotal || 0), 0);
      return {
        ...m,
        count: matched.length,
        revenue,
      };
    });
  }, [invoices]);

  const maxCount = useMemo(() => {
    const highest = Math.max(...monthlyData.map((d) => d.count), 0);
    return Math.max(highest + 2, 6);
  }, [monthlyData]);

  const maxRev = useMemo(() => {
    const highest = Math.max(...monthlyData.map((d) => d.revenue), 0);
    return Math.max(highest * 1.25, 10000000);
  }, [monthlyData]);

  // Perhitungan Koordinat Dinamis Grafik SVG
  const chartHeight = 180;
  const chartTop = 30;
  const xPoints = [80, 212, 344, 476, 608, 740];

  const plotPoints = monthlyData.map((d, i) => {
    const x = xPoints[i];
    const countRatio = d.count / maxCount;
    const revRatio = d.revenue / maxRev;

    const yLine = chartTop + chartHeight - countRatio * chartHeight;
    const barH = revRatio * chartHeight;
    const yBar = chartTop + chartHeight - barH;

    return { x, yLine, yBar, barH, count: d.count, revenue: d.revenue };
  });

  const linePath = plotPoints.reduce(
    (acc, p, idx) => (idx === 0 ? `M ${p.x} ${p.yLine}` : `${acc} L ${p.x} ${p.yLine}`),
    ''
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 pb-20 font-sans text-slate-800 antialiased">
      {/* Header Navigasi & Pilihan Akun */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200/80 gap-3">
        <div>
          <div className="text-[12px] text-slate-400">
            Accounting &rsaquo; <span className="text-slate-600">Financial Reports & Receivables</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">Financial Reports & Invoice Summary</h1>
        </div>

        <div>
          <div className="relative inline-block">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="appearance-none bg-white border border-slate-300 text-slate-700 text-xs font-medium pl-3 pr-8 py-1.5 rounded-lg shadow-2xs focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="accounting">View as Accounting Team</option>
              <option value="finance-lead">View as Finance Lead</option>
              <option value="auditor">View as Auditor</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* 4 Kartu Indikator Utama (KPI Akuntansi) - Ringkas, Kompak & Proporsional */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Nilai Tagihan Bruto */}
        <div className="bg-white p-3 px-3.5 rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <span className="p-0.5 rounded bg-amber-50 text-amber-600">
                <ReceiptText size={13} />
              </span>
              Total Billing Value
            </span>
            <button type="button" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-normal text-slate-400 hover:bg-slate-50 cursor-pointer">
              Details <ChevronDown size={10} />
            </button>
          </div>
          <p className="text-lg font-bold tracking-tight text-slate-900 mt-1.5 font-mono">
            {formatRupiah(totalOmzetVal)}
          </p>
        </div>

        {/* Total Dokumen Faktur Disetujui */}
        <div className="bg-white p-3 px-3.5 rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <span className="p-0.5 rounded bg-amber-50 text-amber-600">
                <FileCheck size={13} />
              </span>
              Approved Invoices
            </span>
            <button type="button" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-normal text-slate-400 hover:bg-slate-50 cursor-pointer">
              Details <ChevronDown size={10} />
            </button>
          </div>
          <p className="text-lg font-bold tracking-tight text-slate-900 mt-1.5 font-mono">
            {totalInvoicesCount}
          </p>
        </div>

        {/* Realisasi Berkas Siap Cetak / Unduh */}
        <div className="bg-white p-3 px-3.5 rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <span className="p-0.5 rounded bg-emerald-50 text-emerald-600">
                <CheckCheck size={13} />
              </span>
              Realization Rate
            </span>
            <button type="button" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-normal text-slate-400 hover:bg-slate-50 cursor-pointer">
              Details <ChevronDown size={10} />
            </button>
          </div>
          <p className="text-lg font-bold tracking-tight text-slate-900 mt-1.5 font-mono">
            {realizationRate}%
          </p>
        </div>

        {/* Entitas Klien Aktif */}
        <div className="bg-white p-3 px-3.5 rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <span className="p-0.5 rounded bg-sky-50 text-sky-600">
                <Building2 size={13} />
              </span>
              Registered Clients
            </span>
            <button type="button" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-normal text-slate-400 hover:bg-slate-50 cursor-pointer">
              Details <ChevronDown size={10} />
            </button>
          </div>
          <p className="text-lg font-bold tracking-tight text-slate-900 mt-1.5 font-mono">
            {activeClientsSet.size}
          </p>
        </div>
      </div>

      {/* Ikhtisar Pendapatan & Berkas Faktur Per Periode */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-3.5 px-5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-bold text-slate-900">Revenue & Invoice Overview</span>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <span>RANGE</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onClick={(e) => e.target.showPicker?.()}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
              />
              <span className="text-slate-300">–</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                onClick={(e) => e.target.showPicker?.()}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-xs">
              <button
                type="button"
                onClick={() => setPeriodFilter('month')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  periodFilter === 'month'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('year')}
                className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  periodFilter === 'year'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yearly
              </button>
            </div>

            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              <Download size={13} />
              Export
            </button>
          </div>
        </div>

        {/* Grafik Kombinasi SVG (Line & Bar Chart) - Bersih & Tanpa Tumpuk Teks */}
        <div className="p-6 overflow-x-auto">
          <div className="min-w-[780px]">
            <svg viewBox="0 0 820 270" className="w-full h-auto overflow-visible font-sans">
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.15" />
                </linearGradient>
              </defs>

              {/* Grid Horizontal */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = chartTop + chartHeight * (1 - ratio);
                return (
                  <g key={idx}>
                    <line x1="50" y1={y} x2="770" y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                  </g>
                );
              })}

              {/* Bar Chart Revenue (Hanya digambar bila revenue > 0) */}
              {plotPoints.map((p, i) => (
                p.revenue > 0 ? (
                  <g key={i}>
                    <rect
                      x={p.x - 20}
                      y={p.yBar}
                      width="40"
                      height={Math.max(p.barH, 4)}
                      rx="6"
                      fill="url(#barGrad)"
                      className="transition-all hover:opacity-100 opacity-85"
                    />
                    <text
                      x={p.x}
                      y={Math.max(p.yBar - 8, 18)}
                      textAnchor="middle"
                      className="text-[11px] font-mono font-bold fill-amber-700"
                    >
                      {fmtShort(p.revenue)}
                    </text>
                  </g>
                ) : null
              ))}

              {/* Line Chart Volume Invoices */}
              <path
                d={linePath}
                fill="none"
                stroke="#0284c7"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Dot Markers ("Bulat-bulat" Biru Tajam & Terang) */}
              {plotPoints.map((p, i) => (
                <g key={i} className="group cursor-pointer">
                  {/* Outer Glow Halo Ring */}
                  <circle
                    cx={p.x}
                    cy={p.yLine}
                    r="10"
                    fill="#0284c7"
                    fillOpacity="0.18"
                    className="group-hover:scale-150 transition-transform origin-center"
                  />
                  {/* Lingkaran Bulat Utama */}
                  <circle
                    cx={p.x}
                    cy={p.yLine}
                    r="6"
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                  {/* Label Teks Jumlah Inv (Tepat di atas titik bulat) */}
                  <text
                    x={p.x}
                    y={p.yLine - 14}
                    textAnchor="middle"
                    className="text-[11px] font-mono font-bold fill-slate-700"
                  >
                    {p.count} inv
                  </text>
                </g>
              ))}

              {/* Sumbu X Label Bulan */}
              {monthlyData.map((d, i) => (
                <text
                  key={i}
                  x={xPoints[i]}
                  y="245"
                  textAnchor="middle"
                  className="text-[11px] font-semibold fill-slate-500 font-sans"
                >
                  {d.label}
                </text>
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* Diagram Lingkaran Klasifikasi Pajak & Realisasi Cetak */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Diagram Lingkaran Pajak PPN PKP vs Non-PKP */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <PieChart size={16} className="text-amber-500" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Tax Classification & VAT Distribution</h3>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
              {pkpPct}% PKP
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-1">
            {/* Lingkaran Donut Chart */}
            <div className="relative w-32 h-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.8"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-amber-500 transition-all duration-500"
                  strokeDasharray={`${pkpPct}, 100`}
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold font-mono text-slate-900">{pkpPct}%</span>
                <span className="text-[10px] text-slate-400 font-medium uppercase">VAT PKP</span>
              </div>
            </div>

            {/* Rincian Angka */}
            <div className="space-y-2.5 flex-1 w-full text-xs">
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-amber-900">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    PKP Invoices (VAT 11%)
                  </span>
                  <span className="font-mono font-bold text-amber-900">{pkpInvoices.length} inv</span>
                </div>
                <div className="flex justify-between font-mono text-[11px] text-amber-800">
                  <span>Gross Value:</span>
                  <span>{formatRupiah(pkpRevenue)}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                    Non-PKP Invoices
                  </span>
                  <span className="font-mono font-bold text-slate-700">{nonPkpInvoices.length} inv</span>
                </div>
                <div className="flex justify-between font-mono text-[11px] text-slate-500">
                  <span>Gross Value:</span>
                  <span>{formatRupiah(nonPkpRevenue)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Diagram Lingkaran Realisasi Pencetakan / Unduh */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <PieChart size={16} className="text-emerald-500" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Print & Fulfillment Realization</h3>
            </div>
            <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {realizationRate}% Done
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-1">
            {/* Lingkaran Donut Chart */}
            <div className="relative w-32 h-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.8"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500 transition-all duration-500"
                  strokeDasharray={`${realizationRate}, 100`}
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold font-mono text-slate-900">{realizationRate}%</span>
                <span className="text-[10px] text-slate-400 font-medium uppercase">Printed</span>
              </div>
            </div>

            {/* Rincian Angka */}
            <div className="space-y-2.5 flex-1 w-full text-xs">
              <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-emerald-900">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    Downloaded / Printed
                  </span>
                  <span className="font-mono font-bold text-emerald-900">{processedCount} inv</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                    Pending Download
                  </span>
                  <span className="font-mono font-bold text-slate-700">{totalInvoicesCount - processedCount} inv</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}