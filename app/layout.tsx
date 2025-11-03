import type { Metadata } from 'next'
import './globals.css'
import SessionProvider from '@/components/SessionProvider'

export const metadata: Metadata = {
  title: 'Meeting Copilot',
  description: 'AI-powered meeting transcription and analysis',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
