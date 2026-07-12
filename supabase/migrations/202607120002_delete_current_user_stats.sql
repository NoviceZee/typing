create or replace function public.delete_current_user_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  delete from public.typing_attempt_details where user_id = current_user_id;
  delete from public.typing_results where user_id = current_user_id;
end;
$$;
revoke all on function public.delete_current_user_stats() from public;
grant execute on function public.delete_current_user_stats() to authenticated;
