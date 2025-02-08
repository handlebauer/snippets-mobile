import React, { useCallback, useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { GitHubConnectionPrompt } from '@/components/github-connection-prompt'
import { ScreenShareViewer } from '@/components/screen-share-viewer'

import { useGitHubConnection } from '@/hooks/use-github-connection'
import { useWebRTC } from '@/hooks/use-webrtc'

export default function Index() {
    const { state, startSession, resetState, channel } = useWebRTC()
    const { isConnected, isLoading, isConnecting, connectGitHub } =
        useGitHubConnection()

    useEffect(() => {
        console.log('🔄 [Index] state updated:', state)
    }, [state])

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

    return (
        <View style={styles.container}>
            {isConnected ? (
                <ScreenShareViewer
                    state={state}
                    onStartSession={startSession}
                    onReset={resetState}
                    channel={channel?.current}
                />
            ) : (
                <GitHubConnectionPrompt
                    onConnectGitHub={handleConnectGitHub}
                    isConnecting={isConnecting}
                />
            )}
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
    },
})
