import React from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { ActivityIndicator, Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useRouter } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import type { VideoProcessingSignal } from '@/types/webrtc'

interface PostRecordingViewProps {
    videoProcessing: NonNullable<VideoProcessingSignal>
    onClose: () => void
    pairingCode?: string | null
}

export function PostRecordingView({
    videoProcessing,
    pairingCode,
}: PostRecordingViewProps) {
    const router = useRouter()
    const [showSuccess, setShowSuccess] = React.useState(false)
    const fadeAnim = React.useRef(new Animated.Value(0)).current
    const scaleAnim = React.useRef(new Animated.Value(0.9)).current

    // Log when component mounts or updates
    React.useEffect(() => {
        console.log('🎥 PostRecordingView mounted/updated:', {
            status: videoProcessing.status,
            videoId: videoProcessing.videoId,
            hasError: !!videoProcessing.error,
        })

        return () => {
            console.log('👋 PostRecordingView unmounting')
        }
    }, [videoProcessing])

    // Log when status changes
    React.useEffect(() => {
        console.log('📼 Video processing status changed:', {
            status: videoProcessing.status,
            videoId: videoProcessing.videoId,
            error: videoProcessing.error,
        })
    }, [videoProcessing.status])

    // If processing is complete and we have a video ID, show success and navigate to editor
    React.useEffect(() => {
        if (videoProcessing.status === 'completed' && videoProcessing.videoId) {
            console.log(
                '🎯 Processing complete, showing success state before navigation:',
                videoProcessing.videoId,
            )
            setShowSuccess(true)

            // Animate the success state
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
            ]).start()

            // Wait a brief moment to show the success state before navigating
            const timer = setTimeout(() => {
                router.push({
                    pathname: '/video-editor/[id]',
                    params: {
                        id: videoProcessing.videoId!,
                        referrer: 'post-recording',
                        code: pairingCode || '',
                    },
                })
            }, 1000)

            return () => clearTimeout(timer)
        }
    }, [
        videoProcessing.status,
        videoProcessing.videoId,
        router,
        fadeAnim,
        scaleAnim,
        pairingCode,
    ])

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.container}>
                <View style={styles.contentContainer}>
                    <View style={styles.card}>
                        {videoProcessing.status === 'processing' ? (
                            <>
                                <ActivityIndicator
                                    size="large"
                                    color="#FFFFFF"
                                    style={styles.icon}
                                />
                                <Text
                                    variant="titleLarge"
                                    style={styles.subtitle}
                                >
                                    Processing Video
                                </Text>
                                <Text
                                    variant="bodyLarge"
                                    style={styles.description}
                                >
                                    Please wait while we process your
                                    recording...
                                </Text>
                            </>
                        ) : videoProcessing.status === 'error' ? (
                            <>
                                <MaterialCommunityIcons
                                    name="alert-circle"
                                    size={48}
                                    color="#FF3B30"
                                    style={styles.icon}
                                />
                                <Text
                                    variant="titleLarge"
                                    style={styles.subtitle}
                                >
                                    Processing Error
                                </Text>
                                <Text
                                    variant="bodyLarge"
                                    style={styles.description}
                                >
                                    {videoProcessing.error ||
                                        'An error occurred while processing your video.'}
                                </Text>
                            </>
                        ) : showSuccess ? (
                            <Animated.View
                                style={{
                                    opacity: fadeAnim,
                                    transform: [{ scale: scaleAnim }],
                                    alignItems: 'center',
                                }}
                            >
                                <MaterialCommunityIcons
                                    name="check-circle"
                                    size={48}
                                    color="#34C759"
                                    style={styles.icon}
                                />
                                <Text
                                    variant="titleLarge"
                                    style={styles.subtitle}
                                >
                                    Processing Complete
                                </Text>
                                <Text
                                    variant="bodyLarge"
                                    style={styles.description}
                                >
                                    Your video is ready to edit
                                </Text>
                            </Animated.View>
                        ) : null}
                    </View>
                </View>
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
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
})
