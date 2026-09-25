'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  CheckCircle2,
  ArrowRight,
  Trash2,
  Check,
  AlertTriangle,
  Search
} from 'lucide-react';
import { calculateFakturBreakdown, formatRupiah, parseCurrencyNumber } from '@/utils/taxCalculator';

export default function ImportExcelTab() {
  const router = useRouter();
  const [importedRows, setImportedRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [fileName, setFileName] = useState('');
  const [detectedClient, setDetectedClient] = useState('');
  const [detectedPromo, setDetectedPromo] = useState('');
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Handler Unggah & Parse File Excel
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        let commonPromoName = '';
        let commonClientName = '';
        let dupCounter = 0;

        // Ambil data penyimpanan dari localStorage untuk proteksi duplikasi mutlak
        const existingApproved = JSON.parse(localStorage.getItem('wellen_invoices') || '[]');
        const existingQueue = JSON.parse(localStorage.getItem('wellen_approval_queue') || '[]');
        const existingStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');

        const currentTimestamp = new Date().toISOString();

        const parsedData = rawJson
          .filter((row) => Object.values(row).join('').trim().length > 0)
          .map((row, index) => {
            const clean = {};
            Object.keys(row).forEach((k) => {
              clean[k.trim().toLowerCase()] = row[k];
            });

            // 1. Ambil No Faktur / WPP
            const noFaktur = String(
              clean['no faktur'] || clean['faktur'] || clean['no wpp'] || clean['wpp'] || clean['nomor faktur'] || `WPP-${Date.now()}-${index}`
            ).trim();

            // 2. Ambil Customer / Klien
            const customer = clean['customer ant'] || clean['customer'] || clean['klien'] || clean['nama pt'] || clean['pt'] || '';
            if (customer && !commonClientName) {
              commonClientName = customer.trim();
            }

            // 3. Pecah Keterangan menjadi Promo & Store Name
            const rawKeterangan = String(clean['keterangan'] || clean['deskripsi'] || clean['item description'] || '').trim();
            let fileNamePromo = rawKeterangan;
            let storeName = rawKeterangan;

            if (rawKeterangan.includes(' - ')) {
              const parts = rawKeterangan.split(' - ');
              fileNamePromo = parts[0].trim();
              storeName = parts.slice(1).join(' - ').trim();
            }

            if (fileNamePromo && !commonPromoName) {
              commonPromoName = fileNamePromo;
            }

            // 4. Cari nilai Grand Total / Total Faktur dari berbagai kemungkinan nama kolom Excel
            let rawTotalVal =
              clean['grand total'] ??
              clean['grandtotal'] ??
              clean['total faktur'] ??
              clean['total_faktur'] ??
              clean['total wpp'] ??
              clean['total_wpp'] ??
              clean['total price'] ??
              clean['total_price'] ??
              clean['total (rp)'] ??
              clean['total rp'] ??
              clean['total'] ??
              clean['nilai'] ??
              clean['nilai wpp'] ??
              clean['amount'] ??
              clean['subtotal'] ??
              clean['netto'] ??
              clean['total netto'];

            // Fallback: Jika nilai belum ketemu/0, cari di semua kolom non-ID
            if (rawTotalVal === undefined || rawTotalVal === '' || rawTotalVal === null || parseCurrencyNumber(rawTotalVal) === 0) {
              for (const k of Object.keys(clean)) {
                if (k.includes('no') || k.includes('code') || k.includes('date') || k.includes('id') || k.includes('qty')) {
                  continue;
                }
                const parsed = parseCurrencyNumber(clean[k]);
                if (parsed > 0) {
                  rawTotalVal = parsed;
                  break;
                }
              }
            }

            const rawTotalFaktur = parseCurrencyNumber(rawTotalVal);
            const breakdown = calculateFakturBreakdown(rawTotalFaktur);

            // 5. Pengecekan Duplikasi Ketat
            const cleanFaktur = noFaktur.toLowerCase();
            const cleanStore = storeName.toLowerCase();

            const isAlreadyApproved = existingApproved.some((inv) =>
              inv.invoice_number?.toLowerCase() === cleanFaktur ||
              inv.items?.some(
                (it) =>
                  String(it.no_faktur || it.wpp_number || '').toLowerCase().includes(cleanFaktur) ||
                  String(it.item_description || it.store_name || '').toLowerCase().includes(cleanStore)
              )
            );

            const isWaitingApproval = existingQueue.some((q) =>
              q.invoice_number?.toLowerCase() === cleanFaktur ||
              q.items?.some(
                (it) =>
                  String(it.no_faktur || it.wpp_number || '').toLowerCase().includes(cleanFaktur) ||
                  String(it.item_description || it.store_name || '').toLowerCase().includes(cleanStore)
              )
            );

            const isDuplicateInStaging = existingStaging.some(
              (w) =>
                String(w.no_faktur || w.wpp_number || '').toLowerCase().includes(cleanFaktur) ||
                String(w.store_name || w.item_description || '').toLowerCase().includes(cleanStore)
            );

            let isDuplicate = false;
            let duplicateReason = '';

            if (isAlreadyApproved) {
              isDuplicate = true;
              duplicateReason = 'Invoice Already Issued (Approved)';
            } else if (isWaitingApproval) {
              isDuplicate = true;
              duplicateReason = 'Under Review (Approval Queue)';
            } else if (isDuplicateInStaging) {
              isDuplicate = true;
              duplicateReason = 'Already in Invoice List';
            }

            if (isDuplicate) dupCounter += 1;

            return {
              id: `wpp-${Date.now()}-${index}`,
              no_faktur: noFaktur,
              wpp_number: noFaktur,
              client_name: customer.trim() || 'PT ASPIRASI HIDUP INDONESIA TBK',
              promo_name: fileNamePromo,
              store_name: storeName,
              item_description: storeName,
              raw_total: breakdown.totalFaktur,
              total_faktur: breakdown.totalFaktur,
              total_price: breakdown.totalFaktur,
              nilai_wpp: breakdown.totalFaktur,
              dpp: breakdown.dpp,
              nilai_barang: breakdown.nilaiBarang,
              jasa_cetak: breakdown.jasaCetak,
              pph23: breakdown.pph23,
              wht: breakdown.wht,
              dpp_nilai_lain_barang: breakdown.dppNilaiLainBarang,
              dpp_nilai_lain_jasa_cetak: breakdown.dppNilaiLainJasaCetak,
              ppn: breakdown.ppn,
              qty: 1,
              unit_price: breakdown.totalFaktur,
              import_date: currentTimestamp,
              waktu_import: currentTimestamp.slice(0, 10),
              status: isAlreadyApproved ? 'invoiced' : isWaitingApproval ? 'waiting_approval' : 'draft',
              isDuplicate: isDuplicate,
              duplicateReason: duplicateReason,
            };
          });

        setImportedRows(parsedData);
        setSelectedIds(parsedData.filter((r) => !r.isDuplicate).map((r) => r.id));
        setDuplicateCount(dupCounter);
        setDetectedClient(commonClientName || 'PT ASPIRASI HIDUP INDONESIA TBK');
        setDetectedPromo(commonPromoName || 'PROMO ADHOC WEEKEND BOOM DEALS');
      } catch (err) {
        console.error('Failed to process Excel file:', err);
        alert('Invalid Excel file format.');
      }
    };

    reader.readAsArrayBuffer(file);
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

  const handleProceedToInvoice = () => {
    const selectedRows = importedRows.filter((r) => selectedIds.includes(r.id));

    if (selectedRows.length === 0) {
      alert('Please select at least one valid store to create an invoice.');
      return;
    }

    const stagedPayload = selectedRows.map((r) => ({
      id: r.id,
      no_faktur: r.no_faktur,
      wpp_number: r.no_faktur,
      item_description: r.store_name,
      store_name: r.store_name,
      sqm: '-',
      qty: r.qty,
      unit_price: r.unit_price,
      total_faktur: r.total_faktur,
      total_price: r.total_faktur,
      nilai_wpp: r.total_faktur,
      dpp: r.dpp,
      nilai_barang: r.nilai_barang,
      jasa_cetak: r.jasa_cetak,
      pph23: r.pph23,
      wht: r.wht,
      dpp_nilai_lain_barang: r.dpp_nilai_lain_barang,
      dpp_nilai_lain_jasa_cetak: r.dpp_nilai_lain_jasa_cetak,
      ppn: r.ppn,
      client_name: detectedClient,
      promo_name: detectedPromo,
      import_date: r.import_date,
      status: 'waiting_approval',
    }));

    const unselectedRows = importedRows
      .filter((r) => !selectedIds.includes(r.id) && !r.isDuplicate && r.status !== 'invoiced')
      .map((r) => ({
        ...r,
        status: 'draft',
      }));

    try {
      const existingStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
      const updatedStaging = [
        ...unselectedRows,
        ...existingStaging.filter((s) => !unselectedRows.some((u) => u.id === s.id || u.wpp_number === s.wpp_number)),
      ];
      localStorage.setItem('wellen_wpp_staging', JSON.stringify(updatedStaging));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error('Failed to save remaining items to Invoice List:', e);
    }

    sessionStorage.setItem('wellen_import_source', 'excel');
    sessionStorage.setItem('wellen_staged_items', JSON.stringify(stagedPayload));
    router.push('/create-invoice');
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

  // Hitung Total Ringkasan
  const selectedRowsList = importedRows.filter((r) => selectedIds.includes(r.id));
  const rowsToSum = selectedRowsList.length > 0 ? selectedRowsList : filteredRows;

  const totalGrandTotal = rowsToSum.reduce((acc, r) => acc + (r.total_faktur || 0), 0);
  const totalDpp = rowsToSum.reduce((acc, r) => acc + (r.dpp || 0), 0);
  const totalNilaiBarang = rowsToSum.reduce((acc, r) => acc + (r.nilai_barang || 0), 0);
  const totalJasaCetak = rowsToSum.reduce((acc, r) => acc + (r.jasa_cetak || 0), 0);
  const totalWht = rowsToSum.reduce((acc, r) => acc + (r.pph23 || 0), 0);
  const totalDppNilaiLainBarang = rowsToSum.reduce((acc, r) => acc + (r.dpp_nilai_lain_barang || 0), 0);
  const totalDppNilaiLainJasaCetak = rowsToSum.reduce((acc, r) => acc + (r.dpp_nilai_lain_jasa_cetak || 0), 0);
  const totalPpn = rowsToSum.reduce((acc, r) => acc + (r.ppn || 0), 0);

  return (
    <div className="space-y-4">
      {/* Kotak Upload Excel */}
      <div className="bg-white px-6 py-4 rounded-xl border-2 border-dashed border-stone-200 hover:border-amber-400 transition-colors shadow-xs">
        <input
          type="file"
          id="excelUpload"
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          className="hidden"
        />
        <label htmlFor="excelUpload" className="cursor-pointer flex items-center justify-center gap-4">
          <div className="p-2 bg-amber-50/80 rounded-full text-amber-500 shrink-0">
            <UploadCloud size={22} />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-stone-800 leading-tight">
              {fileName || 'Click to upload or drag file here (.xlsx / .xls)'}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5 font-normal">
              {fileName ? 'Supported file format: Excel Worksheet' : 'Supported file formats: .xlsx or .xls'}
            </p>
          </div>
        </label>
      </div>

      {/* Metadata Terdeteksi */}
      {importedRows.length > 0 && (
        <div className="space-y-2.5">
          {duplicateCount > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-900">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                <span>Warning: Detected {duplicateCount} duplicate rows or records already registered in the system.</span>
              </div>
              <span className="text-[11px] text-rose-600 font-medium">Duplicate rows locked automatically</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white px-4 py-3 rounded-xl border border-stone-200/80 shadow-xs">
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                FILE NAME / DETECTED PROMO CODE:
              </span>
              <p className="text-xs font-bold text-stone-900 tracking-tight mt-0.5 truncate">
                {detectedPromo}
              </p>
            </div>

            <div className="bg-white px-4 py-3 rounded-xl border border-stone-200/80 shadow-xs">
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                CUSTOMER / CLIENT:
              </span>
              <p className="text-xs font-bold text-stone-900 tracking-tight mt-0.5 truncate">
                {detectedClient}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabel Hasil Parsing Excel */}
      {importedRows.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="p-3.5 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs border-b border-stone-200">
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-stone-800 flex items-center gap-1.5 text-xs">
                <CheckCircle2 size={15} className="text-emerald-500" />
                POS Data Breakdown Results ({importedRows.length} rows)
              </span>
              <span className="text-[11px] text-stone-400">
                ({selectedIds.length} selected for invoice)
              </span>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
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
                onClick={handleProceedToInvoice}
                disabled={selectedIds.length === 0}
                className={`inline-flex items-center gap-2 font-bold px-3.5 py-1.5 rounded-lg text-xs shadow-xs transition-colors shrink-0 ${
                  selectedIds.length > 0
                    ? 'bg-amber-500 hover:bg-amber-600 text-stone-950 cursor-pointer'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                <span>Process Selected Stores ({selectedIds.length})</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-stone-100 text-stone-700 uppercase font-bold text-[10px] border-b border-stone-200 tracking-wider shadow-xs">
                <tr>
                  <th className="py-3 px-3 text-center w-10 bg-stone-100">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors mx-auto ${
                        isAllSelected
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'border-stone-300 hover:border-amber-400 bg-white'
                      }`}
                      title={isAllSelected ? 'Deselect all' : 'Select all valid stores'}
                    >
                      {isAllSelected && <Check size={10} strokeWidth={3} />}
                    </button>
                  </th>
                  <th className="py-3 px-3 text-center w-10 font-bold bg-stone-100">NO</th>
                  <th className="py-3 px-3 w-32 font-bold bg-stone-100 leading-tight">INVOICE<br/>NO</th>
                  <th className="py-3 px-3 max-w-[200px] font-bold bg-stone-100 leading-tight">STORE NAME<br/>(ITEM DESCRIPTION)</th>
                  <th className="py-3 px-3 text-right w-28 font-bold bg-stone-100 leading-tight">GRAND<br/>TOTAL</th>
                  <th className="py-3 px-3 text-right font-bold bg-stone-100 whitespace-nowrap">DPP</th>
                  <th className="py-3 px-3 text-right font-bold bg-stone-100 leading-tight">NILAI<br/>BARANG</th>
                  <th className="py-3 px-3 text-right font-bold bg-stone-100 leading-tight">JASA<br/>CETAK</th>
                  <th className="py-3 px-3 text-right font-bold bg-stone-100 whitespace-nowrap">WHT</th>
                  <th className="py-3 px-3 text-right font-bold bg-stone-100 leading-tight">DPP NILAI LAIN<br/>BARANG</th>
                  <th className="py-3 px-3 text-right font-bold bg-stone-100 leading-tight">DPP NILAI LAIN<br/>JASA CETAK</th>
                  <th className="py-3 px-3 text-right font-bold bg-stone-100 whitespace-nowrap">PPN</th>
                  <th className="py-3 px-3 text-center w-16 font-bold bg-stone-100">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-normal">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-stone-400 text-xs">
                      No store data matching the keyword "{searchQuery}"
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
                            ? 'bg-amber-50/20'
                            : 'hover:bg-stone-50/40'
                        }`}
                      >
                        <td className="py-3 px-3 text-center w-10">
                          <button
                            type="button"
                            disabled={isDup}
                            onClick={() => handleToggleSelect(row.id)}
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all mx-auto ${
                              isDup
                                ? 'bg-rose-200 border-rose-300 cursor-not-allowed text-transparent'
                                : isSelected
                                ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                                : 'border-stone-300 hover:border-amber-400 bg-white'
                            }`}
                          >
                            {isSelected && !isDup && <Check size={10} strokeWidth={3} />}
                          </button>
                        </td>
                        <td className="py-3 px-3 text-center text-stone-500 font-normal w-10">
                          {idx + 1}
                        </td>
                        <td className={`py-3 px-3 font-mono font-bold whitespace-nowrap ${isDup ? 'text-rose-900' : 'text-stone-900'}`}>
                          {row.no_faktur}
                          {isDup && (
                            <span className="block text-[9px] font-bold text-rose-600 tracking-wider">
                              {row.duplicateReason}
                            </span>
                          )}
                        </td>
                        <td className={`py-3 px-3 font-medium tracking-tight max-w-[200px] break-words leading-tight ${isDup ? 'text-rose-900' : 'text-stone-900'}`}>
                          {row.store_name}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-bold whitespace-nowrap ${isDup ? 'text-rose-900' : 'text-stone-900'}`}>
                          {formatRupiah(row.total_faktur)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap">
                          {formatRupiah(row.dpp)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap">
                          {formatRupiah(row.nilai_barang)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap">
                          {formatRupiah(row.jasa_cetak)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-rose-600 font-semibold whitespace-nowrap">
                          {formatRupiah(row.pph23)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap">
                          {formatRupiah(row.dpp_nilai_lain_barang)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap">
                          {formatRupiah(row.dpp_nilai_lain_jasa_cetak)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-700 font-bold whitespace-nowrap">
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

              {/* Baris Total Ringkasan sticky bottom */}
              {filteredRows.length > 0 && (
                <tfoot className="sticky bottom-0 z-10 bg-stone-100 border-t-2 border-stone-200 text-stone-900 font-bold text-xs shadow-xs">
                  <tr>
                    <td colSpan={4} className="py-3 px-3 text-right uppercase tracking-wider text-[11px] font-extrabold text-stone-700">
                      TOTAL ({rowsToSum.length} TOKO):
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold whitespace-nowrap text-stone-900">
                      {formatRupiah(totalGrandTotal)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap text-stone-800">
                      {formatRupiah(totalDpp)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap text-stone-800">
                      {formatRupiah(totalNilaiBarang)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap text-stone-800">
                      {formatRupiah(totalJasaCetak)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap text-rose-600">
                      {formatRupiah(totalWht)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap text-stone-800">
                      {formatRupiah(totalDppNilaiLainBarang)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap text-stone-800">
                      {formatRupiah(totalDppNilaiLainJasaCetak)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap text-emerald-700">
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
    </div>
  );
}
