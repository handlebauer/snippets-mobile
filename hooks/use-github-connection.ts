import { useEffect, useState } from 'react'
import { Alert, Linking } from 'react-native'

import Constants from 'expo-constants'

import { supabase } from '@/lib/supabase.client'

export function useGitHubConnection() {
    const [isConnected, setIsConnected] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isConnecting, setIsConnecting] = useState(false)

    useEffect(() => {
        checkGitHubConnection()

        // Subscribe to changes in the user's profile
        const subscribeToProfile = async () => {
            const { data: session } = await supabase.auth.getSession()
            if (!session.session?.user.id) return

            const channel = supabase
                .channel('profile-changes')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'profiles',
                        filter: `id=eq.${session.session.user.id}`,
                    },
                    payload => {
                        console.log('Profile changed:', payload)
                        // Update connection status when profile changes
                        const newData = payload.new as {
                            github_connected: boolean
                        }
                        setIsConnected(newData.github_connected || false)
                    },
                )
                .subscribe()

            return () => {
                channel.unsubscribe()
            }
        }

        const unsubscribe = subscribeToProfile()

        return () => {
            // Cleanup subscription on unmount
            unsubscribe.then(cleanup => cleanup?.())
        }
    }, [])

    const checkGitHubConnection = async () => {
        try {
            const { data: session } = await supabase.auth.getSession()
            if (!session.session?.user.id) {
                setIsLoading(false)
                return
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('github_connected')
                .eq('id', session.session.user.id)
                .single()

            if (error) throw error
            setIsConnected(data?.github_connected || false)
        } catch (error) {
            console.error('Error checking GitHub connection:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const connectGitHub = async (returnPath?: string) => {
        try {
            setIsConnecting(true)
            const { data: session } = await supabase.auth.getSession()
            if (!session.session?.user.id) return

            // GitHub OAuth configuration
            const githubConfig = {
                clientId: Constants.expoConfig?.extra
                    ?.githubOAuthClientId as string,
            }

            if (!githubConfig.clientId) {
                throw new Error('GitHub OAuth configuration is missing')
            }

            // Create state parameter with user ID and return path
            const state = JSON.stringify({
                userId: session.session.user.id,
                returnPath: returnPath || '/(protected)/(tabs)/profile',
            })

            // Construct the GitHub OAuth URL with necessary scopes
            const authUrl =
                `https://github.com/login/oauth/authorize?` +
                `client_id=${encodeURIComponent(githubConfig.clientId)}` +
                `&redirect_uri=${encodeURIComponent('snippets://auth/callback')}` +
                `&state=${encodeURIComponent(state)}` +
                `&scope=${encodeURIComponent('repo read:user user:email')}`

            // Open GitHub OAuth page
            await Linking.openURL(authUrl)
        } catch (error) {
            console.error('Error connecting to GitHub:', error)
            Alert.alert(
                'GitHub Connection Failed',
                error instanceof Error
                    ? error.message
                    : 'Failed to connect to GitHub',
            )
        } finally {
            setIsConnecting(false)
        }
    }

    const disconnectGitHub = async () => {
        try {
            const { data: session } = await supabase.auth.getSession()
            if (!session.session?.user.id) return

            // Update the profile to remove GitHub connection
            const { error } = await supabase
                .from('profiles')
                .update({
                    github_connected: false,
                    github_username: null,
                    github_access_token: null,
                    github_token_expires_at: null,
                })
                .eq('id', session.session.user.id)

            if (error) throw error

            // Local state will be updated by the realtime subscription
        } catch (error) {
            console.error('Error disconnecting from GitHub:', error)
            Alert.alert(
                'GitHub Disconnection Failed',
                error instanceof Error
                    ? error.message
                    : 'Failed to disconnect from GitHub',
            )
        }
    }

    return {
        isConnected,
        isLoading,
        isConnecting,
        connectGitHub,
        disconnectGitHub,
        checkGitHubConnection,
    }
}
