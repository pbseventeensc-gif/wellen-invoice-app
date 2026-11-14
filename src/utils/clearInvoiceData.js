export async function clearInvoiceData(client) {
  // The database RPC performs the entire deletion in one transaction and checks
  // the actor's role. Never replace it with a partial or unchecked browser reset.
  const { error } = await client.rpc('clear_all_invoice_data');
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('The reset function is not installed in Supabase. Apply migration 20261112120000_fix_clear_all_safeupdate.sql to the Supabase project used by this app.');
    }
    if (error.code === '42501') {
      throw new Error('Your account cannot clear all data. Sign in as a Super Admin or Approval Manager.');
    }
    throw new Error(error.message || 'Could not delete data from Supabase. Check your connection and try again.');
  }

  const results = await Promise.all(['invoice_workflows', 'invoice_staging'].map((table) =>
    client.from(table).select('*', { count: 'exact', head: true })
  ));
  for (const result of results) {
    if (result.error) throw new Error(`Deletion could not be verified: ${result.error.message}`);
    if (result.count !== 0) {
      throw new Error('Data remains in Supabase or new data was imported during deletion. Refresh the list before trying again.');
    }
  }
}
