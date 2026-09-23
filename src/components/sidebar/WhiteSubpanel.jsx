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
  LogOut
} from 'lucide-react';

export default function WhiteSubpanel() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingDownloadCount, setPendingDownloadCount] = useState(0);
  const [profile, setProfile] = useState({
    name: 'Admin',
    role: 'Super Admin',
  });

  const updateApprovedCount = () => {
    try {
      const stored = localStorage.getItem('wellen_invoices');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Hitung hanya invoice yang belum diunduh (time_download bernilai null/kosong)
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

  useEffect(() => {
    updateApprovedCount();
    window.addEventListener('storage', updateApprovedCount);

    // Ambil data profil dari tabel Supabase
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', user.id)
            .maybeSingle();

          if (error) {
            console.error('Error fetching profile:', error.message);
            return;
          }

          if (data) {
            setProfile({
              name: data.full_name || user.email?.split('@')[0]?.toUpperCase() || 'Admin',
              role: data.role || 'AR Created',
            });
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };

    loadProfile();

    return () => window.removeEventListener('storage', updateApprovedCount);
  }, []);

  // Fungsi Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // Filter Menu Berdasarkan Hak Akses Role
  const allInvoiceMenus = [
    { label: 'Import WPP (Excel)', href: '/import', icon: FileSpreadsheet },
    { label: 'Create Invoice', href: '/create-invoice', icon: FileText },
    { label: 'Approval Queue', href: '/approval', icon: Clock },
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
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between py-6 px-4 shrink-0 select-none">
      <div>
        {/* Header Modul */}
        <div className="mb-6 px-2">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Sales & Invoicing</h2>
          <div className="mt-3 flex gap-4 border-b border-slate-200 pb-2">
            <span className="text-xs font-bold text-[#c2410c] border-b-2 border-[#c2410c] pb-2 -mb-2.5 cursor-pointer">
              Workspace
            </span>
          </div>
        </div>

        {/* Section: INVOICES */}
        {visibleInvoiceMenus.length > 0 && (
          <div className="mb-6">
            <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Invoices
            </p>
            <div className="space-y-1">
              {visibleInvoiceMenus.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-[#fff7ed] text-[#c2410c] border border-[#ffedd5]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'text-[#ea580c]' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Section: REPORTS */}
        {(visibleReportMenus.length > 0 || showApprovedInvoices) && (
          <div>
            <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Reports
            </p>
            <div className="space-y-1">
              {visibleReportMenus.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-[#fff7ed] text-[#c2410c] border border-[#ffedd5]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={16} className={isActive ? 'text-[#ea580c]' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* Menu Approved Invoices */}
              {showApprovedInvoices && (
                <Link
                  href="/approved-invoices"
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all mt-2 ${
                    pathname === '/approved-invoices'
                      ? 'bg-[#fff7ed] text-[#c2410c] border border-[#ffedd5]'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>Approved Invoices</span>
                  </div>
                  {pendingDownloadCount > 0 && (
                    <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
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
      <div className="border-t border-slate-100 pt-4 px-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative inline-block">
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-orange-200 bg-orange-50 shadow-sm">
                <Image
                  src={userAvatar}
                  alt={profile.name}
                  fill
                  sizes="36px"
                  className="object-cover"
                  priority
                />
              </div>
              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 leading-tight">{profile.name}</p>
              <p className="text-[10px] text-slate-400">{profile.role}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}