'use client';

import { Printer, X, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { useState, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { formatRupiah } from '@/utils/taxCalculator';
import { invoicePrintStyles } from '@/utils/invoicePrintStyles.js';
import { addressLines, isSingleItemLayout } from '@/utils/printFormatting';
import WellenLogo from '@/components/common/WellenLogo';

const subscribeToPrintPortal = () => () => {};
const getPrintPortalSnapshot = () => document.body;
const getServerPrintPortalSnapshot = () => null;

function getInternalDppBreakdown(invoice) {
  return {
    goods: Number(invoice.items?.reduce((sum, item) => sum + Number(item.dpp_nilai_lain_barang || 0), 0)
      || invoice.total_dpp_nilai_lain_barang
      || invoice.dpp_nilai_lain_barang
      || 0),
    printing: Number(invoice.items?.reduce((sum, item) => sum + Number(item.dpp_nilai_lain_jasa_cetak || 0), 0)
      || invoice.total_dpp_nilai_lain_jasa_cetak
      || invoice.dpp_nilai_lain_jasa_cetak
      || 0),
  };
}

function getPrintFilename(invoices) {
  const wpkNumbers = invoices.map((invoice) => {
    const candidates = [
      invoice.invoice_number,
      invoice.wpp_number,
      invoice.no_faktur,
      ...(invoice.items || []).flatMap((item) => [item.no_faktur, item.wpp_number]),
    ].filter(Boolean);
    return candidates.find((number) => /^WPK\b/i.test(String(number).trim())) || candidates[0];
  }).filter(Boolean);

  return (wpkNumbers.length ? wpkNumbers.join(' - ') : 'Invoice')
    .replace(/[\/\\?%*:|"<>]/g, '-');
}

export default function PrintModal({ invoice, invoices, isOpen, onClose, onPrintConfirmed, initialShowInternal = false }) {
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [showInternalBreakdown, setShowInternalBreakdown] = useState(initialShowInternal);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setShowInternalBreakdown(initialShowInternal);
    }
  }
  const portalTarget = useSyncExternalStore(
    subscribeToPrintPortal,
    getPrintPortalSnapshot,
    getServerPrintPortalSnapshot
  );
  const printInvoices = invoices?.length ? invoices : invoice ? [invoice] : [];

  if (!isOpen || printInvoices.length === 0 || !portalTarget) return null;

  const handlePrint = () => {
    try {
      const originalTitle = document.title;
      document.title = getPrintFilename(printInvoices);

      if (typeof onPrintConfirmed === 'function') {
        onPrintConfirmed(printInvoices.map((item) => item.id));
      }

      window.print();

      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    } catch (e) {
      console.error('Failed to trigger print:', e);
      window.print();
    }
  };

  return createPortal((
    <div className="print-modal-root fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm sm:p-6 print:static print:block print:overflow-visible print:bg-white print:p-0">
      <style media="print">{invoicePrintStyles}</style>
      <div className="print-modal-card my-4 w-[210mm] max-w-[calc(100vw-2rem)] overflow-visible rounded-2xl border border-stone-200 bg-stone-200 shadow-2xl print:my-0 print:block print:w-auto print:max-w-none print:overflow-visible print:border-none print:shadow-none">
        {/* Header Action Bar - Polos & Clean White Style */}
        <div className="print-actions sticky top-0 z-20 p-3.5 px-5 bg-white border-b border-stone-200 text-stone-900 flex items-center justify-between shadow-2xs print:hidden">
          <div className="text-xs font-medium flex items-center gap-2.5">
            <span className="text-stone-500">Document Preview:</span>
            <span className="text-stone-900 font-mono font-medium bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
              {printInvoices.length === 1
                ? printInvoices[0].invoice_number
                : `${printInvoices.length} invoices selected`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowInternalBreakdown((visible) => !visible)}
              aria-pressed={showInternalBreakdown}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {showInternalBreakdown ? <EyeOff size={14} /> : <Eye size={14} />}
              {showInternalBreakdown ? 'Hide internal totals' : 'Show internal totals'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <Printer size={14} />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 hover:text-stone-800 p-2 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Kertas Invoice Fisik */}
        <div id="print-area" className="flex flex-col items-center gap-6 bg-stone-200 text-black text-xs print:block print:bg-white">
          {printInvoices.map((invoice, invoiceIndex) => {
            const internalBreakdown = getInternalDppBreakdown(invoice);
            const hasJasaCetakRow = invoice.items?.some(
              (item) => (item.item_description || item.description || item.store_name || '').toUpperCase() === 'JASA CETAK'
            );
            const jasaCetakValue = Number(
              invoice.total_jasa_cetak ??
              invoice.totalJasaCetak ??
              invoice.discountJasaCetak ??
              invoice.discount_jasa_cetak ??
              invoice.jasaCetak ??
              0
            ) || invoice.items?.reduce((sum, item) => sum + (Number(item.jasa_cetak) || 0), 0) || 0;
            const rowCount = (invoice.items?.length || 0) + (!hasJasaCetakRow && jasaCetakValue > 0 ? 1 : 0);
            const singleItemLayout = isSingleItemLayout(invoice, showInternalBreakdown);
            const densityClass = rowCount <= 6 ? 'print-density-short' : rowCount <= 12 ? 'print-density-medium' : 'print-density-long';
            return (
        <div
          key={invoice.id || `${invoice.invoice_number}-${invoiceIndex}`}
          className={`print-sheet ${densityClass}${!showInternalBreakdown ? ' print-internal-hidden' : ''}${singleItemLayout ? ' print-single-item' : ''}`}
        >
          <div className="print-sheet-body space-y-4">
            {/* Tabel Rincian Barang Standard */}
            {(() => {
              const isPoSource = invoice.importSource === 'po' || invoice.items?.some((it) => it.isPoSource || (it.uom && it.uom !== 'PCS'));
              const columnCount = isPoSource ? 5 : 3;

              return (
                <table className="invoice-line-table w-full text-left border-collapse border-b border-stone-400 text-xs">
                  <colgroup>
                    <col style={{ width: '6%' }} />
                    <col style={{ width: isPoSource ? '56%' : '70%' }} />
                    {isPoSource && <><col style={{ width: '7%' }} /><col style={{ width: '7%' }} /></>}
                    <col style={{ width: '24%' }} />
                  </colgroup>
                  <thead className="border-b border-stone-400">
                    <tr>
                      <th colSpan={columnCount} className="invoice-letterhead-cell border-b border-stone-400 px-3 py-2 text-black">
                        <div className="print-letterhead-layout flex items-start justify-between gap-4">
                          <div className="print-letterhead-company w-1/2 min-w-0 text-left">
                            <div className="print-letterhead-logo-row flex items-center gap-2">
                              <WellenLogo />
                            </div>
                          </div>
                          <div className="print-letterhead-number shrink-0 text-right">
                            <span className="block text-[10px] font-medium tracking-wider">INVOICE</span>
                            <p className="mt-0.5 text-xs font-medium">{invoice.invoice_number}</p>
                            <p className="mt-0.5 text-[9px] font-medium">
                              Date: {invoice.invoice_date || invoice.time_created?.slice(0, 10)}
                            </p>
                          </div>
                          <p className="print-letterhead-contact mt-1.5 text-[9px] font-medium leading-relaxed break-words">
                            Jl. Raya Pasar Minggu No.49, RT.2/RW.7<br />Duren Tiga, Jakarta Selatan<br />
                            Phone : 021-7988314 | Email : finance@wellenprint.com
                          </p>
                        </div>
                      </th>
                    </tr>
                    <tr>
                      <th colSpan={columnCount} className="border-b border-stone-400 px-3 py-2 text-left font-normal text-black">
                        <span className="print-bill-label block mb-0.5 uppercase">Bill to :</span>
                        <p className="print-client-name">{invoice.client_name}</p>
                        <div className="print-client-address mt-1">
                          {addressLines(invoice.client_address || 'Jakarta, Indonesia').map((line, index) => (
                            <span key={index} className="block min-h-[1.4em]">{line || '\u00a0'}</span>
                          ))}
                        </div>
                      </th>
                    </tr>
                    <tr className="print-column-headings">
                      <th className="bg-stone-200 py-2 px-3 border-r border-stone-400 w-10 text-center text-black font-medium">No</th>
                      <th className="print-description-heading bg-stone-200 py-2 px-3 border-r border-stone-400 text-black font-medium">ITEM DESCRIPTION</th>
                      {isPoSource && (
                        <>
                          <th className="bg-stone-200 py-2 px-2.5 border-r border-stone-400 w-16 text-center text-black font-medium">QTY</th>
                          <th className="bg-stone-200 py-2 px-2.5 border-r border-stone-400 w-16 text-center text-black font-medium">UOM</th>
                        </>
                      )}
                      <th className="bg-stone-200 py-2 px-3 text-right w-40 text-black font-medium">TOTAL PRICE</th>
                    </tr>
                  </thead>
                  <tbody className="print-line-items divide-y divide-stone-300 font-medium">
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
                          {isPoSource && (
                            <>
                              <td className="py-2 px-2.5 text-center border-r border-stone-300 font-mono text-black font-medium">
                                {it.qty || 1}
                              </td>
                              <td className="py-2 px-2.5 text-center border-r border-stone-300 font-mono text-black font-medium">
                                {it.uom || 'PCS'}
                              </td>
                            </>
                          )}
                          <td className="py-2 px-3 text-right font-mono text-black font-medium">{formatRupiah(it.nilai_barang || it.nilaiBarang || it.total_price || it.price || 0)}</td>
                        </tr>
                      );
                    })}

                    {(() => {
                      const hasJasaCetakRow = invoice.items?.some(
                        (it) => (it.item_description || it.description || it.store_name || '').toUpperCase() === 'JASA CETAK'
                      );
                      const jasaVal =
                        Number(
                          invoice.total_jasa_cetak ??
                          invoice.totalJasaCetak ??
                          invoice.discountJasaCetak ??
                          invoice.discount_jasa_cetak ??
                          invoice.jasaCetak ??
                          0
                        ) ||
                        invoice.items?.reduce((sum, it) => sum + (Number(it.jasa_cetak) || 0), 0) ||
                        0;

                      if (!hasJasaCetakRow && jasaVal > 0) {
                        return (
                          <tr className="bg-stone-50/50">
                            <td className="py-2 px-3 text-center border-r border-stone-300 text-black font-medium">*</td>
                            <td className="py-2 px-3 border-r border-stone-300 font-medium text-black">PRINTING SERVICE</td>
                            {isPoSource && (
                              <>
                                <td className="py-2 px-2.5 text-center border-r border-stone-300 font-mono text-black font-medium">1</td>
                                <td className="py-2 px-2.5 text-center border-r border-stone-300 font-mono text-black font-medium">PCS</td>
                              </>
                            )}
                            <td className="py-2 px-3 text-right font-mono text-black font-medium">
                              {formatRupiah(jasaVal)}
                            </td>
                          </tr>
                        );
                      }
                      return null;
                    })()}
                  </tbody>
                </table>
              );
            })()}
          </div>

          {/* Footer Kertas Invoice */}
          <div className="invoice-print-footer mt-auto pt-6 space-y-4">

            <div className="invoice-summary grid grid-cols-2 gap-5 items-start">
              <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-300 h-full flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-medium text-black uppercase tracking-wider block mb-1">
                    FILE NAME:
                  </span>
                  <p className="print-promo-name font-medium text-black text-xs">{invoice.promo_name || '-'}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-stone-300 text-[11px] text-black font-medium">
                  <p>Created By: <span className="text-black font-medium">{invoice.ar_name || invoice.created_by || 'FAHADA'}</span></p>
                </div>
              </div>

              <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-300 space-y-1.5 text-xs font-medium">
                <div className="flex justify-between text-black font-semibold">
                  <span>TOTAL:</span>
                  <span className="font-mono text-black font-medium">
                    {formatRupiah(invoice.total_harga_net || invoice.totalHargaNet)}
                  </span>
                </div>

                {invoice.is_dpp_active && (
                  <div className="flex justify-between text-black font-semibold border-t border-stone-300 pt-1">
                    <span>Alternative Tax Base:</span>
                    <span className="font-mono text-black font-medium">{formatRupiah(invoice.dpp_lain || invoice.dppLain)}</span>
                  </div>
                )}

                <div className="flex justify-between text-black font-semibold border-t border-stone-300 pt-1">
                  <span>VAT:</span>
                  <span className="font-mono text-black font-medium">
                    {formatRupiah(invoice.ppn_amount || invoice.ppnAmount)}
                  </span>
                </div>

                {(invoice.total_pph23 > 0 || invoice.pph23_amount > 0 || invoice.wht > 0) && (
                  <div className="flex justify-between text-black font-semibold border-t border-stone-300 pt-1">
                    <span>WHT:</span>
                    <span className="font-mono text-black font-medium">
                      -{formatRupiah(invoice.total_pph23 || invoice.pph23_amount || invoice.wht)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between font-medium border-t border-stone-400 pt-2 text-xs text-black">
                  <span>GRAND TOTAL:</span>
                  <span className="font-mono text-black font-medium text-sm">
                    {formatRupiah(invoice.grand_total || invoice.grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {showInternalBreakdown && (
              <div className="invoice-internal-breakdown rounded-lg border border-dashed border-amber-500 bg-amber-50/60 p-3 text-[11px] text-black">
                <p className="mb-1.5 font-medium uppercase tracking-wide">Internal breakdown — Alternative Tax Base</p>
                <div className="flex justify-between gap-4">
                  <span>Total Alternative Tax Base — Goods</span>
                  <span className="font-mono font-medium">{formatRupiah(internalBreakdown.goods)}</span>
                </div>
                <div className="mt-1 flex justify-between gap-4">
                  <span>Total Alternative Tax Base — Printing Service</span>
                  <span className="font-mono font-medium">{formatRupiah(internalBreakdown.printing)}</span>
                </div>
              </div>
            )}
            <div className="invoice-bottom">
<div className="invoice-payment grid grid-cols-2 gap-5 items-end mb-3">
              <div className="space-y-1.5">
                <span className="font-medium text-xs tracking-wider block text-black uppercase">
                  PAYMENT INFO
                </span>
                <table className="text-[11px] font-medium text-black">
                  <tbody>
                    <tr>
                      <td className="w-18 py-0.5 font-medium text-black">ACCOUNT</td>
                      <td className="w-3 py-0.5">:</td>
                      <td className="py-0.5 font-mono font-medium text-black">0038-3000-327</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-medium text-black">A/C NAME</td>
                      <td className="py-0.5">:</td>
                      <td className="py-0.5 font-medium text-black">PT WELLEN BROTHERS</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-medium text-black">BANK</td>
                      <td className="py-0.5">:</td>
                      <td className="py-0.5 font-medium text-black">Bank SMBC Indonesia Cab Gunung Sahari</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="ml-auto w-48 max-w-full flex flex-col items-center justify-end text-center relative h-48 pb-1">
                {(() => {
                  const isApproved =
                    invoice.status === 'approved' ||
                    Boolean(invoice.approved_by) ||
                    Boolean(invoice.time_approved);

                  if (!isApproved) return null;

                  const approverName = String(
                    invoice.approved_by || invoice.approver_name || ''
                  ).toLowerCase();
                  const isTanita = approverName.includes('tanita');
                  const sigSrc = isTanita ? '/Tanita.svg' : '/risca.svg';
                  const sigAlt = isTanita ? 'Tanda Tangan Digital Tanita' : 'Tanda Tangan Digital Risca';

                  return (
                    <>
                      <div className="absolute top-4 w-48 max-w-full h-36 pointer-events-none select-none">
                        <Image
                          src="/stempel.svg"
                          alt="Stempel Wellen Brothers"
                          fill
                          sizes="192px"
                          className="object-contain mix-blend-multiply"
                        />
                      </div>

                      <div className="absolute top-12 w-40 max-w-full h-24 pointer-events-none select-none">
                        <Image
                          src={sigSrc}
                          alt={sigAlt}
                          fill
                          sizes="160px"
                          className="object-contain mix-blend-multiply"
                        />
                      </div>
                    </>
                  );
                })()}

                {invoice.approved_by && (
                  <p className="w-48 max-w-full text-center text-[11px] font-medium text-black tracking-wide z-10 mb-0.5">
                    {invoice.approved_by}
                  </p>
                )}
                <div className="w-48 max-w-full border-b border-black z-10"></div>
                <p className="w-48 max-w-full text-center text-[11px] font-medium text-black mt-1 z-10">Authorized Sign</p>
              </div>
            </div>

            <div className="invoice-notes border-t border-black pt-2.5">
              <p className="font-medium text-black text-[10px] mb-1">
                Note :
              </p>
              <div className="text-[10px] text-black font-medium leading-relaxed space-y-0.5 pl-2">
                <p>
                  - Please check after invoice received, any complaint after 14 days invoice received are unacceptable.
                </p>
                <p className="whitespace-nowrap">
                  - If you have any questions please don&apos;t hesitate to contact us by email: <span className="text-black font-medium">finance@wellenprint.com</span> or WA: <span className="text-black font-medium">0852 8181 8318</span>
                </p>
              </div>
            </div>
            </div>

          </div>
        </div>
            );
          })}
      </div>
    </div>
    </div>
  ), portalTarget);
}
