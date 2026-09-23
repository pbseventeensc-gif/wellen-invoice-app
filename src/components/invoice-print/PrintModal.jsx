'use client';

import { Printer, X } from 'lucide-react';
import Image from 'next/image';
import { formatRupiah } from '@/utils/taxCalculator';
import WellenLogo from '@/components/common/WellenLogo';

export default function PrintModal({ invoice, isOpen, onClose, onPrintConfirmed }) {
  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    const originalTitle = document.title;
    const sanitizedTitle = (invoice.invoice_number || 'Invoice')
      .replace(/[\/\\?%*:|"<>]/g, '-');
    document.title = sanitizedTitle;

    onPrintConfirmed(invoice.id);
    window.print();

    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-start print:p-0 print:bg-white print:overflow-hidden animate-in fade-in duration-200">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000000 !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm !important;
            height: 297mm !important;
            box-sizing: border-box !important;
            padding: 12mm 14mm 12mm 14mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            overflow: hidden !important;
          }
        }
      `}</style>

      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-4 border border-slate-200/90 print:border-none print:shadow-none print:my-0 animate-in zoom-in-95 duration-150">
        {/* Header Action Bar - Sleek Corporate Style */}
        <div className="sticky top-0 z-20 p-3.5 px-5 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between shadow-md print:hidden">
          <div className="text-xs font-medium flex items-center gap-2.5">
            <span className="text-slate-400">Document Preview:</span>
            <span className="text-white font-mono font-medium bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              {invoice.invoice_number}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-950 font-semibold px-4 py-2 rounded-xl text-xs shadow-2xs transition-colors cursor-pointer"
            >
              <Printer size={14} />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Kertas Invoice Fisik */}
        <div id="print-area" className="p-8 text-black bg-white text-xs flex flex-col justify-between min-h-[273mm] box-border">
          {/* Bagian Atas: Kop + Klien + Tabel Rincian */}
          <div className="space-y-4">
            {/* Header Kop Faktur */}
            <div className="flex justify-between items-start border-b border-stone-400 pb-3">
              <div>
                <div className="flex items-center gap-3">
                  <WellenLogo />
                  <div className="flex flex-col justify-center">
                    <h1 className="text-xl font-bold tracking-tight text-black leading-none">WELLEN PRINT</h1>
                    <p className="text-[11px] text-black font-medium leading-tight mt-1.5">
                      Digital Printing & Offset Services
                    </p>
                  </div>
                </div>

                <div className="text-[10px] text-black font-medium mt-2 leading-relaxed">
                  <p>Jl. Pasar Minggu Raya No. 9, Jakarta Selatan</p>
                  <p>Telp: (021) 7918-0000 | Email: billing@wellenprint.com</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold tracking-wider text-black block">INVOICE</span>
                <p className="font-mono text-sm font-bold text-black mt-0.5">{invoice.invoice_number}</p>
                <p className="text-[11px] text-black font-medium mt-0.5">
                  Date: {invoice.invoice_date || invoice.time_created?.slice(0, 10)}
                </p>
              </div>
            </div>

            {/* Info Klien */}
            <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-300">
              <span className="text-[10px] font-bold text-black uppercase tracking-wider block mb-0.5">
                INVOICE TO:
              </span>
              <p className="font-bold text-black text-xs">{invoice.client_name}</p>
              <p className="text-black text-[11px] whitespace-pre-line mt-0.5 font-medium leading-relaxed">
                {invoice.client_address || 'Jakarta, Indonesia'}
              </p>
            </div>

            {/* Tabel Rincian Barang */}
            <table className="w-full text-left border-collapse border border-stone-400 text-xs">
              <thead className="bg-stone-200 border-b border-stone-400">
                <tr>
                  <th className="py-2 px-3 border-r border-stone-400 w-10 text-center text-black font-bold">No</th>
                  <th className="py-2 px-3 border-r border-stone-400 text-black font-bold">ITEM DESCRIPTION</th>
                  <th className="py-2 px-2.5 border-r border-stone-400 w-16 text-center text-black font-bold">QTY</th>
                  <th className="py-2 px-2.5 border-r border-stone-400 w-16 text-center text-black font-bold">UOM</th>
                  <th className="py-2 px-3 text-right w-40 text-black font-bold">TOTAL PRICE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-300 font-medium">
                {invoice.items?.map((it, idx) => {
                  const descriptionText = 
                    it.item_description || 
                    it.description || 
                    it.item_name || 
                    it.product_name || 
                    it.name || 
                    it.title || 
                    it.text || 
                    it.jasa_cetak || 
                    '-';

                  return (
                    <tr key={it.id || idx}>
                      <td className="py-2 px-3 text-center border-r border-stone-300 text-black font-medium">{idx + 1}</td>
                      <td className="py-2 px-3 border-r border-stone-300 text-black font-medium">
                        {descriptionText}
                      </td>
                      <td className="py-2 px-2.5 text-center border-r border-stone-300 font-mono text-black font-bold">
                        {it.qty || 1}
                      </td>
                      <td className="py-2 px-2.5 text-center border-r border-stone-300 font-mono text-black font-bold">
                        {it.uom || 'PCS'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-black font-bold">{formatRupiah(it.total_price || it.price || 0)}</td>
                    </tr>
                  );
                })}

                {(() => {
                  const hasJasaCetak = invoice.items?.some(
                    (it) => it.isJasaCetak || (it.item_description || it.description || '').toUpperCase() === 'JASA CETAK'
                  );
                  const jasaVal = invoice.discountJasaCetak || invoice.jasaCetak || invoice.discount_jasa_cetak || 0;

                  if (!hasJasaCetak && jasaVal !== 0) {
                    return (
                      <tr className="bg-stone-50/50">
                        <td className="py-2 px-3 text-center border-r border-stone-300 text-black font-medium">*</td>
                        <td className="py-2 px-3 border-r border-stone-300 text-black font-medium">JASA CETAK</td>
                        <td className="py-2 px-2.5 text-center border-r border-stone-300 font-mono text-black font-bold">1</td>
                        <td className="py-2 px-2.5 text-center border-r border-stone-300 font-mono text-black font-bold">PCS</td>
                        <td className="py-2 px-3 text-right font-mono text-black font-bold">
                          {formatRupiah(Math.abs(jasaVal))}
                        </td>
                      </tr>
                    );
                  }
                  return null;
                })()}
              </tbody>
            </table>
          </div>

          {/* Bagian Bawah: Diturunkan Otomatis (mt-auto) ke Batas Bawah Kertas */}
          <div className="mt-auto pt-6 space-y-4">
            {/* Sisi Bawah Paralel: File Name di Kiri & Total di Kanan */}
            <div className="grid grid-cols-2 gap-5 items-start">
              {/* Kiri: File Name */}
              <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-300 h-full flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-black uppercase tracking-wider block mb-1">
                    FILE NAME:
                  </span>
                  <p className="font-bold text-black text-xs">{invoice.promo_name || '-'}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-stone-300 text-[11px] text-black font-medium">
                  <p>Created By: <span className="text-black font-bold">{invoice.ar_name || invoice.created_by || 'FAHADA'}</span></p>
                </div>
              </div>

              {/* Kanan: Ringkasan Total & Pajak */}
              <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-300 space-y-1.5 text-xs font-medium">
                <div className="flex justify-between text-black font-semibold">
                  <span>TOTAL:</span>
                  <span className="font-mono text-black font-bold">
                    {formatRupiah(invoice.total_harga_net || invoice.totalHargaNet)}
                  </span>
                </div>

                {invoice.is_dpp_active && (
                  <div className="flex justify-between text-black font-semibold border-t border-stone-300 pt-1">
                    <span>Other DPP:</span>
                    <span className="font-mono text-black font-bold">{formatRupiah(invoice.dpp_lain || invoice.dppLain)}</span>
                  </div>
                )}

                <div className="flex justify-between text-black font-semibold border-t border-stone-300 pt-1">
                  <span>VAT:</span>
                  <span className="font-mono text-black font-bold">
                    {formatRupiah(invoice.ppn_amount || invoice.ppnAmount)}
                  </span>
                </div>

                <div className="flex justify-between font-bold border-t border-stone-400 pt-2 text-xs text-black">
                  <span>GRAND TOTAL:</span>
                  <span className="font-mono text-black font-bold text-sm">
                    {formatRupiah(invoice.grand_total || invoice.grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Area Tengah Bawah: Payment Info & Stempel + Tanda Tangan PNG */}
            <div className="grid grid-cols-2 gap-5 items-end mb-3">
              {/* Sisi Kiri: Payment Info */}
              <div className="space-y-1.5">
                <span className="font-bold text-xs tracking-wider block text-black uppercase">
                  PAYMENT INFO
                </span>
                <table className="text-[11px] font-medium text-black">
                  <tbody>
                    <tr>
                      <td className="w-18 py-0.5 font-bold text-black">ACCOUNT</td>
                      <td className="w-3 py-0.5">:</td>
                      <td className="py-0.5 font-mono font-bold text-black">0038-3000-327</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold text-black">A/C NAME</td>
                      <td className="py-0.5">:</td>
                      <td className="py-0.5 font-bold text-black">PT WELLEN BROTHERS</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold text-black">BANK</td>
                      <td className="py-0.5">:</td>
                      <td className="py-0.5 font-medium text-black">Bank SMBC Indonesia Cab Gunung Sahari</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Sisi Kanan: Authorized Sign & Stempel + Tanda Tangan SVG */}
              <div className="flex flex-col items-center justify-end text-center relative h-28 pb-1">
                {/* 1. Stempel SVG */}
                <div className="absolute top-0 w-32 h-24 pointer-events-none select-none">
                  <Image
                    src="/stempel.svg"
                    alt="Stempel Wellen Brothers"
                    fill
                    sizes="128px"
                    className="object-contain mix-blend-multiply"
                  />
                </div>

                {/* 2. Tanda Tangan Digital Otomatis (Tanita.svg vs risca.svg) */}
                {(() => {
                  const approverName = String(
                    invoice.approved_by || invoice.approver_name || invoice.created_by || invoice.ar_name || ''
                  ).toLowerCase();
                  const isTanita = approverName.includes('tanita');
                  const sigSrc = isTanita ? '/Tanita.svg' : '/risca.svg';
                  const sigAlt = isTanita ? 'Tanda Tangan Digital Tanita' : 'Tanda Tangan Digital Risca';

                  return (
                    <div className="absolute top-5 w-28 h-14 pointer-events-none select-none">
                      <Image
                        src={sigSrc}
                        alt={sigAlt}
                        fill
                        sizes="112px"
                        className="object-contain mix-blend-multiply"
                      />
                    </div>
                  );
                })()}

                <div className="w-48 border-b border-black z-10"></div>
                <p className="text-[11px] font-bold text-black mt-1 z-10">Authorized Sign,</p>
              </div>
            </div>

            {/* Garis Hitam Pembatas & Note */}
            <div className="border-t border-black pt-2.5">
              <p className="font-bold text-black text-[10px] mb-1">
                Note :
              </p>
              <div className="text-[10px] text-black font-medium leading-relaxed space-y-0.5 pl-2">
                <p>
                  - Please check after invoice received, any complaint after 14 days invoice received are unacceptable.
                </p>
                <p className="whitespace-nowrap">
                  - If you have any questions please don&apos;t hesitate to contact us by email: <span className="text-black font-bold">finance@wellenprint.com</span> or WA: <span className="text-black font-bold">0852 8181 8318</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}