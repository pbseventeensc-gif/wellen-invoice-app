import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayName, getImportTimestamp, jakartaDateKey, formatImportTimestamp } from '../src/utils/invoiceDisplay.js';
import { getAllRows } from '../src/utils/invoiceRows.js';
import { parsePosRows } from '../src/utils/posImport.js';

const uploaded = '2026-11-12T08:04:05.000Z';

test('customer, store and actor names are readable without changing source values', () => {
  assert.equal(displayName('PT ASPIRASI HIDUP INDONESIA TBK'), 'Pt Aspirasi Hidup Indonesia Tbk');
  assert.equal(displayName('AZKO KOTA WISATA'), 'Azko Kota Wisata');
  assert.equal(displayName('RISCA'), 'Risca');
  assert.equal(displayName('FAHADA'), 'Fahada');
  assert.equal(displayName(null), '');
});

test('Excel transaction date stays separate from upload time', () => {
  const { rows } = parsePosRows([{ 'No Faktur': 'WPP 1', Tanggal: 46235, 'Grand Total': 1000 }], uploaded);
  assert.equal(rows[0].invoice_date, '2026-08-01');
  assert.equal(rows[0].import_date, uploaded);
  assert.equal(getAllRows([], rows)[0].import_date, uploaded);
});

test('legacy date-only import fields use actual database creation time', () => {
  const row = { id: 'source-1', status: 'draft', import_date: '2026-08-01', invoice_date: '2026-08-01', created_at: uploaded, month_year: '2026-08' };
  assert.equal(getImportTimestamp(row), uploaded);
  assert.equal(getAllRows([], [row])[0].month_year, '2026-11');
  assert.equal(getImportTimestamp({ invoice_date: '2026-08-01' }), '');
});

test('grouped workflow retains earliest known upload time from its sources', () => {
  const staging = [{ id: 'source-1', created_at: uploaded }, { id: 'source-2', imported_at: '2026-11-13T08:00:00Z' }];
  const [row] = getAllRows([{ id: 'invoice-1', status: 'approved', import_date: '2026-08-01', created_at: '2026-11-14T08:00:00Z', items: [{ id: 'source-1' }, { id: 'source-2' }] }], staging);
  assert.equal(row.import_date, uploaded);
});

test('date filtering and displayed upload timestamp use WIB at midnight boundaries', () => {
  assert.equal(jakartaDateKey('2026-11-11T18:04:05Z'), '2026-11-12');
  const result = formatImportTimestamp(uploaded);
  assert.equal(result, '12/11/26 15:04');
  assert.equal(formatImportTimestamp('bad'), '—');
});
