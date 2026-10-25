'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  BarChart3,
  PieChart 
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isRouteAllowed, normalizeRole } from '@/config/permissions';

export default function NavLinks() {
  const pathname = usePathname();
  const [role, setRole] = useState(null);

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

  const menuItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Import Excel', href: '/import', icon: FileSpreadsheet },
    { label: 'Create Invoice', href: '/create-invoice', icon: FileText },
    { label: 'Approval Queue', href: '/approval', icon: CheckCircle2 },
    { label: normalizeRole(role) === 'ar created' ? 'Select Drafts' : 'Invoice List', href: '/invoices', icon: BarChart3 },
    { label: 'Accounting Reports', href: '/accounting-reports', icon: PieChart },
  ];

  return (
    <nav className="p-4 space-y-1 relative z-10">
      {menuItems.filter((item) => isRouteAllowed(role, item.href)).map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative z-20 cursor-pointer pointer-events-auto ${
              isActive
                ? 'bg-amber-500 text-stone-950 font-semibold shadow-sm'
                : 'text-stone-400 hover:text-white hover:bg-stone-800/60'
            }`}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}