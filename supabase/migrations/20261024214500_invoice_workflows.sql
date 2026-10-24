create table if not exists public.invoice_workflows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete restrict,
  invoice_number text not null,
  status text not null check (status in ('waiting_approval', 'approved', 'rejected')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  approved_by text,
  approved_at timestamptz,
  rejection_reason text,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoice_workflows_status_created_at_idx
  on public.invoice_workflows (status, created_at desc);

create index if not exists invoice_workflows_owner_created_at_idx
  on public.invoice_workflows (owner_id, created_at desc);

create unique index if not exists invoice_workflows_invoice_number_key
  on public.invoice_workflows (invoice_number);

alter table public.invoice_workflows enable row level security;

revoke all on public.invoice_workflows from anon, authenticated;
grant select on public.invoice_workflows to authenticated;

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
          in ('super admin', 'superadmin', 'administrator', 'admin', 'approval', 'approval manager', 'approver', 'accounting', 'accounting tax', 'accounting & tax', 'tax', 'pajak', 'ar created', 'ar creator', 'creator', 'staff')
    )
  );

create or replace function public.invoice_workflow_actor_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lower(regexp_replace(trim(coalesce(p.role, '')), '[_-]+', ' ', 'g'))
  from public.profiles p
  where p.id = (select auth.uid())
$$;

revoke all on function public.invoice_workflow_actor_role() from public, anon;
grant execute on function public.invoice_workflow_actor_role() to authenticated;

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
  if actor_role not in ('super admin', 'superadmin', 'administrator', 'admin', 'ar created', 'ar creator', 'creator', 'staff') then
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

create or replace function public.approve_invoice_workflow(p_workflow_id uuid)
returns setof public.invoice_workflows
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.invoice_workflow_actor_role();
  actor_name text;
begin
  if actor_role not in ('super admin', 'superadmin', 'administrator', 'admin', 'approval', 'approval manager', 'approver') then
    raise exception 'Not authorized to approve invoices' using errcode = '42501';
  end if;

  select coalesce(nullif(trim(p.full_name), ''), u.email)
    into actor_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = (select auth.uid());

  return query
    update public.invoice_workflows w
    set status = 'approved',
        approved_by = actor_name,
        approved_at = now(),
        rejection_reason = null,
        updated_at = now()
    where w.id = p_workflow_id
      and w.status = 'waiting_approval'
    returning w.*;

  if not found then
    raise exception 'Invoice is not awaiting approval' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.reject_invoice_workflow(p_workflow_id uuid, p_reason text)
returns setof public.invoice_workflows
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.invoice_workflow_actor_role();
begin
  if actor_role not in ('super admin', 'superadmin', 'administrator', 'admin', 'approval', 'approval manager', 'approver') then
    raise exception 'Not authorized to reject invoices' using errcode = '42501';
  end if;

  return query
    update public.invoice_workflows w
    set status = 'rejected',
        rejection_reason = left(coalesce(nullif(trim(p_reason), ''), 'Needs revision'), 1000),
        updated_at = now()
    where w.id = p_workflow_id
      and w.status = 'waiting_approval'
    returning w.*;

  if not found then
    raise exception 'Invoice is not awaiting approval' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.delete_waiting_invoice_workflow(p_workflow_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.invoice_workflow_actor_role();
begin
  if actor_role not in ('super admin', 'superadmin', 'administrator', 'admin', 'approval', 'approval manager', 'approver') then
    raise exception 'Not authorized to remove invoices from the queue' using errcode = '42501';
  end if;

  delete from public.invoice_workflows
  where id = p_workflow_id and status = 'waiting_approval';

  if not found then
    raise exception 'Invoice is not awaiting approval' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.clear_waiting_invoice_workflows()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.invoice_workflow_actor_role();
  removed_count integer;
begin
  if actor_role not in ('super admin', 'superadmin', 'administrator', 'admin') then
    raise exception 'Not authorized to clear the approval queue' using errcode = '42501';
  end if;

  delete from public.invoice_workflows where status = 'waiting_approval';
  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

create or replace function public.mark_invoice_workflow_printed(p_workflow_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.invoice_workflow_actor_role();
begin
  if actor_role not in ('super admin', 'superadmin', 'administrator', 'admin', 'approval', 'approval manager', 'approver', 'accounting', 'accounting tax', 'accounting & tax', 'tax', 'pajak', 'ar created', 'ar creator', 'creator', 'staff') then
    raise exception 'Not authorized to update print status' using errcode = '42501';
  end if;

  update public.invoice_workflows
  set printed_at = coalesce(printed_at, now()), updated_at = now()
  where id = p_workflow_id and status in ('waiting_approval', 'approved');
  if not found then
    raise exception 'Invoice not found for printing' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.set_invoice_workflow_payment(
  p_workflow_id uuid,
  p_is_paid boolean,
  p_payment_date date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.invoice_workflow_actor_role();
begin
  if actor_role not in ('super admin', 'superadmin', 'administrator', 'admin', 'accounting', 'accounting tax', 'accounting & tax', 'tax', 'pajak') then
    raise exception 'Not authorized to update payment status' using errcode = '42501';
  end if;

  update public.invoice_workflows
  set payload = jsonb_set(
        jsonb_set(payload, '{payment_status}', to_jsonb(case when p_is_paid then 'paid' else 'unpaid' end), true),
        '{payment_date}',
        case when p_is_paid then to_jsonb(coalesce(p_payment_date, current_date)::text) else 'null'::jsonb end,
        true
      ),
      updated_at = now()
  where id = p_workflow_id and status = 'approved';

  if not found then
    raise exception 'Approved invoice not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.delete_approved_invoice_workflow(p_workflow_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.invoice_workflow_actor_role();
begin
  if actor_role not in ('super admin', 'superadmin', 'administrator', 'admin') then
    raise exception 'Not authorized to delete approved invoices' using errcode = '42501';
  end if;

  delete from public.invoice_workflows
  where id = p_workflow_id and status = 'approved';

  if not found then
    raise exception 'Approved invoice not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.submit_invoice_workflow(jsonb) from public, anon;
revoke all on function public.approve_invoice_workflow(uuid) from public, anon;
revoke all on function public.reject_invoice_workflow(uuid, text) from public, anon;
revoke all on function public.delete_waiting_invoice_workflow(uuid) from public, anon;
revoke all on function public.clear_waiting_invoice_workflows() from public, anon;
revoke all on function public.mark_invoice_workflow_printed(uuid) from public, anon;
revoke all on function public.set_invoice_workflow_payment(uuid, boolean, date) from public, anon;
revoke all on function public.delete_approved_invoice_workflow(uuid) from public, anon;

grant execute on function public.submit_invoice_workflow(jsonb) to authenticated;
grant execute on function public.approve_invoice_workflow(uuid) to authenticated;
grant execute on function public.reject_invoice_workflow(uuid, text) to authenticated;
grant execute on function public.delete_waiting_invoice_workflow(uuid) to authenticated;
grant execute on function public.clear_waiting_invoice_workflows() to authenticated;
grant execute on function public.mark_invoice_workflow_printed(uuid) to authenticated;
grant execute on function public.set_invoice_workflow_payment(uuid, boolean, date) to authenticated;
grant execute on function public.delete_approved_invoice_workflow(uuid) to authenticated;
