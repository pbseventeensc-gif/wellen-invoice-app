export function clientNameKey(name) {
  return String(name || '').normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function matchClient(clients, name) {
  const key = clientNameKey(name);
  return key ? clients.find((client) => client.name_key === key || clientNameKey(client.name) === key) || null : null;
}

export function resolveClientAddress(client, stagedAddress, editedAddress, wasEdited) {
  return wasEdited ? editedAddress : client?.address?.trim() || stagedAddress || '';
}
