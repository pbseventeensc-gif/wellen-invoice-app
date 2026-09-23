'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        setErrorMsg(
          error.message === 'Invalid login credentials'
            ? 'Invalid email or password. Please check your credentials.'
            : error.message
        );
        return;
      }

      if (data?.session) {
        window.location.href = '/invoices';
        return;
      }
    } catch (err) {
      console.error('Unexpected Login Error:', err);
      setErrorMsg('Failed to connect to authentication server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-900/60 p-4 font-sans selection:bg-orange-500 selection:text-white">
      {/* Background Overlay */}
      <div 
        className="absolute inset-0 -z-10 bg-cover bg-center opacity-40 blur-[1px]" 
        style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />

      {/* Card Login */}
      <div className="w-full max-w-sm rounded-3xl bg-white px-8 py-10 shadow-2xl transition-all">
        
        {/* Logo Wellen Print */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative h-32 w-96 mb-2">
            <Image
              src="/logo-wellen.png"
              alt="Wellen Print Logo"
              fill
              sizes="(max-width: 768px) 100vw, 384px"
              className="object-contain"
              priority
            />
          </div>

          <h1 className="mt-4 text-xl font-bold text-slate-900">Admin Account</h1>
          <p className="mt-1 text-xs text-slate-500">
            
          </p>
        </div>

        {/* Notifikasi Error */}
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Input */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              EMAIL ADDRESS
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@wellenprint.com"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              PASSWORD
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-10 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-600 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-[11px] font-medium text-slate-400 transition hover:text-slate-700"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f172a] py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition hover:bg-[#1e293b] active:scale-[0.99] disabled:opacity-50"
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