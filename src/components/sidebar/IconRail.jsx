'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, 
  FileSpreadsheet,
  Clock,
  FileCheck2,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Users,
  Settings 
} from 'lucide-react';

export default function IconRail() {
  const pathname = usePathname();
  const [pendingRejectedCount, setPendingRejectedCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      try {
        const storedStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
        const approvalQueue = JSON.parse(localStorage.getItem('wellen_approval_queue') || '[]');

        const waitingCount = approvalQueue.reduce((acc, q) => acc + (q.items?.length || 0), 0) + storedStaging.filter((it) => it.status === 'waiting_approval').length;
        const rejectedCount = storedStaging.filter((it) => it.status === 'rejected').length;

        setPendingRejectedCount(waitingCount + rejectedCount);
      } catch (e) {
        setPendingRejectedCount(0);
      }
    };
    updateCount();
    window.addEventListener('storage', updateCount);
    return () => window.removeEventListener('storage', updateCount);
  }, []);

  return (
    <div className="w-16 bg-[#0f172a] text-slate-400 flex flex-col items-center justify-between py-4 border-r border-slate-800 shrink-0 select-none">
      {/* Brand Icon Mini */}
      <div className="flex flex-col items-center gap-5">
        <Link href="/" title="Wellen Home" className="w-10 h-10 relative flex items-center justify-center rounded-lg hover:opacity-90 transition-opacity overflow-hidden">
          <Image
            src="/logo-wellen.png"
            alt="Wellen Logo"
            width={30}
            height={30}
            className="object-contain"
          />
        </Link>

        {/* Top Icons */}
        <div className="flex flex-col items-center gap-2.5">
          {/* 1. Home Dashboard */}
          <Link
            href="/"
            title="Dashboard"
            className={`p-2.5 rounded-xl transition-all ${
              pathname === '/'
                ? 'bg-[#578ef5]/20 text-[#578ef5] border border-[#578ef5]/30 shadow-2xs'
                : 'hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Home size={20} />
          </Link>

          {/* 2. Import WPP & Create Invoice */}
          <Link
            href="/import"
            title="Import WPP (Excel & PO)"
            className={`p-2.5 rounded-xl transition-all ${
              pathname === '/import' || pathname === '/create-invoice'
                ? 'bg-[#578ef5]/20 text-[#578ef5] border border-[#578ef5]/30 shadow-2xs'
                : 'hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileSpreadsheet size={20} />
          </Link>

          {/* 3. Status Approval */}
          <Link
            href="/status-approval"
            title="Status Approval"
            className={`p-2.5 rounded-xl transition-all relative ${
              pathname === '/status-approval'
                ? 'bg-[#578ef5]/20 text-[#578ef5] border border-[#578ef5]/30 shadow-2xs'
                : 'hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock size={20} />
            {pendingRejectedCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full font-mono">
                {pendingRejectedCount}
              </span>
            )}
          </Link>

          {/* 4. Invoice List */}
          <Link
            href="/invoices"
            title="Invoice List"
            className={`p-2.5 rounded-xl transition-all ${
              pathname === '/invoices'
                ? 'bg-[#578ef5]/20 text-[#578ef5] border border-[#578ef5]/30 shadow-2xs'
                : 'hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileCheck2 size={20} />
          </Link>

          {/* 5. Accounting Reports & e-Faktur */}
          <Link
            href="/accounting-reports"
            title="Accounting Reports & e-Faktur"
            className={`p-2.5 rounded-xl transition-all ${
              pathname === '/accounting-reports' || pathname === '/efaktur-export'
                ? 'bg-[#578ef5]/20 text-[#578ef5] border border-[#578ef5]/30 shadow-2xs'
                : 'hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 size={20} />
          </Link>

          {/* 6. Approved Invoices */}
          <Link
            href="/approved-invoices"
            title="Approved Invoices"
            className={`p-2.5 rounded-xl transition-all ${
              pathname === '/approved-invoices'
                ? 'bg-[#578ef5]/20 text-[#578ef5] border border-[#578ef5]/30 shadow-2xs'
                : 'hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CheckCircle2 size={20} />
          </Link>
        </div>
      </div>

      {/* Bottom Settings Icons */}
      <div className="flex flex-col items-center gap-3">
        <button className="p-2.5 rounded-xl hover:text-white hover:bg-slate-800/60 transition-colors" title="Users">
          <Users size={20} />
        </button>
        <button className="p-2.5 rounded-xl hover:text-white hover:bg-slate-800/60 transition-colors" title="Settings">
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
