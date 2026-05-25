import { createBrowserClient } from '@supabase/ssr';

/**
 * Client Supabase para uso no browser (Client Components).
 * Usa apenas chaves públicas (NEXT_PUBLIC_*), inlinadas pelo Next no bundle.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
