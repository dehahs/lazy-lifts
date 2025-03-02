"use client"

import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState, useEffect } from "react"
import { collection, query, where, getDocs, deleteDoc, doc, orderBy, limit } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function ProfilePage() {
  const { user, signInWithGoogle } = useAuth()
  const [isResetting, setIsResetting] = useState(false)
  const [currentCycle, setCurrentCycle] = useState(1)
  const router = useRouter()

  // Load current cycle number
  useEffect(() => {
    const loadCurrentCycle = async () => {
      if (!user) return

      try {
        const cyclesRef = collection(db, "workouts", user.uid, "cycles")
        const cyclesSnapshot = await getDocs(query(cyclesRef, orderBy("cycleNumber", "desc"), limit(1)))
        
        if (!cyclesSnapshot.empty) {
          setCurrentCycle(cyclesSnapshot.docs[0].data().cycleNumber)
        }
      } catch (error) {
        console.error("Error loading current cycle:", error)
      }
    }

    loadCurrentCycle()
  }, [user])

  const handleResetCycle = async () => {
    if (!user || !confirm("Are you sure you want to reset your current cycle? This will clear all progress in the current cycle but keep historical data.")) return

    setIsResetting(true)
    try {
      // Get all workouts from current cycle
      const workoutsRef = collection(db, "workouts", user.uid, "completed")
      const currentCycleQuery = query(workoutsRef, where("cycle", "==", currentCycle))
      const workoutsSnapshot = await getDocs(currentCycleQuery)

      // Delete all workouts from current cycle
      const deletePromises = workoutsSnapshot.docs.map(doc => deleteDoc(doc.ref))
      await Promise.all(deletePromises)

      // Refresh the page to reset the state
      router.refresh()
    } catch (error) {
      console.error("Error resetting cycle:", error)
      alert("Failed to reset cycle. Please try again.")
    } finally {
      setIsResetting(false)
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>Please sign in to view your profile</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => signInWithGoogle()} className="w-full">
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-md">
      <div className="mb-6">
        <Link href="/">
          <Button variant="ghost" className="pl-0 flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Workouts
          </Button>
        </Link>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User avatar"} />
              <AvatarFallback>{user.displayName?.[0] || "U"}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{user.displayName || "Anonymous User"}</CardTitle>
              <CardDescription>{user.email || "No email provided"}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Account Type</h3>
              <p className="text-sm text-muted-foreground">
                {user.isAnonymous ? "Anonymous Account" : "Google Account"}
              </p>
            </div>
            {user.isAnonymous && (
              <div>
                <Button onClick={() => signInWithGoogle()} variant="outline" className="w-full">
                  Upgrade to Google Account
                </Button>
              </div>
            )}
            <div className="pt-4 border-t">
              <h3 className="font-medium mb-2">Workout Progress</h3>
              <p className="text-sm mb-4">Current Cycle: {currentCycle}</p>
              <Button 
                onClick={handleResetCycle} 
                variant="destructive" 
                className="w-full"
                disabled={isResetting}
              >
                {isResetting ? "Resetting..." : "Reset Current Cycle"}
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                This will clear all progress in your current cycle but keep historical data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

