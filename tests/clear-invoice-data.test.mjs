import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearInvoiceData } from '../src/utils/clearInvoiceData.js';

function clientWith({ rpcError = null, remaining = 0, verificationError = null } = {}) {
  const calls = [];
  return {
    calls,
    rpc: async (name) => { calls.push(name); return { error: rpcError }; },
    from: (table) => ({ select: async () => { calls.push(table); return { count: remaining, error: verificationError }; } }),
  };
}

test('successful reset requires server deletion and empty workflow and staging tables', async () => {
  const client = clientWith();
  await clearInvoiceData(client);
  assert.deepEqual(client.calls, ['clear_all_invoice_data', 'invoice_workflows', 'invoice_staging']);
});

test('missing RPC fails with database setup guidance instead of reporting success', async () => {
  const client = clientWith({ rpcError: { code: 'PGRST202' } });
  await assert.rejects(clearInvoiceData(client), /20261112120000_fix_clear_all_safeupdate.sql/);
  assert.deepEqual(client.calls, ['clear_all_invoice_data']);
});

test('permission and network errors are propagated without partial-delete fallbacks', async () => {
  for (const error of [{ code: '42501' }, { message: 'Failed to fetch' }]) {
    const client = clientWith({ rpcError: error });
    await assert.rejects(clearInvoiceData(client), /cannot clear|Failed to fetch/);
    assert.equal(client.calls.length, 1);
  }
});

test('remaining data or failed verification cannot produce a successful reset', async () => {
  await assert.rejects(clearInvoiceData(clientWith({ remaining: 1 })), /Data remains/);
  await assert.rejects(clearInvoiceData(clientWith({ remaining: null })), /Data remains/);
  await assert.rejects(clearInvoiceData(clientWith({ verificationError: { message: 'connection lost' } })), /could not be verified/);
});
