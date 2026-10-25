create table if not exists public.invoice_staging (
  source_key text primary key,
  owner_id uuid not null references auth.users (id) on delete restrict,
  status text not null check (status in ('draft', 'ready', 'ready_to_process', 'invoiced', 'approved', 'rejected')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoice_staging_status_created_at_idx
  on public.invoice_staging (status, created_at desc);

alter table public.invoice_staging enable row level security;
revoke all on public.invoice_staging from anon, authenticated;
grant select on public.invoice_staging to authenticated;

drop policy if exists "Invoice workflow readers can view staging" on public.invoice_staging;
create policy "Invoice workflow readers can view staging"
  on public.invoice_staging
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and (
          lower(regexp_replace(trim(coalesce(p.role, '')), '[_-]+', ' ', 'g'))
            in ('super admin', 'superadmin', 'administrator', 'admin', 'approval', 'approval manager', 'approver', 'accounting', 'accounting tax', 'accounting & tax', 'tax', 'pajak')
          or (
            lower(regexp_replace(trim(coalesce(p.role, '')), '[_-]+', ' ', 'g'))
              in ('ar created', 'ar creator', 'creator', 'staff')
            and status in ('draft', 'ready', 'ready_to_process', 'rejected')
          )
        )
    )
  );

create or replace function public.save_invoice_staging_rows(p_rows jsonb)
returns setof public.invoice_staging
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.invoice_workflow_actor_role();
  input_row jsonb;
  input_id text;
  resolved_key text;
  clean_payload jsonb;
  saved_row public.invoice_staging%rowtype;
begin
  if actor_role is null or actor_role not in (
    'super admin', 'superadmin', 'administrator', 'admin',
    'approval', 'approval manager', 'approver'
  ) then
    raise exception 'Not authorized to save POS drafts' using errcode = '42501';
  end if;

  if p_rows is null
    or jsonb_typeof(p_rows) is distinct from 'array'
    or jsonb_array_length(p_rows) < 1
    or jsonb_array_length(p_rows) > 500
    or octet_length(p_rows::text) > 5242880 then
    raise exception 'Invalid POS draft batch' using errcode = '22023';
  end if;

  for input_row in select value from jsonb_array_elements(p_rows)
  loop
    if jsonb_typeof(input_row) is distinct from 'object' then
      raise exception 'Invalid POS draft row' using errcode = '22023';
    end if;

    input_id := nullif(trim(input_row->>'id'), '');
    if input_id is null or length(input_id) > 300 then
      raise exception 'POS draft ID is missing or too long' using errcode = '22023';
    end if;

    select source_key
      into resolved_key
    from public.invoice_staging
    where source_key = input_id;

    if resolved_key is not null and not exists (
      select 1
      from public.invoice_staging
      where source_key = resolved_key
        and status in ('draft', 'ready', 'ready_to_process', 'rejected')
    ) then
      raise exception 'POS row is already in an invoice workflow' using errcode = '23505';
    end if;

    if resolved_key is null then
      resolved_key := (select auth.uid())::text || ':' || input_id;
      if exists (
        select 1
        from public.invoice_staging
        where source_key = resolved_key
          and status not in ('draft', 'ready', 'ready_to_process', 'rejected')
      ) then
        raise exception 'POS row is already in an invoice workflow' using errcode = '23505';
      end if;
    end if;

    clean_payload := input_row
      - 'approved_by'
      - 'approved_at'
      - 'time_approved'
      - 'payment_status'
      - 'payment_date'
      - 'time_download';
    clean_payload := jsonb_set(clean_payload, '{id}', to_jsonb(resolved_key), true);
    clean_payload := jsonb_set(clean_payload, '{status}', '"draft"'::jsonb, true);

    insert into public.invoice_staging (source_key, owner_id, status, payload)
    values (resolved_key, (select auth.uid()), 'draft', clean_payload)
    on conflict (source_key) do update
      set status = 'draft',
          payload = excluded.payload,
          updated_at = now()
      where public.invoice_staging.status in ('draft', 'ready', 'ready_to_process', 'rejected')
    returning * into saved_row;

    if not found then
      raise exception 'POS row is already in an invoice workflow' using errcode = '23505';
    end if;

    return next saved_row;
  end loop;
end;
$$;

create or replace function public.update_invoice_staging_row(p_source_key text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.invoice_workflow_actor_role();
  clean_payload jsonb;
begin
  if actor_role is null or actor_role not in (
    'super admin', 'superadmin', 'administrator', 'admin',
    'approval', 'approval manager', 'approver'
  ) then
    raise exception 'Not authorized to update POS drafts' using errcode = '42501';
  end if;

  if p_source_key is null
    or length(p_source_key) > 350
    or p_payload is null
    or jsonb_typeof(p_payload) is distinct from 'object'
    or octet_length(p_payload::text) > 1048576 then
    raise exception 'Invalid POS draft update' using errcode = '22023';
  end if;

  clean_payload := p_payload
    - 'approved_by'
    - 'approved_at'
    - 'time_approved'
    - 'payment_status'
    - 'payment_date'
    - 'time_download';
  clean_payload := jsonb_set(clean_payload, '{id}', to_jsonb(p_source_key), true);
  clean_payload := jsonb_set(clean_payload, '{status}', '"draft"'::jsonb, true);

  update public.invoice_staging
  set status = 'draft', payload = clean_payload, updated_at = now()
  where source_key = p_source_key
    and status in ('draft', 'ready', 'ready_to_process', 'rejected');

  if not found then
    raise exception 'POS draft is not editable or was not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.delete_invoice_staging_row(p_source_key text)
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
    raise exception 'Not authorized to delete POS drafts' using errcode = '42501';
  end if;

  delete from public.invoice_staging
  where source_key = p_source_key
    and status in ('draft', 'ready', 'ready_to_process', 'rejected');

  if not found then
    raise exception 'POS draft is already in an invoice workflow or was not found' using errcode = 'P0002';
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

drop trigger if exists invoice_workflows_sync_staging_status on public.invoice_workflows;
create trigger invoice_workflows_sync_staging_status
  after insert or update or delete on public.invoice_workflows
  for each row execute function public.sync_invoice_staging_workflow_status();

revoke all on function public.save_invoice_staging_rows(jsonb) from public, anon;
revoke all on function public.update_invoice_staging_row(text, jsonb) from public, anon;
revoke all on function public.delete_invoice_staging_row(text) from public, anon;
revoke all on function public.sync_invoice_staging_workflow_status() from public, anon, authenticated;

grant execute on function public.save_invoice_staging_rows(jsonb) to authenticated;
grant execute on function public.update_invoice_staging_row(text, jsonb) to authenticated;
grant execute on function public.delete_invoice_staging_row(text) to authenticated;
