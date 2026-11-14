import { supabase } from '@/lib/supabase';

export async function listClients() {
  const clients = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('clients')
      .select('*')
      .order('name_key').range(offset, offset + 499);
    if (error) throw error;
    clients.push(...(data || []));
    if (!data || data.length < 500) return clients;
  }
}

export async function saveClient({ id, name, address, phoneNumber }) {
  const params = { p_id: id || null, p_name: name.trim(), p_address: address.trim() };
  let result = phoneNumber === undefined
    ? await supabase.rpc('save_client', params)
    : await supabase.rpc('save_client_contact', { ...params, p_phone_number: phoneNumber.trim() });
  // Keep existing address-only editing available before the contact migration is applied.
  if (phoneNumber !== undefined && !phoneNumber.trim() && ['PGRST202', '42883'].includes(result.error?.code)) {
    result = await supabase.rpc('save_client', params);
  }
  const { data, error } = result;
  if (error) throw error;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('wellen-clients'));
  return Array.isArray(data) ? data[0] : data;
}

export async function importClients(rows) {
  const { data, error } = await supabase.rpc('import_clients', { p_clients: rows });
  if (error) throw error;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('wellen-clients'));
  return data;
}
