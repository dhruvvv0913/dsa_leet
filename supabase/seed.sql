-- Day 1: Session 1 with its classwork and homework, published and dated today (IST).
-- Run once after the migration. Safe to re-run: it skips if Session 1 already exists.
-- Admin emails are NOT in this file (the repo is public) — see README "Go live".

do $$
declare
  s1 uuid;
begin
  if exists (select 1 from public.sessions where number = 1) then
    raise notice 'Session 1 already exists — nothing to do.';
    return;
  end if;

  insert into public.sessions (number, title, description, class_date, status)
  values (
    1,
    'Complexity Analysis + Math & Logic Building',
    'How to measure what an algorithm costs (Big-O for time and space), then number puzzles that train the habit of spotting patterns before writing code.',
    (now() at time zone 'Asia/Kolkata')::date,
    'published'
  )
  returning id into s1;

  insert into public.questions (session_id, kind, position, lc_number, title, leetcode_url, difficulty, hint)
  values
    -- Classwork
    (s1, 'class',    1,    9, 'Palindrome Number',                          'https://leetcode.com/problems/palindrome-number/',                          'Easy',   null),
    (s1, 'class',    2,  268, 'Missing Number',                             'https://leetcode.com/problems/missing-number/',                             'Easy',   'Solve it with the sum formula — it comes back in S2 with XOR'),
    (s1, 'class',    3,  292, 'Nim Game',                                   'https://leetcode.com/problems/nim-game/',                                   'Easy',   null),
    (s1, 'class',    4,  319, 'Bulb Switcher',                              'https://leetcode.com/problems/bulb-switcher/',                              'Medium', null),
    (s1, 'class',    5,  258, 'Add Digits',                                 'https://leetcode.com/problems/add-digits/',                                 'Easy',   null),
    (s1, 'class',    6, 1979, 'Find Greatest Common Divisor of Array',      'https://leetcode.com/problems/find-greatest-common-divisor-of-array/',      'Easy',   null),
    -- Homework
    (s1, 'homework', 1,  412, 'Fizz Buzz',                                  'https://leetcode.com/problems/fizz-buzz/',                                  'Easy',   null),
    (s1, 'homework', 2, 1342, 'Number of Steps to Reduce a Number to Zero', 'https://leetcode.com/problems/number-of-steps-to-reduce-a-number-to-zero/', 'Easy',   null),
    (s1, 'homework', 3, 1295, 'Find Numbers with Even Number of Digits',    'https://leetcode.com/problems/find-numbers-with-even-number-of-digits/',    'Easy',   null),
    (s1, 'homework', 4, 2520, 'Count the Digits That Divide a Number',      'https://leetcode.com/problems/count-the-digits-that-divide-a-number/',      'Easy',   null),
    (s1, 'homework', 5,  507, 'Perfect Number',                             'https://leetcode.com/problems/perfect-number/',                             'Easy',   null),
    (s1, 'homework', 6,  263, 'Ugly Number',                                'https://leetcode.com/problems/ugly-number/',                                'Easy',   null),
    (s1, 'homework', 7,  326, 'Power of Three',                             'https://leetcode.com/problems/power-of-three/',                             'Easy',   null),
    (s1, 'homework', 8,  172, 'Factorial Trailing Zeroes',                  'https://leetcode.com/problems/factorial-trailing-zeroes/',                  'Medium', null),
    (s1, 'homework', 9,  204, 'Count Primes',                               'https://leetcode.com/problems/count-primes/',                               'Medium', null),
    (s1, 'homework', 10, 877, 'Stone Game',                                 'https://leetcode.com/problems/stone-game/',                                 'Medium', null);
end
$$;
