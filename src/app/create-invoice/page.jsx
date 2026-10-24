'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Trash2 } from 'lucide-react';
import { calculateFakturBreakdown, formatRupiah, parseExcelDate } from '@/utils/taxCalculator';
import { supabase } from '@/lib/supabase';
import { submitInvoiceWorkflow } from '@/utils/invoiceWorkflow';
import FeedbackDialog from '@/components/ui/FeedbackDialog';

export default function CreateInvoicePage() {
  const router = useRouter();

  const getInitialStagedData = () => {
    if (typeof window === 'undefined') return null;
    try {
      const storedSource = sessionStorage.getItem('wellen_import_source');
      const staged = sessionStorage.getItem('wellen_staged_items');

      if (staged !== null) {
        const parsed = JSON.parse(staged);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isPo = storedSource === 'po' || parsed.some((s) => s.isPoSource || s.importType === 'po' || (s.uom && s.uom !== 'PCS'));
          const storedPoPpnSetting = sessionStorage.getItem('wellen_po_prices_include_ppn');
          const poPricesIncludePpn = typeof parsed[0]?.po_prices_include_ppn === 'boolean'
            ? parsed[0].po_prices_include_ppn
            : storedPoPpnSetting === 'true';

          let fakturNo = '';
          if (parsed[0]?.no_faktur || parsed[0]?.wpp_number) {
            fakturNo = String(parsed[0].no_faktur || parsed[0].wpp_number);
            if (fakturNo.toUpperCase().includes('WPP')) {
              fakturNo = fakturNo.replace(/WPP/gi, 'WPK');
            }
          }

          const validStores = parsed.map((s, idx) => {
            const rawTotalFaktur = Number(s.total_faktur || s.total_price || s.raw_total || s.nilai_wpp || 0);
            const breakdown = calculateFakturBreakdown(
              isPo ? rawTotalFaktur * (poPricesIncludePpn ? 1 : 1.11) : rawTotalFaktur
            );
            const isJasa = (s.item_description || s.store_name || '').toUpperCase().trim() === 'JASA CETAK';

            const dpp = s.dpp !== undefined && Number(s.dpp) > 0 ? Number(s.dpp) : breakdown.dpp;
            const nilaiBarang = s.nilai_barang !== undefined && Number(s.nilai_barang) > 0 ? Number(s.nilai_barang) : breakdown.nilaiBarang;
            const jasaCetak = s.jasa_cetak !== undefined && Number(s.jasa_cetak) > 0 ? Number(s.jasa_cetak) : breakdown.jasaCetak;
            const pph23 = s.pph23 !== undefined && Number(s.pph23) > 0 ? Number(s.pph23) : (s.wht !== undefined && Number(s.wht) > 0 ? Number(s.wht) : breakdown.pph23);
            const wht = s.wht !== undefined && Number(s.wht) > 0 ? Number(s.wht) : pph23;
            const dppNilaiLainBarang = s.dpp_nilai_lain_barang !== undefined && Number(s.dpp_nilai_lain_barang) > 0 ? Number(s.dpp_nilai_lain_barang) : breakdown.dppNilaiLainBarang;
            const dppNilaiLainJasaCetak = s.dpp_nilai_lain_jasa_cetak !== undefined && Number(s.dpp_nilai_lain_jasa_cetak) > 0 ? Number(s.dpp_nilai_lain_jasa_cetak) : breakdown.dppNilaiLainJasaCetak;
            const ppn = s.ppn !== undefined && Number(s.ppn) > 0 ? Number(s.ppn) : breakdown.ppn;
            const totalFakturRow = rawTotalFaktur || (dpp + ppn);

            return {
              ...s,
              id: s.id || `store-${idx}-${idx}`,
              total_faktur: totalFakturRow,
              dpp,
              nilai_barang: nilaiBarang,
              jasa_cetak: jasaCetak,
              pph23,
              wht,
              dpp_nilai_lain_barang: dppNilaiLainBarang,
              dpp_nilai_lain_jasa_cetak: dppNilaiLainJasaCetak,
              ppn,
              qty: Number(s.qty) || 1,
              uom: s.uom || 'PCS',
              unit_price: Number(s.unit_price) || totalFakturRow,
              isJasaCetak: isJasa,
            };
          });

          let initialDate = '';
          if (parsed[0]?.invoice_date) {
            initialDate = parseExcelDate(parsed[0].invoice_date) || parsed[0].invoice_date;
          } else if (parsed[0]?.import_date) {
            initialDate = parseExcelDate(parsed[0].import_date) || parsed[0].import_date;
          }

          return {
            isPo,
            poPricesIncludePpn,
            clientName: parsed[0]?.client_name || '',
            promoName: parsed[0]?.promo_name || '',
            fakturNo,
            invoiceDate: initialDate,
            stores: validStores,
          };
        }
      }
    } catch (e) {
      console.error('Failed to read staged data:', e);
    }
    return null;
  };

  // Initial state null/default (sama di server & client) untuk mencegah hydration mismatch.
  // Data staging dari sessionStorage dimuat di useEffect setelah mount (lihat di bawah).
  const [initialData, setInitialData] = useState(null);

  // Form State
  const [wppNumber, setWppNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [createdByName, setCreatedByName] = useState('FAHADA');
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [promoName, setPromoName] = useState('');
  const [isDppActive, setIsDppActive] = useState(false);

  // Toggle ON/OFF Rincian Tax Breakdown di Invoice Cetak/Validation
  const [showTaxBreakdownInPrint, setShowTaxBreakdownInPrint] = useState(false);

  // Parameter Mode Import PO
  const [isPoExclVatActive, setIsPoExclVatActive] = useState(false);
  const [showJasaCetakPo, setShowJasaCetakPo] = useState(true);

  // Sumber Import Mode: 'excel' vs 'po'
  const [importSource, setImportSource] = useState('excel');

  // State Item Toko Murni
  const [stores, setStores] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [isInitialized, setIsInitialized] = useState(true);
  const [isFahadaLocked, setIsFahadaLocked] = useState(false);

  // Muat data staging dari sessionStorage setelah mount (bukan di initial state) agar tidak terjadi hydration mismatch.
  useEffect(() => {
    const data = getInitialStagedData();
    if (!data) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setInitialData(data);
    setWppNumber(data.fakturNo || '');
    if (data.invoiceDate) setInvoiceDate(data.invoiceDate);
    setClientName(data.clientName || '');
    setPromoName(data.promoName || '');
    setImportSource(data.isPo ? 'po' : 'excel');
    setIsPoExclVatActive(data.isPo && data.poPricesIncludePpn);
    setStores(data.stores || []);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Auto detect AR Staff Name from Supabase User Email
  useEffect(() => {
    let isMounted = true;
    const loadArUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const activeEmail = (user?.email || '').toLowerCase();

        if (activeEmail && isMounted) {
          if (activeEmail.includes('keyjia')) {
            setCreatedByName('KEYJIA');
            setIsFahadaLocked(false);
          } else if (activeEmail.includes('fahada')) {
            setCreatedByName('FAHADA');
            setIsFahadaLocked(true);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadArUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRemoveStore = (indexToRemove) => {
    const updated = stores.filter((_, idx) => idx !== indexToRemove);
    setStores(updated);
    try {
      sessionStorage.setItem('wellen_staged_items', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to update session storage:', e);
    }
  };

  const filteredStoresByJasa = stores.filter((row) => {
    if (importSource === 'po' && !showJasaCetakPo) {
      const desc = String(row.item_description || row.store_name || '').toUpperCase().trim();
      return desc !== 'JASA CETAK';
    }
    return true;
  });

  const calculatedStoreRows = filteredStoresByJasa.map((row) => {
    const rawUnitPrice = Number(row.unit_price || row.total_faktur || row.total_price || 0);
    const qty = Number(row.qty) || 1;

    let effectiveUnitPrice = rawUnitPrice;
    if (importSource === 'po' && isPoExclVatActive) {
      effectiveUnitPrice = Math.round(rawUnitPrice / 1.11);
    }

    const effectiveTotalPrice = Math.round(qty * effectiveUnitPrice);
    const breakdown = calculateFakturBreakdown(
      importSource === 'po' ? effectiveTotalPrice * 1.11 : effectiveTotalPrice
    );

    const dpp = row.dpp !== undefined && Number(row.dpp) > 0 ? Number(row.dpp) : breakdown.dpp;
    const nilaiBarang = row.nilai_barang !== undefined && Number(row.nilai_barang) > 0 ? Number(row.nilai_barang) : breakdown.nilaiBarang;
    const jasaCetak = row.jasa_cetak !== undefined && Number(row.jasa_cetak) > 0 ? Number(row.jasa_cetak) : breakdown.jasaCetak;
    const pph23 = row.pph23 !== undefined && Number(row.pph23) > 0 ? Number(row.pph23) : (row.wht !== undefined && Number(row.wht) > 0 ? Number(row.wht) : breakdown.pph23);
    const wht = pph23;
    const dppNilaiLainBarang = row.dpp_nilai_lain_barang !== undefined && Number(row.dpp_nilai_lain_barang) > 0 ? Number(row.dpp_nilai_lain_barang) : breakdown.dppNilaiLainBarang;
    const dppNilaiLainJasaCetak = row.dpp_nilai_lain_jasa_cetak !== undefined && Number(row.dpp_nilai_lain_jasa_cetak) > 0 ? Number(row.dpp_nilai_lain_jasa_cetak) : breakdown.dppNilaiLainJasaCetak;
    const ppn = row.ppn !== undefined && Number(row.ppn) > 0 ? Number(row.ppn) : breakdown.ppn;

    return {
      ...row,
      effectiveUnitPrice,
      effectiveTotalPrice,
      dpp,
      nilaiBarang,
      jasaCetak,
      pph23,
      wht,
      dppNilaiLainBarang,
      dppNilaiLainJasaCetak,
      ppn,
    };
  });

  const jasaCetakStores = stores.filter((row) => {
    const desc = String(row.item_description || row.store_name || '').toUpperCase().trim();
    return desc === 'JASA CETAK';
  });

  const totalJasaCetakPoOverall = jasaCetakStores.reduce((acc, row) => {
    const p = isPoExclVatActive ? Math.round(Number(row.unit_price || 0) / 1.11) : Number(row.unit_price || 0);
    return acc + Math.round((Number(row.qty) || 1) * p);
  }, 0);

  const totalDppOverall = calculatedStoreRows.reduce((acc, row) => acc + row.dpp, 0);
  const totalNilaiBarangOverall = calculatedStoreRows.reduce((acc, row) => acc + row.nilaiBarang, 0);
  const totalJasaCetakOverall = calculatedStoreRows.reduce((acc, row) => acc + row.jasaCetak, 0);
  const totalPph23Overall = calculatedStoreRows.reduce((acc, row) => acc + row.pph23, 0);
  const totalDppNilaiLainBarangOverall = calculatedStoreRows.reduce((acc, row) => acc + row.dppNilaiLainBarang, 0);
  const totalDppNilaiLainJasaCetakOverall = calculatedStoreRows.reduce((acc, row) => acc + row.dppNilaiLainJasaCetak, 0);
  const totalDppNilaiLainOverall = totalDppNilaiLainBarangOverall + totalDppNilaiLainJasaCetakOverall;

  const totalPoNetOverall = calculatedStoreRows.reduce((acc, row) => acc + row.effectiveTotalPrice, 0);

  const vatAmount = importSource === 'po'
    ? Math.round(totalPoNetOverall * 0.11)
    : (calculatedStoreRows.reduce((acc, row) => acc + (row.ppn || 0), 0) || Math.round(totalDppOverall * 0.11));

  const grandTotal = importSource === 'po'
    ? totalPoNetOverall + vatAmount
    : (totalDppOverall + vatAmount);

  const handleSubmitApproval = async () => {
    if (stores.length === 0) {
      setFeedback({
        variant: 'error',
        title: 'No invoice items',
        description: 'Add at least one store item before submitting this invoice.',
      });
      return;
    }

    const cleanWpkNumber = (wppNumber || '').trim();
    if (!cleanWpkNumber) {
      setFeedback({
        variant: 'error',
        title: 'WPK number required',
        description: 'Enter a valid WPK number before submitting the invoice.',
      });
      return;
    }

    if (!invoiceDate) {
      setFeedback({
        variant: 'error',
        title: 'Invoice date required',
        description: 'Select an invoice date before submitting the invoice.',
      });
      return;
    }

    const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'sub';
    const payload = {
      id: `wpk-${uniqueId}`,
      invoice_number: cleanWpkNumber,
      invoice_date: invoiceDate,
      client_name: clientName,
      client_address: clientAddress,
      promo_name: promoName,
      created_by: createdByName,
      ar_name: createdByName,
      is_dpp_active: isDppActive,
      show_tax_breakdown_in_print: showTaxBreakdownInPrint,
      is_po_excl_vat_active: isPoExclVatActive,
      po_prices_include_ppn: isPoExclVatActive,
      show_jasa_cetak_po: showJasaCetakPo,
      total_faktur: totalPoNetOverall,
      total_harga_net: totalPoNetOverall,
      subtotal_net: totalPoNetOverall,
      total_dpp: totalDppOverall,
      total_dpp_lainnya: totalDppNilaiLainOverall,
      total_jasa_cetak: importSource === 'po' ? totalJasaCetakPoOverall : totalJasaCetakOverall,
      total_pph23: importSource === 'po' ? 0 : totalPph23Overall,
      dpp_lain: totalDppNilaiLainOverall,
      ppn_amount: vatAmount,
      grand_total: grandTotal,
      time_created: new Date().toISOString().slice(0, 16).replace('T', ' '),
      status: 'waiting_approval',
      importSource: importSource,
      items: calculatedStoreRows.map((it) => ({
        id: it.id,
        source_no_wpp: it.source_no_wpp || it.wpp_number || it.no_faktur || '',
        no_faktur: cleanWpkNumber || it.no_faktur,
        wpp_number: cleanWpkNumber || it.wpp_number,
        item_description: it.item_description || it.store_name,
        total_faktur: importSource === 'po' ? it.effectiveTotalPrice : it.effectiveTotalPrice || it.dpp,

        dpp: it.dpp,
        total_price: Number(it.nilaiBarang || it.nilai_barang || it.total_faktur || 0),
        nilai_barang: Number(it.nilaiBarang || it.nilai_barang || 0),
        jasa_cetak: it.jasaCetak,
        pph23: it.pph23,
        wht: it.wht || it.pph23,
        dpp_nilai_lain_barang: it.dppNilaiLainBarang,
        dpp_nilai_lain_jasa_cetak: it.dppNilaiLainJasaCetak,
        ppn: it.ppn,
        qty: it.qty || 1,
        uom: it.uom || 'PCS',
        unit_price: importSource === 'po' ? it.effectiveUnitPrice : it.effectiveUnitPrice || it.dpp,
        isJasaCetak: it.isJasaCetak || false,
      })),
    };

    try {
      await submitInvoiceWorkflow(payload);
    } catch (error) {
      console.error('Failed to submit invoice to the approval workflow:', error);
      setFeedback({
        variant: 'error',
        title: 'Invoice could not be submitted',
        description: 'The invoice was not saved to the shared approval queue. Verify your access and connection, then try again.',
      });
      return;
    }

    try {
      const existingStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
      const submittedIds = new Set(payload.items.map((it) => it.id));
      const submittedFakturs = new Set([
        cleanWpkNumber.toLowerCase(),
        ...payload.items.map((it) => (it.no_faktur || it.wpp_number || '').toLowerCase().trim()),
      ]);
      if (initialData?.fakturNo) {
        submittedFakturs.add(initialData.fakturNo.toLowerCase().trim());
      }

      const updatedStaging = existingStaging.map((item) => {
        const itemId = item.id;
        const itemFaktur = (item.no_faktur || item.wpp_number || '').toLowerCase().trim();
        if (submittedIds.has(itemId) || submittedFakturs.has(itemFaktur)) {
          return { ...item, status: 'waiting_approval' };
        }
        return item;
      });
      localStorage.setItem('wellen_wpp_staging', JSON.stringify(updatedStaging));
    } catch (e) {
      console.error('Failed to update staging status:', e);
    }

    sessionStorage.removeItem('wellen_staged_items');
    window.dispatchEvent(new Event('wellen-invoice-workflows'));

    setFeedback({
      variant: 'success',
      title: 'Invoice submitted',
      description: `Invoice ${cleanWpkNumber} was added to the approval queue successfully.`,
      confirmLabel: 'View approval queue',
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24">
      {/* Header Halaman */}
      <div className="flex items-center justify-between pb-2 border-b border-stone-200/80">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Back to previous page"
            onClick={() => router.back()}
            className="p-2 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors cursor-pointer text-stone-700 shadow-2xs"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Invoice Creation Form</h1>
            <p className="text-xs text-stone-500 mt-0.5 font-normal">
              Review document details, store items, and breakdown figures before submitting for approval.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmitApproval}
          disabled={stores.length === 0}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-2xs transition-colors cursor-pointer"
        >
          <Send size={14} />
          <span>Submit for Approval</span>
        </button>
      </div>

      {/* Baris Identitas Faktur */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
          <p className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">Document Identity</p>
          <div>
            <label htmlFor="wpk-number" className="text-[11px] font-semibold text-stone-600 block mb-1">WPK Number (Editable)</label>
            <input
              id="wpk-number"
              name="wpkNumber"
              type="text"
              value={wppNumber}
              onChange={(e) => setWppNumber(e.target.value)}
              placeholder="e.g. WPK 0826-300006"
              className="w-full text-xs font-mono font-bold px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 text-stone-800"
            />
          </div>
          <div>
            <label htmlFor="invoice-date" className="text-[11px] font-semibold text-stone-600 block mb-1">Invoice Date (Editable)</label>
            <input
              id="invoice-date"
              name="invoiceDate"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 text-stone-800 font-mono cursor-pointer"
            />
          </div>
          <div>
            <label htmlFor="created-by" className="text-[11px] font-semibold text-stone-600 block mb-1">Created By (AR Staff)</label>
            <select
              id="created-by"
              name="createdByName"
              value={createdByName}
              onChange={(e) => setCreatedByName(e.target.value)}
              disabled={isFahadaLocked}
              className={`w-full text-xs font-semibold px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 text-stone-900 ${
                isFahadaLocked ? 'opacity-80 bg-stone-100 cursor-not-allowed select-none' : 'cursor-pointer'
              }`}
            >
              <option value="FAHADA">FAHADA (fahadahanifah@gmail.com)</option>
              <option value="KEYJIA">KEYJIA (nuralkeyjia987@gmail.com)</option>
            </select>
            {isFahadaLocked && (
              <p className="text-[10px] text-stone-500 mt-1 italic">Locked (Logged in as FAHADA)</p>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
          <p className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">Bill to (Client)</p>
          <div>
            <label htmlFor="client-name" className="text-[11px] font-semibold text-stone-600 block mb-1">Client Name (PT)</label>
            <input
              id="client-name"
              name="clientName"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 text-stone-900 uppercase"
            />
          </div>
          <div>
            <label htmlFor="client-address" className="text-[11px] font-semibold text-stone-600 block mb-1">Address & Contact</label>
            <textarea
              id="client-address"
              name="clientAddress"
              rows={3}
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 text-stone-700 leading-relaxed resize-none uppercase"
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
          <p className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">Project Parameters</p>
          <div>
            <label htmlFor="promo-name" className="text-[11px] font-semibold text-stone-600 block mb-1">Promo / Material Name</label>
            <input
              id="promo-name"
              name="promoName"
              type="text"
              value={promoName}
              onChange={(e) => setPromoName(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 text-stone-900 uppercase"
            />
          </div>

          <div className="pt-2 border-t border-stone-100 space-y-3">
            {importSource === 'po' ? (
              <>
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

                <div>
                  <label className="text-[11px] font-medium text-stone-600 block mb-1">
                    Harga PO sudah termasuk PPN? :
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
                      <span>Include PPN</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="poExclVatOption"
                        checked={isPoExclVatActive === false}
                        onChange={() => setIsPoExclVatActive(false)}
                        className="accent-amber-500 w-4 h-4"
                      />
                      <span>Exclude PPN</span>
                    </label>
                  </div>
                </div>
              </>
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
      </div>

      {/* Tabel Rincian Barang / Jasa */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
            Item Breakdown Details {importSource === 'po' ? '(Client PO Mode)' : '(POS Excel Mode)'}
          </h2>
          <span className="text-xs text-stone-400 font-normal">Line Count: {calculatedStoreRows.length} Items</span>
        </div>

        <div className="data-table-scroll">
          <table className="data-table w-full text-left text-xs border-collapse">
            <thead className="bg-stone-50 text-stone-500 uppercase text-[10px] font-semibold border-b border-stone-200 tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center font-semibold">NO</th>
                <th className="py-3 px-3 font-semibold">ITEM DESCRIPTION</th>
                <th className="py-3 px-3 text-right w-32 font-semibold">TOTAL PRICE</th>
                <th className="py-3 px-3 text-right w-28 font-semibold">DPP</th>
                <th className="py-3 px-3 text-right w-28 font-semibold">NILAI BARANG</th>
                <th className="py-3 px-3 text-right w-28 font-semibold">JASA CETAK</th>
                <th className="py-3 px-3 text-right w-24 font-semibold">WHT</th>
                <th className="py-3 px-3 text-right w-32 font-semibold">DPP NILAI LAIN BARANG</th>
                <th className="py-3 px-3 text-right w-32 font-semibold">DPP NILAI LAIN JASA CETAK</th>
                <th className="py-3 px-3 text-right w-28 font-semibold">PPN</th>
                <th className="py-3 px-3 text-center w-14 font-semibold">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-normal">
              {calculatedStoreRows.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  className="hover:bg-stone-50/50 transition-colors font-normal"
                >
                  <td className="py-3 px-3 text-center text-stone-400 font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3 font-semibold text-stone-900 uppercase">
                    {row.item_description || row.store_name}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap text-stone-900">
                    {formatRupiah(row.effectiveTotalPrice)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap font-normal">
                    {formatRupiah(row.dpp)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap font-normal">
                    {formatRupiah(row.nilaiBarang)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap font-normal">
                    {formatRupiah(row.jasaCetak)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-amber-700 whitespace-nowrap">
                    {formatRupiah(row.pph23)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap font-normal">
                    {formatRupiah(row.dppNilaiLainBarang)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap font-normal">
                    {formatRupiah(row.dppNilaiLainJasaCetak)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-stone-700 font-bold whitespace-nowrap">
                    {formatRupiah(row.ppn)}
                  </td>
                  <td className="py-3 px-3 text-center">
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
              <tfoot className="bg-stone-50 border-t-2 border-stone-200 text-xs text-stone-900 font-normal">
                <tr className="font-bold">
                  <td colSpan={2} className="py-3 px-3 text-stone-700 uppercase tracking-wider text-[11px] font-extrabold">
                    TOTAL ({calculatedStoreRows.length} ITEMS):
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-extrabold text-stone-900 whitespace-nowrap">
                    {formatRupiah(totalPoNetOverall)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-stone-800 whitespace-nowrap">
                    {formatRupiah(totalDppOverall)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap font-normal">
                    {formatRupiah(totalNilaiBarangOverall)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-extrabold text-stone-900 whitespace-nowrap">
                    {formatRupiah(totalJasaCetakOverall)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-amber-700 whitespace-nowrap">
                    {formatRupiah(totalPph23Overall)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap font-normal">
                    {formatRupiah(totalDppNilaiLainBarangOverall)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-stone-700 whitespace-nowrap font-normal">
                    {formatRupiah(totalDppNilaiLainJasaCetakOverall)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-extrabold text-stone-800 whitespace-nowrap">
                    {formatRupiah(vatAmount)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Kotak Rekapitulasi Nilai Bawah */}
      <div className="flex justify-end">
        <div className="bg-white w-full sm:w-88 p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-2.5 text-xs">
          <div className="flex justify-between items-center text-stone-600 font-normal">
            <span>TOTAL:</span>
            <span className="font-mono font-bold text-stone-900">
              {formatRupiah(totalPoNetOverall)}
            </span>
          </div>

          {isDppActive && (
            <div className="flex justify-between items-center text-stone-600 border-t border-stone-100 pt-2 font-normal">
              <span>DPP NILAI LAIN:</span>
              <span className="font-mono font-semibold text-stone-800">{formatRupiah(totalDppNilaiLainOverall)}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-stone-600 border-t border-stone-100 pt-2 font-normal">
            <span>VAT:</span>
            <span className="font-mono font-semibold text-stone-900">{formatRupiah(vatAmount)}</span>
          </div>

          {importSource !== 'po' && (
            <div className="flex justify-between items-center text-stone-600 border-t border-stone-100 pt-2 font-normal">
              <span>WHT:</span>
              <span className="font-mono font-semibold text-stone-900">-{formatRupiah(totalPph23Overall)}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-sm font-bold text-stone-900 border-t border-stone-200 pt-3">
            <span>GRAND TOTAL:</span>
            <span className="font-mono font-bold text-stone-900">{formatRupiah(grandTotal)}</span>
          </div>
        </div>
      </div>
      <FeedbackDialog
        open={Boolean(feedback)}
        variant={feedback?.variant}
        title={feedback?.title}
        description={feedback?.description}
        confirmLabel={feedback?.confirmLabel}
        onAction={() => {
          if (feedback?.variant === 'success') {
            router.push('/approval');
          } else {
            setFeedback(null);
          }
        }}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}
