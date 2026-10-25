import { supabase } from '@/lib/supabase';

function mapInvoiceStagingRecord(record) {
  return {
    ...(record.payload || {}),
    id: record.source_key,
    status: record.status,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function notifyInvoiceStagingChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('wellen-invoice-staging'));
  }
}

export async function listInvoiceStaging() {
  const { data, error } = await supabase
    .from('invoice_staging')
    .select('source_key, status, payload, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapInvoiceStagingRecord);
}

export async function saveInvoiceStagingRows(rows) {
  const savedRows = [];
  for (let offset = 0; offset < rows.length; offset += 250) {
    const batch = rows.slice(offset, offset + 250);
    const { data, error } = await supabase.rpc('save_invoice_staging_rows', {
      p_rows: batch,
    });
    if (error) throw error;
    const batchRows = (data || []).map(mapInvoiceStagingRecord);
    if (batchRows.length !== batch.length) {
      throw new Error('Not all POS draft rows were saved.');
    }
    savedRows.push(...batchRows);
  }
  if (savedRows.length > 0) notifyInvoiceStagingChanged();
  return savedRows;
}

export async function updateInvoiceStagingRow(sourceKey, payload) {
  const { error } = await supabase.rpc('update_invoice_staging_row', {
    p_source_key: sourceKey,
    p_payload: payload,
  });
  if (error) throw error;
  notifyInvoiceStagingChanged();
}

export async function deleteInvoiceStagingRow(sourceKey) {
  const { error } = await supabase.rpc('delete_invoice_staging_row', {
    p_source_key: sourceKey,
  });
  if (error) throw error;
  notifyInvoiceStagingChanged();
}
