import React from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MaterialCommunityIcons } from '@expo/vector-icons'

interface GitHubConnectionPromptProps {
    onConnectGitHub: () => void
    isConnecting: boolean
}

export function GitHubConnectionPrompt({
    onConnectGitHub,
    isConnecting,
}: GitHubConnectionPromptProps) {
    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.container}>
                <View style={styles.contentContainer}>
                    <View style={styles.card}>
                        <MaterialCommunityIcons
                            name="github"
                            size={48}
                            color="#FFFFFF"
                            style={styles.icon}
                        />
                        <Text variant="titleLarge" style={styles.subtitle}>
                            Connect GitHub
                        </Text>
                        <Text variant="bodyLarge" style={styles.description}>
                            Connect your GitHub account to start recording and
                            sharing your code snippets
                        </Text>
                        <View style={styles.buttonContainer}>
                            {isConnecting ? (
                                <View style={styles.button}>
                                    <ActivityIndicator color="#0A84FF" />
                                </View>
                            ) : (
                                <Text
                                    variant="bodyLarge"
                                    style={styles.button}
                                    onPress={onConnectGitHub}
                                >
                                    Connect GitHub Account
                                </Text>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#121212',
    },
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    card: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    icon: {
        marginBottom: 16,
    },
    subtitle: {
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    description: {
        color: '#8E8E93',
        textAlign: 'center',
        marginBottom: 24,
    },
    buttonContainer: {
        width: '100%',
    },
    button: {
        backgroundColor: '#2C2C2E',
        color: '#0A84FF',
        textAlign: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        overflow: 'hidden',
        fontSize: 17,
        fontWeight: '500',
        minHeight: 48,
        justifyContent: 'center',
    },
})
