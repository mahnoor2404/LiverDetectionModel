'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { saveUserProfile, getUserProfile } from '@/lib/firestore'

interface UserProfile {
  name: string
  email: string
  role: string
}

interface AuthContextValue {
  user:        User | null
  profile:     UserProfile | null
  loading:     boolean
  signIn:      (email: string, password: string) => Promise<void>
  signUp:      (name: string, email: string, password: string, role: 'doctor' | 'radiologist') => Promise<void>
  signOut:     () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const p = await getUserProfile(firebaseUser.uid)
        setProfile(p)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (
    name: string, email: string,
    password: string, role: 'doctor' | 'radiologist'
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await saveUserProfile(cred.user.uid, name, email, role)
    setProfile({ name, email, role })
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
