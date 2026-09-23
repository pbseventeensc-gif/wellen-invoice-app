import './globals.css';
import DashboardLayoutWrapper from '@/components/DashboardLayoutWrapper';

export const metadata = {
  title: 'Wellen Invoice Generator',
  description: 'Wellen Brothers Accounting and Invoicing Application',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="m-0 p-0 antialiased bg-stone-100 text-stone-900">
        <DashboardLayoutWrapper>
          {children}
        </DashboardLayoutWrapper>
      </body>
    </html>
  );
}