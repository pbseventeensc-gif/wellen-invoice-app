import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/utils/clientDirectory.js', import.meta.url), 'utf8');
const directory = (supabase) => new Function('supabase', source
  .replace("import { supabase } from '@/lib/supabase';", '')
  .replaceAll('export async function', 'async function') + '\nreturn { listClients, saveClient };')(supabase);

const client = { id: 'client-1', name: 'Client', address: 'Street', phone_number: '+62 0812 001' };

test('contact save sends phone as text and returns the saved phone', async () => {
  const calls = [];
  const { saveClient } = directory({ rpc: async (...args) => { calls.push(args); return { data: [client] }; } });
  assert.deepEqual(await saveClient({ id: client.id, name: ' Client ', address: ' Street ', phoneNumber: ' +62 0812 001 ' }), client);
  assert.deepEqual(calls, [['save_client_contact', { p_id: client.id, p_name: 'Client', p_address: 'Street', p_phone_number: '+62 0812 001' }]]);
});

test('missing contact RPC cannot silently drop a nonempty phone or partially save other fields', async () => {
  const calls = [];
  const error = { code: 'PGRST202', message: 'Migration required' };
  const { saveClient } = directory({ rpc: async (...args) => { calls.push(args); return { error }; } });
  await assert.rejects(saveClient({ name: 'Client', address: 'Street', phoneNumber: '0812001' }), (failure) => failure === error);
  assert.equal(calls.length, 1);
});

test('legacy address-only saves remain available before the contact migration', async () => {
  const calls = [];
  const { saveClient } = directory({ rpc: async (name, args) => {
    calls.push([name, args]);
    return name === 'save_client_contact' ? { error: { code: 'PGRST202' } } : { data: client };
  } });
  assert.deepEqual(await saveClient({ name: 'Client', address: 'Street', phoneNumber: '' }), client);
  assert.deepEqual(calls.map(([name]) => name), ['save_client_contact', 'save_client']);
  calls.length = 0;
  await saveClient({ name: 'Client', address: 'Street' });
  assert.deepEqual(calls.map(([name]) => name), ['save_client']);
});

test('permission failures never retry through the legacy RPC', async () => {
  let attempts = 0;
  const error = { code: '42501' };
  const { saveClient } = directory({ rpc: async () => { attempts++; return { error }; } });
  await assert.rejects(saveClient({ name: 'Client', address: 'Street', phoneNumber: '' }), (failure) => failure === error);
  assert.equal(attempts, 1);
});

test('directory reads retain phone numbers and support databases before the contact migration', async () => {
  const { listClients } = directory({ from: () => ({ select: () => ({ order: () => ({ range: async () => ({ data: [client] }) }) }) }) });
  assert.deepEqual(await listClients(), [client]);
});
