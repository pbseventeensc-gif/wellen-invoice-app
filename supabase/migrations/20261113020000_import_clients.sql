begin;

-- Explicit directory import: all rows succeed together or none are saved.
create or replace function public.import_clients(p_clients jsonb)
returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare entry jsonb; count_saved integer := 0;
begin
  if public.invoice_workflow_actor_role() is null or public.invoice_workflow_actor_role() not in (
    'super admin','superadmin','administrator','admin','approval','approval manager','approver'
  ) then raise exception 'Not authorized to import clients' using errcode='42501'; end if;
  if p_clients is null or jsonb_typeof(p_clients) <> 'array' then
    raise exception 'Clients must be an array' using errcode='22023';
  end if;
  if jsonb_array_length(p_clients) not between 1 and 500 then
    raise exception 'Import between 1 and 500 clients' using errcode='22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_clients) c
    group by public.client_name_key(c->>'name') having count(*)>1) then
    raise exception 'Duplicate client names in import' using errcode='22023';
  end if;
  for entry in select value from jsonb_array_elements(p_clients) loop
    if jsonb_typeof(entry->'name') is distinct from 'string' or jsonb_typeof(entry->'address') is distinct from 'string' then
      raise exception 'Each client requires a name and address' using errcode='22023';
    end if;
    perform public.save_client(entry->>'name',entry->>'address');
    count_saved := count_saved + 1;
  end loop;
  return count_saved;
end;
$$;
revoke all on function public.import_clients(jsonb) from public, anon;
grant execute on function public.import_clients(jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
