import { useEffect, useState } from 'react'
import { Alert, View } from 'react-native'
import { Button, Text, TextInput } from 'react-native-paper'

import { router } from 'expo-router'

import { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase.client'

export function Account({ session }: { session: Session }) {
    const [loading, setLoading] = useState(true)
    const [username, setUsername] = useState('')
    const [website, setWebsite] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')

    useEffect(() => {
        async function getProfile() {
            try {
                setLoading(true)
                if (!session?.user) throw new Error('No user on the session!')

                const { data, error, status } = await supabase
                    .from('profiles')
                    .select(`username, website, avatar_url`)
                    .eq('id', session?.user.id)
                    .single()
                if (error && status !== 406) {
                    throw error
                }

                if (data) {
                    setUsername(data.username)
                    setWebsite(data.website)
                    setAvatarUrl(data.avatar_url)
                }
            } catch (error) {
                if (error instanceof Error) {
                    Alert.alert(error.message)
                }
            } finally {
                setLoading(false)
            }
        }

        if (session) getProfile()
    }, [session])

    async function updateProfile({
        username,
        website,
        avatar_url,
    }: {
        username: string
        website: string
        avatar_url: string
    }) {
        try {
            setLoading(true)
            if (!session?.user) throw new Error('No user on the session!')

            const updates = {
                id: session?.user.id,
                username,
                website,
                avatar_url,
                updated_at: new Date(),
            }

            const { error } = await supabase.from('profiles').upsert(updates)

            if (error) {
                throw error
            }
        } catch (error) {
            if (error instanceof Error) {
                Alert.alert(error.message)
            }
        } finally {
            setLoading(false)
        }
    }

    async function handleSignOut() {
        try {
            await supabase.auth.signOut()
            router.replace('/(auth)')
        } catch (error) {
            if (error instanceof Error) {
                Alert.alert(error.message)
            }
        }
    }

    return (
        <View className="space-y-4 mt-4">
            <View>
                <Text
                    variant="bodySmall"
                    className="text-gray-600 dark:text-gray-400 mb-1 ml-1"
                >
                    Email
                </Text>
                <TextInput
                    mode="outlined"
                    value={session?.user?.email}
                    disabled
                    style={{ backgroundColor: 'transparent' }}
                    left={<TextInput.Icon icon="email" />}
                />
            </View>

            <View>
                <Text
                    variant="bodySmall"
                    className="text-gray-600 dark:text-gray-400 mb-1 ml-1"
                >
                    Username
                </Text>
                <TextInput
                    mode="outlined"
                    value={username || ''}
                    onChangeText={setUsername}
                    placeholder="Enter your username"
                    style={{ backgroundColor: 'transparent' }}
                    left={<TextInput.Icon icon="account" />}
                />
            </View>

            <View>
                <Text
                    variant="bodySmall"
                    className="text-gray-600 dark:text-gray-400 mb-1 ml-1"
                >
                    Website
                </Text>
                <TextInput
                    mode="outlined"
                    value={website || ''}
                    onChangeText={setWebsite}
                    placeholder="Enter your website"
                    style={{ backgroundColor: 'transparent' }}
                    left={<TextInput.Icon icon="web" />}
                />
            </View>

            <View className="mt-6 space-y-3">
                <Button
                    mode="contained"
                    loading={loading}
                    disabled={loading}
                    onPress={() =>
                        updateProfile({
                            username,
                            website,
                            avatar_url: avatarUrl,
                        })
                    }
                    textColor="white"
                    buttonColor="#111"
                    style={{ borderRadius: 0 }}
                >
                    {loading ? 'Updating...' : 'Update Profile'}
                </Button>

                <Button
                    mode="outlined"
                    onPress={handleSignOut}
                    style={{ borderRadius: 0 }}
                >
                    Sign Out
                </Button>
            </View>
        </View>
    )
}
