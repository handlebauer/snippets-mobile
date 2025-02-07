import { Stack } from 'expo-router'

import { StreamProvider } from '@/contexts/recording.context'

export default function ProtectedLayout() {
    return (
        <StreamProvider>
            <Stack
                screenOptions={{
                    headerShown: false,
                }}
            >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
