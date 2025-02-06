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
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                    }}
                />
            </Stack>
        </StreamProvider>
    )
}
