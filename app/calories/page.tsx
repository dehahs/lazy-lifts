"use client"

import { useState, useEffect, useRef, Fragment } from "react"
import { useAuth } from "@/contexts/auth-context"
import { saveMeal, subscribeToMeals, MealEntry as FirestoreMealEntry, db, safeGetDocs } from "@/lib/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { UserNav } from "@/components/user-nav"
import Link from "next/link"
import Image from "next/image"
import { PencilSimple, CaretRight, CaretDown, Camera, X, Microphone as MicrophoneIcon } from "phosphor-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { format, isSameDay, startOfDay } from "date-fns"
import { useWhisper } from "@/hooks/use-whisper"
import { Progress } from "@/components/ui/progress"
import { Microphone, Stop } from "phosphor-react"
import { Input } from "@/components/ui/input"
import { Toaster } from "@/components/ui/toaster"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { deleteMeal } from "@/lib/firebase"

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
  const [displayTranscript, setDisplayTranscript] = useState<string>("")
  const [customMessage, setCustomMessage] = useState<string>("")
  const [calorieTarget, setCalorieTarget] = useState<number>(2000) // Default to 2000
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set([startOfDay(new Date()).toISOString()]))
  const [activeDate, setActiveDate] = useState<Date>(startOfDay(new Date()))
  const [textInput, setTextInput] = useState<string>("")
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const customMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null)
  const [editDescription, setEditDescription] = useState<string>("")
  const [editTimestamp, setEditTimestamp] = useState<Date>(new Date())
  const [editTime, setEditTime] = useState<string>("")
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isCountingCalories, setIsCountingCalories] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const analyzeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const {
    isRecording,
    isTranscribing,
    isModelLoading,
    modelLoadProgress,
    transcript,
    error: whisperError,
    volume,
    startRecording,
    stopRecording
  } = useWhisper({
    onTranscriptionComplete: (text, mealId) => {
      setDisplayTranscript(text)
      analyzeFood(text, mealId || null)
      setEditingMealId(null)

      // Clear any existing timeout
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current)
      }

      // Fade out after 4 seconds
      fadeTimeoutRef.current = setTimeout(() => {
        setDisplayTranscript("")
      }, 4000)
    },
    onError: (err) => {
      setError(err.message)
    }
  })


  // Load calorie target from stats
  useEffect(() => {
    if (!user) return

    const loadCalorieTarget = async () => {
      try {
        const caloriesRef = collection(db, "calories", user.uid, "entries")
        const q = query(caloriesRef, orderBy("date", "desc"))
        const snapshot = await safeGetDocs(q)
        
        if (!snapshot.empty && snapshot.docs.length > 0) {
          const latestEntry = snapshot.docs[0].data() as { calories?: number }
          setCalorieTarget(latestEntry.calories || 2000)
        } else {
          setCalorieTarget(2000) // Default to 2000 if no entries
        }
      } catch (error) {
        console.error("Error loading calorie target:", error)
        setCalorieTarget(2000) // Default to 2000 on error
      }
    }

    loadCalorieTarget()
  }, [user])

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

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current)
      }
      if (customMessageTimeoutRef.current) {
        clearTimeout(customMessageTimeoutRef.current)
      }
      if (analyzeTimeoutRef.current) {
        clearTimeout(analyzeTimeoutRef.current)
      }
    }
  }, [])

  const handleStartRecording = (mealId?: string) => {
    setEditingMealId(mealId || null)
    startRecording(mealId)
  }

  const handleEditEntry = (entry: FoodEntry) => {
    setEditingEntry(entry)
    setEditDescription(entry.description)
    setEditTimestamp(new Date(entry.timestamp))
    const timeStr = format(entry.timestamp, 'HH:mm')
    setEditTime(timeStr)
  }

  const handleCloseEditSheet = () => {
    setEditingEntry(null)
    setEditDescription("")
    setEditTimestamp(new Date())
    setEditTime("")
    setIsCountingCalories(false)
    setDatePickerOpen(false)
    if (analyzeTimeoutRef.current) {
      clearTimeout(analyzeTimeoutRef.current)
    }
  }

  const handleTimeChange = (timeStr: string) => {
    setEditTime(timeStr)
    const [hours, minutes] = timeStr.split(':').map(Number)
    const newTimestamp = new Date(editTimestamp)
    newTimestamp.setHours(hours || 0, minutes || 0, 0, 0)
    setEditTimestamp(newTimestamp)
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return
    const newTimestamp = new Date(date)
    // Preserve the time from editTimestamp
    newTimestamp.setHours(editTimestamp.getHours(), editTimestamp.getMinutes(), 0, 0)
    setEditTimestamp(newTimestamp)
  }

  const handleDescriptionChange = (value: string) => {
    setEditDescription(value)
    
    // Clear existing timeout
    if (analyzeTimeoutRef.current) {
      clearTimeout(analyzeTimeoutRef.current)
    }

    // Show "counting calories" status
    setIsCountingCalories(true)

    // Debounce the calorie counting
    analyzeTimeoutRef.current = setTimeout(async () => {
      if (value.trim() && editingEntry) {
        try {
          setIsCountingCalories(true)
          const response = await fetch('/api/analyze-food', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ description: value.trim() }),
          })

          if (response.ok) {
            const data = await response.json()
            // Update the editing entry with new nutrition values
            setEditingEntry({
              ...editingEntry,
              description: value.trim(),
              calories: Number(data.calories.toFixed(1)),
              protein: Number(data.protein.toFixed(1)),
              carbs: Number(data.carbs.toFixed(1)),
              fat: Number(data.fat.toFixed(1)),
            })
          }
        } catch (err) {
          console.error('Error analyzing food:', err)
        } finally {
          setIsCountingCalories(false)
        }
      } else {
        setIsCountingCalories(false)
      }
    }, 2000) // Wait 2 seconds after user stops typing
  }

  const handleSaveEntry = async () => {
    if (!user || !editingEntry) return

    try {
      setIsSaving(true)
      
      // Update the entry with current values
      const updatedEntry: Omit<FirestoreMealEntry, 'ownerUid'> = {
        id: editingEntry.id,
        timestamp: editTimestamp,
        description: editDescription.trim(),
        calories: editingEntry.calories,
        protein: editingEntry.protein,
        carbs: editingEntry.carbs,
        fat: editingEntry.fat,
      }

      await saveMeal(user.uid, updatedEntry)
      handleCloseEditSheet()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save entry')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteEntry = async () => {
    if (!user || !editingEntry) return

    try {
      await deleteMeal(user.uid, editingEntry.id)
      handleCloseEditSheet()
      setShowDeleteDialog(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry')
    }
  }

  const handlePhotoClick = () => {
    setCustomMessage("Coming soon")
    
    // Clear any existing timeout
    if (customMessageTimeoutRef.current) {
      clearTimeout(customMessageTimeoutRef.current)
    }
    
    // Clear message after 3 seconds
    customMessageTimeoutRef.current = setTimeout(() => {
      setCustomMessage("")
    }, 3000)
  }

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (textInput.trim()) {
      analyzeFood(textInput.trim())
      setTextInput("")
    }
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

  // Calculate weekly calories for chart - past 7 days with today on the far right
  const getWeeklyCalories = () => {
    const today = new Date()
    const todayStart = startOfDay(today)
    
    // Get the past 7 days (6 days ago through today)
    const weekData = Array.from({ length: 7 }, (_, index) => {
      const daysAgo = 6 - index // 6, 5, 4, 3, 2, 1, 0 (today)
      const date = new Date(todayStart)
      date.setDate(todayStart.getDate() - daysAgo)
      
      const dayStart = startOfDay(date)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)
      
      const dayEntries = foodEntries.filter(entry => {
        const entryDate = entry.timestamp
        return entryDate >= dayStart && entryDate <= dayEnd
      })
      
      const totalCalories = dayEntries.reduce((sum, entry) => sum + entry.calories, 0)
      
      // Get day abbreviation (M, T, W, T, F, S, S)
      const dayAbbr = format(date, 'EEEEE') // Single letter day abbreviation
      
      return {
        day: dayAbbr,
        calories: totalCalories,
        isToday: isSameDay(date, today),
        date: date
      }
    })
    
    return weekData
  }

  const weeklyCalories = getWeeklyCalories()
  const maxCalories = Math.max(...weeklyCalories.map(d => d.calories), calorieTarget)

  return (
    <>
      <Toaster />
      {/* Fade overlay when recording */}
      {isRecording && (
        <div className="fixed inset-0 bg-white/95 z-40 transition-opacity duration-300" />
      )}

      <div className="container mx-auto py-8 px-4 max-w-3xl pb-32">
        <div className="flex justify-between items-start mb-8">
          <div className="flex-shrink-0">
            <Link href="/calories" className="hover:opacity-80 transition-opacity inline-block">
              <Image 
                src="/lazylifts-logo.png" 
                alt="Lazy Lifts" 
                width={200} 
                height={84}
                className="h-auto max-h-[84px] w-auto max-w-[200px]"
                priority
              />
            </Link>
          </div>
          <UserNav />
        </div>

        {/* Model loading progress */}
        {isModelLoading && (
          <div className="mt-8 p-4 rounded-lg border bg-card text-card-foreground">
            <p className="text-sm text-muted-foreground mb-2">
              Loading speech recognition model...
            </p>
            <Progress value={modelLoadProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {modelLoadProgress}%
            </p>
          </div>
        )}

        {/* Listening overlay when recording */}
        {isRecording && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
            <h2 className="text-3xl font-bold mb-12">Listening</h2>
            <div className="relative flex items-center justify-center">
              {/* Animated volume circles */}
              {[1, 2, 3, 4].map((circle) => {
                const circleSize = 264 + circle * 44
                const opacity = Math.max(0.1, volume - (circle - 1) * 0.2)
                const scale = 1 + volume * 0.3 + (circle - 1) * 0.1

                return (
                  <div
                    key={circle}
                    className="absolute rounded-full border-2 border-[#F15A1B] z-40"
                    style={{
                      width: `${circleSize}px`,
                      height: `${circleSize}px`,
                      opacity: opacity,
                      transform: `scale(${scale})`,
                      transition: 'opacity 0.1s ease-out, transform 0.1s ease-out',
                    }}
                  />
                )
              })}

              {/* Stop button */}
              <button
                onClick={stopRecording}
                disabled={isModelLoading || isTranscribing || isAnalyzing}
                className={`
                  relative z-50 rounded-full p-8 bg-[#F15A1B] hover:bg-[#D14815]
                  ${isModelLoading || isTranscribing || isAnalyzing
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                  }
                  transition-all duration-300
                  focus:outline-none focus:ring-4 focus:ring-[#F15A1B]/30
                  ring-4 ring-white
                `}
                style={{
                  width: '264px',
                  height: '264px',
                }}
              >
                <Stop className="w-24 h-24 text-white mx-auto" weight="fill" />
              </button>
            </div>

            {/* Error display */}
            {(error || whisperError) && (
              <div className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm">
                {error || whisperError}
              </div>
            )}
          </div>
        )}

        {/* Processing status display - fixed at bottom of viewport */}
        {(isTranscribing || displayTranscript || isAnalyzing || customMessage || isCountingCalories) && (
          <div
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 px-6 py-4 bg-black text-white rounded-lg text-center max-w-md animate-in fade-in duration-300 z-[60]"
          >
            <p className="text-base">
              {customMessage
                ? customMessage
                : isCountingCalories
                  ? "Counting calories"
                  : isAnalyzing 
                    ? "Counting calories" 
                    : isTranscribing && !displayTranscript 
                      ? "Transcribing..." 
                      : displayTranscript}
            </p>
          </div>
        )}

        {/* Edit Entry Bottom Sheet */}
        <Sheet open={editingEntry !== null} onOpenChange={(open) => !open && handleCloseEditSheet()}>
          <SheetContent side="bottom" className="h-[90vh] max-h-[90vh] overflow-y-auto [&>button]:hidden">
            {editingEntry && (
              <div className="flex flex-col h-full">
                {/* Header */}
                <SheetHeader className="flex flex-row items-center justify-between mb-6">
                  <SheetTitle className="text-2xl font-bold">Edit Entry</SheetTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCloseEditSheet}
                    className="h-8 w-8"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </SheetHeader>

                {/* Date and Time */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2 border-none shadow-none hover:bg-transparent">
                        <span className="text-sm text-muted-foreground">{format(editTimestamp, 'EEE, MMM d')} • {format(editTimestamp, 'HH:mm')}</span>
                        <PencilSimple className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="center">
                      <div className="p-4 space-y-4">
                        <Calendar
                          mode="single"
                          selected={editTimestamp}
                          onSelect={(date) => {
                            handleDateSelect(date)
                            // Don't close popover on date select, let user also change time
                          }}
                          initialFocus
                        />
                        <div className="flex items-center gap-2 pb-2">
                          <label className="text-sm font-medium">Time:</label>
                          <Input
                            type="time"
                            value={editTime}
                            onChange={(e) => {
                              handleTimeChange(e.target.value)
                              // Close popover after time change
                              setTimeout(() => setDatePickerOpen(false), 100)
                            }}
                            className="w-auto"
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Food Description */}
                <div className="mb-6">
                  <Textarea
                    value={editDescription}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    className="min-h-[100px] text-lg text-center text-[#F15A1B] font-medium resize-none"
                    placeholder="What did you eat?"
                  />
                  <div className="flex justify-center gap-4 mt-4">
                    <Button
                      variant="outline"
                      className="rounded-full px-6 py-3 bg-[#F15A1B] text-white border-[#F15A1B] hover:bg-[#D14815]"
                      onClick={() => {
                        setCustomMessage("Coming soon")
                        if (customMessageTimeoutRef.current) {
                          clearTimeout(customMessageTimeoutRef.current)
                        }
                        customMessageTimeoutRef.current = setTimeout(() => {
                          setCustomMessage("")
                        }, 3000)
                      }}
                    >
                      <MicrophoneIcon className="h-5 w-5 mr-2" />
                      Voice
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full px-6 py-3 bg-[#F15A1B] text-white border-[#F15A1B] hover:bg-[#D14815]"
                      onClick={() => {
                        setCustomMessage("Coming soon")
                        if (customMessageTimeoutRef.current) {
                          clearTimeout(customMessageTimeoutRef.current)
                        }
                        customMessageTimeoutRef.current = setTimeout(() => {
                          setCustomMessage("")
                        }, 3000)
                      }}
                    >
                      <Camera className="h-5 w-5 mr-2" />
                      Photo
                    </Button>
                  </div>
                </div>

                {/* Nutritional Information */}
                <div className="flex justify-center gap-8 mb-8">
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-muted-foreground mb-1">
                      {editingEntry.protein.toFixed(1)}g
                    </div>
                    <div className="text-sm text-muted-foreground">Protein</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-muted-foreground mb-1">
                      {editingEntry.carbs.toFixed(1)}g
                    </div>
                    <div className="text-sm text-muted-foreground">Carbs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-muted-foreground mb-1">
                      {editingEntry.fat.toFixed(1)}g
                    </div>
                    <div className="text-sm text-muted-foreground">Fat</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-1">
                      {editingEntry.calories.toFixed(1)}
                    </div>
                    <div className="text-sm text-muted-foreground">Calories</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-auto space-y-4 pb-4">
                  <Button
                    onClick={handleSaveEntry}
                    disabled={isSaving || !editDescription.trim()}
                    className="w-full bg-[#F15A1B] text-white hover:bg-[#D14815] h-12 text-lg font-medium rounded-lg"
                  >
                    {isSaving ? "Saving..." : "Save entry"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setShowDeleteDialog(true)}
                    className="w-full text-[#F15A1B] hover:text-[#D14815] hover:bg-transparent"
                  >
                    Delete Entry
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Entry</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this food entry? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteEntry}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Weekly calorie chart */}
        <div className="mt-16 mb-16">
          <h2 className="text-3xl font-bold mb-8">Your Calories</h2>
          <div className="flex items-end gap-2 h-32 relative">
            {/* Y-axis label and target line */}
            <div className="flex flex-col justify-start h-full pr-4 relative">
              <span className="text-sm text-muted-foreground">{calorieTarget.toLocaleString()} cal</span>
              <div 
                className="absolute left-0 right-0 border-t border-dashed border-gray-400"
                style={{ top: `${100 - (calorieTarget / maxCalories) * 100}%` }}
              />
            </div>
            
            {/* Bars */}
            <div className="flex-1 flex items-end gap-2 h-full relative">
              {/* Target line across all bars */}
              <div 
                className="absolute left-0 right-0 border-t border-dashed border-gray-400"
                style={{ bottom: `${(calorieTarget / maxCalories) * 100}%` }}
              />
              
              {weeklyCalories.map((dayData, index) => {
                const height = maxCalories > 0 ? (dayData.calories / maxCalories) * 100 : 0
                const isActive = isSameDay(dayData.date, activeDate)
                
                return (
                  <div 
                    key={index} 
                    className="flex-1 flex flex-col items-center h-full relative z-10 cursor-pointer transition-all duration-300"
                    onClick={() => {
                      setActiveDate(dayData.date)
                      const dayKey = startOfDay(dayData.date).toISOString()
                      setExpandedDays(new Set([dayKey]))
                    }}
                  >
                    <div className="w-full flex flex-col items-center justify-end h-full">
                      {/* Bar */}
                      <div
                        className={`w-full rounded-t transition-all duration-300 ${
                          isActive
                            ? 'bg-[#F15A1B]'
                            : 'bg-gray-300'
                        }`}
                        style={{
                          height: `${height}%`,
                          minHeight: dayData.calories > 0 ? '4px' : '0',
                        }}
                      />
                    </div>
                    
                    {/* Day label */}
                    <div className={`mt-2 text-xs ${isActive ? 'text-[#F15A1B] font-semibold' : 'text-muted-foreground'}`}>
                      {dayData.day}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">

        {foodEntries.length > 0 && (
          <div className="space-y-6">
            <div className="rounded-lg border overflow-hidden">
              <div className="w-full overflow-x-hidden">
                <Table className="w-full table-auto">
                  <colgroup>
                    <col style={{ width: 'auto', minWidth: '0' }} />
                    <col style={{ width: '65px' }} />
                    <col style={{ width: '65px' }} />
                    <col style={{ width: '65px' }} />
                    <col style={{ width: '75px' }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left px-2 sm:px-3">Date</TableHead>
                      <TableHead className="text-right whitespace-nowrap px-2 sm:px-3">Protein</TableHead>
                      <TableHead className="text-right whitespace-nowrap px-2 sm:px-3">Carbs</TableHead>
                      <TableHead className="text-right whitespace-nowrap px-2 sm:px-3">Fat</TableHead>
                      <TableHead className="text-right whitespace-nowrap px-2 sm:px-3">Calories</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      // Flatten all daily totals from all year groups and sort chronologically
                      const allDailyTotals = groupEntriesByDay(foodEntries)
                        .flatMap(yearGroup => yearGroup.dailyTotals)
                        .sort((a, b) => b.date.getTime() - a.date.getTime())
                      
                      return allDailyTotals.map((dailyTotal, index) => {
                        const dayKey = dailyTotal.date.toISOString()
                        const isExpanded = expandedDays.has(dayKey)
                        const currentYear = dailyTotal.date.getFullYear()
                        
                        // Check if we need a year separator before this row
                        // Show separator when transitioning from one year to another
                        const prevDailyTotal = index > 0 ? allDailyTotals[index - 1] : null
                        const needsYearSeparator = prevDailyTotal && prevDailyTotal.date.getFullYear() !== currentYear
                        
                        return (
                          <Fragment key={dayKey}>
                            {/* Year separator row */}
                            {needsYearSeparator && (
                              <TableRow key={`year-separator-${currentYear}`}>
                                <TableCell colSpan={5} className="px-2 sm:px-3 py-4 bg-gray-800">
                                  <div className="flex items-center justify-center">
                                    <span className="text-xl font-medium text-white" style={{ fontFamily: 'sans-serif' }}>{currentYear}</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                            
                            {/* Parent row - Daily total */}
                            <TableRow 
                              key={dayKey}
                              className={`cursor-pointer transition-colors ${
                                isSameDay(dailyTotal.date, activeDate)
                                  ? 'bg-[#F15A1B]/20 hover:bg-[#F15A1B]/30'
                                  : 'bg-muted/50 hover:bg-muted/70'
                              }`}
                              onClick={() => {
                                setActiveDate(dailyTotal.date)
                                const newExpanded = new Set(expandedDays)
                                if (isExpanded) {
                                  newExpanded.delete(dayKey)
                                } else {
                                  newExpanded.add(dayKey)
                                }
                                setExpandedDays(newExpanded)
                              }}
                            >
                              <TableCell className="text-left px-2 sm:px-3 py-2 sm:py-3 max-w-0">
                                <div className="flex items-center gap-1 min-w-0">
                                  {isExpanded ? (
                                    <CaretDown className="h-3.5 w-3.5 flex-shrink-0" weight="bold" />
                                  ) : (
                                    <CaretRight className="h-3.5 w-3.5 flex-shrink-0" weight="bold" />
                                  )}
                                  <span className="font-medium text-xs sm:text-sm truncate">
                                    {format(dailyTotal.date, 'EEE, MMM d')}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3 py-2 sm:py-3">{Number(dailyTotal.totalProtein.toFixed(1))}g</TableCell>
                              <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3 py-2 sm:py-3">{Number(dailyTotal.totalCarbs.toFixed(1))}g</TableCell>
                              <TableCell className="text-right text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3 py-2 sm:py-3">{Number(dailyTotal.totalFat.toFixed(1))}g</TableCell>
                              <TableCell className="text-right font-semibold text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3 py-2 sm:py-3">{Number(dailyTotal.totalCalories.toFixed(1))}</TableCell>
                            </TableRow>
                            
                            {/* Child rows - Individual meals */}
                            {isExpanded && dailyTotal.entries.map((entry) => (
                              <TableRow key={entry.id} className="border-b">
                                <TableCell className="text-left px-2 sm:px-3 py-2 sm:py-3 pl-3 sm:pl-5 max-w-0">
                                  <div className="flex gap-2 min-w-0">
                                    {/* Left column: edit icon */}
                                    <div className="flex flex-col items-start gap-0.5 flex-shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 sm:h-6 sm:w-6 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditEntry(entry);
                                        }}
                                      >
                                        <PencilSimple className="h-4 w-4 sm:h-5 sm:w-5 text-[#F15A1B]" weight="regular" />
                                      </Button>
                                    </div>
                                    {/* Right side: timestamp and meal description */}
                                    <div className="flex-1 min-w-0 flex flex-col">
                                      <span className="text-xs text-muted-foreground whitespace-nowrap mb-1">{format(entry.timestamp, 'HH:mm')}</span>
                                      <span className="text-xs break-words min-w-0 overflow-wrap-anywhere">
                                        {editingMealId === entry.id && isRecording ? (
                                          <span className="text-muted-foreground italic">Recording...</span>
                                        ) : editingMealId === entry.id && isTranscribing ? (
                                          <span className="text-muted-foreground italic">Transcribing...</span>
                                        ) : editingMealId === entry.id && isAnalyzing ? (
                                          <span className="text-muted-foreground italic">Analyzing...</span>
                                        ) : (
                                          entry.description
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right text-xs whitespace-nowrap px-2 sm:px-3 py-2 sm:py-3">{Number(entry.protein.toFixed(1))}g</TableCell>
                                <TableCell className="text-right text-xs whitespace-nowrap px-2 sm:px-3 py-2 sm:py-3">{Number(entry.carbs.toFixed(1))}g</TableCell>
                                <TableCell className="text-right text-xs whitespace-nowrap px-2 sm:px-3 py-2 sm:py-3">{Number(entry.fat.toFixed(1))}g</TableCell>
                                <TableCell className="text-right font-semibold text-xs whitespace-nowrap px-2 sm:px-3 py-2 sm:py-3">{Number(entry.calories.toFixed(1))}</TableCell>
                              </TableRow>
                            ))}
                          </Fragment>
                        )
                      })
                    })()}
                  </TableBody>
                </Table>
              </div>
            </div>
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

        {/* Food input bar - fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4">
          <form onSubmit={handleTextSubmit} className="max-w-3xl mx-auto flex items-center rounded-full border-2 border-[#D14815] shadow-2xl overflow-hidden bg-[#FFF5F0]">
            {/* Left section - Orange with icons */}
            <div className="bg-[#F15A1B] flex items-center gap-2 px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={() => handleStartRecording()}
                disabled={isRecording || isModelLoading || isTranscribing || isAnalyzing}
              >
                <Microphone className="h-5 w-5" weight="fill" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={handlePhotoClick}
                disabled={isRecording || isModelLoading || isTranscribing || isAnalyzing}
              >
                <Camera className="h-5 w-5" weight="fill" />
              </Button>
            </div>
            {/* Right section - Pale orange with input */}
            <div className="flex-1 bg-[#FFF5F0] px-4 py-2">
              <Input
                type="text"
                placeholder="What did you eat?"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full bg-transparent border-0 text-gray-800 placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
                disabled={isRecording || isModelLoading || isTranscribing || isAnalyzing}
              />
            </div>
          </form>
        </div>
      </div>
    </>
  )
}