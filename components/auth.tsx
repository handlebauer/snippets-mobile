import React, { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { Button, TextInput } from 'react-native-paper'

import { router } from 'expo-router'

import { useSupabase } from '@/contexts/supabase.context'

export default function Auth() {
    const { signInWithPassword, signUp } = useSupabase()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSignIn() {
        setLoading(true)
        try {
            await signInWithPassword(email, password)
            router.replace('/(tabs)')
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
        <View style={styles.container}>
            <View style={[styles.verticallySpaced, styles.mt20]}>
                <TextInput
                    label="Email"
                    mode="outlined"
                    left={<TextInput.Icon icon="email" />}
                    onChangeText={setEmail}
                    value={email}
                    placeholder="email@address.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                />
            </View>
            <View style={styles.verticallySpaced}>
                <TextInput
                    label="Password"
                    mode="outlined"
                    left={<TextInput.Icon icon="lock" />}
                    onChangeText={setPassword}
                    value={password}
                    secureTextEntry
                    placeholder="Password"
                    autoCapitalize="none"
                />
            </View>
            <View style={[styles.verticallySpaced, styles.mt20]}>
                <Button
                    mode="contained"
                    loading={loading}
                    disabled={loading}
                    onPress={handleSignIn}
                >
                    Sign in
                </Button>
            </View>
            <View style={styles.verticallySpaced}>
                <Button
                    mode="outlined"
                    loading={loading}
                    disabled={loading}
                    onPress={handleSignUp}
                >
                    Sign up
                </Button>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        marginTop: 40,
        padding: 12,
    },
    verticallySpaced: {
        paddingTop: 4,
        paddingBottom: 4,
        alignSelf: 'stretch',
    },
    mt20: {
        marginTop: 20,
    },
})
