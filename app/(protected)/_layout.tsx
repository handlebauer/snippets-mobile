import { useEffect } from 'react'

import { router, Stack } from 'expo-router'

import { StreamProvider } from '@/contexts/recording.context'
import { useSupabase } from '@/contexts/supabase.context'

export default function ProtectedLayout() {
    const { session } = useSupabase()

    useEffect(() => {
        if (!session) {
            // Redirect to auth route when no session exists
            router.replace('/(auth)')
        }
    }, [session])

    // Don't render protected routes if not authenticated
    if (!session) return null

    return (
        <StreamProvider>
            <Stack
                screenOptions={{
                    headerShown: false,
                }}
            >
                <Stack.Screen
                    name="(tabs)"
                    options={{
                        headerShown: false,
                        orientation: 'all',
                    }}
                />
                <Stack.Screen
                    name="video-editor/[id]"
                    options={{
                        animation: 'slide_from_right',
                        headerShown: false,
                        presentation: 'card',
                        orientation: 'all',
                        gestureEnabled: true,
                    }}
                />
            </Stack>
        </StreamProvider>
    )
}
