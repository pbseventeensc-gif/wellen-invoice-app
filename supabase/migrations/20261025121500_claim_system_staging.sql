-- ==============================================================================
-- Migration: 20261025121500_claim_system_staging.sql
-- Description: Menambahkan fitur sistem klaim (anti-bentrok) draft POS antar AR Creator
-- ==============================================================================

-- 1. Tambah kolom pelacakan klaim di invoice_staging
alter table public.invoice_staging
  add column if not exists claimed_by_id uuid references auth.users (id) on delete set null,
  add column if not exists claimed_by_name text,
  add column if not exists claimed_at timestamptz;

create index if not exists invoice_staging_claimed_by_idx
  on public.invoice_staging (claimed_by_id, status);

-- 2. Fungsi Atomik untuk Mengklaim Baris Draft POS
create or replace function public.claim_invoice_staging_rows(p_source_keys text[])
returns table (
  source_key text,
  claimed_by_id uuid,
  claimed_by_name text,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.invoice_workflow_actor_role();
  actor_name text;
begin
  if actor_role is null or actor_role not in (
    'super admin', 'superadmin', 'administrator', 'admin',
    'ar created', 'ar creator', 'creator', 'staff',
    'approval', 'approval manager', 'approver'
  ) then
    raise exception 'Not authorized to claim POS drafts' using errcode = '42501';
  end if;

  if p_source_keys is null or array_length(p_source_keys, 1) is null or array_length(p_source_keys, 1) = 0 then
    raise exception 'No draft rows provided for claim' using errcode = '22023';
  end if;

  select coalesce(nullif(trim(p.full_name), ''), u.email)
    into actor_name
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = (select auth.uid());
  actor_name := coalesce(actor_name, (select auth.uid())::text);

  return query
  update public.invoice_staging s
  set claimed_by_id = (select auth.uid()),
      claimed_by_name = actor_name,
      claimed_at = now(),
      updated_at = now()
  where s.source_key = any(p_source_keys)
    and s.status in ('draft', 'ready', 'ready_to_process', 'rejected')
    and (s.claimed_by_id is null or s.claimed_by_id = (select auth.uid()))
  returning s.source_key, s.claimed_by_id, s.claimed_by_name, s.claimed_at;
end;
$$;

-- 3. Fungsi untuk Melepas Klaim Baris Draft POS (Release Claim)
create or replace function public.release_invoice_staging_rows(p_source_keys text[])
returns table (
  source_key text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text := public.invoice_workflow_actor_role();
begin
  if actor_role is null then
    raise exception 'Not authorized to release POS drafts' using errcode = '42501';
  end if;

  if p_source_keys is null or array_length(p_source_keys, 1) is null or array_length(p_source_keys, 1) = 0 then
    raise exception 'No draft rows provided to release' using errcode = '22023';
  end if;

  return query
  update public.invoice_staging s
  set claimed_by_id = null,
      claimed_by_name = null,
      claimed_at = null,
      updated_at = now()
  where s.source_key = any(p_source_keys)
    and (
      s.claimed_by_id = (select auth.uid())
      or actor_role in ('super admin', 'superadmin', 'administrator', 'admin', 'approval', 'approval manager', 'approver')
    )
  returning s.source_key;
end;
$$;

-- 4. Izin Eksekusi Fungsi RPC
revoke all on function public.claim_invoice_staging_rows(text[]) from public, anon;
revoke all on function public.release_invoice_staging_rows(text[]) from public, anon;

grant execute on function public.claim_invoice_staging_rows(text[]) to authenticated;
grant execute on function public.release_invoice_staging_rows(text[]) to authenticated;
