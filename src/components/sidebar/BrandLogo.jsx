'use client';

import Image from 'next/image';

export default function BrandLogo() {
  return (
    <div className="p-5 flex items-center gap-3 border-b border-stone-800">
      <div className="w-9 h-9 relative bg-white rounded-lg p-1 flex items-center justify-center overflow-hidden shrink-0">
        <Image
          src="/logo-wellen.png"
          alt="Wellen Logo"
          width={32}
          height={32}
          className="object-contain"
        />
      </div>
      <div>
        <h1 className="font-bold text-white text-sm leading-tight tracking-wide">WELLEN</h1>
        <p className="text-[10px] text-[#578ef5] font-semibold tracking-wider uppercase">Invoice Generator</p>
      </div>
    </div>
  );
}
