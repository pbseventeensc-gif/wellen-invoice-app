-- Allow AR Creator to view invoice workflows (Waiting Approval and Rejected tracking)
drop policy if exists "Invoice workflow readers can view invoices" on public.invoice_workflows;
create policy "Invoice workflow readers can view invoices"
  on public.invoice_workflows
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and lower(regexp_replace(trim(coalesce(p.role, '')), '[_-]+', ' ', 'g'))
          in (
            'super admin', 'superadmin', 'administrator', 'admin',
            'approval', 'approval manager', 'approver',
            'accounting', 'accounting tax', 'accounting & tax', 'tax', 'pajak',
            'ar created', 'ar creator', 'creator', 'staff'
          )
    )
    or owner_id = (select auth.uid())
  );
