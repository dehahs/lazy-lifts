"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { UserNav } from "@/components/user-nav"
import { useAuth } from "@/contexts/auth-context"
import { db, createUserDocument, safeGetDocs } from "@/lib/firebase"
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore"
import Link from "next/link"
import { Chart } from "@/components/ui/chart"

type WeightEntry = {
  id: string
  weight: number
  date: Date
}

export default function StatsPage() {
  const { user } = useAuth()
  const [weight, setWeight] = useState("")
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([])
  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null)

  // Load weight entries
  useEffect(() => {
    if (!user) return
    loadWeightEntries()
  }, [user])

  const loadWeightEntries = async () => {
    if (!user) return
    try {
      const weightsRef = collection(db, "weights", user.uid, "entries")
      const q = query(weightsRef, orderBy("date", "desc"))
      const snapshot = await safeGetDocs(q)
      const entries = snapshot.docs.map(doc => {
        const data = doc.data() as { weight: number; date: { toDate: () => Date } }
        return {
          id: doc.id,
          weight: data.weight,
          date: data.date.toDate()
        }
      })
      setWeightEntries(entries)
    } catch (error) {
      console.error("Error loading weight entries:", error)
    }
  }

  const handleAddWeight = async () => {
    if (!user || !weight) return
    try {
      const weightId = `weight-${Date.now()}`
      await createUserDocument(
        user.uid,
        "weights",
        "entries",
        weightId,
        {
          weight: parseFloat(weight),
          date: new Date()
        }
      )
      setWeight("")
      loadWeightEntries()
    } catch (error) {
      console.error("Error adding weight entry:", error)
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return
    try {
      await deleteDoc(doc(db, "weights", user.uid, "entries", entryId))
      loadWeightEntries()
    } catch (error) {
      console.error("Error deleting weight entry:", error)
    }
  }

  const handleUpdateEntry = async () => {
    if (!user || !editingEntry) return
    try {
      await updateDoc(doc(db, "weights", user.uid, "entries", editingEntry.id), {
        weight: editingEntry.weight
      })
      setEditingEntry(null)
      loadWeightEntries()
    } catch (error) {
      console.error("Error updating weight entry:", error)
    }
  }

  const chartData = {
    labels: [...weightEntries].reverse().map(entry => 
      entry.date.toLocaleDateString()
    ),
    datasets: [
      {
        label: 'Weight',
        data: [...weightEntries].reverse().map(entry => entry.weight),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }
    ]
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex justify-between items-start mb-8">
        <div>
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <h1 className="text-5xl font-medium tracking-wide">Lazy Lifts</h1>
          </Link>
        </div>
        <UserNav />
      </div>

      {user ? (
        <>
          <Card className="p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Track Your Weight</h2>
            <div className="flex gap-4">
              <Input
                type="number"
                placeholder="Enter weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="max-w-[200px]"
              />
              <Button onClick={handleAddWeight}>Add Entry</Button>
            </div>
          </Card>

          {weightEntries.length > 0 && (
            <>
              <Card className="p-6 mb-8">
                <h2 className="text-2xl font-semibold mb-4">Weight Trend</h2>
                <Chart type="line" data={chartData} />
              </Card>

              <Card className="p-6">
                <h2 className="text-2xl font-semibold mb-4">Weight History</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Weight</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weightEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date.toLocaleString()}</TableCell>
                        <TableCell>
                          {editingEntry?.id === entry.id ? (
                            <Input
                              type="number"
                              value={editingEntry.weight}
                              onChange={(e) => setEditingEntry({
                                ...editingEntry,
                                weight: parseFloat(e.target.value)
                              })}
                              className="max-w-[100px]"
                            />
                          ) : (
                            entry.weight
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingEntry?.id === entry.id ? (
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingEntry(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleUpdateEntry}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingEntry(entry)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteEntry(entry.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </>
      ) : (
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Sign In Required</h2>
          <p>Please sign in to track your weight progress.</p>
        </Card>
      )}
    </div>
  )
}
