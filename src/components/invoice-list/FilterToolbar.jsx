'use client';

import { Search, Calendar, FileSpreadsheet } from 'lucide-react';

export default function FilterToolbar({
  searchQuery,
  onSearchChange,
  filterPt,
  onPtChange,
  ptOptions,
  dateStart,
  onDateStartChange,
  dateEnd,
  onDateEndChange,
  onExportExcel,
}) {
  return (
    <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search No Invoice */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Cari No. Invoice..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="text-xs pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 w-44"
          />
        </div>

        {/* Filter Nama PT */}
        <select
          value={filterPt}
          onChange={(e) => onPtChange(e.target.value)}
          className="text-xs py-2 px-3 bg-stone-50 border border-stone-300 rounded-lg text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <option value="">Semua Nama PT</option>
          {ptOptions.map((pt) => (
            <option key={pt} value={pt}>
              {pt}
            </option>
          ))}
        </select>

        {/* Filter Rentang Tanggal */}
        <div className="flex items-center gap-1.5 text-xs text-stone-500 bg-stone-50 border border-stone-300 px-3 py-1.5 rounded-lg">
          <Calendar size={14} className="text-stone-400" />
          <input
            type="date"
            value={dateStart}
            onChange={(e) => onDateStartChange(e.target.value)}
            className="bg-transparent text-stone-700 focus:outline-none"
          />
          <span>–</span>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => onDateEndChange(e.target.value)}
            className="bg-transparent text-stone-700 focus:outline-none"
          />
        </div>
      </div>

      {/* Tombol Download Report Excel */}
      <button
        onClick={onExportExcel}
        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-sm"
      >
        <FileSpreadsheet size={16} />
        Report by Excel
      </button>
    </div>
  );
}