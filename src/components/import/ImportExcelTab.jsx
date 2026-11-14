'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  ArrowRight,
  Trash2,
  Check,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { calculateFakturBreakdown, formatRupiah, parseCurrencyNumber } from '@/utils/taxCalculator';
import { displayName } from '@/utils/invoiceDisplay';
import { parsePosRows, planPosImport } from '@/utils/posImport';
import ExcelUploadCard from '@/components/import/ExcelUploadCard';
import FeedbackDialog from '@/components/ui/FeedbackDialog';
import { listInvoiceStaging, saveInvoiceStagingRows } from '@/utils/invoiceStaging';

export default function ImportExcelTab() {
  const router = useRouter();
  const [importedRows, setImportedRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [fileName, setFileName] = useState('');
  const [detectedClient, setDetectedClient] = useState('');
  const [detectedPromo, setDetectedPromo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showTaxDetails, setShowTaxDetails] = useState(false);
  const [isReading, setIsReading] = useState(false);

  const handleFileUpload = async (file) => {
    if (!file || isSaving || isReading) return;
    if (!/\.xlsx?$/i.test(file.name)) {
      setFeedback({ variant: 'error', title: 'Unsupported file format', description: 'Choose an Excel .xlsx or .xls file.' });
      return;
    }
    setIsReading(true);
    setImportedRows([]);
    setSelectedIds([]);
    setFileName(file.name);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const { rows: parsedData, client: commonClientName, promo: commonPromoName } = parsePosRows(rawJson);

      setSearchQuery('');
      setImportedRows(parsedData);
      setSelectedIds(parsedData.filter((r) => !r.isDuplicate).map((r) => r.id));
      setDetectedClient(commonClientName || 'PT ASPIRASI HIDUP INDONESIA TBK');
      setDetectedPromo(commonPromoName || 'PROMO ADHOC WEEKEND BOOM DEALS');
    } catch (err) {
      setImportedRows([]);
      setSelectedIds([]);
      setFileName('');
      setDetectedClient('');
      setDetectedPromo('');
      console.error('Failed to process Excel file:', err);
      setFeedback({
        variant: 'error',
        title: 'Excel file could not be read',
        description: err.message || 'Check the format of the selected Excel file.',
      });
    } finally {
      setIsReading(false);
    }
  };

  const handleToggleSelect = (id) => {
    const target = importedRows.find((r) => r.id === id);
    if (target?.isDuplicate) return;

    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const validRows = filteredRows.filter((r) => !r.isDuplicate);
    const allFilteredSelected = validRows.length > 0 && validRows.every((r) => selectedIds.includes(r.id));

    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !validRows.some((r) => r.id === id)));
    } else {
      const idsToAdd = validRows.map((r) => r.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
    }
  };

  const handleRemoveRow = (id) => {
    setImportedRows((prev) => prev.filter((r) => r.id !== id));
    setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
  };

  // Fungsi untuk mengedit nilai Grand Total & menghitung ulang rincian otomatis
  const handleGrandTotalChange = (id, newTotalVal) => {
    const rawNum = parseCurrencyNumber(newTotalVal);
    const breakdown = calculateFakturBreakdown(rawNum);

    setImportedRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        return {
          ...row,
          raw_total: rawNum,
          total_faktur: rawNum,
          total_price: rawNum,
          nilai_wpp: rawNum,
          unit_price: rawNum,
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
        };
      })
    );
  };

  const handleSaveToMasterPos = async () => {
    if (selectedIds.length === 0 || isSaving) {
      setFeedback({
        variant: 'error',
        title: 'No POS rows to save',
        description: 'Upload an Excel file with at least one valid POS row before continuing.',
      });
      return;
    }

    setIsSaving(true);
    const importedAt = new Date().toISOString();
    try {
      const storedStaging = await listInvoiceStaging();
      const { toSave: rowsToSave, skipped } = planPosImport(importedRows, selectedIds, storedStaging, importedAt);

      if (rowsToSave.length > 0) {
        await saveInvoiceStagingRows(rowsToSave);
      }

      // Kosongkan draft / form import setelah berhasil diimport
      setImportedRows([]);
      setSelectedIds([]);
      setFileName('');
      setDetectedClient('');
      setDetectedPromo('');
      setSearchQuery('');

      setFeedback({
        variant: 'success',
        title: rowsToSave.length ? 'POS import results' : 'No new drafts saved',
        description: `${rowsToSave.length} rows saved as Draft. ${skipped.length} rows skipped because they have already been processed or claimed.${skipped.length ? ` Details: ${skipped.map((row) => `${row.no_faktur || row.wpp_number} (${row.reason})`).join('; ')}.` : ''} Existing invoices keep their current status.`,
        confirmLabel: 'Open Invoices',
      });
    } catch (error) {
      console.error('Failed to save imported POS rows:', error);
      setFeedback({
        variant: 'error',
        title: 'POS data could not be saved',
        description: 'The import was not saved to shared drafts. Check your Supabase access and connection, then try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmImportAction = () => {
    if (feedback?.action !== 'cancel') return;
    setImportedRows([]);
    setSelectedIds([]);
    setFileName('');
    setDetectedClient('');
    setDetectedPromo('');
    setSearchQuery('');
    setFeedback(null);
  };

  const filteredRows = importedRows.filter((row) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const matchFaktur = row.no_faktur?.toLowerCase().includes(q);
    const matchStore = row.store_name?.toLowerCase().includes(q);
    return matchFaktur || matchStore;
  });

  const validFilteredRows = filteredRows.filter((r) => !r.isDuplicate);
  const isAllSelected = validFilteredRows.length > 0 && validFilteredRows.every((r) => selectedIds.includes(r.id));

  const selectedRowsList = importedRows.filter((r) => selectedIds.includes(r.id));
  const rowsToSum = selectedRowsList;
  const duplicateCountInPreview = importedRows.filter((row) => row.isDuplicate).length;

  const totalGrandTotal = rowsToSum.reduce((acc, r) => acc + (r.total_faktur || 0), 0);
  const totalDpp = rowsToSum.reduce((acc, r) => acc + (r.dpp || 0), 0);
  const totalNilaiBarang = rowsToSum.reduce((acc, r) => acc + (r.nilai_barang || 0), 0);
  const totalJasaCetak = rowsToSum.reduce((acc, r) => acc + (r.jasa_cetak || 0), 0);
  const totalWht = rowsToSum.reduce((acc, r) => acc + (r.pph23 || 0), 0);
  const totalDppNilaiLainBarang = rowsToSum.reduce((acc, r) => acc + (r.dpp_nilai_lain_barang || 0), 0);
  const totalDppNilaiLainJasaCetak = rowsToSum.reduce((acc, r) => acc + (r.dpp_nilai_lain_jasa_cetak || 0), 0);
  const totalPpn = rowsToSum.reduce((acc, r) => acc + (r.ppn || 0), 0);

  return (
    <div className="excel-import-workspace space-y-3" aria-busy={isSaving}>
      <div className="import-overview" data-ready={importedRows.length > 0}>
      <ExcelUploadCard
        fileName={fileName}
        rowCount={importedRows.length}
        isReading={isReading}
        disabled={isSaving}
        onFileSelect={handleFileUpload}
      />

      {/* Metadata Terdeteksi */}
      {importedRows.length > 0 && (
        <div className="import-metadata space-y-3">
          {duplicateCountInPreview > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-900">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle size={15} className="text-stone-600 shrink-0" />
                <span>Warning: {duplicateCountInPreview} duplicate rows found in this file.</span>
              </div>
              <span className="text-[11px] text-stone-600 font-medium">Duplicate rows are locked automatically</span>
            </div>
          )}

          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-xs flex items-center gap-3.5">
              <div className="min-w-0">
                <span className="text-[10px] font-normal text-stone-400 block">
                  Promo
                </span>
                <p className="text-xs font-normal text-stone-900 tracking-tight mt-0.5 break-words">
                  {displayName(detectedPromo) || '-'}
                </p>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-xs flex items-center gap-3.5">
              <div className="min-w-0">
                <span className="text-[10px] font-normal text-stone-400 block">
                  Client
                </span>
                <p className="text-xs font-normal text-stone-900 tracking-tight mt-0.5 break-words">
                  {displayName(detectedClient) || '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* Tabel Hasil Parsing Excel */}
      {importedRows.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-white flex flex-wrap items-center justify-between gap-3 text-xs border-b border-stone-200">
            <div className="flex items-center gap-2.5">
              <span className="font-medium text-stone-800 flex items-center gap-1.5 text-xs">
                POS Data Breakdown Results ({importedRows.length} rows)
              </span>
              <span className="text-[11px] text-stone-400">
                ({selectedIds.length} rows selected to save)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => setShowTaxDetails((visible) => !visible)}
                aria-expanded={showTaxDetails}
                aria-controls="pos-breakdown-results"
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
              >
                {showTaxDetails ? 'Hide tax details' : 'Show tax details'}
              </button>
              <button
                type="button"
                onClick={() => setFeedback({
                  variant: 'confirm',
                  title: 'Cancel this Excel import?',
                  description: 'The parsed rows and file selection will be cleared.',
                  confirmLabel: 'Clear import',
                  action: 'cancel',
                })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-medium transition cursor-pointer shrink-0"
                title="Cancel Import"
              >
                <Trash2 size={13} />
                <span>Cancel Import</span>
              </button>

              <div className="relative min-w-40 flex-1 md:w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Invoice No or Store..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-amber-500 focus:bg-white text-stone-800 placeholder:text-stone-400 transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveToMasterPos}
                disabled={selectedIds.length === 0 || isSaving}
                className={`inline-flex items-center gap-2 font-medium px-3.5 py-1.5 rounded-lg text-xs shadow-xs transition-colors shrink-0 ${
                selectedIds.length > 0 && !isSaving
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                <span>{isSaving ? 'Saving shared drafts...' : `Save & Open Invoices (${selectedIds.length})`}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
            <table id="pos-breakdown-results" className="pos-breakdown-table w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 font-medium text-[10px] tracking-normal shadow-xs">
                <tr>
                  <th className="py-3 px-3 text-center w-10 bg-slate-100">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors mx-auto ${
                        isAllSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white font-normal'
                          : 'border-slate-500 hover:border-emerald-500 bg-white'
                      }`}
                      aria-pressed={isAllSelected}
                      aria-label="Select all displayed rows"
                      title={isAllSelected ? 'Deselect all' : 'Select all valid stores'}
                    >
                      {isAllSelected && <Check size={10} strokeWidth={3} />}
                    </button>
                  </th>
                  <th className="py-3 px-3 text-center w-10 font-normal bg-slate-100 text-slate-600">No</th>
                  <th className="py-3 px-3 w-32 font-normal bg-slate-100 leading-tight">Invoice no.</th>
                  <th className="py-3 px-3 max-w-[200px] font-normal bg-slate-100 leading-tight">Store / item</th>
                  <th className="py-3 px-3 text-right w-32 font-normal bg-slate-100 leading-tight text-slate-700">Grand total</th>
                  <th hidden={!showTaxDetails} className="py-3 px-3 text-right font-normal bg-slate-100 whitespace-nowrap">DPP</th>
                  <th hidden={!showTaxDetails} className="py-3 px-3 text-right font-normal bg-slate-100 leading-tight">Goods value</th>
                  <th hidden={!showTaxDetails} className="py-3 px-3 text-right font-normal bg-slate-100 leading-tight">Printing service</th>
                  <th hidden={!showTaxDetails} className="py-3 px-3 text-right font-normal bg-slate-100 whitespace-nowrap text-slate-600">WHT</th>
                  <th hidden={!showTaxDetails} className="py-3 px-3 text-right font-normal bg-slate-100 leading-tight" title="Alternative tax base — goods">Alt. tax base<br/>Goods</th>
                  <th hidden={!showTaxDetails} className="py-3 px-3 text-right font-normal bg-slate-100 leading-tight" title="Alternative tax base — printing service">Alt. tax base<br/>Printing</th>
                  <th className="py-3 px-3 text-right font-normal bg-slate-100 whitespace-nowrap text-slate-700">VAT</th>
                  <th className="py-3 px-3 text-center w-10 font-normal bg-slate-100 text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-normal">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={showTaxDetails ? 13 : 7} className="py-8 text-center text-stone-400 text-xs">
                      No store data matching the keyword &quot;{searchQuery}&quot;
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const isSelected = selectedIds.includes(row.id);
                    const isDup = row.isDuplicate;

                    return (
                      <tr
                        key={row.id}
                        className={`transition-colors ${
                          isDup
                            ? 'bg-rose-50 text-rose-950 font-medium'
                            : isSelected
                            ? 'bg-slate-50'
                            : 'hover:bg-stone-50/40'
                        }`}
                      >
                        <td className="py-3 px-3 text-center w-10">
                          <button
                            type="button"
                            disabled={isDup}
                            aria-pressed={isSelected}
                            aria-label={`Select ${row.no_faktur}`}
                            onClick={() => handleToggleSelect(row.id)}
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all mx-auto ${
                              isDup
                                ? 'bg-rose-200 border-rose-300 cursor-not-allowed text-transparent'
                                : isSelected
                                ? 'bg-[#6c857b] border-[#6c857b] text-white font-normal shadow-xs'
                                : 'border-stone-300 hover:border-amber-500 bg-white'
                            }`}
                          >
                            {isSelected && !isDup && <Check size={10} strokeWidth={3} />}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center text-stone-500 font-normal w-10">
                          {idx + 1}
                        </td>
                        <td className={`py-3 px-3 font-mono font-normal whitespace-nowrap ${isDup ? 'text-rose-900' : 'text-stone-900'}`}>
                          {row.no_faktur}
                          {isDup && (
                            <span className="block text-[9px] font-normal text-stone-600 tracking-wider">
                              {row.duplicateReason}
                            </span>
                          )}
                        </td>
                        <td className={`py-3 px-3 font-medium tracking-tight max-w-[200px] break-words leading-tight ${isDup ? 'text-rose-900' : 'text-stone-900'}`}>
                          {displayName(row.store_name)}
                        </td>

                        {/* Kolom Grand Total: HANYA bagian ini yang bisa diedit */}
                        <td className="py-2 px-2 text-right whitespace-nowrap">
                          <input
                            type="number"
                            disabled={isDup}
                            value={row.total_faktur === 0 ? '' : row.total_faktur}
                            onChange={(e) => handleGrandTotalChange(row.id, e.target.value)}
                            placeholder="0"
                            className={`w-28 text-right font-mono font-normal text-xs px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 ${
                              isDup ? 'opacity-60 bg-stone-100 cursor-not-allowed text-rose-900' : 'text-stone-900'
                            }`}
                          />
                        </td>

                        <td hidden={!showTaxDetails} className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap">
                          {formatRupiah(row.dpp)}
                        </td>
                        <td hidden={!showTaxDetails} className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap">
                          {formatRupiah(row.nilai_barang)}
                        </td>
                        <td hidden={!showTaxDetails} className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap">
                          {formatRupiah(row.jasa_cetak)}
                        </td>
                        <td hidden={!showTaxDetails} className="py-3 px-3 text-right font-mono text-stone-600 font-medium whitespace-nowrap">
                          {formatRupiah(row.pph23)}
                        </td>
                        <td hidden={!showTaxDetails} className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap">
                          {formatRupiah(row.dpp_nilai_lain_barang)}
                        </td>
                        <td hidden={!showTaxDetails} className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap">
                          {formatRupiah(row.dpp_nilai_lain_jasa_cetak)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-stone-700 font-normal whitespace-nowrap">
                          {formatRupiah(row.ppn)}
                        </td>
                        <td className="py-3 px-3 text-center w-16">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="p-1 text-stone-400 hover:text-red-500 rounded transition-colors inline-flex items-center cursor-pointer"
                            title="Delete Row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {filteredRows.length > 0 && (
                <tfoot className="sticky bottom-0 z-10 bg-stone-100 border-t-2 border-stone-200 text-stone-900 font-normal text-xs shadow-xs">
                  <tr>
                    <td colSpan={4} className="py-3 px-3 text-right tracking-normal text-[11px] font-medium text-stone-700">
                      Total ({rowsToSum.length} stores):
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium whitespace-nowrap text-stone-900">
                      {formatRupiah(totalGrandTotal)}
                    </td>
                    <td hidden={!showTaxDetails} className="py-3 px-3 text-right font-mono font-normal whitespace-nowrap text-stone-800">
                      {formatRupiah(totalDpp)}
                    </td>
                    <td hidden={!showTaxDetails} className="py-3 px-3 text-right font-mono font-normal whitespace-nowrap text-stone-800">
                      {formatRupiah(totalNilaiBarang)}
                    </td>
                    <td hidden={!showTaxDetails} className="py-3 px-3 text-right font-mono font-normal whitespace-nowrap text-stone-800">
                      {formatRupiah(totalJasaCetak)}
                    </td>
                    <td hidden={!showTaxDetails} className="py-3 px-3 text-right font-mono font-normal whitespace-nowrap text-stone-600">
                      {formatRupiah(totalWht)}
                    </td>
                    <td hidden={!showTaxDetails} className="py-3 px-3 text-right font-mono font-normal whitespace-nowrap text-stone-800">
                      {formatRupiah(totalDppNilaiLainBarang)}
                    </td>
                    <td hidden={!showTaxDetails} className="py-3 px-3 text-right font-mono font-normal whitespace-nowrap text-stone-800">
                      {formatRupiah(totalDppNilaiLainJasaCetak)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-normal whitespace-nowrap text-stone-700">
                      {formatRupiah(totalPpn)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
      <FeedbackDialog
        open={Boolean(feedback)}
        variant={feedback?.variant}
        title={feedback?.title}
        description={feedback?.description}
        confirmLabel={feedback?.confirmLabel}
        onConfirm={confirmImportAction}
        onAction={() => {
          if (feedback?.variant === 'success') {
            router.push('/invoices');
          } else {
            setFeedback(null);
          }
        }}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}
