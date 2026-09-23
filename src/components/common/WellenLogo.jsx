'use client';

/**
 * Ganti nilai w (lebar) dan h (tinggi) di bawah ini:
 * - Ukuran sebelumnya : className = "w-8 h-[44px]"
 * - Ukuran lebih besar: className = "w-10 h-[52px]" atau "w-12 h-[60px]"
 */
export default function WellenLogo({ className = 'w-12 h-[64px]' }) {
  return (
    <svg
      viewBox="0 0 140 190"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} flex-shrink-0`}
    >
      {/* Daun Merah (Kanan) */}
      <path
        d="M48 6 C85 10, 118 42, 118 85 L118 165 C88 152, 60 132, 48 112 Z"
        fill="#E60012"
      />
      {/* Daun Oranye (Tengah) */}
      <path
        d="M29 44 C62 48, 85 76, 85 116 L85 174 C60 162, 38 143, 29 126 Z"
        fill="#F37021"
      />
      {/* Daun Kuning (Kiri) */}
      <path
        d="M15 82 C42 86, 54 110, 54 142 L54 180 C36 170, 20 152, 15 138 Z"
        fill="#FFD100"
      />
    </svg>
  );
}