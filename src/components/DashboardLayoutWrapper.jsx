'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { supabase } from '@/lib/supabase';
import { isRouteAllowed } from '@/config/permissions';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function DashboardLayoutWrapper({ children }) {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState(null);
  const [loadingRole, setLoadingRole] = useState(true);

  const isAuthPage = pathname === '/login' || pathname === '/forgot-password' || pathname === '/reset-password';

  useEffect(() => {
    if (isAuthPage) {
      setLoadingRole(false);
      return;
    }

    const checkRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

          setUserRole(data?.role || 'AR Created');
        } else {
          setUserRole('AR Created');
        }
      } catch (e) {
        setUserRole('AR Created');
      } finally {
        setLoadingRole(false);
      }
    };

    checkRole();
  }, [pathname, isAuthPage]);

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
    <div className="flex min-h-screen antialiased">
      <Sidebar />
      <main className="flex-1 overflow-y-auto max-h-screen p-8 bg-stone-100 text-stone-900">
        {!loadingRole && !isAllowed ? (
          <div className="min-h-[70vh] flex items-center justify-center">
            <div className="bg-white p-8 max-w-md w-full rounded-3xl border border-stone-200/80 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-700 flex items-center justify-center mx-auto border border-stone-200">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-stone-900 tracking-tight">Access Restricted</h2>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Your current account role (<strong className="text-stone-900">{userRole}</strong>) does not have permission to access the <span className="font-mono text-stone-900">{pathname}</span> page.
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