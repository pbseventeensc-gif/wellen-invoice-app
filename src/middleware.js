import { NextResponse } from 'next/server';

export async function middleware(request) {
  // Login dinonaktifkan sementara untuk akses langsung
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};