import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "BJJ Strength Routine | Lazy Lifts",
  description: "Two strength sessions a week, built for grapplers.",
}

export default function BjjLayout({ children }: { children: React.ReactNode }) {
  return children
}
