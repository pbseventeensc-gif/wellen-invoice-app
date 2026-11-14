// Prefer the explicit DPP, including for invoices saved before subtotal_net was fixed.
export function invoiceDpp(invoice) {
  return Number(invoice.importSource === 'po'
    ? (invoice.subtotal_net ?? invoice.total_dpp ?? invoice.total_harga_net ?? 0)
    : (invoice.total_dpp ?? invoice.subtotal_net ?? invoice.total_harga_net ?? 0));
}

export function fakturNumber(start, offset) {
  const match = /^(\d{3}\.\d{3}-\d{2}\.)(\d{8})$/.exec(start);
  if (!match || !Number.isInteger(offset) || offset < 0) return null;
  const number = Number(match[2]) + offset;
  if (number < 1 || number > 99999999) return null;
  return match[1] + String(number).padStart(8, '0');
}

export function buildFakturExportRows(invoices, selectedIds, start, npwps) {
  if (!selectedIds.length) throw new Error('Select at least one invoice.');
  const rows = invoices.flatMap((invoice, index) => {
    if (!selectedIds.includes(invoice.id)) return [];
    const number = fakturNumber(start, index);
    if (!number) throw new Error('Invalid NSFP range. Use 010.000-26.00000001 format.');
    const npwp = String(npwps[invoice.client_name] || '').replace(/[.\-\s]/g, '');
    const date = invoice.invoice_date || invoice.time_created?.slice(0, 10);
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{15,16}$/.test(npwp) || !invoice.client_name?.trim() || !invoice.client_address?.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ||
        !Number.isFinite(invoiceDpp(invoice)) || invoiceDpp(invoice) <= 0 ||
        !Number.isFinite(Number(invoice.ppn_amount)) || Number(invoice.ppn_amount) < 0) {
      throw new Error(`Complete valid NPWP, client name, address, date and amounts for invoice ${invoice.invoice_number || invoice.id}.`);
    }
    return [{ invoice, number }];
  });
  if (rows.length !== new Set(selectedIds).size) throw new Error('Selected invoices changed. Reload and select again.');
  return rows;
}
