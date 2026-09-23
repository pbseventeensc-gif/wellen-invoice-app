'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Check, 
  X, 
  FileText, 
  CheckCircle2, 
  Trash2, 
  Search,
  AlertCircle
} from 'lucide-react';
import { formatRupiah } from '@/utils/taxCalculator';
import WellenLogo from '@/components/common/WellenLogo';
import { supabase } from '@/lib/supabase';

const INITIAL_APPROVAL_QUEUE = [
  {
    id: 'wpk-1001',
    invoice_number: 'WPK 0826-300006',
    invoice_date: '2026-09-10',
    client_name: 'PT ASPIRASI HIDUP INDONESIA TBK',
    client_address: 'EightyEight @Kasablanka Office Tower Lt. 30 Unit B\nJl. Casablanca Kav. 88 Tebet Jakarta Selatan - DKI Jakarta\n021 - 29820243',
    promo_name: 'PROMO ADHOC WEEKEND BOOM DEALS',
    created_by: 'FAHADA',
    ar_name: 'FAHADA',
    total_harga_net: 3263986,
    subtotal_net: 2937587,
    discountJasaCetak: 326399,
    ppn_amount: 323135,
    grand_total: 3260722,
    status: 'waiting_approval',
    items: [
      { id: '1', item_description: 'AZKO BINTARO XCHANGE', total_price: 1779166 },
      { id: '2', item_description: 'AZKO KOTA KASABLANKA', total_price: 1484820 },
    ],
  },
];

export default function ApprovalPage() {
  const [queue, setQueue] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [profile, setProfile] = useState({ name: 'RISCA', role: 'Approval' });

  // State untuk Modern Reject Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState(null);
  const [rejectReasonText, setRejectReasonText] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', user.id)
            .maybeSingle();

          if (data) {
            setProfile({
              name: data.full_name || 'RISCA',
              role: data.role || 'Approval',
            });
          }
        }
      } catch (err) {
        console.error('Failed to load profile for signature:', err);
      }
    };
    loadProfile();
  }, []);

  const loadQueue = () => {
    try {
      const stored = localStorage.getItem('wellen_approval_queue');
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        const data = Array.isArray(parsed) ? parsed : [];
        setQueue(data);
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
        }
      } else {
        setQueue(INITIAL_APPROVAL_QUEUE);
        setSelectedId(INITIAL_APPROVAL_QUEUE[0].id);
        localStorage.setItem('wellen_approval_queue', JSON.stringify(INITIAL_APPROVAL_QUEUE));
      }
    } catch (err) {
      console.error('Gagal membaca antrean approval:', err);
      setQueue([]);
    }
  };

  useEffect(() => {
    loadQueue();
    window.addEventListener('storage', loadQueue);
    return () => window.removeEventListener('storage', loadQueue);
  }, []);

  const activeInvoice = queue.find((q) => q.id === selectedId) || queue[0] || null;

  const handleApprove = (invoiceToApprove) => {
    if (!invoiceToApprove) return;

    const approvedItem = {
      ...invoiceToApprove,
      id: invoiceToApprove.id || `inv-${Date.now()}`,
      status: 'approved',
      ar_name: invoiceToApprove.created_by || invoiceToApprove.ar_name || 'FAHADA',
      approved_by: profile.name || 'RISCA',
      time_approved: new Date().toISOString().slice(0, 16).replace('T', ' '),
    };

    let existingInvoices = [];
    try {
      existingInvoices = JSON.parse(localStorage.getItem('wellen_invoices') || '[]');
    } catch (e) {
      existingInvoices = [];
    }
    const updatedInvoices = [
      approvedItem,
      ...existingInvoices.filter((inv) => inv.id !== approvedItem.id),
    ];
    localStorage.setItem('wellen_invoices', JSON.stringify(updatedInvoices));

    try {
      const existingStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
      const itemFakturSet = new Set(
        invoiceToApprove.items?.map((it) => it.no_faktur || it.wpp_number).filter(Boolean)
      );

      const updatedStaging = existingStaging.map((wpp) => {
        const wppNo = wpp.no_faktur || wpp.wpp_number;
        if (itemFakturSet.has(wppNo)) {
          return { ...wpp, status: 'invoiced' };
        }
        return wpp;
      });
      localStorage.setItem('wellen_wpp_staging', JSON.stringify(updatedStaging));
    } catch (e) {
      console.error('Gagal sinkron staging invoice:', e);
    }

    const nextQueue = queue.filter((q) => q.id !== invoiceToApprove.id);
    setQueue(nextQueue);
    localStorage.setItem('wellen_approval_queue', JSON.stringify(nextQueue));
    window.dispatchEvent(new Event('storage'));

    setSelectedId(nextQueue.length > 0 ? nextQueue[0].id : null);
    alert(`Invoice ${invoiceToApprove.invoice_number} successfully approved!`);
  };

  // Trigger buka modal modern
  const openRejectModal = (invoiceId) => {
    setRejectTargetId(invoiceId);
    setRejectReasonText('wrong quantity');
    setIsRejectModalOpen(true);
  };

  // Eksekusi penolakan dengan alasan
  const confirmReject = () => {
    if (!rejectTargetId) return;
    const targetInvoice = queue.find((q) => q.id === rejectTargetId);

    if (targetInvoice) {
      try {
        const existingStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
        const rejectedFakturSet = new Set(
          targetInvoice.items?.map((it) => it.no_faktur || it.wpp_number).filter(Boolean)
        );

        if (rejectedFakturSet.size === 0 && targetInvoice.invoice_number) {
          rejectedFakturSet.add(targetInvoice.invoice_number);
        }

        const updatedStaging = existingStaging.map((wpp) => {
          const wppNo = wpp.no_faktur || wpp.wpp_number;
          if (rejectedFakturSet.has(wppNo)) {
            return { 
              ...wpp, 
              status: 'rejected', 
              reject_reason: rejectReasonText || 'Needs revision'
            };
          }
          return wpp;
        });
        localStorage.setItem('wellen_wpp_staging', JSON.stringify(updatedStaging));
      } catch (e) {
        console.error('Failed to update reject status to staging:', e);
      }
    }

    const nextQueue = queue.filter((q) => q.id !== rejectTargetId);
    setQueue(nextQueue);
    localStorage.setItem('wellen_approval_queue', JSON.stringify(nextQueue));
    window.dispatchEvent(new Event('storage'));

    setSelectedId(nextQueue.length > 0 ? nextQueue[0].id : null);
    setIsRejectModalOpen(false);
    setRejectTargetId(null);
    alert('Invoice rejected and returned to Invoice List.');
  };

  const handleDeleteQueueItem = (id, invoiceNumber, e) => {
    e.stopPropagation();
    if (confirm(`Delete invoice ${invoiceNumber} from approval queue?`)) {
      const nextQueue = queue.filter((q) => q.id !== id);
      setQueue(nextQueue);
      localStorage.setItem('wellen_approval_queue', JSON.stringify(nextQueue));
      window.dispatchEvent(new Event('storage'));

      if (selectedId === id) {
        setSelectedId(nextQueue.length > 0 ? nextQueue[0].id : null);
      }
    }
  };

  const handleDeleteAllQueue = () => {
    if (queue.length === 0) return;
    if (confirm(`Delete ALL (${queue.length}) items from approval queue?`)) {
      setQueue([]);
      setSelectedId(null);
      localStorage.setItem('wellen_approval_queue', JSON.stringify([]));
      window.dispatchEvent(new Event('storage'));
    }
  };

  const filteredQueue = queue.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      item.invoice_number?.toLowerCase().includes(term) ||
      item.client_name?.toLowerCase().includes(term) ||
      item.promo_name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 relative">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Approval Queue</h1>
        <p className="text-xs text-stone-500 mt-1">
          Verify invoice details, DPP calculations, and overall amounts before final authorization.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-5 items-start">
        {/* KOLOM KIRI: MASTER LIST */}
        <div className="col-span-12 lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search WPK invoice or Client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500 text-stone-800 placeholder:text-stone-400"
              />
            </div>

            {queue.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAllQueue}
                className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                <Trash2 size={13} className="text-rose-600" />
                Delete All
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-stone-50 border-b border-stone-200 flex justify-between items-center text-xs">
              <span className="font-bold text-stone-700 uppercase tracking-wider text-[10px]">
                Pending Review ({filteredQueue.length})
              </span>
              <span className="text-[11px] text-stone-500 font-mono">Click row for preview</span>
            </div>

            <div className="max-h-[720px] overflow-y-auto divide-y divide-stone-100">
              {filteredQueue.length === 0 ? (
                <div className="p-10 text-center text-stone-400 space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500/80" />
                  <p className="text-xs font-medium text-stone-600">No active approval queue items.</p>
                </div>
              ) : (
                filteredQueue.map((item) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`p-3 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected 
                          ? 'bg-amber-50/70 border-l-4 border-l-amber-500' 
                          : 'hover:bg-stone-50/80'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs font-bold ${isSelected ? 'text-amber-800' : 'text-stone-900'}`}>
                            {item.invoice_number}
                          </span>
                          <span className="text-[9px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md">
                            Review
                          </span>
                        </div>
                        <p className="text-xs font-medium text-stone-800 truncate mt-0.5">
                          {item.client_name}
                        </p>
                        <p className="text-[10px] text-stone-400 truncate">
                          {item.promo_name || '-'}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-mono text-xs font-bold text-stone-900">
                          {formatRupiah(item.grand_total)}
                        </p>
                        <span className="text-[10px] text-stone-400 block mt-0.5">
                          {item.invoice_date}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteQueueItem(item.id, item.invoice_number, e)}
                        className="text-stone-300 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: PRATINJAU KERTAS FAKTUR */}
        <div className="col-span-12 lg:col-span-7">
          {activeInvoice ? (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="p-3.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                <div className="text-xs font-medium text-stone-600 flex items-center gap-1.5">
                  <FileText size={15} className="text-amber-500" />
                  <span>Invoice Validation Sheet: <strong>{activeInvoice.invoice_number}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openRejectModal(activeInvoice.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <X size={14} className="text-rose-600" />
                    Reject / Revise
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(activeInvoice)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    <Check size={14} />
                    Approve
                  </button>
                </div>
              </div>

              {/* Kertas Invoice Preview */}
              <div className="p-8 text-black text-xs flex flex-col justify-between min-h-[750px] bg-white font-normal">
                <div className="space-y-4">
                  <div className="flex justify-between items-start border-b border-stone-300 pb-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <WellenLogo />
                        <div className="flex flex-col justify-center">
                          <h2 className="text-xl tracking-tight text-black font-bold leading-none">WELLEN PRINT</h2>
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
                      <span className="text-xs tracking-wider text-black font-bold block">INVOICE</span>
                      <p className="font-mono text-sm text-black mt-0.5 font-bold">{activeInvoice.invoice_number}</p>
                      <p className="text-[11px] text-black font-medium mt-0.5">
                        Date: {activeInvoice.invoice_date}
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-stone-50/70 rounded-lg border border-stone-200">
                    <span className="text-[10px] text-black uppercase tracking-wider block mb-0.5 font-bold">
                      INVOICE TO:
                    </span>
                    <p className="text-black text-xs font-bold">{activeInvoice.client_name}</p>
                    <p className="text-black font-medium text-[11px] whitespace-pre-line mt-0.5 leading-relaxed">
                      {activeInvoice.client_address}
                    </p>
                  </div>

                  {/* Tabel Item */}
                  <table className="w-full text-left border-collapse border border-stone-300 text-xs">
                    <thead className="bg-stone-100/80 text-black font-bold border-b border-stone-300">
                      <tr>
                        <th className="py-2 px-3 border-r border-stone-300 w-10 text-center text-black font-bold">No</th>
                        <th className="py-2 px-3 border-r border-stone-300 text-black font-bold">ITEM DESCRIPTION</th>
                        <th className="py-2 px-2.5 border-r border-stone-300 w-16 text-center text-black font-bold">QTY</th>
                        <th className="py-2 px-2.5 border-r border-stone-300 w-16 text-center text-black font-bold">UOM</th>
                        <th className="py-2 px-3 text-right w-40 text-black font-bold">TOTAL PRICE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-300">
                      {activeInvoice.items?.map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td className="py-2 px-3 text-center border-r border-stone-300 text-black font-medium">{idx + 1}</td>
                          <td className="py-2 px-3 border-r border-stone-300 text-black font-medium">{it.item_description}</td>
                          <td className="py-2 px-2.5 text-center border-r border-stone-300 font-mono text-black font-bold">{it.qty || 1}</td>
                          <td className="py-2 px-2.5 text-center border-r border-stone-300 font-mono text-black font-bold">{it.uom || 'PCS'}</td>
                          <td className="py-2 px-3 text-right font-mono text-black font-bold">
                            {formatRupiah(it.total_price)}
                          </td>
                        </tr>
                      ))}

                      {(() => {
                        const hasJasaCetak = activeInvoice.items?.some(
                          (it) => it.isJasaCetak || (it.item_description || '').toUpperCase() === 'JASA CETAK'
                        );
                        const jasaVal = Number(activeInvoice.discountJasaCetak) || 0;

                        if (!hasJasaCetak && jasaVal !== 0) {
                          return (
                            <tr className="bg-stone-50/50 text-black">
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

                {/* Footer Kertas Invoice */}
                <div className="mt-auto pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-5 items-start">
                    <div className="p-3.5 bg-stone-50/70 rounded-lg border border-stone-200 h-full flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] text-black uppercase tracking-wider block mb-1 font-bold">
                          FILE NAME:
                        </span>
                        <p className="text-black text-xs font-bold">{activeInvoice.promo_name || '-'}</p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-stone-200/80 text-[11px] text-black font-medium">
                        <p>
                          Created By:{' '}
                          <span className="text-black font-bold">
                            {activeInvoice.created_by || 'FAHADA'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 bg-stone-50/70 rounded-lg border border-stone-200 space-y-1.5 text-xs">
                      <div className="flex justify-between text-black font-medium">
                        <span>TOTAL:</span>
                        <span className="font-mono text-black font-bold">
                          {formatRupiah(activeInvoice.total_harga_net)}
                        </span>
                      </div>

                      <div className="flex justify-between text-black font-medium border-t border-stone-100 pt-1">
                        <span>VAT:</span>
                        <span className="font-mono text-black font-bold">
                          {formatRupiah(activeInvoice.ppn_amount)}
                        </span>
                      </div>

                      <div className="flex justify-between border-t border-stone-300 pt-2 text-xs text-black font-bold">
                        <span>GRAND TOTAL:</span>
                        <span className="font-mono text-black font-bold">
                          {formatRupiah(activeInvoice.grand_total)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Info & Stamp */}
                  <div className="grid grid-cols-2 gap-5 items-end mb-3">
                    <div className="space-y-1.5">
                      <span className="text-xs tracking-wider block text-black uppercase font-bold">
                        PAYMENT INFO
                      </span>
                      <table className="text-[11px] text-black font-medium">
                        <tbody>
                          <tr>
                            <td className="w-18 py-0.5 text-black font-bold">ACCOUNT</td>
                            <td className="w-3 py-0.5 font-bold">:</td>
                            <td className="py-0.5 font-mono text-black font-bold">0038-3000-327</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 text-black font-bold">A/C NAME</td>
                            <td className="py-0.5 font-bold">:</td>
                            <td className="py-0.5 text-black font-bold">PT WELLEN BROTHERS</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 text-black font-bold">BANK</td>
                            <td className="py-0.5 font-bold">:</td>
                            <td className="py-0.5 text-black font-medium">Bank SMBC Indonesia Cab Gunung Sahari</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

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
                          activeInvoice?.approved_by || activeInvoice?.approver_name || profile.name || ''
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
                      <p className="text-[11px] text-black font-bold mt-1 z-10">Authorized Sign,</p>
                    </div>
                  </div>

                  {/* Note */}
                  <div className="border-t border-black pt-2.5">
                    <p className="text-black text-[10px] mb-1 font-bold">
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
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-stone-200 text-center text-stone-400">
              <FileText size={40} className="mx-auto text-stone-300 mb-2" />
              <p className="text-xs">No invoice selected for review.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODERN ENTERPRISE REJECT MODAL */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-md w-full p-6 space-y-5 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0 border border-slate-200">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Rejection / Revision Reason</h3>
                <p className="text-xs text-slate-500 mt-0.5">This explanation will be logged and displayed on the Invoice List page.</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Quick Tags Pilihan Cepat */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'wrong quantity',
                  'wrong price / discount',
                  'incomplete description',
                  'mismatched client data'
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setRejectReasonText(tag)}
                    className={`text-[11px] px-3 py-1 rounded-xl border transition-colors cursor-pointer capitalize ${
                      rejectReasonText === tag
                        ? 'bg-slate-900 text-white border-slate-900 font-medium'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Textarea Custom */}
              <textarea
                rows={3}
                placeholder="Or type specific rejection details..."
                value={rejectReasonText}
                onChange={(e) => setRejectReasonText(e.target.value)}
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-slate-400 text-slate-900 placeholder:text-slate-400 font-normal"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReject}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs transition-colors cursor-pointer"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}