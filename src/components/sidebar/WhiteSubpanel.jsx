'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isRouteAllowed, normalizeRole } from '@/config/permissions';
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
  LogOut,
  Trash2
} from 'lucide-react';

export default function WhiteSubpanel() {
  const pathname = usePathname();
  const router = useRouter();

  const [pendingDownloadCount, setPendingDownloadCount] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const stored = localStorage.getItem('wellen_invoices');
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed.filter((inv) => !inv.time_download).length : 0;
      }
    } catch {
      return 0;
    }
    return 0;
  });

  const [pendingApprovalCount, setPendingApprovalCount] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const stored = localStorage.getItem('wellen_approval_queue');
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed.length : 0;
      }
    } catch {
      return 0;
    }
    return 0;
  });

  const [pendingRejectedCount, setPendingRejectedCount] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const storedStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
      const approvalQueue = JSON.parse(localStorage.getItem('wellen_approval_queue') || '[]');
      const waitingCount = approvalQueue.reduce((acc, q) => acc + (q.items?.length || 0), 0) + storedStaging.filter((it) => it.status === 'waiting_approval').length;
      const rejectedCount = storedStaging.filter((it) => it.status === 'rejected').length;
      return waitingCount + rejectedCount;
    } catch {
      return 0;
    }
  });

  const [profile, setProfile] = useState(() => {
    if (typeof window === 'undefined') return { name: 'FAHADA', role: 'Super Admin' };
    const savedUser = (localStorage.getItem('wellen_testing_user') || '').toLowerCase();
    if (savedUser.includes('rizkha') || savedUser.includes('risca')) {
      return { name: 'RISCA', role: 'Approval' };
    }
    if (savedUser.includes('tanita')) {
      return { name: 'TANITA', role: 'Approval' };
    }
    if (savedUser.includes('keyjia')) {
      return { name: 'KEYJIA', role: 'AR Created' };
    }
    if (savedUser.includes('fahada')) {
      return { name: 'FAHADA', role: 'AR Created' };
    }
    return { name: 'Admin Testing', role: 'Super Admin' };
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
      const storedStaging = JSON.parse(localStorage.getItem('wellen_wpp_staging') || '[]');
      const approvalQueue = JSON.parse(localStorage.getItem('wellen_approval_queue') || '[]');

      const waitingCount = approvalQueue.reduce((acc, q) => acc + (q.items?.length || 0), 0) + storedStaging.filter((it) => it.status === 'waiting_approval').length;
      const rejectedCount = storedStaging.filter((it) => it.status === 'rejected').length;

      setPendingRejectedCount(waitingCount + rejectedCount);
    } catch (e) {
      setPendingRejectedCount(0);
    }
  };

  const cleanLegacyMockData = () => {
    try {
      const storedInvoices = localStorage.getItem('wellen_invoices');
      if (storedInvoices) {
        const parsed = JSON.parse(storedInvoices);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((it) => !it.id?.startsWith('wpk-default'));
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('wellen_invoices', JSON.stringify(cleaned));
          }
        }
      }

      const storedQueue = localStorage.getItem('wellen_approval_queue');
      if (storedQueue) {
        const parsed = JSON.parse(storedQueue);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((it) => it.id !== 'wpk-1001');
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('wellen_approval_queue', JSON.stringify(cleaned));
          }
        }
      }

      const storedStaging = localStorage.getItem('wellen_wpp_staging');
      if (storedStaging) {
        const parsed = JSON.parse(storedStaging);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((it) => !it.id?.startsWith('imp-') && !it.wpp_number?.startsWith('WPP-2026-'));
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('wellen_wpp_staging', JSON.stringify(cleaned));
          }
        }
      }
    } catch (e) {
      console.error('Error cleaning legacy mock data:', e);
    }
  };

  const handleResetAllData = () => {
    if (window.confirm('Hapus semua data invoice, antrean approval, dan staging untuk testing bersih?')) {
      localStorage.removeItem('wellen_invoices');
      localStorage.removeItem('wellen_approval_queue');
      localStorage.removeItem('wellen_wpp_staging');
      localStorage.removeItem('wellen_imported_wpp');
      sessionStorage.removeItem('wellen_staged_items');
      sessionStorage.removeItem('wellen_import_source');

      setPendingDownloadCount(0);
      setPendingApprovalCount(0);
      setPendingRejectedCount(0);

      window.dispatchEvent(new Event('storage'));
      alert('Semua data testing telah dibersihkan (0 item). Halaman akan dimuat ulang.');
      window.location.reload();
    }
  };

  useEffect(() => {
    cleanLegacyMockData();
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
    router.push('/login');
    router.refresh();
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

  // Samakan tampilan untuk semua role (Admin & User melihat menu yang sama persis)
  const visibleInvoiceMenus = allInvoiceMenus;
  const visibleReportMenus = allReportMenus;
  const showApprovedInvoices = true;

  return (
    <div className="w-64 bg-white border-r border-stone-200/80 flex flex-col justify-between py-6 px-4 shrink-0 select-none">
      <div>
        {/* Header Modul */}
        <div className="mb-6 px-2">
          <h2 className="text-base font-bold text-stone-900 tracking-tight">Sales & Invoicing</h2>
          <p className="text-[11px] text-stone-500 font-medium mt-0.5">Wellen Workspace</p>
        </div>

        {/* Section: INVOICES */}
        {visibleInvoiceMenus.length > 0 && (
          <div className="mb-6">
            <p className="px-3 text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-2">
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
                        ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200 shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={15} className={isActive ? 'text-blue-600' : isStatusApproval ? 'text-rose-500' : 'text-stone-400'} />
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
        {visibleReportMenus.length > 0 && (
          <div className="mb-6">
            <p className="px-3 text-[10px] font-bold text-stone-600 uppercase tracking-wider mb-2">
              Compliance & Reporting
            </p>
            <div className="space-y-1">
              {visibleReportMenus.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200 shadow-2xs'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                    }`}
                  >
                    <Icon size={15} className={isActive ? 'text-blue-600' : 'text-stone-400'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* Shortcut Approved Invoices */}
              {showApprovedInvoices && (
                <Link
                  href="/approved-invoices"
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    pathname === '/approved-invoices'
                      ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={15} className={pathname === '/approved-invoices' ? 'text-emerald-700' : 'text-emerald-600'} />
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

      {/* Reset Data Testing */}
      <div className="px-1 pb-3">
        <button
          onClick={handleResetAllData}
          type="button"
          title="Hapus semua data mock/sampel"
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
        >
          <Trash2 size={13} />
          <span>Bersihkan Sampel Data</span>
        </button>
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
              <p className="text-[10px] text-stone-500 font-semibold">{profile.role}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
