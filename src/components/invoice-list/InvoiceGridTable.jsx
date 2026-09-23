'use client';

import { Download, FileText } from 'lucide-react';
import { formatRupiah } from '@/utils/taxCalculator';

export default function InvoiceGridTable({ invoices, onDownloadPdf }) {
  if (invoices.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-400 shadow-sm">
        <FileText size={40} className="mx-auto mb-3 text-stone-300" />
        <p className="text-sm font-medium text-stone-600">Belum ada data invoice.</p>
        <p className="text-xs text-stone-400 mt-1">Buat invoice baru dari file rekapan Excel melalui menu Import WPP.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto max-h-[600px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-stone-50 text-stone-600 sticky top-0 border-b border-stone-200 uppercase font-semibold text-[11px] tracking-wider">
            <tr>
              <th className="p-3.5">No Invoice</th>
              <th className="p-3.5">Klien (PT)</th>
              <th className="p-3.5">Nama Project / Promo</th>
              <th className="p-3.5 text-right">Nilai Inv</th>
              <th className="p-3.5 text-right">DPP Lain</th>
              <th className="p-3.5 text-right">PPN (11%)</th>
              <th className="p-3.5 text-right">Total</th>
              <th className="p-3.5">AR Create Inv</th>
              <th className="p-3.5">Time Created</th>
              <th className="p-3.5">Time Download</th>
              <th className="p-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-amber-50/40 transition-colors">
                <td className="p-3.5 font-mono font-bold text-amber-700">{inv.invoice_number}</td>
                <td className="p-3.5 font-semibold text-stone-800">{inv.client_name}</td>
                <td className="p-3.5 text-stone-600">{inv.promo_name || '-'}</td>
                <td className="p-3.5 text-right font-mono text-stone-700">{formatRupiah(inv.total_harga_net)}</td>
                <td className="p-3.5 text-right font-mono text-stone-500">
                  {inv.is_dpp_active ? formatRupiah(inv.dpp_lain) : '-'}
                </td>
                <td className="p-3.5 text-right font-mono text-stone-700">{formatRupiah(inv.ppn_amount)}</td>
                <td className="p-3.5 text-right font-mono font-bold text-stone-900">{formatRupiah(inv.grand_total)}</td>
                <td className="p-3.5 font-medium text-stone-700">
                  <span className="bg-stone-100 px-2 py-0.5 rounded border border-stone-200 text-[11px]">
                    {inv.ar_name || 'Keyjia / Fahada'}
                  </span>
                </td>
                <td className="p-3.5 text-stone-500 whitespace-nowrap">{inv.time_created}</td>
                <td className="p-3.5 text-stone-500 whitespace-nowrap">
                  {inv.time_download || <span className="text-stone-400 italic">Belum diunduh</span>}
                </td>
                <td className="p-3.5 text-center">
                  <button
                    onClick={() => onDownloadPdf(inv.id)}
                    title="Download Invois PDF"
                    className="p-1.5 rounded-lg bg-stone-100 hover:bg-amber-500 hover:text-stone-950 text-stone-600 transition-colors inline-flex items-center"
                  >
                    <Download size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}