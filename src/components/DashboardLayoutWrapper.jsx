'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { supabase } from '@/lib/supabase';
import { isRouteAllowed } from '@/config/permissions';
import { ShieldAlert, ArrowLeft, Loader2, Menu, X } from 'lucide-react';

export default function DashboardLayoutWrapper({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [roleState, setRoleState] = useState({ pathname: null, role: null, loading: true });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const loadingRole = roleState.pathname !== pathname || roleState.loading;
  const userRole = roleState.pathname === pathname ? roleState.role : null;

  // Close mobile drawer on route transition (React-recommended pattern during render)
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setIsMobileOpen(false);
  }

  const isAuthPage = pathname === '/login' || pathname === '/forgot-password' || pathname === '/reset-password';

  useEffect(() => {
    if (isAuthPage) return;

    let isMounted = true;
    const checkRole = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          if (isMounted) router.replace('/login?error=session');
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (isMounted) setRoleState({ pathname, role: data?.role || null, loading: false });
      } catch (e) {
        console.error('Failed to verify user access:', e);
        if (isMounted) setRoleState({ pathname, role: null, loading: false });
      } finally {
        if (isMounted) {
          setRoleState((current) => (
            current.pathname === pathname && current.loading
              ? { pathname, role: null, loading: false }
              : current
          ));
        }
      }
    };

    checkRole();
    return () => {
      isMounted = false;
    };
  }, [pathname, isAuthPage, router]);

  if (isAuthPage) {
    return (
      <main className="min-h-screen w-full">
        {children}
      </main>
    );
  }

  // Tampilan Akses Ditolak (Unauthorized Access)
  const isAllowed = !loadingRole && userRole && isRouteAllowed(userRole, pathname);

  return (
    <div className="flex min-h-screen antialiased flex-col md:flex-row bg-stone-100">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-stone-200 sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo-wellen.png"
            alt="Wellen Logo"
            width={28}
            height={28}
            className="object-contain"
            priority
          />
          <span className="font-bold text-sm text-stone-900 tracking-tight">Wellen Invoicing</span>
        </div>
        <button
          type="button"
          aria-label={isMobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 transition cursor-pointer"
        >
          {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-stone-900/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Desktop & Mobile Slide-over Drawer */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 transform md:transform-none md:static md:flex h-screen shrink-0 transition-transform duration-200 ease-in-out shadow-2xl md:shadow-none
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <Sidebar />
      </aside>

      <main className="flex-1 overflow-y-auto max-h-screen p-3 md:p-5 bg-stone-100 text-stone-900 w-full min-w-0">
        {loadingRole ? (
          <div className="min-h-[70vh] flex items-center justify-center" role="status">
            <Loader2 size={24} className="animate-spin text-stone-500" />
            <span className="sr-only">Checking account access</span>
          </div>
        ) : !isAllowed ? (
          <div className="min-h-[70vh] flex items-center justify-center">
            <div className="bg-white p-8 max-w-md w-full rounded-3xl border border-stone-200/80 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center mx-auto border border-stone-200">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-stone-900 tracking-tight">Access Restricted</h2>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Your current account role (<strong className="text-stone-900">{userRole || 'Unassigned'}</strong>) does not have permission to access the <span className="font-mono text-stone-900">{pathname}</span> page.
                </p>
              </div>
              <Link
                href="/invoices"
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-2xs transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Return to Invoice List</span>
              </Link>
            </div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
