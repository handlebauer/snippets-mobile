import React from 'react'
import {
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

import { STATUS_MESSAGES } from '@/constants/webrtc'

import { useRecordButton } from '@/hooks/use-record-button'

import type { ScreenShareState } from '@/types/webrtc'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface ScreenShareViewerProps {
    state: ScreenShareState
    onStartSession: () => void
    onReset: () => void
    channel: RealtimeChannel | null
}

export function ScreenShareViewer({
    state,
    onStartSession,
    onReset,
    channel,
}: ScreenShareViewerProps) {
    const spinValue = React.useRef(new Animated.Value(0)).current

    const handleRecordPress = React.useCallback(
        (isRecording: boolean) => {
            console.log('🎬 Record button pressed:', {
                isRecording,
                hasSessionCode: !!state.sessionCode,
                hasChannel: !!channel,
                channelState: channel?.state,
            })

            if (!state.sessionCode || !channel) {
                console.error('❌ Cannot record: missing requirements:', {
                    hasSessionCode: !!state.sessionCode,
                    hasChannel: !!channel,
                })
                return
            }

            // Send recording control signal through the existing channel
            console.log('📤 Sending recording control signal:', {
                action: isRecording ? 'start' : 'stop',
                sessionCode: state.sessionCode,
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
        [state.sessionCode, channel],
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

        if (state.statusMessage) {
            spinAnimation.start()
        } else {
            spinAnimation.stop()
        }

        return () => spinAnimation.stop()
    }, [state.statusMessage, spinValue])

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    })

    if (!state.sessionCode) {
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

    if (state.streamURL) {
        return (
            <View style={styles.fullScreen}>
                <StatusBar
                    translucent={true}
                    backgroundColor="transparent"
                    barStyle="light-content"
                />
                <View style={styles.streamContainer}>
                    <RTCView
                        streamURL={state.streamURL}
                        style={styles.stream}
                        objectFit="cover"
                    />
                    <View style={styles.recordButtonContainer}>
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
                                {state.sessionCode}
                            </Text>
                            {state.statusMessage && (
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
                                        {state.statusMessage}
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

                        {state.statusMessage === STATUS_MESSAGES.ENDED && (
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
    stream: {
        flex: 1,
    },
    recordButtonContainer: {
        position: 'absolute',
        bottom: 48,
        width: '100%',
        alignItems: 'center',
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
})
