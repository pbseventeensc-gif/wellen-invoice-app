export function displayName(value) {
  return String(value || '').toLocaleLowerCase('id-ID')
    .replace(/(^|[\s/()-])\p{L}/gu, (letter) => letter.toLocaleUpperCase('id-ID'));
}

const hasTime = (value) => typeof value === 'string' && /T\d{2}:|\d{2}:\d{2}/.test(value) && Number.isFinite(Date.parse(value));

// An Excel transaction date is not an upload timestamp. Prefer recorded upload
// metadata, then the source records, then database creation time for legacy data.
export function getImportTimestamp(row, sources = []) {
  const explicit = [row.imported_at, row.waktu_import, row.import_date].find(hasTime);
  if (explicit) return explicit;
  const sourceTimes = sources.map((source) => getImportTimestamp(source))
    .filter(hasTime).sort((a, b) => Date.parse(a) - Date.parse(b));
  return sourceTimes[0] || row.created_at || '';
}

export function jakartaDateKey(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

export function formatImportTimestamp(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('day')}/${part('month')}/${part('year')} ${part('hour')}:${part('minute')}`;
}
