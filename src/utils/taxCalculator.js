export function formatRupiah(number) {
  if (number == null || isNaN(number)) return 'Rp 0';
  return 'Rp ' + Math.round(number).toLocaleString('id-ID');
}

// Perhitungan Faktur Baru berdasarkan Total Faktur Asli Excel:
// 1. Total Faktur: angka asli dari excel
// 2. DPP = Total Faktur * 0.9 (90%)
// 3. Jasa Cetak = Total Faktur * 0.1 (10%)
// 4. PPH 23 = Jasa Cetak * 0.2
export function calculateFakturBreakdown(totalFaktur = 0) {
  const faktur = Number(totalFaktur) || 0;
  const dpp = Math.round(faktur * 0.9);
  const jasaCetak = Math.round(faktur * 0.1);
  const pph23 = Math.round(jasaCetak * 0.2);

  return {
    totalFaktur: faktur,
    dpp,
    jasaCetak,
    pph23,
  };
}

// Deprecated calculation helpers retained for backward compatibility
export function calculateNetPrice(rawPrice = 0) {
  return Number(rawPrice) || 0;
}

export function calculateDpp(totalPrice = 0) {
  return Math.round((Number(totalPrice) || 0) * 0.9);
}

export function calculateInvoiceTotals(items = []) {
  let totalFaktur = 0;
  let totalDpp = 0;
  let totalJasaCetak = 0;
  let totalPph23 = 0;

  const calculatedItems = items.map((item) => {
    const rawVal = Number(item.total_faktur || item.total_price || item.raw_total || item.nilai_wpp) || 0;
    const breakdown = calculateFakturBreakdown(rawVal);

    totalFaktur += breakdown.totalFaktur;
    totalDpp += breakdown.dpp;
    totalJasaCetak += breakdown.jasaCetak;
    totalPph23 += breakdown.pph23;

    return {
      ...item,
      total_faktur: breakdown.totalFaktur,
      total_price: breakdown.totalFaktur,
      dpp: breakdown.dpp,
      jasa_cetak: breakdown.jasaCetak,
      pph23: breakdown.pph23,
    };
  });

  return {
    items: calculatedItems,
    totalFaktur,
    totalHargaNet: totalFaktur,
    totalDpp,
    totalJasaCetak,
    totalPph23,
    grandTotal: totalFaktur,
  };
}
