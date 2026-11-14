-- Disposable database only, with client directory + contact migrations applied.
-- Test role helper reads test.actor_role. All data changes are rolled back.
begin;
set test.actor_role='super admin';
set local role authenticated;
do $$
declare saved public.clients%rowtype;
begin
  saved := public.save_client_contact('PT Phone Test', 'Phone Street', '  +62 0812 3456 7890  ');
  if saved.phone_number <> '+62 0812 3456 7890' then raise exception 'Phone formatting was lost'; end if;
  saved := public.save_client_contact(saved.name, 'Updated Street', '021-001234', saved.id);
  if saved.phone_number <> '021-001234' or saved.address <> 'Updated Street' then raise exception 'Contact edit was not saved'; end if;
  perform public.import_clients('[{"name":"PT Phone Test","address":"Import Street"}]');
  select * into saved from public.clients where id=saved.id;
  if saved.phone_number <> '021-001234' then raise exception 'Legacy import erased phone'; end if;
  begin
    perform public.save_client_contact('PT Phone Test', 'Must not persist', repeat('1',51), saved.id);
    raise exception 'Oversized phone was accepted';
  exception when invalid_parameter_value then null; end;
  if (select address from public.clients where id=saved.id) <> 'Import Street' then raise exception 'Failed contact edit changed address'; end if;
  saved := public.save_client_contact(saved.name, 'Import Street', '', saved.id);
  if saved.phone_number <> '' then raise exception 'Clearing phone failed'; end if;
end $$;
reset role;
set test.actor_role='ar created';
set local role authenticated;
do $$ begin
  begin
    perform public.save_client_contact('Unauthorized Contact', 'Street', '081234');
    raise exception 'AR edited contact';
  exception when insufficient_privilege then null; end;
  begin
    update public.clients set phone_number='081234' where name_key='pt phone test';
    raise exception 'Direct contact update bypassed RPC';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set test.actor_role='';
set local role authenticated;
do $$ begin
  begin
    perform public.save_client_contact('Missing Role', 'Street', '081234');
    raise exception 'Missing role edited contact';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
