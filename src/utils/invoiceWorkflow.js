import { supabase } from '@/lib/supabase';

export function mapInvoiceWorkflow(record) {
  return {
    ...(record.payload || {}),
    id: record.id,
    status: record.status,
    approved_by: record.approved_by || '',
    approved_at: record.approved_at || '',
    time_approved: record.approved_at || record.payload?.time_approved || '',
    reject_reason: record.rejection_reason || record.payload?.reject_reason || '',
    time_download: record.printed_at || record.payload?.time_download || '',
    payment_status: record.payload?.payment_status || 'unpaid',
    payment_date: record.payload?.payment_date || null,
  };
}

export async function listInvoiceWorkflows(statuses) {
  let query = supabase
    .from('invoice_workflows')
    .select('id, status, payload, approved_by, approved_at, rejection_reason, printed_at, created_at')
    .order('created_at', { ascending: false });

  if (statuses?.length) query = query.in('status', statuses);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapInvoiceWorkflow);
}

export async function submitInvoiceWorkflow(payload) {
  const { data, error } = await supabase.rpc('submit_invoice_workflow', {
    p_payload: payload,
  });
  if (error) throw error;
  return data;
}

export async function approveInvoiceWorkflow(id) {
  const { data, error } = await supabase.rpc('approve_invoice_workflow', {
    p_workflow_id: id,
  });
  if (error) throw error;
  return mapInvoiceWorkflow(Array.isArray(data) ? data[0] : data);
}

export async function rejectInvoiceWorkflow(id, reason) {
  const { data, error } = await supabase.rpc('reject_invoice_workflow', {
    p_workflow_id: id,
    p_reason: reason,
  });
  if (error) throw error;
  return mapInvoiceWorkflow(Array.isArray(data) ? data[0] : data);
}

export async function removeWaitingInvoiceWorkflow(id) {
  const { error } = await supabase.rpc('delete_waiting_invoice_workflow', {
    p_workflow_id: id,
  });
  if (error) throw error;
}

export async function clearWaitingInvoiceWorkflows() {
  const { error } = await supabase.rpc('clear_waiting_invoice_workflows');
  if (error) throw error;
}

export async function markInvoiceWorkflowPrinted(id) {
  const { error } = await supabase.rpc('mark_invoice_workflow_printed', {
    p_workflow_id: id,
  });
  if (error) throw error;
}

export async function setInvoicePaymentStatus(id, isPaid, paymentDate) {
  const { error } = await supabase.rpc('set_invoice_workflow_payment', {
    p_workflow_id: id,
    p_is_paid: isPaid,
    p_payment_date: paymentDate,
  });
  if (error) throw error;
}

export async function deleteApprovedInvoiceWorkflow(id) {
  const { error } = await supabase.rpc('delete_approved_invoice_workflow', {
    p_workflow_id: id,
  });
  if (error) throw error;
}
