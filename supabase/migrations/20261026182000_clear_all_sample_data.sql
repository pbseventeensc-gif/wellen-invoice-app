create or replace function public.clear_all_invoice_data()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.invoice_workflow_actor_role();
begin
  if actor_role is null or actor_role not in (
    'super admin', 'superadmin', 'administrator', 'admin',
    'approval', 'approval manager', 'approver'
  ) then
    raise exception 'Not authorized to clear invoice data' using errcode = '42501';
  end if;

  delete from public.invoice_workflows;
  delete from public.invoice_staging;
end;
$$;

revoke all on function public.clear_all_invoice_data() from public, anon;
grant execute on function public.clear_all_invoice_data() to authenticated;
