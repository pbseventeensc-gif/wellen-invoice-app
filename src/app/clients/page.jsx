'use client';

import PageHeading from '@/components/ui/PageHeading';

import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, X } from 'lucide-react';
import TablePagination from '@/components/ui/TablePagination';
import ClientImport from '@/components/clients/ClientImport';
import { listClients, saveClient } from '@/utils/clientDirectory';
import { displayName } from '@/utils/invoiceDisplay';
import { supabase } from '@/lib/supabase';
import { normalizeRole } from '@/config/permissions';

function addressLines(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  const words = text.split(' ');
  if (words.length < 2) return [text];
  let split = 1;
  for (let index = 2; index < words.length; index++) {
    if (Math.abs(words.slice(0, index).join(' ').length - text.length / 2) < Math.abs(words.slice(0, split).join(' ').length - text.length / 2)) split = index;
  }
  return [words.slice(0, split).join(' '), words.slice(split).join(' ')];
}

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [role, setRole] = useState(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const canEdit = ['super admin', 'approval'].includes(role);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await listClients();
        if (active) { setClients(data); setError(''); }
      } catch {
        if (active) setError('The client directory could not be loaded. Check your connection or ask an administrator to finish database setup.');
      } finally { if (active) setLoading(false); }
    };
    const loadRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (active) setRole(normalizeRole(data?.role));
    };
    load(); loadRole();
    window.addEventListener('wellen-clients', load);
    return () => { active = false; window.removeEventListener('wellen-clients', load); };
  }, []);

  const filtered = useMemo(() => clients.filter((client) => `${client.name} ${client.address} ${client.phone_number || ''}`.toLowerCase().includes(search.trim().toLowerCase())), [clients, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const reset = () => { setEditingId(null); setName(''); setAddress(''); setPhoneNumber(''); setNotice(''); setFormOpen(true); };
  const submit = async (event) => {
    event.preventDefault();
    if (!canEdit || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const saved = await saveClient({ id: editingId, name, address, phoneNumber });
      setClients((previous) => [...previous.filter((client) => client.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)));
      setEditingId(null);
      setFormOpen(false);
      setNotice('Client saved. New invoices will use this address automatically.');
    } catch (failure) {
      setError(['PGRST202', '42883'].includes(failure.code) ? 'Phone number storage needs database setup. Apply the client_phone_numbers migration, then save again.' : failure.code === '23505' ? 'Another client already uses this name. Select that client to edit its address.' : 'The client could not be saved. Check your access and database setup, then try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="invoice-workspace mx-auto min-w-0 max-w-[1800px] space-y-4 pb-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <PageHeading title="Clients" />
          <p className="mt-1 text-sm leading-6 text-slate-500">Client names and billing addresses shared across invoices.</p>
        </div>
      </header>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      <div className="min-w-0 space-y-4">
        {canEdit && <>
          <div className="grid items-start gap-3 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)]">
            <div className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <div><h2 className="text-xs font-medium text-slate-700">Manual entry</h2><p className="mt-0.5 text-[11px] text-slate-500">Add or edit when needed</p></div>
              <button type="button" onClick={reset} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-orange-50"><Plus size={13} />New client</button>
            </div>
            <ClientImport compact disabled={saving || loading} onSaved={(message) => { setNotice(message); setError(''); }} />
          </div>
          {formOpen && <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-medium text-slate-700">{editingId ? 'Edit client' : 'New client'}</h2><button type="button" disabled={saving} aria-label="Close client form" onClick={() => setFormOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-50"><X size={14} /></button></div>
            <div className="grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(150px,0.7fr)_minmax(0,1.5fr)_auto]">
              <label className="block text-xs text-slate-600">Client name
                <input id="client-name" autoFocus required maxLength={300} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-orange-400" />
              </label>
              <label className="block text-xs text-slate-600">Phone number
                <input id="client-phone" type="tel" autoComplete="tel" maxLength={50} value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="e.g. +62 812 3456 7890" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-orange-400" />
              </label>
              <label className="block text-xs text-slate-600">Billing address
                <textarea required maxLength={4000} rows={2} value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-orange-400" />
              </label>
              <button disabled={saving || loading} className="mb-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save client'}</button>
            </div>
          </form>}
        </>}
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5">
            <span className="text-xs text-slate-500">{clients.length} clients · {clients.filter((client) => !client.address).length} need an address</span>
            <label className="relative w-full sm:max-w-xs"><Search size={14} className="absolute left-3 top-2.5 text-slate-400" /><input type="search" aria-label="Search clients" placeholder="Search name, address or phone…" value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }} className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs" /></label>
          </div>
          <div className="data-table-scroll">
            <table className="data-table w-full min-w-[960px] table-fixed border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-[13px] text-slate-600">
                <tr>
                  <th scope="col" className="w-14 px-3 py-2.5 font-medium">No</th>
                  <th scope="col" className="w-60 px-3 py-2.5 font-medium">Customer</th>
                  <th scope="col" className="w-36 px-3 py-2.5 font-medium">Phone Number</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Billing Address</th>
                  <th scope="col" className="w-40 px-3 py-2.5 font-medium">Address Status</th>
                  {canEdit && <th scope="col" className="w-24 px-3 py-2.5 text-right font-medium">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan={canEdit ? 6 : 5} className="px-4 py-12 text-center text-slate-500">Loading clients…</td></tr>
                  : filtered.length === 0 ? <tr><td colSpan={canEdit ? 6 : 5} className="px-4 py-12 text-center text-slate-500">{search ? 'No matching clients.' : 'No clients yet. Save an Excel import to add its clients.'}</td></tr>
                  : paginated.map((client, index) => (
                    <tr key={client.id} className={`transition-colors hover:bg-slate-50 ${editingId === client.id ? 'bg-orange-50/50' : ''}`}>
                      <td className="px-3 py-2.5 text-slate-400">{(page - 1) * pageSize + index + 1}</td>
                      <td className="w-60 max-w-60 px-3 py-2.5 text-slate-800" title={client.name}><span className="line-clamp-2 break-words leading-5">{displayName(client.name)}</span></td>
                      <td className="px-3 py-2.5 text-slate-500"><span className="block break-words" title={client.phone_number || ''}>{client.phone_number || '—'}</span></td>
                      <td className="px-3 py-2.5 text-slate-600" title={client.address || ''}>{client.address ? addressLines(client.address).map((line, lineIndex) => <span key={lineIndex} className="block truncate leading-5">{line}</span>) : <span className="text-slate-400">Address not provided.</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] ${client.address ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{client.address ? 'Complete' : 'Needs address'}</span></td>
                      {canEdit && <td className="px-3 py-2.5 text-right"><button type="button" aria-label={`Edit ${displayName(client.name)}`} onClick={() => { setEditingId(client.id); setName(displayName(client.name)); setAddress(client.address || ''); setPhoneNumber(client.phone_number || ''); setNotice(''); setFormOpen(true); requestAnimationFrame(() => document.getElementById('client-name')?.focus()); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:border-orange-300 hover:bg-orange-50"><Pencil size={12} />Edit</button></td>}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <TablePagination currentPage={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setCurrentPage} />
        </section>
      </div>
    </div>
  );
}
