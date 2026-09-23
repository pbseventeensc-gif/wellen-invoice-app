'use client';

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
  Users,
  Settings 
} from 'lucide-react';

export default function IconRail() {
  const pathname = usePathname();

  return (
    <div className="w-16 bg-[#0f172a] text-slate-400 flex flex-col items-center justify-between py-4 border-r border-slate-800 shrink-0 select-none">
      {/* Brand Icon Mini */}
      <div className="flex flex-col items-center gap-5">
        <Link href="/" className="w-10 h-10 relative flex items-center justify-center rounded-lg hover:opacity-90 transition-opacity">
          <Image 
            src="/logo-wellen.png" 
            alt="Wellen Logo"
            width={30} 
            height={30} 
            className="object-contain"
          />
        </Link>

        {/* Top Icons - Urutan Berurutan Sesuai Menu Workspace */}
        <div className="flex flex-col items-center gap-2.5">
          {/* 1. Home Dashboard */}
          <Link
            href="/"
            title="Dashboard"
            className={`p-2.5 rounded-xl transition-all ${
              pathname === '/'
                ? 'bg-[#c2410c]/20 text-[#ea580c] border border-[#ea580c]/30 shadow-2xs'
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
                ? 'bg-[#c2410c]/20 text-[#ea580c] border border-[#ea580c]/30 shadow-2xs'
                : 'hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileSpreadsheet size={20} />
          </Link>

          {/* 3. Approval Queue */}
          <Link
            href="/approval"
            title="Approval Queue"
            className={`p-2.5 rounded-xl transition-all ${
              pathname === '/approval'
                ? 'bg-[#c2410c]/20 text-[#ea580c] border border-[#ea580c]/30 shadow-2xs'
                : 'hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock size={20} />
          </Link>

          {/* 4. Invoice List */}
          <Link
            href="/invoices"
            title="Invoice List"
            className={`p-2.5 rounded-xl transition-all ${
              pathname === '/invoices'
                ? 'bg-[#c2410c]/20 text-[#ea580c] border border-[#ea580c]/30 shadow-2xs'
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
                ? 'bg-[#c2410c]/20 text-[#ea580c] border border-[#ea580c]/30 shadow-2xs'
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
                ? 'bg-[#c2410c]/20 text-[#ea580c] border border-[#ea580c]/30 shadow-2xs'
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