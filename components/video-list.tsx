import React from 'react'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { IconButton, Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MaterialCommunityIcons } from '@expo/vector-icons'

import type { VideoMetadata } from '@/types/webrtc'

interface VideoListProps {
    videos: VideoMetadata[]
    onRefresh: () => void
    onEditVideo: (videoId: string) => void
}

export function VideoList({ videos, onRefresh, onEditVideo }: VideoListProps) {
    const [refreshing, setRefreshing] = React.useState(false)

    const handleRefresh = React.useCallback(async () => {
        setRefreshing(true)
        await onRefresh()
        setRefreshing(false)
    }, [onRefresh])

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

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Videos</Text>
            </View>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor="#FFFFFF"
                    />
                }
            >
                {videos.length === 0 ? (
                    <Text style={styles.message}>No videos found</Text>
                ) : (
                    videos.map(video => (
                        <View key={video.id} style={styles.videoItemContainer}>
                            <View style={styles.videoItem}>
                                <View style={styles.videoItemContent}>
                                    <View style={styles.videoTitleRow}>
                                        <MaterialCommunityIcons
                                            name="video"
                                            size={24}
                                            color="#CCCCCC"
                                            style={styles.videoIcon}
                                        />
                                        <Text style={styles.videoName}>
                                            {video.name}
                                        </Text>
                                    </View>
                                    <View style={styles.videoDetails}>
                                        <Text style={styles.videoInfo}>
                                            {formatDuration(video.duration)} •{' '}
                                            {formatSize(video.size)}
                                        </Text>
                                        <Text style={styles.videoDate}>
                                            {formatDate(video.created_at)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <IconButton
                                icon="pencil"
                                size={20}
                                iconColor="#0A84FF"
                                onPress={() => onEditVideo(video.id)}
                                style={styles.editButton}
                            />
                        </View>
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
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333333',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    message: {
        color: '#FFFFFF',
        textAlign: 'center',
        marginTop: 24,
        opacity: 0.5,
    },
    videoItemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    videoItem: {
        flex: 1,
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        overflow: 'hidden',
    },
    videoItemContent: {
        padding: 12,
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
        flex: 1,
        fontSize: 17,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    videoDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    videoInfo: {
        fontSize: 13,
        color: '#CCCCCC',
    },
    videoDate: {
        fontSize: 13,
        color: '#CCCCCC',
        opacity: 0.7,
    },
    editButton: {
        marginLeft: 8,
    },
})
