import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import { AppProviders } from '../lib/store/AppProviders';
import Header from '../components/Header';
import CartDrawer from '../components/CartDrawer';
import AuthModal from '../components/auth/AuthModal';

// To this:

import { ToastProvider } from '../components/ToastHost';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata = {
  title: 'Northbank & Co. — Shop the catalog',
  description: 'Browse products, add to cart, and check out.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="font-body">
        <AppProviders>
          <Header />
          <ToastProvider>
            {children}
            <CartDrawer />
            <AuthModal />
           
          </ToastProvider>
        </AppProviders>
      </body>
    </html>
  );
}
