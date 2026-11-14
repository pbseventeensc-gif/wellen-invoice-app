'use client';

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { parseClientImport } from '@/utils/clientImport';
import { importClients } from '@/utils/clientDirectory';
import { displayName } from '@/utils/invoiceDisplay';

export default function ClientImport({ onSaved, disabled, compact = false }) {
  const input = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const choose = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setPreview(null); setBusy(true);
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Choose an Excel or CSV file.');
      if (file.size > 5 * 1024 * 1024) throw new Error('Choose a file smaller than 5 MB.');
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '', raw: false });
      setPreview({ ...parseClientImport(matrix), fileName: file.name });
    } catch (failure) { setError(failure.message || 'The file could not be read.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!preview || busy) return;
    setBusy(true); setError('');
    try {
      const count = await importClients(preview.rows);
      setPreview(null);
      onSaved(`${count} clients imported.`);
    } catch (failure) {
      setError(['PGRST202', '42883'].includes(failure.code) ? 'Client import database setup is required. Apply the import_clients migration, then retry.' : 'Import failed. No clients were saved. Check your connection and access, then retry.');
    } finally { setBusy(false); }
  };
  return <section className={`space-y-3 rounded-xl border border-slate-200 bg-white ${compact ? 'min-h-16 px-3 py-2.5' : 'p-4'}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xs font-medium text-slate-700">Import clients</h2><p className="mt-0.5 text-[11px] leading-4 text-slate-500">Excel / CSV · Client name + Address · Max. 500 clients</p></div>
      <input ref={input} type="file" accept=".xlsx,.xls,.csv" onChange={choose} className="hidden" aria-label="Import client names and addresses" />
      <button type="button" disabled={disabled || busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 disabled:opacity-50"><Upload size={14} />{busy ? 'Processing…' : 'Choose file'}</button>
    </div>
    {error && <p role="alert" className="text-xs leading-5 text-rose-700">{error}</p>}
    {preview && <div className="space-y-3 border-t border-slate-100 pt-3">
      <div className="flex items-start justify-between gap-3"><p className="min-w-0 break-words text-xs text-slate-600">{preview.fileName} · {preview.rows.length} clients{preview.duplicates ? ` · ${preview.duplicates} duplicate rows skipped` : ''}</p><button type="button" disabled={busy} aria-label="Cancel client import" onClick={() => setPreview(null)}><X size={15} /></button></div>
      <p className="text-xs leading-5 text-slate-500">Existing client names will have their saved address updated. Invoice records already saved stay unchanged.</p>
      <div className="max-h-52 overflow-auto rounded-lg border border-slate-200"><table className="w-full table-fixed text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="w-1/3 p-3 font-normal">Client name</th><th className="p-3 font-normal">Address</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.name} className="border-t border-slate-100"><td className="break-words p-3 align-top">{displayName(row.name)}</td><td className="whitespace-pre-line break-words p-3 text-slate-500">{row.address}</td></tr>)}</tbody></table></div>
      <button type="button" disabled={disabled || busy} onClick={save} className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700 disabled:opacity-50">{busy ? 'Importing…' : `Import ${preview.rows.length} clients`}</button>
    </div>}
  </section>;
}
