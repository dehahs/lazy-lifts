"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserNav } from "@/components/user-nav"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <Image 
              src="/lazylifts-logo.png" 
              alt="Lazy Lifts" 
              width={200} 
              height={84}
              className="h-auto max-h-[84px]"
              priority
            />
          </Link>
        </div>
        <UserNav />
      </div>

      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" className="pl-0 flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Workouts
          </Button>
        </Link>
      </div>

      <Card className="rounded-none border-0 shadow-none">
        <CardHeader>
          <CardTitle>About Lazy Lifts</CardTitle>
          <CardDescription>A simple workout tracking app for lazy lifters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <h3 className="text-lg font-semibold">What is Lazy Lifts?</h3>
          <p>
            Lazy Lifts is a minimalist workout tracking application designed for people who want to maintain a consistent 
            lifting routine without the complexity of most fitness apps. It follows a simple 4-day split program that 
            focuses on progressive overload and consistency.
          </p>

          <h3 className="text-lg font-semibold">How It Works</h3>
          <p>
            The app organizes workouts into cycles, with each cycle containing 4 workout days per week:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Monday:</strong> Upper body push exercises (chest, shoulders, triceps)</li>
            <li><strong>Tuesday:</strong> Lower body exercises (quads, hamstrings, calves)</li>
            <li><strong>Thursday:</strong> Upper body pull exercises (back, biceps)</li>
            <li><strong>Friday:</strong> Full body workout with compound movements</li>
          </ul>

          <h3 className="text-lg font-semibold">Features</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Track workout progress across multiple cycles</li>
            <li>Anonymous workout tracking with local storage</li>
            <li>User authentication with Google</li>
            <li>Ability to undo recent workout completions</li>
            <li>Mobile-friendly UI with PWA support for installation on your device</li>
            <li>Simple, distraction-free interface</li>
          </ul>

          <h3 className="text-lg font-semibold">Why "Lazy" Lifts?</h3>
          <p>
            The name "Lazy Lifts" reflects our philosophy that fitness doesn't have to be complicated. 
            You don't need to spend hours planning workouts or tracking every detail of your fitness journey. 
            With Lazy Lifts, you can focus on what matters most: showing up consistently and putting in the work.
          </p>

          <h3 className="text-lg font-semibold">Getting Started</h3>
          <p>
            To get started, simply navigate to the main page and begin tracking your workouts. You can use the app 
            without signing in, but creating an account allows you to sync your progress across devices and ensures 
            your data is backed up.
          </p>
        </CardContent>
      </Card>
    </div>
  )
} 