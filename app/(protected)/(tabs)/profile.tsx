import React, { useEffect, useState } from 'react'
import {
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native'
import { Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

import { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase.client'

interface ProfileData {
    username: string
    website: string
    github_url: string
}

interface ProfileFieldProps {
    label: string
    value: string
    onEdit?: (value: string) => void
    isEditing?: boolean
    onStartEdit?: () => void
    placeholder?: string
    readOnly?: boolean
}

const ProfileField: React.FC<ProfileFieldProps> = ({
    label,
    value,
    onEdit,
    isEditing,
    onStartEdit,
    placeholder,
    readOnly,
}) => {
    const content = (
        <>
            <Text
                style={[
                    styles.fieldLabel,
                    readOnly && styles.fieldLabelReadOnly,
                ]}
            >
                {label}
            </Text>
            {isEditing ? (
                <TextInput
                    value={value}
                    onChangeText={onEdit}
                    style={styles.fieldInput}
                    autoFocus
                />
            ) : (
                <Text
                    style={[
                        styles.fieldValue,
                        readOnly && styles.fieldValueReadOnly,
                        !value && styles.fieldValuePlaceholder,
                    ]}
                >
                    {value || placeholder}
                </Text>
            )}
        </>
    )

    if (readOnly) {
        return (
            <View
                style={[styles.fieldContainer, styles.fieldContainerReadOnly]}
            >
                {content}
            </View>
        )
    }

    return (
        <Pressable onPress={onStartEdit} style={styles.fieldContainer}>
            {content}
        </Pressable>
    )
}

const NavigationBar = ({
    title,
    onCancel,
    onSave,
    hasChanges,
}: {
    title: string
    onCancel: () => void
    onSave: () => void
    hasChanges: boolean
}) => (
    <View style={styles.navBar}>
        <Pressable onPress={onCancel}>
            <Text style={styles.navCancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.navTitle}>{title}</Text>
        <Pressable onPress={onSave} disabled={!hasChanges}>
            <Text
                style={[styles.navDone, !hasChanges && styles.navDoneDisabled]}
            >
                Done
            </Text>
        </Pressable>
    </View>
)

export default function ProfileScreen() {
    const [session, setSession] = useState<Session | null>(null)
    const [profileData, setProfileData] = useState<ProfileData>({
        username: '',
        website: '',
        github_url: '',
    })
    const [editingField, setEditingField] = useState<keyof ProfileData | null>(
        null,
    )
    const [tempValue, setTempValue] = useState('')

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
            const { data, error } = await supabase
                .from('profiles')
                .select('username, website, github_url')
                .eq('id', userId)
                .single()

            if (error) throw error
            if (data) setProfileData(data)
        } catch (error) {
            console.error('Error fetching profile:', error)
        }
    }

    const handleStartEdit = (field: keyof ProfileData) => {
        setEditingField(field)
        setTempValue(profileData[field])
    }

    const handleSave = async () => {
        if (!session?.user.id || !editingField) return

        try {
            const updates = {
                [editingField]: tempValue,
            }

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', session.user.id)

            if (error) throw error

            setProfileData(prev => ({
                ...prev,
                [editingField]: tempValue,
            }))
        } catch (error) {
            console.error('Error updating profile:', error)
        } finally {
            handleCancel()
        }
    }

    const handleCancel = () => {
        setEditingField(null)
        setTempValue('')
        Keyboard.dismiss()
    }

    const handleSignOut = async () => {
        try {
            await supabase.auth.signOut()
            router.replace('/(auth)')
        } catch (error) {
            console.error('Error signing out:', error)
        }
    }

    if (!session) return null

    const hasChanges = editingField
        ? tempValue !== profileData[editingField]
        : false

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <StatusBar style="light" />
            {editingField ? (
                <NavigationBar
                    title="Edit profile"
                    onCancel={handleCancel}
                    onSave={handleSave}
                    hasChanges={hasChanges}
                />
            ) : (
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Edit profile</Text>
                </View>
            )}
            <ScrollView style={styles.container}>
                <View style={styles.section}>
                    <ProfileField
                        label="Email"
                        value={session.user.email || 'No email'}
                        readOnly
                    />
                </View>

                <View style={[styles.section, styles.sectionWithGap]}>
                    <ProfileField
                        label="Name"
                        value={
                            editingField === 'username'
                                ? tempValue
                                : profileData.username
                        }
                        onEdit={setTempValue}
                        isEditing={editingField === 'username'}
                        onStartEdit={() => handleStartEdit('username')}
                        placeholder="Enter your name"
                    />
                    <View style={styles.divider} />
                    <ProfileField
                        label="Website"
                        value={
                            editingField === 'website'
                                ? tempValue
                                : profileData.website
                        }
                        onEdit={setTempValue}
                        isEditing={editingField === 'website'}
                        onStartEdit={() => handleStartEdit('website')}
                        placeholder="https://example.com"
                    />
                    <View style={styles.divider} />
                    <ProfileField
                        label="GitHub"
                        value={
                            editingField === 'github_url'
                                ? tempValue
                                : profileData.github_url
                        }
                        onEdit={setTempValue}
                        isEditing={editingField === 'github_url'}
                        onStartEdit={() => handleStartEdit('github_url')}
                        placeholder="https://github.com/username"
                    />
                </View>

                <Pressable
                    onPress={handleSignOut}
                    style={({ pressed }) => [
                        styles.signOutButton,
                        pressed && styles.signOutButtonPressed,
                    ]}
                >
                    <Text style={styles.signOutText}>Sign Out</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333333',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    navBar: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333333',
    },
    navCancel: {
        fontSize: 17,
        color: '#FFFFFF',
    },
    navTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    navDone: {
        fontSize: 17,
        fontWeight: '600',
        color: '#0A84FF',
    },
    navDoneDisabled: {
        opacity: 0.5,
    },
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    section: {
        backgroundColor: '#1C1C1E',
        marginTop: 35,
    },
    sectionWithGap: {
        marginTop: 20,
    },
    fieldContainer: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    fieldContainerReadOnly: {
        opacity: 0.8,
    },
    fieldLabel: {
        fontSize: 14,
        color: '#8E8E93',
        marginBottom: 4,
    },
    fieldLabelReadOnly: {
        color: '#666666',
    },
    fieldValue: {
        fontSize: 17,
        color: '#FFFFFF',
    },
    fieldValueReadOnly: {
        color: '#CCCCCC',
    },
    fieldValuePlaceholder: {
        color: '#666666',
        fontStyle: 'italic',
    },
    fieldInput: {
        fontSize: 17,
        color: '#FFFFFF',
        padding: 0,
        margin: 0,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#333333',
        marginLeft: 16,
    },
    signOutButton: {
        marginTop: 35,
        backgroundColor: '#1C1C1E',
        paddingVertical: 12,
        alignItems: 'center',
    },
    signOutButtonPressed: {
        opacity: 0.7,
    },
    signOutText: {
        color: '#FF453A',
        fontSize: 17,
        fontWeight: '400',
    },
})
