begin;
alter table public.invoice_workflows add column if not exists revision_history jsonb not null default '[]'::jsonb;
drop policy if exists "Invoice workflow readers can view invoices" on public.invoice_workflows;
create policy "Invoice workflow readers can view invoices" on public.invoice_workflows
for select to authenticated using (
  public.invoice_workflow_actor_role() in (
    'super admin', 'superadmin', 'administrator', 'admin', 'approval', 'approval manager', 'approver',
    'accounting', 'accounting tax', 'accounting & tax', 'tax', 'pajak'
  ) or (owner_id = auth.uid() and public.invoice_workflow_actor_role() in ('ar created', 'ar creator', 'creator', 'staff'))
);
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
  previous public.invoice_workflows%rowtype;
  source_ids text[];
  locked_count integer;
begin
  if actor_role is null or actor_role not in (
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

  -- Serialize submissions for a number, even if no workflow exists yet.
  perform pg_advisory_xact_lock(hashtextextended(invoice_no, 0));
  select * into previous from public.invoice_workflows
    where invoice_number = invoice_no for update;
  if previous.id is not null and (
    previous.status <> 'rejected' or
    (previous.owner_id <> auth.uid() and actor_role not in
      ('super admin', 'superadmin', 'administrator', 'admin', 'approval', 'approval manager', 'approver'))
  ) then
    raise exception 'Invoice number already exists or revision is not authorized' using errcode = '42501';
  end if;

  select array_agg(distinct item->>'id' order by item->>'id') into source_ids
    from jsonb_array_elements(p_payload->'items') item;
  if array_length(source_ids, 1) is distinct from jsonb_array_length(p_payload->'items')
    or exists (select 1 from unnest(source_ids) id where id is null or trim(id) = '') then
    raise exception 'Every item must reference a distinct draft' using errcode = '22023';
  end if;
  -- Lock in a stable order to prevent two invoice numbers consuming the same draft.
  perform 1 from public.invoice_staging where source_key = any(source_ids)
    order by source_key for update;
  select count(*) into locked_count from public.invoice_staging
    where source_key = any(source_ids)
      and status in ('draft', 'ready', 'ready_to_process', 'rejected')
      and claimed_by_id = auth.uid();
  if locked_count <> array_length(source_ids, 1) then
    raise exception 'Draft is unavailable or not claimed by you' using errcode = '42501';
  end if;

  if previous.id is not null then
    update public.invoice_workflows
      set payload = clean_payload, status = 'waiting_approval',
          rejection_reason = null, approved_by = null, approved_at = null, printed_at = null,
          revision_history = revision_history || jsonb_build_array(jsonb_build_object(
            'payload', previous.payload, 'reason', previous.rejection_reason,
            'owner_id', previous.owner_id, 'revised_at', now())),
          updated_at = now()
      where id = previous.id returning id into new_id;
  else
    insert into public.invoice_workflows (owner_id, invoice_number, status, payload)
    values (auth.uid(), invoice_no, 'waiting_approval', clean_payload)
    returning id into new_id;
  end if;

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
  if actor_role is null or actor_role not in ('super admin', 'superadmin', 'administrator', 'admin', 'approval', 'approval manager', 'approver') then
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
  if actor_role is null or actor_role not in ('super admin', 'superadmin', 'administrator', 'admin', 'approval', 'approval manager', 'approver') then
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
  if actor_role is null or actor_role not in ('super admin', 'superadmin', 'administrator', 'admin', 'approval', 'approval manager', 'approver') then
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
  if actor_role is null or actor_role not in ('super admin', 'superadmin', 'administrator', 'admin') then
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
  if actor_role is null or actor_role not in ('super admin', 'superadmin', 'administrator', 'admin', 'approval', 'approval manager', 'approver', 'accounting', 'accounting tax', 'accounting & tax', 'tax', 'pajak', 'ar created', 'ar creator', 'creator', 'staff') then
    raise exception 'Not authorized to update print status' using errcode = '42501';
  end if;

  update public.invoice_workflows
  set printed_at = coalesce(printed_at, now()), updated_at = now()
  where id = p_workflow_id and status in ('waiting_approval', 'approved')
    and (owner_id = auth.uid() or actor_role not in ('ar created', 'ar creator', 'creator', 'staff'));
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
  if actor_role is null or actor_role not in ('super admin', 'superadmin', 'administrator', 'admin', 'accounting', 'accounting tax', 'accounting & tax', 'tax', 'pajak') then
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
  if actor_role is null or actor_role not in ('super admin', 'superadmin', 'administrator', 'admin') then
    raise exception 'Not authorized to delete approved invoices' using errcode = '42501';
  end if;

  delete from public.invoice_workflows
  where id = p_workflow_id and status = 'approved';

  if not found then
    raise exception 'Approved invoice not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.sync_invoice_staging_workflow_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_status text;
  workflow_payload jsonb;
begin
  if TG_OP = 'INSERT' then
    if new.status <> 'waiting_approval' then
      return new;
    end if;
    target_status := 'invoiced';
    workflow_payload := new.payload;
  elsif TG_OP = 'UPDATE' and old.status = 'rejected' and new.status = 'waiting_approval' then
    target_status := 'invoiced';
    workflow_payload := new.payload;
  elsif TG_OP = 'DELETE' then
    if old.status <> 'waiting_approval' then
      return old;
    end if;
    target_status := 'draft';
    workflow_payload := old.payload;
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    target_status := new.status;
    workflow_payload := new.payload;
  else
    return new;
  end if;

  update public.invoice_staging s
  set status = target_status, updated_at = now()
  where s.source_key in (
    select entries.item->>'id'
    from jsonb_array_elements(coalesce(workflow_payload->'items', '[]'::jsonb)) as entries(item)
    where nullif(entries.item->>'id', '') is not null
  )
    and (
      (target_status = 'invoiced' and s.status in ('draft', 'ready', 'ready_to_process', 'rejected'))
      or (target_status in ('approved', 'rejected') and s.status = 'invoiced')
      or (target_status = 'draft' and s.status = 'invoiced')
    );

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


commit;
