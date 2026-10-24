'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Loader2, AlertCircle, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

export default function LoginForm({ initialError = null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState(initialError);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        setErrorMsg(
          error.message === 'Invalid login credentials'
            ? 'Email atau password salah.'
            : 'Login gagal diverifikasi. Periksa koneksi Anda dan coba lagi.'
        );
        return;
      }

      if (data?.session) {
        router.push('/invoices');
        return;
      }

      setErrorMsg('Gagal memulai sesi login. Silakan coba lagi.');
    } catch (err) {
      console.error('Supabase login request failed:', err);
      setErrorMsg('Login tidak dapat diverifikasi. Periksa koneksi Anda dan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-amber-50 px-4 py-10 selection:bg-amber-200 selection:text-slate-950">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#9ed7f1_0%,#d8eff8_47%,#f5f9fb_100%)]" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-[120%] rounded-[50%] bg-white/75 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 left-[24%] h-80 w-[95%] rounded-[50%] bg-white/90 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-[-10%] h-64 w-[70%] rounded-[50%] bg-white/70 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_48%,transparent_0%,rgba(255,255,255,0.12)_60%,rgba(255,255,255,0.3)_100%)]" />

      <section className="relative z-10 w-full max-w-[390px] rounded-[28px] border border-white/80 bg-white/65 px-6 py-8 shadow-[0_24px_70px_rgba(44,92,122,0.18)] backdrop-blur-2xl sm:px-8">
        <div className="mb-7 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Wellen Print · Finance</p>
          <div className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-white/70 text-slate-700 shadow-sm">
            <LockKeyhole size={20} strokeWidth={1.7} />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">Sign in with email</h1>
          <p className="mt-1 text-xs leading-5 text-slate-600">Masuk untuk membuka workspace invoice.</p>
        </div>

        {/* Notifikasi Error */}
        {errorMsg && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        {/* Form Input */}
        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label htmlFor="login-email" className="sr-only">
              Email address
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full rounded-xl border border-white/90 bg-slate-100/80 py-3 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200"
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <LockKeyhole size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-white/90 bg-slate-100/80 py-3 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3 text-slate-400 transition hover:text-slate-700 focus:outline-none"
                tabIndex={0}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="mt-2 text-right">
              <Link
                href="/forgot-password"
                className="text-[11px] font-medium text-slate-700 transition hover:text-slate-950"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              'Get started'
            )}
          </button>
        </form>

        {/* Security & Retention Strip */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-center text-[10px] text-slate-500">
          <ShieldCheck size={13} className="text-amber-700" />
          <span>Akses terlindungi dan diverifikasi</span>
        </div>
      </section>
    </div>
  );
}
