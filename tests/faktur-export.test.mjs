import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFakturExportRows, fakturNumber, invoiceDpp } from '../src/utils/fakturExport.js';
const invoices = [1, 2, 3].map((id) => ({ id, invoice_number: `INV-${id}`, client_name: 'Client', client_address: 'Jakarta', invoice_date: '2026-11-12', total_dpp: 1000000, subtotal_net: 1110000, ppn_amount: 110000 }));
const start = '010.000-26.00000001';
test('legacy gross subtotal does not override DPP', () => assert.equal(invoiceDpp(invoices[0]), 1000000));
test('selection and filtering preserve displayed number', () => {
  const [row] = buildFakturExportRows(invoices, [2], start, { Client: '0123456789012345' });
  assert.equal(row.number, fakturNumber(start, 1));
  assert.equal(row.number, '010.000-26.00000002');
});
test('missing and malformed identity/date/range block export', () => {
  for (const change of [{}, { Client: 'fake' }]) assert.throws(() => buildFakturExportRows(invoices, [1], start, change));
  for (const invoice of [{ ...invoices[0], invoice_date: '2026-02-30' }, { ...invoices[0], client_address: '' }]) assert.throws(() => buildFakturExportRows([invoice], [1], start, { Client: '012345678901234' }));
  assert.throws(() => buildFakturExportRows(invoices, [1], 'bad', { Client: '012345678901234' }));
  assert.throws(() => buildFakturExportRows(invoices, [4], start, { Client: '012345678901234' }));
  assert.equal(fakturNumber('010.000-26.99999999', 1), null);
});
