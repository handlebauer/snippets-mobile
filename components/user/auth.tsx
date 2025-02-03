import React, { useState } from 'react'
import { Alert, View } from 'react-native'
import { Button, Text, TextInput } from 'react-native-paper'

import { router } from 'expo-router'

import { useSupabase } from '@/contexts/supabase.context'

export function Auth() {
    const { signInWithPassword, signUp } = useSupabase()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSignIn() {
        setLoading(true)
        try {
            await signInWithPassword(email, password)
            router.replace('/(protected)/(tabs)')
        } catch (error) {
            if (error instanceof Error) Alert.alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleSignUp() {
        setLoading(true)
        try {
            await signUp(email, password)
            Alert.alert('Please check your inbox for email verification!')
        } catch (error) {
            if (error instanceof Error) Alert.alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <View className="flex-1 bg-white dark:bg-black justify-center px-8">
            <View className="items-center mb-8">
                <Text variant="headlineLarge" className="font-bold">
                    snippets
                </Text>
            </View>

            <View className="space-y-4">
                <TextInput
                    mode="outlined"
                    label="Email"
                    placeholder="Phone number, username or email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    left={<TextInput.Icon icon="email" />}
                    style={{ backgroundColor: 'transparent' }}
                    theme={{
                        colors: {
                            primary: '#3797EF',
                        },
                    }}
                />

                <TextInput
                    mode="outlined"
                    label="Password"
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    left={<TextInput.Icon icon="lock" />}
                    style={{ backgroundColor: 'transparent' }}
                    theme={{
                        colors: {
                            primary: '#3797EF',
                        },
                    }}
                />
            </View>
            <View className="mt-3">
                <Button
                    mode="contained"
                    onPress={handleSignIn}
                    disabled={loading || !email || !password}
                    loading={loading}
                    className="h-12 justify-center"
                    textColor="white"
                    buttonColor="#111"
                    style={{ borderRadius: 0 }}
                >
                    Log in
                </Button>

                <View className="flex-row justify-center items-center mt-4">
                    <Text
                        variant="bodyMedium"
                        className="text-gray-500 dark:text-gray-400"
                    >
                        Don't have an account?{' '}
                    </Text>
                    <Button
                        mode="text"
                        compact
                        onPress={handleSignUp}
                        disabled={loading}
                        textColor="#3797EF"
                    >
                        Sign up
                    </Button>
                </View>

                <Button
                    mode="text"
                    compact
                    onPress={() => {}}
                    className="mt-4"
                    textColor="#3797EF"
                >
                    Forgot password?
                </Button>
            </View>
        </View>
    )
}
