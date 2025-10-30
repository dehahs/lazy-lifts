import type React from "react"
import "./globals.css"
import type { Metadata, Viewport } from "next"
import { Fira_Sans_Condensed } from "next/font/google"
import { AuthProvider } from "@/contexts/auth-context"

const firaSansCondensed = Fira_Sans_Condensed({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"]
})

export const viewport: Viewport = {
  themeColor: '#0f172a',
}

export const metadata: Metadata = {
  title: "Lazy Lifts",
  description: "Track your workout progress",
  generator: 'v0.dev',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Lazy Lifts'
  }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="application-name" content="Lazy Lifts" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Lazy Lifts" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/lazylifts-logo.png" />
        <link rel="icon" type="image/png" href="/lazylifts-logo.png" />
      </head>
      <body className={firaSansCondensed.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}