import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { isRouteAllowed } from '@/config/permissions';

const AUTH_PATHS = ['/login', '/forgot-password', '/reset-password'];

function redirectToLogin(request, error) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('error', error);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (AUTH_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL atau Anon Key belum disetel di environment.');
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('Could not verify Supabase session:', authError.message);
  }
  if (authError || !user) {
    return redirectToLogin(request, 'session');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Could not verify account role:', profileError.message);
    return redirectToLogin(request, 'access');
  }

  if (!profile?.role || !isRouteAllowed(profile.role, pathname)) {
    return redirectToLogin(request, 'access');
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
