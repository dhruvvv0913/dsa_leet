import { NextResponse, type NextRequest } from "next/server";
import { isDifficulty, isValidSlug, problemUrl, slugToTitle } from "@/lib/leetcode";
import { isDemo } from "@/lib/site";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LeetCodeProblem } from "@/lib/types";

// Looks up a problem's number, exact title and difficulty from its slug.
// Runs server-side because LeetCode's GraphQL endpoint doesn't allow browser (CORS) calls.

const QUERY = "query q($slug: String!) { question(titleSlug: $slug) { questionFrontendId title difficulty } }";
const cache = new Map<string, LeetCodeProblem>();

export async function GET(request: NextRequest) {
  const slug = (request.nextUrl.searchParams.get("slug") ?? "").toLowerCase();
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "That isn't a LeetCode problem link." }, { status: 400 });
  }

  // In production only admins may use this (it's an outbound proxy).
  if (!isDemo) {
    const supabase = await createSupabaseServerClient();
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin !== true) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const cached = cache.get(slug);
  if (cached) return NextResponse.json(cached);

  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: `https://leetcode.com/problems/${slug}/`,
        "User-Agent": "Mozilla/5.0 (compatible; dsa-cohort/1.0)",
      },
      body: JSON.stringify({ query: QUERY, variables: { slug } }),
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      const q = json?.data?.question;
      if (!q) return NextResponse.json({ error: "LeetCode has no problem with that link." }, { status: 404 });
      const problem: LeetCodeProblem = {
        slug,
        number: Number(q.questionFrontendId) || null,
        title: String(q.title),
        difficulty: isDifficulty(q.difficulty) ? q.difficulty : null,
        url: problemUrl(slug),
        verified: true,
      };
      cache.set(slug, problem);
      return NextResponse.json(problem);
    }
  } catch {
    // LeetCode unreachable or slow — fall through to a best guess.
  }

  const guess: LeetCodeProblem = {
    slug,
    number: null,
    title: slugToTitle(slug),
    difficulty: null,
    url: problemUrl(slug),
    verified: false,
  };
  return NextResponse.json(guess);
}
