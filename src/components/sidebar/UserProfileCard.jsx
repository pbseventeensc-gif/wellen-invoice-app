'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Import langsung gambar dari folder src/assets
import userAvatar from '@/assets/logo_userlogin.png';

export default function UserProfileCard({ 
  name = 'Admin', 
  role = 'AR Creator' 
}) {
  const [profile, setProfile] = useState({ name, role });
  const router = useRouter();

  useEffect(() => {
    const loadUserProfile = async () => {
      // 1. Ambil session user aktif
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // 2. Ambil data nama & role dari tabel profiles
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .single();

        if (profileData && !error) {
          setProfile({
            name: profileData.full_name || name,
            role: profileData.role || role,
          });
        } else {
          // Fallback jika profile belum ada di database
          setProfile({
            name: user.email?.split('@')[0]?.toUpperCase() || name,
            role: role,
          });
        }
      }
    };

    loadUserProfile();
  }, [name, role]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="border-t border-slate-100 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar Gambar menggantikan inisial SA */}
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-orange-200 bg-orange-50 shadow-sm">
            <Image
              src={userAvatar}
              alt={profile.name}
              fill
              sizes="40px"
              className="object-cover"
              priority
            />
          </div>

          {/* Info User */}
          <div className="flex flex-col text-left">
            <p className="text-sm font-semibold text-slate-800 leading-tight">
              {profile.name}
            </p>
            <p className="text-xs text-slate-400">
              {profile.role}
            </p>
          </div>
        </div>

        {/* Tombol Logout */}
        <button 
          onClick={handleLogout}
          title="Logout" 
          className="rounded p-1 text-slate-400 transition-colors hover:text-red-500"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}