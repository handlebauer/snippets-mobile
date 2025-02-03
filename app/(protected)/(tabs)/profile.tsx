import React, { useEffect, useState } from 'react'
import {
    ActionSheetIOS,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native'
import { ActivityIndicator, Divider, Text, useTheme } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import { router } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase.client'

interface ProfileData {
    username: string
    website: string
}

interface ProfileFieldProps {
    icon: string
    label: string
    value: string
    onPress?: () => void
    editable?: boolean
    isLast?: boolean
}

const ProfileField: React.FC<ProfileFieldProps> = ({
    icon,
    label,
    value,
    onPress,
    editable = false,
    isLast = false,
}) => {
    const theme = useTheme()

    return (
        <>
            <Pressable
                onPress={editable ? onPress : undefined}
                style={({ pressed }) => [
                    styles.fieldContainer,
                    {
                        backgroundColor: theme.colors.surface,
                    },
                    pressed &&
                        editable && {
                            backgroundColor: theme.colors.surfaceVariant,
                        },
                ]}
            >
                <MaterialCommunityIcons
                    name={icon as any}
                    size={22}
                    color={theme.colors.primary}
                    style={styles.fieldIcon}
                />
                <View style={styles.fieldTextContainer}>
                    <Text
                        variant="bodyMedium"
                        style={[
                            styles.fieldLabel,
                            { color: theme.colors.onSurface },
                        ]}
                    >
                        {label}
                    </Text>
                    <Text
                        variant="bodyMedium"
                        style={[
                            styles.fieldValue,
                            {
                                color: editable
                                    ? theme.colors.primary
                                    : theme.colors.onSurfaceVariant,
                            },
                        ]}
                    >
                        {value}
                    </Text>
                </View>
                {editable && (
                    <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={theme.colors.onSurfaceVariant}
                        style={styles.chevron}
                    />
                )}
            </Pressable>
            {!isLast && <Divider style={{ marginLeft: 56 }} />}
        </>
    )
}

export default function ProfileScreen() {
    const [session, setSession] = useState<Session | null>(null)
    const [profileData, setProfileData] = useState<ProfileData>({
        username: '',
        website: '',
    })
    const [loading, setLoading] = useState(false)
    const theme = useTheme()

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            if (session?.user.id) {
                fetchProfile(session.user.id)
            }
        })
    }, [])

    const fetchProfile = async (userId: string) => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('profiles')
                .select('username, website')
                .eq('id', userId)
                .single()

            if (error) throw error
            if (data) setProfileData(data)
        } catch (error) {
            console.error('Error fetching profile:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateProfile = async () => {
        if (!session?.user.id) return

        try {
            setLoading(true)
            const { error } = await supabase.from('profiles').upsert({
                id: session.user.id,
                ...profileData,
                updated_at: new Date().toISOString(),
            })

            if (error) throw error
        } catch (error) {
            console.error('Error updating profile:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSignOut = async () => {
        try {
            setLoading(true)
            await supabase.auth.signOut()
            router.replace('/(auth)')
        } catch (error) {
            console.error('Error signing out:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleFieldEdit = (field: 'username' | 'website') => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    title: `Edit ${field[0].toUpperCase() + field.slice(1)}`,
                    message: `Current ${field}: ${profileData[field] || 'Not set'}`,
                    options: ['Edit', 'Cancel'],
                    cancelButtonIndex: 1,
                },
                buttonIndex => {
                    if (buttonIndex === 0) {
                        Alert.prompt(
                            `Enter ${field}`,
                            `Update your ${field}`,
                            [
                                {
                                    text: 'Cancel',
                                    style: 'cancel',
                                },
                                {
                                    text: 'Save',
                                    onPress: (value?: string) => {
                                        if (value) {
                                            setProfileData(prev => ({
                                                ...prev,
                                                [field]: value,
                                            }))
                                        }
                                    },
                                },
                            ],
                            'plain-text',
                            profileData[field],
                        )
                    }
                },
            )
        }
        // Add Android implementation here if needed
    }

    if (!session) return null

    return (
        <SafeAreaView
            style={[
                styles.safeArea,
                { backgroundColor: theme.colors.background },
            ]}
            edges={['top']}
        >
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.contentContainer}
            >
                <View style={styles.section}>
                    <Text
                        variant="labelSmall"
                        style={[
                            styles.sectionHeader,
                            { color: theme.colors.primary },
                        ]}
                    >
                        Account Information
                    </Text>
                    <View
                        style={[
                            styles.card,
                            {
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.outline,
                            },
                        ]}
                    >
                        <ProfileField
                            icon="email"
                            label="Email"
                            value={session.user.email || 'No email'}
                            editable={false}
                        />
                        <ProfileField
                            icon="account"
                            label="Username"
                            value={profileData.username || 'Set username'}
                            onPress={() => handleFieldEdit('username')}
                            editable
                        />
                        <ProfileField
                            icon="web"
                            label="Website"
                            value={profileData.website || 'Add website'}
                            onPress={() => handleFieldEdit('website')}
                            editable
                            isLast
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.buttonContainer}>
                        <Pressable
                            onPress={handleUpdateProfile}
                            disabled={loading}
                            style={({ pressed }) => [
                                styles.button,
                                {
                                    backgroundColor: theme.colors.primary,
                                    opacity: pressed || loading ? 0.8 : 1,
                                },
                            ]}
                        >
                            {loading ? (
                                <ActivityIndicator
                                    color={theme.colors.onPrimary}
                                />
                            ) : (
                                <Text
                                    style={[
                                        styles.buttonText,
                                        { color: theme.colors.onPrimary },
                                    ]}
                                >
                                    Save Changes
                                </Text>
                            )}
                        </Pressable>

                        <Pressable
                            onPress={handleSignOut}
                            disabled={loading}
                            style={({ pressed }) => [
                                styles.button,
                                styles.destructiveButton,
                                {
                                    opacity: pressed || loading ? 0.8 : 1,
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.buttonText,
                                    { color: theme.colors.outline },
                                ]}
                            >
                                Sign Out
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingTop: 16,
    },
    section: {
        paddingHorizontal: 16,
        paddingTop: 24,
    },
    sectionHeader: {
        marginBottom: 8,
        marginLeft: 16,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    card: {
        borderRadius: 10,
        borderWidth: 1,
        overflow: 'hidden',
    },
    fieldContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    fieldIcon: {
        marginRight: 12,
        width: 28,
    },
    fieldTextContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    fieldLabel: {
        fontWeight: '400',
    },
    fieldValue: {
        marginLeft: 8,
    },
    chevron: {
        marginLeft: 8,
    },
    buttonContainer: {
        gap: 8,
    },
    button: {
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    destructiveButton: {
        backgroundColor: 'transparent',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
})
