import { useEffect, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { Button, TextInput } from 'react-native-paper'

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

    return (
        <View style={styles.container}>
            <View style={[styles.verticallySpaced, styles.mt20]}>
                <TextInput
                    label="Email"
                    mode="outlined"
                    value={session?.user?.email}
                    disabled
                />
            </View>
            <View style={styles.verticallySpaced}>
                <TextInput
                    label="Username"
                    mode="outlined"
                    value={username || ''}
                    onChangeText={(text: string) => setUsername(text)}
                />
            </View>
            <View style={styles.verticallySpaced}>
                <TextInput
                    label="Website"
                    mode="outlined"
                    value={website || ''}
                    onChangeText={(text: string) => setWebsite(text)}
                />
            </View>

            <View style={[styles.verticallySpaced, styles.mt20]}>
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
                >
                    {loading ? 'Loading ...' : 'Update'}
                </Button>
            </View>

            <View style={styles.verticallySpaced}>
                <Button mode="outlined" onPress={() => supabase.auth.signOut()}>
                    Sign Out
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
