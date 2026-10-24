const SEEN_KEY = 'wellen_invoice_status_seen';
const UNREAD_COUNT_KEY = 'wellen_new_status_count';
const STATUS_NAMES = ['Draft', 'Invoiced', 'Approved', 'Rejected'];

function readSeenAt() {
  try {
    const value = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch (error) {
    console.error('Failed to read invoice status notification state:', error);
    return null;
  }
}

export function getUnreadStatusCounts(rows) {
  let seenAt = readSeenAt();
  if (!seenAt) {
    const baseline = Date.now();
    seenAt = Object.fromEntries(STATUS_NAMES.map((status) => [status, baseline]));
    localStorage.setItem(SEEN_KEY, JSON.stringify(seenAt));
  }

  const counts = Object.fromEntries(STATUS_NAMES.map((status) => [status, 0]));
  rows.forEach((row) => {
    const status = STATUS_NAMES.includes(row.status) ? row.status : null;
    if (!status) return;
    const timestamp = row.updated_at
      || row.approved_at
      || row.time_approved
      || row.created_invoice_at
      || row.time_created
      || row.import_date;
    const changedAt = timestamp ? new Date(timestamp).getTime() : 0;
    if (changedAt > Number(seenAt[status] || 0)) counts[status] += 1;
  });

  return counts;
}

export function saveUnreadStatusCounts(counts) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  localStorage.setItem(UNREAD_COUNT_KEY, String(total));
  window.dispatchEvent(new Event('wellen-status-notifications'));
}

export function markInvoiceStatusSeen(status) {
  const seenAt = readSeenAt() || {};
  const timestamp = Date.now();
  const nextSeenAt = status === 'ALL'
    ? Object.fromEntries(STATUS_NAMES.map((name) => [name, timestamp]))
    : { ...seenAt, [status]: timestamp };
  localStorage.setItem(SEEN_KEY, JSON.stringify(nextSeenAt));
  window.dispatchEvent(new Event('wellen-status-seen'));
}

export function markAllInvoiceStatusesSeen() {
  markInvoiceStatusSeen('ALL');
  localStorage.setItem(UNREAD_COUNT_KEY, '0');
  window.dispatchEvent(new Event('wellen-status-notifications'));
}
