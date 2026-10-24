import './globals.css';
import { Inter } from 'next/font/google';
import DashboardLayoutWrapper from '@/components/DashboardLayoutWrapper';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'Wellen Invoice Generator',
  description: 'Wellen Brothers Accounting and Invoicing Application',
  icons: {
    icon: [
      { url: '/logo-wellen.png', type: 'image/png' },
      { url: '/icon.png', type: 'image/png' },
    ],
    shortcut: '/logo-wellen.png',
    apple: '/logo-wellen.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="m-0 bg-stone-100 p-0 font-sans text-stone-900 antialiased">
        <DashboardLayoutWrapper>
          {children}
        </DashboardLayoutWrapper>
      </body>
    </html>
  );
}
