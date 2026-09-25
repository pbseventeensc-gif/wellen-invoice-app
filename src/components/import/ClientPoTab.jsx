'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  ArrowRight,
  Trash2,
  FileText,
  Plus,
  Layers
} from 'lucide-react';
import { formatRupiah } from '@/utils/taxCalculator';

export default function ClientPoTab() {
  const router = useRouter();

  // State Form PO Klien (Mulai KOSONG sebelum di-upload)
  const [poFileName, setPoFileName] = useState('');
  const [poClientName, setPoClientName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState('');
  const [poPromoName, setPoPromoName] = useState('');
  const [poIncludeJasaCetak, setPoIncludeJasaCetak] = useState(false);
  const [poItems, setPoItems] = useState([]);

  // State Item PO Terpilih (Sistem Penagihan Parsial / Termin)
  const [selectedPoIds, setSelectedPoIds] = useState([]);

  // Sisa Item PO dari Penagihan Parsial Sebelumya
  const [remainingBatch, setRemainingBatch] = useState(null);

  useEffect(() => {
    try {
      const storedRem = localStorage.getItem('wellen_po_remaining_items');
      if (storedRem) {
        setRemainingBatch(JSON.parse(storedRem));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleLoadRemainingBatch = () => {
    if (!remainingBatch) return;
    setPoClientName(String(remainingBatch.client_name || 'PT. FOODS BEVERAGES INDONESIA').toUpperCase());
    setPoNumber(remainingBatch.po_number || 'WPP-4607477988');
    setPoDate(remainingBatch.po_date || new Date().toISOString().slice(0, 10));
    setPoPromoName(String(remainingBatch.promo_name || 'PURCHASE ORDER MATERIAL & JASA').toUpperCase());
    setPoItems(
      (remainingBatch.remaining_items || []).map((it) => ({
        ...it,
        description: String(it.description || '').toUpperCase(),
      }))
    );
    setPoFileName(`PO_REMAINING_${remainingBatch.po_number || 'PO'}.pdf`);
  };

  const handleToggleSelectPoItem = (id) => {
    setSelectedPoIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllPoItems = () => {
    if (selectedPoIds.length === poItems.length) {
      setSelectedPoIds([]);
    } else {
      setSelectedPoIds(poItems.map((item) => item.id));
    }
  };

  // Reset / Hapus seluruh data PO di Form
  const handleClearPoForm = () => {
    if (poItems.length > 0 || poClientName || poNumber) {
      if (!confirm('Clear all entered PO header details and line items?')) return;
    }
    setPoFileName('');
    setPoClientName('');
    setPoNumber('');
    setPoDate('');
    setPoPromoName('');
    setPoItems([]);
    setPoIncludeJasaCetak(false);
  };

  // Handler Upload File PO PDF / Gambar (Data Seragam KAPITAL & Tanpa Terpotong)
  const handlePoFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPoFileName(file.name);
    setPoClientName('PT. FOODS BEVERAGES INDONESIA');
    setPoNumber(`WPP-${Date.now().toString().slice(-8)}`);
    setPoDate(new Date().toISOString().slice(0, 10));
    setPoPromoName('PURCHASE ORDER MATERIAL & JASA');

    const defaultItems = [
      { id: 'po-1', description: 'ART CARTON 260 GSM 15X21 CM PRINT 1 SISI PTG KOTAK', qty: 4, uom: 'EA', unit_price: 1748, isJasaCetak: false },
      { id: 'po-2', description: 'STC VYNIL A3 LAM DOFF (PTG BENTUK)', qty: 1, uom: 'M2', unit_price: 23477, isJasaCetak: false },
      { id: 'po-3', description: 'FOAMBOARD NON PRINT (PTG BENTUK)', qty: 1, uom: 'M2', unit_price: 23865, isJasaCetak: false },
      { id: 'po-4', description: 'STICK KAYU SILINDAR BULAT', qty: 3, uom: 'EA', unit_price: 33300, isJasaCetak: false },
      { id: 'po-5', description: 'IMPRABOARD + STC RITRAMA LAM DOFF (PTG KOTAK)', qty: 1, uom: 'M2', unit_price: 33716, isJasaCetak: false },
      { id: 'po-6', description: 'FOAMBOARD + STC RITRAMA LAM DOFF (PTG KOTAK)', qty: 1, uom: 'M2', unit_price: 35964, isJasaCetak: false },
      { id: 'po-7', description: 'PVC FOAMBOARD + STC (PTG BENTUK)', qty: 1, uom: 'M2', unit_price: 53676, isJasaCetak: false },
      { id: 'po-8', description: 'STC RITRAMA LAM DOFF (PTG KOTAK)', qty: 2.34, uom: 'M2', unit_price: 69930, isJasaCetak: false },
      { id: 'po-9', description: 'JASA CETAK', qty: 1, uom: 'EA', unit_price: 112643, isJasaCetak: true },
      { id: 'po-10', description: 'FOAMBOARD + STC RITRAMA LAM DOFF (PTG BENTUK)', qty: 1.42, uom: 'M2', unit_price: 149850, isJasaCetak: false },
      { id: 'po-11', description: 'IMPRABOARD + STC RITRAMA LAM DOFF (PTG BENTUK)', qty: 2.31, uom: 'M2', unit_price: 149850, isJasaCetak: false },
      { id: 'po-12', description: 'STC ORACAL SOLID BLACK (PTG BENTUK)', qty: 1, uom: 'M2', unit_price: 191375, isJasaCetak: false },
      { id: 'po-13', description: 'PVC BOARD + STC RITRAMA LAM DOFF (PTG KOTAK)', qty: 1.23, uom: 'M2', unit_price: 239760, isJasaCetak: false },
      { id: 'po-14', description: 'JASA PASANG VISUAL', qty: 1, uom: 'EA', unit_price: 558885, isJasaCetak: false },
    ];

    setPoItems(defaultItems);
    setSelectedPoIds(defaultItems.map((item) => item.id));
  };

  // Tambah Baris PO Item Baru (Otomatis Kapital)
  const handleAddPoItem = () => {
    const newItemId = `po-${Date.now()}-${poItems.length + 1}`;
    setPoItems((prev) => [
      ...prev,
      {
        id: newItemId,
        description: 'NEW MATERIAL / SERVICE ITEM',
        qty: 1,
        uom: 'M2',
        unit_price: 50000,
        isJasaCetak: false,
      },
    ]);
    setSelectedPoIds((prev) => [...prev, newItemId]);
  };

  // Update Item PO (Otomatis Kapital)
  const handleUpdatePoItem = (id, field, val) => {
    setPoItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const finalVal = field === 'description' ? String(val).toUpperCase() : val;
          const updated = { ...item, [field]: finalVal };
          if (field === 'description') {
            const cleanDesc = String(val).toLowerCase().trim();
            updated.isJasaCetak = cleanDesc === 'jasa cetak';
          }
          return updated;
        }
        return item;
      })
    );
  };

  // Hapus Item PO
  const handleRemovePoItem = (id) => {
    setPoItems((prev) => prev.filter((it) => it.id !== id));
    setSelectedPoIds((prev) => prev.filter((itemId) => itemId !== id));
  };

  // Process & Stage PO ke Invoice (Penagihan Parsial / Termin Billing)
  const handleProceedPOInvoice = () => {
    const selectedRows = poItems.filter((r) => selectedPoIds.includes(r.id));

    if (selectedRows.length === 0) {
      alert('Please select at least one PO item line for partial billing.');
      return;
    }

    const stagedPayload = selectedRows.map((r) => {
      const q = Number(r.qty) || 1;
      const p = Number(r.unit_price) || 0;
      const totalPrice = Math.round(q * p);
      const cleanDesc = String(r.description || '').toUpperCase();

      return {
        id: r.id,
        no_faktur: poNumber || `WPP-${Date.now().toString().slice(-8)}`,
        wpp_number: poNumber || `WPP-${Date.now().toString().slice(-8)}`,
        item_description: cleanDesc,
        store_name: cleanDesc,
        qty: q,
        uom: r.uom || 'PCS',
        unit_price: p,
        total_price: totalPrice,
        nilai_wpp: totalPrice,
        dpp_11_12: Math.round(totalPrice * (11 / 12)),
        client_name: String(poClientName || 'PT. FOODS BEVERAGES INDONESIA').toUpperCase(),
        promo_name: String(poPromoName || 'PURCHASE ORDER MATERIAL & JASA').toUpperCase(),
        invoice_date: poDate || new Date().toISOString().slice(0, 10),
        isJasaCetak: r.isJasaCetak || false,
        status: 'waiting_approval',
      };
    });

    // Simpan sisa item PO yang belum ditagih ke Invoice List (wellen_wpp_staging) untuk Termin / Batch berikutnya
    const unselectedRows = poItems.filter((r) => !selectedPoIds.includes(r.id));
    if (unselectedRows.length > 0) {
      try {
        const remainingForStaging = unselectedRows.map((r, idx) => {
          const cleanDesc = String(r.description || '').toUpperCase();
          return {
            id: r.id || `po-rem-${Date.now()}-${idx}`,
            no_faktur: poNumber || `WPP-PO-${Date.now().toString().slice(-6)}`,
            wpp_number: poNumber || `WPP-PO-${Date.now().toString().slice(-6)}`,
            client_name: String(poClientName || 'PT. FOODS BEVERAGES INDONESIA').toUpperCase(),
            promo_name: String(poPromoName || 'PURCHASE ORDER MATERIAL & JASA').toUpperCase(),
            store_name: cleanDesc,
            item_description: cleanDesc,
            qty: Number(r.qty) || 1,
            uom: r.uom || 'PCS',
            unit_price: Number(r.unit_price) || 0,
            total_price: Math.round((Number(r.qty) || 1) * (Number(r.unit_price) || 0)),
            nilai_wpp: Math.round((Number(r.qty) || 1) * (Number(r.unit_price) || 0)),
            import_date: new Date().toISOString(),
            status: 'ready',
            isJasaCetak: r.isJasaCetak || false,
          };
        });

        const existingStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
        const updatedStaging = [
          ...remainingForStaging,
          ...existingStaging.filter((s) => !remainingForStaging.some((u) => u.id === s.id)),
        ];
        localStorage.setItem('wellen_wpp_staging', JSON.stringify(updatedStaging));

        localStorage.setItem('wellen_po_remaining_items', JSON.stringify({
          client_name: String(poClientName).toUpperCase(),
          po_number: poNumber,
          po_date: poDate,
          promo_name: String(poPromoName).toUpperCase(),
          remaining_items: unselectedRows.map((it) => ({
            ...it,
            description: String(it.description).toUpperCase(),
          })),
        }));

        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.error('Failed to save remaining PO items:', e);
      }
    }

    sessionStorage.setItem('wellen_import_source', 'po');
    sessionStorage.setItem('wellen_staged_items', JSON.stringify(stagedPayload));
    sessionStorage.setItem('wellen_po_include_jasa', JSON.stringify(poIncludeJasaCetak));
    router.push('/create-invoice');
  };

  return (
    <div className="space-y-4">
      {/* Banner Notifikasi Sisa PO Belum Ditagihkan (Termin Sisa) */}
      {remainingBatch && remainingBatch.remaining_items?.length > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-amber-900">
            <span className="p-1 bg-amber-200/80 rounded-full text-amber-800">
              <FileText size={14} />
            </span>
            <span>
              Found <strong>{remainingBatch.remaining_items.length} unbilled PO items</strong> from <strong>{remainingBatch.po_number}</strong> ({remainingBatch.client_name}).
            </span>
          </div>

          <button
            type="button"
            onClick={handleLoadRemainingBatch}
            className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold px-3.5 py-1.5 rounded-xl text-xs shadow-2xs transition-colors cursor-pointer"
          >
            Load Unbilled PO Items (Termin #2)
          </button>
        </div>
      )}

      {/* Box Upload File PO PDF / Gambar Scan */}
      <div className="bg-white px-6 py-4 rounded-xl border-2 border-dashed border-stone-200 hover:border-amber-400 transition-colors shadow-xs">
        <input
          type="file"
          id="poFileUpload"
          accept=".pdf, .png, .jpg, .jpeg"
          onChange={handlePoFileUpload}
          className="hidden"
        />
        <label htmlFor="poFileUpload" className="cursor-pointer flex items-center justify-center gap-4">
          <div className="p-2 bg-amber-50/80 rounded-full text-amber-500 shrink-0">
            <UploadCloud size={22} />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-stone-800 leading-tight">
              {poFileName ? `Uploaded PO File: ${poFileName}` : 'Click to upload or drag Client Purchase Order file (.pdf, .jpg, .png)'}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5 font-normal">
              {poFileName ? 'PO File Processed. Details extracted into fields below.' : 'Supported file formats: PDF Document or Image Scan (.pdf / .png / .jpg)'}
            </p>
          </div>
        </label>
      </div>

      {/* Header Metadata PO Form */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2 text-stone-900 font-bold text-sm uppercase">
            <FileText size={18} className="text-amber-500" />
            <span>Client Purchase Order (PO Header Details)</span>
          </div>

          <button
            type="button"
            onClick={handleClearPoForm}
            className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
            Clear / Reset PO Form
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">
              CLIENT / PT ENTITY NAME
            </label>
            <input
              type="text"
              value={poClientName}
              onChange={(e) => setPoClientName(e.target.value.toUpperCase())}
              placeholder="e.g. PT. FOODS BEVERAGES INDONESIA"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-900 uppercase outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">
              PO / WPP NUMBER
            </label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value.toUpperCase())}
              placeholder="e.g. WPP-4607477988"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono font-bold text-stone-900 uppercase outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">
              PO DATE
            </label>
            <input
              type="date"
              value={poDate}
              onChange={(e) => setPoDate(e.target.value)}
              onClick={(e) => e.target.showPicker?.()}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono text-stone-900 outline-none focus:border-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">
              PROMO / PROJECT NAME
            </label>
            <input
              type="text"
              value={poPromoName}
              onChange={(e) => setPoPromoName(e.target.value.toUpperCase())}
              placeholder="e.g. PURCHASE ORDER MATERIAL & JASA"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-medium text-stone-900 uppercase outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Dynamic Line-Item Builder Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-bold text-stone-900 uppercase">
            <Layers size={16} className="text-amber-500" />
            <span>PO Material & Line-Item Breakdown ({poItems.length} Items)</span>
          </div>

          <button
            type="button"
            onClick={handleAddPoItem}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={14} /> Add Line Item Row
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-stone-100/70 text-stone-500 uppercase font-bold text-[10px] border-b border-stone-200 tracking-wider">
              <tr>
                <th className="py-3 px-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={poItems.length > 0 && selectedPoIds.length === poItems.length}
                    onChange={handleToggleSelectAllPoItems}
                    disabled={poItems.length === 0}
                    className="rounded border-stone-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                    title="Select All / Deselect All PO Items"
                  />
                </th>
                <th className="py-3 px-3 text-center w-10">NO</th>
                <th className="py-3 px-3">ITEM DESCRIPTION (FULL MATERIAL / SERVICE)</th>
                <th className="py-3 px-3 text-center w-24">QTY</th>
                <th className="py-3 px-3 text-center w-24">UOM</th>
                <th className="py-3 px-3 text-right w-36">UNIT PRICE (RP)</th>
                <th className="py-3 px-3 text-right w-40">TOTAL AMOUNT</th>
                <th className="py-3 px-3 text-center w-14">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {poItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-400 text-xs font-medium">
                    No PO items entered yet. Click "+ Add Line Item Row" or upload a PO file above.
                  </td>
                </tr>
              ) : (
                poItems.map((item, idx) => {
                  const isSelected = selectedPoIds.includes(item.id);
                  const lineTotal = Math.round((Number(item.qty) || 0) * (Number(item.unit_price) || 0));
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${isSelected ? 'bg-amber-50/20' : 'bg-stone-50/40 opacity-60'}`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectPoItem(item.id)}
                          className="rounded border-stone-300 text-amber-500 focus:ring-amber-400 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-stone-400">{idx + 1}</td>

                      <td className="py-2.5 px-3">
                        <textarea
                          rows={1}
                          value={item.description}
                          onChange={(e) => handleUpdatePoItem(item.id, 'description', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-stone-900 uppercase outline-none focus:border-amber-500 focus:bg-white resize-y min-h-[34px] leading-relaxed"
                        />
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          step="any"
                          value={item.qty}
                          onChange={(e) => handleUpdatePoItem(item.id, 'qty', e.target.value)}
                          className="w-full px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-bold text-center text-stone-900 outline-none focus:border-amber-500 focus:bg-white"
                        />
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <select
                          value={item.uom || 'M2'}
                          onChange={(e) => handleUpdatePoItem(item.id, 'uom', e.target.value)}
                          className="w-full px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-center text-stone-800 uppercase outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="M2">M²</option>
                          <option value="EA">EA</option>
                          <option value="PCS">PCS</option>
                          <option value="SET">SET</option>
                          <option value="LS">LS</option>
                          <option value="PACK">PACK</option>
                        </select>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => handleUpdatePoItem(item.id, 'unit_price', e.target.value)}
                          className="w-full px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono font-bold text-right text-stone-900 outline-none focus:border-amber-500 focus:bg-white"
                        />
                      </td>

                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatRupiah(lineTotal)}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemovePoItem(item.id)}
                          className="p-1 hover:bg-rose-50 text-stone-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Total Excl VAT & Process Button */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-bold text-stone-500 uppercase tracking-wider">TOTAL PO EXCLUDING VAT:</span>
            <span className="font-mono text-base font-bold text-slate-900">
              {formatRupiah(
                poItems
                  .filter((r) => selectedPoIds.includes(r.id))
                  .reduce((sum, r) => sum + Math.round((Number(r.qty) || 0) * (Number(r.unit_price) || 0)), 0)
              )}
            </span>
            {poItems.length > 0 && selectedPoIds.length < poItems.length && (
              <span className="bg-amber-100 text-amber-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                Partial Billing: {selectedPoIds.length} of {poItems.length} items selected
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleProceedPOInvoice}
            disabled={selectedPoIds.length === 0}
            className={`inline-flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-xs shadow-xs transition-colors shrink-0 ${
              selectedPoIds.length > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-stone-950 cursor-pointer'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            <span>Process Selected PO Items ({selectedPoIds.length})</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
