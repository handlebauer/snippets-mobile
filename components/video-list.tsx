import React from 'react'
import {
    Dimensions,
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    StyleSheet,
    View,
} from 'react-native'
import { Text } from 'react-native-paper'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import { VideoFilterList } from './video-filter-list'

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

        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const remainingSeconds = Math.floor(seconds % 60)

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
        }
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    return (
        <Animated.View
            entering={FadeIn}
            layout={LinearTransition}
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
                    </View>
                </LinearGradient>
            </Pressable>
        </Animated.View>
    )
}

export function VideoList({ videos, onRefresh, onEditVideo }: VideoListProps) {
    const insets = useSafeAreaInsets()
    const [refreshing, setRefreshing] = React.useState(false)
    const [selectedRepo, setSelectedRepo] = React.useState<string | null>(null)
    const [showFilter, setShowFilter] = React.useState(false)
    const [searchQuery, setSearchQuery] = React.useState('')

    const handleRefresh = React.useCallback(async () => {
        setRefreshing(true)
        onRefresh()
        setRefreshing(false)
    }, [onRefresh])

    // Get unique list of repos from videos, sorted by most recent video
    const repos = React.useMemo(() => {
        const repoMap = new Map<string, Date>()
        videos.forEach(video => {
            if (video.linked_repo && video.created_at) {
                const date = new Date(video.created_at)
                const existingDate = repoMap.get(video.linked_repo)
                if (!existingDate || date > existingDate) {
                    repoMap.set(video.linked_repo, date)
                }
            }
        })
        const sortedRepos = Array.from(repoMap.entries())
            .sort((a, b) => b[1].getTime() - a[1].getTime())
            .map(([repo]) => repo)

        return sortedRepos
    }, [videos])

    // Filter videos based on selected repo
    const filteredVideos = React.useMemo(() => {
        if (!selectedRepo) return videos
        return videos.filter(v => v.linked_repo === selectedRepo)
    }, [videos, selectedRepo])

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
                <Pressable
                    onPress={() => setShowFilter(true)}
                    style={({ pressed }) => [
                        styles.filterButton,
                        pressed && styles.filterButtonPressed,
                    ]}
                >
                    <MaterialCommunityIcons
                        name={selectedRepo ? 'filter' : 'filter-outline'}
                        size={24}
                        color="#FFFFFF"
                    />
                </Pressable>
            </View>

            <Modal
                visible={showFilter}
                animationType="slide"
                transparent
                onRequestClose={() => setShowFilter(false)}
            >
                <View style={styles.modalContainer}>
                    <Pressable
                        style={styles.modalOverlay}
                        onPress={() => setShowFilter(false)}
                    />
                    <BlurView
                        intensity={90}
                        tint="dark"
                        style={[
                            styles.bottomSheet,
                            { paddingBottom: insets.bottom },
                        ]}
                    >
                        <View style={styles.handle} />
                        <View style={styles.bottomSheetHeader}>
                            <Pressable
                                onPress={() => setShowFilter(false)}
                                style={styles.cancelButton}
                            >
                                <Text style={styles.cancelButtonText}>
                                    Cancel
                                </Text>
                            </Pressable>
                            <Text style={styles.bottomSheetTitle}>
                                Filter by Repository
                            </Text>
                            <View style={styles.headerRight} />
                        </View>

                        <VideoFilterList
                            videos={videos}
                            repos={repos}
                            selectedRepo={selectedRepo}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            onSelectRepo={repo => {
                                setSelectedRepo(repo)
                                setShowFilter(false)
                            }}
                        />
                    </BlurView>
                </View>
            </Modal>

            <FlatList
                data={filteredVideos}
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
                        <Text style={styles.emptyText}>
                            {selectedRepo
                                ? `No videos for ${selectedRepo}`
                                : 'No videos yet'}
                        </Text>
                        <Text style={styles.emptySubtext}>
                            {selectedRepo
                                ? 'Try selecting a different repository'
                                : 'Your recorded videos will appear here'}
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
        backgroundColor: '#121212',
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
        flexGrow: 1,
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
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    duration: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 2,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
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
    filterButton: {
        padding: 8,
        borderRadius: 8,
    },
    filterButtonPressed: {
        opacity: 0.7,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    bottomSheet: {
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        maxHeight: '80%',
        minHeight: 400,
        overflow: 'hidden',
        paddingTop: 12,
    },
    handle: {
        width: 36,
        height: 5,
        backgroundColor: '#3A3A3C',
        borderRadius: 2.5,
        marginTop: 8,
        marginBottom: 20,
        alignSelf: 'center',
    },
    bottomSheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    bottomSheetTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
        flex: 1,
        marginTop: 4,
    },
    cancelButton: {
        minWidth: 60,
        height: 44,
        justifyContent: 'center',
        marginTop: 4,
    },
    cancelButtonText: {
        color: '#0A84FF',
        fontSize: 17,
    },
    headerRight: {
        minWidth: 60,
        height: 44,
        marginTop: 4,
    },
})
