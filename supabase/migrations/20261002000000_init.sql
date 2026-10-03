-- DSA Cohort platform — schema, access rules (RLS) and screenshot storage.
-- Run once on a fresh Supabase project (SQL editor, or `npx supabase db push`).

-------------------------------------------------------------------------------
-- Helpers
-------------------------------------------------------------------------------

-- Gmail ignores dots and "+tags": foo.bar@gmail.com == foobar+x@googlemail.com.
-- Every allowlist comparison goes through this so those spellings still match.
create or replace function public.normalize_email(e text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(lower(trim(e)), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(trim(e)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else lower(trim(e))
  end
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-------------------------------------------------------------------------------
-- Tables
-------------------------------------------------------------------------------

-- Who may enter, and with what role. Removing a row removes access immediately.
create table public.allowed_emails (
  email       text primary key check (email = lower(trim(email)) and position('@' in email) > 1),
  email_key   text generated always as (public.normalize_email(email)) stored unique,
  role        text not null default 'student' check (role in ('student', 'admin')),
  added_by    uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- One row per enrolled person who has signed in (created by get_viewer()).
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text not null unique,
  full_name          text,
  avatar_url         text,
  leetcode_username  text check (leetcode_username is null or leetcode_username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{1,38}[A-Za-z0-9_]$'),
  created_at         timestamptz not null default now()
);
create unique index profiles_leetcode_username_key on public.profiles (lower(leetcode_username));

create table public.sessions (
  id             uuid primary key default gen_random_uuid(),
  number         int  not null unique check (number > 0),
  title          text not null,
  description    text,
  class_date     date,
  recording_url  text,
  notes_url      text,
  status         text not null default 'draft' check (status in ('draft', 'published')),
  published_at   timestamptz,
  created_at     timestamptz not null default now()
);

create table public.questions (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions (id) on delete cascade,
  kind          text not null check (kind in ('class', 'homework')),
  position      int  not null,
  lc_number     int,
  title         text not null,
  leetcode_url  text not null,
  difficulty    text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  hint          text,
  created_at    timestamptz not null default now()
);
create index questions_session_idx on public.questions (session_id, kind, position);

create table public.submissions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  question_id      uuid not null references public.questions (id) on delete cascade,
  screenshot_path  text not null,
  submitted_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, question_id)
);
create index submissions_question_idx on public.submissions (question_id);

create trigger submissions_touch_updated_at
  before update on public.submissions
  for each row execute function public.touch_updated_at();

-- Stamp published_at when a session goes live.
create or replace function public.stamp_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := now();
  end if;
  return new;
end
$$;

create trigger sessions_stamp_published_at
  before insert or update of status on public.sessions
  for each row execute function public.stamp_published_at();

-- Lower-case emails on the way in, and never let the last admin disappear.
create or replace function public.allowed_emails_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    new.email := lower(trim(new.email));
  end if;
  if (tg_op = 'DELETE' and old.role = 'admin')
     or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin') then
    if not exists (select 1 from public.allowed_emails where role = 'admin' and email <> old.email) then
      raise exception 'Cannot remove the last admin';
    end if;
  end if;
  return coalesce(new, old);
end
$$;

create trigger allowed_emails_guard
  before insert or update or delete on public.allowed_emails
  for each row execute function public.allowed_emails_guard();

-------------------------------------------------------------------------------
-- Access helpers (security definer so policies can read the allowlist)
-------------------------------------------------------------------------------

create or replace function public.is_enrolled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_emails
    where email_key = public.normalize_email(auth.jwt() ->> 'email')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_emails
    where email_key = public.normalize_email(auth.jwt() ->> 'email') and role = 'admin'
  );
$$;

-- Who am I? Creates the profile on first sign-in (enrolled people only).
create or replace function public.get_viewer()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(auth.jwt() ->> 'email');
  v_role  text;
  v_prof  public.profiles;
begin
  if v_uid is null then
    return null;
  end if;

  select a.role into v_role
  from public.allowed_emails a
  where a.email_key = public.normalize_email(v_email);

  if v_role is null then
    return json_build_object('id', v_uid, 'email', v_email, 'enrolled', false);
  end if;

  insert into public.profiles (id, email, full_name, avatar_url)
  select u.id,
         v_email,
         coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
         coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
  from auth.users u
  where u.id = v_uid
  on conflict (id) do nothing;

  select * into v_prof from public.profiles where id = v_uid;

  return json_build_object(
    'id', v_uid,
    'email', v_email,
    'enrolled', true,
    'role', v_role,
    'full_name', v_prof.full_name,
    'avatar_url', v_prof.avatar_url,
    'leetcode_username', v_prof.leetcode_username
  );
end
$$;

-------------------------------------------------------------------------------
-- Row Level Security
-------------------------------------------------------------------------------

alter table public.allowed_emails enable row level security;
alter table public.profiles       enable row level security;
alter table public.sessions       enable row level security;
alter table public.questions      enable row level security;
alter table public.submissions    enable row level security;

-- Nothing is readable without signing in.
revoke all on public.allowed_emails, public.profiles, public.sessions, public.questions, public.submissions from anon;

-- Table access for signed-in users; the policies below decide which rows. Granted
-- explicitly rather than relying on project defaults, which can differ between projects.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.allowed_emails, public.sessions, public.questions, public.submissions to authenticated;
grant select on public.profiles to authenticated;

-- allowed_emails: admins only
create policy "admins read allowlist" on public.allowed_emails
  for select to authenticated using ((select public.is_admin()));
create policy "admins add to allowlist" on public.allowed_emails
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins change allowlist" on public.allowed_emails
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins remove from allowlist" on public.allowed_emails
  for delete to authenticated using ((select public.is_admin()));

-- profiles: your own row (or everyone's, for admins). Only the LeetCode username is editable.
create policy "read own profile, admins read all" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from authenticated;
grant update (leetcode_username) on public.profiles to authenticated;

-- sessions: enrolled people see published ones; admins see and edit everything
create policy "enrolled read visible sessions" on public.sessions
  for select to authenticated
  using ((select public.is_enrolled()) and (status = 'published' or (select public.is_admin())));
create policy "admins insert sessions" on public.sessions
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins update sessions" on public.sessions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete sessions" on public.sessions
  for delete to authenticated using ((select public.is_admin()));

-- questions: visible when their session is visible
create policy "enrolled read visible questions" on public.questions
  for select to authenticated
  using (
    (select public.is_enrolled())
    and exists (
      select 1 from public.sessions s
      where s.id = session_id and (s.status = 'published' or (select public.is_admin()))
    )
  );
create policy "admins insert questions" on public.questions
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins update questions" on public.questions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete questions" on public.questions
  for delete to authenticated using ((select public.is_admin()));

-- submissions: your own rows, only for published questions, only files in your own folder
create policy "read own submissions, admins read all" on public.submissions
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "submit for yourself" on public.submissions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_enrolled())
    and screenshot_path like (select auth.uid())::text || '/%'
    and exists (
      select 1 from public.questions q join public.sessions s on s.id = q.session_id
      where q.id = question_id and s.status = 'published'
    )
  );
create policy "replace your own submission" on public.submissions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (select public.is_enrolled())
    and screenshot_path like (select auth.uid())::text || '/%'
    and exists (
      select 1 from public.questions q join public.sessions s on s.id = q.session_id
      where q.id = question_id and s.status = 'published'
    )
  );
create policy "remove your own submission" on public.submissions
  for delete to authenticated using (user_id = (select auth.uid()) and (select public.is_enrolled()));

-------------------------------------------------------------------------------
-- Admin read models
-------------------------------------------------------------------------------

create or replace function public.admin_people()
returns table (
  email             text,
  role              text,
  created_at        timestamptz,
  user_id           uuid,
  full_name         text,
  avatar_url        text,
  leetcode_username text,
  solved_count      bigint,
  last_active_at    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.email, a.role, a.created_at,
         p.id, p.full_name, p.avatar_url, p.leetcode_username,
         count(s.id), max(s.updated_at)
  from public.allowed_emails a
  left join public.profiles p on public.normalize_email(p.email) = a.email_key
  left join public.submissions s on s.user_id = p.id
  where (select public.is_admin())
  group by a.email, a.role, a.created_at, p.id, p.full_name, p.avatar_url, p.leetcode_username
  order by a.created_at desc, a.email;
$$;

create or replace function public.admin_overview()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with students as (
    select p.id
    from public.allowed_emails a
    join public.profiles p on public.normalize_email(p.email) = a.email_key
    where a.role = 'student'
  ),
  subs as (
    select s.* from public.submissions s join students st on st.id = s.user_id
  )
  select case when not (select public.is_admin()) then null else json_build_object(
    'enrolled', (select count(*) from public.allowed_emails where role = 'student'),
    'signed_in', (select count(*) from students),
    'admins', (select count(*) from public.allowed_emails where role = 'admin'),
    'submissions_today', (
      select count(*) from subs
      where (updated_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
    ),
    'total_submissions', (select count(*) from subs),
    'sessions', coalesce((
      select json_agg(x order by x.number) from (
        select se.id, se.number, se.title, se.status, se.class_date,
               (select count(*) from public.questions q where q.session_id = se.id) as question_count,
               (select count(*) from subs join public.questions q on q.id = subs.question_id
                 where q.session_id = se.id) as submission_count,
               (select count(*) from (
                  select subs.user_id from subs join public.questions q on q.id = subs.question_id
                  where q.session_id = se.id
                  group by subs.user_id
                  having count(*) = (select count(*) from public.questions q2 where q2.session_id = se.id)
               ) done) as fully_done
        from public.sessions se
      ) x
    ), '[]'::json),
    'recent', coalesce((
      select json_agg(r) from (
        select subs.id, subs.updated_at, p.full_name, p.email, q.title, q.lc_number, se.number as session_number
        from subs
        join public.profiles p on p.id = subs.user_id
        join public.questions q on q.id = subs.question_id
        join public.sessions se on se.id = q.session_id
        order by subs.updated_at desc
        limit 8
      ) r
    ), '[]'::json)
  ) end;
$$;

revoke execute on function public.get_viewer(), public.admin_people(), public.admin_overview() from anon, public;
grant execute on function public.get_viewer(), public.admin_people(), public.admin_overview() to authenticated;
grant execute on function public.is_enrolled(), public.is_admin(), public.normalize_email(text) to authenticated;

-------------------------------------------------------------------------------
-- Screenshot storage: private bucket, one folder per user
-------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('screenshots', 'screenshots', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "students upload into their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_enrolled())
  );

create policy "read own screenshots, admins read all" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'screenshots'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

create policy "delete own screenshots, admins delete any" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'screenshots'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );
