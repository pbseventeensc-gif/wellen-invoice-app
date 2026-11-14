import { getImportTimestamp, jakartaDateKey } from './invoiceDisplay.js';

function toInvoiceRow(row, status, id, invoiceNo, sources = []) {
  const importedAt = getImportTimestamp(row, sources);
  const transactionLines = Array.from(new Map((row.items || [])
    .map((item) => ({
      no_wpp: item.source_no_wpp || item.wpp_number || item.no_faktur || '',
      store_name: String(item.store_name || item.item_description || '').trim(),
    }))
    .filter((item) => item.no_wpp || item.store_name)
    .map((item, index) => [`${item.no_wpp}-${item.store_name}`, { ...item, id: `${item.no_wpp}-${item.store_name}-${index}` }])
  ).values());
  const sourceWppNumbers = Array.from(new Set(transactionLines.map((item) => item.no_wpp).filter(Boolean)));
  const storeNames = Array.from(new Set(transactionLines.map((item) => item.store_name).filter(Boolean)));
  const noWpp = row.no_wpp || sourceWppNumbers.join(', ') || row.wpp_number || row.no_faktur || row.invoice_number || '';
  const noWppLines = String(noWpp).split(/\s*,\s*/).filter(Boolean);
  const storeNameLines = storeNames.length ? storeNames : String(row.store_name || '').split(/\s*,\s*/).filter(Boolean);
  const alignedLines = noWppLines.map((number, index) => ({
    no_wpp: number,
    store_name: transactionLines[index]?.store_name || storeNameLines[index] || '',
  }));
  return {
    ...row,
    id,
    invoice_no: invoiceNo || row.invoice_no || row.invoice_number || '',
    status,
    claimed_by_id: row.claimed_by_id || null,
    claimed_by_name: row.claimed_by_name || null,
    claimed_at: row.claimed_at || null,
    no_wpp: noWpp,
    transaction_lines: alignedLines,
    client_name: row.client_name || row.customer || '-',
    store_name: storeNameLines.join(', ') || '-',
    created_by: row.created_by || row.ar_name || '',
    approved_by: row.approved_by || row.approver_name || '',
    import_date: importedAt,
    month_year: jakartaDateKey(importedAt).slice(0, 7),
    created_invoice_at: row.created_invoice_at || row.time_created || '',
    approved_at: row.approved_at || row.time_approved || '',
    grand_total: Number(row.grand_total ?? row.total_price ?? row.total_faktur ?? row.nilai_wpp ?? 0),
  };
}

export function getAllRows(workflows, staging) {
  const rows = [];
  const activeItemIds = new Set();
  const stagingById = new Map(staging.map((item) => [item.id, item]));
  const sourcesFor = (invoice) => (invoice.items || []).map((item) => stagingById.get(item.id) || item);

  workflows.filter((invoice) => invoice.status === 'waiting_approval').forEach((invoice) => {
    (invoice.items || []).forEach((item) => {
      if (item.id) activeItemIds.add(item.id);
    });
    rows.push(toInvoiceRow(invoice, 'Invoiced', invoice.id, invoice.invoice_number, sourcesFor(invoice)));
  });
  workflows.filter((invoice) => invoice.status === 'approved').forEach((invoice) => {
    (invoice.items || []).forEach((item) => {
      if (item.id) activeItemIds.add(item.id);
    });
    rows.push(toInvoiceRow(invoice, 'Approved', invoice.id, invoice.invoice_number, sourcesFor(invoice)));
  });

  staging.forEach((item) => {
    if (!['draft', 'ready', 'ready_to_process', 'rejected'].includes(String(item.status || '').toLowerCase())) return;
    if (activeItemIds.has(item.id)) return;
    const sourceStatus = String(item.status || '').toLowerCase();
    const status = sourceStatus === 'rejected'
      ? 'Rejected'
      : 'Draft';
    rows.push(toInvoiceRow(item, status, item.id, item.invoice_no || item.invoice_number));
  });

  return Array.from(new Map(rows.map((row) => [row.id || `${row.invoice_no}-${row.no_wpp}`, row])).values())
    .sort((a, b) => String(b.import_date).localeCompare(String(a.import_date)));
}

