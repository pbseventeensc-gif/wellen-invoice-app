'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, 
  Database,
  FileCheck2,
  ClipboardCheck,
  BarChart3,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { isRouteAllowed } from '@/config/permissions';
import { supabase } from '@/lib/supabase';
import { markAllInvoiceStatusesSeen } from '@/utils/invoiceNotifications';
import { listInvoiceWorkflows } from '@/utils/invoiceWorkflow';

export default function IconRail({ isSubpanelOpen, onToggleSubpanel }) {
  const pathname = usePathname();
  const [role, setRole] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [approvalQueueCount, setApprovalQueueCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadRole = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Failed to load navigation role:', authError);
        return;
      }
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (error) {
        console.error('Failed to load navigation role:', error);
        return;
      }
      if (isMounted) setRole(data?.role || null);
    };

    loadRole();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
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
    return () => {
      window.removeEventListener('storage', updateNotificationCount);
      window.removeEventListener('wellen-invoice-workflows', updateNotificationCount);
      window.removeEventListener('wellen-status-notifications', updateNotificationCount);
    };
  }, []);

  return (
    <div className="relative z-10 flex w-14 shrink-0 select-none flex-col items-center justify-between border-r border-slate-800 bg-slate-900 py-3 text-slate-400 shadow-[2px_0_8px_rgba(15,23,42,0.08)]">
      {/* Brand Icon Mini */}
      <div className="flex flex-col items-center gap-5">
        <Link href="/" title="Wellen Home" className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-white transition-opacity hover:opacity-80">
          <Image
            src="/logo-wellen.png"
            alt="Wellen Logo"
            width={30}
            height={30}
            className="object-contain"
          />
        </Link>
        <button
          type="button"
          onClick={onToggleSubpanel}
          aria-label={isSubpanelOpen ? 'Hide sidebar labels' : 'Show sidebar labels'}
          title={isSubpanelOpen ? 'Hide navigation panel' : 'Show navigation panel'}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-amber-300"
        >
          {isSubpanelOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>

        {/* Top Icons */}
        <div className="flex flex-col items-center gap-2">
          {/* 1. Home Dashboard */}
          {isRouteAllowed(role, '/') && <Link
            href="/"
            title="Dashboard"
            className={`rounded-lg p-2 transition-all ${
              pathname === '/'
                ? 'bg-amber-400/15 text-amber-300'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Home size={20} />
          </Link>}

          {isRouteAllowed(role, '/approval') && <Link
            href="/approval"
            title="Approval Queue"
            className={`relative rounded-lg p-2 transition-all ${
              pathname === '/approval'
                ? 'bg-amber-400/15 text-amber-300'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ClipboardCheck size={20} />
            {approvalQueueCount > 0 && (
              <span className="absolute right-1 top-1 inline-flex min-w-5 -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full border-2 border-slate-900 bg-amber-100 px-1 text-[10px] font-bold leading-4 text-amber-800">
                {approvalQueueCount > 99 ? '99+' : approvalQueueCount}
              </span>
            )}
          </Link>}

          {/* POS drafts and their invoice-creation flow */}
          {isRouteAllowed(role, '/master-pos') && <Link
            href="/master-pos"
            title="Master POS / Draft"
            className={`rounded-lg p-2 transition-all ${
              pathname === '/master-pos' || pathname === '/import' || pathname === '/create-invoice'
                ? 'bg-amber-400/15 text-amber-300'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Database size={20} />
          </Link>}

          {/* Statuses and approval actions are consolidated in Invoices */}
          {isRouteAllowed(role, '/invoices') && <Link
            href="/invoices"
            title="Invoices"
            onClick={markAllInvoiceStatusesSeen}
            className={`relative rounded-lg p-2 transition-all ${
              pathname === '/invoices'
                ? 'bg-amber-400/15 text-amber-300'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileCheck2 size={20} />
            {notificationCount > 0 && (
              <span className="absolute right-1 top-1 inline-flex min-w-5 -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full border-2 border-slate-900 bg-amber-100 px-1 text-[10px] font-bold leading-4 text-amber-800">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </Link>}

          {isRouteAllowed(role, '/accounting-reports') && <Link
            href="/accounting-reports"
            title="Accounting Reports & e-Faktur"
            className={`rounded-lg p-2 transition-all ${
              pathname === '/accounting-reports' || pathname === '/efaktur-export'
                ? 'bg-amber-400/15 text-amber-300'
                : 'hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BarChart3 size={20} />
          </Link>}

        </div>
      </div>

      {/* Bottom Settings Icons */}
      <div className="flex flex-col items-center gap-3">
        <button className="rounded-lg p-2 transition-colors hover:bg-slate-800 hover:text-white" title="Users">
          <Users size={20} />
        </button>
        <button className="rounded-lg p-2 transition-colors hover:bg-slate-800 hover:text-white" title="Settings">
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
