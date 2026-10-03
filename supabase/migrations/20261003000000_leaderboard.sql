-- Attendance + leaderboard.
-- Students are ranked by problems solved and classes attended (70% / 30% overall), or by
-- either one alone. Students see the top 10 plus their own place; admins see everyone.

-------------------------------------------------------------------------------
-- Attendance: one mark per enrolled email per class. Marked by admins.
-- Keyed by email (not profile) so students can be marked before they first sign in.
-------------------------------------------------------------------------------

create table public.attendance (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  email       text not null references public.allowed_emails (email) on delete cascade on update cascade,
  present     boolean not null,
  marked_by   uuid references auth.users (id) on delete set null,
  marked_at   timestamptz not null default now(),
  primary key (session_id, email)
);

alter table public.attendance enable row level security;
revoke all on public.attendance from anon;
grant select, insert, update, delete on public.attendance to authenticated;

create policy "admins manage attendance" on public.attendance
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-------------------------------------------------------------------------------
-- Leaderboard
--   problems   = solved / problems in published sessions
--   attendance = attended / classes held (published sessions with any attendance marked)
--   overall    = 70% problems + 30% attendance (a side with nothing held yet is left out)
-- Keep the weights in sync with lib/leaderboard.ts.
-------------------------------------------------------------------------------

create or replace function public.leaderboard(criteria text default 'overall')
returns json
language sql
stable
security definer
set search_path = ''
as $$
  with students as (
    select a.email, p.id, p.full_name, p.avatar_url, p.leetcode_username
    from public.allowed_emails a
    join public.profiles p on public.normalize_email(p.email) = a.email_key
    where a.role = 'student'
  ),
  published_questions as (
    select q.id
    from public.questions q
    join public.sessions s on s.id = q.session_id
    where s.status = 'published'
  ),
  held as (
    select distinct att.session_id
    from public.attendance att
    join public.sessions s on s.id = att.session_id
    where s.status = 'published'
  ),
  totals as (
    select (select count(*) from published_questions) as total_problems,
           (select count(*) from held) as classes_held
  ),
  stats as (
    select st.*,
           (select count(*) from public.submissions sub
             join published_questions pq on pq.id = sub.question_id
             where sub.user_id = st.id) as solved,
           (select count(*) from public.attendance att
             join held h on h.session_id = att.session_id
             where att.email = st.email and att.present) as attended
    from students st
  ),
  ratios as (
    select s.*,
           case when t.total_problems > 0 then s.solved::numeric / t.total_problems end as p,
           case when t.classes_held > 0 then s.attended::numeric / t.classes_held end as a
    from stats s cross join totals t
  ),
  valued as (
    select r.*,
           round(100 * case
             when r.p is null and r.a is null then 0
             when r.a is null then r.p
             when r.p is null then r.a
             else 0.7 * r.p + 0.3 * r.a
           end, 1) as overall
    from ratios r
  ),
  ranked as (
    select v.*,
           rank() over (order by sort_value desc) as rnk,
           row_number() over (order by sort_value desc, v.solved desc, v.attended desc, v.full_name, v.email) as pos
    from (
      select v.*,
             case criteria
               when 'problems' then coalesce(v.p, 0)
               when 'attendance' then coalesce(v.a, 0)
               else v.overall
             end as sort_value
      from valued v
    ) v
  ),
  viewer as (
    select (select public.is_admin()) as is_admin, (select public.is_enrolled()) as is_enrolled
  )
  select case when not (select is_enrolled from viewer) then null else json_build_object(
    'total_problems', (select total_problems from totals),
    'classes_held', (select classes_held from totals),
    'student_count', (select count(*) from students),
    'full', (select is_admin from viewer),
    'rows', coalesce((
      select json_agg(json_build_object(
               'rank', r.rnk,
               'user_id', r.id,
               'name', coalesce(r.full_name, case when (select is_admin from viewer) then r.email else 'Student' end),
               'avatar_url', r.avatar_url,
               'leetcode_username', case when (select is_admin from viewer) then r.leetcode_username end,
               'solved', r.solved,
               'attended', r.attended,
               'score', r.overall,
               'is_me', r.id = auth.uid()
             ) order by r.pos)
      from ranked r
      where (select is_admin from viewer) or r.pos <= 10 or r.id = auth.uid()
    ), '[]'::json)
  ) end;
$$;

revoke execute on function public.leaderboard(text) from anon, public;
grant execute on function public.leaderboard(text) to authenticated;
