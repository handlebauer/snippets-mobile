import { Buffer } from 'buffer'
import React from 'react'
import {
    ActivityIndicator,
    Platform,
    Pressable,
    Share,
    StatusBar,
    StyleSheet,
    View,
} from 'react-native'
import { Text } from 'react-native-paper'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ResizeMode, Video } from 'expo-av'
import * as FileSystem from 'expo-file-system'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as VideoThumbnails from 'expo-video-thumbnails'

import { useChannel } from '@/contexts/channel.context'

import { supabase } from '@/lib/supabase.client'
import { useScreenOrientation } from '@/hooks/use-screen-orientation'
import { useVideoLoad } from '@/hooks/use-video-load'
import { useVideoPlayback } from '@/hooks/use-video-playback'
import { useVideoSave } from '@/hooks/use-video-save'
import { useVideoTrim } from '@/hooks/use-video-trim'

import { FloatingMenu } from './floating-menu'
import { GitHubBadge } from './github-badge'
import { VideoBookmarksModal } from './video-bookmarks-modal'
import { VideoHeader } from './video-header'
import { VideoMetadataModal } from './video-metadata-modal'
import { VideoScrubber } from './video-scrubber'
import { VideoThumbnailSelectorModal } from './video-thumbnail-selector-modal'
import { VideoToolbar } from './video-toolbar'

import type { AVPlaybackStatus } from 'expo-av'

interface VideoEditViewProps {
    videoId: string
}

interface Bookmark {
    id: string
    timestamp: number
    label?: string
    createdAt: string
}

export function VideoEditView({ videoId }: VideoEditViewProps) {
    const router = useRouter()
    const { referrer, code } = useLocalSearchParams<{
        referrer?: string
        code?: string
    }>()
    const isFromPostRecording = referrer === 'post-recording'
    const { setIsStreaming } = useChannel()
    const { isLandscape } = useScreenOrientation()
    const mainContainerRef = React.useRef<View>(null)
    const moreButtonRef = React.useRef<View>(null)
    const [error, setError] = React.useState<string | null>(null)

    // Log state for debugging
    console.log('[VideoEditView] Mounted with:', {
        referrer,
        code,
        isFromPostRecording,
    })

    // Load video data and URL
    const { loading, video, videoUrl, loadVideo, setVideo } = useVideoLoad({
        videoId,
    })

    // Video trimming state and controls
    const {
        trimStart,
        trimEnd,
        originalTrimStart,
        originalTrimEnd,
        hasChanges,
        isTrimming,
        handleTrimChange,
        handleTrimDragStart,
        handleTrimDragEnd,
    } = useVideoTrim({
        duration: video?.duration || 0,
    })

    // Video playback state and controls
    const {
        currentTime,
        isPlaying,
        videoRef,
        updateCurrentTime,
        updateVideoPosition,
        togglePlayback,
        handleVideoStatus,
    } = useVideoPlayback({
        duration: video?.duration || 0,
        trimStart,
        trimEnd,
    })

    // Video saving functionality
    const { loading: saveLoading, saveVideo } = useVideoSave({
        videoId,
        isFromPostRecording,
        pairingCode: code,
    })

    // UI state
    const [thumbnailsLoading, setThumbnailsLoading] = React.useState(false)
    const [thumbnails, setThumbnails] = React.useState<string[]>([])
    const [activeTab, setActiveTab] = React.useState<
        'video' | 'adjust' | 'crop'
    >('video')
    const [showMetadataModal, setShowMetadataModal] = React.useState(false)
    const [bookmarks, setBookmarks] = React.useState<Bookmark[]>([])
    const [showBookmarksModal, setShowBookmarksModal] = React.useState(false)
    const [showMenu, setShowMenu] = React.useState(false)
    const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 })
    const [showThumbnailModal, setShowThumbnailModal] = React.useState(false)
    const [, setThumbnailLoading] = React.useState(false)

    // Load video on mount
    React.useEffect(() => {
        loadVideo()
    }, [loadVideo])

    // Generate thumbnails when video URL is available
    const generateThumbnails = React.useCallback(
        async (videoUri: string) => {
            if (
                thumbnailsLoading ||
                thumbnails.length > 0 ||
                !video?.duration
            ) {
                return
            }

            setThumbnailsLoading(true)
            try {
                const thumbnailCount = 5
                const interval = video.duration / (thumbnailCount - 1)
                const newThumbnails: string[] = []

                for (let i = 0; i < thumbnailCount; i++) {
                    const time = Math.round(i * interval * 1000)
                    try {
                        const { uri } = await VideoThumbnails.getThumbnailAsync(
                            videoUri,
                            {
                                time,
                                quality: 0.5,
                            },
                        )
                        newThumbnails.push(uri)
                    } catch (err) {
                        console.warn(
                            `Failed to generate thumbnail ${i + 1}:`,
                            err,
                        )
                    }
                }

                if (newThumbnails.length > 0) {
                    setThumbnails(newThumbnails)
                }
            } catch (err) {
                console.error('Failed to generate thumbnails:', err)
            } finally {
                setThumbnailsLoading(false)
            }
        },
        [video?.duration, thumbnailsLoading, thumbnails.length],
    )

    React.useEffect(() => {
        if (
            videoUrl &&
            video?.duration &&
            !thumbnailsLoading &&
            thumbnails.length === 0
        ) {
            generateThumbnails(videoUrl)
        }
    }, [videoUrl, video?.duration, generateThumbnails])

    // Handle video load
    const handleVideoLoad = React.useCallback((status: AVPlaybackStatus) => {
        if (!status.isLoaded) return
        videoRef.current?.pauseAsync()
    }, [])

    // Handle seeking with trim boundaries
    const handleSeek = React.useCallback(
        (time: number) => {
            const constrainedTime = Math.max(trimStart, Math.min(time, trimEnd))
            updateCurrentTime(constrainedTime)
            updateVideoPosition(constrainedTime)
        },
        [trimStart, trimEnd, updateCurrentTime, updateVideoPosition],
    )

    // Handle delete video
    const handleDelete = async () => {
        if (!video) return

        try {
            const { error: storageError } = await supabase.storage
                .from('videos')
                .remove([`${videoId}/*`])

            if (storageError) throw storageError

            const { error: dbError } = await supabase
                .from('videos')
                .delete()
                .eq('id', videoId)

            if (dbError) throw dbError

            setIsStreaming(false)
            router.push('/(protected)/(tabs)/videos')
        } catch (err) {
            console.error('Failed to delete video:', err)
            setError(
                err instanceof Error ? err.message : 'Failed to delete video',
            )
        }
    }

    const handleCancel = () => {
        setIsStreaming(false)
        router.back()
    }

    const handleShare = React.useCallback(async () => {
        if (!videoUrl) return

        try {
            const result = await Share.share({
                url: videoUrl,
                title: 'Share Recording',
                message: video?.linked_repo
                    ? `Check out my coding recording for ${video.linked_repo}`
                    : 'Check out my coding recording',
            })

            if (result.action === Share.sharedAction) {
                console.log('Shared successfully')
            }
        } catch (error) {
            console.error('Error sharing:', error)
        }
    }, [videoUrl, video?.linked_repo])

    const handleSave = React.useCallback(async () => {
        if (!video || !videoUrl) return

        const result = await saveVideo({
            video,
            videoUrl,
            trimStart,
            trimEnd,
            originalTrimStart,
            originalTrimEnd,
        })

        if (result.success) {
            setIsStreaming(false)
            router.push('/(protected)/(tabs)/videos')
        }
    }, [
        video,
        videoUrl,
        trimStart,
        trimEnd,
        originalTrimStart,
        originalTrimEnd,
        saveVideo,
        setIsStreaming,
        router,
    ])

    const addBookmark = async () => {
        if (!videoRef.current) return

        try {
            const status = await videoRef.current.getStatusAsync()
            if (!status.isLoaded) return

            const timestamp = status.positionMillis / 1000

            if (bookmarks.some(b => Math.abs(b.timestamp - timestamp) < 0.1)) {
                return
            }

            const newBookmark: Bookmark = {
                id: Math.random().toString(36).slice(2, 9),
                timestamp,
                createdAt: new Date().toISOString(),
            }

            setBookmarks(prev =>
                [...prev, newBookmark].sort(
                    (a, b) => a.timestamp - b.timestamp,
                ),
            )
        } catch (err) {
            console.error('Failed to add bookmark:', err)
        }
    }

    const seekToBookmark = (timestamp: number) => {
        handleSeek(timestamp)
        setShowBookmarksModal(false)
    }

    const deleteBookmark = (id: string) => {
        setBookmarks(prev => prev.filter(b => b.id !== id))
    }

    const handleThumbnailSelect = async (thumbnailUri: string) => {
        if (!video) return

        setThumbnailLoading(true)
        try {
            const base64Data = await FileSystem.readAsStringAsync(
                thumbnailUri,
                {
                    encoding: FileSystem.EncodingType.Base64,
                },
            )

            const binaryData = Buffer.from(base64Data, 'base64')
            const fileName = `video_${Date.now()}`
            const thumbnailPath = `${videoId}/${fileName}_thumb.jpg`

            const { error: uploadError } = await supabase.storage
                .from('videos')
                .upload(thumbnailPath, binaryData, {
                    contentType: 'image/jpeg',
                    upsert: true,
                })

            if (uploadError) throw uploadError

            const { data: publicUrlData } = supabase.storage
                .from('videos')
                .getPublicUrl(thumbnailPath)

            if (!publicUrlData?.publicUrl) {
                throw new Error('Failed to get public URL for thumbnail')
            }

            const { error: updateError } = await supabase
                .from('videos')
                .update({
                    thumbnail_url: publicUrlData.publicUrl,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', videoId)

            if (updateError) throw updateError

            setVideo(prev =>
                prev
                    ? {
                          ...prev,
                          thumbnail_url: publicUrlData.publicUrl,
                      }
                    : null,
            )
        } catch (err) {
            console.error('Failed to update thumbnail:', err)
        } finally {
            setThumbnailLoading(false)
        }
    }

    const handleUpdateBookmark = async (id: string, label: string) => {
        setBookmarks(prev =>
            prev.map(bookmark =>
                bookmark.id === id ? { ...bookmark, label } : bookmark,
            ),
        )
    }

    if (error) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.container}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Pressable onPress={handleCancel} style={styles.button}>
                        <Text style={styles.buttonText}>Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        )
    }

    if (!video || !videoUrl) {
        return (
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.container}>
                    <Text style={styles.loadingText}>Loading video...</Text>
                </View>
            </SafeAreaView>
        )
    }

    return (
        <View style={styles.root}>
            <StatusBar
                translucent={true}
                backgroundColor="transparent"
                barStyle="light-content"
                hidden={isLandscape}
            />
            {(loading || saveLoading) && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
            )}
            <SafeAreaView
                style={styles.safeArea}
                edges={isLandscape ? ['left', 'right'] : ['top']}
            >
                <VideoHeader
                    isFromPostRecording={isFromPostRecording}
                    hasChanges={hasChanges!}
                    onDelete={handleDelete}
                    onCancel={handleCancel}
                    onSave={handleSave}
                    onShowMenu={() => {
                        if (moreButtonRef.current) {
                            moreButtonRef.current.measure(
                                (_x, _y, _width, _height, pageX, pageY) => {
                                    setMenuPosition({ x: pageX, y: pageY })
                                    setShowMenu(true)
                                },
                            )
                        }
                    }}
                    moreButtonRef={moreButtonRef}
                    isLandscape={isLandscape}
                />

                <View
                    style={[
                        styles.content,
                        isLandscape && styles.contentLandscape,
                    ]}
                >
                    {isLandscape && (
                        <VideoToolbar
                            activeTab={activeTab}
                            showBookmarksModal={showBookmarksModal}
                            onTabChange={setActiveTab}
                            onShowBookmarks={() => setShowBookmarksModal(true)}
                            onShare={handleShare}
                            isLandscape={true}
                        />
                    )}

                    <View
                        ref={mainContainerRef}
                        style={[
                            styles.mainContainer,
                            isLandscape && styles.mainContainerLandscape,
                        ]}
                    >
                        <View
                            style={[
                                styles.videoContainer,
                                isLandscape && styles.videoContainerLandscape,
                            ]}
                        >
                            <Video
                                ref={videoRef}
                                source={{ uri: videoUrl }}
                                style={[
                                    styles.video,
                                    isLandscape && styles.videoLandscape,
                                ]}
                                resizeMode={ResizeMode.CONTAIN}
                                onLoad={handleVideoLoad}
                                onPlaybackStatusUpdate={handleVideoStatus}
                                useNativeControls={false}
                                shouldPlay={false}
                                isLooping={false}
                                volume={1.0}
                            />
                            {video?.linked_repo && (
                                <GitHubBadge repoName={video.linked_repo} />
                            )}
                        </View>

                        {isLandscape ? (
                            <View style={styles.scrubberContainerLandscape}>
                                {activeTab === 'video' && (
                                    <VideoScrubber
                                        videoRef={videoRef}
                                        duration={video.duration}
                                        currentTime={currentTime}
                                        isPlaying={isPlaying}
                                        thumbnails={thumbnails}
                                        thumbnailsLoading={thumbnailsLoading}
                                        onSeek={handleSeek}
                                        onPlayPause={togglePlayback}
                                        trimStart={trimStart}
                                        trimEnd={trimEnd}
                                        onTrimChange={handleTrimChange}
                                        onTrimDragStart={handleTrimDragStart}
                                        onTrimDragEnd={handleTrimDragEnd}
                                        isTrimming={isTrimming}
                                    />
                                )}
                            </View>
                        ) : (
                            activeTab === 'video' && (
                                <VideoScrubber
                                    videoRef={videoRef}
                                    duration={video.duration}
                                    currentTime={currentTime}
                                    isPlaying={isPlaying}
                                    thumbnails={thumbnails}
                                    thumbnailsLoading={thumbnailsLoading}
                                    onSeek={handleSeek}
                                    onPlayPause={togglePlayback}
                                    trimStart={trimStart}
                                    trimEnd={trimEnd}
                                    onTrimChange={handleTrimChange}
                                    onTrimDragStart={handleTrimDragStart}
                                    onTrimDragEnd={handleTrimDragEnd}
                                    isTrimming={isTrimming}
                                />
                            )
                        )}
                    </View>

                    {!isLandscape && (
                        <VideoToolbar
                            activeTab={activeTab}
                            showBookmarksModal={showBookmarksModal}
                            onTabChange={setActiveTab}
                            onShowBookmarks={() => setShowBookmarksModal(true)}
                            onShare={handleShare}
                            isLandscape={false}
                        />
                    )}
                </View>
            </SafeAreaView>

            <FloatingMenu
                visible={showMenu}
                onClose={() => setShowMenu(false)}
                anchorPosition={menuPosition}
                items={[
                    {
                        title: 'Video Details',
                        icon: 'information',
                        onPress: () => setShowMetadataModal(true),
                    },
                    {
                        title: 'Choose Thumbnail',
                        icon: 'image',
                        onPress: () => {
                            setShowMenu(false)
                            setShowThumbnailModal(true)
                        },
                    },
                ]}
            />

            {video && (
                <VideoMetadataModal
                    visible={showMetadataModal}
                    onClose={() => setShowMetadataModal(false)}
                    video={video}
                />
            )}

            <VideoBookmarksModal
                visible={showBookmarksModal}
                onClose={() => setShowBookmarksModal(false)}
                bookmarks={bookmarks}
                onAddBookmark={addBookmark}
                onDeleteBookmark={deleteBookmark}
                onSeekToBookmark={seekToBookmark}
                onUpdateBookmark={handleUpdateBookmark}
            />

            {videoUrl && (
                <VideoThumbnailSelectorModal
                    visible={showThumbnailModal}
                    onClose={() => setShowThumbnailModal(false)}
                    videoUri={videoUrl}
                    duration={video.duration}
                    onSelectThumbnail={handleThumbnailSelect}
                />
            )}
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
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#121212',
    },
    navBar: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#121212',
        marginTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#333333',
    },
    navBarLandscape: {
        marginTop: 0,
        paddingHorizontal: Platform.OS === 'ios' ? 64 : 32, // Extra padding for notch area
    },
    navButton: {
        fontSize: 16,
        color: '#FFFFFF',
    },
    navTitle: {
        fontSize: 17,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    content: {
        flex: 1,
        justifyContent: 'space-between',
        backgroundColor: '#121212',
    },
    contentLandscape: {
        flexDirection: 'row',
        flex: 1,
    },
    mainContainer: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    mainContainerLandscape: {
        flex: 1,
        paddingVertical: 20,
        paddingHorizontal: Platform.OS === 'ios' ? 44 : 32,
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    videoContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#121212',
        overflow: 'hidden',
        width: '100%',
        marginBottom: 8,
    },
    videoContainerLandscape: {
        flex: 1,
        marginBottom: 16,
        width: '100%',
        maxHeight: '70%', // Ensure video doesn't take too much vertical space
    },
    video: {
        flex: 1,
        aspectRatio: 16 / 9,
        backgroundColor: '#121212',
    },
    videoLandscape: {
        width: '100%',
        aspectRatio: 16 / 9,
    },
    scrubberContainerLandscape: {
        flex: 0,
        minHeight: 100,
    },
    controlsContainer: {
        paddingBottom: 8,
    },
    controlsContainerLandscape: {
        width: 100,
        backgroundColor: '#121212',
        paddingVertical: 20,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderLeftColor: '#333333',
        marginLeft: 16, // Add spacing between main content and toolbar
    },
    toolbarContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingBottom: 16,
        backgroundColor: '#121212',
    },
    toolbarContainerLandscape: {
        flexDirection: 'column',
        paddingVertical: 0,
        paddingHorizontal: 0,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    toolButton: {
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 12,
        marginVertical: 12,
        width: 64,
    },
    toolButtonActive: {
        opacity: 1,
    },
    toolButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
        opacity: 0.8,
    },
    toolButtonTextActive: {
        color: '#0A84FF',
        opacity: 1,
    },
    loadingText: {
        color: '#FFFFFF',
        fontSize: 17,
    },
    errorText: {
        color: '#FF453A',
        fontSize: 17,
        marginBottom: 16,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    buttonText: {
        color: '#0A84FF',
        fontSize: 17,
        fontWeight: '400',
    },
    handleContainer: {
        width: '100%',
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    handle: {
        width: 36,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#424246',
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    moreButton: {
        padding: 4,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    saveButton: {
        opacity: 1,
        padding: 8,
        borderRadius: 8,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonPressed: {
        opacity: 0.8,
    },
    navButtonDisabled: {
        color: '#999999',
    },
    repoBadgeLink: {
        position: 'absolute',
        bottom: 16,
        alignSelf: 'center',
    },
    repoBadgeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    repoBadgeIcon: {
        marginRight: 6,
    },
    repoBadgeText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    bookmarkList: {
        flex: 1,
    },
    bookmarkListContent: {
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    bookmarkItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        marginBottom: 8,
    },
    bookmarkItemPressed: {
        opacity: 0.7,
    },
    bookmarkInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bookmarkTimestamp: {
        color: '#FFFFFF',
        fontSize: 17,
    },
    deleteButton: {
        color: '#FF3B30',
    },
    emptyBookmarkList: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyBookmarkText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 8,
    },
    emptyBookmarkSubtext: {
        color: '#8E8E93',
        fontSize: 15,
        textAlign: 'center',
    },
})
