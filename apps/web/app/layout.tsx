import type { Metadata } from 'next';
import '@logicommerce/ui/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'LogiCommerce', template: '%s · LogiCommerce' },
  description: 'Multi-tenant commerce and logistics orchestration.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
