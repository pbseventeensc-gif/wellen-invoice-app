-- Run only in a disposable PostgreSQL database after applying the client migration.
-- The test role helper reads test.actor_role; no production accounts are used.
begin;
set test.actor_role='super admin';
do $$ begin
  if not exists(select 1 from public.clients where name_key='pt legacy' and address='Known billing address') then
    raise exception 'Backfill did not pick the latest known billing address';
  end if;
end $$;
insert into public.invoice_staging(source_key,payload) values('qa-1','{"client_name":"PT Example","client_address":"Imported Street"}');
insert into public.invoice_staging(source_key,payload) values('qa-2','{"client_name":" pt. EXAMPLE ","client_address":""}');
do $$ begin
  if (select count(*) from public.clients where name_key='pt example')<>1 then raise exception 'Name deduplication failed'; end if;
  if (select address from public.clients where name_key='pt example')<>'Imported Street' then raise exception 'Blank import overwrote an address'; end if;
  if (select payload->>'client_address' from public.invoice_staging where source_key='qa-2')<>'Imported Street' then raise exception 'Draft did not receive the client address'; end if;
  if (select payload->>'client_id' from public.invoice_staging where source_key='qa-1') is null then raise exception 'Draft is not linked to a client'; end if;
end $$;
set local role authenticated;
select public.save_client('PT Example','Reviewed Street');
reset role;
insert into public.invoice_staging(source_key,payload) values('qa-3','{"client_name":"PT EXAMPLE","client_address":"Different imported street"}');
do $$ begin
  if (select address from public.clients where name_key='pt example')<>'Reviewed Street' then raise exception 'Import overwrote the reviewed address'; end if;
  if (select payload->>'client_address' from public.invoice_staging where source_key='qa-3')<>'Reviewed Street' then raise exception 'Draft did not retain reviewed address'; end if;
end $$;
set test.actor_role='ar created';
set local role authenticated;
do $$ begin
  if not exists(select 1 from public.clients where name_key='pt example') then raise exception 'AR cannot read client directory'; end if;
  begin
    perform public.save_client('PT Unauthorized','Should not be saved');
    raise exception 'AR unexpectedly edited a client';
  exception when insufficient_privilege then null;
  end;
end $$;
set test.actor_role='';
do $$ begin
  if exists(select 1 from public.clients) then raise exception 'Missing role can read clients'; end if;
end $$;
reset role;
rollback;
