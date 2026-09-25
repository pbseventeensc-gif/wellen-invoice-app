export function formatRupiah(number) {
  if (number == null || isNaN(number)) return 'Rp 0';
  return 'Rp ' + Math.round(number).toLocaleString('id-ID');
}

export function parseCurrencyNumber(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (!str) return 0;

  // Hapus huruf Rp / IDR / spasi / karakter non-numeric
  str = str.replace(/rp|idr/gi, '').replace(/\s+/g, '');

  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf('.') > str.lastIndexOf(',')) {
      // Format US: 1,974,874.00
      str = str.replace(/,/g, '');
    } else {
      // Format ID: 1.974.874,00
      str = str.replace(/\./g, '').replace(',', '.');
    }
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      // Titik digunakan sebagai pemisah ribuan (Format Indonesia)
      str = str.replace(/\./g, '');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      // Koma digunakan sebagai pemisah ribuan
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Perhitungan Faktur berdasarkan Total Faktur (Grand Total Asli Excel):
// 1. Total Faktur = Angka asli dari Excel
// 2. DPP = Total Faktur / 1.11
// 3. Nilai Barang = DPP * 90% (0.90)
// 4. Jasa Cetak = DPP * 10% (0.10)
// 5. WHT / PPH 23 = Jasa Cetak * 20% (0.20)
// 6. DPP Nilai Lain Barang = Nilai Barang * (11 / 12)
// 7. DPP Nilai Lain Jasa Cetak = Jasa Cetak * (11 / 12)
// 8. PPN = (DPP Nilai Lain Barang + DPP Nilai Lain Jasa Cetak) * 12%
export function calculateFakturBreakdown(totalFaktur = 0) {
  const faktur = parseCurrencyNumber(totalFaktur);
  const dpp = Math.round(faktur / 1.11);
  const nilaiBarang = Math.round(dpp * 0.90);
  const jasaCetak = Math.round(dpp * 0.10);
  const pph23 = Math.round(jasaCetak * 0.20);
  const wht = pph23;
  const dppNilaiLainBarang = Math.round(nilaiBarang * (11 / 12));
  const dppNilaiLainJasaCetak = Math.round(jasaCetak * (11 / 12));
  const ppn = Math.round((dppNilaiLainBarang + dppNilaiLainJasaCetak) * 0.12);

  return {
    totalFaktur: faktur,
    dpp,
    nilaiBarang,
    jasaCetak,
    pph23,
    wht,
    dppNilaiLainBarang,
    dppNilaiLainJasaCetak,
    ppn,
  };
}

export function calculateNetPrice(rawPrice = 0) {
  return parseCurrencyNumber(rawPrice);
}

export function calculateDpp(totalPrice = 0) {
  return Math.round(parseCurrencyNumber(totalPrice) / 1.11);
}

export function calculateInvoiceTotals(items = []) {
  let totalFaktur = 0;
  let totalDpp = 0;
  let totalNilaiBarang = 0;
  let totalJasaCetak = 0;
  let totalPph23 = 0;
  let totalDppNilaiLainBarang = 0;
  let totalDppNilaiLainJasaCetak = 0;
  let totalPpn = 0;

  const calculatedItems = items.map((item) => {
    const rawVal = parseCurrencyNumber(item.total_faktur || item.total_price || item.raw_total || item.nilai_wpp);
    const breakdown = calculateFakturBreakdown(rawVal);

    totalFaktur += breakdown.totalFaktur;
    totalDpp += breakdown.dpp;
    totalNilaiBarang += breakdown.nilaiBarang;
    totalJasaCetak += breakdown.jasaCetak;
    totalPph23 += breakdown.pph23;
    totalDppNilaiLainBarang += breakdown.dppNilaiLainBarang;
    totalDppNilaiLainJasaCetak += breakdown.dppNilaiLainJasaCetak;
    totalPpn += breakdown.ppn;

    return {
      ...item,
      total_faktur: breakdown.totalFaktur,
      total_price: breakdown.totalFaktur,
      dpp: breakdown.dpp,
      nilai_barang: breakdown.nilaiBarang,
      jasa_cetak: breakdown.jasaCetak,
      pph23: breakdown.pph23,
      wht: breakdown.wht,
      dpp_nilai_lain_barang: breakdown.dppNilaiLainBarang,
      dpp_nilai_lain_jasa_cetak: breakdown.dppNilaiLainJasaCetak,
      ppn: breakdown.ppn,
    };
  });

  return {
    items: calculatedItems,
    totalFaktur,
    totalHargaNet: totalFaktur,
    totalDpp,
    totalNilaiBarang,
    totalJasaCetak,
    totalPph23,
    totalWht: totalPph23,
    totalDppNilaiLainBarang,
    totalDppNilaiLainJasaCetak,
    totalPpn,
    grandTotal: totalFaktur,
  };
}
