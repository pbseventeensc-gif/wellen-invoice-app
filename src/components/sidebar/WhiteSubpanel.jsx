'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isRouteAllowed } from '@/config/permissions';
import userAvatar from '@/assets/logo_userlogin.png';
import { 
  FileSpreadsheet, 
  FileText, 
  Clock, 
  FileCheck2, 
  BarChart3, 
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  LogOut
} from 'lucide-react';

export default function WhiteSubpanel() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingDownloadCount, setPendingDownloadCount] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [pendingRejectedCount, setPendingRejectedCount] = useState(0);
  const [profile, setProfile] = useState({
    name: 'FAHADA',
    role: 'AR Created',
  });

  const updateApprovedCount = () => {
    try {
      const stored = localStorage.getItem('wellen_invoices');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const unprinted = parsed.filter((inv) => !inv.time_download).length;
          setPendingDownloadCount(unprinted);
        }
      } else {
        setPendingDownloadCount(0);
      }
    } catch (e) {
      console.error(e);
      setPendingDownloadCount(0);
    }
  };

  const updateApprovalCount = () => {
    try {
      const stored = localStorage.getItem('wellen_approval_queue');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPendingApprovalCount(parsed.length);
        }
      } else {
        setPendingApprovalCount(0);
      }
    } catch (e) {
      console.error(e);
      setPendingApprovalCount(0);
    }
  };

  const updateRejectedCount = () => {
    try {
      const stored = localStorage.getItem('wellen_rejected_invoices');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPendingRejectedCount(parsed.length);
        }
      } else {
        setPendingRejectedCount(0);
      }
    } catch (e) {
      setPendingRejectedCount(0);
    }
  };

  useEffect(() => {
    updateApprovedCount();
    updateApprovalCount();
    updateRejectedCount();
    window.addEventListener('storage', updateApprovedCount);
    window.addEventListener('storage', updateApprovalCount);
    window.addEventListener('storage', updateRejectedCount);

    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const email = user.email?.toLowerCase() || '';
          const { data, error } = await supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', user.id)
            .maybeSingle();

          let defaultName = 'FAHADA';
          let defaultRole = 'AR Created';

          if (email.includes('keyjia')) {
            defaultName = 'KEYJIA';
            defaultRole = 'AR Created';
          } else if (email.includes('fahada')) {
            defaultName = 'FAHADA';
            defaultRole = 'AR Created';
          } else if (email.includes('rizkha') || email.includes('risca')) {
            defaultName = 'RISCA';
            defaultRole = 'Approval';
          } else if (email.includes('tanita')) {
            defaultName = 'TANITA';
            defaultRole = 'Approval';
          }

          if (error) {
            console.error('Error fetching profile:', error.message);
          }

          setProfile({
            name: data?.full_name || defaultName,
            role: data?.role || defaultRole,
          });
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };

    loadProfile();

    return () => {
      window.removeEventListener('storage', updateApprovedCount);
      window.removeEventListener('storage', updateApprovalCount);
      window.removeEventListener('storage', updateRejectedCount);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const allInvoiceMenus = [
    { label: 'Import WPP (Excel)', href: '/import', icon: FileSpreadsheet },
    { label: 'Create Invoice', href: '/create-invoice', icon: FileText },
    { label: 'Approval Queue', href: '/approval', icon: Clock },
    { label: 'Status Approval', href: '/status-approval', icon: AlertCircle },
    { label: 'Invoice List', href: '/invoices', icon: FileCheck2 },
  ];

  const allReportMenus = [
    { label: 'Accounting Reports', href: '/accounting-reports', icon: BarChart3 },
    { label: 'DJP e-Faktur Exporter', href: '/efaktur-export', icon: ArrowUpRight },
  ];

  const visibleInvoiceMenus = allInvoiceMenus.filter((m) => isRouteAllowed(profile.role, m.href));
  const visibleReportMenus = allReportMenus.filter((m) => isRouteAllowed(profile.role, m.href));
  const showApprovedInvoices = isRouteAllowed(profile.role, '/approved-invoices');

  return (
    <div className="w-64 bg-white border-r border-stone-200/80 flex flex-col justify-between py-6 px-4 shrink-0 select-none">
      <div>
        {/* Header Modul */}
        <div className="mb-6 px-2">
          <h2 className="text-base font-bold text-stone-900 tracking-tight">Sales & Invoicing</h2>
          <p className="text-[11px] text-stone-400 mt-0.5">Wellen Workspace</p>
        </div>

        {/* Section: INVOICES */}
        {visibleInvoiceMenus.length > 0 && (
          <div className="mb-6">
            <p className="px-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
              Invoices & Queue
            </p>
            <div className="space-y-1">
              {visibleInvoiceMenus.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                const isApprovalQueue = item.href === '/approval';
                const isStatusApproval = item.href === '/status-approval';
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#578ef5]/10 text-[#578ef5] font-semibold border border-[#578ef5]/20 shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={15} className={isActive ? 'text-[#578ef5]' : isStatusApproval ? 'text-rose-500' : 'text-stone-400'} />
                      <span>{item.label}</span>
                    </div>
                    {isApprovalQueue && pendingApprovalCount > 0 && (
                      <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                        {pendingApprovalCount}
                      </span>
                    )}
                    {isStatusApproval && pendingRejectedCount > 0 && (
                      <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                        {pendingRejectedCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Section: REPORTS */}
        {(visibleReportMenus.length > 0 || showApprovedInvoices) && (
          <div>
            <p className="px-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">
              Reports & Tax
            </p>
            <div className="space-y-1">
              {visibleReportMenus.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#578ef5]/10 text-[#578ef5] font-semibold border border-[#578ef5]/20 shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                    }`}
                  >
                    <Icon size={15} className={isActive ? 'text-[#578ef5]' : 'text-stone-400'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* Menu Approved Invoices */}
              {showApprovedInvoices && (
                <Link
                  href="/approved-invoices"
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    pathname === '/approved-invoices'
                      ? 'bg-[#578ef5]/10 text-[#578ef5] font-semibold border border-[#578ef5]/20 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    <span>Approved Invoices</span>
                  </div>
                  {pendingDownloadCount > 0 && (
                    <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                      {pendingDownloadCount}
                    </span>
                  )}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Profil User + Tombol Logout */}
      <div className="border-t border-stone-100 pt-4 px-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative inline-block">
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-stone-200 bg-stone-100">
                <Image
                  src={userAvatar}
                  alt={profile.name}
                  fill
                  sizes="32px"
                  className="object-cover"
                  priority
                />
              </div>
              <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-stone-900 leading-tight">{profile.name}</p>
              <p className="text-[10px] text-stone-400 font-medium">{profile.role}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
