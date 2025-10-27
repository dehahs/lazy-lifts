"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { saveMeal, subscribeToMeals, MealEntry as FirestoreMealEntry } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { UserNav } from "@/components/user-nav"
import Link from "next/link"
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

function groupEntriesByDay(entries: FoodEntry[]): DailyTotal[] {
  const groupedEntries = entries.reduce((acc: { [key: string]: FoodEntry[] }, entry) => {
    const dateKey = startOfDay(entry.timestamp).toISOString();
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(entry);
    return acc;
  }, {});

  return Object.entries(groupedEntries)
    .map(([dateStr, entries]) => {
      const totals = entries.reduce(
        (sum, entry) => ({
          calories: sum.calories + entry.calories,
          protein: sum.protein + entry.protein,
          carbs: sum.carbs + entry.carbs,
          fat: sum.fat + entry.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

      return {
        date: new Date(dateStr),
        entries: entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
        totalCalories: totals.calories,
        totalProtein: totals.protein,
        totalCarbs: totals.carbs,
        totalFat: totals.fat,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export default function CaloriesPage() {
  const { user } = useAuth()
  const [transcript, setTranscript] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  // Subscribe to meals from Firestore
  useEffect(() => {
    if (!user) return

    const unsubscribe = subscribeToMeals(user.uid, (meals) => {
      setFoodEntries(meals.map(meal => ({
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

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    // Set initial status
    setIsOnline(navigator.onLine)

    // Add event listeners
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebugInfo = (info: string) => {
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${info}`])
  }

  useEffect(() => {
    // Check browser compatibility on mount
    const isDia = /Electron/.test(navigator.userAgent)
    const isChromeOrEdge = /Chrome|Edge/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent)
    
    if (isDia) {
      addDebugInfo('You are using Dia (Electron-based browser)')
      addDebugInfo('Speech recognition may not work in Dia due to Electron security restrictions')
      addDebugInfo('Please use Chrome, Edge, or another Chromium-based browser for this feature')
    } else if (!isChromeOrEdge) {
      addDebugInfo('Warning: Speech recognition works best in Chrome or Edge browsers')
    }
    
    if (!('webkitSpeechRecognition' in window)) {
      addDebugInfo('Error: Speech recognition is not supported in this browser')
    } else {
      addDebugInfo('Speech recognition API is available in this browser')
    }
  }, [])

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Chrome.')
      return
    }

    addDebugInfo('Starting speech recognition...')
    const recognition = new (window as any).webkitSpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    
    // Add more configuration for debugging
    recognition.lang = 'en-US' // Explicitly set language
    addDebugInfo(`Speech recognition configured with language: ${recognition.lang}`)

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript
      setTranscript(transcript)
      setIsListening(false)
      await analyzeFood(transcript)
    }

  const analyzeFood = async (description: string) => {
    if (!user) {
      setError('Please sign in to log meals');
      return;
    }

    try {
      setIsAnalyzing(true)
      setError(null)

      addDebugInfo(`Sending food description to analyze: ${description}`);
      const response = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        addDebugInfo(`API error: ${errorData.error || response.statusText}`);
        throw new Error(errorData.error || 'Failed to analyze food');
      }

      const data = await response.json();
      addDebugInfo(`Received analysis: ${JSON.stringify(data)}`);
      
      const newEntry: Omit<FirestoreMealEntry, 'ownerUid'> = {
        id: Date.now().toString(),
        timestamp: new Date(),
        description: description,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
      };

      await saveMeal(user.uid, newEntry);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze food');
      addDebugInfo(`Error analyzing food: ${err}`);
    } finally {
      setIsAnalyzing(false)
    }
  }

    recognition.onerror = (event: any) => {
      setIsListening(false)
      
      const errorMessages: { [key: string]: string } = {
        'network': 'Network error. Please check your internet connection.',
        'no-speech': 'No speech was detected. Please try again.',
        'audio-capture': 'No microphone was found or microphone access was denied.',
        'not-allowed': 'Microphone permission was denied. Please allow microphone access.',
        'aborted': 'Speech recognition was aborted.',
        'default': 'An error occurred with speech recognition.'
      }

      const message = errorMessages[event.error] || errorMessages.default
      setTranscript(`Error: ${message}`)
      
      // Add detailed error information
      addDebugInfo(`Speech recognition error: ${event.error}`)
      addDebugInfo(`Error message: ${message}`)
      
      if (event.error === 'network') {
        const isDia = /Electron/.test(navigator.userAgent)
        if (isDia) {
          addDebugInfo('Network error in Dia browser:')
          addDebugInfo('The speech recognition feature is not fully supported in Dia')
          addDebugInfo('Please try using Chrome, Edge, or another Chromium-based browser')
          addDebugInfo('This is a known limitation with Electron-based browsers')
        } else {
          addDebugInfo('Troubleshooting tips for network error:')
          addDebugInfo('1. Check if you can access google.com in your browser')
          addDebugInfo('2. Check if your firewall is blocking WebRTC or speech recognition')
          addDebugInfo('3. Try using a different Chrome profile or clearing browser data')
          addDebugInfo('4. If using a VPN, try disabling it temporarily')
        }
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
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

      <div className="mt-8 space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <p className="text-sm text-muted-foreground">
            {isOnline ? 'Connected to speech services' : 'Offline - Speech recognition unavailable'}
          </p>
        </div>

        <Button 
          onClick={startListening}
          className="w-full py-8 text-lg"
          variant={isListening ? "destructive" : "default"}
          disabled={!isOnline}
        >
          {isListening ? "Listening..." : "Start Speaking"}
        </Button>

        {(transcript || isAnalyzing) && (
          <div className="p-4 rounded-lg border bg-card text-card-foreground">
            {transcript && <p className="text-lg">{transcript}</p>}
            {isAnalyzing && (
              <p className="text-sm text-muted-foreground mt-2">Analyzing your meal...</p>
            )}
            {error && (
              <p className="text-sm text-red-500 mt-2">{error}</p>
            )}
          </div>
        )}

        {foodEntries.length > 0 && (
          <Accordion type="multiple" className="w-full">
            {groupEntriesByDay(foodEntries).map((dailyTotal) => (
              <AccordionItem key={dailyTotal.date.toISOString()} value={dailyTotal.date.toISOString()}>
                <AccordionTrigger className="px-4">
                  <div className="flex w-full items-center justify-between">
                    <span className="font-medium">
                      {format(dailyTotal.date, 'EEEE, MMMM d, yyyy')}
                    </span>
                    <div className="flex gap-6 text-sm">
                      <span>{dailyTotal.totalCalories} cal</span>
                      <span>{dailyTotal.totalProtein}g protein</span>
                      <span>{dailyTotal.totalCarbs}g carbs</span>
                      <span>{dailyTotal.totalFat}g fat</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Calories</TableHead>
                          <TableHead className="text-right">Protein</TableHead>
                          <TableHead className="text-right">Carbs</TableHead>
                          <TableHead className="text-right">Fat</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyTotal.entries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{format(entry.timestamp, 'HH:mm')}</TableCell>
                            <TableCell>{entry.description}</TableCell>
                            <TableCell className="text-right">{entry.calories}</TableCell>
                            <TableCell className="text-right">{entry.protein}g</TableCell>
                            <TableCell className="text-right">{entry.carbs}g</TableCell>
                            <TableCell className="text-right">{entry.fat}g</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        <div className="text-sm text-muted-foreground text-center">
          <p>Note: Speech recognition requires an internet connection as it uses Google's speech services.</p>
          {process.env.NODE_ENV === 'development' && (
            <p className="mt-2">
              Running in development mode - make sure you have a stable internet connection and your 
              development environment isn't blocking external requests.
            </p>
          )}
          
          {/* Debug Information */}
          {debugInfo.length > 0 && (
            <div className="mt-4 p-4 bg-slate-100 rounded-lg text-left">
              <p className="font-medium mb-2">Debug Information:</p>
              {debugInfo.map((info, index) => (
                <p key={index} className="text-xs font-mono">{info}</p>
              ))}
              <Button 
                onClick={() => setDebugInfo([])} 
                variant="outline" 
                className="mt-2 text-xs"
              >
                Clear Debug Info
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}