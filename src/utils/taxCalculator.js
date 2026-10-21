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

export function parseExcelDate(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const str = String(val).trim();
  const months = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    agt: '08', agu: '08', mei: '05', okt: '10', des: '12', nop: '11'
  };
  const parts = str.split(/[-/ ]+/);
  if (parts.length === 3) {
    let day = parts[0].padStart(2, '0');
    let m = parts[1].toLowerCase().slice(0, 3);
    let month = months[m] || parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) year = '20' + year;
    if (parts[0].length === 4) {
      year = parts[0];
      day = parts[2].padStart(2, '0');
    }
    return `${year}-${month}-${day}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return '';
}

// Perhitungan Faktur berdasarkan Total Faktur (Grand Total Asli Excel):
// 1. Total Faktur = Angka asli dari Excel
// 2. DPP = Total Faktur / 1.11
// 3. Nilai Barang = DPP * 90% (0.90)
// 4. Jasa Cetak = DPP * 10% (0.10)
// 5. WHT / PPH 23 = DPP * 2% (0.02)
// 6. DPP Nilai Lain Barang = DPP * (11 / 12)
// 7. DPP Nilai Lain Jasa Cetak = Jasa Cetak * (11 / 12)
// 8. PPN = DPP * 11% (atau Total DPP Nilai Lain * 12%)
export function calculateFakturBreakdown(totalFaktur = 0) {
  const faktur = parseCurrencyNumber(totalFaktur);
  const dpp = Math.round(faktur / 1.11);
  const nilaiBarang = Math.round(dpp * 0.90);
  const jasaCetak = Math.round(dpp * 0.10);
  const pph23 = Math.round(dpp * 0.02);
  const wht = pph23;
  const dppNilaiLainBarang = Math.round(dpp * (11 / 12));
  const dppNilaiLainJasaCetak = Math.round(jasaCetak * (11 / 12));
  const ppn = Math.round(dpp * 0.11);

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

    const dpp = item.dpp !== undefined && Number(item.dpp) > 0 ? Number(item.dpp) : breakdown.dpp;
    const nilaiBarang = item.nilai_barang !== undefined && Number(item.nilai_barang) > 0 ? Number(item.nilai_barang) : breakdown.nilaiBarang;
    const jasaCetak = item.jasa_cetak !== undefined && Number(item.jasa_cetak) > 0 ? Number(item.jasa_cetak) : breakdown.jasaCetak;
    const pph23 = item.pph23 !== undefined && Number(item.pph23) > 0 ? Number(item.pph23) : (item.wht !== undefined && Number(item.wht) > 0 ? Number(item.wht) : breakdown.pph23);
    const wht = pph23;
    const dppNilaiLainBarang = item.dpp_nilai_lain_barang !== undefined && Number(item.dpp_nilai_lain_barang) > 0 ? Number(item.dpp_nilai_lain_barang) : breakdown.dppNilaiLainBarang;
    const dppNilaiLainJasaCetak = item.dpp_nilai_lain_jasa_cetak !== undefined && Number(item.dpp_nilai_lain_jasa_cetak) > 0 ? Number(item.dpp_nilai_lain_jasa_cetak) : breakdown.dppNilaiLainJasaCetak;
    const ppn = item.ppn !== undefined && Number(item.ppn) > 0 ? Number(item.ppn) : breakdown.ppn;
    const totalFakturRow = item.total_faktur !== undefined && Number(item.total_faktur) > 0 ? Number(item.total_faktur) : breakdown.totalFaktur;

    totalFaktur += totalFakturRow;
    totalDpp += dpp;
    totalNilaiBarang += nilaiBarang;
    totalJasaCetak += jasaCetak;
    totalPph23 += pph23;
    totalDppNilaiLainBarang += dppNilaiLainBarang;
    totalDppNilaiLainJasaCetak += dppNilaiLainJasaCetak;
    totalPpn += ppn;

    return {
      ...item,
      total_faktur: totalFakturRow,
      total_price: totalFakturRow,
      dpp,
      nilai_barang: nilaiBarang,
      jasa_cetak: jasaCetak,
      pph23,
      wht,
      dpp_nilai_lain_barang: dppNilaiLainBarang,
      dpp_nilai_lain_jasa_cetak: dppNilaiLainJasaCetak,
      ppn,
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
