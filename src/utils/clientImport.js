import { clientNameKey } from './clientDirectoryData.js';

const nameHeaders = new Set(['client name', 'name', 'nama klien', 'nama client', 'customer name', 'nama pelanggan']);
const addressHeaders = new Set(['address', 'billing address', 'client address', 'alamat', 'alamat klien', 'alamat client']);
const clean = (value) => String(value ?? '').trim();

export function parseClientImport(matrix) {
  const headerIndex = matrix.findIndex((row) => row.some((cell) => nameHeaders.has(clientNameKey(cell))) && row.some((cell) => addressHeaders.has(clientNameKey(cell))));
  if (headerIndex < 0) throw new Error('Use two columns: Client name and Address.');
  const headers = matrix[headerIndex].map(clientNameKey);
  const nameIndex = headers.findIndex((header) => nameHeaders.has(header));
  const addressIndex = headers.findIndex((header) => addressHeaders.has(header));
  const unique = new Map();
  let duplicates = 0;
  for (let index = headerIndex + 1; index < matrix.length; index++) {
    const row = matrix[index];
    if (!row.some((value) => clean(value))) continue;
    const name = clean(row[nameIndex]);
    const address = clean(row[addressIndex]);
    if (!clientNameKey(name) || !address) throw new Error(`Row ${index + 1}: client name and address are required.`);
    if (name.length > 300 || address.length > 4000) throw new Error(`Row ${index + 1}: name or address is too long.`);
    const key = clientNameKey(name);
    if (unique.has(key)) {
      if (unique.get(key).address !== address) throw new Error(`Row ${index + 1}: duplicate client has a different address. Keep one address per client.`);
      duplicates++;
    } else unique.set(key, { name, address });
  }
  if (!unique.size) throw new Error('The file contains no clients.');
  if (unique.size > 500) throw new Error('Import up to 500 clients at a time.');
  return { rows: [...unique.values()], duplicates };
}
