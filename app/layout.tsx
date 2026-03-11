import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mun-echharikkAI',
  description: 'Voice-first AI agriculture assistant for smart farming',
  icons: {
    icon: '/images/farmer-mascot.png',
    apple: '/images/farmer-mascot.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ta">
      <head>
        <meta charSet="utf-8" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
