import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const isAuthPage =
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/forgot-password');

  // Belum login dan mencoba akses dashboard/internal
  if (!user && !isAuthPage) {
    url.pathname = '/login';
    const redirectResponse = NextResponse.redirect(url);
    // Salin cookie yang diperbarui (jika ada) ke response redirect
    response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c.name, c.value));
    return redirectResponse;
  }

  // Sudah login tapi mencoba membuka form login/forgot password
  if (user && isAuthPage) {
    url.pathname = '/invoices';
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c.name, c.value));
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};