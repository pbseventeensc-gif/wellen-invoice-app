'use client';

import PageHeading from '@/components/ui/PageHeading';

import { useState } from 'react';
import ImportExcelTab from '@/components/import/ImportExcelTab';
import ClientPoTab from '@/components/import/ClientPoTab';

export default function ImportExcelPage() {
  const [activeTab, setActiveTab] = useState('excel');

  return (
    <div className="max-w-[1500px] mx-auto space-y-4 pb-6 pt-1">
      <header className="border-b border-slate-200 pb-4">
        <PageHeading title="Import Data" />
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Upload a POS recap or purchase order. New data is saved as Draft for review before submission.
        </p>
      </header>

      {/* Tab Switcher Mode Input */}
      <div className="flex border-b border-stone-200 gap-1 bg-stone-100/70 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab('excel')}
          className={`flex items-center gap-2 px-5 py-2 text-xs font-normal rounded-lg transition-all cursor-pointer ${
            activeTab === 'excel'
              ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-normal'
              : 'text-stone-500 hover:text-stone-800 hover:bg-white/50'
          }`}
        >
          <span>Import POS Excel Recap</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('po')}
          className={`flex items-center gap-2 px-5 py-2 text-xs font-normal rounded-lg transition-all cursor-pointer ${
            activeTab === 'po'
              ? 'bg-white text-stone-900 shadow-xs border border-stone-200/80 font-normal'
              : 'text-stone-500 hover:text-stone-800 hover:bg-white/50'
          }`}
        >
          <span>Client Purchase Order</span>
        </button>
      </div>

      {/* RENDER MODULAR TAB COMPONENTS */}
      {activeTab === 'excel' ? <ImportExcelTab /> : <ClientPoTab />}
    </div>
  );
}
