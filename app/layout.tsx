import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FriendList - Shared Activities Dashboard',
  description: 'A collaborative list for friends to share activities, food spots, and more',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
