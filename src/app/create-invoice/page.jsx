'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Trash2 } from 'lucide-react';
import { calculateFakturBreakdown, formatRupiah } from '@/utils/taxCalculator';

export default function CreateInvoicePage() {
  const router = useRouter();

  // Form State
  const [wppNumber, setWppNumber] = useState('WPK 0826-702909');
  const [invoiceDate, setInvoiceDate] = useState('2026-09-10');
  const [createdByName] = useState('FAHADA');
  const [clientName, setClientName] = useState('PT DIGITAL CREATIVE ASIA');
  const [clientAddress, setClientAddress] = useState(
    'EightyEight @Kasablanka Office Tower Lt. 30 Unit B\nJl. Casablanca Kav. 88 Tebet Jakarta Selatan - DKI Jakarta\n021 - 29820243'
  );
  const [promoName, setPromoName] = useState('STICKER VINYL INDOOR GLOSSY');
  const [isDppActive, setIsDppActive] = useState(false);

  // Parameter Mode Import PO (3 Button Kontrol)
  const [isPoExclVatActive, setIsPoExclVatActive] = useState(false); // Button 2: Harga Exc PPN per line (PO / 1.11)
  const [showJasaCetakPo, setShowJasaCetakPo] = useState(true); // Button 3: ON/OFF Item Jasa Cetak

  // Sumber Import Mode: 'excel' vs 'po'
  const [importSource, setImportSource] = useState('excel');

  // State Item Toko Murni
  const [stores, setStores] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load Data Pertama Kali
  useEffect(() => {
    try {
      const storedSource = sessionStorage.getItem('wellen_import_source');
      const staged = sessionStorage.getItem('wellen_staged_items');

      if (staged !== null) {
        const parsed = JSON.parse(staged);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isPo = storedSource === 'po' || parsed.some((s) => s.isPoSource || s.importType === 'po' || (s.uom && s.uom !== 'PCS'));
          setImportSource(isPo ? 'po' : 'excel');

          if (parsed[0]?.client_name) setClientName(parsed[0].client_name);
          if (parsed[0]?.promo_name) setPromoName(parsed[0].promo_name);
          if (parsed[0]?.no_faktur || parsed[0]?.wpp_number) {
            setWppNumber(parsed[0].no_faktur || parsed[0].wpp_number);
          }

          // Ambil semua baris item dengan breakdown yang konsisten
          const validStores = parsed.map((s, idx) => {
            const rawTotalFaktur = Number(s.total_faktur || s.total_price || s.raw_total || s.nilai_wpp || 0);
            const breakdown = calculateFakturBreakdown(rawTotalFaktur);

            const isJasa = (s.item_description || s.store_name || '').toUpperCase().trim() === 'JASA CETAK';

            return {
              ...s,
              id: s.id || `store-${idx}-${Date.now()}`,
              total_faktur: breakdown.totalFaktur,
              dpp: s.dpp !== undefined ? Number(s.dpp) : breakdown.dpp,
              nilai_barang: s.nilai_barang !== undefined ? Number(s.nilai_barang) : breakdown.nilaiBarang,
              jasa_cetak: s.jasa_cetak !== undefined ? Number(s.jasa_cetak) : breakdown.jasaCetak,
              pph23: s.pph23 !== undefined ? Number(s.pph23) : breakdown.pph23,
              ppn: s.ppn !== undefined ? Number(s.ppn) : breakdown.ppn,
              qty: Number(s.qty) || 1,
              uom: s.uom || 'PCS',
              unit_price: Number(s.unit_price) || rawTotalFaktur,
              isJasaCetak: isJasa,
            };
          });

          setStores(validStores);
          setIsInitialized(true);
          return;
        }
      }
    } catch (e) {
      console.error('Gagal membaca data staged:', e);
    }

    setStores([]);
    setIsInitialized(true);
  }, []);

  // Hapus baris toko & simpan langsung ke sessionStorage
  const handleRemoveStore = (indexToRemove) => {
    const updated = stores.filter((_, idx) => idx !== indexToRemove);
    setStores(updated);
    try {
      sessionStorage.setItem('wellen_staged_items', JSON.stringify(updated));
    } catch (e) {
      console.error('Gagal menyimpan perubahan ke session storage:', e);
    }
  };

  // Filter Item Jasa Cetak khusus jika Toggle Item Jasa Cetak = OFF
  const filteredStoresByJasa = stores.filter((row) => {
    if (importSource === 'po' && !showJasaCetakPo) {
      const desc = String(row.item_description || row.store_name || '').toUpperCase().trim();
      return desc !== 'JASA CETAK';
    }
    return true;
  });

  // 1. Baris Item Terhitung Langsung (Sesuai Parameter Exc PPN per line)
  const calculatedStoreRows = filteredStoresByJasa.map((row) => {
    const rawUnitPrice = Number(row.unit_price || row.total_faktur || row.total_price || 0);
    const qty = Number(row.qty) || 1;

    // Parameter ON/OFF: Harga Exc PPN per Line (PO / 1.11)
    let effectiveUnitPrice = rawUnitPrice;
    if (importSource === 'po' && isPoExclVatActive) {
      effectiveUnitPrice = Math.round(rawUnitPrice / 1.11);
    }

    const effectiveTotalPrice = Math.round(qty * effectiveUnitPrice);
    const breakdown = calculateFakturBreakdown(effectiveTotalPrice);

    const dpp = row.dpp !== undefined && row.dpp > 0 ? Number(row.dpp) : breakdown.dpp;
    const nilaiBarang = row.nilai_barang !== undefined && row.nilai_barang > 0 ? Number(row.nilai_barang) : breakdown.nilaiBarang;
    const jasaCetak = row.jasa_cetak !== undefined && row.jasa_cetak > 0 ? Number(row.jasa_cetak) : breakdown.jasaCetak;
    const pph23 = row.pph23 !== undefined && row.pph23 > 0 ? Number(row.pph23) : breakdown.pph23;
    const ppn = row.ppn !== undefined && row.ppn > 0 ? Number(row.ppn) : breakdown.ppn;

    return {
      ...row,
      effectiveUnitPrice,
      effectiveTotalPrice,
      dpp,
      nilaiBarang,
      jasaCetak,
      pph23,
      ppn,
    };
  });

  const jasaCetakStores = stores.filter((row) => {
    const desc = String(row.item_description || row.store_name || '').toUpperCase().trim();
    return desc === 'JASA CETAK';
  });

  // Hitung Nilai Jasa Cetak secara terpisah untuk Tampilan Baris Bawah
  const totalJasaCetakPoOverall = jasaCetakStores.reduce((acc, row) => {
    const p = isPoExclVatActive ? Math.round(Number(row.unit_price || 0) / 1.11) : Number(row.unit_price || 0);
    return acc + Math.round((Number(row.qty) || 1) * p);
  }, 0);

  // 2. Akumulasi Total Keseluruhan
  const totalDppOverall = calculatedStoreRows.reduce((acc, row) => acc + row.dpp, 0);
  const totalNilaiBarangOverall = calculatedStoreRows.reduce((acc, row) => acc + row.nilaiBarang, 0);
  const totalJasaCetakOverall = calculatedStoreRows.reduce((acc, row) => acc + row.jasaCetak, 0);
  const totalPph23Overall = calculatedStoreRows.reduce((acc, row) => acc + row.pph23, 0);

  // Akumulasi khusus Mode PO
  const totalPoNetOverall = calculatedStoreRows.reduce((acc, row) => acc + row.effectiveTotalPrice, 0);

  // VAT (PPN)
  const vatAmount = importSource === 'po'
    ? Math.round(totalPoNetOverall * 0.11)
    : (calculatedStoreRows.reduce((acc, row) => acc + (row.ppn || 0), 0) || Math.round(totalDppOverall * 0.11));

  // Grand Total = Total + VAT - WHT
  const grandTotal = importSource === 'po'
    ? totalPoNetOverall + vatAmount
    : totalDppOverall + vatAmount - totalPph23Overall;

  // Submit ke Antrean Approval
  const handleSubmitApproval = () => {
    if (stores.length === 0) {
      alert('Please add at least one store item.');
      return;
    }

    const payload = {
      id: `wpk-${Date.now()}`,
      invoice_number: wppNumber,
      invoice_date: invoiceDate,
      client_name: clientName,
      client_address: clientAddress,
      promo_name: promoName,
      created_by: createdByName,
      ar_name: createdByName,
      is_dpp_active: isDppActive,
      is_po_excl_vat_active: isPoExclVatActive,
      show_jasa_cetak_po: showJasaCetakPo,
      total_faktur: importSource === 'po' ? totalPoNetOverall : totalDppOverall,
      total_harga_net: importSource === 'po' ? totalPoNetOverall : totalDppOverall,
      subtotal_net: importSource === 'po' ? totalPoNetOverall : totalDppOverall,
      total_dpp: totalDppOverall,
      total_dpp_lainnya: totalNilaiBarangOverall,
      total_jasa_cetak: importSource === 'po' ? totalJasaCetakPoOverall : totalJasaCetakOverall,
      total_pph23: importSource === 'po' ? 0 : totalPph23Overall,
      dpp_lain: totalNilaiBarangOverall,
      ppn_amount: vatAmount,
      grand_total: grandTotal,
      time_created: new Date().toISOString().slice(0, 16).replace('T', ' '),
      status: 'waiting_approval',
      importSource: importSource,
      items: calculatedStoreRows.map((it) => ({
        id: it.id,
        no_faktur: it.no_faktur || wppNumber,
        wpp_number: it.wpp_number || wppNumber,
        item_description: it.item_description || it.store_name,
        total_faktur: importSource === 'po' ? it.effectiveTotalPrice : it.dpp,
        total_price: importSource === 'po' ? it.effectiveTotalPrice : it.dpp,
        dpp: it.dpp,
        nilai_barang: it.nilaiBarang,
        jasa_cetak: it.jasaCetak,
        pph23: it.pph23,
        qty: it.qty || 1,
        uom: it.uom || 'PCS',
        unit_price: importSource === 'po' ? it.effectiveUnitPrice : it.dpp,
        isJasaCetak: it.isJasaCetak || false,
      })),
    };

    const existingQueue = JSON.parse(localStorage.getItem('wellen_approval_queue') || '[]');
    localStorage.setItem('wellen_approval_queue', JSON.stringify([payload, ...existingQueue]));

    sessionStorage.removeItem('wellen_staged_items');
    window.dispatchEvent(new Event('storage'));

    alert(`Invoice ${wppNumber} successfully submitted to Approval Queue!`);
    router.push('/approval');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      {/* Header Halaman */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors cursor-pointer text-stone-700"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Invoice Creation Form</h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Review document details, store items, and breakdown figures before submitting for approval.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmitApproval}
          disabled={stores.length === 0}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-bold px-5 py-2.5 rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
        >
          <Send size={14} />
          <span>Submit for Approval</span>
        </button>
      </div>

      {/* Baris Identitas Faktur */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs space-y-4">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Document Identity</p>
          <div>
            <label className="text-[11px] font-medium text-stone-500 block mb-1">WPK Number (Editable)</label>
            <input
              type="text"
              value={wppNumber}
              onChange={(e) => setWppNumber(e.target.value)}
              className="w-full text-xs font-mono font-bold px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 text-stone-900"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-stone-500 block mb-1">Invoice Date (Editable)</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 text-stone-800 font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-stone-500 block mb-1">Created By (AR)</label>
            <input
              type="text"
              value={createdByName}
              readOnly
              className="w-full text-xs font-semibold px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl text-stone-600 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs space-y-4">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Bill to (Client)</p>
          <div>
            <label className="text-[11px] font-medium text-stone-500 block mb-1">Client Name (PT)</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 text-stone-900 uppercase"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-stone-500 block mb-1">Address & Contact</label>
            <textarea
              rows={3}
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 text-stone-700 leading-relaxed resize-none uppercase"
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs space-y-4">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Project Parameters</p>
          <div>
            <label className="text-[11px] font-medium text-stone-500 block mb-1">Promo / Material Name</label>
            <input
              type="text"
              value={promoName}
              onChange={(e) => setPromoName(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 text-stone-900 uppercase"
            />
          </div>

          {importSource === 'po' ? (
            <div className="space-y-3 pt-2 border-t border-stone-100">
              {/* Button 1: DPP ON/OFF */}
              <div>
                <label className="text-[11px] font-medium text-stone-600 block mb-1">
                  DPP :
                </label>
                <div className="flex items-center gap-4 text-xs font-semibold text-stone-800">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dppOptionPo"
                      checked={isDppActive === true}
                      onChange={() => setIsDppActive(true)}
                      className="accent-amber-500 w-4 h-4"
                    />
                    <span>ON</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dppOptionPo"
                      checked={isDppActive === false}
                      onChange={() => setIsDppActive(false)}
                      className="accent-amber-500 w-4 h-4"
                    />
                    <span>OFF</span>
                  </label>
                </div>
              </div>

              {/* Button 2: Harga Exc PPN per Line (PO / 1.11) */}
              <div>
                <label className="text-[11px] font-medium text-stone-600 block mb-1">
                  Harga Excl. PPN per Line (Harga PO / 1.11) :
                </label>
                <div className="flex items-center gap-4 text-xs font-semibold text-stone-800">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="poExclVatOption"
                      checked={isPoExclVatActive === true}
                      onChange={() => setIsPoExclVatActive(true)}
                      className="accent-amber-500 w-4 h-4"
                    />
                    <span>ON</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="poExclVatOption"
                      checked={isPoExclVatActive === false}
                      onChange={() => setIsPoExclVatActive(false)}
                      className="accent-amber-500 w-4 h-4"
                    />
                    <span>OFF</span>
                  </label>
                </div>
              </div>

              {/* Button 3: Item Jasa Cetak ON/OFF */}
              <div>
                <label className="text-[11px] font-medium text-stone-600 block mb-1">
                  Item Jasa Cetak :
                </label>
                <div className="flex items-center gap-4 text-xs font-semibold text-stone-800">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="showJasaCetakOption"
                      checked={showJasaCetakPo === true}
                      onChange={() => setShowJasaCetakPo(true)}
                      className="accent-amber-500 w-4 h-4"
                    />
                    <span>ON</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="showJasaCetakOption"
                      checked={showJasaCetakPo === false}
                      onChange={() => setShowJasaCetakPo(false)}
                      className="accent-amber-500 w-4 h-4"
                    />
                    <span>OFF</span>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-medium text-stone-500 block mb-2">DPP :</label>
              <div className="flex items-center gap-5 text-xs font-semibold text-stone-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dppOption"
                    checked={isDppActive === true}
                    onChange={() => setIsDppActive(true)}
                    className="accent-amber-500 w-4 h-4"
                  />
                  <span>ON</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dppOption"
                    checked={isDppActive === false}
                    onChange={() => setIsDppActive(false)}
                    className="accent-amber-500 w-4 h-4"
                  />
                  <span>OFF</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabel Rincian Barang / Jasa */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
            Item Breakdown Details {importSource === 'po' ? '(Client PO Mode)' : '(POS Excel Mode)'}
          </h2>
          <span className="text-xs text-stone-400 font-medium">Line Count: {calculatedStoreRows.length} Items</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-semibold border-b border-stone-200 tracking-wider">
              {importSource === 'po' ? (
                <tr>
                  <th className="py-3 px-4 w-12 text-center">NO</th>
                  <th className="py-3 px-4 font-semibold">ITEM DESCRIPTION</th>
                  <th className="py-3 px-4 text-center w-20 font-semibold">QTY</th>
                  <th className="py-3 px-4 text-center w-20 font-semibold">UOM</th>
                  <th className="py-3 px-4 text-right w-36 font-semibold">
                    {isPoExclVatActive ? 'UNIT PRICE (EXC VAT)' : 'UNIT PRICE (RP)'}
                  </th>
                  <th className="py-3 px-4 text-right w-40 font-semibold">TOTAL PRICE</th>
                  <th className="py-3 px-4 text-center w-16 font-semibold">ACTION</th>
                </tr>
              ) : (
                <tr>
                  <th className="py-3 px-4 w-12 text-center">NO</th>
                  <th className="py-3 px-4 font-semibold">ITEM DESCRIPTION</th>
                  <th className="py-3 px-4 text-right w-36 font-semibold">DPP</th>
                  <th className="py-3 px-4 text-right w-36 font-semibold">DPP lainnya</th>
                  <th className="py-3 px-4 text-right w-44 font-semibold">DPP Nilai lain Jasa cetak</th>
                  <th className="py-3 px-4 text-right w-32 font-semibold">WHT</th>
                  <th className="py-3 px-4 text-center w-16 font-semibold">ACTION</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-stone-100 font-normal">
              {calculatedStoreRows.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  className="hover:bg-stone-50/50 transition-colors"
                >
                  <td className="py-3.5 px-4 text-center text-stone-400 font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-stone-900 uppercase">
                    {row.item_description || row.store_name}
                  </td>

                  {importSource === 'po' ? (
                    <>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-stone-900">
                        {row.qty || 1}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-amber-700 bg-amber-50 rounded-md uppercase">
                        {row.uom || 'PCS'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap text-stone-900">
                        {formatRupiah(row.effectiveUnitPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap text-slate-900">
                        {formatRupiah(row.effectiveTotalPrice)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3.5 px-4 text-right font-mono font-bold whitespace-nowrap text-stone-900">
                        {formatRupiah(row.dpp)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-stone-700 whitespace-nowrap">
                        {formatRupiah(row.nilaiBarang)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-stone-700 whitespace-nowrap">
                        {formatRupiah(row.jasaCetak)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-amber-700 whitespace-nowrap">
                        {formatRupiah(row.pph23)}
                      </td>
                    </>
                  )}

                  <td className="py-3.5 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveStore(idx)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                      title="Delete Row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Total Footer Bawah Tabel */}
            {calculatedStoreRows.length > 0 && (
              <tfoot className="bg-stone-50 border-t-2 border-stone-200 text-xs text-stone-900">
                {importSource === 'po' ? (
                  <tr className="font-bold">
                    <td colSpan={5} className="py-3 px-4 text-stone-700 uppercase tracking-wider text-[11px] font-extrabold">
                      TOTAL PO EXCL. VAT:
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-stone-900 whitespace-nowrap">
                      {formatRupiah(totalPoNetOverall)}
                    </td>
                    <td></td>
                  </tr>
                ) : (
                  <>
                    <tr className="font-bold">
                      <td colSpan={2} className="py-3 px-4 text-stone-700 uppercase tracking-wider text-[11px] font-extrabold">
                        TOTAL:
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-stone-900 whitespace-nowrap">
                        {formatRupiah(totalDppOverall)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-stone-700 whitespace-nowrap">
                        {formatRupiah(totalNilaiBarangOverall)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-stone-900 whitespace-nowrap">
                        {formatRupiah(totalJasaCetakOverall)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-amber-700 whitespace-nowrap">
                        {formatRupiah(totalPph23Overall)}
                      </td>
                      <td></td>
                    </tr>

                    <tr className="font-extrabold border-t border-stone-200 bg-amber-50/40 text-stone-900">
                      <td colSpan={2} className="py-3 px-4 uppercase tracking-wider text-[11px]">
                        JASA CETAK:
                      </td>
                      <td colSpan={2}></td>
                      <td className="py-3 px-4 text-right font-mono text-stone-900 whitespace-nowrap font-extrabold text-xs">
                        {formatRupiah(totalJasaCetakOverall)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </>
                )}
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Kotak Rekapitulasi Nilai Bawah */}
      <div className="flex justify-end">
        <div className="bg-white w-full sm:w-88 p-5 rounded-2xl border border-stone-200/80 shadow-xs space-y-2.5 text-xs">
          <div className="flex justify-between items-center text-stone-600">
            <span>TOTAL:</span>
            <span className="font-mono font-bold text-stone-900">
              {formatRupiah(importSource === 'po' ? totalPoNetOverall : totalDppOverall)}
            </span>
          </div>

          {isDppActive && (
            <div className="flex justify-between items-center text-stone-600 border-t border-stone-100 pt-2">
              <span>TOTAL DPP LAIN-LAIN:</span>
              <span className="font-mono font-semibold text-stone-800">{formatRupiah(totalNilaiBarangOverall)}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-stone-600 border-t border-stone-100 pt-2">
            <span>VAT:</span>
            <span className="font-mono font-semibold text-stone-900">{formatRupiah(vatAmount)}</span>
          </div>

          {importSource !== 'po' && (
            <div className="flex justify-between items-center text-stone-600 border-t border-stone-100 pt-2">
              <span>WHT:</span>
              <span className="font-mono font-semibold text-stone-900">-{formatRupiah(totalPph23Overall)}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-sm font-bold text-stone-900 border-t border-stone-200 pt-3">
            <span>GRAND TOTAL:</span>
            <span className="font-mono font-bold text-amber-600">{formatRupiah(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
