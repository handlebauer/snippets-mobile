import { createContext, useContext, useEffect, useState } from 'react'

import { SplashScreen } from 'expo-router'

import { Session, User } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase.client'

SplashScreen.preventAutoHideAsync()

type SupabaseContextProps = {
    user: User | null
    session: Session | null
    initialized?: boolean
    signUp: (email: string, password: string) => Promise<void>
    signInWithPassword: (email: string, password: string) => Promise<void>
    signOut: () => Promise<void>
}

type SupabaseProviderProps = {
    children: React.ReactNode
}

const SupabaseContext = createContext<SupabaseContextProps>({
    user: null,
    session: null,
    initialized: false,
    signUp: async () => {},
    signInWithPassword: async () => {},
    signOut: async () => {},
})

export const useSupabase = () => useContext(SupabaseContext)

export function SupabaseProvider({ children }: SupabaseProviderProps) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [initialized, setInitialized] = useState<boolean>(false)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            setInitialized(true)
        })

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [])

    useEffect(() => {
        if (initialized) {
            setTimeout(() => {
                SplashScreen.hideAsync()
            }, 500)
        }
    }, [initialized])

    const signUp = async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
        })
        if (error) throw error
    }

    const signInWithPassword = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        if (error) throw error
    }

    const signOut = async () => {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
    }

    return (
        <SupabaseContext.Provider
            value={{
                user,
                session,
                initialized,
                signUp,
                signInWithPassword,
                signOut,
            }}
        >
            {children}
        </SupabaseContext.Provider>
    )
}
