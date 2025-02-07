import React from 'react'
import { StyleSheet, View } from 'react-native'
import { ActivityIndicator, Button, Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MaterialCommunityIcons } from '@expo/vector-icons'

import { VideoEditView } from '@/components/video-edit-view'

import { supabase } from '@/lib/supabase.client'

import type { VideoMetadata } from '@/types/webrtc'

interface VideoDetailsViewProps {
    videoId: string
    onClose: () => void
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`
    } else if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`
    } else if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    } else {
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }
}

export function VideoDetailsView({ videoId, onClose }: VideoDetailsViewProps) {
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [video, setVideo] = React.useState<VideoMetadata | null>(null)
    const [isEditing, setIsEditing] = React.useState(false)

    // Fetch video details
    React.useEffect(() => {
        async function fetchVideo() {
            console.log('🎥 Fetching video details:', videoId)
            try {
                const { data, error } = await supabase
                    .from('videos')
                    .select('*')
                    .eq('id', videoId)
                    .single()

                if (error) throw error

                console.log('✅ Video details loaded:', data)
                setVideo(data)
            } catch (err) {
                console.error('❌ Failed to load video:', err)
                setError(
                    err instanceof Error ? err.message : 'Failed to load video',
                )
            } finally {
                setLoading(false)
            }
        }

        fetchVideo()
    }, [videoId])

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.container}>
                    <View style={styles.contentContainer}>
                        <View style={styles.card}>
                            <ActivityIndicator
                                size="large"
                                color="#FFFFFF"
                                style={styles.icon}
                            />
                            <Text variant="titleLarge" style={styles.subtitle}>
                                Loading Video Details
                            </Text>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        )
    }

    if (error || !video) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.container}>
                    <View style={styles.contentContainer}>
                        <View style={styles.card}>
                            <MaterialCommunityIcons
                                name="alert-circle"
                                size={48}
                                color="#FF3B30"
                                style={styles.icon}
                            />
                            <Text variant="titleLarge" style={styles.subtitle}>
                                Error Loading Video
                            </Text>
                            <Text
                                variant="bodyLarge"
                                style={styles.description}
                            >
                                {error || 'Failed to load video details'}
                            </Text>
                            <Button
                                mode="contained"
                                onPress={onClose}
                                style={styles.button}
                            >
                                Close
                            </Button>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        )
    }

    if (isEditing && video) {
        return <VideoEditView videoId={video.id} />
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.container}>
                <View style={styles.contentContainer}>
                    <View style={styles.card}>
                        <MaterialCommunityIcons
                            name="video"
                            size={48}
                            color="#FFFFFF"
                            style={styles.icon}
                        />
                        <Text variant="titleLarge" style={styles.subtitle}>
                            {video.name}
                        </Text>

                        <View style={styles.metadataContainer}>
                            <View style={styles.metadataRow}>
                                <MaterialCommunityIcons
                                    name="clock-outline"
                                    size={20}
                                    color="#CCCCCC"
                                />
                                <Text style={styles.metadataText}>
                                    Duration: {Math.round(video.duration)}s
                                </Text>
                            </View>

                            <View style={styles.metadataRow}>
                                <MaterialCommunityIcons
                                    name="file-outline"
                                    size={20}
                                    color="#CCCCCC"
                                />
                                <Text style={styles.metadataText}>
                                    Size: {formatFileSize(video.size)}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.buttonContainer}>
                            <Button
                                mode="contained"
                                onPress={() => setIsEditing(true)}
                                style={styles.button}
                                icon="pencil"
                            >
                                Edit Video
                            </Button>

                            <Button
                                mode="outlined"
                                onPress={onClose}
                                style={[styles.button, styles.secondaryButton]}
                            >
                                Close
                            </Button>
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
        textAlign: 'center',
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
    metadataContainer: {
        width: '100%',
        marginVertical: 20,
        gap: 16,
    },
    metadataRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    metadataText: {
        color: '#CCCCCC',
        fontSize: 16,
    },
    buttonContainer: {
        width: '100%',
        gap: 12,
        marginTop: 20,
    },
    button: {
        width: '100%',
        borderRadius: 8,
    },
    secondaryButton: {
        borderColor: '#FFFFFF',
    },
})
