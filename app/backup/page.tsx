"use client"

import { useAuth } from "@/contexts/auth-context"
import { useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function BackupPage() {
  const { user } = useAuth()
  const [backupData, setBackupData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createBackup = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const backup = {
        cycles: [],
        workouts: [],
        timestamp: new Date().toISOString(),
        userId: user.uid
      }

      // Backup cycles
      const cyclesRef = collection(db, "workouts", user.uid, "cycles")
      const cyclesSnapshot = await getDocs(cyclesRef)
      backup.cycles = cyclesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      // Backup completed workouts
      const workoutsRef = collection(db, "workouts", user.uid, "completed")
      const workoutsSnapshot = await getDocs(workoutsRef)
      backup.workouts = workoutsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      setBackupData(backup)

      // Create download link
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `firebase-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

    } catch (err) {
      console.error("Error creating backup:", err)
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
            <CardTitle>Backup</CardTitle>
            <CardDescription>Please sign in to create a backup</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Backup Your Data</CardTitle>
          <CardDescription>Create a backup of your workout data</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={createBackup} 
            disabled={loading}
            className="w-full"
          >
            {loading ? "Creating Backup..." : "Create Backup"}
          </Button>

          {error && (
            <div className="mt-4 p-4 bg-[#FEF3ED] text-[#F15A1B] rounded-md">
              {error}
            </div>
          )}

          {backupData && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-2">Backup Preview:</h3>
              <div className="bg-gray-50 p-4 rounded-md overflow-auto max-h-96">
                <pre>{JSON.stringify(backupData, null, 2)}</pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
