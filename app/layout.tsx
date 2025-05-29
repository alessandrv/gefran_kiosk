import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GEGRAN Network utility',
  description: 'Created by FEC Italia',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
