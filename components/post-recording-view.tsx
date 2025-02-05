import React from 'react'
import { StyleSheet, View } from 'react-native'
import { ActivityIndicator, Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MaterialCommunityIcons } from '@expo/vector-icons'

import { VideoDetailsView } from '@/components/video-details-view'

import type { VideoProcessingSignal } from '@/types/webrtc'

interface PostRecordingViewProps {
    videoProcessing: NonNullable<VideoProcessingSignal>
    onClose: () => void
}

export function PostRecordingView({
    videoProcessing,
    onClose,
}: PostRecordingViewProps) {
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

    // If processing is complete and we have a video ID, show the video details
    if (videoProcessing.status === 'completed' && videoProcessing.videoId) {
        return (
            <VideoDetailsView
                videoId={videoProcessing.videoId}
                onClose={onClose}
            />
        )
    }

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
