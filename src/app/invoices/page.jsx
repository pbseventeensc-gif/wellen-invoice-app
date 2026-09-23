'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  AlertTriangle, 
  Clock, 
  XCircle, 
  Edit3, 
  FilePlus, 
  Trash2, 
  Search, 
  FileSpreadsheet,
  ArrowUpDown,
  Check,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  RotateCcw,
  Filter,
  ChevronsUpDown,
  ShieldCheck
} from 'lucide-react';
import { formatRupiah } from '@/utils/taxCalculator';

export default function InvoiceListPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState([]);

  // Pagination State (Default 10 per halaman)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // State untuk tooltip alasan tolak
  const [activeReasonId, setActiveReasonId] = useState(null);

  // State untuk Sorting
  const [sortField, setSortField] = useState('import_date');
  const [sortDirection, setSortDirection] = useState('desc');

  // Generator Data Mock 120 Item untuk Simulasi Skala Ratusan Data
  const generate120MockItems = () => {
    const now = new Date();
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const todayStr = now.toISOString();

    const mockList = [];
    let counter = 1000;

    // 1. 95 Item Ready to Process
    for (let i = 0; i < 95; i++) {
      counter++;
      mockList.push({
        id: `imp-${counter}`,
        wpp_number: `WPP-2026-${counter}`,
        no_faktur: `WPP-2026-${counter}`,
        client_name: i % 3 === 0 ? 'PT ASPIRASI HIDUP INDONESIA TBK' : i % 3 === 1 ? 'PT. PMG INTEGRASI KOMUNIKASI' : 'PT DIGITAL CREATIVE ASIA',
        item_description: `PRINT BANNER & POS MATERIAL BATCH #${i + 1}`,
        total_price: 150000 + (i * 12500),
        import_date: todayStr,
        status: 'ready',
        isDuplicate: false,
      });
    }

    // 2. 13 Item Waiting Approval (Normal SLA < 3 Hari)
    for (let i = 0; i < 13; i++) {
      counter++;
      mockList.push({
        id: `imp-${counter}`,
        wpp_number: `WPP-2026-${counter}`,
        no_faktur: `WPP-2026-${counter}`,
        client_name: 'PT FOODS BEVERAGES INDONESIA',
        item_description: `STICKER VINYL & ACRYLIC DISPLAY #${i + 1}`,
        total_price: 280000 + (i * 15000),
        import_date: oneDayAgo,
        status: 'waiting',
        isDuplicate: false,
      });
    }

    // 3. 2 Item Waiting Approval (SLA Overdue >= 3 Hari)
    for (let i = 0; i < 2; i++) {
      counter++;
      mockList.push({
        id: `imp-${counter}`,
        wpp_number: `WPP-2026-${counter}`,
        no_faktur: `WPP-2026-${counter}`,
        client_name: 'PT ASPIRASI HIDUP INDONESIA TBK',
        item_description: `URGENT EVENT PROMO BACKDROP #${i + 1}`,
        total_price: 1200000 + (i * 50000),
        import_date: fourDaysAgo,
        status: 'waiting',
        isDuplicate: false,
      });
    }

    // 4. 10 Item Rejected
    for (let i = 0; i < 10; i++) {
      counter++;
      mockList.push({
        id: `imp-${counter}`,
        wpp_number: `WPP-2026-${counter}`,
        no_faktur: `WPP-2026-${counter}`,
        client_name: 'PT GLOBAL MARKETING SOLUTION',
        item_description: `POSTER BOARD GLOSSY A1 #${i + 1}`,
        total_price: 450000 + (i * 20000),
        import_date: oneDayAgo,
        status: 'rejected',
        reject_reason: i % 2 === 0 ? 'salah quantity' : 'harga unit tidak sesuai PO',
        isDuplicate: false,
      });
    }

    return mockList;
  };

  const loadData = () => {
    try {
      const approvedInvoices = JSON.parse(localStorage.getItem('wellen_invoices') || '[]');
      const approvedItemIdsSet = new Set();
      
      approvedInvoices.forEach((inv) => {
        inv.items?.forEach((it) => {
          if (it.id) approvedItemIdsSet.add(it.id);
        });
      });

      let rawStaging = JSON.parse(
        localStorage.getItem('wellen_wpp_staging') ||
        localStorage.getItem('wellen_imported_wpp') ||
        '[]'
      );

      // Jika kosong atau baru pertama kali dibuka, buatkan 120 data mock
      if (rawStaging.length === 0 && localStorage.getItem('wellen_wpp_staging') === null) {
        rawStaging = generate120MockItems();
        localStorage.setItem('wellen_wpp_staging', JSON.stringify(rawStaging));
      }

      const activePendingItems = rawStaging.filter((it) => {
        return it.status !== 'invoiced' && !approvedItemIdsSet.has(it.id);
      });

      setItems(activePendingItems);
    } catch (e) {
      console.error('Gagal membaca data invoice list:', e);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const getDaysDifference = (importedAtStr) => {
    if (!importedAtStr) return 0;
    const importedTime = new Date(importedAtStr).getTime();
    const now = new Date().getTime();
    return Math.floor((now - importedTime) / (1000 * 60 * 60 * 24));
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter Data Berdasarkan Search & Status Filter
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const dateStr = it.import_date || it.imported_at || it.waktu_import;
      const daysOld = getDaysDifference(dateStr);

      if (daysOld > 6) return false;

      const term = searchTerm.toLowerCase();
      const matchSearch =
        (it.wpp_number || it.no_faktur || '').toLowerCase().includes(term) ||
        (it.client_name || '').toLowerCase().includes(term) ||
        (it.item_description || it.store_name || '').toLowerCase().includes(term);

      const normalizedStatus = (it.status === 'draft' || it.status === 'ready' || !it.status) ? 'ready' : it.status;
      const isWaiting = normalizedStatus === 'waiting' || normalizedStatus === 'waiting_approval';
      const isSlaBreached = isWaiting && daysOld >= 3;

      let matchStatus = false;
      if (statusFilter === 'ALL') matchStatus = true;
      else if (statusFilter === 'ready') matchStatus = normalizedStatus === 'ready';
      else if (statusFilter === 'waiting') matchStatus = isWaiting;
      else if (statusFilter === 'rejected') matchStatus = normalizedStatus === 'rejected';
      else if (statusFilter === 'sla_overdue') matchStatus = isSlaBreached;

      return matchSearch && matchStatus;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'import_date') {
        valA = a.import_date || a.imported_at || a.waktu_import || '';
        valB = b.import_date || b.imported_at || b.waktu_import || '';
      } else if (sortField === 'total_price') {
        valA = Number(a.total_price || a.nilai_wpp || 0);
        valB = Number(b.total_price || b.nilai_wpp || 0);
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, searchTerm, statusFilter, sortField, sortDirection]);

  // Hitung jumlah untuk Counter Badges
  const statusCounts = useMemo(() => {
    let ready = 0, waiting = 0, rejected = 0, slaBreached = 0;
    items.forEach((it) => {
      const dateStr = it.import_date || it.imported_at || it.waktu_import;
      const daysOld = getDaysDifference(dateStr);
      const isWaiting = it.status === 'waiting' || it.status === 'waiting_approval';
      const isRejected = it.status === 'rejected';

      if (isWaiting && daysOld >= 3) slaBreached += 1;
      if (isRejected) rejected += 1;
      else if (isWaiting) waiting += 1;
      else ready += 1;
    });
    return { all: items.length, ready, waiting, rejected, slaBreached };
  }, [items]);

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Bulk Delete Selected (Dapat menghapus SEMUA status termasuk Waiting Approval)
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.length} selected items?`)) {
      const nextItems = items.filter((it) => !selectedIds.includes(it.id));
      setItems(nextItems);
      setSelectedIds([]);
      localStorage.setItem('wellen_wpp_staging', JSON.stringify(nextItems));
      localStorage.setItem('wellen_imported_wpp', JSON.stringify(nextItems));
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Centang / Hapus Centang Semua Baris di Halaman Aktif (Tanpa Pembatasan Status)
  const handleToggleSelectAll = () => {
    const allPaginatedSelected = paginatedItems.length > 0 && paginatedItems.every((r) => selectedIds.includes(r.id));

    if (allPaginatedSelected) {
      setSelectedIds((prev) => prev.filter((id) => !paginatedItems.some((r) => r.id === id)));
    } else {
      const idsToAdd = paginatedItems.map((r) => r.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
    }
  };

  const handleProceedSelected = () => {
    const selectedRows = items.filter((r) => selectedIds.includes(r.id));
    const processableRows = selectedRows.filter((r) => r.status !== 'waiting' && r.status !== 'waiting_approval');

    if (processableRows.length === 0) {
      alert('Selected items are currently in review (Waiting Approval). Only items that are Ready to Invoice or Rejected can be processed into a new invoice draft.');
      return;
    }

    const stagedItems = processableRows.map((item) => ({
      id: item.id,
      wpp_number: item.wpp_number || item.no_faktur,
      no_faktur: item.no_faktur || item.wpp_number,
      item_description: item.item_description || item.store_name,
      store_name: item.store_name || item.item_description,
      total_price: item.total_price || item.nilai_wpp,
      unit_price: item.unit_price || item.total_price || item.nilai_wpp,
      qty: item.qty || 1,
      client_name: item.client_name,
      promo_name: item.promo_name || item.item_description,
    }));

    const isPo = processableRows.some((item) => Boolean(item.uom && item.uom !== 'PCS') || item.isPoSource);
    sessionStorage.setItem('wellen_import_source', isPo ? 'po' : 'excel');
    sessionStorage.setItem('wellen_staged_items', JSON.stringify(stagedItems));
    router.push('/create-invoice');
  };

  const handleDelete = (id) => {
    if (confirm('Delete this item from the invoice list?')) {
      const nextItems = items.filter((it) => it.id !== id);
      setItems(nextItems);
      setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
      localStorage.setItem('wellen_wpp_staging', JSON.stringify(nextItems));
      localStorage.setItem('wellen_imported_wpp', JSON.stringify(nextItems));
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleProceedToCreate = (item) => {
    const isPo = Boolean(item.uom && item.uom !== 'PCS') || item.isPoSource === true;
    const stagedItem = [
      {
        id: item.id,
        wpp_number: item.wpp_number || item.no_faktur,
        no_faktur: item.no_faktur || item.wpp_number,
        item_description: item.item_description || item.store_name,
        store_name: item.store_name || item.item_description,
        total_price: item.total_price || item.nilai_wpp,
        unit_price: item.unit_price || item.total_price || item.nilai_wpp,
        qty: item.qty || 1,
        uom: item.uom || 'PCS',
        client_name: item.client_name,
        promo_name: item.promo_name || item.item_description,
      },
    ];

    sessionStorage.setItem('wellen_import_source', isPo ? 'po' : 'excel');
    sessionStorage.setItem('wellen_staged_items', JSON.stringify(stagedItem));
    router.push('/create-invoice');
  };

  const isAllSelected = paginatedItems.length > 0 && paginatedItems.every((r) => selectedIds.includes(r.id));

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Invoice List & Staged Queue</h1>
          <p className="text-xs text-stone-500 mt-1">
            List of imported WPP data pending final invoice generation, approval status, and SLA tracking.
          </p>
        </div>
      </div>

      {/* Bar Notifikasi Info Aturan - Simpel & Elegan (Warna Netral Corporate) */}
      <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3.5 px-4 flex items-start gap-3 text-xs text-stone-700">
        <ShieldCheck size={18} className="text-stone-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-[11px] leading-relaxed">
          <p className="font-semibold text-stone-900 text-xs">SLA Rules & Retention Policy:</p>
          <p className="text-stone-500">
            • <span className="text-stone-800 font-medium">Waiting Approval</span> status exceeding <strong className="text-stone-900">3 days</strong> triggers SLA Overdue warning.
            <br />
            • Filter and process large datasets easily with page size options (10 / 25 / 50 data per page) and bulk checkboxes.
          </p>
        </div>
      </div>

      {/* Bulk Action Bar saat Dicentang Banyak [✓] - Minimalis Corporate (Desain Elegan) */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3 px-4 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-3 border border-slate-800 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-mono text-xs font-medium">
              ✓
            </div>
            <div>
              <p className="text-xs font-semibold text-white">
                {selectedIds.length} Data Terpilih
              </p>
              <p className="text-[10px] text-slate-400 font-normal">
                Pilih tindakan massal yang ingin dilakukan pada item yang dicentang.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleProceedSelected}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-950 font-semibold px-3.5 py-1.5 rounded-xl text-xs shadow-2xs transition cursor-pointer"
            >
              <FilePlus size={14} />
              Process Selected ({selectedIds.length})
            </button>

            <button
              type="button"
              onClick={handleDeleteSelected}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-rose-950/80 text-rose-300 border border-rose-900/50 hover:border-rose-700 font-normal px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer"
            >
              <Trash2 size={14} />
              Delete Selected ({selectedIds.length})
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Deselect All / Batal Pilihan"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Filter Toolbar (Simpel, Tanpa Warna Rame) */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs flex flex-wrap gap-3 items-center justify-between">
        {/* Search Field */}
        <div className="relative flex-1 min-w-[280px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search WPP No., Client PT, or Description..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full text-xs pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-400 text-stone-900 placeholder:text-stone-400 font-normal"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter Dropdown Pill */}
          <div className="relative inline-flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-700 font-normal hover:bg-stone-100 transition cursor-pointer">
            <Filter size={14} className="text-stone-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent focus:outline-none text-xs font-normal text-stone-700 cursor-pointer pr-4 appearance-none"
            >
              <option value="ALL">Semua Status ({statusCounts.all})</option>
              <option value="ready">Ready to Process ({statusCounts.ready})</option>
              <option value="waiting">Waiting Review ({statusCounts.waiting})</option>
              <option value="rejected">Rejected ({statusCounts.rejected})</option>
              <option value="sla_overdue">SLA Overdue ({statusCounts.slaBreached})</option>
            </select>
            <ChevronsUpDown size={13} className="text-stone-400 shrink-0 pointer-events-none absolute right-2.5" />
          </div>

          {/* Per Page Dropdown Pill */}
          <div className="relative inline-flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-700 font-normal hover:bg-stone-100 transition cursor-pointer">
            <span className="text-stone-400 text-[11px]">Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-transparent focus:outline-none text-xs font-normal text-stone-700 cursor-pointer pr-4 appearance-none"
            >
              <option value={10}>10 per hal</option>
              <option value={25}>25 per hal</option>
              <option value={50}>50 per hal</option>
            </select>
            <ChevronsUpDown size={13} className="text-stone-400 shrink-0 pointer-events-none absolute right-2.5" />
          </div>
        </div>
      </div>

      {/* Tabel Data Invoices List dengan Sticky Header & Scrollable Body */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-stone-100/95 backdrop-blur-xs text-stone-600 uppercase font-semibold text-[10px] border-b border-stone-200 tracking-wider shadow-2xs">
              <tr>
                <th className="py-3.5 px-3 text-center w-12 bg-stone-100/95">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors mx-auto cursor-pointer ${
                      isAllSelected
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'border-stone-300 hover:border-stone-400 bg-white'
                    }`}
                    title={isAllSelected ? 'Deselect all' : 'Select all rows on this page'}
                  >
                    {isAllSelected && <Check size={10} strokeWidth={3} />}
                  </button>
                </th>

                <th className="py-3.5 px-3 text-center w-12 font-semibold bg-stone-100/95">NO</th>
                
                <th 
                  onClick={() => handleSort('import_date')}
                  className="py-3.5 px-4 text-center w-36 font-semibold bg-stone-100/95 cursor-pointer hover:text-stone-950 transition-colors select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>IMPORT TIME</span>
                    <ArrowUpDown size={12} className="text-stone-400" />
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('wpp_number')}
                  className="py-3.5 px-4 w-36 font-semibold bg-stone-100/95 cursor-pointer hover:text-stone-950 transition-colors select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>WPP NO</span>
                    <ArrowUpDown size={12} className="text-stone-400" />
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('client_name')}
                  className="py-3.5 px-4 font-semibold bg-stone-100/95 cursor-pointer hover:text-stone-950 transition-colors select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>CLIENT & DESCRIPTION</span>
                    <ArrowUpDown size={12} className="text-stone-400" />
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('total_price')}
                  className="py-3.5 px-4 text-right w-36 font-semibold bg-stone-100/95 cursor-pointer hover:text-stone-950 transition-colors select-none"
                >
                  <div className="inline-flex items-center justify-end gap-1">
                    <span>WPP VALUE</span>
                    <ArrowUpDown size={12} className="text-stone-400" />
                  </div>
                </th>

                <th className="py-3.5 px-4 text-center w-40 font-semibold bg-stone-100/95">STATUS</th>
                <th className="py-3.5 px-4 text-center w-40 font-semibold bg-stone-100/95">ALERT / RETENTION</th>
                <th className="py-3.5 px-4 text-center w-32 font-semibold bg-stone-100/95">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-normal">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-stone-400 font-normal">
                    No active WPP data in this queue.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((row, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const dateStr = row.import_date || row.imported_at || row.waktu_import;
                  const daysOld = getDaysDifference(dateStr);
                  const isWaiting = row.status === 'waiting' || row.status === 'waiting_approval';
                  const isSlaBreached = isWaiting && daysOld >= 3;
                  const isDuplicate = row.isDuplicate === true;
                  const isRejected = row.status === 'rejected';
                  const isReady = row.status === 'ready' || row.status === 'draft' || !row.status;
                  const isSelected = selectedIds.includes(row.id);
                  const isReasonOpen = activeReasonId === row.id;

                  return (
                    <tr 
                      key={row.id || idx} 
                      className={`transition-colors font-normal relative ${
                        isDuplicate 
                          ? 'bg-rose-50/70 border-l-4 border-l-rose-500'
                          : isSelected
                          ? 'bg-slate-100/80'
                          : 'hover:bg-stone-50/80'
                      }`}
                    >
                      {/* Checkbox Selalu Aktif Terbuka Untuk Semua Status */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(row.id)}
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all mx-auto cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                              : 'border-stone-300 hover:border-stone-400 bg-white'
                          }`}
                        >
                          {isSelected && <Check size={10} strokeWidth={3} />}
                        </button>
                      </td>

                      <td className="py-3.5 px-3 text-center text-stone-400 font-mono">{globalIdx}</td>
                      
                      <td className="py-3.5 px-4 text-center text-stone-600 font-mono text-[11px] whitespace-nowrap">
                        {dateStr ? dateStr.slice(0, 10) : '-'}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-stone-900 whitespace-nowrap font-normal">
                        {row.wpp_number || row.no_faktur}
                        {isDuplicate && (
                          <span className="block text-[9px] text-rose-600 tracking-wider font-medium">
                            DUPLICATE WPP!
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-sm">
                        <p className="text-stone-900 truncate font-normal">{row.client_name}</p>
                        <p className="text-[11px] text-stone-500 truncate mt-0.5">{row.item_description || row.store_name}</p>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-stone-900 font-normal whitespace-nowrap">
                        {formatRupiah(row.total_price || row.nilai_wpp)}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap relative">
                        {isReady && (
                          <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-700 text-[10px] px-2.5 py-0.5 rounded-full border border-stone-200 font-normal">
                            Ready to Invoice
                          </span>
                        )}
                        {isWaiting && (
                          <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-700 text-[10px] px-2.5 py-0.5 rounded-full border border-stone-300 font-normal">
                            <Clock size={11} className="text-stone-400" /> Waiting Approval
                          </span>
                        )}
                        {isRejected && (
                          <div className="inline-flex items-center justify-center gap-1.5 relative">
                            <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-800 text-[10px] px-2.5 py-0.5 rounded-full border border-stone-300 font-normal">
                              <XCircle size={11} className="text-stone-500" /> Rejected
                            </span>

                            {row.reject_reason && (
                              <div className="relative inline-block">
                                <button
                                  type="button"
                                  onClick={() => setActiveReasonId(isReasonOpen ? null : row.id)}
                                  className="w-5 h-5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-300 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Click to view rejection reason"
                                >
                                  <Info size={11} />
                                </button>

                                {/* Popover Tooltip */}
                                {isReasonOpen && (
                                  <div className="absolute right-0 bottom-full mb-2 z-30 w-52 p-3 bg-slate-900 text-white rounded-2xl shadow-xl text-left normal-case tracking-normal space-y-1 animate-in fade-in zoom-in-95 duration-150 border border-slate-800">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">Rejection Reason</span>
                                      <button 
                                        onClick={() => setActiveReasonId(null)}
                                        className="text-slate-400 hover:text-white text-xs cursor-pointer"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                    <p className="text-[11px] text-slate-200 leading-snug font-normal">
                                      {row.reject_reason}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Alert / Retention Column dengan Badge Uniform */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isSlaBreached ? (
                          <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-800 border border-stone-300 text-[10px] px-2.5 py-1 rounded-full font-normal">
                            <AlertTriangle size={11} className="text-stone-500" /> Overdue (+{daysOld}d)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-700 border border-stone-200 text-[10px] px-2.5 py-1 rounded-full font-normal">
                            <Clock size={11} className="text-stone-400" /> {Math.max(0, 7 - daysOld)}d Retention
                          </span>
                        )}
                      </td>

                      {/* Action Column Konsisten */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {isRejected ? (
                            <button
                              type="button"
                              onClick={() => handleProceedToCreate(row)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-xl text-[10px] shadow-2xs transition-colors cursor-pointer"
                              title="Edit and Resubmit"
                            >
                              <Edit3 size={12} />
                              Edit
                            </button>
                          ) : isReady ? (
                            <button
                              type="button"
                              onClick={() => handleProceedToCreate(row)}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-xl text-[10px] shadow-2xs transition-colors cursor-pointer"
                              title="Create New Invoice"
                            >
                              <FilePlus size={12} />
                              Process
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center gap-1 px-3 py-1 bg-stone-100 text-stone-400 rounded-xl text-[10px] font-normal cursor-not-allowed"
                              title="Under Review in Approval Queue"
                            >
                              <Clock size={12} />
                              In Review
                            </button>
                          )}

                          {/* Tombol Hapus Selalu Aktif untuk Seluruh Row */}
                          <button
                            type="button"
                            onClick={() => handleDelete(row.id)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
                            title="Delete Item"
                          >
                            <Trash2 size={13} />
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

        {/* Pagination Bar */}
        <div className="p-4 bg-stone-50/80 border-t border-stone-200/80 rounded-b-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-600">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-stone-500 font-medium">
              Halaman <strong className="font-mono text-stone-900 font-normal">{currentPage}</strong> dari{' '}
              <strong className="font-mono text-stone-900 font-normal">{totalPages}</strong>{' '}
              <span className="text-stone-400 font-mono">({filteredItems.length} total data)</span>
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
                            ? 'bg-amber-500 text-stone-950 shadow-2xs'
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
      </div>
    </div>
  );
}