-- Update the existing welcome announcement without changing its identity.
update public.app_announcements
set title = 'Welcome to the Typing Station beta'
where title = 'Welcome to the FormalType beta';
