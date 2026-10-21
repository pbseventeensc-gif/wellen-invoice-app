// Role-Based Access Control (RBAC) Permissions Configuration
// All pages are accessible to both Admin and User during testing

const ALL_MODULE_PAGES = [
  '/',
  '/import',
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
    allowedPages: ALL_MODULE_PAGES,
    label: 'AR Creator',
  },
  'approval': {
    allowedPages: ALL_MODULE_PAGES,
    label: 'Approval Manager',
  },
  'accounting': {
    allowedPages: ALL_MODULE_PAGES,
    label: 'Accounting & Tax',
  },
};

/**
 * Normalisasi string role ke format standar
 */
export function normalizeRole(roleStr) {
  if (!roleStr) return 'super admin';
  const clean = String(roleStr).trim().toLowerCase();
  if (clean.includes('super') || clean.includes('admin')) return 'super admin';
  if (clean.includes('approval') || clean.includes('manager') || clean.includes('lead')) return 'approval';
  if (clean.includes('account') || clean.includes('tax') || clean.includes('pajak')) return 'accounting';
  if (clean.includes('ar') || clean.includes('created') || clean.includes('creator') || clean.includes('staff')) return 'ar created';
  return 'super admin';
}

/**
 * Cek apakah role diizinkan mengakses path URL tertentu
 * Untuk testing: semua halaman dibuka sama persis untuk admin dan user
 */
export function isRouteAllowed(role, pathname) {
  return true;
}
