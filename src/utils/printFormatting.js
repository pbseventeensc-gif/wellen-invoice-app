// Balance the complete address across three lines without clipping any words.
export function addressLines(value) {
  const explicit = String(value).trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (explicit.length === 3) return explicit;
  const words = explicit.join(' ').split(/\s+/).filter(Boolean);
  const lines = [];
  for (let remaining = 3; remaining > 0; remaining -= 1) {
    const target = words.join(' ').length / remaining;
    const line = [];
    while (words.length && (!line.length || (line.join(' ').length < target && words.length >= remaining))) {
      line.push(words.shift());
    }
    lines.push(line.join(' '));
  }
  return lines;
}

export function isSingleItemLayout(invoice, showInternalTotals) {
  if (showInternalTotals) return false;
  const items = invoice.items || [];
  const primaryItems = items.filter((item) => !['JASA CETAK', 'PRINTING SERVICE'].includes(
    String(item.item_description || item.description || item.store_name || '').trim().toUpperCase()
  ));
  return primaryItems.length === 1;
}
