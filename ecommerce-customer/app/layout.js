export const metadata = {
  title: 'E-Commerce Customer Storefront',
  description: 'Customer application frontend',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
