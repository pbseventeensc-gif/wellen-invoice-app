'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isDone, setIsDone] = useState(false);
  const router = useRouter();

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg('Kata sandi minimal 6 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    setIsDone(true);
    setLoading(false);
    setTimeout(() => {
      router.push('/invoices');
    }, 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 p-4 font-sans text-stone-100">
      <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-stone-900/90 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight text-stone-100">Buat Kata Sandi Baru</h1>
          <p className="mt-1 text-xs text-stone-400">Silakan tentukan kata sandi baru untuk akun Anda</p>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isDone ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center text-emerald-400">
            <CheckCircle2 size={32} />
            <p className="text-sm font-semibold">Kata Sandi Berhasil Diperbarui!</p>
            <p className="text-xs text-stone-300">Mengalihkan ke dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-300">Kata Sandi Baru</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-500">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-xl border border-stone-800 bg-stone-950/60 py-2.5 pl-10 pr-3 text-xs text-stone-100 placeholder-stone-600 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-300">Konfirmasi Kata Sandi</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-500">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi"
                  className="w-full rounded-xl border border-stone-800 bg-stone-950/60 py-2.5 pl-10 pr-3 text-xs text-stone-100 placeholder-stone-600 outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 text-xs font-semibold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                'Simpan Kata Sandi'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}