import { useEffect } from 'react'
import {
    adaptNavigationTheme,
    MD3DarkTheme,
    MD3LightTheme,
    PaperProvider,
} from 'react-native-paper'

import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import FontAwesome from '@expo/vector-icons/FontAwesome'

import { useColorScheme } from '@/components/use-color-scheme'
import { SupabaseProvider } from '@/contexts/supabase.context'
import {
    DarkTheme as NavigationDarkTheme,
    DefaultTheme as NavigationDefaultTheme,
    ThemeProvider,
} from '@react-navigation/native'

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary,
} from 'expo-router'

export const unstable_settings = {
    initialRouteName: '(auth)',
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
    const [loaded, error] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
        ...FontAwesome.font,
    })

    // Expo Router uses Error Boundaries to catch errors in the navigation tree.
    useEffect(() => {
        if (error) throw error
    }, [error])

    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync()
        }
    }, [loaded])

    const colorScheme = useColorScheme()

    if (!loaded) {
        return null
    }

    const { LightTheme, DarkTheme } = adaptNavigationTheme({
        reactNavigationLight: NavigationDefaultTheme,
        reactNavigationDark: NavigationDarkTheme,
    })

    const combinedLightTheme = {
        ...MD3LightTheme,
        ...LightTheme,
        colors: {
            ...MD3LightTheme.colors,
            ...LightTheme.colors,
        },
        fonts: {
            ...MD3LightTheme.fonts,
            regular: { fontFamily: 'SpaceMono', fontWeight: '400' as const },
            medium: { fontFamily: 'SpaceMono', fontWeight: '500' as const },
            bold: { fontFamily: 'SpaceMono', fontWeight: '700' as const },
            heavy: { fontFamily: 'SpaceMono', fontWeight: '900' as const },
        },
    }

    const combinedDarkTheme = {
        ...MD3DarkTheme,
        ...DarkTheme,
        colors: {
            ...MD3DarkTheme.colors,
            ...DarkTheme.colors,
        },
        fonts: {
            ...MD3DarkTheme.fonts,
            regular: { fontFamily: 'SpaceMono', fontWeight: '400' as const },
            medium: { fontFamily: 'SpaceMono', fontWeight: '500' as const },
            bold: { fontFamily: 'SpaceMono', fontWeight: '700' as const },
            heavy: { fontFamily: 'SpaceMono', fontWeight: '900' as const },
        },
    }

    const theme =
        colorScheme === 'dark' ? combinedDarkTheme : combinedLightTheme

    return (
        <SupabaseProvider>
            <PaperProvider theme={theme}>
                <ThemeProvider value={theme}>
                    <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen
                            name="(auth)"
                            options={{
                                headerShown: false,
                            }}
                        />
                        <Stack.Screen
                            name="(tabs)"
                            options={{ headerShown: false }}
                        />
                    </Stack>
                </ThemeProvider>
            </PaperProvider>
        </SupabaseProvider>
    )
}
