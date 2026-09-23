// Role-Based Access Control (RBAC) Permissions Configuration

export const ROLE_PERMISSIONS = {
  // Super Admin / Admin (Full Access)
  'super admin': {
    allowedPages: ['/', '/import', '/create-invoice', '/approval', '/invoices', '/approved-invoices', '/accounting-reports', '/efaktur-export'],
    label: 'Super Admin',
  },

  // AR Created / AR Creator (Staff AR - Import, Invoice Draft, List)
  'ar created': {
    allowedPages: ['/', '/import', '/create-invoice', '/invoices'],
    label: 'AR Creator',
  },

  // Approval / Manager (Risca & Tanita - Full Access seperti Super Admin)
  'approval': {
    allowedPages: ['/', '/import', '/create-invoice', '/approval', '/invoices', '/approved-invoices', '/accounting-reports', '/efaktur-export'],
    label: 'Approval Manager',
  },

  // Accounting / Tax (Reports, e-Faktur Exporter, Approved Invoices)
  'accounting': {
    allowedPages: ['/', '/approved-invoices', '/accounting-reports', '/efaktur-export', '/invoices'],
    label: 'Accounting & Tax',
  },
};

/**
 * Normalisasi string role ke format standar
 */
export function normalizeRole(roleStr) {
  if (!roleStr) return 'ar created';
  const clean = String(roleStr).trim().toLowerCase();
  if (clean.includes('super') || clean.includes('admin')) return 'super admin';
  if (clean.includes('approval') || clean.includes('manager') || clean.includes('lead')) return 'approval';
  if (clean.includes('account') || clean.includes('tax') || clean.includes('pajak')) return 'accounting';
  if (clean.includes('ar') || clean.includes('created') || clean.includes('creator') || clean.includes('staff')) return 'ar created';
  return 'ar created';
}

/**
 * Cek apakah role diizinkan mengakses path URL tertentu
 */
export function isRouteAllowed(role, pathname) {
  const normRole = normalizeRole(role);
  const permissions = ROLE_PERMISSIONS[normRole];
  if (!permissions) return false;
  if (pathname === '/') return true;
  return permissions.allowedPages.some((page) => pathname === page || (page !== '/' && pathname.startsWith(page)));
}
