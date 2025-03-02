"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { UserNav } from "@/components/user-nav"
import { useAuth } from "@/contexts/auth-context"
import { doc, setDoc, collection, getDocs, query, where, orderBy, limit, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

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
          const cyclesRef = collection(db, "workouts", user.uid, "cycles")
          const cyclesSnapshot = await getDocs(query(cyclesRef, orderBy("cycleNumber", "desc"), limit(1)))
          let latestCycle = 1
          
          if (!cyclesSnapshot.empty) {
            latestCycle = cyclesSnapshot.docs[0].data().cycleNumber
          }
          setCurrentCycle(latestCycle)

          const workoutsRef = collection(db, "workouts", user.uid, "completed")
          const workoutsSnapshot = await getDocs(
            query(workoutsRef, where("cycle", "==", latestCycle))
          )
          
          const updatedProgram = { ...initialProgram }
          
          workoutsSnapshot.forEach((doc) => {
            const data = doc.data()
            const [week, day] = doc.id.split("-").slice(0, 2)
            if (updatedProgram[week] && updatedProgram[week][day]) {
              updatedProgram[week][day].completed = data.completedAt.toDate()
            }
          })
          
          setProgram(updatedProgram)

          // Migrate local storage data if it exists
          const localData = localStorage.getItem('workoutProgress')
          if (localData) {
            const { program: localProgram, cycle } = JSON.parse(localData)
            const migratePromises: MigrationPromise[] = []

            Object.entries(localProgram).forEach(([week, weekData]: [string, any]) => {
              Object.entries(weekData).forEach(([day, dayData]: [string, any]) => {
                if (dayData.completed) {
                  const completionDate = new Date(dayData.completed)
                  const workoutRef = doc(db, "workouts", user.uid, "completed", `${week}-${day}-${cycle}`)
                  migratePromises.push(
                    setDoc(workoutRef, {
                      week,
                      day,
                      workoutName: dayData.name,
                      completedAt: completionDate,
                      cycle: cycle
                    })
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
          setProgram(localProgram)
          setCurrentCycle(cycle)
        }
      }
    }

    loadSavedWorkouts()
  }, [user])

  // Find the next unfinished workout on initial load
  useEffect(() => {
    const nextWorkout = findNextUnfinishedWorkout()
    if (nextWorkout) {
      setActiveWorkout(nextWorkout)
      setSelectedWorkout(nextWorkout)
    }
  }, [program])

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
        const workoutRef = doc(db, "workouts", user.uid, "completed", `${week}-${day}-${currentCycle}`)
        await setDoc(workoutRef, {
          week,
          day,
          workoutName: program[week][day].name,
          completedAt: completionDate,
          cycle: currentCycle
        })
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

    // Find next workout
    const nextWorkout = findNextUnfinishedWorkout()

    // If all workouts are completed, start a new cycle
    if (!nextWorkout) {
      if (user) {
        // Save cycle completion to Firebase for authenticated users
        try {
          const cycleRef = doc(db, "workouts", user.uid, "cycles", `cycle-${currentCycle}`)
          await setDoc(cycleRef, {
            cycleNumber: currentCycle,
            completedAt: completionDate
          })
        } catch (error) {
          console.error("Error saving cycle completion:", error)
        }
      }

      // Start new cycle
      const newCycle = currentCycle + 1
      setCurrentCycle(newCycle)
      const newProgram = { ...initialProgram }
      setProgram(newProgram)

      // Update local storage for anonymous users
      if (!user) {
        localStorage.setItem('workoutProgress', JSON.stringify({
          program: newProgram,
          cycle: newCycle
        }))
      }

      const firstWorkout = { week: "Wk 1", day: "Mon" }
      setActiveWorkout(firstWorkout)
      setSelectedWorkout(firstWorkout)
    } else {
      setActiveWorkout(nextWorkout)
      setSelectedWorkout(nextWorkout)
    }
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
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold">Lazy Lifts</h1>
          <p className="text-muted-foreground mt-2">Cycle {currentCycle}</p>
        </div>
        <UserNav />
      </div>

      {/* Program Summary Table */}
      <div className="overflow-x-auto mb-8">
        <Table className="border-collapse w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="border"></TableHead>
              <TableHead className="border">Mon</TableHead>
              <TableHead className="border">Tue</TableHead>
              <TableHead className="border">Thu</TableHead>
              <TableHead className="border">Fri</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(program).map(([week, weekData]) => (
              <TableRow key={week}>
                <TableCell className="border font-medium">{week}</TableCell>
                {["Mon", "Tue", "Thu", "Fri"].map((day) => (
                  <TableCell
                    key={`${week}-${day}`}
                    className={cn(
                      "border cursor-pointer hover:bg-muted/50",
                      activeWorkout && activeWorkout.week === week && activeWorkout.day === day
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : selectedWorkout && selectedWorkout.week === week && selectedWorkout.day === day
                          ? "text-red-500 border-red-500 border-2"
                          : weekData[day]?.completed
                            ? "text-gray-400"
                            : "text-black",
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
                      <TableHead className="border text-left text-lg font-bold" colSpan={3}>
                        {getSelectedWorkoutDetails()?.name}
                      </TableHead>
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

              {/* Log Workout Button - only for active workout */}
              {isActiveWorkout() && !getSelectedWorkoutDetails()?.completed && (
                <Button
                  className="w-full mt-8 bg-purple-600 hover:bg-purple-700 text-white py-4"
                  onClick={handleLogWorkout}
                >
                  Log workout
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

