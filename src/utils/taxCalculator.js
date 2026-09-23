export function formatRupiah(number) {
  if (number == null || isNaN(number)) return 'Rp 0';
  return 'Rp ' + Math.round(number).toLocaleString('id-ID');
}

// 1. Ambil nilai bersih dari bruto faktur untuk TOTAL PRICE
// Contoh: 1.810.301 -> 1.601.249 | 1.510.804 -> 1.336.338
export function calculateNetPrice(rawPrice = 0) {
  const price = Number(rawPrice) || 0;
  if (price === 0) return 0;
  return Math.round(price * (1601249 / 1810301));
}

// 2. DPP (11/12) dihitung DARI Total Price
export function calculateDpp(totalPrice = 0) {
  return Math.round((Number(totalPrice) || 0) * (11 / 12));
}

// 3. Kalkulasi invoice utuh
export function calculateInvoiceTotals(items = []) {
  let calculatedItems = [];
  let subtotalStores = 0;

  // Filter toko utama (selain Jasa Cetak)
  const storeItems = items.filter((it) => !it.isJasaCetak);

  storeItems.forEach((item) => {
    const qty = Number(item.qty) || 1;
    // Nilai ini adalah TOTAL PRICE
    const netTotalPrice = (Number(item.total_price || item.nilai_wpp || item.unit_price) || 0) * qty;
    // DPP adalah 11/12 DARI Total Price
    const dppItem = Math.round(netTotalPrice * (11 / 12));

    subtotalStores += netTotalPrice;

    calculatedItems.push({
      ...item,
      total_price: netTotalPrice,
      dpp_11_12: dppItem,
    });
  });

  // Jasa Cetak: Total Price = Subtotal / 9, DPP = Total Jasa Cetak * (11/12)
  const jasaCetakPrice = subtotalStores > 0 ? Math.round(subtotalStores / 9) : 0;
  const jasaCetakDpp = Math.round(jasaCetakPrice * (11 / 12));

  calculatedItems.push({
    id: 'row-jasa-cetak',
    item_description: 'JASA CETAK',
    total_price: jasaCetakPrice,
    dpp_11_12: jasaCetakDpp,
    isJasaCetak: true,
  });

  const totalOverall = calculatedItems.reduce((acc, it) => acc + it.total_price, 0);
  const totalDppLain = calculatedItems.reduce((acc, it) => acc + it.dpp_11_12, 0);
  const vatAmount = Math.round(totalOverall * 0.11);
  const grandTotal = totalOverall + vatAmount;

  return {
    items: calculatedItems,
    totalHargaNet: totalOverall,
    dppLain: totalDppLain,
    ppnAmount: vatAmount,
    grandTotal: grandTotal,
  };
}