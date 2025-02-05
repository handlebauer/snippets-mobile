import React, { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av'

import { supabase } from '@/lib/supabase.client'

interface VideoItem {
    id: string
    name: string
    storage_path: string
    duration: number | null
    size: number | null
    created_at: string
}

export default function VideosScreen() {
    const [videos, setVideos] = useState<VideoItem[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedVideo, setSelectedVideo] = useState<{
        url: string
        name: string
    } | null>(null)
    const videoRef = useRef<Video>(null)

    useEffect(() => {
        fetchVideos()
    }, [])

    const fetchVideos = async () => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('videos')
                .select('*')
                .eq('profile_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            setVideos(data || [])
        } catch (error) {
            console.error('Error fetching videos:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleVideoPress = async (video: VideoItem) => {
        try {
            const { data } = await supabase.storage
                .from('videos')
                .createSignedUrl(video.storage_path, 3600)

            if (data?.signedUrl) {
                setSelectedVideo({ url: data.signedUrl, name: video.name })
            }
        } catch (error) {
            console.error('Error getting video URL:', error)
        }
    }

    const handleCloseVideo = () => {
        setSelectedVideo(null)
    }

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return 'Unknown duration'
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    const formatSize = (bytes: number | null) => {
        if (!bytes) return 'Unknown size'
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(1024))
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString()
    }

    const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
        if (!status.isLoaded) return

        if (status.didJustFinish) {
            videoRef.current?.setPositionAsync(0)
        }
    }

    if (selectedVideo) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Pressable
                        onPress={handleCloseVideo}
                        style={styles.closeButton}
                    >
                        <Text style={styles.closeButtonText}>Done</Text>
                    </Pressable>
                    <Text style={styles.headerTitle}>{selectedVideo.name}</Text>
                    <View style={styles.closeButton} />
                </View>
                <View style={styles.videoPlayerContainer}>
                    <Video
                        ref={videoRef}
                        source={{ uri: selectedVideo.url }}
                        style={styles.videoPlayer}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        shouldPlay
                        isLooping={false}
                        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                    />
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Videos</Text>
            </View>
            <ScrollView style={styles.container}>
                {loading ? (
                    <Text style={styles.message}>Loading videos...</Text>
                ) : videos.length === 0 ? (
                    <Text style={styles.message}>No videos found</Text>
                ) : (
                    videos.map(video => (
                        <Pressable
                            key={video.id}
                            style={({ pressed }) => [
                                styles.videoItem,
                                pressed && styles.videoItemPressed,
                            ]}
                            onPress={() => handleVideoPress(video)}
                        >
                            <Text style={styles.videoName}>{video.name}</Text>
                            <View style={styles.videoDetails}>
                                <Text style={styles.videoInfo}>
                                    {formatDuration(video.duration)} •{' '}
                                    {formatSize(video.size)}
                                </Text>
                                <Text style={styles.videoDate}>
                                    {formatDate(video.created_at)}
                                </Text>
                            </View>
                        </Pressable>
                    ))
                )}
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333333',
        paddingHorizontal: 16,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        flex: 1,
        textAlign: 'center',
    },
    closeButton: {
        width: 60,
    },
    closeButtonText: {
        color: '#0A84FF',
        fontSize: 17,
    },
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    message: {
        color: '#666666',
        textAlign: 'center',
        marginTop: 20,
    },
    videoItem: {
        backgroundColor: '#1C1C1E',
        marginHorizontal: 16,
        marginTop: 12,
        padding: 16,
        borderRadius: 12,
    },
    videoItemPressed: {
        opacity: 0.7,
    },
    videoName: {
        fontSize: 17,
        color: '#FFFFFF',
        marginBottom: 8,
    },
    videoDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    videoInfo: {
        fontSize: 14,
        color: '#8E8E93',
    },
    videoDate: {
        fontSize: 14,
        color: '#8E8E93',
    },
    videoPlayerContainer: {
        flex: 1,
        backgroundColor: '#000000',
        justifyContent: 'center',
    },
    videoPlayer: {
        width: '100%',
        height: '100%',
    },
})
