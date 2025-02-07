import React from 'react'
import {
    Alert,
    Animated,
    Easing,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    View,
} from 'react-native'
import { Button, Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'
import { RTCView } from 'react-native-webrtc'

import { MaterialCommunityIcons } from '@expo/vector-icons'

import { PostRecordingView } from '@/components/post-recording-view'
import { RecordingTimer } from '@/components/recording-timer'
import { STATUS_MESSAGES } from '@/constants/webrtc'
import { useStream } from '@/contexts/recording.context'

import { useRecordButton } from '@/hooks/use-record-button'
import { useScreenOrientation } from '@/hooks/use-screen-orientation'

import type { ScreenShareState } from '@/types/webrtc'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface ScreenShareViewerProps {
    state: ScreenShareState
    onStartSession: () => void
    onReset: () => void
    channel: RealtimeChannel | null
}

// Development-only mock data
const DEV_MOCK_STATES = {
    PAIRED: {
        sessionCode: 'DEV123',
        statusMessage: 'Development Mode',
    },
    STREAMING: {
        sessionCode: 'DEV123',
        streamURL: 'dev://mock-stream',
    },
} as const

export function ScreenShareViewer({
    state,
    onStartSession,
    onReset,
    channel,
}: ScreenShareViewerProps) {
    const { setIsStreaming, setRecordingStartTime } = useStream()
    const { isLandscape, lockToPortrait, unlockOrientation } =
        useScreenOrientation()
    const spinValue = React.useRef(new Animated.Value(0)).current
    const [devMode, setDevMode] = React.useState<
        keyof typeof DEV_MOCK_STATES | null
    >(null)

    // Lock to portrait by default, unlock when streaming
    React.useEffect(() => {
        if (state.streamURL) {
            unlockOrientation()
        } else {
            lockToPortrait()
        }
    }, [state.streamURL, lockToPortrait, unlockOrientation])

    // Update streaming state when stream URL changes
    React.useEffect(() => {
        setIsStreaming(!!state.streamURL)
    }, [state.streamURL, setIsStreaming])

    console.log('🔄 isLandscape', isLandscape)

    // Development mode handler
    const handleDevModeActivation = React.useCallback(() => {
        if (__DEV__) {
            Alert.alert(
                'Development Mode',
                'Choose a viewer state to preview:',
                [
                    {
                        text: 'Paired (Code Screen)',
                        onPress: () => setDevMode('PAIRED'),
                    },
                    {
                        text: 'Streaming',
                        onPress: () => setDevMode('STREAMING'),
                    },
                    {
                        text: 'Normal Mode',
                        onPress: () => setDevMode(null),
                        style: 'cancel',
                    },
                ],
                { cancelable: true },
            )
        }
    }, [])

    // Merge real state with dev mode state if active
    const effectiveState = React.useMemo(() => {
        if (__DEV__ && devMode) {
            return {
                ...state,
                ...DEV_MOCK_STATES[devMode],
            }
        }
        return state
    }, [state, devMode])

    const handleRecordPress = React.useCallback(
        (isRecording: boolean) => {
            console.log('🎬 Record button pressed:', {
                isRecording,
                hasSessionCode: !!effectiveState.sessionCode,
                hasChannel: !!channel,
                channelState: channel?.state,
            })

            if (!effectiveState.sessionCode || !channel) {
                console.error('❌ Cannot record: missing requirements:', {
                    hasSessionCode: !!effectiveState.sessionCode,
                    hasChannel: !!channel,
                })
                return
            }

            // Update recording start time
            setRecordingStartTime(isRecording ? Date.now() : null)

            // Send recording control signal through the existing channel
            console.log('📤 Sending recording control signal:', {
                action: isRecording ? 'start' : 'stop',
                sessionCode: effectiveState.sessionCode,
            })

            channel
                .send({
                    type: 'broadcast',
                    event: 'recording',
                    payload: {
                        type: 'recording',
                        action: isRecording ? 'start' : 'stop',
                    },
                })
                .then(() => {
                    console.log('✅ Recording control signal sent successfully')
                })
                .catch(error => {
                    console.error(
                        '❌ Failed to send recording control signal:',
                        error,
                    )
                })
        },
        [effectiveState.sessionCode, channel, setRecordingStartTime],
    )

    const {
        // isRecording,
        innerStyle,
        handleRecordPress: onRecordButtonPress,
    } = useRecordButton({
        onRecordPress: handleRecordPress,
    })

    React.useEffect(() => {
        const spinAnimation = Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1000,
                easing: Easing.linear,
                useNativeDriver: true,
            }),
        )

        if (effectiveState.statusMessage) {
            spinAnimation.start()
        } else {
            spinAnimation.stop()
        }

        return () => spinAnimation.stop()
    }, [effectiveState.statusMessage, spinValue])

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    })

    // Log video processing state changes
    React.useEffect(() => {
        if (state.videoProcessing) {
            console.log(
                '🎬 Video processing state changed in ScreenShareViewer:',
                {
                    status: state.videoProcessing.status,
                    videoId: state.videoProcessing.videoId,
                    error: state.videoProcessing.error,
                    hasStreamURL: !!state.streamURL,
                    hasSessionCode: !!state.sessionCode,
                },
            )
        }
    }, [state.videoProcessing])

    // If video is being processed, show the post-recording view
    if (state.videoProcessing) {
        console.log('🔄 Transitioning to PostRecordingView:', {
            status: state.videoProcessing.status,
            videoId: state.videoProcessing.videoId,
        })
        return (
            <PostRecordingView
                videoProcessing={{
                    type: 'video_processing',
                    ...state.videoProcessing,
                }}
                onClose={() => {
                    console.log('🔄 PostRecordingView close requested')
                    onReset()
                }}
            />
        )
    }

    if (!effectiveState.sessionCode) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.container}>
                    <View style={styles.contentContainer}>
                        <View style={styles.card}>
                            <MaterialCommunityIcons
                                name="laptop"
                                size={48}
                                color="#FFFFFF"
                                style={styles.icon}
                            />
                            <Text variant="titleLarge" style={styles.subtitle}>
                                Connect Device
                            </Text>
                            <Text
                                variant="bodyLarge"
                                style={styles.description}
                            >
                                Start a new recording session
                            </Text>
                            <Button
                                mode="contained"
                                onPress={onStartSession}
                                onLongPress={handleDevModeActivation}
                                delayLongPress={800}
                                style={styles.button}
                                contentStyle={styles.buttonContent}
                                buttonColor="#2A2A2A"
                                textColor="#FFFFFF"
                            >
                                Start Session
                            </Button>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        )
    }

    if (effectiveState.streamURL) {
        return (
            <View style={styles.fullScreen}>
                <StatusBar
                    translucent={true}
                    backgroundColor="transparent"
                    barStyle="light-content"
                    hidden={isLandscape}
                />
                <RecordingTimer />
                <Pressable
                    style={[
                        styles.exitButton,
                        isLandscape && styles.exitButtonLandscape,
                    ]}
                    onPress={onReset}
                >
                    <MaterialCommunityIcons
                        name="chevron-left"
                        size={28}
                        color="#FFFFFF"
                    />
                </Pressable>
                <View
                    style={[
                        styles.streamContainer,
                        isLandscape && styles.streamContainerLandscape,
                    ]}
                >
                    {__DEV__ && devMode === 'STREAMING' ? (
                        <View style={styles.devModeStreamPlaceholder}>
                            <Text style={styles.devModeText}>
                                Development Mode{'\n'}Mock Stream View
                            </Text>
                        </View>
                    ) : (
                        <RTCView
                            streamURL={effectiveState.streamURL}
                            style={styles.stream}
                            objectFit="cover"
                        />
                    )}
                    <View
                        style={[
                            styles.recordButtonContainer,
                            isLandscape &&
                                styles.recordButtonContainerLandscape,
                        ]}
                    >
                        <View style={styles.recordButton}>
                            <Animated.View style={innerStyle}>
                                <Pressable
                                    onPress={onRecordButtonPress}
                                    style={StyleSheet.absoluteFill}
                                />
                            </Animated.View>
                        </View>
                    </View>
                </View>
            </View>
        )
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.container}>
                <View style={styles.contentContainer}>
                    <View style={styles.card}>
                        <MaterialCommunityIcons
                            name="laptop"
                            size={48}
                            color="#FFFFFF"
                            style={styles.icon}
                        />
                        <Text variant="titleLarge" style={styles.subtitle}>
                            Your Code
                        </Text>
                        <View style={styles.codeContainer}>
                            <Text
                                variant="headlineLarge"
                                style={styles.codeText}
                            >
                                {effectiveState.sessionCode}
                            </Text>
                            {effectiveState.statusMessage && (
                                <View style={styles.statusContainer}>
                                    <Animated.View
                                        style={{
                                            transform: [{ rotate: spin }],
                                        }}
                                    >
                                        <MaterialCommunityIcons
                                            name="loading"
                                            size={14}
                                            color="#CCCCCC"
                                        />
                                    </Animated.View>
                                    <Text style={styles.statusText}>
                                        {effectiveState.statusMessage}
                                    </Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.urlContainer}>
                            <MaterialCommunityIcons
                                name="link"
                                size={20}
                                color="#CCCCCC"
                            />
                            <Text style={styles.urlText}>
                                Enter this code at:
                            </Text>
                        </View>
                        <Text style={styles.url}>https://snippet.is</Text>

                        {effectiveState.statusMessage ===
                            STATUS_MESSAGES.ENDED && (
                            <Button
                                mode="outlined"
                                onPress={onReset}
                                style={styles.button}
                                contentStyle={styles.buttonContent}
                            >
                                New Session
                            </Button>
                        )}
                    </View>
                </View>
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    fullScreen: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000',
    },
    safeArea: {
        flex: 1,
        width: '100%',
    },
    container: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    contentContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    card: {
        width: '100%',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        padding: 24,
    },
    icon: {
        marginVertical: 20,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 28,
        fontFamily: 'monospace',
        marginBottom: 24,
    },
    subtitle: {
        color: '#FFFFFF',
        fontSize: 24,
        marginBottom: 20,
        fontWeight: '600',
    },
    description: {
        color: '#CCCCCC',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 32,
        opacity: 0.7,
        width: '100%',
        paddingHorizontal: 20,
    },
    codeContainer: {
        backgroundColor: '#2A2A2A',
        padding: 20,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center',
        marginVertical: 16,
    },
    codeText: {
        color: '#FFFFFF',
        fontSize: 42,
        fontWeight: '600',
        letterSpacing: 2,
        marginBottom: 12,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        opacity: 0.5,
    },
    statusText: {
        color: '#CCCCCC',
        fontSize: 14,
    },
    urlContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 32,
        gap: 8,
        opacity: 0.5,
    },
    urlText: {
        color: '#CCCCCC',
        fontSize: 14,
    },
    url: {
        color: '#FFFFFF',
        marginTop: 4,
        fontSize: 14,
        fontWeight: '500',
    },
    button: {
        marginTop: 32,
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
    },
    buttonContent: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        backgroundColor: '#2A2A2A',
    },
    streamContainer: {
        flex: 1,
        backgroundColor: '#000',
        marginTop: Platform.OS === 'ios' ? -60 : 0,
    },
    streamContainerLandscape: {
        marginTop: 0,
    },
    stream: {
        flex: 1,
    },
    recordButtonContainer: {
        position: 'absolute',
        bottom: 24,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordButtonContainerLandscape: {
        bottom: 'auto',
        left: 24,
        width: 'auto',
        height: '100%',
        justifyContent: 'center',
    },
    recordButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: '#FFFFFF',
    },
    recordButtonActive: {
        // Remove all styles from here as we want the outer circle to stay consistent
    },
    recordButtonInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FF3B30',
    },
    recordButtonInnerActive: {
        width: 40,
        height: 40,
        borderRadius: 4,
    },
    devModeStreamPlaceholder: {
        flex: 1,
        backgroundColor: '#2A2A2A',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    devModeText: {
        color: '#FFFFFF',
        fontSize: 24,
        textAlign: 'center',
        opacity: 0.7,
    },
    exitButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 64 : 20,
        left: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    exitButtonLandscape: {
        top: 16,
    },
})
