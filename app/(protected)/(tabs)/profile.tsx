import React, { useEffect, useState } from 'react'
import {
    Alert,
    Image,
    Keyboard,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native'
import { Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import Constants from 'expo-constants'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase.client'

interface ProfileData {
    username: string
    website: string
    github_url: string
    avatar_url: string
    github_connected: boolean
    github_username?: string
    github_installation_id?: string
    github_access_token?: string
    github_token_expires_at?: string
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
                <View style={styles.fieldValueContainer}>
                    <Text
                        style={[
                            styles.fieldValue,
                            readOnly && styles.fieldValueReadOnly,
                            !value && styles.fieldValuePlaceholder,
                        ]}
                    >
                        {value || placeholder}
                    </Text>
                    {readOnly && (
                        <MaterialCommunityIcons
                            name="lock"
                            size={12}
                            color="#666666"
                            style={styles.fieldLockIcon}
                        />
                    )}
                </View>
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

const AvatarAndNameField: React.FC<{
    avatarUrl: string | null
    username: string
    onStartEdit: () => void
    isEditing: boolean
    onEdit: (value: string) => void
    placeholder: string
}> = ({ avatarUrl, username, onStartEdit, isEditing, onEdit, placeholder }) => {
    const initials = username
        ? username
              .split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
        : '?'

    return (
        <Pressable onPress={onStartEdit} style={styles.avatarContainer}>
            {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
                <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
            )}
            <View style={styles.nameContainer}>
                <Text style={styles.fieldLabel}>Name</Text>
                {isEditing ? (
                    <TextInput
                        value={username}
                        onChangeText={onEdit}
                        style={styles.fieldInput}
                        autoFocus
                        autoCapitalize="none"
                    />
                ) : (
                    <Text
                        style={[
                            styles.fieldValue,
                            !username && styles.fieldValuePlaceholder,
                        ]}
                    >
                        {username || placeholder}
                    </Text>
                )}
            </View>
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

const GitHubConnectionSection: React.FC<{
    isConnected: boolean
    username?: string
    onConnect: () => void
    onDisconnect: () => void
}> = ({ isConnected, username, onConnect, onDisconnect }) => {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                    name="github"
                    size={20}
                    color="#FFFFFF"
                />
                <Text style={styles.sectionTitle}>GitHub Connection</Text>
            </View>
            {isConnected ? (
                <>
                    <View style={styles.githubConnectedContainer}>
                        <View style={styles.githubStatusContainer}>
                            <MaterialCommunityIcons
                                name="check-circle"
                                size={20}
                                color="#4CAF50"
                            />
                            <Text style={styles.githubConnectedText}>
                                Connected as {username}
                            </Text>
                        </View>
                        <Pressable
                            onPress={onDisconnect}
                            style={({ pressed }) => [
                                styles.githubButton,
                                styles.githubDisconnectButton,
                                pressed && styles.githubButtonPressed,
                            ]}
                        >
                            <Text style={styles.githubDisconnectButtonText}>
                                Disconnect
                            </Text>
                        </Pressable>
                    </View>
                </>
            ) : (
                <View style={styles.githubConnectContainer}>
                    <Text style={styles.githubDescription}>
                        Connect your GitHub account to access your repositories
                        and collaborate with your team.
                    </Text>
                    <Pressable
                        onPress={onConnect}
                        style={({ pressed }) => [
                            styles.githubButton,
                            pressed && styles.githubButtonPressed,
                        ]}
                    >
                        <Text style={styles.githubButtonText}>
                            Connect GitHub Account
                        </Text>
                    </Pressable>
                </View>
            )}
        </View>
    )
}

const ProfileSection: React.FC<{
    title: string
    icon: keyof typeof MaterialCommunityIcons.glyphMap
    children: React.ReactNode
}> = ({ title, icon, children }) => {
    return (
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name={icon} size={20} color="#FFFFFF" />
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            {children}
        </View>
    )
}

export default function ProfileScreen() {
    const [session, setSession] = useState<Session | null>(null)
    const [profileData, setProfileData] = useState<ProfileData>({
        username: '',
        website: '',
        github_url: '',
        avatar_url: '',
        github_connected: false,
    })
    const [editingField, setEditingField] = useState<keyof ProfileData | null>(
        null,
    )
    const [tempValue, setTempValue] = useState('')
    const [, setIsConnectingGitHub] = useState(false)

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
                .select(
                    'username, website, github_url, avatar_url, github_connected, github_username, github_installation_id, github_access_token, github_token_expires_at',
                )
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
        setTempValue(String(profileData[field] ?? ''))
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

    const handleConnectGitHub = async () => {
        if (!session?.user.id) return

        try {
            setIsConnectingGitHub(true)

            // GitHub OAuth configuration
            const githubConfig = {
                clientId: Constants.expoConfig?.extra
                    ?.githubOAuthClientId as string,
            }

            if (!githubConfig.clientId) {
                throw new Error('GitHub OAuth configuration is missing')
            }

            // Construct the GitHub OAuth URL with necessary scopes
            const authUrl =
                `https://github.com/login/oauth/authorize?` +
                `client_id=${encodeURIComponent(githubConfig.clientId)}` +
                `&redirect_uri=${encodeURIComponent('snippets://auth/callback')}` +
                `&state=${encodeURIComponent(session.user.id)}` +
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
            setIsConnectingGitHub(false)
        }
    }

    const handleDisconnectGitHub = async () => {
        if (!session?.user.id) return

        try {
            // Remove the GitHub App installation
            if (profileData.github_installation_id) {
                // TODO: Call GitHub API to delete the installation
                // This should be done through a secure backend function
            }

            // Update the profile to remove GitHub connection
            const { error } = await supabase
                .from('profiles')
                .update({
                    github_connected: false,
                    github_username: null,
                    github_installation_id: null,
                    github_access_token: null,
                    github_token_expires_at: null,
                })
                .eq('id', session.user.id)

            if (error) throw error

            // Update local state
            setProfileData(prev => ({
                ...prev,
                github_connected: false,
                github_username: undefined,
                github_installation_id: undefined,
                github_access_token: undefined,
                github_token_expires_at: undefined,
            }))
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

    if (!session) return null

    const hasChanges = editingField
        ? tempValue !== profileData[editingField]
        : false

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <StatusBar style="light" />
            {editingField ? (
                <NavigationBar
                    title="Profile"
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
                <ProfileSection title="Account" icon="account">
                    <View style={styles.sectionContent}>
                        <AvatarAndNameField
                            avatarUrl={profileData.avatar_url}
                            username={
                                editingField === 'username'
                                    ? tempValue
                                    : profileData.username
                            }
                            onStartEdit={() => handleStartEdit('username')}
                            isEditing={editingField === 'username'}
                            onEdit={setTempValue}
                            placeholder="Enter your name"
                        />
                        <View style={styles.divider} />
                        <ProfileField
                            label="Email"
                            value={session.user.email || 'No email'}
                            readOnly
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
                    </View>
                </ProfileSection>

                <GitHubConnectionSection
                    isConnected={profileData.github_connected || false}
                    username={profileData.github_username}
                    onConnect={handleConnectGitHub}
                    onDisconnect={handleDisconnectGitHub}
                />

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
        marginHorizontal: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    sectionWithGap: {
        marginTop: 20,
    },
    fieldContainer: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    fieldContainerReadOnly: {
        backgroundColor: '#1C1C1E',
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
        color: '#999999',
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
        marginHorizontal: 16,
        backgroundColor: '#1C1C1E',
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
    },
    signOutButtonPressed: {
        opacity: 0.7,
    },
    signOutText: {
        color: '#FF453A',
        fontSize: 17,
        fontWeight: '400',
    },
    avatarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#2C2C2E',
    },
    avatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#2C2C2E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitials: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '500',
    },
    nameContainer: {
        flex: 1,
        marginLeft: 16,
        justifyContent: 'center',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333333',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    githubConnectedContainer: {
        padding: 16,
    },
    githubConnectContainer: {
        padding: 16,
        gap: 16,
    },
    githubStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    githubConnectedText: {
        fontSize: 15,
        color: '#FFFFFF',
    },
    githubDescription: {
        fontSize: 15,
        color: '#8E8E93',
        lineHeight: 20,
    },
    githubButton: {
        backgroundColor: '#2C2C2E',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    githubButtonPressed: {
        opacity: 0.7,
    },
    githubButtonText: {
        color: '#0A84FF',
        fontSize: 17,
        fontWeight: '500',
    },
    githubDisconnectButton: {
        backgroundColor: '#2C2C2E',
    },
    githubDisconnectButtonText: {
        color: '#FF453A',
        fontSize: 17,
        fontWeight: '500',
    },
    sectionContent: {
        padding: 16,
    },
    fieldValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    fieldLockIcon: {
        marginTop: 1,
    },
})
