import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createServerClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(`Missing Supabase config: url=${!!url} key=${!!key}`);
  }
  return createSupabaseClient(url, key);
}
