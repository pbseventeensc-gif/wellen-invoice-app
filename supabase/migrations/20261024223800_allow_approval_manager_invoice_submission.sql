create or replace function public.submit_invoice_workflow(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.invoice_workflow_actor_role();
  new_id uuid;
  clean_payload jsonb;
  invoice_no text;
  actor_name text;
begin
  if actor_role not in (
    'super admin', 'superadmin', 'administrator', 'admin',
    'ar created', 'ar creator', 'creator', 'staff',
    'approval', 'approval manager', 'approver'
  ) then
    raise exception 'Not authorized to submit invoices' using errcode = '42501';
  end if;

  if p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 1048576 then
    raise exception 'Invalid invoice payload' using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload->'items') is distinct from 'array' then
    raise exception 'Invoice items must be an array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'Invoice must contain at least one item' using errcode = '22023';
  end if;

  invoice_no := nullif(trim(p_payload->>'invoice_number'), '');
  if invoice_no is null or length(invoice_no) > 200 then
    raise exception 'Invoice number is missing or too long' using errcode = '22023';
  end if;

  select coalesce(nullif(trim(p.full_name), ''), u.email)
    into actor_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = (select auth.uid());
  actor_name := coalesce(actor_name, (select auth.uid())::text);

  clean_payload := p_payload
    - 'status'
    - 'approved_by'
    - 'approved_at'
    - 'time_approved'
    - 'reject_reason'
    - 'time_rejected'
    - 'payment_status'
    - 'payment_date'
    - 'time_download'
    - 'printed_at';
  clean_payload := jsonb_set(clean_payload, '{created_by}', to_jsonb(actor_name), true);
  clean_payload := jsonb_set(clean_payload, '{ar_name}', to_jsonb(actor_name), true);

  insert into public.invoice_workflows (owner_id, invoice_number, status, payload)
  values ((select auth.uid()), invoice_no, 'waiting_approval', clean_payload)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.submit_invoice_workflow(jsonb) from public, anon;
grant execute on function public.submit_invoice_workflow(jsonb) to authenticated;
