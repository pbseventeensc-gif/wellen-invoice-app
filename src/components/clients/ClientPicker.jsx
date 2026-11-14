'use client';

import { Plus } from 'lucide-react';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { displayName } from '@/utils/invoiceDisplay';

export default function ClientPicker({ clients, value, onSelect, onManual }) {
  const selected = clients.find((client) => displayName(client.name) === value);
  return <SearchableSelect
    aria-label="Client"
    value={selected?.id ?? ''}
    options={clients.map((client) => ({ value: client.id, label: displayName(client.name), description: client.address || 'No saved address' }))}
    placeholder={value || 'Select a client…'}
    searchPlaceholder="Search name or address…"
    className="w-full"
    onValueChange={(id) => onSelect(clients.find((client) => client.id === id))}
    footer={({ query, close }) => <button type="button" onClick={() => { onManual(query.trim()); close(); }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs text-slate-700 hover:bg-orange-50"><Plus size={15} />Enter client manually…</button>}
  />;
}
