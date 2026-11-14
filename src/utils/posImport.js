import { calculateFakturBreakdown, parseCurrencyNumber, parseExcelDate } from './taxCalculator.js';

export function parsePosRows(rawJson, importedAt = new Date().toISOString()) {
  let commonPromoName = '';
  let commonClientName = '';
  let dupCounter = 0;

  const currentTimestamp = importedAt;
  const batchId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const importedKeys = new Set();

  const parsedData = rawJson
    .filter((row) => Object.values(row).join('').trim().length > 0)
    .map((row, index) => {
      const clean = {};
      Object.keys(row).forEach((k) => {
        clean[k.trim().toLowerCase()] = row[k];
      });

      const noFaktur = String(
        clean['no faktur'] || clean['faktur'] || clean['no wpp'] || clean['wpp'] || clean['nomor faktur'] || ''
      ).trim();

      if (!noFaktur) throw new Error(`Data row ${index + 1}: WPP / invoice number is missing.`);

      const customer = clean['customer ant'] || clean['client name'] || clean['customer name'] || clean['nama klien'] || clean['nama pelanggan'] || clean['nama customer'] || clean['customer'] || clean['klien'] || clean['nama pt'] || clean['pt'] || '';
      if (customer && !commonClientName) {
        commonClientName = String(customer).trim();
      }

      const clientAddress = String(clean['client address'] || clean['client_address'] || clean['billing_address'] || clean['alamat penagihan'] || clean['customer address'] || clean['billing address'] || clean['alamat klien'] || clean['alamat customer'] || clean['alamat pelanggan'] || clean['alamat pt'] || clean['address'] || clean['alamat'] || '').trim();

      const rawKeterangan = String(clean['keterangan'] || clean['deskripsi'] || clean['item description'] || '').trim();
      let fileNamePromo = rawKeterangan;
      let storeName = rawKeterangan;

      if (rawKeterangan.includes(' - ')) {
        const parts = rawKeterangan.split(' - ');
        const promoIndex = parts.findIndex((part) => /^promo\b/i.test(part.trim()));
        // Recognize store-first descriptions by the PROMO prefix; otherwise keep the legacy order.
        if (promoIndex > 0) {
          storeName = parts.slice(0, promoIndex).join(' - ').trim();
          fileNamePromo = parts.slice(promoIndex).join(' - ').trim();
        } else {
          fileNamePromo = parts[0].trim();
          storeName = parts.slice(1).join(' - ').trim();
        }
      }

      if (fileNamePromo && !commonPromoName) {
        commonPromoName = fileNamePromo;
      }

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

      const rawDpp = clean['dpp'] ?? clean['nilai dpp'] ?? clean['dpp total'];
      const rawNilaiBarang = clean['nilai barang'] ?? clean['barang'] ?? clean['nilai_barang'];
      const rawJasaCetak = clean['jasa cetak'] ?? clean['jasa_cetak'] ?? clean['jasa'];
      const rawWht = clean['wht'] ?? clean['pph 23'] ?? clean['pph23'] ?? clean['pph_23'] ?? clean['withholding tax'];
      const rawDppLainBarang = clean['dpp nilai lain barang'] ?? clean['dpp nilai lain (barang)'] ?? clean['dpp nilai lain - barang'] ?? clean['dpp nilai lain b'] ?? clean['dpp nilai lain'];
      const rawDppLainJasa = clean['dpp nilai lain jasa cetak'] ?? clean['dpp nilai lain (jasa cetak)'] ?? clean['dpp nilai lain jasa'] ?? clean['dpp nilai lain j'];
      const rawPpn = clean['ppn'] ?? clean['vat'] ?? clean['ppn 11%'] ?? clean['ppn 12%'] ?? clean['nilai ppn'];
      const rawTanggal = clean['tanggal'] ?? clean['tgl'] ?? clean['date'] ?? clean['tgl faktur'] ?? clean['tgl_faktur'];

      const parsedDate = parseExcelDate(rawTanggal);
      const rowDate = parsedDate || currentTimestamp.slice(0, 10);

      if (rawTotalVal === undefined || rawTotalVal === '' || rawTotalVal === null) {
        if (rawDpp !== undefined && parseCurrencyNumber(rawDpp) > 0) {
          const parsedDpp = parseCurrencyNumber(rawDpp);
          const parsedPpn = rawPpn !== undefined ? parseCurrencyNumber(rawPpn) : Math.round(parsedDpp * 0.11);
          rawTotalVal = parsedDpp + parsedPpn;

        }
      }

      if (rawTotalVal == null || rawTotalVal === '') throw new Error(`Data row ${index + 1}: the total column is missing or empty.`);
      if (!/\d/.test(String(rawTotalVal))) throw new Error(`Data row ${index + 1}: the total is invalid.`);
      const rawTotalFaktur = parseCurrencyNumber(rawTotalVal);
      if (!Number.isFinite(rawTotalFaktur) || rawTotalFaktur < 0) throw new Error(`Data row ${index + 1}: the total is invalid.`);
      const breakdown = calculateFakturBreakdown(rawTotalFaktur);

      const hasExplicitDpp = rawDpp !== undefined && rawDpp !== '' && rawDpp !== null;
      const hasExplicitNilaiBarang = rawNilaiBarang !== undefined && rawNilaiBarang !== '' && rawNilaiBarang !== null;
      const hasExplicitJasaCetak = rawJasaCetak !== undefined && rawJasaCetak !== '' && rawJasaCetak !== null;
      const hasExplicitWht = rawWht !== undefined && rawWht !== '' && rawWht !== null;
      const hasExplicitDppLainBarang = rawDppLainBarang !== undefined && rawDppLainBarang !== '' && rawDppLainBarang !== null;
      const hasExplicitDppLainJasa = rawDppLainJasa !== undefined && rawDppLainJasa !== '' && rawDppLainJasa !== null;
      const hasExplicitPpn = rawPpn !== undefined && rawPpn !== '' && rawPpn !== null;

      const finalDpp = hasExplicitDpp ? parseCurrencyNumber(rawDpp) : breakdown.dpp;
      const finalNilaiBarang = hasExplicitNilaiBarang ? parseCurrencyNumber(rawNilaiBarang) : breakdown.nilaiBarang;
      const finalJasaCetak = hasExplicitJasaCetak ? parseCurrencyNumber(rawJasaCetak) : breakdown.jasaCetak;
      const finalWht = hasExplicitWht ? parseCurrencyNumber(rawWht) : breakdown.wht;
      const finalDppLainBarang = hasExplicitDppLainBarang ? parseCurrencyNumber(rawDppLainBarang) : breakdown.dppNilaiLainBarang;
      const finalDppLainJasa = hasExplicitDppLainJasa ? parseCurrencyNumber(rawDppLainJasa) : breakdown.dppNilaiLainJasaCetak;
      const finalPpn = hasExplicitPpn ? parseCurrencyNumber(rawPpn) : breakdown.ppn;
      const finalTotalFaktur = rawTotalFaktur;

      const cleanFaktur = noFaktur.toLowerCase().trim();
      const compositeKey = `${cleanFaktur}__${(String(customer).trim() || 'PT ASPIRASI HIDUP INDONESIA TBK').toLowerCase()}`;
      const isDuplicate = importedKeys.has(compositeKey);
      importedKeys.add(compositeKey);
      const duplicateReason = isDuplicate
        ? 'Duplicate WPP number and client in this file; the first row is used'
        : '';
      if (isDuplicate) dupCounter += 1;

      return {
        id: `wpp-${batchId}-${index}`,
        no_faktur: noFaktur,
        wpp_number: noFaktur,
        client_name: String(customer).trim() || 'PT ASPIRASI HIDUP INDONESIA TBK',
        client_address: clientAddress,
        promo_name: fileNamePromo,
        store_name: storeName,
        item_description: storeName,
        raw_total: finalTotalFaktur,
        total_faktur: finalTotalFaktur,
        total_price: finalTotalFaktur,
        nilai_wpp: finalTotalFaktur,
        dpp: finalDpp,
        nilai_barang: finalNilaiBarang,
        nilaiBarang: finalNilaiBarang,
        jasa_cetak: finalJasaCetak,
        jasaCetak: finalJasaCetak,
        pph23: finalWht,
        wht: finalWht,
        dpp_nilai_lain_barang: finalDppLainBarang,
        dpp_nilai_lain_jasa_cetak: finalDppLainJasa,
        ppn: finalPpn,
        qty: 1,
        unit_price: finalTotalFaktur,
        import_date: importedAt,
        imported_at: importedAt,
        invoice_date: rowDate,
        waktu_import: importedAt,
        status: 'draft',
        isDuplicate: isDuplicate,
        duplicateReason: duplicateReason,
      };
    });

  if (parsedData.length === 0) throw new Error('The Excel file contains no transaction rows.');
  return { rows: parsedData, duplicateCount: dupCounter, client: commonClientName, promo: commonPromoName };
}

export const posRowKey = (row) => `${String(row.no_faktur || row.wpp_number || '').trim().toLowerCase()}__${String(row.client_name || '').trim().toLowerCase()}`;

export function planPosImport(rows, selectedIds, existingRows, importedAt) {
  const selected = new Set(selectedIds);
  const byKey = new Map(existingRows.map((row) => [posRowKey(row), row]));
  const skipped = [];
  const toSave = [];
  for (const row of rows) {
    if (!selected.has(row.id) || row.isDuplicate) continue;
    const existing = byKey.get(posRowKey(row));
    if (existing && (existing.claimed_by_id || !['draft', 'ready', 'ready_to_process'].includes(existing.status))) {
      skipped.push({ ...existing, reason: existing.claimed_by_id ? 'already claimed' : existing.status });
      continue;
    }
    toSave.push({ ...row, id: existing?.id || row.id, import_date: importedAt, imported_at: importedAt, waktu_import: importedAt, month_year: importedAt.slice(0, 7), status: 'draft', isDuplicate: false, duplicateReason: '' });
    byKey.set(posRowKey(row), row);
  }
  return { toSave, skipped };
}
