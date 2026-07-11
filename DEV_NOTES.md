# Development Notes

- This is a Next.js Pages Router project.
- Run the dev server from `/Users/kristinli/Codex/Typing`.
- Always use the exact URL shown by the active dev server.
- Old ports such as `3000`, `3001`, and `3002` may be stale and can return `404`.
- If routes look broken, clear `.next` and restart the active dev server.

## Admin roles

- Apply `supabase/migrations/202607110001_create_app_roles.sql` before testing admin access.
- Bootstrap the first admin in the Supabase SQL editor with the auth user's UUID:

```sql
insert into public.user_roles (user_id, role)
values ('YOUR_AUTH_USER_UUID', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

- After the first admin exists, admins can securely assign roles through the `set_user_role` RPC. Direct client writes to `user_roles` are blocked.
