-- Allow passage owners to read their own rows, including hidden passages.
-- This is required for manage/admin screens and for updates that return a
-- row after toggling is_active to false.

drop policy if exists "Authenticated users can read own passages" on public.passages;
create policy "Authenticated users can read own passages"
on public.passages
for select
to authenticated
using (created_by = auth.uid());
