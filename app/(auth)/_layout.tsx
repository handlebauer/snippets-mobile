import { Stack } from 'expo-router'

export default function AuthLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: true,
                headerTitle: 'Sign In',
                headerStyle: {
                    backgroundColor: 'transparent',
                },
                headerShadowVisible: false,
            }}
        />
    )
}
