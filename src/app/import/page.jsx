'use client';

import { useState } from 'react';
import { FileSpreadsheet, FileText, Sparkles } from 'lucide-react';
import ImportExcelTab from '@/components/import/ImportExcelTab';
import ClientPoTab from '@/components/import/ClientPoTab';

export default function ImportExcelPage() {
  const [activeTab, setActiveTab] = useState('excel');

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-16 pt-1">
      {/* Header Profesional Wellen Print */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-stone-900 text-white p-5 rounded-2xl shadow-sm border border-slate-700/60">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-1.5">
            <Sparkles size={11} />
            <span>Wellen Print Enterprise Portal</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Import & Document Ingestion</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl font-normal leading-relaxed">
            Sistem impor terstandarisasi untuk rekapitulasi data penjualan POS Excel dan Purchase Order Klien. Data langsung terintegrasi dengan kalkulasi perpajakan dan alur invoice.
          </p>
        </div>
      </div>

      {/* Tab Switcher Mode Input */}
      <div className="flex border-b border-stone-200 gap-1 bg-stone-100/70 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab('excel')}
          className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'excel'
              ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-bold'
              : 'text-stone-500 hover:text-stone-800 hover:bg-white/50'
          }`}
        >
          <FileSpreadsheet size={15} className={activeTab === 'excel' ? 'text-amber-600' : 'text-stone-400'} />
          <span>Import POS Excel Recap</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('po')}
          className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'po'
              ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-bold'
              : 'text-stone-500 hover:text-stone-800 hover:bg-white/50'
          }`}
        >
          <FileText size={15} className={activeTab === 'po' ? 'text-amber-600' : 'text-stone-400'} />
          <span>Client Purchase Order</span>
        </button>
      </div>

      {/* RENDER MODULAR TAB COMPONENTS */}
      {activeTab === 'excel' ? <ImportExcelTab /> : <ClientPoTab />}
    </div>
  );
}
