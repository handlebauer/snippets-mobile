import React, { useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av'
import { useRouter } from 'expo-router'

import { VideoList } from '@/components/video-list'

import { useVideos } from '@/hooks/use-videos'

export default function VideosScreen() {
    const router = useRouter()
    const { videos, loading, error, refetch } = useVideos()
    const [selectedVideo, setSelectedVideo] = useState<{
        url: string
        name: string
    } | null>(null)
    const videoRef = useRef<Video>(null)

    const handleEditVideo = (videoId: string) => {
        router.push(`/video-editor/${videoId}`)
    }

    const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
        if (!status.isLoaded) return

        if (status.didJustFinish) {
            videoRef.current?.setPositionAsync(0)
        }
    }

    if (loading) {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Text>Loading videos...</Text>
            </View>
        )
    }

    if (error) {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Text>Error: {error}</Text>
            </View>
        )
    }

    if (selectedVideo) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Pressable
                        onPress={() => setSelectedVideo(null)}
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
        <VideoList
            videos={videos}
            onRefresh={refetch}
            onEditVideo={handleEditVideo}
        />
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
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    scrollContent: {
        paddingTop: 12,
    },
    message: {
        color: '#666666',
        textAlign: 'center',
        marginTop: 20,
    },
    videoItemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginTop: 12,
    },
    videoItem: {
        flex: 1,
        backgroundColor: '#1C1C1E',
        padding: 16,
        borderRadius: 12,
    },
    videoItemPressed: {
        opacity: 0.7,
    },
    videoItemContent: {
        flex: 1,
    },
    videoTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    videoIcon: {
        marginRight: 8,
    },
    videoName: {
        fontSize: 17,
        color: '#FFFFFF',
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
    editButton: {
        marginLeft: 8,
    },
    closeButton: {
        width: 60,
    },
    closeButtonText: {
        color: '#0A84FF',
        fontSize: 17,
    },
})
