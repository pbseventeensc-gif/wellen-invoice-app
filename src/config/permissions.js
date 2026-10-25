// Role-Based Access Control (RBAC) Permissions Configuration

const ALL_MODULE_PAGES = [
  '/',
  '/import',
  '/master-pos',
  '/create-invoice',
  '/approval',
  '/status-approval',
  '/invoices',
  '/approved-invoices',
  '/accounting-reports',
  '/efaktur-export'
];

export const ROLE_PERMISSIONS = {
  'super admin': {
    allowedPages: ALL_MODULE_PAGES,
    label: 'Super Admin',
  },
  'ar created': {
    allowedPages: [
      '/invoices',
      '/create-invoice',
      '/status-approval',
    ],
    label: 'AR Creator',
  },
  'approval': {
    allowedPages: ALL_MODULE_PAGES,
    label: 'Approval Manager',
  },
  'accounting': {
    allowedPages: [
      '/',
      '/invoices',
      '/approved-invoices',
      '/accounting-reports',
      '/efaktur-export',
    ],
    label: 'Accounting & Tax',
  },
};

/**
 * Normalisasi string role ke format standar
 */
export function normalizeRole(roleStr) {
  if (!roleStr) return null;
  const clean = String(roleStr).trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (['super admin', 'superadmin', 'administrator', 'admin'].includes(clean)) return 'super admin';
  if (['approval', 'approval manager', 'approver'].includes(clean)) return 'approval';
  if (['accounting', 'accounting tax', 'accounting & tax', 'tax', 'pajak'].includes(clean)) return 'accounting';
  if (['ar created', 'ar creator', 'creator', 'staff'].includes(clean)) return 'ar created';
  return null;
}

/**
 * Cek apakah role diizinkan mengakses path URL tertentu
 */
export function isRouteAllowed(role, pathname) {
  const normalizedRole = normalizeRole(role);
  const permissions = normalizedRole ? ROLE_PERMISSIONS[normalizedRole] : null;
  const normalizedPath = pathname === '/' ? pathname : pathname.replace(/\/+$/, '');

  return Boolean(permissions?.allowedPages.includes(normalizedPath));
}
