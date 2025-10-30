"use client"

import { useState, useEffect, useRef, Fragment } from "react"
import { useAuth } from "@/contexts/auth-context"
import { saveMeal, subscribeToMeals, deleteMeal, MealEntry as FirestoreMealEntry, db, safeGetDocs } from "@/lib/firebase"
import { collection, query, orderBy } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { UserNav } from "@/components/user-nav"
import Link from "next/link"
import Image from "next/image"
import { PencilSimple, Trash, X, Check, CaretRight, CaretDown } from "phosphor-react"
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
  const [displayTranscript, setDisplayTranscript] = useState<string>("")
  const [calorieTarget, setCalorieTarget] = useState<number>(2000) // Default to 2000
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set([startOfDay(new Date()).toISOString()]))
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  // Load calorie target from stats
  useEffect(() => {
    if (!user) return

    const loadCalorieTarget = async () => {
      try {
        const caloriesRef = collection(db, "calories", user.uid, "entries")
        const q = query(caloriesRef, orderBy("date", "desc"))
        const snapshot = await safeGetDocs(q)
        
        if (!snapshot.empty && snapshot.docs.length > 0) {
          const latestEntry = snapshot.docs[0].data()
          setCalorieTarget(latestEntry.calories)
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current)
      }
    }
  }, [])

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
              Loading speech model... (one-time download, ~74MB)
            </p>
            <Progress value={modelLoadProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {modelLoadProgress}%
            </p>
          </div>
        )}

        {/* Main recording interface */}
        <div className="flex flex-col items-center justify-center mt-16 mb-16">
          {/* Title */}
          {!isRecording && !isModelLoading && (
            <h2 className="text-3xl font-bold mb-12">What did you eat?</h2>
          )}
          
          {isRecording && (
            <h2 className="text-3xl font-bold mb-12">Listening</h2>
          )}

          {/* Record button with volume circles */}
          <div className="relative flex items-center justify-center">
            {/* Animated volume circles */}
            {isRecording && (
              <>
                {[1, 2, 3, 4].map((circle) => {
                  const circleSize = 240 + circle * 40
                  const opacity = Math.max(0.1, volume - (circle - 1) * 0.2)
                  const scale = 1 + volume * 0.3 + (circle - 1) * 0.1
                  
                  return (
                    <div
                      key={circle}
                      className="absolute rounded-full border-2 border-orange-500"
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
              </>
            )}

            {/* Record/Stop button */}
            <button
              onClick={() => isRecording ? stopRecording() : handleStartRecording()}
              disabled={isModelLoading || isTranscribing || isAnalyzing}
              className={`
                relative z-10 rounded-full p-8
                ${isRecording 
                  ? 'bg-orange-500 hover:bg-orange-600' 
                  : 'bg-orange-500 hover:bg-orange-600'
                }
                ${isModelLoading || isTranscribing || isAnalyzing 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'cursor-pointer'
                }
                transition-all duration-200
                focus:outline-none focus:ring-4 focus:ring-orange-300
                ${isRecording ? 'ring-4 ring-white' : ''}
              `}
              style={{
                width: '240px',
                height: '240px',
              }}
            >
              {isRecording ? (
                <Stop className="w-24 h-24 text-white mx-auto" weight="fill" />
              ) : (
                <Microphone className="w-24 h-24 text-white mx-auto" weight="fill" />
              )}
            </button>
          </div>

          {/* Error display */}
          {(error || whisperError) && (
            <div className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm">
              {error || whisperError}
            </div>
          )}
        </div>

        {/* Transcribed text display - fixed at bottom of viewport */}
        {displayTranscript && (
          <div 
            className="fixed bottom-8 left-1/2 transform -translate-x-1/2 px-6 py-4 bg-black text-white rounded-lg text-center max-w-md animate-in fade-in duration-300 z-50"
          >
            <p className="text-base">{displayTranscript}</p>
          </div>
        )}

        {/* Weekly calorie chart */}
        <div className="mt-16 mb-16">
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
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center h-full relative z-10">
                    <div className="w-full flex flex-col items-center justify-end h-full">
                      {/* Bar */}
                      <div
                        className={`w-full rounded-t transition-all duration-300 ${
                          dayData.isToday 
                            ? 'bg-orange-500' 
                            : 'bg-gray-300'
                        }`}
                        style={{
                          height: `${height}%`,
                          minHeight: dayData.calories > 0 ? '4px' : '0',
                        }}
                      />
                    </div>
                    
                    {/* Day label */}
                    <div className="mt-2 text-xs text-muted-foreground">
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
                              className="bg-muted/50 cursor-pointer hover:bg-muted/70"
                              onClick={() => {
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
                                    {/* Left column: icons stacked vertically */}
                                    <div className="flex flex-col items-start gap-0.5 flex-shrink-0">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 sm:h-6 sm:w-6 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStartRecording(entry.id);
                                        }}
                                        disabled={isRecording || isTranscribing || isAnalyzing || isModelLoading || deletingMealId === entry.id}
                                      >
                                        <Microphone className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" weight="fill" />
                                      </Button>
                                      {deletingMealId === entry.id ? (
                                        <div className="flex flex-col gap-0.5">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-green-600 hover:text-green-700"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteMeal(entry.id);
                                            }}
                                          >
                                            <Check className="h-4 w-4 sm:h-5 sm:w-5" weight="bold" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-muted-foreground"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeletingMealId(null);
                                            }}
                                          >
                                            <X className="h-4 w-4 sm:h-5 sm:w-5" weight="bold" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-destructive hover:text-destructive/90"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeletingMealId(entry.id);
                                          }}
                                          disabled={isRecording || isTranscribing || isAnalyzing}
                                        >
                                          <Trash className="h-4 w-4 sm:h-5 sm:w-5" weight="regular" />
                                        </Button>
                                      )}
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
      </div>
    </>
  )
}