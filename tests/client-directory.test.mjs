import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientNameKey, matchClient, resolveClientAddress } from '../src/utils/clientDirectoryData.js';
import { parsePosRows } from '../src/utils/posImport.js';

test('client name identity ignores case, punctuation and extra spaces', () => {
  const key = clientNameKey(' PT.  EXAMPLE, TBK ');
  assert.equal(key, 'pt example tbk');
  assert.equal(clientNameKey('ＰＴ EXAMPLE TBK'), key);
  const client = { id: 'a', name: 'PT. EXAMPLE TBK', name_key: key, address: 'Known Street' };
  assert.equal(matchClient([client], 'pt example tbk'), client);
  assert.equal(matchClient([client], 'Other Company'), null);
});

test('Excel imports capture supported client address columns without inventing missing addresses', () => {
  for (const column of ['Client Address', 'Customer Address', 'Billing Address', 'Alamat', 'Alamat Klien', 'Alamat Penagihan']) {
    const { rows } = parsePosRows([{ 'No Faktur': 'WPP-1', 'Nama Klien': 'PT Example', 'Grand Total': 1000, [column]: 'Imported Street' }]);
    assert.equal(rows[0].client_address, 'Imported Street');
    assert.equal(rows[0].client_name, 'PT Example');
  }
  assert.equal(parsePosRows([{ 'No Faktur': 'WPP-1', 'Grand Total': 1000 }]).rows[0].client_address, '');
});

test('directory address wins over staged data while manual invoice edits are preserved', () => {
  const client = { address: 'Directory Street' };
  assert.equal(resolveClientAddress(client, 'Old staged address', '', false), 'Directory Street');
  assert.equal(resolveClientAddress(client, 'Old staged address', 'User-edited address', true), 'User-edited address');
  assert.equal(resolveClientAddress(null, 'Imported Street', '', false), 'Imported Street');
  assert.equal(resolveClientAddress(null, '', '', false), '');
});
