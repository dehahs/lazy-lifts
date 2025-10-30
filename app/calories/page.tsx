"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { saveMeal, subscribeToMeals, deleteMeal, MealEntry as FirestoreMealEntry } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { UserNav } from "@/components/user-nav"
import { StickyActionButton } from "@/components/ui/sticky-action-button"
import Link from "next/link"
import { Pencil, Trash2, X, Check } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format, isSameDay, startOfDay } from "date-fns"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useWhisper } from "@/hooks/use-whisper"
import { Progress } from "@/components/ui/progress"

interface FoodEntry {
  id: string
  timestamp: Date
  description: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface DailyTotal {
  date: Date
  entries: FoodEntry[]
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
}

interface YearGroup {
  year: number;
  dailyTotals: DailyTotal[];
}

function groupEntriesByDay(entries: FoodEntry[]): YearGroup[] {
  // First group by year
  const groupedByYear = entries.reduce((yearAcc: { [year: number]: FoodEntry[] }, entry) => {
    const year = entry.timestamp.getFullYear();
    if (!yearAcc[year]) {
      yearAcc[year] = [];
    }
    yearAcc[year].push(entry);
    return yearAcc;
  }, {});

  // Then for each year, group by day
  return Object.entries(groupedByYear)
    .map(([year, yearEntries]) => {
      const groupedEntries = yearEntries.reduce((acc: { [key: string]: FoodEntry[] }, entry) => {
        const dateKey = startOfDay(entry.timestamp).toISOString();
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        acc[dateKey].push(entry);
        return acc;
      }, {});

      const dailyTotals = Object.entries(groupedEntries)
        .map(([dateStr, entries]) => {
      // First sum all values
      const rawTotals = entries.reduce(
        (sum, entry) => ({
          calories: sum.calories + entry.calories,
          protein: sum.protein + entry.protein,
          carbs: sum.carbs + entry.carbs,
          fat: sum.fat + entry.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      
      // Then round the final totals
      const totals = {
        calories: Number(rawTotals.calories.toFixed(1)),
        protein: Number(rawTotals.protein.toFixed(1)),
        carbs: Number(rawTotals.carbs.toFixed(1)),
        fat: Number(rawTotals.fat.toFixed(1))
      };

          return {
            date: new Date(dateStr),
            entries: entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
            totalCalories: Number(totals.calories.toFixed(1)),
            totalProtein: Number(totals.protein.toFixed(1)),
            totalCarbs: Number(totals.carbs.toFixed(1)),
            totalFat: Number(totals.fat.toFixed(1)),
          };
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      return {
        year: parseInt(year),
        dailyTotals
      };
    })
    .sort((a, b) => b.year - a.year);
}

export default function CaloriesPage() {
  const { user } = useAuth()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null)

  const {
    isRecording,
    isTranscribing,
    isModelLoading,
    modelLoadProgress,
    transcript,
    error: whisperError,
    startRecording,
    stopRecording
  } = useWhisper({
    onTranscriptionComplete: (text, mealId) => {
      analyzeFood(text, mealId || null)
      setEditingMealId(null)
    },
    onError: (err) => {
      setError(err.message)
    }
  })

  const handleDeleteMeal = async (mealId: string) => {
    if (!user) return;
    try {
      await deleteMeal(user.uid, mealId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meal');
    } finally {
      setDeletingMealId(null);
    }
  }

  // Subscribe to meals from Firestore
  useEffect(() => {
    if (!user) return

    const unsubscribe = subscribeToMeals(user.uid, (meals) => {
      setFoodEntries(meals.map(meal => ({
        id: meal.id,
        timestamp: meal.timestamp,
        description: meal.description,
        calories: Number(meal.calories.toFixed(1)),
        protein: Number(meal.protein.toFixed(1)),
        carbs: Number(meal.carbs.toFixed(1)),
        fat: Number(meal.fat.toFixed(1))
      })))
    })

    return () => unsubscribe()
  }, [user])

  const handleStartRecording = (mealId?: string) => {
    setEditingMealId(mealId || null)
    startRecording(mealId)
  }

  const analyzeFood = async (description: string, mealId: string | null = null) => {
    if (!user) {
      setError('Please sign in to log meals');
      return;
    }

    try {
      setIsAnalyzing(true)
      setError(null)

      const response = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze food');
      }

      const data = await response.json();

      // If editing, find the original entry to preserve its timestamp
      const originalEntry = mealId
        ? foodEntries.find(entry => entry.id === mealId)
        : null;

      if (!originalEntry && mealId) {
        throw new Error('Could not find original entry');
      }

      const newEntry: Omit<FirestoreMealEntry, 'ownerUid'> = {
        id: mealId || Date.now().toString(),
        timestamp: originalEntry ? originalEntry.timestamp : new Date(),
        description: description,
        calories: Number(data.calories.toFixed(1)),
        protein: Number(data.protein.toFixed(1)),
        carbs: Number(data.carbs.toFixed(1)),
        fat: Number(data.fat.toFixed(1)),
      };

      await saveMeal(user.uid, newEntry);
      setEditingMealId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze food');
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <>
      <div className="container mx-auto py-8 px-4 max-w-3xl pb-32">
        <div className="flex justify-between items-start mb-8">
          <div>
            <Link href="/calories" className="hover:opacity-80 transition-opacity">
              <h1 className="text-5xl font-medium tracking-wide">Lazy Lifts</h1>
            </Link>
          </div>
          <UserNav />
        </div>

        <div className="mt-8 space-y-6">
          {/* Model loading progress */}
          {isModelLoading && (
            <div className="p-4 rounded-lg border bg-card text-card-foreground">
              <p className="text-sm text-muted-foreground mb-2">
                Loading speech model... (one-time download, ~74MB)
              </p>
              <Progress value={modelLoadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {modelLoadProgress}%
              </p>
            </div>
          )}

          {/* Transcription and analysis status */}
          {(transcript || isAnalyzing || isTranscribing) && !isModelLoading && (
            <div className="p-4 rounded-lg border bg-card text-card-foreground">
              {isTranscribing && (
                <p className="text-sm text-muted-foreground">Transcribing audio...</p>
              )}
              {transcript && !isTranscribing && <p className="text-lg">{transcript}</p>}
              {isAnalyzing && (
                <p className="text-sm text-muted-foreground mt-2">Analyzing your meal...</p>
              )}
              {(error || whisperError) && (
                <p className="text-sm text-red-500 mt-2">{error || whisperError}</p>
              )}
            </div>
          )}

        {foodEntries.length > 0 && (
          <div className="space-y-6">
            {groupEntriesByDay(foodEntries).map((yearGroup) => (
              <div key={yearGroup.year}>
                <h3 className="text-xl font-medium text-muted-foreground mb-4">{yearGroup.year}</h3>
                <Accordion 
                  type="multiple" 
                  className="w-full"
                  defaultValue={[startOfDay(new Date()).toISOString()]}
                >
                  {yearGroup.dailyTotals.map((dailyTotal) => (
                    <AccordionItem key={dailyTotal.date.toISOString()} value={dailyTotal.date.toISOString()}>
                <AccordionTrigger className="px-4">
                  <div className="flex w-full items-center gap-6">
                    <span className="font-medium min-w-[120px]">
                      {format(dailyTotal.date, 'EEE, MMM d')}
                    </span>
                    <span className="text-sm">{Number(dailyTotal.totalProtein.toFixed(1))}g protein</span>
                    <span className="text-sm">{Number(dailyTotal.totalCarbs.toFixed(1))}g carbs</span>
                    <span className="text-sm">{Number(dailyTotal.totalFat.toFixed(1))}g fat</span>
                    <span className="text-sm font-semibold">{Number(dailyTotal.totalCalories.toFixed(1))} cal</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead></TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead className="w-full">Description</TableHead>
                          <TableHead className="text-right">Protein</TableHead>
                          <TableHead className="text-right">Carbs</TableHead>
                          <TableHead className="text-right">Fat</TableHead>
                          <TableHead className="text-right font-semibold">Calories</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyTotal.entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleStartRecording(entry.id);
                                  }}
                                  disabled={isRecording || isTranscribing || isAnalyzing || isModelLoading || deletingMealId === entry.id}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {deletingMealId === entry.id ? (
                                  <div className="flex flex-col gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-8 text-green-600 hover:text-green-700"
                                      onClick={() => handleDeleteMeal(entry.id)}
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-4 w-8 text-muted-foreground"
                                      onClick={() => setDeletingMealId(null)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive/90"
                                    onClick={() => setDeletingMealId(entry.id)}
                                    disabled={isRecording || isTranscribing || isAnalyzing}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{format(entry.timestamp, 'HH:mm')}</TableCell>
                            <TableCell className="w-full">
                              {editingMealId === entry.id && isRecording ? (
                                <span className="text-muted-foreground italic">Recording...</span>
                              ) : editingMealId === entry.id && isTranscribing ? (
                                <span className="text-muted-foreground italic">Transcribing...</span>
                              ) : editingMealId === entry.id && isAnalyzing ? (
                                <span className="text-muted-foreground italic">Analyzing...</span>
                              ) : (
                                entry.description
                              )}
                            </TableCell>
                            <TableCell className="text-right">{Number(entry.protein.toFixed(1))}g</TableCell>
                            <TableCell className="text-right">{Number(entry.carbs.toFixed(1))}g</TableCell>
                            <TableCell className="text-right">{Number(entry.fat.toFixed(1))}g</TableCell>
                            <TableCell className="text-right font-semibold">{Number(entry.calories.toFixed(1))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
                  </Accordion>
              </div>
            ))}
          </div>
        )}

        {/* Notes and debug info hidden
        <div className="text-sm text-muted-foreground text-center">
          <p>Note: Speech recognition requires an internet connection as it uses Google's speech services.</p>
          {process.env.NODE_ENV === 'development' && (
            <p className="mt-2">
              Running in development mode - make sure you have a stable internet connection and your 
              development environment isn't blocking external requests.
            </p>
          )}
        </div>

        <div className="mt-4 p-4 bg-slate-100 rounded-lg text-left">
          <div className="flex justify-between items-center mb-2">
            <p className="font-medium">Debug Information:</p>
            <Button 
              onClick={() => setDebugInfo([])} 
              variant="outline" 
              size="sm"
            >
              Clear
            </Button>
          </div>
          {debugInfo.map((info, index) => (
            <p key={index} className="text-xs font-mono whitespace-pre-wrap">{info}</p>
          ))}
        </div>
        */}
      </div>
      </div>

      <StickyActionButton
        onClick={() => isRecording ? stopRecording() : handleStartRecording()}
        variant={isRecording ? "destructive" : "default"}
        disabled={isModelLoading || isTranscribing || isAnalyzing}
      >
        {isModelLoading
          ? `Loading model... ${modelLoadProgress}%`
          : isRecording
          ? "Stop Recording"
          : isTranscribing
          ? "Transcribing..."
          : isAnalyzing
          ? "Analyzing..."
          : "What did you eat?"}
      </StickyActionButton>
    </>
  )
}