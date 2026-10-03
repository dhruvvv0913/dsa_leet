import { NextResponse, type NextRequest } from "next/server";
import { isDemo } from "@/lib/site";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Google sends people back here after they pick an account. We swap the one-time
// code for a session (stored in cookies), then continue into the app.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const requested = searchParams.get("next") ?? "/";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";

  const forwardedHost = request.headers.get("x-forwarded-host");
  const base = process.env.NODE_ENV !== "development" && forwardedHost ? `https://${forwardedHost}` : origin;

  if (isDemo) return NextResponse.redirect(`${base}/`);

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${base}${next}`);
  }
  return NextResponse.redirect(`${base}/login?error=auth`);
}
