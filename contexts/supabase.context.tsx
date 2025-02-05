import { createContext, useContext, useEffect, useState } from 'react'
import { Linking } from 'react-native'

import { SplashScreen } from 'expo-router'

import { Provider, Session, User } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase.client'

SplashScreen.preventAutoHideAsync()

type SupabaseProviderProps = {
    children: React.ReactNode
}

export interface SupabaseContextType {
    user: User | null
    session: Session | null
    initialized?: boolean
    signUp: (email: string, password: string, username: string) => Promise<void>
    signInWithPassword: (email: string, password: string) => Promise<void>
    signInWithIdToken: (params: {
        provider: Provider
        token: string
    }) => Promise<void>
    signOut: () => Promise<void>
    signInWithGithub: () => Promise<void>
}

export const SupabaseContext = createContext<SupabaseContextType>({
    user: null,
    session: null,
    initialized: false,
    signUp: async () => {},
    signInWithPassword: async () => {},
    signInWithIdToken: async () => {},
    signOut: async () => {},
    signInWithGithub: async () => {},
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

    const signUp = async (
        email: string,
        password: string,
        username: string,
    ) => {
        const { data: authData, error: authError } = await supabase.auth.signUp(
            {
                email,
                password,
            },
        )
        if (authError) throw authError

        if (authData.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{ id: authData.user.id, username }])

            if (profileError) {
                // If profile creation fails, we should delete the auth user
                await supabase.auth.admin.deleteUser(authData.user.id)
                throw profileError
            }
        }
    }

    const signInWithPassword = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        if (error instanceof Error) throw error
    }

    const signInWithIdToken = async ({
        provider,
        token,
    }: {
        provider: Provider
        token: string
    }) => {
        const { error } = await supabase.auth.signInWithIdToken({
            provider,
            token,
        })
        if (error instanceof Error) throw error
    }

    const signOut = async () => {
        const { error } = await supabase.auth.signOut()
        if (error instanceof Error) throw error
    }

    const signInWithGithub = async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: 'snippets://auth/callback',
                skipBrowserRedirect: true,
            },
        })

        if (error) throw error
        if (!data?.url) throw new Error('No OAuth URL returned')

        try {
            await Linking.openURL(data.url)
        } catch (e) {
            throw e
        }
    }

    const value = {
        user,
        session,
        initialized,
        signUp,
        signInWithPassword,
        signInWithIdToken,
        signOut,
        signInWithGithub,
        supabase,
    }

    return (
        <SupabaseContext.Provider value={value}>
            {children}
        </SupabaseContext.Provider>
    )
}
