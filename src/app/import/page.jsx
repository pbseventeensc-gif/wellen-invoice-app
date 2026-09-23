'use client';

import { useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import ImportExcelTab from '@/components/import/ImportExcelTab';
import ClientPoTab from '@/components/import/ClientPoTab';

export default function ImportExcelPage() {
  // Tab Mode: 'excel' (POS Recap) vs 'po' (Client Purchase Order PDF / Dynamic)
  const [activeTab, setActiveTab] = useState('excel');

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-16 pt-1">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Import & Document Ingestion</h1>
        <p className="text-xs text-stone-500 mt-0.5 font-normal">
          Generate invoices from POS Excel Recaps or Client Purchase Orders (PDF / Dynamic Line Items with M², EA, PCS).
        </p>
      </div>

      {/* Tab Switcher Mode Input (Tanpa Angka) */}
      <div className="flex border-b border-stone-200">
        <button
          type="button"
          onClick={() => setActiveTab('excel')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'excel'
              ? 'border-amber-500 text-amber-600 bg-amber-50/50'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <FileSpreadsheet size={15} />
          Import POS Excel Recap
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('po')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'po'
              ? 'border-amber-500 text-amber-600 bg-amber-50/50'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <FileText size={15} />
          Client Purchase Order
        </button>
      </div>

      {/* RENDER MODULAR TAB COMPONENTS */}
      {activeTab === 'excel' ? <ImportExcelTab /> : <ClientPoTab />}
    </div>
  );
}
