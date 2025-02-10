import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Button, Text } from 'react-native-paper'

import { MaterialCommunityIcons } from '@expo/vector-icons'

import { CodeEditorViewer } from '@/components/code-editor-viewer'
import { GitHubConnectionPrompt } from '@/components/github-connection-prompt'
import { ScreenShareViewer } from '@/components/screen-share-viewer'

import { useGitHubConnection } from '@/hooks/use-github-connection'
import { useSession } from '@/hooks/use-session'

import type { Database } from '@/lib/supabase.types'

type RecordingSessionType =
    Database['public']['Enums']['recording_session_type']

export default function Index() {
    const { screen: screenSession, editor, setSessionType } = useSession()
    const { isConnected, isLoading, isConnecting, connectGitHub } =
        useGitHubConnection()
    const [selectedType, setSelectedType] =
        useState<RecordingSessionType | null>(null)

    useEffect(() => {
        console.log('🔄 [Index] state updated:', screenSession.state)
    }, [screenSession.state])

    useEffect(() => {
        if (selectedType && !screenSession.state.sessionCode) {
            console.log('🚀 Starting session with type:', selectedType)
            screenSession.startSession()
        }
    }, [selectedType, screenSession])

    const handleTypeSelection = useCallback(
        (type: RecordingSessionType) => {
            console.log('🎯 User selected session type:', type)
            setSelectedType(type)
            setSessionType(type)
        },
        [setSessionType],
    )

    const handleConnectGitHub = useCallback(() => {
        connectGitHub('/(protected)/(tabs)')
    }, [connectGitHub])

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#0A84FF" />
            </View>
        )
    }

    if (!isConnected) {
        return (
            <View style={styles.container}>
                <GitHubConnectionPrompt
                    onConnectGitHub={handleConnectGitHub}
                    isConnecting={isConnecting}
                />
            </View>
        )
    }

    if (screenSession.state.sessionCode) {
        if (selectedType === 'code_editor') {
            const editorState = editor
            return (
                <View style={styles.container}>
                    <CodeEditorViewer
                        sessionCode={screenSession.state.sessionCode}
                        statusMessage={screenSession.state.statusMessage}
                        onReset={() => {
                            screenSession.resetState()
                            setSelectedType(null)
                        }}
                        channel={screenSession.channel?.current}
                        lastEventTime={editorState?.lastEditorEventTime}
                        eventCount={editorState?.editorEventCount}
                    />
                </View>
            )
        }

        return (
            <View style={styles.container}>
                <ScreenShareViewer
                    state={{
                        ...screenSession.state,
                        sessionType: selectedType,
                    }}
                    onStartSession={screenSession.startSession}
                    onReset={() => {
                        screenSession.resetState()
                        setSelectedType(null)
                    }}
                    channel={screenSession.channel?.current}
                />
            </View>
        )
    }

    return (
        <View style={[styles.container, styles.centered]}>
            <View style={styles.card}>
                <MaterialCommunityIcons
                    name="record-circle-outline"
                    size={48}
                    color="#FFFFFF"
                    style={styles.icon}
                />
                <Text variant="titleLarge" style={styles.title}>
                    New Recording
                </Text>
                <Text variant="bodyLarge" style={styles.description}>
                    Choose a recording type to get started
                </Text>
                <View style={styles.buttonContainer}>
                    <Button
                        mode="contained"
                        onPress={() => handleTypeSelection('screen_recording')}
                        style={styles.button}
                        contentStyle={styles.buttonContent}
                        buttonColor="#2A2A2A"
                        textColor="#FFFFFF"
                        icon={() => (
                            <MaterialCommunityIcons
                                name="monitor"
                                size={20}
                                color="#FFFFFF"
                            />
                        )}
                    >
                        Screen Recording
                    </Button>
                    <Button
                        mode="contained"
                        onPress={() => handleTypeSelection('code_editor')}
                        style={styles.button}
                        contentStyle={styles.buttonContent}
                        buttonColor="#2A2A2A"
                        textColor="#FFFFFF"
                        icon={() => (
                            <MaterialCommunityIcons
                                name="code-braces"
                                size={20}
                                color="#FFFFFF"
                            />
                        )}
                    >
                        Code Editor
                    </Button>
                </View>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        alignItems: 'center',
    },
    icon: {
        marginBottom: 16,
    },
    title: {
        color: '#FFFFFF',
        marginBottom: 8,
        textAlign: 'center',
    },
    description: {
        color: '#999999',
        textAlign: 'center',
        marginBottom: 24,
    },
    buttonContainer: {
        width: '100%',
        gap: 12,
    },
    button: {
        width: '100%',
    },
    buttonContent: {
        height: 48,
    },
})
