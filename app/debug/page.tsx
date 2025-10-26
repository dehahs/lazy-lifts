"use client"

import { useAuth } from "@/contexts/auth-context"
import { useState, useEffect } from "react"
import { collection, query, getDocs, orderBy } from "firebase/firestore"
import { db, safeGetDocs } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DebugPage() {
  const { user } = useAuth()
  const [cycleData, setCycleData] = useState<any>(null)
  const [workoutData, setWorkoutData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        // Fetch cycles data
        const cyclesRef = collection(db, "workouts", user.uid, "cycles")
        const cyclesSnapshot = await getDocs(cyclesRef)
        const cycles = cyclesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))

        // Fetch completed workouts
        const workoutsRef = collection(db, "workouts", user.uid, "completed")
        const workoutsSnapshot = await getDocs(workoutsRef)
        const workouts = workoutsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))

        setCycleData(cycles)
        setWorkoutData(workouts)
        setLoading(false)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError("Error fetching data. Check console for details.")
        setLoading(false)
      }
    }

    fetchData()
  }, [user])

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Debug Page</CardTitle>
            <CardDescription>Please sign in to view your data</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Your Firebase Data Structure</CardTitle>
          <CardDescription>User ID: {user.uid}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Cycles:</h3>
            <pre className="bg-gray-100 p-4 rounded-md overflow-auto">
              {JSON.stringify(cycleData, null, 2)}
            </pre>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Completed Workouts:</h3>
            <pre className="bg-gray-100 p-4 rounded-md overflow-auto">
              {JSON.stringify(workoutData, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
