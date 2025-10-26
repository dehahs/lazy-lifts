"use client"

import { useAuth } from "@/contexts/auth-context"
import { useState } from "react"
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function CleanupPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const cleanupOldRecords = async () => {
    if (!user) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Get all completed workouts
      const workoutsRef = collection(db, "workouts", user.uid, "completed")
      const workoutsSnapshot = await getDocs(workoutsRef)
      
      // Find records without cycle number
      const oldRecords = workoutsSnapshot.docs.filter(doc => {
        const data = doc.data()
        return !data.cycle && doc.id.startsWith('Week')
      })

      if (oldRecords.length === 0) {
        setResult("No old records found that need cleanup.")
        return
      }

      // Delete old records
      for (const record of oldRecords) {
        await deleteDoc(doc(db, "workouts", user.uid, "completed", record.id))
      }

      setResult(`Successfully cleaned up ${oldRecords.length} old workout records.`)

    } catch (err) {
      console.error("Error cleaning up records:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Cleanup</CardTitle>
            <CardDescription>Please sign in to clean up old records</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Clean Up Old Records</CardTitle>
          <CardDescription>
            This will remove old workout records that don't have cycle numbers.
            Your current cycle data will not be affected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={cleanupOldRecords} 
            disabled={loading}
            className="w-full"
          >
            {loading ? "Cleaning Up..." : "Clean Up Old Records"}
          </Button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-md">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4 p-4 bg-green-50 text-green-600 rounded-md">
              {result}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
