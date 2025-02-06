import React from 'react'
import {
    Dimensions,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    StyleSheet,
    View,
} from 'react-native'
import { IconButton, Text } from 'react-native-paper'
import Animated, { FadeIn, Layout } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { LinearGradient } from 'expo-linear-gradient'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import type { VideoMetadata } from '@/types/webrtc'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const COLUMN_COUNT = 3
const GRID_SPACING = 1
const ITEM_WIDTH =
    (SCREEN_WIDTH - (COLUMN_COUNT - 1) * GRID_SPACING) / COLUMN_COUNT

interface VideoListProps {
    videos: VideoMetadata[]
    onRefresh: () => void
    onEditVideo: (videoId: string) => void
}

interface VideoGridItemProps {
    video: VideoMetadata
    onPress: () => void
}

function VideoGridItem({ video, onPress }: VideoGridItemProps) {
    const formatDuration = (seconds: number | null) => {
        if (!seconds) return ''
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    return (
        <Animated.View
            entering={FadeIn}
            layout={Layout}
            style={styles.gridItem}
        >
            <Pressable onPress={onPress} style={styles.gridItemPressable}>
                <Image
                    source={{
                        uri: video.thumbnail_url || 'placeholder_image_url',
                    }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                />
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.gradientOverlay}
                >
                    <View style={styles.videoInfo}>
                        <Text style={styles.duration}>
                            {formatDuration(video.duration)}
                        </Text>
                        <View style={styles.statsContainer}>
                            <MaterialCommunityIcons
                                name="play"
                                size={12}
                                color="#FFFFFF"
                            />
                            <Text style={styles.statsText}>
                                {video.views || 0}
                            </Text>
                        </View>
                    </View>
                </LinearGradient>
            </Pressable>
        </Animated.View>
    )
}

export function VideoList({ videos, onRefresh, onEditVideo }: VideoListProps) {
    const [refreshing, setRefreshing] = React.useState(false)

    const handleRefresh = React.useCallback(async () => {
        setRefreshing(true)
        await onRefresh()
        setRefreshing(false)
    }, [onRefresh])

    const renderItem = React.useCallback(
        ({ item: video }: { item: VideoMetadata }) => (
            <VideoGridItem
                video={video}
                onPress={() => onEditVideo(video.id)}
            />
        ),
        [onEditVideo],
    )

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Videos</Text>
                <IconButton
                    icon="plus"
                    size={24}
                    iconColor="#FFFFFF"
                    onPress={() => {}}
                    style={styles.addButton}
                />
            </View>
            <FlatList
                data={videos}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                numColumns={COLUMN_COUNT}
                contentContainerStyle={styles.gridContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor="#FFFFFF"
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons
                            name="video-off"
                            size={48}
                            color="#666666"
                        />
                        <Text style={styles.emptyText}>No videos yet</Text>
                        <Text style={styles.emptySubtext}>
                            Your recorded videos will appear here
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    addButton: {
        margin: 0,
    },
    gridContainer: {
        minHeight: '100%',
    },
    gridItem: {
        width: ITEM_WIDTH,
        height: ITEM_WIDTH * 1.5,
        marginRight: GRID_SPACING,
        marginBottom: GRID_SPACING,
    },
    gridItemPressable: {
        flex: 1,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
        backgroundColor: '#1C1C1E',
    },
    gradientOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 48,
        justifyContent: 'flex-end',
        padding: 8,
    },
    videoInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    duration: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statsText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '500',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        marginTop: '50%',
    },
    emptyText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
        marginTop: 16,
    },
    emptySubtext: {
        color: '#666666',
        fontSize: 15,
        textAlign: 'center',
        marginTop: 8,
    },
})
