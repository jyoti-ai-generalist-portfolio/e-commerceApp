import "./globals.css";

export const metadata = {
  title: "Store Admin",
  description: "Admin portal for the store: dashboard, orders, catalog, and customers.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
