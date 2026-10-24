'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, Search, Trash2, Upload } from 'lucide-react';
import FeedbackDialog from '@/components/ui/FeedbackDialog';
import TablePagination from '@/components/ui/TablePagination';
import {
  calculateFakturBreakdown,
  formatRupiah,
  parseCurrencyNumber,
} from '@/utils/taxCalculator';

const STORAGE_KEY = 'wellen_wpp_staging';

function getCompositeKey(row) {
  return `${String(row.no_faktur || row.wpp_number || '').trim().toLowerCase()}__${String(row.client_name || '').trim().toLowerCase()}`;
}

function isProcessableRow(row) {
  const status = String(row.status || '').toLowerCase();
  return ['draft', 'ready', 'ready_to_process', 'rejected', ''].includes(status);
}

export default function MasterPosPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [mounted, setMounted] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const loadRows = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(stored)) {
        throw new Error('Master POS storage must contain a list of rows.');
      }
      const latestByKey = new Map();
      stored.filter(isProcessableRow).forEach((row) => {
        latestByKey.set(getCompositeKey(row), row);
      });
      const masterRows = Array.from(latestByKey.values());
      setRows(masterRows);
    } catch (error) {
      console.error('Failed to load Master POS data:', error);
      setRows([]);
    }
  };

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setMounted(true);
      loadRows();
    });
    window.addEventListener('storage', loadRows);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('storage', loadRows);
    };
  }, []);

  const persistRows = (nextRows) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRows));
    localStorage.setItem('wellen_imported_wpp', JSON.stringify(nextRows));
    setRows(nextRows);
    window.dispatchEvent(new Event('storage'));
  };

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      [
        row.no_faktur,
        row.wpp_number,
        row.client_name,
        row.store_name,
        row.item_description,
      ].some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [rows, search]);

  const draftRows = filteredRows.filter(isProcessableRow);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visiblePage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);
  const handleGrandTotalChange = (rowId, value) => {
    const grandTotal = parseCurrencyNumber(value);
    const breakdown = calculateFakturBreakdown(grandTotal);
    const nextRows = rows.map((row) =>
      row.id === rowId
        ? {
            ...row,
            raw_total: grandTotal,
            total_faktur: grandTotal,
            total_price: grandTotal,
            nilai_wpp: grandTotal,
            unit_price: grandTotal,
            dpp: breakdown.dpp,
            nilai_barang: breakdown.nilaiBarang,
            nilaiBarang: breakdown.nilaiBarang,
            jasa_cetak: breakdown.jasaCetak,
            jasaCetak: breakdown.jasaCetak,
            pph23: breakdown.pph23,
            wht: breakdown.wht,
            dpp_nilai_lain_barang: breakdown.dppNilaiLainBarang,
            dpp_nilai_lain_jasa_cetak: breakdown.dppNilaiLainJasaCetak,
            ppn: breakdown.ppn,
            updated_at: new Date().toISOString(),
          }
        : row
    );
    persistRows(nextRows);
  };

  const handleDelete = (row) => {
    setPendingDelete(row);
    setFeedback({
      variant: 'confirm',
      title: 'Delete this POS draft?',
      description: `${row.no_faktur || row.wpp_number} will be removed from Master POS.`,
      confirmLabel: 'Delete draft',
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const rowId = pendingDelete.id;
    setPendingDelete(null);
    setFeedback(null);
    const nextRows = rows.filter((item) => item.id !== rowId);
    persistRows(nextRows);
    setSelectedIds((current) => current.filter((id) => id !== rowId));
  };

  if (!mounted) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-5 pb-20">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-stone-200" />
        <div className="h-96 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-20">
      <div className="flex flex-col justify-between gap-4 border-b border-stone-200 pb-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={22} className="text-amber-600" />
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Master POS / Draft</h1>
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Imported POS data and tax breakdowns. Continue to Invoices to select Draft rows and create invoices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push('/import')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            <Upload size={16} />
            Import Excel
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-bold text-stone-800">POS Data Breakdown Results</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {rows.length} rows · {draftRows.length} Draft available
            </p>
          </div>
          <label className="relative block w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search WPP No or Store..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-400 focus:bg-white"
            />
          </label>
        </div>

        <div className="data-table-scroll">
          <table className="data-table w-full min-w-[1450px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-stone-100 text-[10px] font-bold uppercase tracking-wider text-stone-600">
              <tr>
                <th className="w-12 px-3 py-3 text-center">No</th>
                <th className="w-40 px-3 py-3">Invoice No / No WPP</th>
                <th className="w-56 px-3 py-3">Store Name (Item Description)</th>
                <th className="w-40 px-3 py-3 text-right">Grand Total</th>
                <th className="px-3 py-3 text-right">DPP</th>
                <th className="px-3 py-3 text-right">Nilai Barang</th>
                <th className="px-3 py-3 text-right">Jasa Cetak</th>
                <th className="px-3 py-3 text-right">WHT</th>
                <th className="px-3 py-3 text-right">DPP Nilai Lain Barang</th>
                <th className="px-3 py-3 text-right">DPP Nilai Lain Jasa Cetak</th>
                <th className="px-3 py-3 text-right">PPN</th>
                <th className="w-20 px-3 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-16 text-center text-sm text-stone-500">
                    No imported POS rows yet. Import an Excel recap to add Draft rows here.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, index) => {
                  const rowNumber = (visiblePage - 1) * pageSize + index + 1;
                  const isDraft = isProcessableRow(row);
                  return (
                    <tr
                      key={row.id || getCompositeKey(row)}
                      className="bg-white hover:bg-stone-50"
                    >
                      <td className="px-3 py-4 text-center text-stone-500">{rowNumber}</td>
                      <td className="px-3 py-4 font-mono font-bold text-stone-900">{row.no_faktur || row.wpp_number || '-'}</td>
                      <td className="px-3 py-4 font-medium text-stone-800">{row.store_name || row.item_description || '-'}</td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          aria-label={`Grand Total ${row.no_faktur || row.wpp_number}`}
                          disabled={!isDraft}
                          value={Number(row.total_faktur || row.total_price || row.nilai_wpp || 0)}
                          onChange={(event) => handleGrandTotalChange(row.id, event.target.value)}
                          className="w-36 rounded-lg border border-stone-300 bg-white px-2 py-2 text-right font-mono text-xs font-bold text-stone-900 outline-none focus:border-amber-500 disabled:bg-stone-100"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-stone-600">{formatRupiah(row.dpp)}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-stone-600">{formatRupiah(row.nilai_barang || row.nilaiBarang)}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-stone-600">{formatRupiah(row.jasa_cetak || row.jasaCetak)}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-right font-mono font-semibold text-rose-600">{formatRupiah(row.wht || row.pph23)}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-stone-600">{formatRupiah(row.dpp_nilai_lain_barang)}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-right font-mono text-stone-600">{formatRupiah(row.dpp_nilai_lain_jasa_cetak)}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-right font-mono font-bold text-stone-700">{formatRupiah(row.ppn)}</td>
                      <td className="px-3 py-4 text-center">
                        <button
                          type="button"
                          title="Delete Draft"
                          disabled={!isDraft}
                          onClick={() => handleDelete(row)}
                          className="rounded-lg p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filteredRows.length > 0 && (
          <TablePagination
            currentPage={visiblePage}
            pageSize={pageSize}
            totalItems={filteredRows.length}
            onPageChange={(page) => setCurrentPage(Math.min(page, totalPages))}
          />
        )}
      </section>
      <FeedbackDialog
        open={Boolean(feedback)}
        variant={feedback?.variant}
        title={feedback?.title}
        description={feedback?.description}
        confirmLabel={feedback?.confirmLabel}
        onConfirm={confirmDelete}
        onClose={() => {
          setFeedback(null);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
