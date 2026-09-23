'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import userAvatar from '@/assets/logo_userlogin.png';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const redirectUrl = `${window.location.origin}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950 p-4 font-sans text-stone-100">
      <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-stone-900/90 p-8 shadow-2xl backdrop-blur-xl">
        {/* Avatar & Judul */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex justify-center">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-stone-700 bg-stone-800 shadow-md">
              <Image
                src={userAvatar}
                alt="Wellen Avatar"
                width={64}
                height={64}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-stone-100">Pemulihan Kata Sandi</h1>
          <p className="mt-1 text-xs text-stone-400">
            Masukkan email terdaftar untuk menerima tautan ubah kata sandi
          </p>
        </div>

        {/* Notifikasi Error */}
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Notifikasi Berhasil */}
        {success ? (
          <div className="space-y-4 text-center">
            <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400">
              <CheckCircle2 size={28} />
              <p className="text-xs font-semibold">Tautan Terkirim!</p>
              <p className="text-[11px] text-stone-300">
                Silakan periksa kotak masuk atau spam email <b>{email}</b> untuk melanjutkan pergantian kata sandi.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-xs text-stone-400 hover:text-orange-400 transition"
            >
              <ArrowLeft size={14} />
              Kembali ke Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-300">Email Perusahaan</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-stone-500">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@wellen.com"
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
                  <span>Mengirim tautan...</span>
                </>
              ) : (
                'Kirim Tautan Reset'
              )}
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-orange-400 transition"
              >
                <ArrowLeft size={13} />
                Kembali ke Halaman Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}