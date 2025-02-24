import React, { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'

import Constants from 'expo-constants'
import { router, useLocalSearchParams } from 'expo-router'

import { supabase } from '@/lib/supabase.client'

interface GitHubState {
    userId: string
    returnPath: string
}

export default function GitHubCallback() {
    const params = useLocalSearchParams()

    useEffect(() => {
        async function handleCallback() {
            try {
                // Get the code and state from URL params
                const { code, state } = params

                if (!code || !state) {
                    throw new Error('Missing code or state')
                }

                // Parse state parameter
                const parsedState = JSON.parse(
                    decodeURIComponent(state as string),
                ) as GitHubState

                // Verify state matches the user ID we sent
                const {
                    data: { session },
                } = await supabase.auth.getSession()
                if (!session || parsedState.userId !== session.user.id) {
                    throw new Error('Invalid state parameter')
                }

                // Exchange code for access token
                const tokenResponse = await fetch(
                    'https://github.com/login/oauth/access_token',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                        },
                        body: JSON.stringify({
                            client_id:
                                Constants.expoConfig?.extra
                                    ?.githubOAuthClientId,
                            client_secret:
                                Constants.expoConfig?.extra
                                    ?.githubOAuthClientSecret,
                            code,
                        }),
                    },
                )

                console.log('Token response status:', tokenResponse.status)
                const tokenData = await tokenResponse.json()
                console.log('Token response data:', tokenData)

                if (!tokenData.access_token) {
                    throw new Error(
                        `Failed to get access token: ${JSON.stringify(tokenData)}`,
                    )
                }

                // Fetch user data from GitHub
                const userResponse = await fetch(
                    'https://api.github.com/user',
                    {
                        headers: {
                            Authorization: `Bearer ${tokenData.access_token}`,
                            Accept: 'application/vnd.github.v3+json',
                        },
                    },
                )

                const userData = await userResponse.json()
                if (!userData.login) {
                    throw new Error('Failed to get GitHub user data')
                }

                // Update profile with GitHub data
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        github_connected: true,
                        github_username: userData.login,
                        github_access_token: tokenData.access_token,
                        github_token_expires_at: tokenData.expires_in
                            ? new Date(
                                  Date.now() + tokenData.expires_in * 1000,
                              ).toISOString()
                            : null,
                    })
                    .eq('id', session.user.id)

                if (updateError) throw updateError

                // Navigate back to the originating tab
                // @ts-expect-error - router.replace is typed by expo router and does not accept our custom returnPath
                router.replace(parsedState.returnPath)
            } catch (error) {
                console.error('Error handling GitHub callback:', error)
                // Navigate back to profile with error
                router.replace('/(protected)/(tabs)/profile')
            }
        }

        handleCallback()
    }, [params])

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#0A84FF" />
            <Text style={styles.text}>Connecting to GitHub...</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    text: {
        color: '#FFFFFF',
        fontSize: 16,
    },
})
