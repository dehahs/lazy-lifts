"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { type User, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
    } catch (error: any) {
      console.error("Error signing in with Google:", error)
      if (error.code === "auth/unauthorized-domain") {
        alert("Please try again on the deployed site. Google Sign-In is not available in preview mode.")
      } else {
        alert("An error occurred while signing in. Please try again.")
      }
    }
  }

  const signOutHandler = async () => {
    try {
      await signOut(auth)
      localStorage.removeItem('workoutProgress')
      window.location.reload()
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signOut: signOutHandler,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

