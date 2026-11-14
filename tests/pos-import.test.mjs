import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePosRows, planPosImport } from '../src/utils/posImport.js';
import { getAllRows } from '../src/utils/invoiceRows.js';
import { addressLines } from '../src/utils/printFormatting.js';

const importedAt = '2026-11-12T08:00:00.000Z';
const source = (number, total = 1000, customer = 'Client A') => ({
  'No Faktur': `WPP ${number}`, 'Customer ANT': customer,
  Keterangan: `PROMO ADHOC - Store ${number}`, 'Grand Total': total, Tanggal: 46235,
});

test('store-first Excel descriptions match the legacy promo-first import for all sample stores', () => {
  const promo = 'PROMO ADHOC WEEKEND BOOM DEALS';
  const stores = ['AZKO BONA INDAH', 'AZKO KOTA KASABLANKA', 'AZKO THE PARK PEJATEN', 'AZKO LIPPO MALL KRAMAT JATI'];
  const legacy = parsePosRows(stores.map((store, i) => ({ ...source(i + 1), Keterangan: `${promo} - ${store}` })), importedAt);
  const updated = parsePosRows(stores.map((store, i) => ({ ...source(i + 1), Keterangan: `${store} - ${promo}` })), importedAt);
  assert.equal(updated.promo, promo);
  assert.equal(updated.client, legacy.client);
  assert.equal(updated.duplicateCount, legacy.duplicateCount);
  updated.rows.forEach((row, i) => {
    const { id: newId, ...newValues } = row;
    const { id: oldId, ...oldValues } = legacy.rows[i];
    assert.ok(newId);
    assert.ok(oldId);
    assert.deepEqual(newValues, oldValues);
    assert.equal(row.store_name, stores[i]);
    assert.equal(row.item_description, stores[i]);
  });
});

test('mixed description orders preserve names, casing, and additional hyphens', () => {
  const descriptions = [
    ['Store 1 - promo adhoc - Weekend', 'promo adhoc - Weekend', 'Store 1'],
    ['AZKO - BONA INDAH - PROMO ADHOC', 'PROMO ADHOC', 'AZKO - BONA INDAH'],
    ['PROMO ADHOC - AZKO - BONA INDAH', 'PROMO ADHOC', 'AZKO - BONA INDAH'],
    ['Weekend Deals - Store 4', 'Weekend Deals', 'Store 4'],
    ['Weekend Deals - PROMOTION STORE', 'Weekend Deals', 'PROMOTION STORE'],
    ['Store 6', 'Store 6', 'Store 6'],
    ['', '', ''],
  ];
  const { rows } = parsePosRows(descriptions.map(([Keterangan], i) => ({ ...source(i + 1), Keterangan })), importedAt);
  rows.forEach((row, i) => {
    assert.equal(row.promo_name, descriptions[i][1]);
    assert.equal(row.store_name, descriptions[i][2]);
    assert.equal(row.item_description, descriptions[i][2]);
  });
});

test('eleven transactions survive blank trailing rows and repeated serial numbers', () => {
  const raw = Array.from({ length: 11 }, (_, i) => ({ ...source(i + 1), 'No  ': i > 8 ? i - 2 : i + 1 }));
  const { rows, duplicateCount } = parsePosRows([...raw, { 'No Faktur': '', 'Grand Total': '' }, {}], importedAt);
  assert.equal(rows.length, 11);
  assert.equal(duplicateCount, 0);
  assert.equal(new Set(rows.map((row) => row.id)).size, 11);
  assert.ok(rows.every((row) => row.status === 'draft'));
  assert.ok(rows.every((row) => row.invoice_date === '2026-08-01'));
  assert.equal(rows[0].store_name, 'Store 1');
  assert.equal(rows[0].promo_name, 'PROMO ADHOC');
});

test('only checked rows are saved; processed or claimed sources are reported and preserved', () => {
  const { rows } = parsePosRows([source(1), source(2), source(3), source(4)], importedAt);
  const existing = [
    { ...rows[0], id: 'shared-1', status: 'draft' },
    { ...rows[1], id: 'shared-2', status: 'approved', approved_by: 'Approver' },
    { ...rows[2], id: 'shared-3', status: 'draft', claimed_by_id: 'AR' },
  ];
  const result = planPosImport(rows, rows.slice(0, 3).map((row) => row.id), existing, importedAt);
  assert.equal(result.toSave.length, 1);
  assert.equal(result.toSave[0].id, 'shared-1');
  assert.equal(result.toSave[0].import_date, importedAt);
  assert.equal(result.toSave[0].invoice_date, '2026-08-01');
  assert.equal(result.toSave[0].status, 'draft');
  assert.deepEqual(result.skipped.map((row) => row.reason), ['approved', 'already claimed']);
  assert.equal(existing[1].status, 'approved');
  assert.equal(planPosImport(rows, [], existing, importedAt).toSave.length, 0);
});

test('file duplicates use WPP and client, preserving first checked transaction', () => {
  const { rows, duplicateCount } = parsePosRows([source(1), source(1, 2000), source(1, 3000, 'Client B')], importedAt);
  assert.equal(duplicateCount, 1);
  const result = planPosImport(rows, rows.map((row) => row.id), [], importedAt);
  assert.deepEqual(result.toSave.map((row) => row.total_faktur), [1000, 3000]);
});

test('missing WPP or total is reported instead of inventing a number or using a serial/date as a price', () => {
  assert.throws(() => parsePosRows([{ ...source(1), 'No Faktur': '' }]), /WPP/);
  assert.throws(() => parsePosRows([{ ...source(1), 'Grand Total': '', No: 200 }]), /total/);
  assert.throws(() => parsePosRows([source(1, 'invalid')]), /total is invalid/);
  assert.throws(() => parsePosRows([source(1, -100)]), /total is invalid/);
  assert.equal(parsePosRows([source(1, 0)]).rows[0].total_faktur, 0);
});

test('new drafts sharing a WPP with older or other-client invoices remain visible as Draft', () => {
  const { rows } = parsePosRows([source(1)], importedAt);
  const workflow = { id: 'invoice-1', invoice_number: 'WPK 1', status: 'approved', items: [{ id: 'old-source', wpp_number: rows[0].wpp_number }], approved_by: 'Approver' };
  const result = getAllRows([workflow], rows);
  assert.equal(result.length, 2);
  assert.equal(result.find((row) => row.id === rows[0].id).status, 'Draft');
  assert.equal(result.find((row) => row.id === 'invoice-1').status, 'Approved');
  assert.equal(getAllRows([{ ...workflow, items: [{ ...rows[0] }] }], rows).length, 1);
});

test('invoice grouping retains source transaction count', () => {
  const { rows } = parsePosRows([source(1), source(2)], importedAt);
  const result = getAllRows([{ id: 'invoice-1', status: 'waiting_approval', items: rows }], rows);
  assert.equal(result.length, 1);
  assert.equal(result[0].transaction_lines.length, 2);
  assert.equal(result[0].status, 'Invoiced');
});

test('addresses use three lines, preserve explicit lines and retain every word', () => {
  for (const text of ['Jakarta, Indonesia', 'Jalan Panjang Nomor 123 Lantai 5 Kelurahan Duren Tiga Kecamatan Pancoran Jakarta Selatan Indonesia', 'Satu\nDua\nTiga']) {
    const lines = addressLines(text);
    assert.equal(lines.length, 3);
    assert.equal(lines.join(' ').trim().replace(/\s+/g, ' '), text.replace(/\s+/g, ' '));
  }
});
