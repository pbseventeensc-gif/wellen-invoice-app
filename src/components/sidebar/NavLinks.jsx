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

export default function NavLinks() {
  const pathname = usePathname();

  const menuItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Import Excel', href: '/import', icon: FileSpreadsheet },
    { label: 'Create Invoice', href: '/create-invoice', icon: FileText },
    { label: 'Approval Queue', href: '/approval', icon: CheckCircle2 },
    { label: 'Invoice List', href: '/invoices', icon: BarChart3 },
    { label: 'Accounting Reports', href: '/accounting-reports', icon: PieChart },
  ];

  return (
    <nav className="p-4 space-y-1 relative z-10">
      {menuItems.map((item) => {
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