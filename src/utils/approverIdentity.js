export function resolveApproverName(email, fullName) {
  const identity = `${email || ''} ${fullName || ''}`.toLowerCase();
  if (identity.includes('tanita')) return 'TANITA';
  if (identity.includes('risca')) return 'RISCA';
  return fullName || email?.split('@')[0] || 'Approval';
}
