'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import userAvatar from '@/assets/logo_userlogin.png';
import { isRouteAllowed } from '@/config/permissions';
import FeedbackDialog from '@/components/ui/FeedbackDialog';
import { markAllInvoiceStatusesSeen } from '@/utils/invoiceNotifications';
import { listInvoiceWorkflows } from '@/utils/invoiceWorkflow';
import { 
  Database,
  FileCheck2,
  ClipboardCheck,
  BarChart3, 
  ArrowUpRight,
  LogOut,
  Trash2
} from 'lucide-react';

export default function WhiteSubpanel() {
  const pathname = usePathname();
  const router = useRouter();

  // Initial state harus identik antara server & client untuk mencegah hydration mismatch.
  // Nilai dari localStorage disinkronkan di useEffect setelah mount.
  const [profile, setProfile] = useState({ name: 'Account', role: 'Role not assigned' });
  const [notificationCount, setNotificationCount] = useState(0);
  const [approvalQueueCount, setApprovalQueueCount] = useState(0);
  const [feedback, setFeedback] = useState(null);

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
    setFeedback({
      variant: 'confirm',
      title: 'Clear sample data?',
      description: 'This removes all invoice, approval queue, and POS staging data from this browser.',
      confirmLabel: 'Clear sample data',
    });
  };

  const confirmResetAllData = () => {
    setFeedback(null);
    try {
      localStorage.removeItem('wellen_invoices');
      localStorage.removeItem('wellen_approval_queue');
      localStorage.removeItem('wellen_wpp_staging');
      localStorage.removeItem('wellen_imported_wpp');
      localStorage.removeItem('wellen_new_status_count');
      localStorage.removeItem('wellen_invoice_status_seen');
      sessionStorage.removeItem('wellen_staged_items');
      sessionStorage.removeItem('wellen_import_source');

      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('wellen-status-notifications'));
      setFeedback({
        variant: 'success',
        title: 'Sample data cleared',
        description: 'Invoice, approval queue, and POS staging data have been removed from this browser.',
      });
    } catch (error) {
      console.error('Failed to clear sample data:', error);
      setFeedback({
        variant: 'error',
        title: 'Sample data could not be cleared',
        description: 'The browser did not allow the local data to be removed. Please try again.',
      });
    }
  };

  useEffect(() => {
    cleanLegacyMockData();
    const updateNotificationCount = async () => {
      const count = Number(localStorage.getItem('wellen_new_status_count') || 0);
      setNotificationCount(Number.isFinite(count) ? count : 0);
      try {
        const queue = await listInvoiceWorkflows(['waiting_approval']);
        setApprovalQueueCount(queue.length);
      } catch (error) {
        console.error('Failed to read approval queue count:', error);
      }
    };
    updateNotificationCount();
    window.addEventListener('storage', updateNotificationCount);
    window.addEventListener('wellen-invoice-workflows', updateNotificationCount);
    window.addEventListener('wellen-status-notifications', updateNotificationCount);

    const loadProfile = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          setProfile({ name: 'Account', role: 'Role not assigned' });
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .maybeSingle();
        if (error) throw error;

        setProfile({
          name: data?.full_name || user.email?.split('@')[0] || 'Account',
          role: data?.role || 'Role not assigned',
        });
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };

    loadProfile();
    return () => {
      window.removeEventListener('storage', updateNotificationCount);
      window.removeEventListener('wellen-invoice-workflows', updateNotificationCount);
      window.removeEventListener('wellen-status-notifications', updateNotificationCount);
    };
  }, []);

  const handleLogout = async () => {
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('wellen_'))
        .forEach((key) => localStorage.removeItem(key));
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith('wellen_'))
        .forEach((key) => sessionStorage.removeItem(key));

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Failed to clear local invoice data or sign out:', error);
      setFeedback({
        variant: 'error',
        title: 'Could not securely sign out',
        description: 'Local invoice data could not be cleared or your session could not be closed. Please try again before leaving this shared device.',
      });
    }
  };

  const allInvoiceMenus = [
    { label: 'Master POS / Draft', href: '/master-pos', icon: Database },
    { label: 'Invoices', href: '/invoices', icon: FileCheck2 },
    { label: 'Approval Queue', href: '/approval', icon: ClipboardCheck },
  ];

  const allReportMenus = [
    { label: 'Accounting Reports', href: '/accounting-reports', icon: BarChart3 },
    { label: 'DJP e-Faktur Exporter', href: '/efaktur-export', icon: ArrowUpRight },
  ];

  const visibleInvoiceMenus = allInvoiceMenus.filter((item) =>
    isRouteAllowed(profile.role, item.href)
  );
  const visibleReportMenus = allReportMenus.filter((item) =>
    isRouteAllowed(profile.role, item.href)
  );

  return (
    <div className="flex h-full w-56 shrink-0 select-none flex-col justify-between border-r border-slate-200 bg-white px-3 py-5">
      <div>
        {/* Header Modul */}
        <div className="mb-6 px-2">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Sales & Invoicing</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">Wellen Workspace</p>
        </div>

        {/* Section: INVOICES */}
        {visibleInvoiceMenus.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Invoices & Queue
            </p>
            <div className="space-y-1">
              {visibleInvoiceMenus.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-amber-50 font-semibold text-amber-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                    }`}
                    onClick={() => {
                      if (item.href === '/invoices') markAllInvoiceStatusesSeen();
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className={isActive ? 'text-amber-600' : 'text-slate-400'} />
                      <span>{item.label}</span>
                    </div>
                    {item.href === '/invoices' && notificationCount > 0 && (
                      <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    )}
                    {item.href === '/approval' && approvalQueueCount > 0 && (
                      <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                        {approvalQueueCount > 99 ? '99+' : approvalQueueCount}
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
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
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
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-amber-50 font-semibold text-amber-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-amber-600' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
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
              <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
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
      <FeedbackDialog
        open={Boolean(feedback)}
        variant={feedback?.variant}
        title={feedback?.title}
        description={feedback?.description}
        confirmLabel={feedback?.confirmLabel}
        onConfirm={confirmResetAllData}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}
