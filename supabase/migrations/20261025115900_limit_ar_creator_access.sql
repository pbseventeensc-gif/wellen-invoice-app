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
          in ('super admin', 'superadmin', 'administrator', 'admin', 'approval', 'approval manager', 'approver', 'accounting', 'accounting tax', 'accounting & tax', 'tax', 'pajak')
    )
  );

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

revoke all on function public.save_invoice_staging_rows(jsonb) from public, anon;
revoke all on function public.update_invoice_staging_row(text, jsonb) from public, anon;
revoke all on function public.delete_invoice_staging_row(text) from public, anon;

grant execute on function public.save_invoice_staging_rows(jsonb) to authenticated;
grant execute on function public.update_invoice_staging_row(text, jsonb) to authenticated;
grant execute on function public.delete_invoice_staging_row(text) to authenticated;
