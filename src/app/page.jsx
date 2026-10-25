'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  FileText,
  ArrowUpRight,
  TrendingUp,
  FilePlus,
  ShieldCheck
} from 'lucide-react';
import { listInvoiceWorkflows } from '@/utils/invoiceWorkflow';
import { listInvoiceStaging } from '@/utils/invoiceStaging';

export default function HomePage() {
  // Keep initial values identical on the server and client to prevent hydration mismatch.
  // Shared import staging and invoice workflow counts are loaded after mount.
  const [stats, setStats] = useState({ totalStaging: 0, pendingApproval: 0, approvedCount: 0, readyCount: 0 });
  const [loadError, setLoadError] = useState('');

  const loadStats = async () => {
    try {
      const [stagingList, workflows] = await Promise.all([
        listInvoiceStaging(),
        listInvoiceWorkflows(),
      ]);
      const activeStaging = stagingList.filter((item) => ['draft', 'ready', 'ready_to_process', 'rejected'].includes(item.status));

      setStats({
        totalStaging: activeStaging.length,
        pendingApproval: workflows.filter((invoice) => invoice.status === 'waiting_approval').length,
        approvedCount: workflows.filter((invoice) => invoice.status === 'approved').length,
        readyCount: activeStaging.length,
      });
      setLoadError('');
    } catch (e) {
      console.error('Failed to load dashboard stats:', e);
      setLoadError('Shared invoice status could not be loaded. Check your connection and access.');
    }
  };

  useEffect(() => {
    // Sengaja dimuat setelah mount (bukan di initial state) agar tidak terjadi hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStats();
    window.addEventListener('storage', loadStats);
    window.addEventListener('wellen-invoice-workflows', loadStats);
    window.addEventListener('wellen-invoice-staging', loadStats);
    window.addEventListener('focus', loadStats);
    const refreshInterval = window.setInterval(loadStats, 30000);
    return () => {
      window.removeEventListener('storage', loadStats);
      window.removeEventListener('wellen-invoice-workflows', loadStats);
      window.removeEventListener('wellen-invoice-staging', loadStats);
      window.removeEventListener('focus', loadStats);
      window.clearInterval(refreshInterval);
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {loadError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {loadError}
        </div>
      )}
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-stone-200/80">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Invoicing Dashboard</h1>
          <p className="text-xs text-stone-600 mt-1 font-normal">
            Real-time overview of POS WPP imports, automated invoice processing, and authorization queues.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/create-invoice"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-2xs transition-all cursor-pointer"
          >
            <FilePlus size={16} />
            <span>Create Invoice</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs hover:border-stone-300 transition-colors">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Total Queue</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
              <FileText size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-3">{stats.totalStaging}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-stone-600 font-normal">
            <TrendingUp size={12} className="text-amber-600" />
            <span>Active import staging</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs hover:border-stone-300 transition-colors">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Pending Review</span>
            <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center border border-stone-200">
              <Clock size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-3">{stats.pendingApproval}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-700 font-medium">
            <span>Requires manager approval</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs hover:border-stone-300 transition-colors">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Approved</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-3">{stats.approvedCount}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-700 font-medium">
            <span>Ready for printing & DJP</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs hover:border-stone-300 transition-colors">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">Imported WPP</span>
            <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center border border-stone-200">
              <FileSpreadsheet size={16} />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-3">{stats.readyCount}</p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-stone-600 font-normal">
            <span>Ready for invoice generation</span>
          </div>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              Data Processing
            </div>
            <h2 className="text-base font-bold text-stone-900">Import Excel WPP & Client PO</h2>
            <p className="text-xs text-stone-600 leading-relaxed font-normal">
              Upload POS Excel recap spreadsheets or client Purchase Orders to populate line items, net values, and stores automatically.
            </p>
          </div>

          <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
            <span className="text-[11px] text-stone-500 font-medium font-mono">Module: /import</span>
            <Link
              href="/import"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 transition-colors"
            >
              <span>Open Document Ingestion</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-stone-100 border border-stone-200 text-[10px] font-bold text-stone-700 uppercase tracking-wider">
              Compliance & Reporting
            </div>
            <h2 className="text-base font-bold text-stone-900">DJP e-Faktur & Accounting Reports</h2>
            <p className="text-xs text-stone-600 leading-relaxed font-normal">
              Generate DJP-compliant e-Faktur Pajak CSV files and review complete financial receivables and realization analytics.
            </p>
          </div>

          <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
            <span className="text-[11px] text-stone-500 font-medium font-mono">Module: /efaktur-export</span>
            <Link
              href="/efaktur-export"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-800 hover:text-stone-950 transition-colors"
            >
              <span>Open e-Faktur Exporter</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Security & System Info Strip */}
      <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4 flex items-center gap-3 text-xs text-stone-600">
        <ShieldCheck size={18} className="text-stone-500 shrink-0" />
        <p className="text-[11px] leading-relaxed font-normal text-stone-600">
          <strong className="text-stone-900 font-semibold">System Audit Active:</strong> All invoice edits, status transitions, and approval authorizations are logged according to corporate accounting retention standards.
        </p>
      </div>
    </div>
  );
}
