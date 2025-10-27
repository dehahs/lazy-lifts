"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { UserNav } from "@/components/user-nav"
import { useAuth } from "@/contexts/auth-context"
import { db, createUserDocument, safeGetDocs, subscribeToMeals } from "@/lib/firebase"
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore"
import { startOfDay, isSameDay } from "date-fns"
import Link from "next/link"
import { Chart } from "@/components/ui/chart"

type WeightEntry = {
  id: string
  weight: number
  date: Date
}

type CalorieEntry = {
  id: string
  calories: number
  date: Date
}

type MealEntry = {
  id: string
  timestamp: Date
  calories: number
  description: string
  protein: number
  carbs: number
  fat: number
}

type DailyCalories = {
  date: Date
  totalCalories: number
}

export default function StatsPage() {
  const { user } = useAuth()
  const [weight, setWeight] = useState("")
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([])
  const [editingWeightEntry, setEditingWeightEntry] = useState<WeightEntry | null>(null)
  
  const [calories, setCalories] = useState("")
  const [calorieEntries, setCalorieEntries] = useState<CalorieEntry[]>([])
  const [editingCalorieEntry, setEditingCalorieEntry] = useState<CalorieEntry | null>(null)
  const [mealEntries, setMealEntries] = useState<MealEntry[]>([])
  const [dailyCalories, setDailyCalories] = useState<DailyCalories[]>([])

  // Load weight entries
  useEffect(() => {
    if (!user) return
    loadWeightEntries()
    loadCalorieEntries()

    // Subscribe to meals
    const unsubscribe = subscribeToMeals(user.uid, (meals) => {
      setMealEntries(meals.map(meal => ({
        id: meal.id,
        timestamp: meal.timestamp,
        description: meal.description,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat
      })))
    })

    return () => unsubscribe()
  }, [user])

  // Calculate daily calories from meals
  useEffect(() => {
    const dailyTotals = mealEntries.reduce<DailyCalories[]>((acc, meal) => {
      const mealDate = startOfDay(meal.timestamp)
      const existingDay = acc.find(day => isSameDay(day.date, mealDate))

      if (existingDay) {
        existingDay.totalCalories += meal.calories
      } else {
        acc.push({
          date: mealDate,
          totalCalories: meal.calories
        })
      }

      return acc
    }, [])

    setDailyCalories(dailyTotals.sort((a, b) => b.date.getTime() - a.date.getTime()))
  }, [mealEntries])

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

  const handleUpdateWeightEntry = async () => {
    if (!user || !editingWeightEntry) return
    try {
      await updateDoc(doc(db, "weights", user.uid, "entries", editingWeightEntry.id), {
        weight: editingWeightEntry.weight
      })
      setEditingWeightEntry(null)
      loadWeightEntries()
    } catch (error) {
      console.error("Error updating weight entry:", error)
    }
  }

  const loadCalorieEntries = async () => {
    if (!user) return
    try {
      const caloriesRef = collection(db, "calories", user.uid, "entries")
      const q = query(caloriesRef, orderBy("date", "desc"))
      const snapshot = await safeGetDocs(q)
      const entries = snapshot.docs.map(doc => {
        const data = doc.data() as { calories: number; date: { toDate: () => Date } }
        return {
          id: doc.id,
          calories: data.calories,
          date: data.date.toDate()
        }
      })
      setCalorieEntries(entries)
    } catch (error) {
      console.error("Error loading calorie entries:", error)
    }
  }

  const handleAddCalories = async () => {
    if (!user || !calories) return
    try {
      const calorieId = `calorie-${Date.now()}`
      await createUserDocument(
        user.uid,
        "calories",
        "entries",
        calorieId,
        {
          calories: parseFloat(calories),
          date: new Date()
        }
      )
      setCalories("")
      loadCalorieEntries()
    } catch (error) {
      console.error("Error adding calorie entry:", error)
    }
  }

  const handleDeleteCalorieEntry = async (entryId: string) => {
    if (!user) return
    try {
      await deleteDoc(doc(db, "calories", user.uid, "entries", entryId))
      loadCalorieEntries()
    } catch (error) {
      console.error("Error deleting calorie entry:", error)
    }
  }

  const handleUpdateCalorieEntry = async () => {
    if (!user || !editingCalorieEntry) return
    try {
      await updateDoc(doc(db, "calories", user.uid, "entries", editingCalorieEntry.id), {
        calories: editingCalorieEntry.calories
      })
      setEditingCalorieEntry(null)
      loadCalorieEntries()
    } catch (error) {
      console.error("Error updating calorie entry:", error)
    }
  }

  const chartData = {
    labels: [...weightEntries].reverse().map(entry => 
      entry.date.toLocaleDateString()
    ),
    datasets: [
      {
        label: 'Weight',
        data: [...weightEntries].reverse().map(entry => Number(entry.weight.toFixed(1))),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        yAxisID: 'y'
      },
      {
        label: 'Target Calories',
        data: [...calorieEntries].reverse().map(entry => Number(entry.calories.toFixed(1))),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1,
        yAxisID: 'y1'
      },
      {
        label: 'Actual Calories',
        data: [...weightEntries].reverse().map(entry => {
          const matchingDay = dailyCalories.find(dc => 
            isSameDay(dc.date, entry.date)
          )
          return matchingDay ? Number(matchingDay.totalCalories.toFixed(1)) : null
        }),
        borderColor: 'rgb(255, 159, 64)',
        tension: 0.1,
        yAxisID: 'y1',
        borderDash: [5, 5]
      }
    ]
  }

  const chartOptions = {
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Weight (lbs)'
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Daily Calories'
        },
        grid: {
          drawOnChartArea: false
        }
      }
    }
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
            <h2 className="text-2xl font-semibold mb-4">Track Your Stats</h2>
            <div className="flex gap-4 flex-wrap">
              <div className="flex gap-4">
                <Input
                  type="number"
                  placeholder="Enter weight"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="max-w-[200px]"
                />
                <Button onClick={handleAddWeight}>Add Weight</Button>
              </div>
              <div className="flex gap-4">
                <Input
                  type="number"
                  placeholder="Enter target calories"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="max-w-[200px]"
                />
                <Button onClick={handleAddCalories}>Add Calories</Button>
              </div>
            </div>
          </Card>

          {weightEntries.length > 0 && (
            <>

              <Card className="p-6 mb-8">
                <h2 className="text-2xl font-semibold mb-4">Weight and Calorie Trends</h2>
                <Chart type="line" data={chartData} options={chartOptions} />
              </Card>

              <Card className="p-6 mb-8">
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
                          {editingWeightEntry?.id === entry.id ? (
                            <Input
                              type="number"
                              value={editingWeightEntry.weight}
                              onChange={(e) => setEditingWeightEntry({
                                ...editingWeightEntry,
                                weight: parseFloat(e.target.value)
                              })}
                              className="max-w-[100px]"
                            />
                          ) : (
                            Number(entry.weight.toFixed(1))
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingWeightEntry?.id === entry.id ? (
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingWeightEntry(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleUpdateWeightEntry}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingWeightEntry(entry)}
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

              <Card className="p-6">
                <h2 className="text-2xl font-semibold mb-4">Calorie History</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Calories</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calorieEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date.toLocaleString()}</TableCell>
                        <TableCell>
                          {editingCalorieEntry?.id === entry.id ? (
                            <Input
                              type="number"
                              value={editingCalorieEntry.calories}
                              onChange={(e) => setEditingCalorieEntry({
                                ...editingCalorieEntry,
                                calories: parseFloat(e.target.value)
                              })}
                              className="max-w-[100px]"
                            />
                          ) : (
                            Number(entry.calories.toFixed(1))
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingCalorieEntry?.id === entry.id ? (
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingCalorieEntry(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleUpdateCalorieEntry}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingCalorieEntry(entry)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteCalorieEntry(entry.id)}
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
