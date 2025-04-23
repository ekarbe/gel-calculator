import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Gel Calculator',
  description: 'Calculate your energy gel mixture',
  icons: [
    {
      rel: 'icon',
      url: '/gel-calculator/favicon.svg',
      type: 'image/svg+xml',
      media: '(prefers-color-scheme: light)'
    },
    {
      rel: 'icon',
      url: '/gel-calculator/favicon.svg',
      type: 'image/svg+xml',
      media: '(prefers-color-scheme: dark)'
    }
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Gel Calculator",
              "description": "Calculate the perfect energy gel mixture for your endurance activities.",
              "url": "https://eikekarbe.com/gel-calculator",
            }),
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}