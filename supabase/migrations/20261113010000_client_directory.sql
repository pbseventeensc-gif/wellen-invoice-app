begin;

create or replace function public.client_name_key(p_name text)
returns text language sql immutable strict set search_path = public, pg_temp
as $$ select lower(btrim(regexp_replace(normalize(p_name, NFKC), '[^[:alnum:]]+', ' ', 'g'))) $$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 300),
  name_key text generated always as (public.client_name_key(name)) stored unique,
  address text not null default '' check (length(address) <= 4000),
  address_source text not null default 'import' check (address_source in ('import', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clients enable row level security;
revoke all on public.clients from anon, authenticated;
grant select on public.clients to authenticated;
create policy "Authorized users can read clients" on public.clients for select to authenticated
using (public.invoice_workflow_actor_role() in (
  'super admin','superadmin','administrator','admin','approval','approval manager','approver',
  'ar created','ar creator','creator','staff','accounting','accounting tax','accounting & tax','tax','pajak'
));

create or replace function public.save_client(p_name text, p_address text, p_id uuid default null)
returns public.clients language plpgsql security definer set search_path = public, pg_temp
as $$
declare saved public.clients%rowtype;
begin
  if public.invoice_workflow_actor_role() is null or public.invoice_workflow_actor_role() not in (
    'super admin','superadmin','administrator','admin','approval','approval manager','approver'
  ) then raise exception 'Not authorized to edit clients' using errcode='42501'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 300
    or public.client_name_key(p_name) = ''
    or p_address is null or length(btrim(p_address)) not between 1 and 4000 then
    raise exception 'A client name and address are required' using errcode='22023';
  end if;
  if p_id is not null then
    update public.clients set name=btrim(p_name), address=btrim(p_address),
      address_source='manual', updated_at=now() where id=p_id returning * into saved;
    if not found then raise exception 'Client not found' using errcode='P0002'; end if;
  else
    insert into public.clients(name,address,address_source)
      values(btrim(p_name),btrim(p_address),'manual')
      on conflict(name_key) do update set name=excluded.name,address=excluded.address,
        address_source='manual',updated_at=now() returning * into saved;
  end if;
  return saved;
end;
$$;
revoke all on function public.save_client(text,text,uuid) from public, anon;
grant execute on function public.save_client(text,text,uuid) to authenticated;

-- Share the staging transaction: draft and directory are saved together.
create or replace function public.sync_staging_client()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare client_name text; client_address text; saved public.clients%rowtype;
begin
  client_name := nullif(btrim(coalesce(new.payload->>'client_name','')), '');
  client_address := btrim(coalesce(new.payload->>'client_address',''));
  if client_name is null or public.client_name_key(client_name) = '' then return new; end if;
  if length(client_name)>300 or length(client_address)>4000 then
    raise exception 'Client name or address is too long' using errcode='22023';
  end if;
  insert into public.clients(name,address) values(client_name,client_address)
  on conflict(name_key) do update set
    address=case when clients.address_source='manual' or excluded.address='' then clients.address else excluded.address end,
    updated_at=now()
  returning * into saved;
  new.payload := jsonb_set(jsonb_set(new.payload,'{client_id}',to_jsonb(saved.id)),
    '{client_address}',to_jsonb(saved.address));
  return new;
end;
$$;
revoke all on function public.sync_staging_client() from public, anon, authenticated;
create trigger sync_staging_client_directory before insert or update of payload on public.invoice_staging
for each row execute function public.sync_staging_client();

-- Reuse existing imported client names and the latest nonempty known address.
with source as (
  select payload,created_at from public.invoice_staging
  union all select payload,created_at from public.invoice_workflows
), candidates as (
  select btrim(payload->>'client_name') as name,
    btrim(coalesce(payload->>'client_address','')) as address, created_at
  from source where nullif(btrim(payload->>'client_name'),'') is not null
), chosen as (
  select distinct on (public.client_name_key(name)) name,address
  from candidates where length(name)<=300 and length(address)<=4000 and public.client_name_key(name)<>''
  order by public.client_name_key(name), (address<>'') desc, created_at desc
)
insert into public.clients(name,address) select name,address from chosen
on conflict(name_key) do nothing;

notify pgrst, 'reload schema';
commit;
