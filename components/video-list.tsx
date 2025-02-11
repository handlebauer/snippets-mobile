import React from 'react'
import {
    Dimensions,
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    StatusBar,
    StyleSheet,
    View,
} from 'react-native'
import { Text } from 'react-native-paper'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { MaterialCommunityIcons } from '@expo/vector-icons'

import { isVideoRecording } from '@/types/recordings'

import { EditorThumbnail } from './editor-thumbnail'
import { VideoFilterList } from './video-filter-list'

import type { RecordingMetadata } from '@/types/recordings'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const COLUMN_COUNT = 3
const GRID_SPACING = 1
const ITEM_WIDTH =
    (SCREEN_WIDTH - (COLUMN_COUNT - 1) * GRID_SPACING) / COLUMN_COUNT

interface RecordingListProps {
    recordings: RecordingMetadata[]
    onRefresh: () => void
    onEditRecording: (recording: RecordingMetadata) => void
}

interface RecordingGridItemProps {
    recording: RecordingMetadata
    onPress: () => void
}

function RecordingGridItem({ recording, onPress }: RecordingGridItemProps) {
    const formatDuration = (durationInSeconds: number | null) => {
        if (!durationInSeconds) return ''

        const hours = Math.floor(durationInSeconds / 3600)
        const minutes = Math.floor((durationInSeconds % 3600) / 60)
        const remainingSeconds = Math.floor(durationInSeconds % 60)

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
        }
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    // Get duration in seconds, handling both video and editor types
    const durationInSeconds = isVideoRecording(recording)
        ? recording.duration
        : recording.duration_ms / 1000

    return (
        <Animated.View
            entering={FadeIn}
            layout={LinearTransition}
            style={styles.gridItem}
        >
            <Pressable onPress={onPress} style={styles.gridItemPressable}>
                {isVideoRecording(recording) ? (
                    <Image
                        source={{
                            uri:
                                recording.thumbnail_url ||
                                'placeholder_image_url',
                        }}
                        style={styles.thumbnail}
                        resizeMode="cover"
                    />
                ) : (
                    <EditorThumbnail
                        thumbnailCode={recording.thumbnail_code}
                        style={styles.thumbnail}
                    />
                )}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.gradientOverlay}
                >
                    <View style={styles.recordingInfo}>
                        <MaterialCommunityIcons
                            name={
                                isVideoRecording(recording)
                                    ? 'video'
                                    : 'code-braces'
                            }
                            size={16}
                            color="#FFFFFF"
                            style={styles.typeIcon}
                        />
                        <Text style={styles.duration}>
                            {formatDuration(durationInSeconds)}
                        </Text>
                    </View>
                </LinearGradient>
            </Pressable>
        </Animated.View>
    )
}

export function RecordingList({
    recordings,
    onRefresh,
    onEditRecording,
}: RecordingListProps) {
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

    // Get unique list of repos from recordings, sorted by most recent
    const repos = React.useMemo(() => {
        const repoMap = new Map<string, Date>()
        recordings.forEach(recording => {
            if (recording.linked_repo && recording.created_at) {
                const date = new Date(recording.created_at)
                const existingDate = repoMap.get(recording.linked_repo)
                if (!existingDate || date > existingDate) {
                    repoMap.set(recording.linked_repo, date)
                }
            }
        })
        const sortedRepos = Array.from(repoMap.entries())
            .sort((a, b) => b[1].getTime() - a[1].getTime())
            .map(([repo]) => repo)

        return sortedRepos
    }, [recordings])

    // Filter recordings based on selected repo
    const filteredRecordings = React.useMemo(() => {
        if (!selectedRepo) return recordings
        return recordings.filter(r => r.linked_repo === selectedRepo)
    }, [recordings, selectedRepo])

    const renderItem = React.useCallback(
        ({ item: recording }: { item: RecordingMetadata }) => (
            <RecordingGridItem
                recording={recording}
                onPress={() => onEditRecording(recording)}
            />
        ),
        [onEditRecording],
    )

    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" backgroundColor="#121212" />
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>My Recordings</Text>
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

                <FlatList
                    data={filteredRecordings}
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
                                    ? `No recordings for ${selectedRepo}`
                                    : 'No recordings yet'}
                            </Text>
                            <Text style={styles.emptySubtext}>
                                {selectedRepo
                                    ? 'Try selecting a different repository'
                                    : 'Your recordings will appear here'}
                            </Text>
                        </View>
                    }
                />
            </SafeAreaView>

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
                            videos={recordings}
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
        </View>
    )
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#121212',
    },
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
        backgroundColor: '#121212',
        borderBottomWidth: 0,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        flex: 1,
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
    recordingInfo: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    typeIcon: {
        marginRight: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 2,
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
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
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
        backgroundColor: '#808080',
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
