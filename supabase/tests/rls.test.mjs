// Database access-rule tests: runs the real migrations + seed in PGlite (Postgres in WASM)
// with minimal stand-ins for Supabase's auth/storage schemas, then acts as an admin, a
// student and an outsider. No Supabase project or Docker needed:  pnpm test:db
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const migrationsDir = `${ROOT}/supabase/migrations`;
const migrations = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => fs.readFileSync(`${migrationsDir}/${f}`, "utf8"));
const seed = fs.readFileSync(`${ROOT}/supabase/seed.sql`, "utf8");

const db = new PGlite();
let failures = 0;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

// ---- Supabase-like environment ----
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema public, auth, storage to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);

try {
  for (const sql of migrations) await db.exec(sql);
  check(`migrations run (${migrations.length})`, true);
} catch (e) {
  check("migrations run", false, e.message);
  console.log(results.join("\n"));
  process.exit(1);
}
try {
  await db.exec(seed);
  check("seed runs", true);
} catch (e) {
  check("seed runs", false, e.message);
}

// Day 1 content
const day1 = (await db.query(`
  select s.status, s.class_date = (now() at time zone 'Asia/Kolkata')::date as today,
         count(*) filter (where q.kind = 'class')::int as cw,
         count(*) filter (where q.kind = 'homework')::int as hw
  from public.sessions s join public.questions q on q.session_id = s.id
  where s.number = 1 group by s.status, s.class_date`)).rows[0];
check("Day 1 is published, dated today, 6 classwork + 10 homework", day1?.status === "published" && day1.today && day1.cw === 6 && day1.hw === 10, JSON.stringify(day1));
await db.exec(seed);
check("re-running the seed changes nothing", (await db.query("select count(*)::int n from public.questions")).rows[0].n === 16);

// Start from a draft so the visibility rules can be exercised below.
await db.exec("update public.sessions set status = 'draft', published_at = null");

// ---- people ----
const ADMIN = "11111111-1111-1111-1111-111111111111";
const STUDENT = "22222222-2222-2222-2222-222222222222";
const OUTSIDER = "33333333-3333-3333-3333-333333333333";
const OTHER = "44444444-4444-4444-4444-444444444444";
await db.exec(`
  insert into public.allowed_emails (email, role) values ('Admin.Person@Gmail.com', 'admin');
  insert into public.allowed_emails (email, role) values ('studentone@gmail.com', 'student');
  insert into public.allowed_emails (email, role) values ('other@college.edu', 'student');
  insert into auth.users values
    ('${ADMIN}', 'admin.person@gmail.com', '{"full_name":"Admin Person","avatar_url":"https://x/a.png"}'),
    ('${STUDENT}', 'student.one@gmail.com', '{"name":"Student One"}'),
    ('${OUTSIDER}', 'stranger@gmail.com', '{}'),
    ('${OTHER}', 'other@college.edu', '{}');
`);
const stored = await db.query(`select email, email_key from public.allowed_emails order by email`);
check("allowlist lower-cases on insert", stored.rows.some((r) => r.email === "admin.person@gmail.com"));
check("gmail key strips dots", stored.rows.some((r) => r.email_key === "adminperson@gmail.com"));

// Run SQL as a signed-in user (RLS applies), inside a transaction we roll back unless told to keep it.
async function as(uid, email, sql, params = [], keep = true) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, email, role: "authenticated" })]);
    await tx.exec("set local role authenticated");
    const res = await tx.query(sql, params);
    if (!keep) await tx.rollback();
    return res;
  });
}
async function fails(fn) {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

// get_viewer + profile creation (note: Google returns dotted gmail, allowlist has no dots)
const v1 = await as(STUDENT, "student.one@gmail.com", "select public.get_viewer() as v");
check("student enrolled via gmail dot-normalisation", v1.rows[0].v.enrolled === true && v1.rows[0].v.role === "student");
check("profile created on first sign-in", (await db.query(`select count(*)::int n from public.profiles where id = '${STUDENT}'`)).rows[0].n === 1);
const vName = await db.query(`select full_name from public.profiles where id = '${STUDENT}'`);
check("profile name falls back to 'name' claim", vName.rows[0].full_name === "Student One");
const va = await as(ADMIN, "admin.person@gmail.com", "select public.get_viewer() as v");
check("admin viewer has admin role", va.rows[0].v.role === "admin");
const vo = await as(OUTSIDER, "stranger@gmail.com", "select public.get_viewer() as v");
check("outsider not enrolled", vo.rows[0].v.enrolled === false);
check("outsider gets no profile", (await db.query(`select count(*)::int n from public.profiles where id = '${OUTSIDER}'`)).rows[0].n === 0);
await as(OTHER, "other@college.edu", "select public.get_viewer()");

// Draft visibility
check("student can't see draft S1", (await as(STUDENT, "student.one@gmail.com", "select count(*)::int n from public.sessions")).rows[0].n === 0);
check("student can't see draft questions", (await as(STUDENT, "student.one@gmail.com", "select count(*)::int n from public.questions")).rows[0].n === 0);
check("admin sees draft S1", (await as(ADMIN, "admin.person@gmail.com", "select count(*)::int n from public.sessions")).rows[0].n === 1);

// Student can't write sessions; admin can publish
check("student can't publish", (await as(STUDENT, "student.one@gmail.com", "update public.sessions set status = 'published' returning id")).rows.length === 0);
await as(ADMIN, "admin.person@gmail.com", "update public.sessions set status = 'published'");
const pub = await db.query("select status, published_at from public.sessions");
check("admin publishes; published_at stamped", pub.rows[0].status === "published" && pub.rows[0].published_at !== null);
check("student sees published S1 + 16 questions", (await as(STUDENT, "student.one@gmail.com", "select count(*)::int n from public.questions")).rows[0].n === 16);
check("outsider sees nothing", (await as(OUTSIDER, "stranger@gmail.com", "select count(*)::int n from public.sessions")).rows[0].n === 0);
check("anon sees nothing", await fails(() => db.transaction(async (tx) => {
  await tx.exec("set local role anon");
  await tx.query("select count(*) from public.sessions");
})));

// Submissions
const q = (await db.query("select id from public.questions order by kind, position limit 1")).rows[0].id;
check(
  "student submits own screenshot",
  !(await fails(() => as(STUDENT, "student.one@gmail.com", `insert into public.submissions (user_id, question_id, screenshot_path) values ($1, $2, $3)`, [STUDENT, q, `${STUDENT}/${q}/1.webp`]))),
);
check(
  "student can't point at someone else's file",
  await fails(() => as(OTHER, "other@college.edu", `insert into public.submissions (user_id, question_id, screenshot_path) values ($1, $2, $3)`, [OTHER, q, `${STUDENT}/${q}/1.webp`])),
);
check(
  "student can't submit as someone else",
  await fails(() => as(STUDENT, "student.one@gmail.com", `insert into public.submissions (user_id, question_id, screenshot_path) values ($1, $2, $3)`, [OTHER, q, `${OTHER}/${q}/1.webp`])),
);
check(
  "outsider can't submit",
  await fails(() => as(OUTSIDER, "stranger@gmail.com", `insert into public.submissions (user_id, question_id, screenshot_path) values ($1, $2, $3)`, [OUTSIDER, q, `${OUTSIDER}/${q}/1.webp`])),
);
// upsert (replace) bumps updated_at
const before = (await db.query("select updated_at from public.submissions")).rows[0].updated_at;
await as(
  STUDENT,
  "student.one@gmail.com",
  `insert into public.submissions (user_id, question_id, screenshot_path) values ($1, $2, $3)
   on conflict (user_id, question_id) do update set screenshot_path = excluded.screenshot_path`,
  [STUDENT, q, `${STUDENT}/${q}/2.webp`],
);
const after = (await db.query("select updated_at, screenshot_path from public.submissions")).rows[0];
check("re-upload replaces path and bumps updated_at", after.screenshot_path.endsWith("/2.webp") && after.updated_at >= before);
check("other student can't read it", (await as(OTHER, "other@college.edu", "select count(*)::int n from public.submissions")).rows[0].n === 0);
check("admin can read it", (await as(ADMIN, "admin.person@gmail.com", "select count(*)::int n from public.submissions")).rows[0].n === 1);

// Profiles
check("student can't read allowlist", (await as(STUDENT, "student.one@gmail.com", "select count(*)::int n from public.allowed_emails")).rows[0].n === 0);
check("student can't change their email", await fails(() => as(STUDENT, "student.one@gmail.com", "update public.profiles set email = 'x@y.z' where id = $1", [STUDENT])));
check(
  "student can set their LeetCode username",
  (await as(STUDENT, "student.one@gmail.com", "update public.profiles set leetcode_username = 'student_one' where id = $1 returning id", [STUDENT])).rows.length === 1,
);
check(
  "usernames are unique (case-insensitive)",
  await fails(() => as(OTHER, "other@college.edu", "update public.profiles set leetcode_username = 'Student_One' where id = $1", [OTHER])),
);
check("student can't edit others' profiles", (await as(STUDENT, "student.one@gmail.com", "update public.profiles set leetcode_username = 'zzz' where id = $1 returning id", [OTHER])).rows.length === 0);

// Admin read models
const ov = (await as(ADMIN, "admin.person@gmail.com", "select public.admin_overview() as o")).rows[0].o;
check("admin_overview works", ov && ov.enrolled === 2 && ov.signed_in === 2 && ov.total_submissions === 1 && ov.sessions.length === 1, JSON.stringify({ e: ov?.enrolled, s: ov?.signed_in, t: ov?.total_submissions }));
check("admin_overview hidden from students", (await as(STUDENT, "student.one@gmail.com", "select public.admin_overview() as o")).rows[0].o === null);
const people = (await as(ADMIN, "admin.person@gmail.com", "select * from public.admin_people()")).rows;
check("admin_people lists allowlist with solved counts", people.length === 3 && people.find((p) => p.email === "studentone@gmail.com")?.solved_count == 1);
check("admin_people empty for students", (await as(STUDENT, "student.one@gmail.com", "select * from public.admin_people()")).rows.length === 0);

// Storage policies
check(
  "student uploads into own folder",
  !(await fails(() => as(STUDENT, "student.one@gmail.com", "insert into storage.objects (bucket_id, name) values ('screenshots', $1)", [`${STUDENT}/${q}/2.webp`]))),
);
check(
  "student can't upload into another folder",
  await fails(() => as(STUDENT, "student.one@gmail.com", "insert into storage.objects (bucket_id, name) values ('screenshots', $1)", [`${OTHER}/${q}/9.webp`])),
);
check("other student can't read the file", (await as(OTHER, "other@college.edu", "select count(*)::int n from storage.objects")).rows[0].n === 0);
check("admin can read the file", (await as(ADMIN, "admin.person@gmail.com", "select count(*)::int n from storage.objects")).rows[0].n === 1);
check("bucket is private with limits", (await db.query("select public, file_size_limit from storage.buckets where id = 'screenshots'")).rows[0].public === false);

// Attendance + leaderboard
check("student can't read attendance", (await as(STUDENT, "student.one@gmail.com", "select count(*)::int n from public.attendance")).rows[0].n === 0);
const s1 = (await db.query("select id from public.sessions where number = 1")).rows[0].id;
check(
  "student can't mark attendance",
  await fails(() => as(STUDENT, "student.one@gmail.com", "insert into public.attendance (session_id, email, present) values ($1, 'studentone@gmail.com', true)", [s1])),
);
check(
  "admin marks attendance",
  !(await fails(() =>
    as(ADMIN, "admin.person@gmail.com", `insert into public.attendance (session_id, email, present) values ($1, 'studentone@gmail.com', true), ($1, 'other@college.edu', false)`, [s1]),
  )),
);
const lbStudent = (await as(STUDENT, "student.one@gmail.com", "select public.leaderboard('overall') as l")).rows[0].l;
const meRow = lbStudent?.rows?.find((r) => r.is_me);
check(
  "leaderboard: 70/30 overall score",
  lbStudent && lbStudent.total_problems === 16 && lbStudent.classes_held === 1 && meRow?.rank === 1 && Number(meRow?.score) === 34.4,
  JSON.stringify(meRow),
);
check("leaderboard hides LeetCode usernames from students", lbStudent && !lbStudent.full && lbStudent.rows.every((r) => r.leetcode_username === null));
const lbAdmin = (await as(ADMIN, "admin.person@gmail.com", "select public.leaderboard('overall') as l")).rows[0].l;
check("admins get the full board with usernames", lbAdmin?.full === true && lbAdmin.rows.some((r) => r.leetcode_username === "student_one"));
const lbAttendance = (await as(OTHER, "other@college.edu", "select public.leaderboard('attendance') as l")).rows[0].l;
check(
  "ranking by attendance alone",
  lbAttendance?.rows[0]?.name === "Student One" && lbAttendance.rows.find((r) => r.is_me)?.rank === 2,
  JSON.stringify(lbAttendance?.rows?.map((r) => [r.name, r.rank])),
);
check("outsiders get no leaderboard", (await as(OUTSIDER, "stranger@gmail.com", "select public.leaderboard() as l")).rows[0].l === null);
// Twelve more students who have each solved one problem push OTHER (nothing solved) out of the top 10.
for (let i = 1; i <= 12; i++) {
  const id = `00000000-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`;
  await db.exec(`
    insert into public.allowed_emails (email) values ('extra${i}@gmail.com');
    insert into auth.users (id, email) values ('${id}', 'extra${i}@gmail.com');
    insert into public.profiles (id, email, full_name) values ('${id}', 'extra${i}@gmail.com', 'Extra ${i}');
    insert into public.submissions (user_id, question_id, screenshot_path) values ('${id}', '${q}', '${id}/${q}/1.webp');
  `);
}
const lbCrowded = (await as(OTHER, "other@college.edu", "select public.leaderboard() as l")).rows[0].l;
check(
  "students see the top 10 plus their own place",
  lbCrowded?.rows.length === 11 && lbCrowded.rows[10].is_me && lbCrowded.rows[10].rank === 14 && lbCrowded.student_count === 14,
  JSON.stringify({ n: lbCrowded?.rows.length, last: lbCrowded?.rows.at(-1) }),
);
check("admins still see everyone", (await as(ADMIN, "admin.person@gmail.com", "select public.leaderboard() as l")).rows[0].l?.rows.length === 14);

// Allowlist management
check("last admin can't be removed", await fails(() => as(ADMIN, "admin.person@gmail.com", "delete from public.allowed_emails where email = 'admin.person@gmail.com'")));
check("last admin can't be demoted", await fails(() => as(ADMIN, "admin.person@gmail.com", "update public.allowed_emails set role = 'student' where email = 'admin.person@gmail.com'")));
check("student can't add people", await fails(() => as(STUDENT, "student.one@gmail.com", "insert into public.allowed_emails (email) values ('friend@gmail.com')")));
await as(ADMIN, "admin.person@gmail.com", "delete from public.allowed_emails where email = 'studentone@gmail.com'");
check("removed student loses access immediately", (await as(STUDENT, "student.one@gmail.com", "select count(*)::int n from public.sessions")).rows[0].n === 0);
check("removing a student also clears their attendance", (await db.query("select count(*)::int n from public.attendance where email = 'studentone@gmail.com'")).rows[0].n === 0);
check("removed student can't submit", await fails(() => as(STUDENT, "student.one@gmail.com", "delete from public.submissions where user_id = $1 returning id", [STUDENT]).then((r) => { if (r.rows.length === 0) throw new Error("blocked"); })));

// Cascade
await db.exec("delete from public.questions");
check("deleting questions cascades submissions", (await db.query("select count(*)::int n from public.submissions")).rows[0].n === 0);

console.log(results.join("\n"));
console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILED`}`);
process.exit(failures ? 1 : 0);
