import Image from 'next/image';

export default function WellenLogo({ className = 'w-36' }) {
  return (
    <span className={`invoice-letterhead-logo ${className}`}>
      <Image
        src="/wellen-logo.jpeg"
        alt="Wellen Print"
        width={354}
        height={354}
        loading="eager"
        unoptimized
      />
    </span>
  );
}
