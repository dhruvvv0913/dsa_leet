// Site-wide configuration. Everything here can be overridden with env vars.

export const site = {
  /** Brand (from the logo) */
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "imaginati",
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE || "where ideas take flight",
  /** This product */
  product: process.env.NEXT_PUBLIC_COHORT_NAME || "DSA Cohort",
  description:
    process.env.NEXT_PUBLIC_COHORT_DESCRIPTION ||
    "Live sessions, hand-picked LeetCode problems, and progress you can actually see.",
  // Dates ("class on 19 Sep", "submissions today") are shown in this time zone.
  timeZone: "Asia/Kolkata",
};

/** localStorage key for the light/dark choice. Dark is the default. */
export const THEME_STORAGE_KEY = "imaginati-theme";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Preview mode simulates the backend in the visitor's browser, so the site works before
 * Supabase and Google sign-in are set up. It is on whenever Supabase isn't configured,
 * or when NEXT_PUBLIC_DEMO_MODE=true.
 */
export const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !supabaseUrl || !supabaseKey;
