import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "../site";

let client: SupabaseClient | null = null;

export function getSupabaseBrowser() {
  client ??= createBrowserClient(supabaseUrl, supabaseKey);
  return client;
}
