'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      // Set timeout 8 detik agar tombol tidak gantung/macet di 'PROCESSING...'
      const authPromise = supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Koneksi ke server timeout. Silakan periksa jaringan Anda atau coba lagi.')),
          8000
        )
      );

      const res = await Promise.race([authPromise, timeoutPromise]);
      const { data, error } = res || {};

      if (error) {
        setErrorMsg(
          error.message === 'Invalid login credentials'
            ? 'Email atau password salah. Silakan periksa kembali kredensial Anda.'
            : error.message
        );
        setLoading(false);
        return;
      }

      if (data?.session) {
        router.push('/invoices');
        window.location.href = '/invoices';
        return;
      }

      setErrorMsg('Gagal memulai sesi login. Silakan coba lagi.');
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Gagal terhubung ke server autentikasi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-stone-900/80 p-4 font-sans selection:bg-[#578ef5] selection:text-white">
      {/* Background Overlay */}
      <div 
        className="absolute inset-0 -z-10 bg-cover bg-center opacity-30 blur-[1px]"
        style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />

      {/* Card Login */}
      <div className="w-full max-w-sm rounded-3xl bg-white px-8 py-10 shadow-2xl transition-all border border-stone-200">
        
        {/* Logo Wellen Print */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative h-24 w-80 mb-2">
            <Image
              src="/logo-wellen.png"
              alt="Wellen Print Logo"
              fill
              sizes="320px"
              className="object-contain"
              priority
            />
          </div>

          <h1 className="mt-2 text-xl font-bold text-stone-900">Admin Account</h1>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Sign in to access sales & invoicing portal
          </p>
        </div>

        {/* Notifikasi Error */}
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-600">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Input */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
              EMAIL ADDRESS
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@wellenprint.com"
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-stone-800 placeholder-stone-400 outline-none transition focus:border-[#578ef5] focus:ring-1 focus:ring-[#578ef5]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-stone-500">
              PASSWORD
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#578ef5] focus:ring-1 focus:ring-[#578ef5]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-stone-400 transition hover:text-stone-600 focus:outline-none cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-[11px] font-medium text-stone-400 transition hover:text-stone-700"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition hover:bg-stone-800 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>PROCESSING...</span>
              </>
            ) : (
              'SIGN IN'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
