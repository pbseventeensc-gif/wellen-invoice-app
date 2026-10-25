'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  UploadCloud,
  ArrowRight,
  Trash2,
  FileText,
  Plus,
  Layers,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { formatRupiah, parseCurrencyNumber, parseExcelDate } from '@/utils/taxCalculator';
import { listInvoiceStaging, saveInvoiceStagingRows } from '@/utils/invoiceStaging';

const PDF_MAX_BYTES = 20 * 1024 * 1024;
const PDF_MAX_PAGES = 100;
const PO_UNITS = 'M2|M²|EA|PCS|PC|PCE|SET|UNIT|BOX|PACK|ROLL|LOT|LS|M|CM|KG|GRAM|L|LTR|HOUR|HR|DAY|JAM';

function groupPdfTextIntoLines(items) {
  const rows = [];
  items
    .filter((item) => item.str?.trim())
    .map((item) => ({
      text: item.str.trim(),
      x: item.transform[4],
      y: item.transform[5],
      width: item.width || 0,
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .forEach((item) => {
      let row = rows.find((candidate) => Math.abs(candidate.y - item.y) < 3);
      if (!row) {
        row = { y: item.y, items: [] };
        rows.push(row);
      }
      row.items.push(item);
    });

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const sorted = row.items.sort((a, b) => a.x - b.x);
      return sorted.reduce((text, item, index) => {
        if (index === 0) return item.text;
        const previous = sorted[index - 1];
        const needsSpace = item.x - (previous.x + previous.width) > 2;
        return `${text}${needsSpace ? ' ' : ''}${item.text}`;
      }, '').replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);
}

function parsePoLineItem(line, index) {
  const amount = '(?:Rp\\.?\\s*)?[\\d][\\d.,]*';
  const pattern = new RegExp(
    `^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s+(${PO_UNITS})\\s+(${amount})(?:\\s+(${amount}))?$`,
    'i'
  );
  const match = line.match(pattern);
  if (!match) return null;

  const description = match[1].trim().replace(/^[\d.)-]+\s*/, '');
  const quantity = parseCurrencyNumber(match[2]);
  const unitPrice = parseCurrencyNumber(match[4]);
  if (!description || quantity <= 0 || unitPrice <= 0) return null;

  return {
    id: `po-pdf-${Date.now()}-${index}`,
    description: description.toUpperCase(),
    qty: quantity,
    uom: match[3].toUpperCase(),
    unit_price: unitPrice,
    isJasaCetak: /jasa cetak/i.test(description),
  };
}

function findPdfHeaderValue(lines, pattern) {
  for (const line of lines) {
    const match = line.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[|,;]+$/, '');
  }
  return '';
}

export default function ClientPoTab() {
  const router = useRouter();

  const [poFileName, setPoFileName] = useState('');
  const [poClientName, setPoClientName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState('');
  const [poPromoName, setPoPromoName] = useState('');
  const [poIncludeJasaCetak, setPoIncludeJasaCetak] = useState(false);
  const [poPricesIncludePpn, setPoPricesIncludePpn] = useState(false);
  const [poItems, setPoItems] = useState([]);
  const [poImportMessage, setPoImportMessage] = useState('');
  const [isImportingPo, setIsImportingPo] = useState(false);

  const [selectedPoIds, setSelectedPoIds] = useState([]);
  // Initial state null (sama di server & client) untuk mencegah hydration mismatch.
  const [remainingBatch, setRemainingBatch] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const loadRemainingBatch = () => {
      listInvoiceStaging()
        .then((rows) => {
          const remainingRows = rows.filter((row) => row.po_remaining_batch && ['draft', 'ready', 'ready_to_process'].includes(row.status));
          if (!isMounted) return;
          if (remainingRows.length === 0) {
            setRemainingBatch(null);
            return;
          }
          const firstRow = remainingRows[0];
          const batchRows = remainingRows.filter((row) => row.po_remaining_batch_id === firstRow.po_remaining_batch_id);
          const metadata = firstRow.po_batch_metadata || {};
          setRemainingBatch({
            ...metadata,
            client_name: firstRow.client_name,
            po_number: firstRow.po_number || firstRow.no_faktur,
            remaining_items: batchRows.map((row) => ({
              ...row,
              description: row.item_description || row.store_name,
            })),
          });
        })
        .catch((error) => {
          console.error('Failed to load shared remaining PO items:', error);
          if (isMounted) {
            setPoImportMessage('Shared remaining PO items could not be loaded. Check your connection and Supabase access.');
          }
        });
    };
    loadRemainingBatch();
    window.addEventListener('focus', loadRemainingBatch);
    window.addEventListener('wellen-invoice-staging', loadRemainingBatch);
    window.addEventListener('wellen-invoice-workflows', loadRemainingBatch);
    const refreshInterval = window.setInterval(loadRemainingBatch, 30000);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', loadRemainingBatch);
      window.removeEventListener('wellen-invoice-staging', loadRemainingBatch);
      window.removeEventListener('wellen-invoice-workflows', loadRemainingBatch);
      window.clearInterval(refreshInterval);
    };
  }, []);

  const handleLoadRemainingBatch = () => {
    if (!remainingBatch) return;
    setPoClientName(String(remainingBatch.client_name || 'PT. FOODS BEVERAGES INDONESIA').toUpperCase());
    setPoNumber(remainingBatch.po_number || 'WPP-4607477988');
    setPoDate(remainingBatch.po_date || new Date().toISOString().slice(0, 10));
    setPoPromoName(String(remainingBatch.promo_name || 'PURCHASE ORDER MATERIAL & JASA').toUpperCase());
    setPoPricesIncludePpn(remainingBatch.po_prices_include_ppn === true);
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

  const handleClearPoForm = () => {
    if (poItems.length > 0 || poClientName || poNumber) {
      if (!confirm('Clear all entered PO header details and line items?')) return;
    }
    setPoFileName('');
    setPoClientName('');
    setPoNumber('');
    setPoDate('');
    setPoPromoName('');
    setPoPricesIncludePpn(false);
    setPoItems([]);
    setPoIncludeJasaCetak(false);
    setPoImportMessage('');
  };

  const handlePoFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileNameLower = file.name.toLowerCase();
    setPoFileName(file.name);
    setPoImportMessage('');
    setPoItems([]);
    setSelectedPoIds([]);

    if (fileNameLower.endsWith('.pdf')) {
      if (file.size > PDF_MAX_BYTES) {
        setPoImportMessage('Ukuran PDF maksimal 20 MB. PO belum diproses.');
        return;
      }

      setIsImportingPo(true);
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();

        const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
        if (document.numPages > PDF_MAX_PAGES) {
          await document.destroy();
          throw new Error('PDF melebihi batas 100 halaman.');
        }

        const lines = [];
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          const content = await page.getTextContent();
          lines.push(...groupPdfTextIntoLines(content.items));
        }
        await document.destroy();

        const parsedItems = lines
          .map((line, index) => parsePoLineItem(line, index))
          .filter(Boolean);

        const extractedPoNumber = findPdfHeaderValue(lines, /\b(?:po|p\.o\.|purchase order)\s*(?:(?:no\.?|number|#)\s*[:#-]?\s*|[:#-]\s*)([a-z0-9][a-z0-9/-]{2,})/i);
        const extractedClient = findPdfHeaderValue(lines, /\b(?:vendor|supplier|customer|client|bill to|ship to)\s*[:\-]\s*(.+)$/i);
        const extractedDate = findPdfHeaderValue(lines, /\b(?:po date|order date|date)\s*[:\-]\s*((?:\d{1,2}[/-]){2}\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})/i);
        const normalizedDate = parseExcelDate(extractedDate);

        setPoClientName(extractedClient.toUpperCase());
        setPoNumber(extractedPoNumber.toUpperCase());
        setPoDate(normalizedDate);
        setPoPromoName(file.name.replace(/\.[^/.]+$/, '').toUpperCase());
        setPoItems(parsedItems);
        setSelectedPoIds(parsedItems.map((item) => item.id));

        if (parsedItems.length === 0) {
          setPoImportMessage(
            lines.length < 3
              ? 'PDF ini tidak memiliki teks yang dapat dibaca (kemungkinan hasil scan). OCR tidak digunakan; isi detail PO dan baris item secara manual.'
              : 'Teks PDF terbaca, tetapi baris item tidak cocok dengan format otomatis. Periksa file, lalu isi baris secara manual.'
          );
        } else {
          setPoImportMessage(`Berhasil membaca ${parsedItems.length} kandidat baris item. Periksa dan koreksi semua detail sebelum membuat invoice.`);
        }
      } catch (error) {
        console.error('Failed to extract PO details from PDF:', error);
        setPoItems([]);
        setSelectedPoIds([]);
        setPoImportMessage(error.message || 'PDF gagal dibaca. Pastikan file tidak rusak, lalu isi PO secara manual.');
      } finally {
        setIsImportingPo(false);
      }
      return;
    }

    // Excel/CSV Purchase Orders are parsed from their first worksheet.
    if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls') || fileNameLower.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];

          const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          let detectedClient = '';
          let detectedPoNo = '';
          let detectedPromo = '';

          const parsedItems = rawJson
            .filter((row) => Object.values(row).join('').trim().length > 0)
            .map((row, index) => {
              const clean = {};
              Object.keys(row).forEach((k) => {
                clean[k.trim().toLowerCase()] = row[k];
              });

              const desc = String(
                clean['description'] || clean['item description'] || clean['deskripsi'] || clean['nama barang'] || clean['item'] || clean['material'] || `ITEM PARSED #${index + 1}`
              ).toUpperCase().trim();

              const qty = parseCurrencyNumber(clean['qty'] || clean['quantity'] || clean['jumlah'] || 1) || 1;
              const uom = String(clean['uom'] || clean['unit'] || clean['satuan'] || 'M2').toUpperCase().trim();
              const unitPrice = parseCurrencyNumber(clean['unit price'] || clean['harga'] || clean['harga satuan'] || clean['price'] || 50000);

              if (!detectedClient && (clean['client'] || clean['customer'] || clean['pt'])) {
                detectedClient = String(clean['client'] || clean['customer'] || clean['pt']).toUpperCase().trim();
              }

              if (!detectedPoNo && (clean['po number'] || clean['no po'] || clean['po'] || clean['wpp'])) {
                detectedPoNo = String(clean['po number'] || clean['no po'] || clean['po'] || clean['wpp']).toUpperCase().trim();
              }

              return {
                id: `po-file-${Date.now()}-${index}`,
                description: desc,
                qty: qty,
                uom: uom || 'M2',
                unit_price: unitPrice,
                isJasaCetak: desc === 'JASA CETAK',
              };
            });

          setPoClientName(detectedClient || 'PT. FOODS BEVERAGES INDONESIA');
          setPoNumber(detectedPoNo || `PO-${file.name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 12).toUpperCase()}`);
          setPoDate(new Date().toISOString().slice(0, 10));
          setPoPromoName(detectedPromo || file.name.replace(/\.[^/.]+$/, '').toUpperCase());

          if (parsedItems.length > 0) {
            setPoItems(parsedItems);
            setSelectedPoIds(parsedItems.map((item) => item.id));
            setPoImportMessage(`Berhasil membaca ${parsedItems.length} baris item. Periksa detail sebelum membuat invoice.`);
          } else {
            setPoImportMessage('Tidak ada baris item yang terbaca dari sheet pertama. Isi baris PO secara manual.');
          }
        } catch (err) {
          console.error('Failed to parse PO Excel file:', err);
          setPoImportMessage('File Excel/CSV gagal dibaca. Periksa format file, lalu isi PO secara manual.');
        }
      };
      reader.onerror = () => setPoImportMessage('File Excel/CSV tidak dapat dibaca oleh browser.');
      reader.readAsArrayBuffer(file);
      return;
    }

    setPoImportMessage('Format file tidak didukung. Unggah PO PDF, Excel, atau CSV.');
  };

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

  const handleRemovePoItem = (id) => {
    setPoItems((prev) => prev.filter((it) => it.id !== id));
    setSelectedPoIds((prev) => prev.filter((itemId) => itemId !== id));
  };

  const handleProceedPOInvoice = async () => {
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
        po_prices_include_ppn: poPricesIncludePpn,
        status: 'waiting_approval',
      };
    });

    const unselectedRows = poItems.filter((r) => !selectedPoIds.includes(r.id));
    if (unselectedRows.length > 0) {
      try {
        const batchId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `po-batch-${Date.now()}`;
        const batchMetadata = {
          client_name: String(poClientName).toUpperCase(),
          po_number: poNumber,
          po_date: poDate,
          promo_name: String(poPromoName).toUpperCase(),
          po_prices_include_ppn: poPricesIncludePpn,
          batch_id: batchId,
        };
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
            po_prices_include_ppn: poPricesIncludePpn,
            po_number: poNumber,
            po_remaining_batch: true,
            po_remaining_batch_id: batchId,
            po_batch_metadata: batchMetadata,
          };
        });
        await saveInvoiceStagingRows(remainingForStaging);
      } catch (error) {
        console.error('Failed to save shared remaining PO items:', error);
        setPoImportMessage('Remaining PO items could not be saved to shared drafts. Check your connection and try again.');
        return;
      }
    }

    sessionStorage.setItem('wellen_import_source', 'po');
    sessionStorage.setItem('wellen_staged_items', JSON.stringify(stagedPayload));
    sessionStorage.setItem('wellen_po_include_jasa', JSON.stringify(poIncludeJasaCetak));
    sessionStorage.setItem('wellen_po_prices_include_ppn', JSON.stringify(poPricesIncludePpn));
    router.push('/create-invoice');
  };

  return (
    <div className="space-y-4">
      {remainingBatch && remainingBatch.remaining_items?.length > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-stone-900">
            <span className="p-1 bg-amber-100 rounded-full text-amber-800">
              <FileText size={14} />
            </span>
            <span>
              Found <strong>{remainingBatch.remaining_items.length} unbilled PO items</strong> from <strong>{remainingBatch.po_number}</strong> ({remainingBatch.client_name}).
            </span>
          </div>

          <button
            type="button"
            onClick={handleLoadRemainingBatch}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs shadow-2xs transition-colors cursor-pointer"
          >
            Load Unbilled PO Items (Termin #2)
          </button>
        </div>
      )}

      {/* Box Upload File PO */}
      <div className="bg-white px-6 py-4 rounded-xl border-2 border-dashed border-stone-200 hover:border-amber-500 transition-colors shadow-xs">
        <input
          type="file"
          id="poFileUpload"
          accept=".pdf, .xlsx, .xls, .csv"
          onChange={handlePoFileUpload}
          className="hidden"
        />
        <label htmlFor="poFileUpload" className={`flex items-center justify-center gap-4 ${isImportingPo ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}>
          <div className="p-2 bg-amber-50 rounded-full text-amber-700 shrink-0">
            <UploadCloud size={22} />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-stone-800 leading-tight">
              {isImportingPo ? 'Membaca isi file PO...' : poFileName ? `File PO: ${poFileName}` : 'Unggah Purchase Order (.pdf, .xlsx, .xls, .csv)'}
            </p>
            <p className="text-[10px] text-stone-400 mt-0.5 font-normal">
              {poFileName ? 'Data hasil ekstraksi perlu diperiksa dan dikoreksi sebelum membuat invoice.' : 'PDF digital dibaca di browser; PDF scan perlu diisi manual. File tidak diunggah ke layanan pihak ketiga.'}
            </p>
          </div>
        </label>
      </div>
      {poImportMessage && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-xl border px-3.5 py-3 text-xs ${
            poItems.length
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>{poImportMessage}</span>
        </div>
      )}

      {/* Header Metadata PO Form */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2 text-stone-900 font-bold text-sm uppercase">
            <FileText size={18} className="text-stone-900" />
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 text-xs">
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
          <fieldset className="min-w-0">
            <legend className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-400">
              PO PRICE INCLUDES PPN?
            </legend>
            <div className="flex h-[38px] items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3">
              <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-stone-700">
                <input
                  type="radio"
                  name="poPricesIncludePpn"
                  checked={poPricesIncludePpn}
                  onChange={() => setPoPricesIncludePpn(true)}
                  className="h-3.5 w-3.5 accent-amber-600"
                />
                Include PPN
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-stone-700">
                <input
                  type="radio"
                  name="poPricesIncludePpn"
                  checked={!poPricesIncludePpn}
                  onChange={() => setPoPricesIncludePpn(false)}
                  className="h-3.5 w-3.5 accent-amber-600"
                />
                Exclude PPN
              </label>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-stone-500">
              Select Include when PO line prices already contain tax.
            </p>
          </fieldset>
        </div>
      </div>

      {/* Dynamic Line-Item Builder Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-bold text-stone-900 uppercase">
            <Layers size={16} className="text-stone-900" />
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
                    className="rounded border-stone-300 text-stone-900 focus:ring-amber-500"
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
                    No PO items entered yet. Click &quot;+ Add Line Item Row&quot; or upload a PO file above.
                  </td>
                </tr>
              ) : (
                poItems.map((item, idx) => {
                  const isSelected = selectedPoIds.includes(item.id);
                  const lineTotal = Math.round((Number(item.qty) || 0) * (Number(item.unit_price) || 0));
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${isSelected ? 'bg-amber-50' : 'bg-stone-50/40 opacity-60'}`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectPoItem(item.id)}
                          className="rounded border-stone-300 text-stone-900 focus:ring-amber-500 cursor-pointer"
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
            <span className="font-bold text-stone-500 uppercase tracking-wider">
              TOTAL PO {poPricesIncludePpn ? 'INCLUDING PPN' : 'EXCLUDING PPN'}:
            </span>
            <span className="font-mono text-base font-bold text-slate-900">
              {formatRupiah(
                poItems
                  .filter((r) => selectedPoIds.includes(r.id))
                  .reduce((sum, r) => sum + Math.round((Number(r.qty) || 0) * (Number(r.unit_price) || 0)), 0)
              )}
            </span>
            {poItems.length > 0 && selectedPoIds.length < poItems.length && (
              <span className="bg-amber-50 text-amber-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                Partial Billing: {selectedPoIds.length} of {poItems.length} items selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClearPoForm}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0"
              title="Cancel Import"
            >
              <Trash2 size={14} />
              <span>Cancel Import</span>
            </button>

            <button
              type="button"
              onClick={handleProceedPOInvoice}
              disabled={selectedPoIds.length === 0}
              className={`inline-flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-xs shadow-xs transition-colors shrink-0 ${
                selectedPoIds.length > 0
                  ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              <span>Process ({selectedPoIds.length})</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
