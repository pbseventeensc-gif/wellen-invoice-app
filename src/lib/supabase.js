import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or anonymous key is missing from .env.local');
}

// createBrowserClient otomatis menyinkronkan token login ke Cookies browser
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);