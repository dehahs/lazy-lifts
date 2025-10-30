"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StickyActionButton } from "@/components/ui/sticky-action-button"
import { cn } from "@/lib/utils"
import { UserNav } from "@/components/user-nav"
import { useAuth } from "@/contexts/auth-context"
import { doc, setDoc, collection, getDocs, query, where, orderBy, limit, deleteDoc } from "firebase/firestore"
import { db, createUserDocument, safeGetDocs, createDocumentFallback } from "@/lib/firebase"
import Link from "next/link"

// Define workout program structure
type Exercise = {
  name: string
  sets: number
  reps: number
}

type WorkoutDay = {
  name: string
  exercises: Exercise[]
  completed?: Date | null
}

type WorkoutWk = {
  [key: string]: WorkoutDay
}

type WorkoutProgram = {
  [key: string]: WorkoutWk
}

type MigrationPromise = Promise<void>

export default function LiftingApp() {
  const { user } = useAuth()
  // Initialize workout program data
  const initialProgram: WorkoutProgram = {
    "Wk 1": {
      Mon: { name: "Chest", exercises: generateExercises("Chest") },
      Tue: { name: "Arms A", exercises: generateExercises("Arms A") },
      Thu: { name: "Legs", exercises: generateExercises("Legs") },
      Fri: { name: "Back", exercises: generateExercises("Back") },
    },
    "Wk 2": {
      Mon: { name: "Shoulders", exercises: generateExercises("Shoulders") },
      Tue: { name: "Chest", exercises: generateExercises("Chest") },
      Thu: { name: "Arms B", exercises: generateExercises("Arms B") },
      Fri: { name: "Legs", exercises: generateExercises("Legs") },
    },
    "Wk 3": {
      Mon: { name: "Back", exercises: generateExercises("Back") },
      Tue: { name: "Shoulders", exercises: generateExercises("Shoulders") },
      Thu: { name: "Chest", exercises: generateExercises("Chest") },
      Fri: { name: "Arms C", exercises: generateExercises("Arms C") },
    },
    "Wk 4": {
      Mon: { name: "Legs", exercises: generateExercises("Legs") },
      Tue: { name: "Back", exercises: generateExercises("Back") },
      Thu: { name: "Shoulders", exercises: generateExercises("Shoulders") },
      Fri: { name: "Chest", exercises: generateExercises("Chest") },
    },
    "Wk 5": {
      Mon: { name: "Arms D", exercises: generateExercises("Arms D") },
      Tue: { name: "Legs", exercises: generateExercises("Legs") },
      Thu: { name: "Shoulders", exercises: generateExercises("Shoulders") },
      Fri: { name: "Back", exercises: generateExercises("Back") },
    },
    "Wk 6": {
      Mon: { name: "Chest", exercises: generateExercises("Chest") },
      Tue: { name: "Arms E", exercises: generateExercises("Arms E") },
      Thu: { name: "Legs", exercises: generateExercises("Legs") },
      Fri: { name: "Arms A2", exercises: generateExercises("Arms A2") },
    },
    "Wk 7": {
      Mon: { name: "Shoulders", exercises: generateExercises("Shoulders") },
      Tue: { name: "Arms B2", exercises: generateExercises("Arms B2") },
      Thu: { name: "Back", exercises: generateExercises("Back") },
      Fri: { name: "Arms C2", exercises: generateExercises("Arms C2") },
    },
    "Wk 8": {
      Mon: { name: "Chest", exercises: generateExercises("Chest") },
      Tue: { name: "Arms D2", exercises: generateExercises("Arms D2") },
      Thu: { name: "Legs", exercises: generateExercises("Legs") },
      Fri: { name: "Arms E2", exercises: generateExercises("Arms E2") },
    },
  }

  const [program, setProgram] = useState<WorkoutProgram>(initialProgram)
  const [selectedWorkout, setSelectedWorkout] = useState<{ week: string; day: string } | null>(null)
  const [activeWorkout, setActiveWorkout] = useState<{ week: string; day: string } | null>(null)
  const [currentCycle, setCurrentCycle] = useState<number>(1)
  const [lastCompletedWorkout, setLastCompletedWorkout] = useState<{ week: string; day: string; date: Date } | null>(null)

  // Load workouts from local storage or Firebase
  useEffect(() => {
    const loadSavedWorkouts = async () => {
      // Load last completed workout from localStorage if it exists
      const lastWorkoutData = localStorage.getItem('lastCompletedWorkout')
      if (lastWorkoutData) {
        try {
          const lastWorkout = JSON.parse(lastWorkoutData)
          // Convert date string back to Date object
          lastWorkout.date = new Date(lastWorkout.date)
          setLastCompletedWorkout(lastWorkout)
        } catch (error) {
          console.error("Error parsing last completed workout:", error)
          localStorage.removeItem('lastCompletedWorkout')
        }
      }

      if (user) {
        // Load from Firebase for authenticated users
        try {
          console.log('Loading cycles data...');
          const cyclesRef = collection(db, "workouts", user.uid, "cycles")
          const cyclesSnapshot = await safeGetDocs(query(cyclesRef, orderBy("cycleNumber", "desc"), limit(1)))
          let latestCycle = 1
          
          if (!cyclesSnapshot.empty) {
            const latestCycleData = cyclesSnapshot.docs[0].data()
            latestCycle = latestCycleData.cycleNumber
            
            // If the latest cycle is completed, start a new one
            if (latestCycleData.completedAt) {
              console.log('Latest cycle is completed, starting new cycle');
              latestCycle += 1
              // Create new cycle record if it doesn't exist
              await createDocumentFallback(
                user.uid,
                "workouts",
                "cycles",
                `cycle-${latestCycle}`,
                {
                  cycleNumber: latestCycle,
                  startedAt: new Date(),
                  status: 'active'
                }
              )
            }
          }
          console.log('Setting current cycle to:', latestCycle);
          setCurrentCycle(latestCycle)

          const workoutsRef = collection(db, "workouts", user.uid, "completed")
          const workoutsSnapshot = await safeGetDocs(
            query(workoutsRef, where("cycle", "==", latestCycle))
          )
          
          const updatedProgram = { ...initialProgram }
          
          if (!workoutsSnapshot.empty) {
            workoutsSnapshot.forEach((doc) => {
              const data = doc.data()
              // Extract week and day from the workout ID (format: "Wk 1-Mon-1")
              const [week, day] = doc.id.split("-").slice(0, 2)
              // Convert any "Week X" format to "Wk X" format
              const normalizedWeek = week.replace("Week ", "Wk ")
              if (updatedProgram[normalizedWeek] && updatedProgram[normalizedWeek][day]) {
                updatedProgram[normalizedWeek][day].completed = data.completedAt.toDate()
              }
            })
          }
          
          // Find next workout using the updated program directly
          const weeks = Object.keys(updatedProgram)
          const days = ["Mon", "Tue", "Thu", "Fri"]
          let nextWorkout = null
          
          for (const week of weeks) {
            for (const day of days) {
              if (!updatedProgram[week][day].completed) {
                nextWorkout = { week, day }
                break
              }
            }
            if (nextWorkout) break
          }

          setProgram(updatedProgram)
          
          if (nextWorkout) {
            setActiveWorkout(nextWorkout)
            setSelectedWorkout(nextWorkout)
          }

          // Migrate local storage data if it exists
          const localData = localStorage.getItem('workoutProgress')
          if (localData) {
            const { program: localProgram, cycle } = JSON.parse(localData)
            const migratePromises: MigrationPromise[] = []

            Object.entries(localProgram).forEach(([week, weekData]: [string, any]) => {
              Object.entries(weekData).forEach(([day, dayData]: [string, any]) => {
                if (dayData.completed) {
                  const completionDate = new Date(dayData.completed)
                  migratePromises.push(
                    createUserDocument(
                      user.uid,
                      "workouts",
                      "completed",
                      `${week}-${day}-${cycle}`,
                      {
                        week,
                        day,
                        workoutName: dayData.name,
                        completedAt: completionDate,
                        cycle: cycle
                      }
                    )
                  )
                }
              })
            })

            if (migratePromises.length > 0) {
              await Promise.all(migratePromises)
              localStorage.removeItem('workoutProgress')
              // Reload the data after migration
              window.location.reload()
            }
          }
        } catch (error) {
          console.error("Error loading saved workouts:", error)
        }
      } else {
        // Load from local storage for anonymous users
        const localData = localStorage.getItem('workoutProgress')
        if (localData) {
          const { program: localProgram, cycle } = JSON.parse(localData)
          // Convert ISO date strings back to Date objects
          Object.keys(localProgram).forEach(week => {
            Object.keys(localProgram[week]).forEach(day => {
              if (localProgram[week][day].completed) {
                localProgram[week][day].completed = new Date(localProgram[week][day].completed)
              }
            })
          })
          // Find next workout using the local program directly
          const weeks = Object.keys(localProgram)
          const days = ["Mon", "Tue", "Thu", "Fri"]
          let nextWorkout = null
          
          for (const week of weeks) {
            for (const day of days) {
              if (!localProgram[week][day].completed) {
                nextWorkout = { week, day }
                break
              }
            }
            if (nextWorkout) break
          }

          setProgram(localProgram)
          setCurrentCycle(cycle)
          
          if (nextWorkout) {
            setActiveWorkout(nextWorkout)
            setSelectedWorkout(nextWorkout)
          }
        }
      }
    }

    loadSavedWorkouts()
  }, [user])

  // This effect was moved into the data loading logic

  // Find the next unfinished workout
  const findNextUnfinishedWorkout = () => {
    const weeks = Object.keys(program)
    const days = ["Mon", "Tue", "Thu", "Fri"]

    for (const week of weeks) {
      for (const day of days) {
        if (!program[week][day].completed) {
          return { week, day }
        }
      }
    }
    return null
  }

  // Handle workout selection
  const handleSelectWorkout = (week: string, day: string) => {
    setSelectedWorkout({ week, day })
  }

  // Updated log workout function to handle both anonymous and authenticated users
  const handleLogWorkout = async () => {
    if (!activeWorkout) return

    const { week, day } = activeWorkout
    const completionDate = new Date()

    // Update local state
    const updatedProgram = { ...program }
    updatedProgram[week][day].completed = completionDate
    setProgram(updatedProgram)
    
    // Store the last completed workout for potential rollback
    const lastWorkout = { week, day, date: completionDate }
    setLastCompletedWorkout(lastWorkout)
    
    // Save last completed workout to localStorage
    localStorage.setItem('lastCompletedWorkout', JSON.stringify(lastWorkout))

    if (user) {
      // Save to Firebase for authenticated users
      try {
        await createDocumentFallback(
          user.uid,
          "workouts",
          "completed",
          `${week.replace("Week ", "Wk ")}-${day}-${currentCycle}`,
          {
            week,
            day,
            workoutName: program[week][day].name,
            completedAt: completionDate,
            cycle: currentCycle
          }
        )
      } catch (error) {
        console.error("Error saving workout:", error)
        updatedProgram[week][day].completed = null
        setProgram(updatedProgram)
        setLastCompletedWorkout(null)
        return
      }
    } else {
      // Save to local storage for anonymous users
      localStorage.setItem('workoutProgress', JSON.stringify({
        program: updatedProgram,
        cycle: currentCycle
      }))
    }

    // Check if this was the last workout in the cycle
    const nextWorkout = findNextUnfinishedWorkout();
    if (!nextWorkout) {
      // Start a new cycle but don't change the view
      if (user) {
        try {
          console.log('Starting cycle transition...');
          console.log('Current cycle:', currentCycle);
          
          // Save current cycle completion
          await createDocumentFallback(
            user.uid,
            "workouts",
            "cycles",
            `cycle-${currentCycle}`,
            {
              cycleNumber: currentCycle,
              completedAt: completionDate
            }
          )
          console.log('Saved cycle completion');

          // Start new cycle
          const newCycle = currentCycle + 1
          console.log('New cycle will be:', newCycle);
          
          // Save the new cycle number to Firebase first
          const newCycleRef = await createDocumentFallback(
            user.uid,
            "workouts",
            "cycles",
            `cycle-${newCycle}`,
            {
              cycleNumber: newCycle,
              startedAt: new Date(),
              status: 'active'
            }
          )
          console.log('Created new cycle record');

          // Then update local state
          setCurrentCycle(newCycle)
          const newProgram = { ...initialProgram }
          setProgram(newProgram)
          console.log('Updated local state');

          // Don't automatically change the view, just update the active workout for the new cycle
          const firstWorkout = { week: "Wk 1", day: "Mon" }
          setActiveWorkout(firstWorkout)
          console.log('Updated active workout for new cycle')

        } catch (error) {
          console.error("Error transitioning to new cycle:", error)
          // If there's an error, reload the page to get the latest state from Firebase
          window.location.reload()
          return
        }
      } else {
        // For anonymous users, just update local storage
        const newCycle = currentCycle + 1
        setCurrentCycle(newCycle)
        const newProgram = { ...initialProgram }
        setProgram(newProgram)

        localStorage.setItem('workoutProgress', JSON.stringify({
          program: newProgram,
          cycle: newCycle
        }))

        // Don't automatically change the view, just update the active workout for the new cycle
        const firstWorkout = { week: "Wk 1", day: "Mon" }
        setActiveWorkout(firstWorkout)
      }
    }
    // We no longer automatically update the active/selected workout
    // This will only happen on page refresh or revisit
  }

  // Check if selected workout is the active one
  const isActiveWorkout = () => {
    if (!selectedWorkout || !activeWorkout) return false
    return selectedWorkout.week === activeWorkout.week && selectedWorkout.day === activeWorkout.day
  }

  // Check if selected workout is in the future (after active workout)
  const isFutureWorkout = () => {
    if (!selectedWorkout || !activeWorkout) return false

    const weeks = Object.keys(program)
    const days = ["Mon", "Tue", "Thu", "Fri"]

    const selectedWeekIndex = weeks.indexOf(selectedWorkout.week)
    const selectedDayIndex = days.indexOf(selectedWorkout.day)

    const activeWeekIndex = weeks.indexOf(activeWorkout.week)
    const activeDayIndex = days.indexOf(activeWorkout.day)

    return (
      selectedWeekIndex > activeWeekIndex ||
      (selectedWeekIndex === activeWeekIndex && selectedDayIndex > activeDayIndex)
    )
  }

  // Get the selected workout details
  const getSelectedWorkoutDetails = () => {
    if (!selectedWorkout) return null
    return program[selectedWorkout.week][selectedWorkout.day]
  }

  const handleUndoLastWorkout = async () => {
    if (!lastCompletedWorkout) return
    
    const { week, day } = lastCompletedWorkout
    
    // Update local state
    const updatedProgram = { ...program }
    updatedProgram[week][day].completed = null
    setProgram(updatedProgram)
    
    if (user) {
      // Remove from Firebase for authenticated users
      try {
        const workoutRef = doc(db, "workouts", user.uid, "completed", `${week}-${day}-${currentCycle}`)
        await deleteDoc(workoutRef)
      } catch (error) {
        console.error("Error removing workout:", error)
        // Revert the local state change if Firebase deletion fails
        updatedProgram[week][day].completed = lastCompletedWorkout.date
        setProgram(updatedProgram)
        return
      }
    } else {
      // Update local storage for anonymous users
      localStorage.setItem('workoutProgress', JSON.stringify({
        program: updatedProgram,
        cycle: currentCycle
      }))
    }
    
    // Reset the last completed workout
    setLastCompletedWorkout(null)
    localStorage.removeItem('lastCompletedWorkout')
    
    // Set the active workout to the one we just undid
    setActiveWorkout({ week, day })
    setSelectedWorkout({ week, day })
  }

  // Check if the last completed workout is recent (within the last hour)
  const isRecentWorkout = () => {
    if (!lastCompletedWorkout) return false
    
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    return lastCompletedWorkout.date > oneHourAgo
  }

  return (
    <>
      <div className="container mx-auto py-8 px-4 max-w-3xl pb-32">
        <div className="flex justify-between items-start mb-8">
          <div>
            <Link href="/calories" className="hover:opacity-80 transition-opacity">
              <h1 className="text-5xl font-medium tracking-wide">Lazy Lifts</h1>
              <p className="text-muted-foreground mt-1 text-lg tracking-wide">Cycle {currentCycle}</p>
            </Link>
          </div>
          <UserNav />
        </div>

      {/* Program Summary Table */}
      <div className="overflow-x-auto mb-8 p-0.5">
        <Table className="w-full schedule-table">
          <TableHeader className="schedule-header p-1">
            <TableRow>
              <TableHead className="bg-slate-100"></TableHead>
              <TableHead className="bg-slate-100">Mon</TableHead>
              <TableHead className="bg-slate-100">Tue</TableHead>
              <TableHead className="bg-slate-100">Thu</TableHead>
              <TableHead className="bg-slate-100">Fri</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(program).map(([week, weekData]) => (
              <TableRow key={week}>
                <TableCell className="font-medium bg-slate-100 p-1">{week}</TableCell>
                {["Mon", "Tue", "Thu", "Fri"].map((day) => (
                  <TableCell
                    key={`${week}-${day}`}
                    className={cn(
                      "cursor-pointer py-3 p-1",
                      activeWorkout && activeWorkout.week === week && activeWorkout.day === day
                        ? selectedWorkout && selectedWorkout.week === activeWorkout.week && selectedWorkout.day === activeWorkout.day
                          ? "latest-incomplete hover:bg-[#D14815]"
                          : "latest-incomplete-dimmed hover:bg-[#D14815]"
                        : selectedWorkout && selectedWorkout.week === week && selectedWorkout.day === day
                          ? "selected-day selected-cell hover:bg-transparent"
                          : weekData[day]?.completed
                            ? "completed"
                            : "incomplete",
                    )}
                    onClick={() => handleSelectWorkout(week, day)}
                  >
                    {weekData[day]?.name}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Workout Details */}
      {selectedWorkout && (
        <div className="mt-8">
          {getSelectedWorkoutDetails() && (
            <>
              <div className="overflow-x-auto">
                <Table className="border-collapse w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="border text-left text-lg font-bold">
                        {getSelectedWorkoutDetails()?.name}
                      </TableHead>
                      <TableHead className="border text-center font-bold">Sets</TableHead>
                      <TableHead className="border text-center font-bold">Reps</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getSelectedWorkoutDetails()?.exercises.map((exercise, index) => (
                      <TableRow key={index}>
                        <TableCell className="border">{exercise.name}</TableCell>
                        <TableCell className="border text-center">{exercise.sets}</TableCell>
                        <TableCell className="border text-center">
                          {exercise.name === "Tricep dips" && exercise.reps === 0 ? "fail" : exercise.reps}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Show completion date if workout is completed */}
              {getSelectedWorkoutDetails()?.completed && (
                <div className="mt-4 text-center text-muted-foreground">
                  Completed on: {getSelectedWorkoutDetails()?.completed?.toLocaleString()}
                </div>
              )}

              {/* Go to latest workout button - visible when not on active workout */}
              {!isActiveWorkout() && activeWorkout && (
                <Button
                  onClick={() => handleSelectWorkout(activeWorkout.week, activeWorkout.day)}
                  variant="outline"
                  className="w-full mt-8"
                >
                  Go to latest workout
                </Button>
              )}
              
              {/* Undo Last Workout Button - only visible when there's a recent last completed workout */}
              {lastCompletedWorkout && isRecentWorkout() && (
                <Button
                  onClick={handleUndoLastWorkout}
                  variant="outline"
                  className="w-full mt-2"
                >
                  Undo Last Workout
                </Button>
              )}
            </>
          )}
        </div>
      )}
      </div>

      {/* Fixed button at the bottom */}
      {isActiveWorkout() && !getSelectedWorkoutDetails()?.completed && (
        <StickyActionButton
          onClick={handleLogWorkout}
          variant="destructive"
        >
          Did you even lift?
        </StickyActionButton>
      )}
    </>
  )
}

function generateExercises(workoutType: string): Exercise[] {
  const exercises: { [key: string]: Exercise[] } = {
    Chest: [
      { name: "Bench Press", sets: 3, reps: 10 },
      { name: "Reverse-Grip Bench Press", sets: 3, reps: 10 },
      { name: "Dumbell Flys", sets: 3, reps: 10 },
    ],
    Back: [
      { name: "Bent-Over Barbell Row", sets: 3, reps: 10 },
      { name: "Reverse Grip Pulldown", sets: 3, reps: 10 },
      { name: "Straight-Arm Pulldown", sets: 3, reps: 10 },
      { name: "Seated Cable Row", sets: 3, reps: 10 },
    ],
    Legs: [
      { name: "Squat", sets: 3, reps: 10 },
      { name: "Standing Calf Raise", sets: 3, reps: 20 },
      { name: "Deadlift", sets: 3, reps: 10 },
      { name: "Shrugs", sets: 3, reps: 10 },
    ],
    Shoulders: [
      { name: "Barbell Shoulder Press", sets: 3, reps: 10 },
      { name: "Dumbbell Front Raise", sets: 3, reps: 10 },
      { name: "Dumbbell Lateral Raise", sets: 3, reps: 10 },
      { name: "Dumbbell Bent Over Lateral Raise", sets: 3, reps: 10 },
    ],
    "Arms A": [
      { name: "Close-Grip Bench Press (Rest Pause)", sets: 3, reps: 5 },
      { name: "Barbell Curls (Rest Pause)", sets: 3, reps: 5 },
      { name: "Seated Dumbbell Overheard Extension", sets: 3, reps: 8 },
      { name: "Preacher Curls", sets: 3, reps: 8 },
      { name: "Tricep Pressdown", sets: 3, reps: 8 },
      { name: "Hammer Curls", sets: 3, reps: 8 },
    ],
    "Arms B": [
      { name: "Lying Tricep Extension", sets: 3, reps: 20 },
      { name: "Dumbbell Curl", sets: 3, reps: 20 },
      { name: "Seated Dumbbell Overheard Extension", sets: 3, reps: 20 },
      { name: "Dumbbell Preacher Curl", sets: 3, reps: 20 },
      { name: "Tricep Pressdown", sets: 3, reps: 20 },
      { name: "Dumbbell Hammer Curl", sets: 3, reps: 20 },
    ],
    "Arms C": [
      { name: "Tricep dips", sets: 3, reps: 0 },
      { name: "Preacher Curls", sets: 3, reps: 25 },
      { name: "Tricep Pressdown", sets: 3, reps: 25 },
      { name: "High Cable Curls", sets: 3, reps: 25 },
      { name: "Overhead Cable Tricep Extension", sets: 3, reps: 25 },
      { name: "Behind-the-Back Cable Curls", sets: 3, reps: 25 },
    ],
    "Arms D": [
      { name: "Overhead Tricep Extensions", sets: 3, reps: 10 },
      { name: "Standing Cable Concentration Curls", sets: 3, reps: 10 },
      { name: "Tricep Pressdowns", sets: 3, reps: 10 },
      { name: "Preacher Curls", sets: 3, reps: 10 },
      { name: "Diamond Pushups", sets: 3, reps: 10 },
      { name: "Hammer Curls", sets: 3, reps: 10 },
    ],
    "Arms E": [
      { name: "Close-Grip Bench Press (Rest Pause)", sets: 4, reps: 5 },
      { name: "Barbell Curls (Rest Pause)", sets: 4, reps: 5 },
      { name: "Tricep Pushdowns", sets: 4, reps: 5 },
      { name: "Dumbbell Curls", sets: 4, reps: 5 },
    ],
    "Arms A2": [
      { name: "Close-Grip Bench Press (Rest Pause)", sets: 3, reps: 20 },
      { name: "Barbell Curls (Rest Pause)", sets: 3, reps: 20 },
      { name: "Seated Dumbbell Overheard Extension", sets: 3, reps: 20 },
      { name: "Preacher Curls", sets: 3, reps: 20 },
      { name: "Tricep Pressdown", sets: 3, reps: 20 },
      { name: "Hammer Curls", sets: 3, reps: 20 },
    ],
    "Arms B2": [
      { name: "Lying Tricep Extension", sets: 3, reps: 30 },
      { name: "Dumbbell Curl", sets: 3, reps: 30 },
      { name: "Seated Dumbbell Overheard Extension", sets: 3, reps: 30 },
      { name: "Dumbbell Preacher Curl", sets: 3, reps: 30 },
      { name: "Tricep Pressdown", sets: 3, reps: 30 },
      { name: "Dumbbell Hammer Curl", sets: 3, reps: 30 },
    ],
    "Arms C2": [
      { name: "Tricep dips", sets: 3, reps: 15 },
      { name: "Preacher Curls", sets: 3, reps: 15 },
      { name: "Tricep Pressdown", sets: 3, reps: 15 },
      { name: "High Cable Curls", sets: 3, reps: 15 },
      { name: "Overhead Cable Tricep Extension", sets: 3, reps: 15 },
      { name: "Behind-the-Back Cable Curls", sets: 3, reps: 15 },
    ],
    "Arms D2": [
      { name: "Overhead Tricep Extensions", sets: 3, reps: 25 },
      { name: "Standing Cable Concentration Curls", sets: 3, reps: 25 },
      { name: "Tricep Pressdowns", sets: 3, reps: 25 },
      { name: "Preacher Curls", sets: 3, reps: 25 },
      { name: "Diamond Pushups", sets: 3, reps: 25 },
      { name: "Hammer Curls", sets: 3, reps: 25 },
    ],
    "Arms E2": [
      { name: "Close-Grip Bench Press (Rest Pause)", sets: 4, reps: 10 },
      { name: "Barbell Curls (Rest Pause)", sets: 4, reps: 10 },
      { name: "Tricep Pushdowns", sets: 4, reps: 10 },
      { name: "Dumbbell Curls", sets: 4, reps: 10 },
    ],
  }

  return exercises[workoutType] || []
}